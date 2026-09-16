/**
 * LLM Audio Service
 * Generates and plays authentic native pronunciations powered by Gemini TTS & OpenAI Audio Speech
 * with fallback to direct fetch or browser synthesis.
 */

export interface LLMSpeechOptions {
  apiKey?: string;
  voice?: string;
  speed?: number;
  model?: string;
}

export class LLMAudioService {
  private static activeAudio: HTMLAudioElement | null = null;
  private static activeAudioCtx: AudioContext | null = null;
  private static activeSource: AudioBufferSourceNode | null = null;

  public static stop(): void {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {
        console.warn('Error stopping audio', e);
      }
      this.activeAudio = null;
    }

    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }

    if (this.activeAudioCtx && this.activeAudioCtx.state !== 'closed') {
      try {
        this.activeAudioCtx.close();
      } catch (e) {}
      this.activeAudioCtx = null;
    }
  }

  /**
   * Generates authentic native speech using Gemini's Neural Audio Speech model
   * @param text Target word or phrase to pronounce
   * @param apiKey Google Gemini API Key
   * @param voiceName Gemini voice (Puck, Charon, Kore, Fenrir, Aoede)
   * @param languageName Name of the target language
   */
  public static async speakWithGemini(
    text: string,
    apiKey: string,
    voiceName = 'Puck',
    languageName = 'English'
  ): Promise<void> {
    if (!apiKey) {
      throw new Error('No Gemini API key provided for speech generation');
    }

    this.stop();

    const models = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are an expert native speaker of ${languageName}. Pronounce the ${languageName} word "${text}" with flawless native phonetics, authentic accent, and natural cadence. Say only the word "${text}", nothing else.`
                  }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName
                  }
                }
              }
            }
          })
        });

        if (!res.ok) {
          lastError = new Error(`Gemini TTS error (${res.status}): ${res.statusText}`);
          continue;
        }

        const data = await res.json();
        const base64Pcm = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Pcm) {
          await this.playPcmBase64(base64Pcm, 24000);
          return;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Gemini TTS audio generation failed');
  }

  /**
   * Plays raw 16-bit linear PCM audio base64 data
   */
  public static async playPcmBase64(base64Data: string, sampleRate = 24000): Promise<void> {
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate
    });
    this.activeAudioCtx = audioCtx;

    const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = audioCtx.createBufferSource();
    this.activeSource = source;
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
        }
        try {
          audioCtx.close();
        } catch (e) {}
        if (this.activeAudioCtx === audioCtx) {
          this.activeAudioCtx = null;
        }
        resolve();
      };
      source.start(0);
    });
  }

  /**
   * Alias for speakWithLLM
   */
  public static async speakWithOpenAI(text: string, options: LLMSpeechOptions): Promise<void> {
    return this.speakWithLLM(text, options);
  }

  /**
   * Generates authentic native speech using OpenAI's Audio Speech model
   * @param text Target word or phrase to pronounce
   * @param options Configuration including API key, voice, and speed
   */
  public static async speakWithLLM(text: string, options: LLMSpeechOptions): Promise<void> {
    if (!options.apiKey) {
      throw new Error('No API key provided for LLM speech generation');
    }

    this.stop();

    const targetVoice = options.voice || 'alloy';
    const targetSpeed = options.speed || 1.0;
    const targetModel = options.model || 'tts-1';

    let audioBlob: Blob | null = null;

    // 1. First attempt: Use local server/Vite proxy
    try {
      const proxyRes = await fetch('/api/openai/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: options.apiKey,
          input: text,
          voice: targetVoice,
          speed: targetSpeed,
          model: targetModel
        })
      });

      if (proxyRes.ok) {
        audioBlob = await proxyRes.blob();
      } else {
        console.warn('Proxy /api/openai/speech returned status', proxyRes.status);
      }
    } catch (proxyErr) {
      console.warn('Proxy speech fetch error, attempting direct API call', proxyErr);
    }

    // 2. Second attempt: Direct OpenAI Audio Speech API
    if (!audioBlob) {
      const directRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          input: text,
          voice: targetVoice,
          speed: targetSpeed
        })
      });

      if (!directRes.ok) {
        const errDetail = await directRes.text();
        throw new Error(`OpenAI Speech generation failed: ${errDetail}`);
      }

      audioBlob = await directRes.blob();
    }

    // 3. Create audio playback
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    this.activeAudio = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
        resolve();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
        reject(new Error(`Audio element playback failed: ${e}`));
      };

      audio.play().catch((err) => {
        URL.revokeObjectURL(audioUrl);
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
        reject(err);
      });
    });
  }
}

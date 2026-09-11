/**
 * LLM Audio Service
 * Generates and plays authentic native pronunciations powered by OpenAI Audio Speech
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

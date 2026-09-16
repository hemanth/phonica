import { LiveStatus } from '../types';

export interface TargetWordInfo {
  word: string;
  language: string;
  locale?: string;
  phonetic?: string;
  syllables?: string[];
  meaning?: string;
}

export interface GeminiLiveOptions {
  apiKey: string;
  model?: string;
  voiceName?: string;
  coachingLanguage?: string;
  coachingLocale?: string;
  targetLanguage?: string;
  targetLocale?: string;
  targetWord?: TargetWordInfo;
  onStatusChange?: (status: LiveStatus) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onAudioLevel?: (level: number) => void; // 0 to 1 for visualizer
  onError?: (error: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private outputAudioTime: number = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private pendingInitialPrompt: string | null = null;
  private options: GeminiLiveOptions;
  private currentAssistantTranscript: string = '';

  constructor(options: GeminiLiveOptions) {
    this.options = options;
  }

  async connect(initialPrompt?: string) {
    const rawApiKey = this.options.apiKey ? this.options.apiKey.trim() : '';
    if (!rawApiKey) {
      this.options.onError?.('Gemini API Key is required.');
      return;
    }

    try {
      this.options.onStatusChange?.('connecting');
      this.isSetupComplete = false;
      this.pendingInitialPrompt = initialPrompt || null;
      this.currentAssistantTranscript = '';

      // 1. PRIME & UNLOCK AUDIO CONTEXTS IMMEDIATELY IN DIRECT USER GESTURE CONTEXT
      this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      this.outputAudioTime = this.outputAudioCtx.currentTime;

      // 2. Prepare microphone hardware while user gesture is active
      await this.startMicrophone();

      // 3. Connect WebSocket to Google Gemini Bidi endpoint (v1beta)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(rawApiKey)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;

        // Determine validated target model
        let targetModel = (this.options.model || 'models/gemini-3.8-live').trim();
        if (!targetModel.startsWith('models/gemini-3.8-live')) {
          targetModel = 'models/gemini-3.8-live';
        }

        const coachingLang = this.options.coachingLanguage || 'English (US)';
        const coachingLocale = this.options.coachingLocale || 'en-US';
        const targetLang = this.options.targetLanguage || 'English';
        const targetLocale = this.options.targetLocale || 'en-US';
        const targetWord = this.options.targetWord;
        const voiceName = this.options.voiceName || 'Puck';

        const setupMessage: any = {
          setup: {
            model: targetModel,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName
                  }
                }
              }
            },
            inputAudioTranscription: {},
            systemInstruction: {
              parts: [
                {
                  text: `You are 'Vocalis', an elite polyglot acoustic pronunciation coach and phonetics maestro.
You maintain a single, consistent voice persona (${voiceName}) throughout this entire session. Do not switch voice personas.

SESSION LOCALE & LINGUISTIC SPECIFICATION:
- VOICE PERSONA: ${voiceName} (Strict Single Voice)
- COACHING CONVERSATION LANGUAGE: ${coachingLang} (Locale: ${coachingLocale})
- TARGET PRACTICE LANGUAGE: ${targetLang} (Locale: ${targetLocale})
${targetWord ? `- CURRENT PRACTICE WORD: "${targetWord.word}" (Locale: ${targetLocale}, IPA: ${targetWord.phonetic || 'N/A'}, Syllables: ${targetWord.syllables?.join(' · ') || targetWord.word}${targetWord.meaning ? `, Meaning: "${targetWord.meaning}"` : ''})` : ''}

CRITICAL RULES:
1. STRICT CONSISTENT VOICE & COACHING STREAM:
   - Deliver all your spoken explanations, lip/tongue placement guidance, and conversational feedback strictly in ${coachingLang} (${coachingLocale}) using your assigned voice (${voiceName}).
   - Never switch into a different voice persona.
2. ACCURATE NATIVE LOCALE MODELING:
   - When demonstrating or modeling practice words, pronounce the target word with authentic native ${targetLocale} phonetics and accent.
   - Ground your phonetic guidance in the specific articulation rules of ${targetLocale}.
3. ATTENTIVE LISTENING & EVALUATION:
   - Listen attentively to the user's voice streamed through the microphone.
   - Accurately assess whether their pronunciation matches authentic native ${targetLocale} speech.
   - Gently isolate any mispronounced syllables and provide concrete physical guidance (tongue height, lip rounding, aspiration).
4. CONCISE SPOKEN CADENCE:
   - Keep answers natural, lively, and rhythmically spoken (2-3 sentences max per turn).`
                }
              ]
            }
          }
        };

        if (targetModel.includes('extended-thinking')) {
          setupMessage.setup.generationConfig.thinkingConfig = {
            thinkingLevel: 'HIGH'
          };
        }

        this.ws?.send(JSON.stringify(setupMessage));
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          let data: any;
          if (typeof event.data === 'string') {
            data = JSON.parse(event.data);
          } else if (event.data instanceof Blob) {
            const text = await event.data.text();
            data = JSON.parse(text);
          }

          if (!data) return;

          // 1. Handle server setup completion
          if (data.setupComplete) {
            this.isSetupComplete = true;
            this.options.onStatusChange?.('connected');

            // Send initial conversational prompt if provided
            if (this.pendingInitialPrompt) {
              const prompt = this.pendingInitialPrompt;
              this.pendingInitialPrompt = null;
              this.sendPrompt(prompt);
            }
          }

          // 2. Handle assistant speech transcription
          if (data.serverContent?.outputTranscription?.text) {
            const textChunk = data.serverContent.outputTranscription.text;
            this.currentAssistantTranscript += textChunk;
          }

          // User input audio transcription from server
          if (data.serverContent?.inputAudioTranscription?.text) {
            this.options.onTranscript?.('user', data.serverContent.inputAudioTranscription.text);
          }
          if (data.serverContent?.userTurn?.parts) {
            for (const part of data.serverContent.userTurn.parts) {
              if (part.text) {
                this.options.onTranscript?.('user', part.text);
              }
            }
          }

          // 3. Handle model audio chunks
          if (data.serverContent?.modelTurn?.parts) {
            this.options.onStatusChange?.('speaking');

            for (const part of data.serverContent.modelTurn.parts) {
              if (part.inlineData && part.inlineData.data) {
                // Audio chunk received (PCM 24000Hz 16-bit little endian)
                this.playAudioChunk(part.inlineData.data, 24000);
              }
              if (part.text) {
                this.currentAssistantTranscript += part.text;
              }
            }
          }

          // 4. Handle interruption (user spoke over coach)
          if (data.serverContent?.interrupted) {
            this.stopAudioPlayback();
            this.currentAssistantTranscript = '';
            this.options.onStatusChange?.('listening');
          }

          // 5. Handle turn completion from model
          if (data.serverContent?.turnComplete || data.serverContent?.generationComplete) {
            if (this.currentAssistantTranscript.trim()) {
              this.options.onTranscript?.('assistant', this.currentAssistantTranscript.trim());
              this.currentAssistantTranscript = '';
            }
            this.options.onStatusChange?.('listening');
          }
        } catch (e: any) {
          console.error('Error parsing Gemini message', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('Gemini Live WebSocket error', e);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.isConnected = false;
        this.isSetupComplete = false;
        this.cleanupAudio();

        if (event.code !== 1000 && event.code !== 1005) {
          const reasonMsg = event.reason ? `: ${event.reason}` : ` (code ${event.code})`;
          console.warn(`Gemini Live WebSocket closed${reasonMsg}`);
          this.options.onError?.(`Gemini Live closed${reasonMsg}. Check your API key or model configuration.`);
          this.options.onStatusChange?.('error');
        } else {
          this.options.onStatusChange?.('idle');
        }
      };

    } catch (err: any) {
      this.options.onError?.(err?.message || 'Failed to connect to Gemini Live');
      this.options.onStatusChange?.('error');
    }
  }

  /**
   * Resamples an incoming audio buffer to 16,000 Hz using linear interpolation
   */
  private resampleTo16k(inputData: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return inputData;
    const ratio = inputSampleRate / 16000;
    const targetLength = Math.round(inputData.length / ratio);
    const result = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const indexFloor = Math.floor(srcIndex);
      const indexCeil = Math.min(inputData.length - 1, Math.ceil(srcIndex));
      const fraction = srcIndex - indexFloor;
      result[i] = inputData[indexFloor] * (1 - fraction) + inputData[indexCeil] * fraction;
    }
    return result;
  }

  /**
   * Evaluates user voice activity for barge-in audio stopping
   */
  private handleVoiceActivity(rms: number) {
    if (rms > 0.05) {
      // User spoke over assistant playback: interrupt playback immediately
      this.stopAudioPlayback();
    }
  }

  private async startMicrophone() {
    try {
      if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
        this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      const actualSampleRate = this.inputAudioCtx.sampleRate;

      const processAudioChunk = (inputData: Float32Array) => {
        if (!this.isConnected || !this.isSetupComplete || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Calculate audio RMS for visualizer and VAD
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.options.onAudioLevel?.(Math.min(1, rms * 4));

        // Evaluate Voice Activity Detection for conversational back-and-forth
        this.handleVoiceActivity(rms);

        // Resample input audio buffer to 16,000 Hz if hardware operates at 44.1k or 48k
        const pcm16kData = this.resampleTo16k(inputData, actualSampleRate);

        // Convert Float32Array to 16-bit PCM Int16Array
        const pcm16 = new Int16Array(pcm16kData.length);
        for (let i = 0; i < pcm16kData.length; i++) {
          const s = Math.max(-1, Math.min(1, pcm16kData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to Base64
        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Audio = btoa(binary);

        const realTimeMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ]
          }
        };

        this.ws.send(JSON.stringify(realTimeMessage));
      };

      let workletReady = false;
      if (this.inputAudioCtx.audioWorklet) {
        try {
          const workletCode = `
class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bytesWritten++] = channel[i];
      if (this.bytesWritten >= this.bufferSize) {
        this.port.postMessage(this.buffer.slice(0, this.bufferSize));
        this.bytesWritten = 0;
      }
    }
    return true;
  }
}
try {
  registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
} catch (e) {}
`;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await this.inputAudioCtx.audioWorklet.addModule(workletUrl);

          this.workletNode = new AudioWorkletNode(this.inputAudioCtx, 'gemini-audio-processor');
          this.workletNode.port.onmessage = (event) => {
            processAudioChunk(event.data);
          };

          this.silentGain = this.inputAudioCtx.createGain();
          this.silentGain.gain.value = 0;

          this.sourceNode.connect(this.workletNode);
          this.workletNode.connect(this.silentGain);
          this.silentGain.connect(this.inputAudioCtx.destination);
          workletReady = true;
        } catch (workletErr) {
          console.warn('AudioWorklet setup failed, falling back to ScriptProcessor', workletErr);
          workletReady = false;
        }
      }

      if (!workletReady) {
        this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          processAudioChunk(e.inputBuffer.getChannelData(0));
        };
        this.sourceNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.inputAudioCtx.destination);
      }

      this.options.onStatusChange?.('listening');

    } catch (err: any) {
      console.error('Microphone error', err);
      this.options.onError?.('Microphone access denied or unavailable: ' + (err?.message || ''));
    }
  }

  private stopAudioPlayback() {
    for (const src of this.scheduledSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {}
    }
    this.scheduledSources = [];
    if (this.outputAudioCtx) {
      this.outputAudioTime = this.outputAudioCtx.currentTime;
    }
  }

  private playAudioChunk(base64Data: string, sampleRate = 24000) {
    try {
      if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
        this.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.outputAudioCtx.state === 'suspended') {
        this.outputAudioCtx.resume();
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      const bufferSource = this.outputAudioCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;

      // Audio level output for visualizer
      let sum = 0;
      for (let i = 0; i < float32Array.length; i++) {
        sum += float32Array[i] * float32Array[i];
      }
      const rms = Math.sqrt(sum / float32Array.length);
      this.options.onAudioLevel?.(Math.min(1, rms * 3.5));

      bufferSource.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.outputAudioTime < currentTime) {
        this.outputAudioTime = currentTime;
      }

      bufferSource.start(this.outputAudioTime);
      this.outputAudioTime += audioBuffer.duration;

      this.scheduledSources.push(bufferSource);
      bufferSource.onended = () => {
        const idx = this.scheduledSources.indexOf(bufferSource);
        if (idx !== -1) {
          this.scheduledSources.splice(idx, 1);
        }
      };
    } catch (e) {
      console.error('Error playing received audio chunk', e);
    }
  }

  updateContext(params: {
    coachingLanguage?: string;
    coachingLocale?: string;
    targetLanguage?: string;
    targetLocale?: string;
    targetWord?: TargetWordInfo;
  }) {
    if (params.coachingLanguage) this.options.coachingLanguage = params.coachingLanguage;
    if (params.coachingLocale) this.options.coachingLocale = params.coachingLocale;
    if (params.targetLanguage) this.options.targetLanguage = params.targetLanguage;
    if (params.targetLocale) this.options.targetLocale = params.targetLocale;
    if (params.targetWord) this.options.targetWord = params.targetWord;
  }

  sendPrompt(text: string, displayTranscript?: string | false) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      this.pendingInitialPrompt = text;
      return;
    }
    if (displayTranscript !== false) {
      this.options.onTranscript?.('user', displayTranscript !== undefined ? displayTranscript : text);
    }
    const clientContent = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        turnComplete: true
      }
    };
    this.ws.send(JSON.stringify(clientContent));
  }

  disconnect() {
    this.isSetupComplete = false;
    this.pendingInitialPrompt = null;
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch (e) {}
      this.ws = null;
    }
    this.cleanupAudio();
    this.isConnected = false;
    this.options.onStatusChange?.('idle');
  }

  private cleanupAudio() {
    this.stopAudioPlayback();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.isUserSpeaking = false;
    this.speechDetectedInTurn = false;
    this.currentAssistantTranscript = '';

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.silentGain) {
      this.silentGain.disconnect();
      this.silentGain = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }
  }
}

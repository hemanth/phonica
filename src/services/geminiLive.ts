import { LiveStatus } from '../types';

export interface GeminiLiveOptions {
  apiKey: string;
  voiceName?: string;
  coachingLanguage?: string;
  onStatusChange?: (status: LiveStatus) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onAudioLevel?: (level: number) => void; // 0 to 1 for visualizer
  onError?: (error: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private outputAudioTime: number = 0;
  private isConnected: boolean = false;
  private options: GeminiLiveOptions;

  constructor(options: GeminiLiveOptions) {
    this.options = options;
  }

  async connect(initialPrompt?: string) {
    if (!this.options.apiKey) {
      this.options.onError?.('Gemini API Key is required.');
      return;
    }

    try {
      this.options.onStatusChange?.('connecting');
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.options.apiKey)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.options.onStatusChange?.('connected');

        // Send Setup frame
        const setupMessage = {
          setup: {
            model: 'models/gemini-2.0-flash-exp',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: this.options.voiceName || 'Puck'
                  }
                }
              }
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro. 
IMPORTANT: Always speak, explain, and deliver your coaching advice, tips, feedback, and conversational dialogue strictly in ${this.options.coachingLanguage || 'English (US)'}.
When demonstrating or modeling practice words from world languages, pronounce the target word with authentic native phonetics, then explain mechanics in ${this.options.coachingLanguage || 'English (US)'}.
Be warm, vibrant, encouraging, and razor-sharp with phonetics.
Break down tricky consonants, vowel roundings, lip and tongue placement.
When the user speaks or repeats a word, evaluate their pronunciation with precision, praise what they nailed, and gently guide the specific syllable that needs adjusting.
Keep responses concise, conversational, and rhythmically spoken.`
                }
              ]
            }
          }
        };

        this.ws?.send(JSON.stringify(setupMessage));

        if (initialPrompt) {
          this.sendPrompt(initialPrompt);
        }

        // Start microphone
        this.startMicrophone();
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

          // Process server turn
          if (data.serverContent?.modelTurn?.parts) {
            this.options.onStatusChange?.('speaking');

            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                this.options.onTranscript?.('assistant', part.text);
              }

              if (part.inlineData && part.inlineData.data) {
                // Audio chunk received (PCM 24000Hz 16-bit little endian)
                this.playAudioChunk(part.inlineData.data, 24000);
              }
            }
          }

          if (data.serverContent?.turnComplete) {
            this.options.onStatusChange?.('listening');
          }
        } catch (e: any) {
          console.error('Error parsing Gemini message', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('Gemini Live WebSocket error', e);
        this.options.onError?.('Gemini Live WebSocket encountered a connection error. Check your API key or network.');
        this.options.onStatusChange?.('error');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.cleanupAudio();
        this.options.onStatusChange?.('idle');
      };

    } catch (err: any) {
      this.options.onError?.(err?.message || 'Failed to connect to Gemini Live');
      this.options.onStatusChange?.('error');
    }
  }

  private async startMicrophone() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      
      // Buffer size 2048 at 16kHz = ~128ms chunks
      this.scriptProcessor = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate audio RMS for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.options.onAudioLevel?.(Math.min(1, rms * 4));

        // Convert Float32Array to 16-bit PCM Int16Array
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
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

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioCtx.destination);
      this.options.onStatusChange?.('listening');

    } catch (err: any) {
      console.error('Microphone error', err);
      this.options.onError?.('Microphone access denied or unavailable: ' + (err?.message || ''));
    }
  }

  private playAudioChunk(base64Data: string, sampleRate = 24000) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate
        });
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
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

      const audioBuffer = this.audioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      const bufferSource = this.audioCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;

      // Audio level output for visualizer
      let sum = 0;
      for (let i = 0; i < float32Array.length; i++) {
        sum += float32Array[i] * float32Array[i];
      }
      const rms = Math.sqrt(sum / float32Array.length);
      this.options.onAudioLevel?.(Math.min(1, rms * 3.5));

      bufferSource.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      if (this.outputAudioTime < currentTime) {
        this.outputAudioTime = currentTime;
      }

      bufferSource.start(this.outputAudioTime);
      this.outputAudioTime += audioBuffer.duration;
    } catch (e) {
      console.error('Error playing received audio chunk', e);
    }
  }

  sendPrompt(text: string) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.options.onTranscript?.('user', text);
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanupAudio();
    this.isConnected = false;
    this.options.onStatusChange?.('idle');
  }

  private cleanupAudio() {
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
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

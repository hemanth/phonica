import { LiveStatus } from '../types';

export interface GeminiLiveOptions {
  apiKey: string;
  model?: string;
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
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private outputAudioTime: number = 0;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private pendingInitialPrompt: string | null = null;
  private options: GeminiLiveOptions;

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

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(rawApiKey)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;

        // Determine validated target model
        let targetModel = (this.options.model || 'models/gemini-3.8-live').trim();
        if (!targetModel.startsWith('models/gemini-3.8-live')) {
          targetModel = 'models/gemini-3.8-live';
        }

        const generationConfig: any = {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.options.voiceName || 'Puck'
              }
            }
          }
        };

        if (targetModel.includes('extended-thinking')) {
          generationConfig.thinkingConfig = {
            thinkingLevel: 'HIGH'
          };
        }

        const setupMessage = {
          setup: {
            model: targetModel,
            generationConfig,
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

          // Handle server setup complete
          if (data.setupComplete) {
            this.isSetupComplete = true;
            this.options.onStatusChange?.('connected');

            if (this.pendingInitialPrompt) {
              const prompt = this.pendingInitialPrompt;
              this.pendingInitialPrompt = null;
              this.sendPrompt(prompt);
            }

            // Start microphone stream only after setup is acknowledged
            this.startMicrophone();
          }

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

          if (data.serverContent?.turnComplete || data.serverContent?.interrupted || data.serverContent?.interaction_status === 'IDLE') {
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
      
      const processAudioChunk = (inputData: Float32Array) => {
        if (!this.isConnected || !this.isSetupComplete || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

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

      if (this.audioCtx.audioWorklet) {
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
registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
`;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await this.audioCtx.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        this.workletNode = new AudioWorkletNode(this.audioCtx, 'gemini-audio-processor');
        this.workletNode.port.onmessage = (event) => {
          processAudioChunk(event.data);
        };

        this.silentGain = this.audioCtx.createGain();
        this.silentGain.gain.value = 0;

        this.sourceNode.connect(this.workletNode);
        this.workletNode.connect(this.silentGain);
        this.silentGain.connect(this.audioCtx.destination);
      } else {
        // Fallback for legacy browser environments without AudioWorklet
        this.scriptProcessor = this.audioCtx.createScriptProcessor(2048, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          processAudioChunk(e.inputBuffer.getChannelData(0));
        };
        this.sourceNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioCtx.destination);
      }

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
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      this.pendingInitialPrompt = text;
      return;
    }
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
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

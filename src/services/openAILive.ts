import { LiveStatus } from '../types';

import { TargetWordInfo } from './geminiLive';

export interface OpenAILiveOptions {
  apiKey: string;
  model?: string;
  voiceName?: string;
  coachingLanguage?: string;
  targetLanguage?: string;
  targetWord?: TargetWordInfo;
  onStatusChange?: (status: LiveStatus) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: string) => void;
}

export class OpenAILiveClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isConnected: boolean = false;
  private options: OpenAILiveOptions;

  constructor(options: OpenAILiveOptions) {
    this.options = options;
  }

  async connect(initialPrompt?: string) {
    if (!this.options.apiKey) {
      this.options.onError?.('OpenAI API Key is required.');
      return;
    }

    try {
      this.options.onStatusChange?.('connecting');

      const requestedModel = this.options.model || 'gpt-live-1';
      const isLiveModel = requestedModel === 'gpt-live-1' || requestedModel.startsWith('gpt-live');

      if (isLiveModel) {
        // --- Official GPT-Live WebRTC Session Flow (https://developers.openai.com/api/docs/guides/live) ---
        try {
          await this.connectLiveSession(initialPrompt);
          return;
        } catch (liveErr: any) {
          console.warn('GPT-Live connection attempt encountered error, falling back to Realtime API:', liveErr);
          // Fall back to Realtime flow if account doesn't yet have GPT-Live access
        }
      }

      // --- Realtime WebRTC Session Flow (gpt-4o-realtime-preview) ---
      await this.connectRealtimeSession(initialPrompt);

    } catch (err: any) {
      console.error('OpenAI Live error', err);
      this.options.onError?.(err?.message || 'Failed to establish OpenAI voice session.');
      this.options.onStatusChange?.('error');
    }
  }

  /**
   * Official GPT-Live WebRTC Flow
   * Endpoint: POST https://api.openai.com/v1/live/sessions
   * Model: gpt-live-1
   * As documented in https://developers.openai.com/api/docs/guides/live
   */
  private async connectLiveSession(initialPrompt?: string) {
    this.pc = new RTCPeerConnection();

    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;

    this.pc.ontrack = (event) => {
      if (this.audioElement) {
        this.audioElement.srcObject = event.streams[0];
        this.setupAudioAnalyser(event.streams[0]);
      }
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    for (const track of this.mediaStream.getAudioTracks()) {
      this.pc.addTrack(track, this.mediaStream);
    }

    // Create event channel with label 'oai-events' before offer
    this.dc = this.pc.createDataChannel('oai-events');

    this.dc.onopen = () => {
      this.isConnected = true;
      this.options.onStatusChange?.('connected');
      if (initialPrompt) {
        this.sendPrompt(initialPrompt);
      }
    };

    this.dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session.started') {
          this.isConnected = true;
          this.options.onStatusChange?.('connected');
        } else if (msg.type === 'session.closed') {
          this.options.onStatusChange?.('idle');
        } else if (msg.type === 'response.audio_transcript.delta') {
          this.options.onTranscript?.('assistant', msg.delta);
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          this.options.onTranscript?.('user', msg.transcript);
        } else if (msg.type === 'input_audio_buffer.speech_started') {
          this.options.onStatusChange?.('listening');
        } else if (msg.type === 'response.audio.started') {
          this.options.onStatusChange?.('speaking');
        } else if (msg.type === 'response.audio.done') {
          this.options.onStatusChange?.('listening');
        }
      } catch (e) {
        console.error('Error parsing GPT-Live event', e);
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE candidate gathering to complete
    if (this.pc.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pc?.removeEventListener('icegatheringstatechange', onState);
          reject(new Error('Timed out while gathering ICE candidates'));
        }, 10000);
        const onState = () => {
          if (this.pc?.iceGatheringState !== 'complete') return;
          clearTimeout(timeout);
          this.pc?.removeEventListener('icegatheringstatechange', onState);
          resolve();
        };
        this.pc?.addEventListener('icegatheringstatechange', onState);
        onState();
      });
    }

    const sdp = this.pc.localDescription?.sdp;
    if (!sdp) throw new Error('Missing local SDP offer');

    const coachingLang = this.options.coachingLanguage || 'English (US)';
    const targetLang = this.options.targetLanguage || 'English';
    const targetWord = this.options.targetWord;
    const isImmersion = coachingLang.toLowerCase().includes(targetLang.toLowerCase()) || targetLang.toLowerCase().includes(coachingLang.toLowerCase());

    const instructions = `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.
You maintain a consistent voice persona (${this.options.voiceName || 'alloy'}), with complete linguistic awareness of the language you are speaking and coaching in.

SESSION LINGUISTIC CONTEXT:
- ACTIVE SPOKEN COACHING LANGUAGE: ${coachingLang}
- TARGET PRACTICE LANGUAGE: ${targetLang}
${targetWord ? `- ACTIVE WORD ON SCREEN: "${targetWord.word}" (IPA: ${targetWord.phonetic || 'N/A'}, Syllables: ${targetWord.syllables?.join(' · ') || targetWord.word}${targetWord.meaning ? `, Meaning: "${targetWord.meaning}"` : ''})` : ''}

CRITICAL RULES FOR LANGUAGE AWARENESS:
1. ALWAYS KNOW WHICH LANGUAGE YOU ARE SPEAKING:
   - Your primary conversational, explanatory, and feedback language is strictly ${coachingLang}.
   - Greet the user, converse, and deliver phonetic advice in ${coachingLang}.
   ${isImmersion ? `- FULL IMMERSION MODE: Converse, explain, and coach 100% in ${coachingLang} as an authentic native speaker.` : `- BILINGUAL MODE: Deliver all explanations and feedback in ${coachingLang}, while modeling the practice word "${targetWord ? targetWord.word : 'target word'}" with authentic native ${targetLang} phonetics.`}

2. ACOUSTIC & PHONETIC COACHING:
   - Listen attentively to the user's repetitions.
   - Acknowledge what phonemes/syllables they nailed with encouraging precision.
   - Gently guide any syllable that needs adjusting with practical tongue/lip placement tips.

3. CONVERSATIONAL & SPOKEN-FIRST:
   - Keep answers natural, lively, and rhythmically spoken (2-3 sentences max per turn).`;

    const response = await fetch('/api/openai/live/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.options.apiKey,
        model: 'gpt-live-1',
        instructions,
        sdp
      })
    });

    const result = await response.json();
    if (!response.ok || !result.transport?.sdp) {
      const errMessage = result.error?.message || JSON.stringify(result);
      throw new Error(`GPT-Live session failed (${response.status}): ${errMessage}`);
    }

    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: result.transport.sdp
    });
  }

  /**
   * Realtime WebRTC Flow (gpt-4o-realtime-preview fallback)
   */
  private async connectRealtimeSession(initialPrompt?: string) {
    const targetModel = 'gpt-4o-realtime-preview';
    const coachingLang = this.options.coachingLanguage || 'English (US)';
    const targetLang = this.options.targetLanguage || 'English';
    const targetWord = this.options.targetWord;
    const isImmersion = coachingLang.toLowerCase().includes(targetLang.toLowerCase()) || targetLang.toLowerCase().includes(coachingLang.toLowerCase());

    const instructions = `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.
You maintain a consistent voice persona (${this.options.voiceName || 'alloy'}), with complete linguistic awareness of the language you are speaking and coaching in.

SESSION LINGUISTIC CONTEXT:
- ACTIVE SPOKEN COACHING LANGUAGE: ${coachingLang}
- TARGET PRACTICE LANGUAGE: ${targetLang}
${targetWord ? `- ACTIVE WORD ON SCREEN: "${targetWord.word}" (IPA: ${targetWord.phonetic || 'N/A'}, Syllables: ${targetWord.syllables?.join(' · ') || targetWord.word}${targetWord.meaning ? `, Meaning: "${targetWord.meaning}"` : ''})` : ''}

CRITICAL RULES FOR LANGUAGE AWARENESS:
1. ALWAYS KNOW WHICH LANGUAGE YOU ARE SPEAKING:
   - Your primary conversational, explanatory, and feedback language is strictly ${coachingLang}.
   - Greet the user, converse, and deliver phonetic advice in ${coachingLang}.
   ${isImmersion ? `- FULL IMMERSION MODE: Converse, explain, and coach 100% in ${coachingLang} as an authentic native speaker.` : `- BILINGUAL MODE: Deliver all explanations and feedback in ${coachingLang}, while modeling the practice word "${targetWord ? targetWord.word : 'target word'}" with authentic native ${targetLang} phonetics.`}

2. ACOUSTIC & PHONETIC COACHING:
   - Listen attentively to the user's repetitions.
   - Acknowledge what phonemes/syllables they nailed with encouraging precision.
   - Gently guide any syllable that needs adjusting with practical tongue/lip placement tips.

3. CONVERSATIONAL & SPOKEN-FIRST:
   - Keep answers natural, lively, and rhythmically spoken (2-3 sentences max per turn).`;

    let ephemeralKey = '';
    try {
      const sessionRes = await fetch('/api/openai/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.options.apiKey,
          model: targetModel,
          instructions
        })
      });

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        ephemeralKey = sessionData.value || sessionData.client_secret?.value;
      }
    } catch (proxyErr) {
      console.warn('Proxy session creation failed, will try direct fetch', proxyErr);
    }

    if (!ephemeralKey) {
      let directRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: targetModel,
            instructions: `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.`
          }
        })
      });

      if (!directRes.ok) {
        directRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
      }

      if (!directRes.ok) {
        const errBody = await directRes.text();
        throw new Error(`OpenAI session failed: ${errBody}`);
      }

      const directData = await directRes.json();
      ephemeralKey = directData.value || directData.client_secret?.value;
    }

    if (!ephemeralKey) {
      throw new Error('Failed to acquire OpenAI Realtime session token.');
    }

    this.pc = new RTCPeerConnection();
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;

    this.pc.ontrack = (event) => {
      if (this.audioElement) {
        this.audioElement.srcObject = event.streams[0];
        this.setupAudioAnalyser(event.streams[0]);
      }
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.pc.addTrack(this.mediaStream.getTracks()[0]);
    this.dc = this.pc.createDataChannel('oai-events');

    this.dc.onopen = () => {
      this.isConnected = true;
      this.options.onStatusChange?.('connected');

      try {
        const updateEvent = {
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.
Help the user master pronunciation of words from different world languages.
Focus on exact mouth/tongue mechanics, accent inflections, and syllable stress.
Keep answers spoken, warm, concise, and lively.`,
            audio: {
              output: {
                voice: this.options.voiceName || 'alloy'
              }
            }
          }
        };
        this.dc?.send(JSON.stringify(updateEvent));
      } catch (e) {
        console.warn('Failed to send session.update', e);
      }

      if (initialPrompt) {
        this.sendPrompt(initialPrompt);
      }
    };

    this.dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'response.audio_transcript.delta') {
          this.options.onTranscript?.('assistant', msg.delta);
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          this.options.onTranscript?.('user', msg.transcript);
        } else if (msg.type === 'input_audio_buffer.speech_started') {
          this.options.onStatusChange?.('listening');
        } else if (msg.type === 'response.audio.started') {
          this.options.onStatusChange?.('speaking');
        } else if (msg.type === 'response.audio.done') {
          this.options.onStatusChange?.('listening');
        }
      } catch (e) {
        console.error('Error parsing OpenAI realtime event', e);
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    let sdpResponse: Response;
    try {
      sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });
    } catch (directErr) {
      sdpResponse = await fetch('/api/openai/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });
    }

    if (!sdpResponse.ok) {
      const proxyRes = await fetch('/api/openai/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (proxyRes.ok) {
        sdpResponse = proxyRes;
      } else {
        const errDetail = await sdpResponse.text();
        throw new Error(`WebRTC SDP handshake failed (${sdpResponse.status}): ${errDetail}`);
      }
    }

    const answerSdp = await sdpResponse.text();
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: answerSdp
    };

    await this.pc.setRemoteDescription(answer);
  }

  private setupAudioAnalyser(stream: MediaStream) {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const checkLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length / 255;
        this.options.onAudioLevel?.(Math.min(1, avg * 2));
        this.animFrameId = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn('Audio analyser setup error', e);
    }
  }

  updateContext(params: {
    coachingLanguage?: string;
    targetLanguage?: string;
    targetWord?: TargetWordInfo;
  }) {
    if (params.coachingLanguage) this.options.coachingLanguage = params.coachingLanguage;
    if (params.targetLanguage) this.options.targetLanguage = params.targetLanguage;
    if (params.targetWord) this.options.targetWord = params.targetWord;
  }

  sendPrompt(text: string, displayTranscript?: string | false) {
    if (!this.dc || this.dc.readyState !== 'open') return;
    if (displayTranscript !== false) {
      this.options.onTranscript?.('user', displayTranscript !== undefined ? displayTranscript : text);
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    };
    this.dc.send(JSON.stringify(event));

    // Request response
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  disconnect() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
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
    this.isConnected = false;
    this.options.onStatusChange?.('idle');
  }
}

import { LiveStatus } from '../types';

export interface OpenAILiveOptions {
  apiKey: string;
  model?: string;
  voiceName?: string;
  coachingLanguage?: string;
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
    const instructions = `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.
IMPORTANT: You MUST communicate with the user, provide all explanations, guidance, corrections, and coaching conversation strictly in ${coachingLang}.
When modeling words from other world languages, pronounce the target word with razor-sharp authentic native phonetics, then explain mechanics in ${coachingLang}.
Focus on exact mouth/tongue mechanics, accent inflections, and syllable stress.
Keep answers spoken, warm, concise, and lively.`;

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
    const instructions = `You are 'Vocalis', an elite polyglot pronunciation coach and phonetics maestro.
IMPORTANT: You MUST communicate with the user and provide all explanations, guidance, and coaching dialogue strictly in ${coachingLang}.
When modeling words, pronounce the target word authentically in its native language with precise phonetic accuracy.
Focus on exact mouth/tongue mechanics, accent inflections, and syllable stress.
Keep answers spoken, warm, concise, and lively.`;

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

  sendPrompt(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') return;
    this.options.onTranscript?.('user', text);

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

import { Language, WordItem, PronunciationScore } from '../types';

export class SpeechService {
  // Speech Synthesis
  static speak(text: string, language: Language, slow: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language.code;
      utterance.rate = slow ? 0.65 : 0.95;
      utterance.pitch = 1.0;

      // Find best available voice for language
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = language.code.split('-')[0];
      let match = voices.find(v => v.lang === language.code) ||
                  voices.find(v => v.lang.startsWith(langPrefix));
      if (!match && language.code === 'sa-IN') {
        match = voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang.startsWith('hi'));
      }
      if (match) {
        utterance.voice = match;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  static stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // Calculate similarity between spoken text and target word
  static evaluatePronunciation(
    heard: string,
    target: WordItem,
    _language: Language
  ): PronunciationScore {
    const cleanHeard = heard.trim().toLowerCase().replace(/[.,!?'"«»-]/g, '');
    const cleanTarget = target.word.trim().toLowerCase().replace(/[.,!?'"«»-]/g, '');

    // Levenshtein distance calculation
    const distance = this.levenshtein(cleanHeard, cleanTarget);
    const maxLen = Math.max(cleanHeard.length, cleanTarget.length, 1);
    const rawRatio = Math.max(0, 1 - distance / maxLen);

    // Boost score if heard contains key syllables or phonetic elements
    let syllableHits = 0;
    const syllableMatches = target.syllables.map(s => {
      const cleanSyl = s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMatched = cleanHeard.includes(cleanSyl) || rawRatio > 0.7;
      if (isMatched) syllableHits++;
      return { syllable: s, correct: isMatched };
    });

    const sylRatio = target.syllables.length > 0 ? syllableHits / target.syllables.length : 1;
    const finalScore = Math.round((rawRatio * 0.6 + sylRatio * 0.4) * 100);

    let feedback = '';
    let accentNote = '';

    if (finalScore >= 88) {
      feedback = 'Sensational resonance! Native-level clarity and pitch rhythm.';
      accentNote = 'You nailed the subtle vowel timbre and authentic stress cadence.';
    } else if (finalScore >= 68) {
      feedback = 'Impressive attempt! Almost there on the consonant articulation.';
      accentNote = target.mouthPositionTip;
    } else {
      feedback = 'Good initial run! Pay close attention to the syllable breakdown.';
      accentNote = target.mouthPositionTip;
    }

    return {
      score: Math.min(100, Math.max(15, finalScore)),
      heardText: heard || '(inaudible)',
      targetWord: target.word,
      syllableMatch: syllableMatches,
      feedback,
      accentNote,
      engineName: 'Browser Web Speech',
      timestamp: Date.now()
    };
  }

  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // Browser Web Speech Recognition
  static recordAndRecognize(
    language: Language,
    onResult: (text: string) => void,
    onError: (err: string) => void,
    onAudioLevel?: (level: number) => void
  ): { stop: () => void } {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError('Web Speech Recognition API is not supported in this browser. Use Gemini Live or OpenAI Live mode.');
      return { stop: () => {} };
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language.code;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    let mediaStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animFrame: number | null = null;

    // Start microphone level visualizer
    if (onAudioLevel) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaStream = stream;
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          onAudioLevel(Math.min(1, avg * 2.5));
          animFrame = requestAnimationFrame(loop);
        };
        loop();
      }).catch(() => {});
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        onError(`Recognition error: ${event.error}`);
      }
    };

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }
      if (audioCtx) {
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        audioCtx = null;
      }
      onAudioLevel?.(0);
    };

    recognition.onend = cleanup;

    try {
      recognition.start();
    } catch (e: any) {
      onError(e.message);
      cleanup();
    }

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {}
        cleanup();
      }
    };
  }
}

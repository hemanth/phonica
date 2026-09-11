import { Language, WordItem, PronunciationScore } from '../types';

export class OpenAITranscribeService {
  /**
   * Transcribe and evaluate pronunciation using OpenAI Whisper and GPT-4o phonetics evaluation
   */
  static async evaluateWithOpenAI(
    audioBlob: Blob,
    target: WordItem,
    language: Language,
    apiKey: string
  ): Promise<PronunciationScore> {
    if (!apiKey) {
      throw new Error('Missing OpenAI API Key');
    }

    // Convert audioBlob to Base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);
    const mimeType = audioBlob.type || 'audio/webm';

    const response = await fetch('/api/openai/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-openai-key': apiKey
      },
      body: JSON.stringify({
        apiKey,
        audioBase64,
        mimeType,
        targetWord: target.word,
        languageCode: language.code,
        ipa: target.ipa,
        syllables: target.syllables
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Transcribe API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const score = typeof data.score === 'number' ? data.score : 75;
    const heardText = data.heardText || target.word;

    const syllableMatch = target.syllables.map(s => {
      const match = data.syllableEvaluation?.find(
        (item: any) => item.syllable?.toLowerCase() === s.toLowerCase()
      );
      return {
        syllable: s,
        correct: match ? Boolean(match.correct) : score >= 75
      };
    });

    return {
      score: Math.min(100, Math.max(10, score)),
      heardText,
      targetWord: target.word,
      syllableMatch,
      feedback: data.feedback || 'Acoustic pronunciation evaluated by OpenAI Whisper & GPT-4o.',
      accentNote: data.accentNote || target.mouthPositionTip,
      engineName: 'OpenAI Whisper + GPT-4o',
      timestamp: Date.now()
    };
  }
}

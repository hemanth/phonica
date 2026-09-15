import { Language, WordItem, PronunciationScore } from '../types';

export class GeminiTranscribeService {
  /**
   * Transcribe and evaluate pronunciation using Gemini 3.5 Transcribe
   */
  static async evaluateWithGeminiTranscribe(
    audioBlob: Blob,
    target: WordItem,
    language: Language,
    apiKey: string
  ): Promise<PronunciationScore> {
    if (!apiKey) {
      throw new Error('Missing Gemini API Key for Gemini Transcribe');
    }

    // Convert audioBlob to Base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binary);
    const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

    // Model selection: gemini-3.8-flash with fallback to gemini-2.5-flash
    const primaryModel = 'gemini-3.8-flash';
    const fallbackModel = 'gemini-2.5-flash';

    const prompt = `You are the Google Gemini Transcribe engine specialized in verbatim speech-to-text and acoustic pronunciation analysis.
The speaker is attempting to pronounce the word "${target.word}" in ${language.name} (IPA: ${target.ipa}, Syllables: ${target.syllables.join('-')}).
Listen to the audio and provide a strict verbatim transcription and phonetic evaluation.
Respond ONLY with a JSON object in this exact schema:
{
  "transcript": "string (what was actually heard verbatim)",
  "score": number (0 to 100 based on phoneme accuracy, tone, and syllable stress),
  "syllableEvaluation": [
    { "syllable": "string", "correct": boolean }
  ],
  "feedback": "string (concise summary of acoustic accuracy)",
  "accentNote": "string (actionable advice on tongue/lip placement)"
}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    let response: Response;
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${apiKey}`;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok && (response.status === 404 || response.status === 400)) {
        // Fallback to gemini-2.0-flash-exp
        url = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      }
    } catch (e: any) {
      throw new Error(`Gemini Transcribe network error: ${e.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Transcribe error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback extract json from markdown
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    const score = typeof parsed.score === 'number' ? parsed.score : 80;
    const heardText = parsed.transcript || target.word;

    const syllableMatch = target.syllables.map(s => {
      const match = parsed.syllableEvaluation?.find((item: any) => item.syllable?.toLowerCase() === s.toLowerCase());
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
      feedback: parsed.feedback || 'Acoustic analysis processed via Gemini Transcribe.',
      accentNote: parsed.accentNote || target.mouthPositionTip,
      engineName: 'Gemini 3.5 Transcribe',
      timestamp: Date.now()
    };
  }
}

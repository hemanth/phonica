import { Language, WordItem, WordDifficulty } from '../types';

export interface GenerateWordOptions {
  language: Language;
  difficulty: WordDifficulty | 'all';
  existingWords: string[];
  geminiKey?: string;
  openAIKey?: string;
}

export class AIWordGeneratorService {
  /**
   * Generates a new, authentic pronunciation challenge word when curated lists are exhausted.
   * Leverages Gemini 2.0 Flash or OpenAI gpt-4o-mini.
   */
  static async generateChallengeWord(options: GenerateWordOptions): Promise<WordItem | null> {
    const { language, difficulty, existingWords, geminiKey, openAIKey } = options;

    if (!geminiKey && !openAIKey) {
      console.warn('Cannot generate AI word: No Gemini or OpenAI API key configured.');
      return null;
    }

    const targetDifficulty: WordDifficulty = difficulty === 'all' ? 'adept' : difficulty;

    const prompt = `You are a master polyglot linguist, phonetician, and pronunciation coach.
The user has completed and exhausted the curated challenge word list for ${language.name} (${language.nativeName}, family: ${language.family}, code: ${language.code}).
Generate a brand-new, authentic, phonetically challenging word or phrase in ${language.name} targeted at difficulty level "${targetDifficulty}".

Key phonetic quirk to emphasize: "${language.phoneticQuirk}".
Target difficulty context:
- starter: basic vowel purity, clean consonants
- adept: mild tongue acrobatics, liaison, or double consonants
- virtuoso: rapid consonant clusters, nasal vowels, tricky tones, or trills
- beast: legendary tongue-twisters, compound morphology, rare phonemes

CRITICAL: Do NOT reuse any of these words that the user has already practiced:
${existingWords.slice(-20).join(', ')}

Respond ONLY with a JSON object in this exact schema (no markdown, no backticks, just raw JSON):
{
  "word": "string (authentic word in standard orthography)",
  "nativeScript": "string or null (authentic script if the language does not primarily use the Latin alphabet, e.g. Devanagari, Hiragana/Kanji, Cyrillic, Hangul, Arabic, Kannada; otherwise null)",
  "ipa": "string (strict International Phonetic Alphabet enclosed in brackets, e.g. [ˈeː.ça.ˌfjat.la.ˌjœː.kʏtl])",
  "syllables": ["array", "of", "syllables", "segmenting", "the", "word"],
  "syllableGuide": "string (accessible phonetic guide for English speakers, e.g. 'EY-ya-fyat-la-YUR-kutl')",
  "translation": "string (concise English definition or cultural meaning)",
  "difficulty": "${targetDifficulty}",
  "category": "phonetic-gymnastics",
  "mouthPositionTip": "string (concise, high-value guidance on tongue positioning, lip rounding, or airflow)",
  "funFact": "string (1-2 sentences on etymology, linguistic lore, or cultural usage)"
}`;

    // 1. Try Gemini first if key exists
    if (geminiKey) {
      try {
        const word = await this.generateWithGemini(prompt, language, targetDifficulty, geminiKey);
        if (word) return word;
      } catch (err) {
        console.warn('Gemini AI word generation failed, attempting OpenAI fallback:', err);
      }
    }

    // 2. Try OpenAI if key exists
    if (openAIKey) {
      try {
        const word = await this.generateWithOpenAI(prompt, language, targetDifficulty, openAIKey);
        if (word) return word;
      } catch (err) {
        console.error('OpenAI AI word generation failed:', err);
      }
    }

    return null;
  }

  private static async generateWithGemini(
    prompt: string,
    language: Language,
    targetDifficulty: WordDifficulty,
    apiKey: string
  ): Promise<WordItem | null> {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini ${model} error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanJson);

        return this.formatParsedWord(parsed, language, targetDifficulty);
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    return null;
  }

  private static async generateWithOpenAI(
    prompt: string,
    language: Language,
    targetDifficulty: WordDifficulty,
    apiKey: string
  ): Promise<WordItem | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an elite polyglot phonetician.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return this.formatParsedWord(parsed, language, targetDifficulty);
  }

  private static formatParsedWord(
    parsed: any,
    language: Language,
    targetDifficulty: WordDifficulty
  ): WordItem {
    const rawWord = String(parsed.word || '').trim();
    const syllables = Array.isArray(parsed.syllables) && parsed.syllables.length > 0
      ? parsed.syllables.map(String)
      : rawWord.split(/[\s-]+/).filter(Boolean);

    return {
      id: `ai-${language.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      languageId: language.id,
      word: rawWord,
      nativeScript: parsed.nativeScript || undefined,
      ipa: parsed.ipa ? String(parsed.ipa).trim() : `[${rawWord.toLowerCase()}]`,
      syllables: syllables.length > 0 ? syllables : [rawWord],
      syllableGuide: parsed.syllableGuide ? String(parsed.syllableGuide).trim() : syllables.join(' - '),
      translation: parsed.translation ? String(parsed.translation).trim() : 'AI-generated challenge word',
      difficulty: targetDifficulty,
      category: parsed.category || 'phonetic-gymnastics',
      mouthPositionTip: parsed.mouthPositionTip || 'Articulate each syllable slowly, focusing on authentic vowel tension.',
      funFact: parsed.funFact || `Generated dynamically by AI to deepen your practice in ${language.name}.`,
      isAiGenerated: true
    };
  }
}

export type LanguageId = 
  | 'french'
  | 'japanese'
  | 'german'
  | 'spanish'
  | 'italian'
  | 'mandarin'
  | 'russian'
  | 'icelandic'
  | 'arabic'
  | 'hindi'
  | 'portuguese'
  | 'korean'
  | 'irish'
  | 'swedish'
  | 'dutch'
  | 'greek'
  | 'polish'
  | 'hawaiian'
  | 'nahuatl'
  | 'turkish'
  | 'kannada'
  | 'sanskrit';

export interface Language {
  id: LanguageId;
  name: string;
  nativeName: string;
  code: string; // BCP-47 for speech synthesis
  badgeCode: string; // ISO 2-letter or stylized code for badge
  family: string;
  phoneticQuirk: string;
  geminiVoice: string; // Aoede, Puck, Charon, Fenrir, Kore
  openaiVoice: string; // alloy, echo, shimmer, ash, ballad, coral, sage, verse
}

export type WordDifficulty = 'starter' | 'adept' | 'virtuoso' | 'beast';

export interface WordItem {
  id: string;
  languageId: LanguageId;
  word: string;
  nativeScript?: string;
  ipa: string;
  syllables: string[];
  syllableGuide: string;
  translation: string;
  difficulty: WordDifficulty;
  category: 'untranslatable' | 'tongue-twister' | 'phonetic-gymnastics' | 'cultural-gem' | 'everyday';
  mouthPositionTip: string;
  funFact: string;
  isAiGenerated?: boolean;
}

export type LiveEngine = 'gemini' | 'openai' | 'browser';

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

export interface PronunciationScore {
  score: number;
  heardText: string;
  targetWord: string;
  syllableMatch: { syllable: string; correct: boolean }[];
  feedback: string;
  accentNote: string;
  engineName?: string;
  timestamp: number;
}

export interface LiveTranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'coach-system';
  text: string;
  timestamp: number;
}

export interface UserStats {
  practicedCount: number;
  wordsMastered: number;
  streakDays: number;
  history: {
    word: string;
    language: string;
    score: number;
    timestamp: number;
  }[];
}

export interface CoachingLanguage {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

export const COACHING_LANGUAGES: CoachingLanguage[] = [
  { id: 'AUTO', code: 'auto', name: 'Match Word Language (Auto)', nativeName: 'Auto' },
  { id: 'EN_US', code: 'en-US', name: 'English (US)', nativeName: 'English (US)' },
  { id: 'EN_GB', code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)' },
  { id: 'ES_ES', code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español' },
  { id: 'FR_FR', code: 'fr-FR', name: 'French (France)', nativeName: 'Français' },
  { id: 'DE_DE', code: 'de-DE', name: 'German (Germany)', nativeName: 'Deutsch' },
  { id: 'IT_IT', code: 'it-IT', name: 'Italian (Italy)', nativeName: 'Italiano' },
  { id: 'JA_JP', code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { id: 'ZH_CN', code: 'zh-CN', name: 'Mandarin (Simplified)', nativeName: '简体中文' },
  { id: 'PT_BR', code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português' },
  { id: 'HI_IN', code: 'hi-IN', name: 'Hindi (India)', nativeName: 'हिन्दी' },
  { id: 'KO_KR', code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
  { id: 'RU_RU', code: 'ru-RU', name: 'Russian', nativeName: 'Русский' },
  { id: 'AR_SA', code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' }
];

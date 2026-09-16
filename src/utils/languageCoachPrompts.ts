import { WordItem, Language } from '../types';

/**
 * Builds the initial greeting & coaching prompt for establishing a Live voice session.
 */
export function getInitialCoachPrompt(
  word: WordItem,
  targetLang: Language,
  coachLangName: string,
  coachLocale: string
): string {
  const targetLocale = targetLang.code;
  const isSameLang = coachLangName.toLowerCase().includes(targetLang.name.toLowerCase()) ||
    targetLang.name.toLowerCase().includes(coachLangName.toLowerCase());

  if (isSameLang) {
    return `[SESSION START: Native Locale ${targetLocale}]
We are practicing the ${targetLang.name} word "${word.word}" (Locale: ${targetLocale}, IPA: ${word.phonetic || 'N/A'}${word.meaning ? ` - meaning: ${word.meaning}` : ''}).
With your assigned voice persona, greet me in ${coachLangName}, pronounce the word with authentic native ${targetLocale} phonetics, and give me a key acoustic tip.`;
  }

  return `[SESSION START: Spoken Coaching in ${coachLangName} (${coachLocale}), Target Word in ${targetLang.name} (${targetLocale})]
Hello Vocalis! I'm practicing the ${targetLang.name} word "${word.word}" (Locale: ${targetLocale}, IPA: ${word.phonetic || 'N/A'}${word.meaning ? ` - meaning: "${word.meaning}"` : ''}).
Using your consistent assigned voice, please deliver all coaching advice and guidance in ${coachLangName}.
Model the word "${word.word}" using authentic native ${targetLocale} phonetics, and give me a quick tip on its tricky sounds!`;
}

/**
 * Builds the prompt sent when the user rolls or switches to a new practice word.
 */
export function getWordSwitchPrompt(
  word: WordItem,
  targetLang: Language,
  coachLangName: string,
  coachLocale: string
): string {
  const targetLocale = targetLang.code;
  return `[NEW PRACTICE WORD]
Target Word: "${word.word}"
Target Locale: ${targetLocale} (${targetLang.name})
IPA Transcription: ${word.phonetic || 'N/A'}
${word.meaning ? `Meaning: "${word.meaning}"` : ''}

In ${coachLangName} (${coachLocale}), please model the authentic native ${targetLocale} pronunciation of "${word.word}" and give me an acoustic tip for pronouncing it accurately.`;
}

/**
 * Builds the prompt sent when the user switches the coaching language stream.
 */
export function getLanguageSwitchPrompt(
  newCoachLangName: string,
  newCoachLocale: string,
  currentWord: WordItem,
  targetLang: Language
): string {
  return `[COACHING LANGUAGE UPDATE]
Please set your spoken dialogue language to ${newCoachLangName} (Locale: ${newCoachLocale}).
Acknowledge this in ${newCoachLangName} and continue coaching on "${currentWord.word}" (Target Locale: ${targetLang.code}).`;
}

import { WordItem, Language } from '../types';

/**
 * Builds the initial greeting & coaching prompt for establishing a Live voice session.
 * Tailored to match whether the session is in full immersion or bilingual coaching.
 */
export function getInitialCoachPrompt(
  word: WordItem,
  targetLang: Language,
  coachLangName: string
): string {
  const isImmersion = coachLangName.toLowerCase().includes(targetLang.name.toLowerCase()) ||
    targetLang.name.toLowerCase().includes(coachLangName.toLowerCase());

  if (isImmersion) {
    const langId = targetLang.id.toLowerCase();
    if (langId === 'french') {
      return `Bonjour Vocalis ! Nous nous entraînons sur le mot français « ${word.word} » (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Salue-moi chaleureusement en français, prononce le mot avec une articulation modèle, et donne-moi une astuce clé pour réussir sa prononciation.`;
    }
    if (langId === 'german') {
      return `Hallo Vocalis! Wir üben das deutsche Wort „${word.word}“ (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Begrüße mich auf Deutsch, sprich das Wort klar vor und gib mir einen wichtigen Aussprachetipp.`;
    }
    if (langId === 'spanish') {
      return `¡Hola Vocalis! Estamos practicando la palabra en español «${word.word}» (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Salúdame en español, pronuncia la palabra con buena articulación y dame un consejo clave.`;
    }
    if (langId === 'italian') {
      return `Ciao Vocalis! Stiamo praticando la parola italiana «${word.word}» (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Salutami in italiano, pronuncia la parola in modo autentico e dammi un consiglio di fonetica.`;
    }
    if (langId === 'japanese') {
      return `こんにちは、Vocalis！日本語の単語「${word.word}」（${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}）の発音練習を始めます。日本語で挨拶して、手本を発音し、発音のコツを教えてください。`;
    }
    return `[LANGUAGE IMMERSION: ${targetLang.name}] We are practicing the ${targetLang.name} word "${word.word}" (IPA: ${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). You are an elite native ${targetLang.name} speech coach. Speak, greet, and deliver all coaching strictly in ${targetLang.name}. Introduce the word and model its authentic native pronunciation.`;
  }

  // Bilingual coaching mode (e.g. English explanations for French or German word)
  return `[LANGUAGE CONTEXT: Spoken Coaching in ${coachLangName}, Target Word in ${targetLang.name}]
Hello Vocalis! I'm practicing the ${targetLang.name} word "${word.word}" (IPA: ${word.phonetic || ''}${word.meaning ? ` - meaning: ${word.meaning}` : ''}).
Deliver your coaching advice, vocal mechanics, and conversational feedback strictly in ${coachLangName}.
Model the word "${word.word}" with authentic native ${targetLang.name} phonetics. Greet me and give a quick tip!`;
}

/**
 * Builds the prompt sent when the user rolls or switches to a new practice word.
 */
export function getWordSwitchPrompt(
  word: WordItem,
  targetLang: Language,
  coachLangName: string
): string {
  const isImmersion = coachLangName.toLowerCase().includes(targetLang.name.toLowerCase()) ||
    targetLang.name.toLowerCase().includes(coachLangName.toLowerCase());

  if (isImmersion) {
    const langId = targetLang.id.toLowerCase();
    if (langId === 'french') {
      return `[NOUVEAU MOT] Nous passons au mot français « ${word.word} » (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Présente brièvement ce mot en français, prononce-le clairement et donne-moi une astuce de prononciation.`;
    }
    if (langId === 'german') {
      return `[NEUES WORT] Wir wechseln zum deutschen Wort „${word.word}“ (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Stelle das Wort auf Deutsch vor, sprich es vor und gib mir einen Aussprachetipp.`;
    }
    if (langId === 'spanish') {
      return `[NUEVA PALABRA] Pasamos a la palabra en español «${word.word}» (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Presenta la palabra en español, modélala y dame un consejo de articulación.`;
    }
    if (langId === 'italian') {
      return `[NUOVA PAROLA] Passiamo alla parola italiana «${word.word}» (${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). Presenta la parola in italiano, pronunciala e dammi un consiglio.`;
    }
    if (langId === 'japanese') {
      return `【新しい単語】次は日本語の単語「${word.word}」（${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}）です。日本語でこの単語を紹介し、手本を発音してコツを教えてください。`;
    }
    return `[NEW WORD: ${targetLang.name}] We just pulled up "${word.word}" (IPA: ${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}). In ${targetLang.name}, introduce this word, model its authentic pronunciation, and provide an acoustic tip.`;
  }

  // Bilingual mode
  return `[NEW WORD: ${targetLang.name}] We just pulled up the ${targetLang.name} word "${word.word}" (IPA: ${word.phonetic || ''}${word.meaning ? ` - ${word.meaning}` : ''}).
Deliver your coaching advice and tips in ${coachLangName}.
Model the word "${word.word}" with authentic native ${targetLang.name} phonetics and explain how to position tongue and lips for it.`;
}

/**
 * Builds the prompt sent when the user switches the coaching language stream.
 */
export function getLanguageSwitchPrompt(
  newCoachLangName: string,
  currentWord: WordItem,
  targetLang: Language
): string {
  return `[COACHING LANGUAGE UPDATE]
Please switch your active spoken coaching language to ${newCoachLangName}.
From now on, speak, converse, and deliver all phonetics tips in ${newCoachLangName}.
Acknowledge this switch in ${newCoachLangName} and continue guiding me through "${currentWord.word}" (${targetLang.name}).`;
}

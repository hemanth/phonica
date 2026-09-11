import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X } from '@phosphor-icons/react';
import { WordItem, LanguageId } from '../types';
import { LANGUAGES } from '../data/words';

interface CustomWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomWord: (wordItem: WordItem) => void;
}

export const CustomWordModal: React.FC<CustomWordModalProps> = ({
  isOpen,
  onClose,
  onAddCustomWord
}) => {
  const [word, setWord] = useState('');
  const [languageId, setLanguageId] = useState<LanguageId>('french');
  const [ipa, setIpa] = useState('');
  const [translation, setTranslation] = useState('');
  const [syllableGuide, setSyllableGuide] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    // Auto-split syllables if not provided
    const rawSyllables = word.trim().split(/[\s-]+/).filter(Boolean);
    const syllables = rawSyllables.length > 1 ? rawSyllables : [word.trim()];

    const customWord: WordItem = {
      id: `custom-${Date.now()}`,
      languageId,
      word: word.trim(),
      ipa: ipa.trim() || `[${word.trim().toLowerCase()}]`,
      syllables,
      syllableGuide: syllableGuide.trim() || syllables.join(' - '),
      translation: translation.trim() || 'Custom practice word',
      difficulty: 'adept',
      category: 'everyday',
      mouthPositionTip: 'Listen carefully to the live voice coach modeling this custom word.',
      funFact: 'Added by you to explore unique vocabulary.'
    };

    onAddCustomWord(customWord);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white rounded-3xl border border-neutral-200/90 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] p-5 sm:p-7 relative overflow-hidden space-y-5 max-h-[90dvh] overflow-y-auto touch-scroll"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-xl bg-neutral-100 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/80 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center text-white shrink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
            <Plus size={18} weight="bold" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0A0A0A] tracking-tight">
              Add Practice Word
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              Enter any word or phrase to practice with live phonetics
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0A0A0A] block">
              Target Word / Phrase *
            </label>
            <input
              type="text"
              required
              value={word}
              onChange={e => setWord(e.target.value)}
              placeholder="e.g. écureuil"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 text-xs font-medium focus:outline-none focus:border-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[42px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0A0A0A] block">
              Language *
            </label>
            <select
              value={languageId}
              onChange={e => setLanguageId(e.target.value as LanguageId)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] font-mono text-xs focus:outline-none focus:border-neutral-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[42px]"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0A0A0A] block">
              English Translation
            </label>
            <input
              type="text"
              value={translation}
              onChange={e => setTranslation(e.target.value)}
              placeholder="e.g. squirrel"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 text-xs focus:outline-none focus:border-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[42px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0A0A0A] block">
                IPA (Optional)
              </label>
              <input
                type="text"
                value={ipa}
                onChange={e => setIpa(e.target.value)}
                placeholder="/e.ky.ʁœj/"
                className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 font-mono text-xs focus:outline-none focus:border-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[40px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0A0A0A] block">
                Syllable Guide
              </label>
              <input
                type="text"
                value={syllableGuide}
                onChange={e => setSyllableGuide(e.target.value)}
                placeholder="ay / koo / ROY"
                className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 font-mono text-xs focus:outline-none focus:border-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[40px]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-medium text-xs transition-all border border-neutral-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 text-white font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 min-h-[40px]"
            >
              Add Word
            </button>
          </div>

        </form>

      </motion.div>
    </div>
  );
};

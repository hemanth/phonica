import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SpeakerHigh, 
  SpeakerSimpleHigh,
  HourglassHigh, 
  Microphone, 
  Sparkle, 
  Copy, 
  Check, 
  ArrowRight,
  Waveform,
  LightbulbFilament,
  CircleNotch
} from '@phosphor-icons/react';
import { WordItem, Language, LiveEngine, LiveStatus } from '../types';

interface WordHeroProps {
  word: WordItem;
  language: Language;
  engine: LiveEngine;
  liveStatus: LiveStatus;
  isPlayingAudio: boolean;
  isTestingVoice: boolean;
  hasLLMVoice?: boolean;
  isGeneratingAIWord?: boolean;
  onPlayNative: () => void;
  onPlaySlow: () => void;
  onPlaySyllable: (syllable: string) => void;
  onTestVoice: () => void;
  onAskCoachAboutWord: () => void;
  onNextWord: () => void;
}

export const WordHero: React.FC<WordHeroProps> = ({
  word,
  language,
  engine,
  liveStatus,
  isPlayingAudio,
  isTestingVoice,
  hasLLMVoice,
  isGeneratingAIWord = false,
  onPlayNative,
  onPlaySlow,
  onPlaySyllable,
  onTestVoice,
  onAskCoachAboutWord,
  onNextWord
}) => {
  const [copiedIpa, setCopiedIpa] = useState(false);
  const [activeSyllable, setActiveSyllable] = useState<string | null>(null);

  const copyIpaToClipboard = () => {
    navigator.clipboard.writeText(word.ipa);
    setCopiedIpa(true);
    setTimeout(() => setCopiedIpa(false), 1800);
  };

  const handleSyllableClick = (syl: string) => {
    setActiveSyllable(syl);
    onPlaySyllable(syl);
    setTimeout(() => setActiveSyllable(null), 1200);
  };

  const getDifficultyBadge = (diff: WordItem['difficulty']) => {
    switch (diff) {
      case 'starter':
        return { label: 'Starter', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'adept':
        return { label: 'Adept', class: 'bg-neutral-100 text-neutral-800 border-neutral-200' };
      case 'virtuoso':
        return { label: 'Virtuoso', class: 'bg-[#0A0A0A] text-white border-black' };
      case 'beast':
        return { label: 'Tongue Beast', class: 'bg-rose-50 text-rose-800 border-rose-200' };
    }
  };

  const diffBadge = getDifficultyBadge(word.difficulty);

  return (
    <div className="w-full bg-white rounded-3xl border border-neutral-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 sm:p-7 lg:p-8 relative overflow-hidden transition-all">
      
      {/* Top Metadata Header */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 mb-6">
        
        {/* Language & Family identification */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 px-2.5 py-0.5 rounded-lg bg-neutral-100 text-neutral-800 font-mono text-xs font-bold uppercase tracking-wider border border-neutral-200">
            {language.badgeCode}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-1.5 truncate">
              <span>{language.name}</span>
              <span className="text-xs text-neutral-400 font-mono font-normal">({language.nativeName})</span>
            </h3>
            <span className="text-xs text-neutral-500 font-mono truncate block">
              {language.family} / {language.phoneticQuirk}
            </span>
          </div>
        </div>

        {/* Difficulty badge, AI badge & Next button */}
        <div className="flex items-center gap-2 shrink-0">
          {word.isAiGenerated && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-neutral-100 text-neutral-900 border border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <Sparkle size={11} weight="fill" className="text-neutral-800" />
              <span>AI Challenge</span>
            </span>
          )}

          <span className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${diffBadge.class}`}>
            {diffBadge.label}
          </span>

          <button
            onClick={onNextWord}
            disabled={isGeneratingAIWord}
            aria-label="Load next random word"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 disabled:opacity-75 border border-neutral-200/90 text-xs font-mono font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer min-h-[34px]"
            title="Next random word"
          >
            {isGeneratingAIWord ? (
              <>
                <CircleNotch size={13} weight="bold" className="animate-spin text-neutral-600" />
                <span className="hidden sm:inline">Crafting AI Word...</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight size={13} weight="bold" />
              </>
            )}
          </button>
        </div>

      </div>

      {/* Main Word Display with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={word.id}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 sm:space-y-6"
        >
          
          {/* The Word Headline */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-2.5 sm:gap-4">
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0A0A0A] select-all break-words leading-tight">
                {word.word}
              </h1>
              {word.nativeScript && (
                <span className="text-xl sm:text-2xl text-neutral-400 font-normal">
                  {word.nativeScript}
                </span>
              )}
            </div>

            <p className="text-sm sm:text-base text-neutral-600 font-sans leading-relaxed">
              &ldquo;{word.translation}&rdquo;
            </p>
          </div>

          {/* Dynamic Acoustic Spectrum Visualizer */}
          <div className="p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Waveform size={14} weight="bold" className={isPlayingAudio ? 'text-[#0A0A0A] animate-pulse' : 'text-neutral-400'} />
                <span>Acoustic Waveform</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {isPlayingAudio ? 'Transmitting Audio Cadence' : isTestingVoice ? 'Recording Vocal Input' : 'Acoustic Standby'}
              </span>
            </div>

            <div className="flex items-end justify-between gap-1 h-7 pt-1 px-1">
              {[40, 75, 95, 55, 85, 65, 45, 90, 60, 95, 75, 50, 85, 65, 80, 45].map((h, i) => (
                <span
                  key={i}
                  style={{
                    height: isPlayingAudio || isTestingVoice ? `${Math.max(15, (h * ((i % 3) + 1)) % 100)}%` : '20%',
                    transition: 'height 120ms ease'
                  }}
                  className={`w-full rounded-full ${
                    isTestingVoice ? 'bg-rose-500' : isPlayingAudio ? 'bg-[#0A0A0A]' : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Phonetics & Syllable Guide */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            
            {/* IPA pill with copy button */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 text-neutral-900 font-mono text-xs sm:text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">IPA</span>
              <span>{word.ipa}</span>
              <button
                onClick={copyIpaToClipboard}
                aria-label="Copy IPA to clipboard"
                className="p-1 hover:bg-neutral-100 rounded text-neutral-600 transition-colors cursor-pointer"
                title="Copy International Phonetic Alphabet string"
              >
                {copiedIpa ? <Check size={13} weight="bold" className="text-emerald-600" /> : <Copy size={13} />}
              </button>
            </div>

            {/* Syllable phonetic guide */}
            <div className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 text-neutral-800 font-mono text-xs sm:text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider mr-1.5">Guide</span>
              <span className="font-semibold">{word.syllableGuide}</span>
            </div>

          </div>

          {/* Syllable Trainer: Tactile Sound Segments */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono uppercase tracking-wider">
              <span>Syllable Trainer</span>
              <span className="text-[10px] text-neutral-400 normal-case hidden sm:inline">(Tap to isolate each phonetic sound)</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {word.syllables.map((syllable, idx) => {
                const isActive = activeSyllable === syllable;

                return (
                  <motion.button
                    key={`${syllable}-${idx}`}
                    whileTap={{ scale: 0.95 }}
                    animate={isActive ? { scale: [1, 1.04, 1.02] } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleSyllableClick(syllable)}
                    className={`group px-3.5 py-2 rounded-xl border font-mono text-sm sm:text-base font-semibold transition-all cursor-pointer min-h-[44px] min-w-[64px] flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-[#0A0A0A] text-white border-black shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)]'
                        : 'bg-white hover:bg-neutral-50 border-neutral-200/90 text-neutral-800 hover:border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    <span className="flex items-center gap-1 justify-center leading-none">
                      <SpeakerSimpleHigh size={13} weight={isActive ? 'fill' : 'bold'} className={isActive ? 'animate-bounce' : 'opacity-50 group-hover:opacity-100'} />
                      <span>{syllable}</span>
                    </span>
                    <span className={`text-[9px] block font-mono font-normal mt-0.5 ${isActive ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      S{idx + 1}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Primary Audio & Coaching Actions: Tactile Button Group */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 pt-4 border-t border-neutral-200/80">
            
            {/* Native Audio Listen (Primary Action with Physical Inset Highlight) */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onPlayNative}
              disabled={isPlayingAudio}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm transition-all shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 disabled:opacity-50 cursor-pointer min-h-[44px] active:scale-[0.98]"
              title={hasLLMVoice ? 'Authentic native audio generated by OpenAI LLM Audio' : 'Browser Web Speech'}
            >
              <SpeakerHigh size={17} weight="bold" className={isPlayingAudio ? 'animate-bounce' : ''} />
              <div className="flex flex-col text-left leading-none">
                <span>Hear Native</span>
                {hasLLMVoice && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono tracking-wider text-neutral-300 font-semibold mt-0.5">
                    <Sparkle size={9} weight="fill" /> LLM Audio
                  </span>
                )}
              </div>
            </motion.button>

            {/* Slow Motion Audio */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onPlaySlow}
              disabled={isPlayingAudio}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-medium text-xs sm:text-sm border border-neutral-200/90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] disabled:opacity-50 cursor-pointer min-h-[44px] active:scale-[0.98]"
              title="Listen at 0.7x slow motion for tricky consonants"
            >
              <HourglassHigh size={16} weight="bold" className="text-neutral-500" />
              <span>Slow-Mo 0.7x</span>
            </motion.button>

            {/* Test My Voice / Record */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onTestVoice}
              disabled={isTestingVoice}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer min-h-[44px] active:scale-[0.98] ${
                isTestingVoice
                  ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse font-semibold'
                  : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
              }`}
            >
              <Microphone size={16} weight={isTestingVoice ? 'fill' : 'bold'} className={isTestingVoice ? 'text-rose-600' : 'text-neutral-500'} />
              <span>{isTestingVoice ? 'Listening...' : 'Test Voice'}</span>
            </motion.button>

            {/* Ask Live Coach */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onAskCoachAboutWord}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-900 border border-neutral-200 font-medium text-xs sm:text-sm transition-all cursor-pointer sm:ml-auto min-h-[44px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.98]"
              title="Ask the real-time AI coach to explain and pronounce this word live"
            >
              <Sparkle size={16} weight="bold" className="text-neutral-700" />
              <span>Ask Coach</span>
            </motion.button>

          </div>

          {/* Sound Anatomy & Linguistic Lore Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            
            {/* Tongue & Mouth Placement Guidance */}
            <div className="p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#0A0A0A] font-bold">
                <Waveform size={14} weight="bold" className="text-neutral-900" />
                <span className="uppercase tracking-wider">Mouth and Tongue Mechanics</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                {word.mouthPositionTip}
              </p>
            </div>

            {/* Linguistic & Cultural Fact */}
            <div className="p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#0A0A0A] font-bold">
                <LightbulbFilament size={14} weight="bold" className="text-amber-700" />
                <span className="uppercase tracking-wider">Linguistic Lore</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                {word.funFact}
              </p>
            </div>

          </div>

        </motion.div>
      </AnimatePresence>

    </div>
  );
};

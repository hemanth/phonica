import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waveform, 
  SpeakerHigh, 
  HourglassHigh, 
  Sparkle, 
  ArrowRight, 
  GlobeHemisphereWest, 
  ShieldCheck, 
  Cpu, 
  ChatCircleDots, 
  Check, 
  Target,
  MagnifyingGlass,
  SlidersHorizontal,
  Warning,
  Key
} from '@phosphor-icons/react';
import { LANGUAGES, WORDS_DATABASE } from '../data/words';
import { LanguageId, WordItem } from '../types';
import { SpeechService } from '../services/speechService';
import { LLMAudioService } from '../services/llmAudioService';

// Design Read: Tactile acoustic voice laboratory and phonetics studio for language learners and linguists.
// Dials: DESIGN_VARIANCE: 8, MOTION_INTENSITY: 6, VISUAL_DENSITY: 4.
// Anti-Slop Bans enforced: Zero em-dashes, zero AI purple gradients, zero decorative status dots, zero split-headers.

interface LandingPageProps {
  onLaunchStudio: (languageId?: LanguageId) => void;
  hasOpenAIKey: boolean;
  hasGeminiKey: boolean;
  openAIKey?: string;
  geminiKey?: string;
  openAIVoice?: string;
  onOpenKeyModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchStudio,
  hasOpenAIKey,
  hasGeminiKey,
  openAIKey,
  geminiKey,
  openAIVoice,
  onOpenKeyModal
}) => {
  // Spotlight words for the interactive landing preview
  const spotlightWordIds = ['kn-5', 'sa-2', 'ja-1', 'it-1', 'is-1'];
  const spotlightWords: WordItem[] = spotlightWordIds
    .map(id => WORDS_DATABASE.find(w => w.id === id))
    .filter((w): w is WordItem => Boolean(w));

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [activeSyllable, setActiveSyllable] = useState<string | null>(null);
  const [activeFamilyFilter, setActiveFamilyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const previewWord = spotlightWords[activePreviewIndex] || spotlightWords[0];
  const previewLanguage = LANGUAGES.find(l => l.id === previewWord?.languageId) || LANGUAGES[0];

  const handlePlayPreview = async (slow: boolean = false) => {
    if (!previewWord || isPlayingPreview) return;
    setIsPlayingPreview(true);
    try {
      if (openAIKey) {
        await LLMAudioService.speakWithLLM(previewWord.word, {
          apiKey: openAIKey,
          voice: openAIVoice || 'alloy',
          speed: slow ? 0.7 : 1.0,
          model: 'tts-1'
        });
      } else {
        await SpeechService.speak(previewWord.word, previewLanguage, slow);
      }
    } catch (e) {
      console.warn('Primary audio failed, falling back to WebSpeech', e);
      try {
        await SpeechService.speak(previewWord.word, previewLanguage, slow);
      } catch (fallbackErr) {
        console.error('Audio playback error', fallbackErr);
      }
    } finally {
      setIsPlayingPreview(false);
    }
  };

  const handlePlaySyllable = async (syl: string) => {
    if (isPlayingPreview) return;
    setActiveSyllable(syl);
    setIsPlayingPreview(true);
    try {
      if (openAIKey) {
        await LLMAudioService.speakWithLLM(syl, {
          apiKey: openAIKey,
          voice: openAIVoice || 'alloy',
          speed: 0.85,
          model: 'tts-1'
        });
      } else {
        await SpeechService.speak(syl, previewLanguage, true);
      }
    } catch (e) {
      console.warn('Syllable audio failed, falling back to WebSpeech', e);
      await SpeechService.speak(syl, previewLanguage, true);
    } finally {
      setIsPlayingPreview(false);
      setTimeout(() => setActiveSyllable(null), 800);
    }
  };

  // Language family list for filtering
  const families = ['all', ...Array.from(new Set(LANGUAGES.map(l => l.family)))];
  
  const filteredLanguages = LANGUAGES.filter(lang => {
    const matchesFamily = activeFamilyFilter === 'all' || lang.family === activeFamilyFilter;
    const matchesSearch = searchQuery.trim() === '' || 
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.family.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  return (
    <div className="w-full min-h-screen bg-[#FAF9F6] text-[#0A0A0A] flex flex-col selection:bg-slate-200 selection:text-[#0A0A0A]">
      
      {/* 1. HERO SECTION (Taste Skill Hero Discipline: Max pt-20, max 2-line headline, max 20-word subhead, zero status dots, zero decoration strips) */}
      <section className="relative pt-12 pb-14 md:pt-16 md:pb-20 border-b border-neutral-200/80 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12">
            
            {/* Single Eyebrow Badge (Taste Skill Restraint: Plain text, zero pulsing dots) */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-mono font-medium mb-5 shadow-2xs">
              <span>Acoustic Phonetics Laboratory</span>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900 font-semibold">22 World Languages</span>
            </div>

            {/* Headline (Strictly max 2 lines at desktop, solid high-contrast ink, no AI purple gradients) */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#0A0A0A] leading-[1.02] font-display mb-5">
              Have fun pronouncing wild, random words across 22 languages.
            </h1>

            {/* Subtext (Strictly under 20 words) */}
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl mb-8 font-sans">
              Roll for a new phonetic challenge, untie your tongue, and train tricky sounds with live AI voice coaching.
            </p>

            {/* Single Clear CTA Pair (Tactile buttons with physical inset highlights) */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
              <motion.button
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onLaunchStudio()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white font-semibold text-sm sm:text-base shadow-[0_12px_28px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 transition-all cursor-pointer min-h-[48px]"
              >
                <span>Launch Voice Studio</span>
                <ArrowRight size={17} weight="bold" />
              </motion.button>

              <motion.a
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.98 }}
                href="#languages-directory"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('languages-directory')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-neutral-50 text-neutral-800 font-medium text-sm sm:text-base border border-neutral-300 shadow-2xs transition-colors cursor-pointer min-h-[48px]"
              >
                <GlobeHemisphereWest size={17} weight="bold" className="text-neutral-500" />
                <span>Explore 22 Languages</span>
              </motion.a>
            </div>

          </div>

          {/* 2. REAL INTERACTIVE INSTRUMENT PREVIEW (Taste Skill: Real working component, tactile response, zero fake div mocks) */}
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl border border-neutral-200/90 bg-[#FAF9F6] p-5 sm:p-7 shadow-[0_6px_24px_-10px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 transition-all">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-neutral-200/70">
                <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  <Waveform size={16} weight="bold" className="text-neutral-900" />
                  <span>Acoustic Instrument Preview</span>
                </div>
                
                {/* Spotlight Switcher Tabs with Sliding Motion Indicator */}
                <div className="flex items-center gap-1 bg-neutral-200/70 p-1 rounded-xl relative overflow-x-auto scrollbar-none touch-scroll max-w-full">
                  {spotlightWords.map((w, idx) => {
                    const l = LANGUAGES.find(lang => lang.id === w.languageId);
                    const isActive = idx === activePreviewIndex;
                    return (
                      <button
                        key={w.id}
                        onClick={() => {
                          setActivePreviewIndex(idx);
                          setActiveSyllable(null);
                        }}
                        className={`relative px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none shrink-0 ${
                          isActive 
                            ? 'text-neutral-900 font-semibold' 
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeSpotlightWordPill"
                            className="absolute inset-0 bg-white rounded-lg shadow-2xs border border-neutral-300/80"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">{l?.name || w.word}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Acoustic Fidelity Notice: API Key vs Browser WebSpeech (Zero em-dashes) */}
              {!hasOpenAIKey ? (
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs shadow-2xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900 shrink-0 mt-0.5">
                      <Warning size={16} weight="bold" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-amber-900">
                        Browser WebSpeech in use: Limited Acoustic Fidelity
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                        Without an API key, audio uses browser speech synthesis and will not sound authentic for non-Latin phonemes (like Kannada, Sanskrit, or Icelandic). Add an OpenAI API key for native neural speech modeling.
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onOpenKeyModal}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-white font-semibold text-xs transition-colors cursor-pointer self-start sm:self-center min-h-[34px]"
                  >
                    <Key size={13} weight="bold" />
                    <span>Configure API Key</span>
                  </motion.button>
                </div>
              ) : (
                <div className="mb-5 flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkle size={15} weight="fill" className="text-emerald-700 shrink-0" />
                    <span className="truncate">High-Fidelity Neural Audio Active (OpenAI Audio: {openAIVoice || 'alloy'})</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 hidden sm:inline shrink-0">Authentic Phonetics</span>
                </div>
              )}

              {/* Spotlight Details Grid with AnimatePresence */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewWord.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
                >
                  
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-300 font-mono text-[11px] font-bold text-neutral-800">
                        {previewLanguage.code.toUpperCase()}
                      </span>
                      <span className="text-xs text-neutral-600 font-sans">
                        {previewLanguage.name} / {previewLanguage.family}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 font-display">
                          {previewWord.word}
                        </h2>
                        {previewWord.nativeScript && (
                          <span className="text-xl text-neutral-400 font-serif">
                            {previewWord.nativeScript}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 font-sans mt-1">
                        &ldquo;{previewWord.translation}&rdquo;
                      </p>
                    </div>

                    {/* International Phonetic Alphabet & Syllable Guide */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-3 py-1 rounded-xl bg-white border border-neutral-200 text-neutral-900 font-mono text-xs font-semibold shadow-2xs">
                        <span className="text-[10px] text-neutral-400 uppercase mr-1.5">IPA</span>
                        <span>{previewWord.ipa}</span>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-mono text-xs shadow-2xs">
                        <span className="text-[10px] text-neutral-400 uppercase mr-1.5">Phonetic</span>
                        <span className="font-semibold">{previewWord.syllableGuide}</span>
                      </div>
                    </div>

                    {/* Syllable Isolation Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">
                        Isolated Syllable Trainer
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {previewWord.syllables.map((syl, i) => {
                          const isCurrent = activeSyllable === syl;
                          return (
                            <motion.button
                              key={i}
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handlePlaySyllable(syl)}
                              className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
                                isCurrent
                                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                                  : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-200 shadow-2xs'
                              }`}
                            >
                              <SpeakerHigh size={12} weight={isCurrent ? 'fill' : 'bold'} />
                              <span>{syl}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Primary Audio Triggers */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handlePlayPreview(false)}
                        disabled={isPlayingPreview}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer min-h-[40px]"
                      >
                        <SpeakerHigh size={15} weight="bold" className={isPlayingPreview ? 'animate-bounce' : ''} />
                        <span>Hear Native</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handlePlayPreview(true)}
                        disabled={isPlayingPreview}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 font-medium text-xs border border-neutral-200 transition-all shadow-2xs disabled:opacity-50 cursor-pointer min-h-[40px]"
                      >
                        <HourglassHigh size={14} weight="bold" className="text-neutral-500" />
                        <span>Slow-Mo 0.7x</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onLaunchStudio(previewWord.languageId)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold text-xs border border-neutral-300 transition-all cursor-pointer sm:ml-auto min-h-[40px]"
                      >
                        <span>Open in Studio</span>
                        <ArrowRight size={13} weight="bold" />
                      </motion.button>
                    </div>

                  </div>

                  {/* Right Column: Biomechanical Mouth Guidance */}
                  <div className="md:col-span-5 bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-900">
                        <Target size={14} weight="bold" className="text-neutral-900" />
                        <span>Articulatory Biomechanics</span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                        {previewWord.mouthPositionTip}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block font-semibold">
                        Linguistic Context
                      </span>
                      <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                        {previewWord.funFact}
                      </p>
                    </div>
                  </div>

                </motion.div>
              </AnimatePresence>

            </div>
          </div>

        </div>
      </section>

      {/* 3. ASYMMETRIC BENTO GRID (Taste Skill Bento Discipline: 7/5 + 5/7 rhythm, material diversity, zero split-headers) */}
      <section className="py-16 md:py-24 border-b border-neutral-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight font-display">
              Engineered for acoustic precision.
            </h2>
            <p className="text-sm text-neutral-600 font-sans mt-2 leading-relaxed">
              Moving beyond generic chatbots to a dedicated biomechanical speech laboratory.
            </p>
          </div>

          {/* Asymmetric 4-Tile Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Tile 1 (Span 7) - Focal Dark Slate Material Card */}
            <div className="lg:col-span-7 p-7 rounded-3xl bg-[#0F172A] text-white border border-slate-800 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                    <ChatCircleDots size={20} weight="bold" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold uppercase">
                    Full-Duplex WebRTC
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight text-white">
                  Bidirectional Conversational Streaming
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-lg">
                  Direct peer-to-peer WebRTC SDP negotiation with OpenAI <code className="font-mono text-[11px] bg-slate-800 text-slate-200 px-1 py-0.5 rounded">gpt-live-1</code> and Google Gemini Live. Interrupt naturally, repeat phonemes mid-stride, and experience sub-250ms conversational turnaround without push-to-talk delays.
                </p>
              </div>

              {/* Physical Pipeline Visual Spec */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-slate-300 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  <span className="text-slate-200 font-bold block">Mic 24kHz</span>
                  <span className="text-[10px] text-slate-400">Opus PCM</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  <span className="text-emerald-400 font-bold block">Live Model</span>
                  <span className="text-[10px] text-slate-400">WebRTC Track</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/60">
                  <span className="text-slate-200 font-bold block">Audio Coach</span>
                  <span className="text-[10px] text-slate-400">&lt;250ms Turn</span>
                </div>
              </div>
            </div>

            {/* Tile 2 (Span 5) - Clean Stone Tile */}
            <div className="lg:col-span-5 p-7 rounded-3xl bg-[#FAF9F6] border border-neutral-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <SlidersHorizontal size={18} weight="bold" />
                </div>
                <h3 className="text-xl font-bold font-display text-neutral-900">
                  Acoustic Spectrogram Matching
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Evaluates fundamental frequency (F0), formant frequencies (F1/F2), and syllable stress contour with isolated syllable feedback.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 font-mono text-xs space-y-2">
                <div className="flex justify-between text-neutral-700 text-[11px]">
                  <span>Formant Coherence</span>
                  <span className="text-neutral-900 font-bold">Resonant Match</span>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-neutral-900 h-full rounded-full w-[92%]" />
                </div>
              </div>
            </div>

            {/* Tile 3 (Span 5) - Articulatory Biomechanics */}
            <div className="lg:col-span-5 p-7 rounded-3xl bg-[#FAF9F6] border border-neutral-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Target size={18} weight="bold" />
                </div>
                <h3 className="text-xl font-bold font-display text-neutral-900">
                  Biomechanical Tongue Guides
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Precise instructions for oral gymnastics: retroflex tongue curling, uvular fricatives, and mora nasal timing.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-neutral-200 text-xs font-sans text-neutral-700 space-y-1">
                <span className="text-[10px] font-mono uppercase text-neutral-400 block font-semibold">
                  Sample Anatomical Cue
                </span>
                <p className="text-xs leading-snug">
                  &ldquo;Curl tongue tip back to contact the hard palate without brushing upper incisors.&rdquo;
                </p>
              </div>
            </div>

            {/* Tile 4 (Span 7) - Local Client Security */}
            <div className="lg:col-span-7 p-7 rounded-3xl bg-[#FAF9F6] border border-neutral-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                    <ShieldCheck size={20} weight="bold" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 font-semibold uppercase">
                    Zero Server Storage
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-neutral-900">
                  Local Client Credential Privacy
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans max-w-lg">
                  Your OpenAI and Google API keys remain in your browser isolated localStorage. Zero backend intermediary servers intercept or store your audio.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-neutral-800">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-neutral-200">
                  <Check size={14} weight="bold" className="text-neutral-900 shrink-0" />
                  <span>Direct API handshakes</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-neutral-200">
                  <Check size={14} weight="bold" className="text-neutral-900 shrink-0" />
                  <span>No audio persistence</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. CURATED 22-LANGUAGE DIRECTORY (Taste Skill: Search + Filter Pills + Direct Studio Access) */}
      <section id="languages-directory" className="py-16 md:py-24 border-b border-neutral-200/80 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight font-display">
                Curated 22-Language Polyglot Catalog
              </h2>
              <p className="text-sm text-neutral-600 font-sans mt-1">
                Authentic phonetics across 9 linguistic families. Tap any language to practice.
              </p>
            </div>

            {/* Instant Search Bar */}
            <div className="relative w-full lg:w-72">
              <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search languages..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-sans placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
              />
            </div>
          </div>

          {/* Family Filter Pills */}
          <div className="flex flex-wrap gap-1.5 mb-8 relative">
            {families.map(fam => {
              const isActive = activeFamilyFilter === fam;
              return (
                <button
                  key={fam}
                  onClick={() => setActiveFamilyFilter(fam)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all capitalize cursor-pointer border ${
                    isActive
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {fam}
                </button>
              );
            })}
          </div>

          {/* Languages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredLanguages.map(lang => {
              const langWords = WORDS_DATABASE.filter(w => w.languageId === lang.id);
              const sampleWord = langWords[0];

              return (
                <motion.div
                  layout
                  key={lang.id}
                  className="rounded-2xl border border-neutral-200/90 bg-white p-4.5 hover:border-neutral-300 hover:shadow-xs transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 font-mono text-[11px] font-bold text-neutral-800">
                        {lang.code.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 capitalize">
                        {lang.family}
                      </span>
                    </div>

                    <div className="mb-2">
                      <h3 className="text-base font-bold text-neutral-900 font-display group-hover:text-neutral-700 transition-colors">
                        {lang.name}
                      </h3>
                      <p className="text-xs text-neutral-400 font-serif">
                        {lang.nativeName}
                      </p>
                    </div>

                    {sampleWord && (
                      <div className="pt-2 border-t border-neutral-100 mb-4">
                        <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                          Spotlight Word
                        </span>
                        <div className="flex items-baseline justify-between gap-2 mt-0.5">
                          <p className="text-xs font-semibold text-neutral-800 truncate">
                            {sampleWord.word}
                          </p>
                          <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                            [{sampleWord.ipa}]
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onLaunchStudio(lang.id)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-neutral-50 hover:bg-neutral-900 text-neutral-800 hover:text-white font-semibold text-xs border border-neutral-200 hover:border-neutral-900 transition-all cursor-pointer min-h-[38px] active:scale-[0.98]"
                  >
                    <span>Practice {lang.name}</span>
                    <ArrowRight size={13} weight="bold" />
                  </button>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 5. DUAL CONVERSATIONAL SPEECH ENGINES */}
      <section className="py-16 md:py-24 border-b border-neutral-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight font-display">
              Dual Conversational AI Architectures
            </h2>
            <p className="text-sm text-neutral-600 font-sans mt-2 leading-relaxed">
              Select your conversational speech engine for authentic pronunciation coaching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            
            {/* OpenAI Card */}
            <div className="p-7 rounded-3xl border border-neutral-200 bg-[#FAF9F6] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                    <Sparkle size={16} weight="fill" />
                  </div>
                  <span className="font-bold font-display text-neutral-900">OpenAI GPT-Live-1</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-semibold uppercase">
                  WebRTC Audio Track
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                Native WebRTC audio streaming with <code className="font-mono text-[11px] bg-neutral-200/60 px-1 py-0.5 rounded">POST /v1/live/sessions</code>. Natural full-duplex interruption, zero turn-taking latency, and expressive phonetic cadence.
              </p>

              <div className="pt-1 text-xs font-mono text-neutral-700 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Check size={13} weight="bold" className="text-neutral-900" />
                  <span>Full Duplex Live Session API</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} weight="bold" className="text-neutral-900" />
                  <span>Automated fallback to Realtime Preview</span>
                </div>
              </div>

              <div className="pt-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold ${
                  hasOpenAIKey ? 'text-emerald-700' : 'text-neutral-400'
                }`}>
                  <span>{hasOpenAIKey ? 'OpenAI Key Active' : 'Enter Key in Studio Settings'}</span>
                </span>
              </div>
            </div>

            {/* Gemini Live Card */}
            <div className="p-7 rounded-3xl border border-neutral-200 bg-[#FAF9F6] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                    <Cpu size={16} weight="bold" />
                  </div>
                  <span className="font-bold font-display text-neutral-900">Google Gemini Live</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-semibold uppercase">
                  WebSocket Stream
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                Streaming multimodal WebSocket connection to Gemini 2.0 Flash Live with 24kHz audio. Multi-lingual phonology support across Indian, East Asian, and European linguistic families.
              </p>

              <div className="pt-1 text-xs font-mono text-neutral-700 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Check size={13} weight="bold" className="text-neutral-900" />
                  <span>Multilingual Phonetic Awareness</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={13} weight="bold" className="text-neutral-900" />
                  <span>5 Distinct Neural Voice Personas</span>
                </div>
              </div>

              <div className="pt-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold ${
                  hasGeminiKey ? 'text-emerald-700' : 'text-neutral-400'
                }`}>
                  <span>{hasGeminiKey ? 'Gemini Key Configured' : 'Enter Key in Studio Settings'}</span>
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. FINAL STUDIO LAUNCH BANNER (Taste Skill: Single intent, no duplicates, crisp contrast) */}
      <section className="py-16 bg-[#0A0A0A] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-display">
            Ready to speak with authentic resonance?
          </h2>

          <p className="text-neutral-400 text-sm sm:text-base max-w-lg mx-auto font-sans leading-relaxed">
            Practice pronunciation across 22 languages with real-time acoustic scoring and conversational voice coaching.
          </p>

          <div className="pt-2">
            <button
              onClick={() => onLaunchStudio()}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-neutral-100 text-[#0A0A0A] font-bold text-sm sm:text-base transition-all shadow-[0_14px_30px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98] cursor-pointer min-h-[50px]"
            >
              <span>Launch Voice Studio</span>
              <ArrowRight size={17} weight="bold" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. CLEAN FOOTER (Zero em-dashes) */}
      <footer className="py-8 border-t border-neutral-200 bg-white text-neutral-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <Waveform size={14} weight="bold" />
            </div>
            <span className="font-display font-bold text-neutral-900 text-sm">phonica</span>
            <span className="text-neutral-300">/</span>
            <span>Polyglot Voice and Phonetics Studio</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <button
              onClick={() => onLaunchStudio()}
              className="hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Studio
            </button>
            <a
              href="#languages-directory"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('languages-directory')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-neutral-900 transition-colors"
            >
              Languages
            </a>
            <span>Zero Server Audio Storage</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

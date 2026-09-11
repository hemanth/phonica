import React from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  ArrowsClockwise, 
  SpeakerHigh, 
  Medal,
  Sparkle,
  Waveform
} from '@phosphor-icons/react';
import { PronunciationScore, WordItem } from '../types';

interface ScoreModalProps {
  isOpen?: boolean;
  scoreData: PronunciationScore | null;
  word: WordItem;
  language?: any;
  isPlayingAdvice?: boolean;
  onPlayAdvice?: () => void;
  onClose: () => void;
  onRetry: () => void;
  onHearNative: () => void;
  onNextWord: () => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  isOpen = true,
  scoreData,
  word,
  isPlayingAdvice = false,
  onPlayAdvice,
  onClose,
  onRetry,
  onHearNative,
  onNextWord
}) => {
  if (!isOpen || !scoreData) return null;

  // Safe extraction supporting both canonical and legacy formats
  const score = typeof scoreData.score === 'number' 
    ? scoreData.score 
    : typeof (scoreData as any).overallScore === 'number' 
      ? (scoreData as any).overallScore 
      : 75;
  const isExcellent = score >= 85;
  const isGood = score >= 70 && score < 85;

  const engineName = scoreData.engineName || (scoreData as any).transcriptionEngine || 'Acoustic Model';
  const feedback = scoreData.feedback || (scoreData as any).accuracyNote || 'Pronunciation evaluated.';
  const syllables = Array.isArray(scoreData.syllableMatch) 
    ? scoreData.syllableMatch 
    : Array.isArray((scoreData as any).syllablesFeedback) 
      ? (scoreData as any).syllablesFeedback 
      : [];
  const heardText = scoreData.heardText || '(inaudible)';
  const accentNote = scoreData.accentNote || word.mouthPositionTip;

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
        className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200/90 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] p-5 sm:p-7 relative overflow-hidden space-y-5 max-h-[90dvh] overflow-y-auto touch-scroll"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close score modal"
          className="absolute top-5 right-5 p-2 rounded-xl bg-neutral-100 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/80 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center text-white shrink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
            <Medal size={20} weight="bold" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0A0A0A] tracking-tight">
              Pronunciation Analysis
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              Evaluated via {engineName}
            </p>
          </div>
        </div>

        {/* Circular Score Visualizer */}
        <div className="flex items-center justify-center p-5 rounded-2xl bg-neutral-50/90 border border-neutral-200/80">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative flex items-center justify-center">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  className="stroke-neutral-200"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  className={`transition-all duration-1000 ease-out ${
                    isExcellent ? 'stroke-emerald-600' : isGood ? 'stroke-neutral-900' : 'stroke-amber-600'
                  }`}
                  strokeWidth="8"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * Math.max(0, Math.min(100, score))) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
                  {score}%
                </span>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider font-semibold">
                  Accuracy
                </span>
              </div>
            </div>

            <span className="mt-2.5 text-xs font-semibold text-neutral-800">
              {feedback}
            </span>
          </div>
        </div>

        {/* Heard Transcription Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-3 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Target Word</span>
            <span className="text-[#0A0A0A] font-bold block">{word.word}</span>
            <span className="text-neutral-500 text-[11px] block">{word.ipa}</span>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Acoustic Audio Heard</span>
            <span className="text-[#0A0A0A] font-bold block truncate">&ldquo;{heardText}&rdquo;</span>
            <span className="text-neutral-500 text-[11px] block">{word.syllableGuide || 'Phonetic units'}</span>
          </div>
        </div>

        {/* Syllable Diagnostic Checklist */}
        <div className="space-y-1.5">
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider block font-semibold">
            Syllable Diagnostic Breakdown
          </span>

          {syllables.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {syllables.map((syl: any, i: number) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border flex items-center justify-between font-mono text-xs font-semibold ${
                    syl.correct
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span>{syl.syllable}</span>
                  {syl.correct ? (
                    <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                  ) : (
                    <XCircle size={15} weight="bold" className="text-rose-600" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-neutral-50/90 border border-neutral-200/80 text-xs font-mono text-neutral-500">
              Target syllables: {word.syllables?.join(' / ') || word.word}
            </div>
          )}
        </div>

        {/* Coach Advice with Spoken Audio Feedback */}
        <div className="p-4 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-[#0A0A0A] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkle size={14} weight="fill" className="text-neutral-900" />
              <span>Mastery Advice and Mechanics</span>
            </span>

            {onPlayAdvice && (
              <button
                onClick={onPlayAdvice}
                disabled={isPlayingAdvice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs border border-neutral-200/90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] cursor-pointer min-h-[34px] disabled:opacity-60 active:scale-[0.98]"
                title="Listen to spoken audio feedback from the live coach"
              >
                <SpeakerHigh size={15} weight="bold" className={isPlayingAdvice ? 'animate-bounce text-[#0A0A0A]' : ''} />
                <span>{isPlayingAdvice ? 'Coach Speaking...' : 'Hear Spoken Feedback'}</span>
              </button>
            )}
          </div>
          <p className="text-neutral-700 leading-relaxed font-sans text-xs sm:text-sm">
            {accentNote}
          </p>
        </div>

        {/* Actions - Mobile Responsive Stack with Tactile Physics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            onClick={onRetry}
            className="py-3 px-4 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-200/90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer min-h-[44px]"
          >
            <ArrowsClockwise size={15} weight="bold" />
            <span>Try Again</span>
          </button>

          <button
            onClick={onHearNative}
            className="py-3 px-4 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-200/90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer min-h-[44px]"
          >
            <SpeakerHigh size={15} weight="bold" />
            <span>Hear Native</span>
          </button>

          <button
            onClick={onNextWord}
            className="py-3 px-4 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 min-h-[44px]"
          >
            <span>Next Word</span>
          </button>
        </div>

      </motion.div>
    </div>
  );
};

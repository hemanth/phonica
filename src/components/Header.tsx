import React from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  Waveform, 
  Plus, 
  ArrowsClockwise,
  CircleNotch
} from '@phosphor-icons/react';
import { LiveEngine, LiveStatus } from '../types';

interface HeaderProps {
  engine: LiveEngine;
  status: LiveStatus;
  hasGeminiKey: boolean;
  hasOpenAIKey: boolean;
  streak: number;
  masteredCount: number;
  currentView: 'landing' | 'studio';
  isGeneratingAIWord?: boolean;
  onToggleView: (view: 'landing' | 'studio') => void;
  onOpenKeys: () => void;
  onOpenCustomWord: () => void;
  onRandomWord: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  engine,
  status,
  hasGeminiKey,
  hasOpenAIKey,
  streak,
  masteredCount,
  currentView,
  isGeneratingAIWord = false,
  onToggleView,
  onOpenKeys,
  onOpenCustomWord,
  onRandomWord
}) => {
  const isKeySet = engine === 'gemini' ? hasGeminiKey : engine === 'openai' ? hasOpenAIKey : true;

  const getStatusBadge = () => {
    switch (status) {
      case 'speaking':
        return { text: 'Coach Speaking', dot: 'bg-emerald-500 animate-ping', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'listening':
        return { text: 'Listening...', dot: 'bg-neutral-900 animate-pulse', bg: 'bg-neutral-100 text-neutral-900 border-neutral-300' };
      case 'connected':
        return { text: 'Live Active', dot: 'bg-emerald-600', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'connecting':
        return { text: 'Connecting...', dot: 'bg-amber-500 animate-pulse', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'error':
        return { text: 'Engine Alert', dot: 'bg-rose-500', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      default:
        return { text: 'Ready', dot: 'bg-neutral-400', bg: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <header className="w-full border-b border-neutral-200/80 bg-[#FAF9F6]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2">
        
        {/* Brand identity & View Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          <button 
            onClick={() => onToggleView('landing')}
            className="flex items-center gap-2 sm:gap-3 text-left cursor-pointer group shrink-0"
            title="Go to phonica Overview"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#0A0A0A] group-hover:bg-neutral-800 flex items-center justify-center text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all shrink-0">
              <Waveform size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight text-[#0A0A0A] leading-tight truncate">
                  phonica
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 hidden md:block font-mono">
                Polyglot Pronunciation / Voice Studio
              </p>
            </div>
          </button>

          {/* View Segmented Toggle with Tactile Sliding Pill */}
          <div className="flex items-center bg-neutral-200/60 p-0.5 sm:p-1 rounded-xl border border-neutral-200/90 text-[11px] sm:text-xs font-mono relative shrink-0">
            <button
              onClick={() => onToggleView('landing')}
              className={`relative px-2.5 sm:px-3.5 py-1 rounded-lg transition-colors cursor-pointer select-none ${
                currentView === 'landing'
                  ? 'text-[#0A0A0A] font-bold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {currentView === 'landing' && (
                <motion.div
                  layoutId="activeHeaderViewPill"
                  className="absolute inset-0 bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10">Overview</span>
            </button>
            <button
              onClick={() => onToggleView('studio')}
              className={`relative px-2.5 sm:px-3.5 py-1 rounded-lg transition-colors cursor-pointer select-none ${
                currentView === 'studio'
                  ? 'text-[#0A0A0A] font-bold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {currentView === 'studio' && (
                <motion.div
                  layoutId="activeHeaderViewPill"
                  className="absolute inset-0 bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10">Studio</span>
            </button>
          </div>
        </div>

        {/* Action Controls & Engine State */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Practice Telemetry - Desktop (Studio Mode) */}
          {currentView === 'studio' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 font-mono text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-neutral-600">
              <span>Streak <strong className="text-[#0A0A0A] font-semibold">{streak}</strong></span>
              <span className="text-neutral-300">·</span>
              <span><strong className="text-[#0A0A0A] font-semibold">{masteredCount}</strong> mastered</span>
            </div>
          )}

          {/* Engine Status pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-medium transition-all ${statusInfo.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
            <span className="hidden md:inline">{statusInfo.text}</span>
            <span className="text-[10px] uppercase tracking-wide opacity-75">
              {engine === 'gemini' ? 'Gemini' : engine === 'openai' ? 'GPT-Live' : 'Web Audio'}
            </span>
          </div>

          {currentView === 'landing' ? (
            /* Landing View Quick CTA */
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggleView('studio')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 cursor-pointer min-h-[38px] active:scale-[0.98]"
            >
              <span>Launch Studio</span>
            </motion.button>
          ) : (
            /* Studio Actions */
            <>
              {/* Custom Word CTA */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onOpenCustomWord}
                aria-label="Add custom practice word"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200/90 text-xs font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] cursor-pointer min-h-[38px] active:scale-[0.98]"
                title="Practice your own custom word"
              >
                <Plus size={14} weight="bold" className="text-neutral-800" />
                <span className="hidden sm:inline">Add Word</span>
              </motion.button>

              {/* New Random Word Button (Solid High-Contrast Primary) */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onRandomWord}
                disabled={isGeneratingAIWord}
                aria-label="Roll a new random word"
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 disabled:opacity-80 text-white text-xs font-semibold transition-all shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 cursor-pointer min-h-[38px] active:scale-[0.98]"
                title="Generate a new random pronunciation challenge"
              >
                {isGeneratingAIWord ? (
                  <>
                    <CircleNotch size={14} weight="bold" className="animate-spin text-neutral-300" />
                    <span className="hidden sm:inline">Crafting AI Word...</span>
                  </>
                ) : (
                  <>
                    <ArrowsClockwise size={14} weight="bold" />
                    <span className="hidden sm:inline">Roll Word</span>
                  </>
                )}
              </motion.button>
            </>
          )}

          {/* API Key Modal Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onOpenKeys}
            aria-label="Configure API Keys"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer min-h-[38px] active:scale-[0.98] ${
              isKeySet 
                ? 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]' 
                : 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
            }`}
            title="Configure Gemini Live & OpenAI API Keys"
          >
            <Key size={14} weight={isKeySet ? 'regular' : 'fill'} className={isKeySet ? 'text-neutral-500' : 'text-amber-700'} />
            <span className="hidden sm:inline">Keys</span>
          </motion.button>

        </div>

      </div>
    </header>
  );
};


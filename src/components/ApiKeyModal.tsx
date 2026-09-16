import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  X, 
  Check, 
  Eye, 
  EyeSlash, 
  ShieldCheck, 
  ArrowSquareOut 
} from '@phosphor-icons/react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiKey: string;
  openAIKey: string;
  geminiVoice: string;
  openAIVoice: string;
  geminiModel?: string;
  onSaveKeys?: (geminiKey: string, openAIKey: string, geminiVoice: string, openAIVoice: string, geminiModel?: string) => void;
  onSave?: (geminiKey: string, openAIKey: string, geminiVoice: string, openAIVoice: string, geminiModel?: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  geminiKey,
  openAIKey,
  geminiVoice,
  openAIVoice,
  geminiModel,
  onSaveKeys,
  onSave
}) => {
  const [gKey, setGKey] = useState(geminiKey);
  const [oaKey, setOaKey] = useState(openAIKey);
  const [gVoice, setGVoice] = useState(geminiVoice);
  const [oVoice, setOVoice] = useState(openAIVoice);
  const [gModel, setGModel] = useState(() => {
    if (geminiModel && geminiModel.startsWith('models/gemini-3.8-live')) {
      return geminiModel;
    }
    return 'models/gemini-3.8-live';
  });
  const [showGKey, setShowGKey] = useState(false);
  const [showOaKey, setShowOaKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saveFn = onSaveKeys || onSave;
    saveFn?.(gKey.trim(), oaKey.trim(), gVoice, oVoice, gModel);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
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
        className="w-full max-w-lg bg-white rounded-3xl border border-neutral-200/90 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] p-5 sm:p-7 relative overflow-hidden space-y-5 max-h-[90dvh] overflow-y-auto touch-scroll"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-xl bg-neutral-100 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/80 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center text-white shrink-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
            <Key size={18} weight="bold" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#0A0A0A] tracking-tight">
              Voice Engine Credentials
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              Configure credentials for GPT-Live-1, Gemini Live and Speech APIs
            </p>
          </div>
        </div>

        {/* Security assurance banner */}
        <div className="p-3.5 rounded-2xl bg-neutral-50/90 border border-neutral-200/80 flex items-start gap-2.5 text-xs text-neutral-600 leading-relaxed">
          <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <strong className="text-[#0A0A0A] block font-semibold">Local Client-Side Storage</strong>
            <span>Keys are stored strictly in your browser's localStorage and never transmitted to external databases.</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* OpenAI Live Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                <span>OpenAI API Key</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200 font-medium">
                  GPT-Live-1 WebRTC
                </span>
              </label>
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noreferrer"
                className="text-neutral-600 hover:text-[#0A0A0A] font-medium hover:underline text-[11px] flex items-center gap-1 font-mono"
              >
                <span>Get Key</span>
                <ArrowSquareOut size={12} weight="bold" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showOaKey ? 'text' : 'password'}
                value={oaKey}
                onChange={e => setOaKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 font-mono text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/15 pr-10 min-h-[42px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              />
              <button
                type="button"
                aria-label={showOaKey ? "Hide key" : "Show key"}
                onClick={() => setShowOaKey(!showOaKey)}
                className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showOaKey ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* OpenAI Voice Persona Picker */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-neutral-600 font-medium font-mono text-[11px]">OpenAI Voice:</span>
              <select
                value={oVoice}
                onChange={e => setOVoice(e.target.value)}
                className="bg-white border border-neutral-200/90 text-[#0A0A0A] text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <option value="alloy">Alloy (Balanced)</option>
                <option value="echo">Echo (Warm)</option>
                <option value="shimmer">Shimmer (Expressive)</option>
                <option value="coral">Coral (Bright)</option>
                <option value="verse">Verse (Versatile)</option>
              </select>
            </div>
          </div>

          {/* Gemini Live Key Input */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                <span>Google Gemini API Key</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200 font-medium">
                  Live &amp; Transcribe
                </span>
              </label>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-neutral-600 hover:text-[#0A0A0A] font-medium hover:underline text-[11px] flex items-center gap-1 font-mono"
              >
                <span>Get Key</span>
                <ArrowSquareOut size={12} weight="bold" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showGKey ? 'text' : 'password'}
                value={gKey}
                onChange={e => setGKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200/90 text-[#0A0A0A] placeholder:text-neutral-400 font-mono text-xs focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/15 pr-10 min-h-[42px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              />
              <button
                type="button"
                aria-label={showGKey ? "Hide key" : "Show key"}
                onClick={() => setShowGKey(!showGKey)}
                className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showGKey ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Gemini Voice Persona Picker */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-neutral-600 font-medium font-mono text-[11px]">Gemini Voice:</span>
              <select
                value={gVoice}
                onChange={e => setGVoice(e.target.value)}
                className="bg-white border border-neutral-200/90 text-[#0A0A0A] text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <option value="Puck">Puck (Spirited)</option>
                <option value="Charon">Charon (Deep &amp; Resonant)</option>
                <option value="Kore">Kore (Warm &amp; Natural)</option>
                <option value="Fenrir">Fenrir (Authoritative)</option>
                <option value="Aoede">Aoede (Melodic)</option>
              </select>
            </div>

            {/* Gemini Live Model Selector */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-neutral-600 font-medium font-mono text-[11px]">Live Model:</span>
              <select
                value={gModel}
                onChange={e => setGModel(e.target.value)}
                className="bg-white border border-neutral-200/90 text-[#0A0A0A] text-xs font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] max-w-[210px] truncate"
              >
                <option value="models/gemini-3.8-live">Gemini 3.8 Live (Fast &amp; Fluid)</option>
                <option value="models/gemini-3.8-live-extended-thinking">Gemini 3.8 Live Extended Thinking</option>
              </select>
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
              className="px-5 py-2 rounded-xl bg-[#0A0A0A] hover:bg-neutral-800 text-white font-semibold text-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-[0_10px_20px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20 min-h-[40px]"
            >
              {savedSuccess ? (
                <>
                  <Check size={14} weight="bold" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Credentials</span>
              )}
            </button>
          </div>

        </form>

      </motion.div>
    </div>
  );
};

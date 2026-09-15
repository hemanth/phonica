import React, { useEffect, useRef } from 'react';
import { 
  Sparkle, 
  Microphone, 
  MicrophoneSlash, 
  Waveform, 
  User, 
  ChatCircleText,
  CaretRight,
  Translate
} from '@phosphor-icons/react';
import { LiveEngine, LiveStatus, LiveTranscriptEntry, WordItem, Language, COACHING_LANGUAGES } from '../types';

interface LiveCoachPanelProps {
  engine: LiveEngine;
  status: LiveStatus;
  audioLevel: number;
  transcripts: LiveTranscriptEntry[];
  selectedLanguage: Language;
  currentWord: WordItem;
  hasKey: boolean;
  coachingLanguage: string;
  geminiModel?: string;
  onSelectCoachingLanguage: (langId: string) => void;
  onToggleEngine: (engine: LiveEngine) => void;
  onToggleLiveConnection: () => void;
  onSendQuickPrompt: (prompt: string) => void;
  onOpenKeyModal: () => void;
}

export const LiveCoachPanel: React.FC<LiveCoachPanelProps> = ({
  engine,
  status,
  audioLevel,
  transcripts,
  selectedLanguage,
  currentWord,
  hasKey,
  coachingLanguage,
  geminiModel,
  onSelectCoachingLanguage,
  onToggleEngine,
  onToggleLiveConnection,
  onSendQuickPrompt,
  onOpenKeyModal
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Modern Audio Waveform Visualizer (Mobile & Desktop Responsive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      if (canvas.parentElement) {
        const clientWidth = canvas.parentElement.clientWidth - 28;
        if (clientWidth > 60 && canvas.width !== clientWidth) {
          canvas.width = clientWidth;
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Subtle center axis
      ctx.strokeStyle = 'rgba(212, 212, 212, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      const bars = 36;
      const barWidth = 4;
      const gap = (width - bars * barWidth) / (bars - 1);

      const isActive = status === 'speaking' || status === 'listening' || audioLevel > 0.05;
      const effectiveLevel = isActive ? Math.max(0.12, audioLevel) : 0.05;

      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        const wave = Math.sin(i * 0.25 + phase) * Math.cos(i * 0.1 - phase * 0.5);
        const dynamicHeight = Math.max(
          4,
          effectiveLevel * height * 0.75 * Math.abs(wave) + (isActive ? Math.random() * 5 : 0)
        );

        // High-contrast tactile ink spectrum
        if (status === 'speaking') {
          // Coach speaking: High-contrast rich ink
          ctx.fillStyle = i % 2 === 0 ? '#0A0A0A' : '#262626';
        } else if (status === 'listening') {
          // User speaking: Solid ink
          ctx.fillStyle = '#0A0A0A';
        } else {
          // Idle standby
          ctx.fillStyle = 'rgba(163, 163, 163, 0.4)';
        }

        const y = centerY - dynamicHeight / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, dynamicHeight, 2);
        ctx.fill();
      }

      phase += isActive ? 0.08 : 0.02;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateSize);
    };
  }, [status, audioLevel]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const quickPrompts = [
    `Coach me to pronounce "${currentWord.word}" like a native`,
    `Break down the hardest syllable in "${currentWord.word}"`,
    `Tell me how to place my tongue and lips for "${currentWord.word}"`,
    `Give me a fast tongue-twister in ${selectedLanguage.name}`
  ];

  const isLiveRunning = status === 'connected' || status === 'speaking' || status === 'listening';

  return (
    <div className="w-full bg-white rounded-3xl border border-neutral-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 sm:p-6 lg:p-7 flex flex-col justify-between space-y-5 transition-all">
      
      {/* Engine Selection & Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#0A0A0A] flex items-center justify-center text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
              <Sparkle size={15} weight="bold" />
            </div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#0A0A0A] tracking-tight">
              Acoustic Voice Coach
            </h2>
          </div>

          <span className="font-mono text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
            {selectedLanguage.name}
          </span>
        </div>

        {/* Engine Switcher Tabs: Tactile Segmented Control */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-neutral-200/60 border border-neutral-200/90 font-mono text-xs">
          <button
            onClick={() => onToggleEngine('openai')}
            className={`py-1.5 px-1.5 sm:px-2 rounded-lg text-center transition-all cursor-pointer min-h-[36px] ${
              engine === 'openai'
                ? 'bg-white text-[#0A0A0A] shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <div className="truncate">GPT-Live-1</div>
            <div className="text-[9px] font-mono tracking-wider opacity-60">WebRTC</div>
          </button>

          <button
            onClick={() => onToggleEngine('gemini')}
            className={`py-1.5 px-1.5 sm:px-2 rounded-lg text-center transition-all cursor-pointer min-h-[36px] ${
              engine === 'gemini'
                ? 'bg-white text-[#0A0A0A] shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <div className="truncate">Gemini 3.8</div>
            <div className="text-[9px] font-mono tracking-wider opacity-60">Live WebSocket</div>
          </button>
          
          <button
            onClick={() => onToggleEngine('browser')}
            className={`py-1.5 px-1.5 sm:px-2 rounded-lg text-center transition-all cursor-pointer min-h-[36px] ${
              engine === 'browser'
                ? 'bg-white text-[#0A0A0A] shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <div className="truncate">Web Audio</div>
            <div className="text-[9px] font-mono tracking-wider opacity-60">Offline</div>
          </button>
        </div>

        {/* Spoken Coaching Stream Language Selector (Default: EN_US) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 p-2.5 rounded-xl bg-neutral-50/90 border border-neutral-200/80 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-neutral-800 min-w-0">
            <Translate size={15} weight="bold" className="text-neutral-900 shrink-0" />
            <span className="font-semibold text-[11px] sm:text-xs">Coaching Stream:</span>
          </div>
          <select
            value={coachingLanguage}
            onChange={(e) => onSelectCoachingLanguage(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1 rounded-lg bg-white border border-neutral-200/90 text-[#0A0A0A] font-mono text-xs font-semibold focus:outline-none focus:border-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer"
            title="Language spoken by the AI coach for explanations and feedback"
          >
            {COACHING_LANGUAGES.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name} ({cl.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Audio Visualizer Canvas */}
      <div className="relative rounded-2xl bg-neutral-50/90 border border-neutral-200/80 p-3.5 overflow-hidden flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={360}
          height={72}
          className="w-full h-18 block"
        />

        {/* Status Overlay Pill */}
        <div className="absolute bottom-2 left-3.5 right-3.5 flex items-center justify-between text-[11px] font-mono text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isLiveRunning ? 'bg-emerald-600 animate-pulse' : 'bg-neutral-400'}`} />
            <span className="text-[#0A0A0A] uppercase tracking-wider text-[10px] font-semibold">
              {status === 'speaking' ? 'Coach Speaking' : status === 'listening' ? 'Listening' : isLiveRunning ? 'Live Active' : 'Standby'}
            </span>
          </div>

          <span className="text-[10px] text-neutral-400 font-mono font-medium">
            {engine === 'gemini' 
              ? (geminiModel?.includes('extended-thinking') ? 'Gemini 3.8 Thinking' : 'Gemini 3.8 Live') 
              : engine === 'openai' 
              ? 'GPT-Live-1' 
              : 'Web Audio'}
          </span>
        </div>
      </div>

      {/* Real-time Spoken Coaching Feed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
          <span className="flex items-center gap-1.5 font-semibold text-neutral-800">
            <ChatCircleText size={14} className="text-neutral-900" />
            <span>Spoken Coaching Stream</span>
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">{transcripts.length} exchanges</span>
        </div>

        <div className="h-40 sm:h-44 overflow-y-auto overscroll-contain rounded-2xl bg-neutral-50/90 border border-neutral-200/80 p-3 space-y-2.5 font-sans text-xs scrollbar-thin scrollbar-thumb-neutral-300">
          {transcripts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-3 text-neutral-400 space-y-1.5 font-sans">
              <Waveform size={22} className="text-neutral-300" />
              <p className="text-xs max-w-[28ch]">Start a Live voice conversation to receive real-time pronunciation coaching.</p>
            </div>
          ) : (
            transcripts.map(entry => (
              <div
                key={entry.id}
                className={`flex gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {entry.role !== 'user' && (
                  <div className="w-5 h-5 rounded-md bg-[#0A0A0A] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkle size={11} weight="bold" />
                  </div>
                )}
                <div
                  className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                    entry.role === 'user'
                      ? 'bg-[#0A0A0A] text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2)] font-medium'
                      : 'bg-white text-[#0A0A0A] border border-neutral-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-normal'
                  }`}
                >
                  <p>{entry.text}</p>
                </div>
                {entry.role === 'user' && (
                  <div className="w-5 h-5 rounded-md bg-neutral-200 text-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={11} weight="bold" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Quick Coaching Question Buttons */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block font-semibold">
          Quick Coaching Prompts
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSendQuickPrompt(prompt)}
              className="flex items-start gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 hover:text-neutral-950 border border-neutral-200/90 text-[11px] font-medium transition-all text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer"
            >
              <CaretRight size={11} weight="bold" className="text-neutral-500 shrink-0 mt-0.5" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Live Voice Action with Inset Highlights */}
      <div className="pt-2 border-t border-neutral-200/80 space-y-2">
        {(!hasKey && engine !== 'browser') ? (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <span className="text-amber-950 font-medium">
              Requires {engine === 'gemini' ? 'Gemini' : 'OpenAI'} API Key for Live voice.
            </span>
            <button
              onClick={onOpenKeyModal}
              className="px-3 py-1.5 rounded-xl bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-bold font-mono text-xs transition-all cursor-pointer shrink-0 min-h-[34px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.98]"
            >
              Enter Key
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleLiveConnection}
            className={`w-full py-3.5 px-5 rounded-2xl font-semibold font-sans text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer min-h-[48px] ${
              isLiveRunning
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_10px_20px_-6px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-rose-700/20'
                : 'bg-[#0A0A0A] hover:bg-neutral-800 text-white shadow-[0_12px_24px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/20'
            }`}
          >
            {isLiveRunning ? (
              <>
                <MicrophoneSlash size={18} weight="bold" />
                <span>Disconnect Live Voice Tutor</span>
              </>
            ) : (
              <>
                <Microphone size={18} weight="bold" />
                <span>Start Live Voice Conversation</span>
              </>
            )}
          </button>
        )}
      </div>

    </div>
  );
};

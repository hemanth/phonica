import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Shuffle, 
  SquaresFour, 
  Sparkle, 
  Compass, 
  Medal, 
  Lightning,
  MagnifyingGlass,
  CaretUpDown,
  Check,
  X
} from '@phosphor-icons/react';
import { LanguageId, WordDifficulty, Language } from '../types';
import { LANGUAGES } from '../data/words';

interface LanguageSelectorProps {
  selectedLanguageId: LanguageId | 'all';
  selectedDifficulty: WordDifficulty | 'all';
  onSelectLanguage: (id: LanguageId | 'all') => void;
  onSelectDifficulty: (difficulty: WordDifficulty | 'all') => void;
  onRandomFromAny: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguageId,
  selectedDifficulty,
  onSelectLanguage,
  onSelectDifficulty,
  onRandomFromAny
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Current selected language object
  const currentLang = selectedLanguageId !== 'all' 
    ? LANGUAGES.find(l => l.id === selectedLanguageId) 
    : null;

  // Filter languages by search query
  const filteredLanguages = LANGUAGES.filter(l => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(query) ||
      l.nativeName.toLowerCase().includes(query) ||
      l.badgeCode.toLowerCase().includes(query) ||
      l.family.toLowerCase().includes(query)
    );
  });

  // Focus search input when opening dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (id: LanguageId | 'all') => {
    onSelectLanguage(id);
    setIsOpen(false);
  };

  const difficulties: { 
    id: WordDifficulty | 'all'; 
    label: string; 
    icon: React.ReactNode; 
  }[] = [
    { id: 'all', label: 'All', icon: <SquaresFour size={13} weight="bold" /> },
    { id: 'starter', label: 'Starter', icon: <Sparkle size={13} weight="bold" /> },
    { id: 'adept', label: 'Adept', icon: <Compass size={13} weight="bold" /> },
    { id: 'virtuoso', label: 'Virtuoso', icon: <Medal size={13} weight="bold" /> },
    { id: 'beast', label: 'Beast', icon: <Lightning size={13} weight="bold" /> }
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
        
        {/* Left: Search & Select Combobox + Randomizer */}
        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          
          {/* Combobox Trigger Button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white border transition-all active:scale-[0.98] cursor-pointer min-h-[40px] text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] ${
              isOpen 
                ? 'border-neutral-900 ring-2 ring-neutral-900/10' 
                : 'border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/80'
            }`}
          >
            {currentLang ? (
              <span className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200 uppercase">
                  {currentLang.badgeCode}
                </span>
                <span className="font-semibold text-[#0A0A0A]">{currentLang.name}</span>
                <span className="text-neutral-400 font-mono text-[11px] font-normal hidden sm:inline">({currentLang.nativeName})</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-[#0A0A0A]">
                <Globe size={15} weight="bold" className="text-neutral-900" />
                <span>All Languages</span>
                <span className="text-neutral-400 font-mono text-[11px] font-normal">(20)</span>
              </span>
            )}
            
            <CaretUpDown size={13} weight="bold" className="text-neutral-400 ml-1" />
          </button>

          {/* Shuffle / Random Across All */}
          <button
            onClick={onRandomFromAny}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200/90 font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98] cursor-pointer min-h-[40px]"
            title="Pick a random word from any language"
          >
            <Shuffle size={14} weight="bold" className="text-neutral-600" />
            <span className="hidden sm:inline">Shuffle Any</span>
          </button>

          {/* Search & Select Popover Dropdown with AnimatePresence */}
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                role="listbox"
                initial={{ opacity: 0, scale: 0.97, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 top-full mt-1.5 w-[calc(100vw-32px)] sm:w-80 max-w-sm bg-white rounded-2xl border border-neutral-200/90 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.12)] overflow-hidden z-50 origin-top-left"
              >
                
                {/* Search input header */}
                <div className="p-2.5 border-b border-neutral-200/70 bg-neutral-50/80">
                  <div className="relative flex items-center">
                    <MagnifyingGlass size={14} className="absolute left-2.5 text-neutral-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search 22 languages..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white border border-neutral-200/90 text-xs text-[#0A0A0A] placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/20 font-sans"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 p-0.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Language List Options */}
                <div className="max-h-60 overflow-y-auto overscroll-contain p-1 divide-y divide-neutral-100 text-xs touch-scroll">
                  
                  {/* 'All Languages' option */}
                  <button
                    role="option"
                    aria-selected={selectedLanguageId === 'all'}
                    onClick={() => handleSelect('all')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      selectedLanguageId === 'all'
                        ? 'bg-neutral-100 text-neutral-950 font-bold'
                        : 'hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={15} weight={selectedLanguageId === 'all' ? 'fill' : 'regular'} className="text-neutral-900" />
                      <span>All Languages (Global Pool)</span>
                    </div>
                    {selectedLanguageId === 'all' && (
                      <Check size={14} weight="bold" className="text-neutral-900" />
                    )}
                  </button>

                  {/* Filtered Language Items */}
                  {filteredLanguages.map(lang => {
                    const isSelected = selectedLanguageId === lang.id;

                    return (
                      <button
                        key={lang.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(lang.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-100 text-neutral-950 font-bold'
                            : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200 uppercase shrink-0">
                            {lang.badgeCode}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-[#0A0A0A] block truncate">{lang.name}</span>
                            <span className="text-[10px] text-neutral-500 font-mono block truncate">
                              {lang.nativeName} / {lang.family}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Check size={14} weight="bold" className="text-neutral-900 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}

                  {filteredLanguages.length === 0 && (
                    <div className="py-6 text-center text-neutral-400 text-xs font-mono">
                      No language matching "{searchQuery}"
                    </div>
                  )}

                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right: Difficulty Tier Tabs with Tactile Sliding Indicator */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-200/60 border border-neutral-200/90 space-x-1 font-mono overflow-x-auto touch-scroll scrollbar-none relative">
          {difficulties.map(diff => {
            const isSelected = selectedDifficulty === diff.id;
            return (
              <button
                key={diff.id}
                onClick={() => onSelectDifficulty(diff.id)}
                className={`relative shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[32px] select-none ${
                  isSelected
                    ? 'text-[#0A0A0A] font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeDifficultyTabPill"
                    className="absolute inset-0 bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] border border-neutral-200/80"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {diff.icon}
                  <span>{diff.label}</span>
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};

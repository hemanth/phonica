import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from '@phosphor-icons/react';
import { 
  Language, 
  LanguageId, 
  WordItem, 
  WordDifficulty, 
  LiveEngine, 
  LiveStatus, 
  LiveTranscriptEntry, 
  PronunciationScore,
  COACHING_LANGUAGES
} from './types';
import { LANGUAGES, WORDS_DATABASE } from './data/words';
import { Header } from './components/Header';
import { LanguageSelector } from './components/LanguageSelector';
import { WordHero } from './components/WordHero';
import { LiveCoachPanel } from './components/LiveCoachPanel';
import { ApiKeyModal } from './components/ApiKeyModal';
import { CustomWordModal } from './components/CustomWordModal';
import { ScoreModal } from './components/ScoreModal';
import { LandingPage } from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SpeechService } from './services/speechService';
import { LLMAudioService } from './services/llmAudioService';
import { GeminiLiveClient } from './services/geminiLive';
import { OpenAILiveClient } from './services/openAILive';
import { GeminiTranscribeService } from './services/geminiTranscribe';
import { OpenAITranscribeService } from './services/openAITranscribe';
import { AIWordGeneratorService } from './services/aiWordGenerator';

// Helper component that forces the window scroll position to the top upon mounting
const ScrollToTopOnMount: React.FC = () => {
  useLayoutEffect(() => {
    const forceScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    forceScroll();
    const r1 = requestAnimationFrame(forceScroll);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(forceScroll));
    const t1 = setTimeout(forceScroll, 30);
    const t2 = setTimeout(forceScroll, 100);
    const t3 = setTimeout(forceScroll, 300);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);
  return null;
};

export const App: React.FC = () => {
  // Navigation / View State: default to 'landing' showcase unless URL explicitly requests '#studio'
  const [viewMode, setViewMode] = useState<'landing' | 'studio'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#studio') return 'studio';
    }
    return 'landing';
  });

  // Credentials & Preferences
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '');
  const [openAIKey, setOpenAIKey] = useState<string>(() => localStorage.getItem('openai_api_key') || (import.meta as any).env?.VITE_OPENAI_API_KEY || '');
  const [geminiVoice, setGeminiVoice] = useState<string>(() => localStorage.getItem('gemini_voice') || 'Puck');
  const [openAIVoice, setOpenAIVoice] = useState<string>(() => localStorage.getItem('openai_voice') || 'alloy');
  const [geminiModel, setGeminiModel] = useState<string>(() => localStorage.getItem('gemini_model') || 'models/gemini-3.8-live');
  
  // Spoken Coaching Stream Language (defaults strictly to EN_US)
  const [coachingLanguage, setCoachingLanguage] = useState<string>(() => localStorage.getItem('coaching_language') || 'EN_US');
  
  // App State: Default to OpenAI GPT-Live-1 WebRTC whenever key is set or by default
  const [engine, setEngine] = useState<LiveEngine>(() => {
    const saved = localStorage.getItem('selected_engine') as LiveEngine;
    if (saved) return saved;
    if (localStorage.getItem('openai_api_key')) return 'openai';
    if (localStorage.getItem('gemini_api_key')) return 'gemini';
    return 'openai';
  });
  const [selectedLanguageId, setSelectedLanguageId] = useState<LanguageId | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<WordDifficulty | 'all'>('all');
  const [customWords, setCustomWords] = useState<WordItem[]>([]);
  
  // Dynamic AI-Generated Words & Session Progress Tracking
  const [aiGeneratedWords, setAiGeneratedWords] = useState<WordItem[]>(() => {
    try {
      const saved = localStorage.getItem('lingua_ai_words');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [seenWordIds, setSeenWordIds] = useState<Set<string>>(() => new Set([WORDS_DATABASE[0].id]));
  const [isGeneratingAIWord, setIsGeneratingAIWord] = useState(false);
  
  // Active Word Selection
  const [currentWord, setCurrentWord] = useState<WordItem>(() => WORDS_DATABASE[0]);
  
  // Audio & Live Voice State
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isPlayingAdvice, setIsPlayingAdvice] = useState(false);
  const [scoreData, setScoreData] = useState<PronunciationScore | null>(null);
  
  // Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isCustomWordModalOpen, setIsCustomWordModalOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  // User Stats
  const [streak, setStreak] = useState<number>(() => Number(localStorage.getItem('pronounce_streak') || '1'));
  const [masteredCount, setMasteredCount] = useState<number>(() => Number(localStorage.getItem('pronounce_mastered') || '3'));

  // Client references for live connections
  const geminiClientRef = useRef<GeminiLiveClient | null>(null);
  const openAIClientRef = useRef<OpenAILiveClient | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);

  // Current Language Object
  const currentLanguage: Language = LANGUAGES.find(l => l.id === currentWord.languageId) || LANGUAGES[0];

  // Save credentials
  const handleSaveKeys = (newGemKey: string, newOaKey: string, newGVoice: string, newOVoice: string, newGModel?: string) => {
    setGeminiKey(newGemKey);
    setOpenAIKey(newOaKey);
    setGeminiVoice(newGVoice);
    setOpenAIVoice(newOVoice);
    if (newGModel) {
      setGeminiModel(newGModel);
      localStorage.setItem('gemini_model', newGModel);
    }
    localStorage.setItem('gemini_api_key', newGemKey);
    localStorage.setItem('openai_api_key', newOaKey);
    localStorage.setItem('gemini_voice', newGVoice);
    localStorage.setItem('openai_voice', newOVoice);

    // If OpenAI key is added, seamlessly switch engine to OpenAI GPT-Live-1 WebRTC
    if (newOaKey) {
      setEngine('openai');
      localStorage.setItem('selected_engine', 'openai');
    }
  };

  // Switch Live Engine
  const handleToggleEngine = (newEngine: LiveEngine) => {
    disconnectLive();
    setEngine(newEngine);
    localStorage.setItem('selected_engine', newEngine);
  };

  // Roll a new random word, automatically generating with AI when the curated list is exhausted
  const rollRandomWord = useCallback(async (
    langId: LanguageId | 'all' = selectedLanguageId, 
    diff: WordDifficulty | 'all' = selectedDifficulty
  ) => {
    const allWords = [...WORDS_DATABASE, ...customWords, ...aiGeneratedWords];
    let pool = allWords;

    if (langId !== 'all') {
      pool = pool.filter(w => w.languageId === langId);
    }
    if (diff !== 'all') {
      pool = pool.filter(w => w.difficulty === diff);
    }

    if (pool.length === 0) {
      pool = allWords;
    }

    // Filter for candidate words that haven't been practiced yet in this session and aren't currentWord
    const unseenCandidates = pool.filter(w => !seenWordIds.has(w.id) && w.id !== currentWord.id);

    if (unseenCandidates.length > 0) {
      const chosen = unseenCandidates[Math.floor(Math.random() * unseenCandidates.length)];
      setSeenWordIds(prev => new Set([...prev, chosen.id]));
      setCurrentWord(chosen);

      if (liveStatus === 'connected' || liveStatus === 'listening') {
        const prompt = `I just pulled up a new word: "${chosen.word}" in ${LANGUAGES.find(l => l.id === chosen.languageId)?.name || ''}. How do I pronounce it?`;
        sendPromptToLiveCoach(prompt);
      }
      return;
    }

    // --- CURATED LIST IS EXHAUSTED FOR THIS SELECTION! ---
    // Automatically generate a new authentic challenge with AI
    const targetLang = langId !== 'all' 
      ? (LANGUAGES.find(l => l.id === langId) || currentLanguage)
      : currentLanguage;

    const hasApiKey = Boolean(geminiKey || openAIKey);

    if (hasApiKey) {
      setIsGeneratingAIWord(true);
      try {
        const existingWordsList = pool.map(w => w.word);
        const generated = await AIWordGeneratorService.generateChallengeWord({
          language: targetLang,
          difficulty: diff,
          existingWords: existingWordsList,
          geminiKey: geminiKey || undefined,
          openAIKey: openAIKey || undefined
        });

        if (generated) {
          setAiGeneratedWords(prev => {
            const updated = [generated, ...prev];
            try {
              localStorage.setItem('lingua_ai_words', JSON.stringify(updated.slice(0, 50)));
            } catch (e) {
              console.warn('Could not persist AI word to localStorage', e);
            }
            return updated;
          });
          setSeenWordIds(prev => new Set([...prev, generated.id]));
          setCurrentWord(generated);

          if (liveStatus === 'connected' || liveStatus === 'listening') {
            const prompt = `I completed all curated words in ${targetLang.name} and just generated a brand new AI challenge: "${generated.word}". Please coach me through its authentic phonetics!`;
            sendPromptToLiveCoach(prompt);
          }
          return;
        }
      } catch (err) {
        console.error('Failed to generate AI word on list exhaustion:', err);
      } finally {
        setIsGeneratingAIWord(false);
      }
    }

    // Fallback if no API key or generation failed: recycle pool with an unchosen word
    const fallbackCandidates = pool.filter(w => w.id !== currentWord.id);
    const chosen = fallbackCandidates.length > 0
      ? fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)]
      : pool[0];

    // Reset seen status for this pool so practice can continue looping
    setSeenWordIds(prev => {
      const next = new Set(prev);
      pool.forEach(w => next.delete(w.id));
      next.add(chosen.id);
      return next;
    });

    setCurrentWord(chosen);

    if (liveStatus === 'connected' || liveStatus === 'listening') {
      const prompt = `I just pulled up a new word: "${chosen.word}" in ${LANGUAGES.find(l => l.id === chosen.languageId)?.name || ''}. How do I pronounce it?`;
      sendPromptToLiveCoach(prompt);
    }
  }, [selectedLanguageId, selectedDifficulty, customWords, aiGeneratedWords, seenWordIds, currentWord.id, currentLanguage, liveStatus, geminiKey, openAIKey]);

  // Disconnect live voice
  const disconnectLive = useCallback(() => {
    if (geminiClientRef.current) {
      geminiClientRef.current.disconnect();
      geminiClientRef.current = null;
    }
    if (openAIClientRef.current) {
      openAIClientRef.current.disconnect();
      openAIClientRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setLiveStatus('idle');
    setAudioLevel(0);
    setIsTestingVoice(false);
  }, []);

  // Connect live voice
  const connectLive = useCallback(async (initialPrompt?: string) => {
    disconnectLive();

    const coachingLangObj = COACHING_LANGUAGES.find(c => c.id === coachingLanguage) || COACHING_LANGUAGES[0];

    if (engine === 'gemini') {
      if (!geminiKey) {
        setIsKeyModalOpen(true);
        return;
      }

      const client = new GeminiLiveClient({
        apiKey: geminiKey,
        model: geminiModel,
        voiceName: geminiVoice,
        coachingLanguage: coachingLangObj.name,
        onStatusChange: (status) => setLiveStatus(status),
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onTranscript: (role, text) => {
          setTranscripts(prev => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() }
          ]);
        },
        onError: (err) => {
          console.error('Gemini error:', err);
          alert(err);
        }
      });

      geminiClientRef.current = client;
      await client.connect(initialPrompt || `Hello Vocalis! I'm ready to practice pronunciation of "${currentWord.word}" in ${currentLanguage.name}. Please explain tips and guidance in ${coachingLangObj.name} while modeling the word.`);

    } else if (engine === 'openai') {
      if (!openAIKey) {
        setIsKeyModalOpen(true);
        return;
      }

      const client = new OpenAILiveClient({
        apiKey: openAIKey,
        model: 'gpt-live-1',
        voiceName: openAIVoice,
        coachingLanguage: coachingLangObj.name,
        onStatusChange: (status) => setLiveStatus(status),
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onTranscript: (role, text) => {
          setTranscripts(prev => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() }
          ]);
        },
        onError: (err) => {
          console.error('OpenAI error:', err);
          alert(err);
        }
      });

      openAIClientRef.current = client;
      await client.connect(initialPrompt || `Hello! Guide me in pronouncing "${currentWord.word}" in ${currentLanguage.name}. Model authentic native pronunciation and explain tricky syllables in ${coachingLangObj.name}.`);

    } else {
      // Offline Browser mode
      setLiveStatus('listening');
      SpeechService.speak(`Pronunciation practice: ${currentWord.word}`, currentLanguage);
      setTranscripts(prev => [
        ...prev,
        {
          id: `${Date.now()}`,
          role: 'coach-system',
          text: `Offline speech engine active for ${currentLanguage.name}. Use Hear Native, Slow-Mo 0.7x, or click Test Voice to check your pronunciation.`,
          timestamp: Date.now()
        }
      ]);
    }
  }, [engine, geminiKey, openAIKey, geminiVoice, openAIVoice, currentWord, currentLanguage, disconnectLive]);

  // Toggle Live Voice Button
  const handleToggleLive = () => {
    if (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening') {
      disconnectLive();
    } else {
      connectLive();
    }
  };

  // Send prompt to live coach
  const sendPromptToLiveCoach = (promptText: string) => {
    if (engine === 'gemini' && geminiClientRef.current) {
      geminiClientRef.current.sendPrompt(promptText);
    } else if (engine === 'openai' && openAIClientRef.current) {
      openAIClientRef.current.sendPrompt(promptText);
    } else {
      // Connect first then prompt
      connectLive(promptText);
    }
  };

  // Provide spoken audio feedback on what to improve on using live speech capabilities
  const playFeedbackAudio = useCallback(async (evalScore: PronunciationScore) => {
    setIsPlayingAdvice(true);

    const prefix = evalScore.score >= 85 
      ? `Brilliant resonance!` 
      : evalScore.score >= 70 
        ? `Great attempt!` 
        : `Good effort!`;
    const speechText = `${prefix} You scored ${evalScore.score} percent. ${evalScore.accentNote || evalScore.feedback}`;

    try {
      // 1. If OpenAI WebRTC coach or Gemini Live is active, use live full-duplex conversational voice!
      if (
        engine === 'openai' &&
        openAIClientRef.current &&
        (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening')
      ) {
        openAIClientRef.current.sendPrompt(
          `I just practiced "${currentWord.word}" and scored ${evalScore.score}%. The transcript heard was "${evalScore.heardText}". Provide 2 concise spoken sentences giving me verbal feedback on what mouth and tongue mechanics to adjust to nail this pronunciation.`
        );
        setIsPlayingAdvice(false);
        return;
      }

      if (
        engine === 'gemini' &&
        geminiClientRef.current &&
        (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening')
      ) {
        geminiClientRef.current.sendPrompt(
          `I scored ${evalScore.score}% pronouncing "${currentWord.word}". Give me 2 sentences of immediate spoken feedback explaining how to adjust my tongue and mouth to improve.`
        );
        setIsPlayingAdvice(false);
        return;
      }

      // 2. If OpenAI key is configured, synthesize spoken feedback via OpenAI LLM Audio Voice
      if (openAIKey) {
        await LLMAudioService.speakWithLLM(speechText, {
          apiKey: openAIKey,
          voice: openAIVoice || 'alloy',
          speed: 1.0,
          model: 'tts-1'
        });
        setIsPlayingAdvice(false);
        return;
      }

      // 3. Fallback to Browser Speech Synthesis
      const englishLang: Language = {
        id: 'english' as any,
        name: 'English',
        nativeName: 'English',
        code: 'en-US',
        badgeCode: 'EN',
        family: 'Germanic',
        phoneticQuirk: '',
        geminiVoice: 'Puck',
        openaiVoice: 'alloy'
      };
      await SpeechService.speak(speechText, englishLang, false);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    } finally {
      setIsPlayingAdvice(false);
    }
  }, [engine, liveStatus, currentWord.word, openAIKey, openAIVoice]);

  // Play Native Speech - Uses LLM if key is available!
  const handlePlayNative = async () => {
    setIsPlayingAudio(true);
    try {
      // If OpenAI WebRTC coach is already live, ask the coach to model the word directly
      if (
        engine === 'openai' &&
        openAIClientRef.current &&
        (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening')
      ) {
        openAIClientRef.current.sendPrompt(
          `Pronounce the word "${currentWord.word}" authentically in native ${currentLanguage.name}. Speak only the word clearly and naturally with perfect accent, then pause.`
        );
      } else if (openAIKey) {
        // Use OpenAI LLM Audio Speech model
        await LLMAudioService.speakWithLLM(currentWord.word, {
          apiKey: openAIKey,
          voice: openAIVoice,
          speed: 1.0,
          model: 'tts-1'
        });
      } else {
        // Offline Browser Web Speech fallback
        await SpeechService.speak(currentWord.word, currentLanguage, false);
      }
    } catch (err) {
      console.warn('LLM speech playback failed, falling back to Web Speech API', err);
      await SpeechService.speak(currentWord.word, currentLanguage, false);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  // Play Slow-Motion Speech - Uses LLM at 0.7x if key is available!
  const handlePlaySlow = async () => {
    setIsPlayingAudio(true);
    try {
      if (
        engine === 'openai' &&
        openAIClientRef.current &&
        (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening')
      ) {
        openAIClientRef.current.sendPrompt(
          `Pronounce the word "${currentWord.word}" slowly at 0.7x speed in native ${currentLanguage.name}, clearly separating each phoneme.`
        );
      } else if (openAIKey) {
        await LLMAudioService.speakWithLLM(currentWord.word, {
          apiKey: openAIKey,
          voice: openAIVoice,
          speed: 0.7,
          model: 'tts-1'
        });
      } else {
        await SpeechService.speak(currentWord.word, currentLanguage, true);
      }
    } catch (err) {
      console.warn('LLM slow-mo speech failed, falling back to Web Speech API', err);
      await SpeechService.speak(currentWord.word, currentLanguage, true);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  // Play Isolated Syllable - Uses LLM if key is available!
  const handlePlaySyllable = async (syllable: string) => {
    setIsPlayingAudio(true);
    try {
      if (openAIKey) {
        await LLMAudioService.speakWithLLM(syllable, {
          apiKey: openAIKey,
          voice: openAIVoice,
          speed: 0.85,
          model: 'tts-1'
        });
      } else {
        await SpeechService.speak(syllable, currentLanguage, true);
      }
    } catch (err) {
      console.warn('LLM syllable speech failed, falling back to Web Speech API', err);
      await SpeechService.speak(syllable, currentLanguage, true);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  // Test User's Voice with Gemini Transcribe or Web Speech
  const handleTestVoice = async () => {
    if (isTestingVoice) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsTestingVoice(false);
      return;
    }

    setIsTestingVoice(true);

    const runBrowserFallback = () => {
      const rec = SpeechService.recordAndRecognize(
        currentLanguage,
        (transcript) => {
          setIsTestingVoice(false);
          const evalScore = SpeechService.evaluatePronunciation(transcript, currentWord, currentLanguage);
          setScoreData(evalScore);
          setIsScoreModalOpen(true);
          playFeedbackAudio(evalScore);

          if (evalScore.score >= 80) {
            const newMastered = masteredCount + 1;
            setMasteredCount(newMastered);
            localStorage.setItem('pronounce_mastered', String(newMastered));
          }

          setTranscripts(prev => [
            ...prev,
            {
              id: `${Date.now()}`,
              role: 'user',
              text: `[Browser Speech]: heard "${transcript}" for "${currentWord.word}" (Score: ${evalScore.score}%)`,
              timestamp: Date.now()
            }
          ]);
        },
        (error) => {
          setIsTestingVoice(false);
          console.warn('Speech recognition warning:', error);
        },
        (lvl) => setAudioLevel(lvl)
      );
      recognitionRef.current = rec;
    };

    // Route audio directly to neural model if OpenAI or Gemini key is configured
    const useOpenAI = Boolean(openAIKey && (engine === 'openai' || !geminiKey));
    const useGemini = Boolean(geminiKey && (engine === 'gemini' || !openAIKey));

    if (useOpenAI || useGemini) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        // Audio level visualizer
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let animId: number;
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          setAudioLevel(Math.min(1, (sum / buf.length / 255) * 2.5));
          animId = requestAnimationFrame(tick);
        };
        tick();

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        const finalize = async () => {
          cancelAnimationFrame(animId);
          stream.getTracks().forEach(t => t.stop());
          if (audioCtx && audioCtx.state !== 'closed') {
            audioCtx.close().catch(() => {});
          }
          setAudioLevel(0);
          setIsTestingVoice(false);

          if (audioChunks.length === 0) return;
          const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });

          try {
            let evalScore: PronunciationScore;
            let modelLabel = '';

            if (useOpenAI) {
              modelLabel = 'OpenAI Whisper + GPT-4o';
              evalScore = await OpenAITranscribeService.evaluateWithOpenAI(
                blob,
                currentWord,
                currentLanguage,
                openAIKey
              );
            } else {
              modelLabel = 'Gemini 3.8 Flash';
              evalScore = await GeminiTranscribeService.evaluateWithGeminiTranscribe(
                blob,
                currentWord,
                currentLanguage,
                geminiKey
              );
            }

            setScoreData(evalScore);
            setIsScoreModalOpen(true);
            playFeedbackAudio(evalScore);

            if (evalScore.score >= 80) {
              const newMastered = masteredCount + 1;
              setMasteredCount(newMastered);
              localStorage.setItem('pronounce_mastered', String(newMastered));
            }

            setTranscripts(prev => [
              ...prev,
              {
                id: `${Date.now()}`,
                role: 'user',
                text: `[${modelLabel}]: heard "${evalScore.heardText}" for "${currentWord.word}" (Score: ${evalScore.score}%)`,
                timestamp: Date.now()
              }
            ]);
          } catch (err: any) {
            console.error('Neural model evaluation failed, fallback to browser speech:', err);
            runBrowserFallback();
          }
        };

        mediaRecorder.onstop = finalize;
        mediaRecorder.start();

        const timeout = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 4000);

        mediaRecorderRef.current = {
          stop: () => {
            clearTimeout(timeout);
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }
        };
      } catch (e) {
        console.warn('Microphone error for neural evaluation, falling back to browser speech', e);
        runBrowserFallback();
      }
    } else {
      runBrowserFallback();
    }
  };

  // Add custom word
  const handleAddCustomWord = (newWord: WordItem) => {
    setCustomWords(prev => [newWord, ...prev]);
    setSeenWordIds(prev => new Set([...prev, newWord.id]));
    setCurrentWord(newWord);
  };

  // Robust instant scroll to top function
  const forceScrollToTop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Ensure scroll restoration is manual so browser doesn't retain old scroll on view switches
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Reset scroll whenever viewMode changes
  useLayoutEffect(() => {
    forceScrollToTop();
    const r1 = requestAnimationFrame(forceScrollToTop);
    const t1 = setTimeout(forceScrollToTop, 50);
    const t2 = setTimeout(forceScrollToTop, 150);
    const t3 = setTimeout(forceScrollToTop, 250);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [viewMode, forceScrollToTop]);

  // View navigation handlers
  const handleLaunchStudio = (langId?: LanguageId) => {
    if (langId) {
      setSelectedLanguageId(langId);
      rollRandomWord(langId, selectedDifficulty);
    }
    setViewMode('studio');
    localStorage.setItem('lingua_view_mode', 'studio');
    if (typeof window !== 'undefined') window.location.hash = '#studio';
    forceScrollToTop();
  };

  const handleToggleView = (mode: 'landing' | 'studio') => {
    setViewMode(mode);
    localStorage.setItem('lingua_view_mode', mode);
    if (typeof window !== 'undefined') window.location.hash = mode === 'studio' ? '#studio' : '#overview';
    forceScrollToTop();
  };

  // Sync hash routing
  useEffect(() => {
    const onHashChange = () => {
      if (typeof window !== 'undefined') {
        if (window.location.hash === '#studio') {
          setViewMode('studio');
        } else {
          setViewMode('landing');
        }
        forceScrollToTop();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [forceScrollToTop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnectLive();
    };
  }, [disconnectLive]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#FAF9F6] text-[#0A0A0A] relative selection:bg-neutral-200 selection:text-[#0A0A0A]">
      
      {/* App Header */}
      <Header
        engine={engine}
        status={liveStatus}
        hasGeminiKey={Boolean(geminiKey)}
        hasOpenAIKey={Boolean(openAIKey)}
        streak={streak}
        masteredCount={masteredCount}
        currentView={viewMode}
        isGeneratingAIWord={isGeneratingAIWord}
        onToggleView={handleToggleView}
        onOpenKeys={() => setIsKeyModalOpen(true)}
        onOpenCustomWord={() => setIsCustomWordModalOpen(true)}
        onRandomWord={() => rollRandomWord()}
      />

      <AnimatePresence mode="wait" initial={false}>
        {viewMode === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onAnimationStart={forceScrollToTop}
            onAnimationComplete={forceScrollToTop}
            className="w-full flex-1 flex flex-col"
          >
            <ScrollToTopOnMount />
            <div id="overview" className="scroll-mt-20" />
            <LandingPage
              onLaunchStudio={handleLaunchStudio}
              hasOpenAIKey={Boolean(openAIKey)}
              hasGeminiKey={Boolean(geminiKey)}
              openAIKey={openAIKey}
              geminiKey={geminiKey}
              openAIVoice={openAIVoice}
              onOpenKeyModal={() => setIsKeyModalOpen(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="studio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onAnimationStart={forceScrollToTop}
            onAnimationComplete={forceScrollToTop}
            className="w-full flex-1 flex flex-col"
          >
            <ScrollToTopOnMount />
            {/* Main Studio Viewport: Mobile-Responsive Layout */}
            <main id="studio" className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 scroll-mt-20">
              
              {/* Studio Navigation Breadcrumb */}
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200/80">
                <button
                  onClick={() => handleToggleView('landing')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-[#0A0A0A] text-xs font-mono font-semibold border border-neutral-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <ArrowLeft size={14} weight="bold" />
                  <span>Overview Showcase</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="hidden sm:inline">Studio Active: <strong>{currentLanguage.name}</strong></span>
                </div>
              </div>

              {/* Language Selector & Difficulty Filter */}
              <LanguageSelector
                selectedLanguageId={selectedLanguageId}
                selectedDifficulty={selectedDifficulty}
                onSelectLanguage={(id) => {
                  setSelectedLanguageId(id);
                  rollRandomWord(id, selectedDifficulty);
                }}
                onSelectDifficulty={(diff) => {
                  setSelectedDifficulty(diff);
                  rollRandomWord(selectedLanguageId, diff);
                }}
                onRandomFromAny={() => {
                  setSelectedLanguageId('all');
                  rollRandomWord('all', selectedDifficulty);
                }}
              />

              {/* Studio Grid: 1 col on mobile, 12-col split on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                
                {/* Left Column (7 cols): The Hero Word, Syllables, Audio Mechanics, Cultural Lore */}
                <div className="lg:col-span-7 space-y-5">
                  <WordHero
                    word={currentWord}
                    language={currentLanguage}
                    engine={engine}
                    liveStatus={liveStatus}
                    isPlayingAudio={isPlayingAudio}
                    isTestingVoice={isTestingVoice}
                    hasLLMVoice={Boolean(openAIKey)}
                    isGeneratingAIWord={isGeneratingAIWord}
                    onPlayNative={handlePlayNative}
                    onPlaySlow={handlePlaySlow}
                    onPlaySyllable={handlePlaySyllable}
                    onTestVoice={handleTestVoice}
                    onAskCoachAboutWord={() => {
                      sendPromptToLiveCoach(`Explain the authentic pronunciation of "${currentWord.word}" and guide me through the tricky sounds.`);
                    }}
                    onNextWord={() => rollRandomWord()}
                  />
                </div>

                {/* Right Column (5 cols): Real-time Live Voice Panel & Waveform Visualizer */}
                <div className="lg:col-span-5">
                  <div className="lg:sticky lg:top-24">
                    <LiveCoachPanel
                      engine={engine}
                      status={liveStatus}
                      audioLevel={audioLevel}
                      transcripts={transcripts}
                      selectedLanguage={currentLanguage}
                      currentWord={currentWord}
                      hasKey={engine === 'gemini' ? Boolean(geminiKey) : engine === 'openai' ? Boolean(openAIKey) : true}
                      coachingLanguage={coachingLanguage}
                      geminiModel={geminiModel}
                      onSelectCoachingLanguage={(langId) => {
                        setCoachingLanguage(langId);
                        localStorage.setItem('coaching_language', langId);
                        if (liveStatus === 'connected' || liveStatus === 'listening') {
                          const langObj = COACHING_LANGUAGES.find(c => c.id === langId);
                          sendPromptToLiveCoach(`Please switch your explanations and coaching conversation language to ${langObj?.name || langId}.`);
                        }
                      }}
                      onToggleEngine={handleToggleEngine}
                      onToggleLiveConnection={handleToggleLive}
                      onSendQuickPrompt={sendPromptToLiveCoach}
                      onOpenKeyModal={() => setIsKeyModalOpen(true)}
                    />
                  </div>
                </div>

              </div>

            </main>

            {/* Studio Footer */}
            <footer className="w-full border-t border-neutral-200/80 py-5 px-4 text-center text-xs text-neutral-500 font-mono">
              <p>phonica / Polyglot Voice and Phonetics Studio</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        geminiKey={geminiKey}
        openAIKey={openAIKey}
        geminiVoice={geminiVoice}
        openAIVoice={openAIVoice}
        geminiModel={geminiModel}
        onSaveKeys={handleSaveKeys}
        onClose={() => setIsKeyModalOpen(false)}
      />

      <CustomWordModal
        isOpen={isCustomWordModalOpen}
        onClose={() => setIsCustomWordModalOpen(false)}
        onAddCustomWord={handleAddCustomWord}
      />

      <ErrorBoundary
        fallbackTitle="Pronunciation Analysis Notice"
        fallbackMessage="Could not display score modal details for this attempt."
        onReset={() => {
          LLMAudioService.stop();
          SpeechService.stopSpeaking();
          setIsScoreModalOpen(false);
        }}
      >
        <ScoreModal
          isOpen={isScoreModalOpen}
          scoreData={scoreData}
          word={currentWord}
          language={currentLanguage}
          isPlayingAdvice={isPlayingAdvice}
          onPlayAdvice={() => {
            if (scoreData) {
              playFeedbackAudio(scoreData);
            }
          }}
          onClose={() => {
            LLMAudioService.stop();
            SpeechService.stopSpeaking();
            setIsScoreModalOpen(false);
          }}
          onRetry={() => {
            LLMAudioService.stop();
            SpeechService.stopSpeaking();
            setIsScoreModalOpen(false);
            handleTestVoice();
          }}
          onNextWord={() => {
            LLMAudioService.stop();
            SpeechService.stopSpeaking();
            setIsScoreModalOpen(false);
            rollRandomWord();
          }}
          onHearNative={handlePlayNative}
        />
      </ErrorBoundary>

    </div>
  );
};

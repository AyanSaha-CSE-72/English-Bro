"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROFX_TOPICS } from "@/lib/profx-topics";
import { generateProfXReply, type ChatTurn } from "@/lib/profx-engine";
import { VOICE_PROFILES, getVoiceProfile, type VoiceProfileId } from "@/lib/voice-profiles";
import { speakHuman } from "@/lib/human-speech";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  correction: string | null;
}

interface ReportData {
  conversationTitle: string;
  totalUserMessages: number;
  totalCorrections: number;
  fluencyScore: number;
  scoreLabel: string;
  feedback: string;
  avgWordsPerTurn: number;
  durationSeconds: number;
  corrections: { id: string; correction: string | null; order: number }[];
}

const VOICE_STORAGE_KEY = "profx.voiceProfile";
const SILENCE_MS = 1400;

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ProfXChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liveMode, setLiveMode] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [voiceProfileId, setVoiceProfileId] = useState<VoiceProfileId>("female");
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const voiceProfileRef = useRef<VoiceProfileId>("female");
  const stopSpeakingRef = useRef<() => void>(() => {});
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const liveModeRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);
  useEffect(() => {
    assistantSpeakingRef.current = assistantSpeaking;
  }, [assistantSpeaking]);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    voiceProfileRef.current = voiceProfileId;
  }, [voiceProfileId]);

  // Load the saved voice preference once on mount.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(VOICE_STORAGE_KEY) : null;
    if (saved && VOICE_PROFILES.some((p) => p.id === saved)) {
      setVoiceProfileId(saved as VoiceProfileId);
    }
  }, []);

  function selectVoiceProfile(id: VoiceProfileId) {
    setVoiceProfileId(id);
    voiceProfileRef.current = id;
    setShowVoiceMenu(false);
    if (typeof window !== "undefined") window.localStorage.setItem(VOICE_STORAGE_KEY, id);
    // Give an immediate audible preview of the newly selected voice.
    speak("Hi there! This is how I sound now.");
  }

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function stopRecognitionQuietly() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }

  function startRecognitionQuietly() {
    try {
      recognitionRef.current?.start();
      setIsRecording(true);
    } catch {
      // Already started or blocked — safe to ignore.
    }
  }

  // Setup speech recognition once, client-side only.
  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      const combined = (finalText || interimText).trim();
      transcriptRef.current = combined;
      setInput(combined);

      if (liveModeRef.current) {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          const text = transcriptRef.current.trim();
          if (text && !sendingRef.current) {
            sendingRef.current = true;
            stopRecognitionQuietly();
            setIsRecording(false);
            sendMessageRef.current(text);
          }
        }, SILENCE_MS);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // In live mode, browsers sometimes stop recognition on their own during
      // pauses; auto-restart it as long as we're not mid-send or mid-speech.
      if (liveModeRef.current && !assistantSpeakingRef.current && !sendingRef.current) {
        setTimeout(() => {
          if (liveModeRef.current && !assistantSpeakingRef.current && !sendingRef.current) {
            transcriptRef.current = "";
            setInput("");
            startRecognitionQuietly();
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  // Some browsers (notably Chrome) load their voice list asynchronously.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
  }, []);

  function speak(text: string, onDone?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onDone?.();
      return;
    }
    stopSpeakingRef.current?.();
    const profile = getVoiceProfile(voiceProfileRef.current);
    stopSpeakingRef.current = speakHuman({ text, profile, onDone });
  }

  function stopSpeaking() {
    stopSpeakingRef.current?.();
  }

  function toggleRecording() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      transcriptRef.current = "";
      setInput("");
      try {
        recognition.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  }

  async function sendMessage(text: string, topicOverride?: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      sendingRef.current = false;
      return;
    }

    const topicToSend = topicOverride || activeTopic;

    const optimisticUser: Message = { id: newId(), role: "user", content: trimmed, correction: null };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    transcriptRef.current = "";
    setLoading(true);
    setError(null);

    try {
      const history: ChatTurn[] = [...messages, optimisticUser].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { reply, correction } = await generateProfXReply(trimmed, history, topicToSend as any);
      const assistantMessage: Message = {
        id: newId(),
        role: "assistant",
        content: reply,
        correction,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (autoSpeak || liveModeRef.current) {
        setAssistantSpeaking(true);
        speak(assistantMessage.content, () => {
          setAssistantSpeaking(false);
          sendingRef.current = false;
          if (liveModeRef.current) {
            transcriptRef.current = "";
            setInput("");
            startRecognitionQuietly();
          }
        });
      } else {
        sendingRef.current = false;
      }
    } catch {
      setError("English BRo couldn't respond just now. Please try again.");
      sendingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  function toggleLiveMode() {
    if (liveMode) {
      // Turning live mode off.
      setLiveMode(false);
      liveModeRef.current = false;
      clearSilenceTimer();
      stopSpeaking();
      stopRecognitionQuietly();
      setIsRecording(false);
      setAssistantSpeaking(false);
      sendingRef.current = false;
    } else {
      if (!speechSupported) {
        setError("Live voice mode needs a browser that supports speech recognition (try Chrome).");
        return;
      }
      setAutoSpeak(true);
      setLiveMode(true);
      liveModeRef.current = true;
      sendingRef.current = false;
      transcriptRef.current = "";
      setInput("");
      startRecognitionQuietly();
    }
  }

  async function startNewConversation() {
    setMessages([]);
    setError(null);
    setShowReport(false);
    setReport(null);
    setActiveTopic(null);
    if (liveMode) toggleLiveMode();
    stopSpeaking();
  }

  async function openReport() {
    setReportLoading(true);
    setShowReport(true);
    try {
      const userMessages = messages.filter((m) => m.role === "user");
      const correctionMessages = messages.filter((m) => m.role === "assistant" && m.correction);
      const totalUserMessages = userMessages.length;
      const totalCorrections = correctionMessages.length;
      const correctionRate = totalUserMessages > 0 ? totalCorrections / totalUserMessages : 0;
      const rawScore = 10 - correctionRate * 10;
      const fluencyScore = Math.max(1, Math.min(10, Math.round(rawScore)));
      const avgWordsPerTurn =
        totalUserMessages > 0
          ? Math.round(
              (userMessages.reduce((sum, m) => sum + m.content.trim().split(/\s+/).filter(Boolean).length, 0) /
                totalUserMessages) *
                10
            ) / 10
          : 0;
      const durationSeconds = Math.max(0, Math.round(messages.length * 4));
      const reportLabel = scoreLabel(fluencyScore);

      setReport({
        conversationTitle: "Current conversation",
        totalUserMessages,
        totalCorrections,
        fluencyScore,
        scoreLabel: reportLabel.label,
        feedback: reportLabel.feedback,
        avgWordsPerTurn,
        durationSeconds,
        corrections: correctionMessages
          .map((m, index) => ({ id: m.id, correction: m.correction, order: index }))
          .filter((item) => item.correction !== null),
      });
    } catch {
      setError("Couldn't generate your speaking report right now.");
      setShowReport(false);
    } finally {
      setReportLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const conversationStatus = assistantSpeaking
    ? "English BRo is speaking…"
    : isRecording
    ? "Listening…"
    : liveMode
    ? "Live mode ready"
    : null;

  function scoreLabel(score: number): { label: string; feedback: string } {
    if (score >= 9) {
      return {
        label: "Excellent",
        feedback: "Your spoken English is fluent and clean — you're speaking with real confidence!",
      };
    }
    if (score >= 7) {
      return {
        label: "Strong",
        feedback: "You're doing great! Just a few small slips to iron out and you'll sound even more natural.",
      };
    }
    if (score >= 5) {
      return {
        label: "Good progress",
        feedback: "Solid effort — keep practicing the corrections below and you'll level up quickly.",
      };
    }
    return {
      label: "Keep practicing",
      feedback: "You're building a great habit by speaking often. Review the tips below and try again soon!",
    };
  }

  function renderCorrectionTip(correctionStr: string) {
    let struct: { original: string; corrected: string; explanation: string } | null = null;
    try {
      struct = JSON.parse(correctionStr);
    } catch {
      // Graceful fallback for old format / simple strings
      struct = {
        original: "",
        corrected: correctionStr,
        explanation: "Keep practice going to sound completely natural!",
      };
    }

    if (!struct) return null;

    return (
      <div className="mt-4 rounded-3xl border-l-[6px] border-rose-500 border border-rose-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-3.5">
          GENTLE TIP
        </h4>
        
        {/* Wrong/Original capsule */}
        {struct.original && (
          <div className="mb-2.5 flex items-center gap-2.5 rounded-full bg-rose-50/70 px-4 py-2.5 text-rose-800 text-xs sm:text-sm font-medium">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-200 text-[10px] font-bold text-rose-700">
              ✕
            </span>
            <span className="line-through text-rose-700/80 break-words">
              {struct.original}
            </span>
          </div>
        )}

        {/* Corrected/Better capsule */}
        <div className="flex items-center gap-2.5 rounded-full bg-emerald-50/70 px-4 py-2.5 text-emerald-800 text-xs sm:text-sm font-semibold">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-[10px] font-bold text-emerald-700">
            ✓
          </span>
          <span className="text-emerald-900 break-words">
            {struct.corrected}
          </span>
        </div>

        {/* Explanatory text */}
        {struct.explanation && (
          <p className="mt-3.5 text-xs sm:text-sm text-slate-500 leading-relaxed pl-1">
            {struct.explanation}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/30">
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl shadow-sm ring-2 ring-slate-100">
              <img src="/images/profx-avatar.png" alt="English BRo" className="h-full w-full object-cover" />
              {(isRecording || assistantSpeaking) && (
                <span
                  className={`absolute inset-0 animate-ping rounded-2xl ${
                    assistantSpeaking ? "bg-teal-400/40" : "bg-rose-400/40"
                  }`}
                />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">English BRo</h1>
              <p className="text-xs font-medium text-slate-500">
                {conversationStatus ?? (activeTopic ? `Topic: ${PROFX_TOPICS.find((t) => t.id === activeTopic)?.title || activeTopic}` : "Your AI English Speaking Partner")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowVoiceMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                title="Choose English BRo's voice"
              >
                {getVoiceProfile(voiceProfileId).emoji} {getVoiceProfile(voiceProfileId).label}
                <span className="text-[9px]">▾</span>
              </button>
              {showVoiceMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowVoiceMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Choose English BRo's Voice
                    </p>
                    {VOICE_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectVoiceProfile(p.id)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 ${
                          voiceProfileId === p.id ? "bg-violet-50" : ""
                        }`}
                      >
                        <span className="text-lg">{p.emoji}</span>
                        <span className="flex-1">
                          <span className="block text-xs font-semibold text-slate-800">{p.label}</span>
                          <span className="block text-[10px] text-slate-500">{p.description}</span>
                        </span>
                        {voiceProfileId === p.id && <span className="text-violet-600">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={openReport}
              className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              title="Get your speaking test report"
            >
              📊 Report
            </button>
            <button
              onClick={() => setAutoSpeak((v) => !v)}
              disabled={liveMode}
              className={`hidden rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:inline-flex disabled:opacity-50 ${
                autoSpeak ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
              title="Toggle auto voice reply"
            >
              {autoSpeak ? "🔊 Voice On" : "🔇 Voice Off"}
            </button>
            <button
              onClick={startNewConversation}
              className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              + New Chat
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        {speechSupported && (
          <div
            className={`mb-5 flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
              liveMode ? "border-teal-300 bg-teal-50" : "border-slate-100 bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">
                🎙️ Live Speaking Test {liveMode && <span className="text-teal-600">— active</span>}
              </p>
              <p className="text-xs text-slate-500">
                {liveMode
                  ? "Just talk naturally — English BRo listens, replies, and resumes automatically."
                  : "Hands-free mode: have a real spoken conversation with English BRo, mic on the whole time."}
              </p>
            </div>
            <button
              onClick={toggleLiveMode}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white transition ${
                liveMode ? "bg-rose-500 hover:bg-rose-600" : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              {liveMode ? "⏹ Stop Live" : "▶ Start Live"}
            </button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-24 pr-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {messages.length === 0 && (
            <div className="mt-2 rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-2xl">👋</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-800">Say hi to English BRo!</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pick a topic below, or just start speaking/typing — I'll chat with you and gently polish your grammar
                along the way.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {PROFX_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTopic(t.id);
                      sendMessage(t.starter, t.id);
                    }}
                    className="rounded-2xl border border-teal-100 bg-teal-50/50 p-3.5 text-left transition hover:bg-teal-50"
                  >
                    <p className="text-sm font-semibold text-teal-800">
                      {t.emoji} {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-teal-700/80">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[85%] flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                
                {/* Optional Title above Assistant bubble to match image */}
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                    <span className="text-emerald-600 text-xs">✨</span>
                    <span className="text-xs font-bold text-slate-700">English BRo</span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed ${
                    m.role === "user"
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tr-sm shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                      : "bg-[#F7F5F0] text-slate-800 rounded-tl-sm shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                  }`}
                >
                  {m.content}
                </div>

                {m.role === "assistant" && (
                  <div className="flex flex-col items-start w-full">
                    {/* Speaker/Replay button below text */}
                    <button
                      onClick={() => speak(m.content)}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 transition pl-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      </svg>
                      Replay voice
                    </button>

                    {/* Highly requested "GENTLE TIP" block */}
                    {m.correction && renderCorrectionTip(m.correction)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start gap-2">
              <div className="relative mt-1 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
                <img src="/images/profx-avatar.png" alt="English BRo" className="h-full w-full object-cover" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-[#F7F5F0] px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:0.15s]">•</span>
                  <span className="animate-bounce [animation-delay:0.3s]">•</span>
                </span>{" "}
                English BRo is typing…
              </div>
            </div>
          )}

          {error && <p className="text-center text-xs font-medium text-rose-500">{error}</p>}
        </div>

        {/* Large green floating-style circular microphone button & input form */}
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pb-6 pt-10 px-4">
          <div className="mx-auto max-w-2xl flex flex-col items-center gap-3">
            
            {/* The circular floating mic button as featured in the image */}
            {speechSupported && !liveMode && (
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95 ${
                  isRecording ? "animate-pulse bg-rose-500" : "bg-[#1E543B] hover:bg-[#153B25]"
                }`}
                title={isRecording ? "Stop recording" : "Hold or tap to speak"}
              >
                {isRecording ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="4"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                )}
              </button>
            )}

            <form onSubmit={handleSubmit} className="w-full flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                disabled={liveMode}
                placeholder={liveMode ? "Live speaking test is running…" : isRecording ? "Listening to your voice…" : "Type or reply to English BRo here…"}
                rows={1}
                className="max-h-24 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || liveMode}
                className="flex h-10 shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </form>

            <p className="text-[11px] font-medium tracking-wide text-slate-400">
              Made by Ayan Saha
            </p>
          </div>
        </div>
      </main>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-900">📊 Speaking Test Report</h3>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {reportLoading && <p className="mt-6 animate-pulse text-sm text-slate-400">Analyzing your conversation…</p>}

            {!reportLoading && report && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-teal-600 text-xl font-bold text-white">
                    {report.fluencyScore}/10
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{report.scoreLabel}</p>
                    <p className="text-xs text-slate-500">{report.feedback}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-base font-bold text-slate-800">{report.totalUserMessages}</p>
                    <p className="text-[10px] text-slate-500">Your turns</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-base font-bold text-slate-800">{report.totalCorrections}</p>
                    <p className="text-[10px] text-slate-500">Corrections</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-base font-bold text-slate-800">{formatDuration(report.durationSeconds)}</p>
                    <p className="text-[10px] text-slate-500">Duration</p>
                  </div>
                </div>

                {report.corrections.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tips from this session</p>
                    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {report.corrections.map((c) => {
                        let textToRender = c.correction || "";
                        try {
                          const parsed = JSON.parse(textToRender);
                          textToRender = parsed.corrected;
                        } catch {
                          // ignore
                        }
                        return (
                          <li key={c.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            ✅ {textToRender}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setShowReport(false)}
                  className="w-full rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Keep Practicing
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

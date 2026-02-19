import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Download, Loader2, RotateCcw,
  Bookmark, BookmarkCheck, Mic, MicOff, GraduationCap, Headphones,
  Settings2, ChevronDown, ChevronUp, Zap, Heart, Brain, Star
} from "lucide-react";
import { AudiobookEntry } from "@/lib/audiobookStore";

interface AudioPlayerProps {
  book: AudiobookEntry;
  onClose?: () => void;
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "ended";
type PlayMode = "narration" | "education";
type EmotionTone = "neutral" | "excited" | "calm" | "dramatic";

interface Bookmark {
  id: string;
  label: string;
  elapsed: number;
  charIndex: number;
}

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
  lang: string;
}

const EMOTION_CONFIG: Record<EmotionTone, { pitch: number; rate_mod: number; label: string; icon: typeof Heart; color: string }> = {
  neutral:  { pitch: 1.0, rate_mod: 1.0,  label: "Neutral",  icon: Brain,    color: "text-muted-foreground" },
  calm:     { pitch: 0.9, rate_mod: 0.85, label: "Calm",     icon: Heart,    color: "text-blue-500" },
  excited:  { pitch: 1.2, rate_mod: 1.1,  label: "Excited",  icon: Zap,      color: "text-yellow-500" },
  dramatic: { pitch: 0.8, rate_mod: 0.9,  label: "Dramatic", icon: Star,     color: "text-purple-500" },
};

const RATE_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function getSmartTone(text: string): EmotionTone {
  const lower = text.toLowerCase();
  const excitedWords = ["amazing", "incredible", "wow", "fantastic", "urgent", "important", "exciting", "!" ];
  const calmWords    = ["peaceful", "gentle", "soft", "slowly", "quiet", "calm", "rest", "meditation"];
  const dramaticWords= ["suddenly", "danger", "critical", "warning", "crisis", "shock", "disaster"];
  if (dramaticWords.some(w => lower.includes(w))) return "dramatic";
  if (excitedWords.some(w => lower.includes(w))) return "excited";
  if (calmWords.some(w => lower.includes(w))) return "calm";
  return "neutral";
}

function getLangCode(lang: string): string {
  const map: Record<string, string> = {
    en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT",
    pt: "pt-PT", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ar: "ar-SA",
    hi: "hi-IN", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR",
  };
  return map[lang] || "en-US";
}

function chunkText(t: string, maxLen = 200): string[] {
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += " " + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [t];
}

function addEducationGloss(chunk: string): string {
  // Insert brief reading pauses and emphasis markers by adding commas after clauses
  return chunk.replace(/([a-z]{4,}[,;])\s/gi, "$1... ").substring(0, 300);
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// ─── Bookmark storage ────────────────────────────────────────────────────────
function loadBookmarks(bookId: string): Bookmark[] {
  try { return JSON.parse(localStorage.getItem(`bm_${bookId}`) || "[]"); }
  catch { return []; }
}
function saveBookmarks(bookId: string, bms: Bookmark[]) {
  localStorage.setItem(`bm_${bookId}`, JSON.stringify(bms));
}

// ─── Progress storage ─────────────────────────────────────────────────────────
function loadProgress(bookId: string): number {
  return parseFloat(localStorage.getItem(`prog_${bookId}`) || "0");
}
function saveProgress(bookId: string, secs: number) {
  localStorage.setItem(`prog_${bookId}`, String(secs));
}

export default function AudioPlayer({ book }: AudioPlayerProps) {
  const [state, setState]           = useState<PlayState>("idle");
  const [progress, setProgress]     = useState(0);
  const [rate, setRate]             = useState(1);
  const [volume, setVolume]         = useState(1);
  const [muted, setMuted]           = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [total, setTotal]           = useState(0);
  const [mode, setMode]             = useState<PlayMode>("narration");
  const [emotion, setEmotion]       = useState<EmotionTone>("neutral");
  const [autoEmotion, setAutoEmotion] = useState(true);
  const [bookmarks, setBookmarks]   = useState<Bookmark[]>(() => loadBookmarks(book.id));
  const [showBm, setShowBm]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices]         = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voiceCmdActive, setVoiceCmdActive] = useState(false);
  const [voiceCmdStatus, setVoiceCmdStatus] = useState("");
  const [currentChunkText, setCurrentChunkText] = useState("");

  const utterRef      = useRef<SpeechSynthesisUtterance | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef  = useRef(0);
  const pausedAtRef   = useRef(loadProgress(book.id));
  const chunkIndexRef = useRef(0);
  const textChunks    = useRef<string[]>([]);
  const recognitionRef= useRef<any>(null);

  const text = book.translatedText || book.originalText;
  const words = text.split(/\s+/).filter(Boolean);
  const estimatedSeconds = Math.ceil((words.length / 150) * 60);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const langCode = getLangCode(book.language);
      const all = window.speechSynthesis.getVoices();
      const matched = all
        .filter(v => v.lang.startsWith(langCode.split("-")[0]))
        .map(v => ({ voice: v, label: v.name, lang: v.lang }));
      const fallback = all.slice(0, 5).map(v => ({ voice: v, label: v.name, lang: v.lang }));
      const opts = matched.length ? matched : fallback;
      setVoices(opts);
      if (opts.length && !selectedVoice) setSelectedVoice(opts[0].voice);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    setTotal(estimatedSeconds);
    return () => {
      window.speechSynthesis.cancel();
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopVoiceCommands();
    };
  }, [estimatedSeconds, book.language]);

  // Persist progress
  useEffect(() => {
    if (elapsed > 0) saveProgress(book.id, elapsed);
  }, [elapsed, book.id]);

  // ─── Timer ───────────────────────────────────────────────────────────────
  function startTimer() {
    startTimeRef.current = Date.now() - pausedAtRef.current * 1000;
    intervalRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(Math.min(el, estimatedSeconds));
      setProgress(Math.min((el / estimatedSeconds) * 100, 100));
      if (el >= estimatedSeconds && intervalRef.current) clearInterval(intervalRef.current);
    }, 500);
  }

  function stopTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    pausedAtRef.current = elapsed;
  }

  // ─── Speak ───────────────────────────────────────────────────────────────
  function speakChunk(index: number) {
    if (index >= textChunks.current.length) { setState("ended"); stopTimer(); return; }

    let rawChunk = textChunks.current[index];
    if (mode === "education") rawChunk = addEducationGloss(rawChunk);

    setCurrentChunkText(rawChunk);

    // Auto emotion detection
    const tone = autoEmotion ? getSmartTone(rawChunk) : emotion;
    const cfg  = EMOTION_CONFIG[tone];
    if (autoEmotion) setEmotion(tone);

    const utter = new SpeechSynthesisUtterance(rawChunk);
    utter.lang   = getLangCode(book.language);
    utter.rate   = rate * cfg.rate_mod;
    utter.pitch  = cfg.pitch;
    utter.volume = muted ? 0 : volume;
    if (selectedVoice) utter.voice = selectedVoice;

    utter.onend  = () => { chunkIndexRef.current = index + 1; speakChunk(index + 1); };
    utter.onerror = () => setState("idle");
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  // ─── Controls ────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (state === "idle" || state === "ended") {
      window.speechSynthesis.cancel();
      textChunks.current = chunkText(text);
      chunkIndexRef.current = 0;
      pausedAtRef.current   = 0;
      setElapsed(0); setProgress(0);
      setState("loading");
      setTimeout(() => { setState("playing"); startTimer(); speakChunk(0); }, 300);
    } else if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing"); startTimer();
    } else if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused"); stopTimer();
    }
  }, [state, text, rate, volume, muted, mode, emotion, autoEmotion, selectedVoice]);

  const handleStop = () => {
    window.speechSynthesis.cancel(); setState("idle"); stopTimer();
    setElapsed(0); setProgress(0); pausedAtRef.current = 0;
  };

  const handleRepeat = () => {
    if (chunkIndexRef.current > 0) chunkIndexRef.current--;
    window.speechSynthesis.cancel();
    setState("playing");
    speakChunk(chunkIndexRef.current);
  };

  const handleRate = (r: number) => {
    setRate(r);
    if (state === "playing") {
      window.speechSynthesis.cancel();
      const rest = textChunks.current.slice(chunkIndexRef.current).join(" ");
      const utter = new SpeechSynthesisUtterance(rest);
      utter.lang   = getLangCode(book.language);
      utter.rate   = r * EMOTION_CONFIG[emotion].rate_mod;
      utter.pitch  = EMOTION_CONFIG[emotion].pitch;
      utter.volume = muted ? 0 : volume;
      if (selectedVoice) utter.voice = selectedVoice;
      utter.onend = () => setState("ended");
      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${book.title}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Bookmarks ───────────────────────────────────────────────────────────
  const addBookmark = () => {
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      label: `${fmt(elapsed)} — ${currentChunkText.substring(0, 40)}…`,
      elapsed, charIndex: chunkIndexRef.current,
    };
    const updated = [...bookmarks, bm];
    setBookmarks(updated); saveBookmarks(book.id, updated);
  };

  const removeBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated); saveBookmarks(book.id, updated);
  };

  const jumpToBookmark = (bm: Bookmark) => {
    window.speechSynthesis.cancel();
    chunkIndexRef.current = bm.charIndex;
    pausedAtRef.current   = bm.elapsed;
    setElapsed(bm.elapsed);
    setProgress((bm.elapsed / estimatedSeconds) * 100);
    if (state === "playing") speakChunk(bm.charIndex);
  };

  // ─── Voice Commands ───────────────────────────────────────────────────────
  function startVoiceCommands() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceCmdStatus("Not supported in this browser"); return; }
    const r = new SpeechRecognition();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e: any) => {
      const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      setVoiceCmdStatus(`Heard: "${transcript}"`);
      if (transcript.includes("start") || transcript.includes("play"))   handlePlay();
      else if (transcript.includes("stop") || transcript.includes("pause")) handlePlay();
      else if (transcript.includes("repeat"))                             handleRepeat();
      else if (transcript.includes("faster"))                             handleRate(Math.min(rate + 0.25, 2));
      else if (transcript.includes("slower"))                             handleRate(Math.max(rate - 0.25, 0.75));
      else if (transcript.includes("bookmark"))                           addBookmark();
    };
    r.onerror = () => setVoiceCmdStatus("Voice error — try again");
    r.start();
    recognitionRef.current = r;
    setVoiceCmdActive(true);
    setVoiceCmdStatus('Listening… say "play", "pause", "repeat", "bookmark", "faster", "slower"');
  }

  function stopVoiceCommands() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setVoiceCmdActive(false);
    setVoiceCmdStatus("");
  }

  const toggleVoiceCmd = () => voiceCmdActive ? stopVoiceCommands() : startVoiceCommands();

  // ─── Derived ─────────────────────────────────────────────────────────────
  const EmotionIcon = EMOTION_CONFIG[emotion].icon;
  const progressSaved = loadProgress(book.id);
  const hasResumePoint = progressSaved > 5 && state === "idle";

  const emotionColorMap: Record<EmotionTone, string> = {
    neutral:  "text-muted-foreground",
    calm:     "text-accent-foreground",
    excited:  "text-warning",
    dramatic: "text-secondary-foreground",
  };

  return (
    <div className="space-y-3">
      {/* Header row: status + mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
            state === "playing" ? "bg-primary/10 text-primary" :
            state === "paused"  ? "bg-yellow-100 text-yellow-700" :
            state === "ended"   ? "bg-green-100 text-green-700" :
            "bg-muted text-muted-foreground"
          }`}>
            {state === "loading" ? <><Loader2 className="w-3 h-3 animate-spin"/>Loading</> :
             state === "playing" ? <><div className="w-2 h-2 bg-primary rounded-full animate-pulse"/>Playing</> :
             state === "paused"  ? "Paused" :
             state === "ended"   ? "✓ Done" : "Ready"}
          </span>

          {/* Emotion indicator */}
          <span className={`text-xs flex items-center gap-1 ${EMOTION_CONFIG[emotion].color}`}>
            <EmotionIcon className="w-3 h-3" />
            {EMOTION_CONFIG[emotion].label}
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setMode("narration")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              mode === "narration" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Headphones className="w-3 h-3" /> Narrate
          </button>
          <button
            onClick={() => setMode("education")}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              mode === "education" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-3 h-3" /> Edu
          </button>
        </div>
      </div>

      {/* Resume banner */}
      {hasResumePoint && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs text-primary font-medium">Resume from {fmt(progressSaved)}?</p>
          <button
            onClick={() => {
              pausedAtRef.current = progressSaved;
              setElapsed(progressSaved);
              setProgress((progressSaved / estimatedSeconds) * 100);
              handlePlay();
            }}
            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg font-semibold"
          >Resume</button>
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="relative h-2 bg-border rounded-full overflow-hidden cursor-pointer">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
          {/* Bookmark markers */}
          {bookmarks.map(bm => (
            <div
              key={bm.id}
              className="absolute top-0 h-full w-0.5 bg-warning"
              style={{ left: `${(bm.elapsed / estimatedSeconds) * 100}%` }}
              title={bm.label}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{fmt(elapsed)}</span>
          <span className="text-xs text-muted-foreground/70">
            {mode === "education" ? "🎓 Education Mode" : `${Math.round(progress)}%`}
          </span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-between">
        {/* Left: stop / play / repeat */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStop}
            disabled={state === "idle"}
            title="Stop & reset"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePlay}
            className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            {state === "loading" ? <Loader2 className="w-5 h-5 animate-spin" /> :
             state === "playing" ? <Pause className="w-5 h-5" /> :
             <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={handleRepeat}
            disabled={state === "idle"}
            title="Repeat current sentence"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Centre: speed buttons */}
        <div className="flex gap-0.5">
          {RATE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${
                rate === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >{r}x</button>
          ))}
        </div>

        {/* Right: volume + bookmark + download + settings */}
        <div className="flex items-center gap-1">
          <button onClick={() => setMuted(!muted)} title="Mute"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={addBookmark} disabled={state !== "playing"} title="Add bookmark"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-warning hover:bg-warning/10 disabled:opacity-40 transition-all">
            {bookmarks.length > 0 ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleDownload} title="Download text"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowSettings(s => !s)} title="Settings"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}>
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-muted/60 rounded-xl p-4 space-y-3 animate-fade-up border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playback Settings</p>

          {/* Voice selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Voice</label>
            <select
              className="input-field text-xs py-2"
              value={selectedVoice?.name || ""}
              onChange={e => {
                const found = voices.find(v => v.voice.name === e.target.value);
                if (found) setSelectedVoice(found.voice);
              }}
            >
              {voices.length === 0 && <option value="">Default</option>}
              {voices.map(v => (
                <option key={v.voice.name} value={v.voice.name}>{v.label} ({v.lang})</option>
              ))}
            </select>
          </div>

          {/* Volume slider */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Volume: {Math.round(volume * 100)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-full accent-primary" />
          </div>

          {/* Emotion tone */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Emotion Tone</label>
              <button onClick={() => setAutoEmotion(a => !a)}
                className={`text-xs px-2 py-0.5 rounded-full transition-all ${autoEmotion ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {autoEmotion ? "Auto" : "Manual"}
              </button>
            </div>
            {!autoEmotion && (
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(EMOTION_CONFIG) as EmotionTone[]).map(t => {
                  const cfg = EMOTION_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button key={t} onClick={() => setEmotion(t)}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        emotion === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Voice commands */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Voice Commands</p>
              <p className="text-xs text-muted-foreground">Say "play", "pause", "repeat"…</p>
            </div>
            <button onClick={toggleVoiceCmd}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                voiceCmdActive ? "bg-primary text-primary-foreground animate-pulse-soft" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}>
              {voiceCmdActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>
          {voiceCmdStatus && (
            <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2">{voiceCmdStatus}</p>
          )}
        </div>
      )}

      {/* Bookmarks panel */}
      {bookmarks.length > 0 && (
        <div>
          <button onClick={() => setShowBm(s => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
            <Bookmark className="w-3.5 h-3.5 text-warning" />
            <span className="font-medium">{bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}</span>
            {showBm ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>

          {showBm && (
            <div className="mt-2 space-y-1 animate-fade-up">
              {bookmarks.map(bm => (
                <div key={bm.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-all group">
                  <span className="text-xs font-mono text-primary shrink-0">{fmt(bm.elapsed)}</span>
                  <p className="text-xs text-foreground flex-1 truncate">{bm.label}</p>
                  <button onClick={() => jumpToBookmark(bm)}
                    className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium hover:underline shrink-0">Jump</button>
                  <button onClick={() => removeBookmark(bm.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Currently narrating */}
      {state === "playing" && currentChunkText && (
        <div className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 animate-fade-up">
          <p className="text-xs text-muted-foreground mb-0.5">Now narrating</p>
          <p className="text-xs text-foreground leading-relaxed line-clamp-2">{currentChunkText}</p>
        </div>
      )}
    </div>
  );
}

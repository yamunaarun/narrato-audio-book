import { useState, useRef, useEffect } from "react";
import {
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward,
  Download, Loader2, RotateCcw
} from "lucide-react";
import { AudiobookEntry } from "@/lib/audiobookStore";

interface AudioPlayerProps {
  book: AudiobookEntry;
  onClose?: () => void;
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "ended";

export default function AudioPlayer({ book, onClose }: AudioPlayerProps) {
  const [state, setState] = useState<PlayState>("idle");
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const charIndexRef = useRef(0);
  const textChunks = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);

  const text = book.translatedText || book.originalText;
  const words = text.split(/\s+/).filter(Boolean);
  const avgWPM = 150;
  const estimatedSeconds = Math.ceil((words.length / avgWPM) * 60);

  useEffect(() => {
    setTotal(estimatedSeconds);
    return () => {
      window.speechSynthesis.cancel();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [estimatedSeconds]);

  // Chunk text for better TTS handling
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

  function getLangCode(lang: string): string {
    const map: Record<string, string> = {
      en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT",
      pt: "pt-PT", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ar: "ar-SA",
      hi: "hi-IN", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR",
    };
    return map[lang] || "en-US";
  }

  function startTimer() {
    startTimeRef.current = Date.now() - pausedAtRef.current * 1000;
    intervalRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(Math.min(el, estimatedSeconds));
      setProgress(Math.min((el / estimatedSeconds) * 100, 100));
      if (el >= estimatedSeconds) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 500);
  }

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pausedAtRef.current = elapsed;
  }

  function speakChunk(index: number) {
    if (index >= textChunks.current.length) {
      setState("ended");
      stopTimer();
      return;
    }
    const utter = new SpeechSynthesisUtterance(textChunks.current[index]);
    utter.lang = getLangCode(book.language);
    utter.rate = rate;
    utter.volume = muted ? 0 : volume;
    utter.onend = () => {
      chunkIndexRef.current = index + 1;
      speakChunk(index + 1);
    };
    utter.onerror = () => setState("idle");
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  const handlePlay = () => {
    if (state === "idle" || state === "ended") {
      window.speechSynthesis.cancel();
      textChunks.current = chunkText(text);
      chunkIndexRef.current = 0;
      pausedAtRef.current = 0;
      setElapsed(0);
      setProgress(0);
      setState("loading");
      setTimeout(() => {
        setState("playing");
        startTimer();
        speakChunk(0);
      }, 300);
    } else if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      startTimer();
    } else if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused");
      stopTimer();
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setState("idle");
    stopTimer();
    setElapsed(0);
    setProgress(0);
    pausedAtRef.current = 0;
  };

  const handleRate = (r: number) => {
    setRate(r);
    if (state === "playing") {
      window.speechSynthesis.cancel();
      const newUtter = new SpeechSynthesisUtterance(
        textChunks.current.slice(chunkIndexRef.current).join(" ")
      );
      newUtter.lang = getLangCode(book.language);
      newUtter.rate = r;
      newUtter.volume = muted ? 0 : volume;
      utterRef.current = newUtter;
      window.speechSynthesis.speak(newUtter);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const rates = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm leading-tight">{book.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{book.languageLabel} · {book.wordCount.toLocaleString()} words</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          state === "playing" ? "bg-primary/10 text-primary" :
          state === "paused" ? "bg-warning/10 text-warning" :
          state === "ended" ? "bg-success/10 text-success" :
          "bg-muted text-muted-foreground"
        }`}>
          {state === "loading" ? "Loading…" : state === "playing" ? "Playing" : state === "paused" ? "Paused" : state === "ended" ? "Done" : "Ready"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="relative h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{fmt(elapsed)}</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStop}
            disabled={state === "idle"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePlay}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
              state === "playing"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {state === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : state === "playing" ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          <button
            onClick={handleDownload}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed */}
        <div className="flex gap-1">
          {rates.map((r) => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${
                rate === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {r}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <button
          onClick={() => setMuted(!muted)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

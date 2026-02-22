import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Square, Download, Loader2, RotateCcw, Settings2
} from "lucide-react";
import { AudiobookEntry, savePlaybackState, getPlaybackState } from "@/lib/audiobookStore";
import { useAuth } from "@/contexts/AuthContext";
import { synthesizeOffline, stopTTS, pauseTTS, resumeTTS, getLangCode, getBrowserVoices } from "@/lib/ttsEngine";

interface AudioPlayerProps {
  book: AudiobookEntry;
}

type PlayState = "idle" | "loading" | "playing" | "paused" | "ended";

const RATE_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({ book }: AudioPlayerProps) {
  const { user } = useAuth();

  const [state, setState] = useState<PlayState>("idle");
  const [selectedParagraphs, setSelectedParagraphs] = useState<Set<number>>(new Set());
  const [currentParagraph, setCurrentParagraph] = useState<number>(-1);
  const [rate, setRate] = useState(1);
  const [voiceIndex, setVoiceIndex] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<{ id: string; label: string }[]>([]);

  const playQueueRef = useRef<number[]>([]);
  const queueIndexRef = useRef(0);
  const abortRef = useRef(false);

  const paragraphs = book.paragraphs?.length > 0
    ? book.paragraphs
    : book.translatedText.split(/\n\n+/).filter(Boolean);

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => setBrowserVoices(getBrowserVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Load saved playback state
  useEffect(() => {
    if (!user) return;
    getPlaybackState(user.id, book.id).then((ps) => {
      if (ps) {
        setRate(ps.speed);
        if (ps.chunkIndex >= 0 && ps.chunkIndex < paragraphs.length) {
          setCurrentParagraph(ps.chunkIndex);
        }
      }
    });
  }, [user, book.id]);

  const saveState = useCallback((paraIdx: number) => {
    if (!user) return;
    savePlaybackState(user.id, book.id, 0, paraIdx, rate);
  }, [user, book.id, rate]);

  const toggleParagraph = (index: number) => {
    setSelectedParagraphs(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Play a single paragraph using browser TTS
  const playParagraph = async (index: number) => {
    if (index < 0 || index >= paragraphs.length) {
      setState("ended");
      return;
    }

    setCurrentParagraph(index);
    setState("playing");
    saveState(index);

    const text = paragraphs[index];

    try {
      await synthesizeOffline(text, getLangCode(book.language), rate, voiceIndex);
      if (abortRef.current) return;

      queueIndexRef.current++;
      if (queueIndexRef.current < playQueueRef.current.length && !abortRef.current) {
        playParagraph(playQueueRef.current[queueIndexRef.current]);
      } else {
        setState("ended");
      }
    } catch (err) {
      console.error("TTS error:", err);
      setState("idle");
    }
  };

  const handlePlayAll = () => {
    abortRef.current = false;
    const queue = selectedParagraphs.size > 0
      ? Array.from(selectedParagraphs).sort((a, b) => a - b)
      : paragraphs.map((_, i) => i);

    playQueueRef.current = queue;
    queueIndexRef.current = 0;
    playParagraph(queue[0]);
  };

  const handlePlaySingle = (index: number) => {
    abortRef.current = false;
    playQueueRef.current = [index];
    queueIndexRef.current = 0;
    playParagraph(index);
  };

  const handlePause = () => {
    pauseTTS();
    setState("paused");
  };

  const handleResume = () => {
    resumeTTS();
    setState("playing");
  };

  const handleStop = () => {
    abortRef.current = true;
    stopTTS();
    setState("idle");
    setCurrentParagraph(-1);
  };

  const handleRepeat = () => {
    if (currentParagraph >= 0) {
      abortRef.current = false;
      playQueueRef.current = [currentParagraph];
      queueIndexRef.current = 0;
      playParagraph(currentParagraph);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([book.translatedText || book.originalText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${book.title}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      stopTTS();
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
            state === "playing" ? "bg-primary/10 text-primary" :
            state === "paused"  ? "bg-warning/10 text-warning" :
            state === "ended"   ? "bg-success/10 text-success" :
            state === "loading" ? "bg-primary/10 text-primary" :
            "bg-muted text-muted-foreground"
          }`}>
            {state === "loading" ? <><Loader2 className="w-3 h-3 animate-spin"/>Loading</> :
             state === "playing" ? <><div className="w-2 h-2 bg-primary rounded-full animate-pulse"/>Playing</> :
             state === "paused"  ? "Paused" :
             state === "ended"   ? "✓ Done" : "Ready"}
          </span>

          <span className="text-xs flex items-center gap-1 text-muted-foreground">
            🔊 Browser TTS
          </span>
        </div>

        {selectedParagraphs.size > 0 && (
          <span className="text-xs text-primary font-medium">
            {selectedParagraphs.size} selected
          </span>
        )}
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleStop} disabled={state === "idle"} title="Stop"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all">
            <Square className="w-3.5 h-3.5" />
          </button>

          {state === "playing" ? (
            <button onClick={handlePause}
              className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95">
              <Pause className="w-5 h-5" />
            </button>
          ) : state === "paused" ? (
            <button onClick={handleResume}
              className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95">
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button onClick={handlePlayAll}
              className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95">
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          )}

          <button onClick={handleRepeat} disabled={currentParagraph < 0} title="Repeat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed buttons */}
        <div className="flex gap-0.5">
          {RATE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRate(r)}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${
                rate === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >{r}x</button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>

          {/* Browser voice selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Voice</label>
            <select
              className="input-field text-xs py-2"
              value={voiceIndex}
              onChange={e => setVoiceIndex(Number(e.target.value))}
            >
              {browserVoices.length > 0 ? browserVoices.map((v, i) => (
                <option key={i} value={i}>{v.label}</option>
              )) : (
                <option value={0}>Default</option>
              )}
            </select>
          </div>
        </div>
      )}

      {/* Paragraphs with play controls */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Paragraphs ({paragraphs.length})
          </p>
          {selectedParagraphs.size > 0 && (
            <button onClick={() => setSelectedParagraphs(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground underline">
              Clear selection
            </button>
          )}
        </div>

        {paragraphs.map((p, i) => {
          const isActive = currentParagraph === i && (state === "playing" || state === "loading");
          const isSelected = selectedParagraphs.has(i);

          return (
            <div
              key={i}
              className={`group flex items-start gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                isActive
                  ? "bg-primary/10 border border-primary/30 shadow-sm"
                  : isSelected
                    ? "bg-accent border border-primary/20"
                    : "hover:bg-muted border border-transparent"
              }`}
              onClick={() => toggleParagraph(i)}
            >
              <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 text-right shrink-0">
                {i + 1}
              </span>

              <p className={`text-xs leading-relaxed flex-1 ${
                isActive ? "text-primary font-medium" : "text-foreground"
              }`}>
                {p.length > 200 ? p.substring(0, 200) + "…" : p}
              </p>

              <button
                onClick={(e) => { e.stopPropagation(); handlePlaySingle(i); }}
                className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title={`Play paragraph ${i + 1}`}
              >
                <Play className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

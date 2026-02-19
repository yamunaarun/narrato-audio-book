import { useState } from "react";
import {
  BookOpen, Headphones, Trash2, Calendar, Languages,
  FileText, Play, ChevronDown, ChevronUp, Search,
  StickyNote, BarChart2, Clock, TrendingUp, CheckCircle2
} from "lucide-react";
import { AudiobookEntry, deleteBook } from "@/lib/audiobookStore";
import AudioPlayer from "@/components/AudioPlayer";

interface AudioLibraryProps {
  books: AudiobookEntry[];
  onDelete: (id: string) => void;
}

function loadNote(id: string) {
  return localStorage.getItem(`note_${id}`) || "";
}
function saveNote(id: string, note: string) {
  localStorage.setItem(`note_${id}`, note);
}
function loadProgress(id: string) {
  return parseFloat(localStorage.getItem(`prog_${id}`) || "0");
}
function loadBookmarkCount(id: string) {
  try { return (JSON.parse(localStorage.getItem(`bm_${id}`) || "[]") as unknown[]).length; }
  catch { return 0; }
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function AudioLibrary({ books, onDelete }: AudioLibraryProps) {
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    books.forEach(b => { m[b.id] = loadNote(b.id); });
    return m;
  });
  const [showStats, setShowStats] = useState(false);

  const filtered = books.filter(
    b =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.languageLabel.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteBook(id);
    onDelete(id);
    if (activePlayer === id) setActivePlayer(null);
    if (expanded === id) setExpanded(null);
    if (noteOpen === id) setNoteOpen(null);
  };

  const handleNote = (id: string, val: string) => {
    setNotes(prev => ({ ...prev, [id]: val }));
    saveNote(id, val);
  };

  const fmt2 = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ─── Global stats ────────────────────────────────────────────────────────
  const totalWords   = books.reduce((s, b) => s + b.wordCount, 0);
  const totalMinutes = Math.ceil(totalWords / 150);
  const totalBMs     = books.reduce((s, b) => s + loadBookmarkCount(b.id), 0);
  const listenedPct  = books.length
    ? Math.round(books.filter(b => loadProgress(b.id) > 10).length / books.length * 100)
    : 0;

  if (books.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
          <Headphones className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No audiobooks yet</h3>
        <p className="text-sm text-muted-foreground">Upload a PDF above to create your first audiobook.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Listener analytics banner */}
      <button
        onClick={() => setShowStats(s => !s)}
        className="glass-card p-4 w-full flex items-center justify-between hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Listener Analytics</p>
            <p className="text-xs text-muted-foreground">{books.length} books · {totalWords.toLocaleString()} words · ~{totalMinutes} min total</p>
          </div>
        </div>
        {showStats ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up">
          {[
            { icon: BookOpen,    label: "Books",      value: books.length,         sub: "uploaded" },
            { icon: Clock,       label: "Est. Time",  value: `${totalMinutes}m`,   sub: "to listen" },
            { icon: TrendingUp,  label: "Listened",   value: `${listenedPct}%`,    sub: "started" },
            { icon: CheckCircle2,label: "Bookmarks",  value: totalBMs,             sub: "saved" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="glass-card p-4 flex flex-col items-center text-center">
              <Icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search audiobooks…"
          className="input-field pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          No books match your search.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((book, i) => {
          const prog     = loadProgress(book.id);
          const progPct  = Math.min((prog / Math.ceil((book.wordCount / 150) * 60)) * 100, 100);
          const bmCount  = loadBookmarkCount(book.id);
          const hasNote  = !!(notes[book.id]?.trim());

          return (
            <div
              key={book.id}
              className="glass-card overflow-hidden animate-fade-up hover:shadow-md transition-all"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Header */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 relative">
                  <BookOpen className="w-5 h-5 text-primary" />
                  {progPct > 5 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-card border border-border rounded-full flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" style={{ opacity: progPct / 100 }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{book.title}</h4>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Languages className="w-3 h-3" />{book.languageLabel}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" />{book.wordCount.toLocaleString()} words
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />{fmtDate(book.createdAt)}
                    </span>
                    {bmCount > 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full font-medium">
                        {bmCount} 🔖
                      </span>
                    )}
                    {hasNote && (
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">
                        📝 note
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {progPct > 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progPct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{fmt(prog)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setActivePlayer(activePlayer === book.id ? null : book.id)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all ${
                      activePlayer === book.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    {activePlayer === book.id ? "Hide" : "Play"}
                  </button>

                  <button
                    onClick={() => setNoteOpen(noteOpen === book.id ? null : book.id)}
                    title="Notes"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      hasNote ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <StickyNote className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setExpanded(expanded === book.id ? null : book.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    {expanded === book.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleDelete(book.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Player */}
              {activePlayer === book.id && (
                <div className="border-t border-border p-4 bg-muted/30 animate-fade-up">
                  <AudioPlayer book={book} />
                </div>
              )}

              {/* Notes panel */}
              {noteOpen === book.id && (
                <div className="border-t border-border p-4 animate-fade-up">
                  <p className="section-label mb-2">📝 Your Notes</p>
                  <textarea
                    className="input-field min-h-[80px] resize-none text-sm"
                    placeholder="Write your notes, highlights, or thoughts about this audiobook…"
                    value={notes[book.id] || ""}
                    onChange={e => handleNote(book.id, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Notes are saved automatically.</p>
                </div>
              )}

              {/* Expanded text */}
              {expanded === book.id && (
                <div className="border-t border-border p-4 animate-fade-up">
                  <p className="section-label mb-3">Extracted text</p>
                  <div className="bg-muted rounded-xl p-4 max-h-48 overflow-y-auto">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {book.translatedText.substring(0, 1000)}
                      {book.translatedText.length > 1000 && "…"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">PDF: {book.pdfName} · {fmt2(book.pdfSize)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

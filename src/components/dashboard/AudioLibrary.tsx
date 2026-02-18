import { useState } from "react";
import {
  BookOpen, Headphones, Trash2, Calendar, Languages,
  FileText, Play, ChevronDown, ChevronUp, Search
} from "lucide-react";
import { AudiobookEntry, deleteBook } from "@/lib/audiobookStore";
import AudioPlayer from "@/components/AudioPlayer";

interface AudioLibraryProps {
  books: AudiobookEntry[];
  onDelete: (id: string) => void;
}

export default function AudioLibrary({ books, onDelete }: AudioLibraryProps) {
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.languageLabel.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteBook(id);
    onDelete(id);
    if (activePlayer === id) setActivePlayer(null);
    if (expanded === id) setExpanded(null);
  };

  const fmt = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search audiobooks…"
          className="input-field pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          No books match your search.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((book, i) => (
          <div
            key={book.id}
            className="glass-card overflow-hidden animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Header */}
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm truncate">{book.title}</h4>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Languages className="w-3 h-3" />
                    {book.languageLabel}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    {book.wordCount.toLocaleString()} words
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {fmtDate(book.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                <p className="text-xs text-muted-foreground mt-2">PDF: {book.pdfName} · {fmt(book.pdfSize)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

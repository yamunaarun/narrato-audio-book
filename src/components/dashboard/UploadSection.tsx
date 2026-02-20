import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Languages, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, Sparkles, Image, FileType, Edit3, BookOpen
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AudiobookEntry, saveBook } from "@/lib/audiobookStore";
import { detectFormat, extractText, ACCEPTED_TYPES, ACCEPTED_MIME, SupportedFormat } from "@/lib/textExtractor";
import { smartSplitParagraphs, applyDictionary, DEFAULT_DICTIONARY } from "@/lib/pronunciationDict";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
];

type Step = "upload" | "extracting" | "configure" | "edit" | "processing" | "done" | "error";

interface UploadSectionProps {
  onBookCreated: (book: AudiobookEntry) => void;
}

const FORMAT_LABELS: Record<SupportedFormat, { icon: typeof FileText; label: string }> = {
  pdf:   { icon: FileText, label: "PDF Document" },
  docx:  { icon: FileType, label: "Word Document" },
  txt:   { icon: FileText, label: "Text File" },
  image: { icon: Image,    label: "Image (OCR)" },
};

export default function UploadSection({ onBookCreated }: UploadSectionProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SupportedFormat | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [extractedText, setExtractedText] = useState("");
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [language, setLanguage] = useState("en");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [showDict, setShowDict] = useState(false);
  const [customDict, setCustomDict] = useState<Record<string, string>>({});
  const [newDictKey, setNewDictKey] = useState("");
  const [newDictVal, setNewDictVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    const fmt = detectFormat(f);
    if (!fmt) {
      setError("Unsupported file type. Please upload PDF, DOCX, TXT, or an image.");
      return;
    }
    setFile(f);
    setFormat(fmt);
    setTitle(f.name.replace(/\.(pdf|docx|txt|png|jpe?g|gif|bmp|webp|tiff?)$/i, "").replace(/_/g, " "));
    setError("");
    setStep("extracting");
    setExtractProgress(fmt === "image" ? "Running OCR on image…" : `Extracting text from ${fmt.toUpperCase()}…`);

    try {
      const text = await extractText(f, fmt);
      setExtractedText(text);
      setParagraphs(smartSplitParagraphs(text));
      setStep("configure");
    } catch (err: any) {
      setError(err.message || "Failed to extract text");
      setStep("error");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleParagraphChange = (index: number, value: string) => {
    setParagraphs(prev => prev.map((p, i) => i === index ? value : p));
  };

  const removeParagraph = (index: number) => {
    setParagraphs(prev => prev.filter((_, i) => i !== index));
  };

  const addDictEntry = () => {
    if (newDictKey.trim() && newDictVal.trim()) {
      setCustomDict(prev => ({ ...prev, [newDictKey.trim()]: newDictVal.trim() }));
      setNewDictKey("");
      setNewDictVal("");
    }
  };

  const handleConvert = async () => {
    if (!user) return;
    setStep("processing");

    try {
      const finalText = paragraphs.join("\n\n");
      const correctedText = applyDictionary(finalText, customDict);

      await new Promise((r) => setTimeout(r, 800));
      const selectedLang = LANGUAGES.find((l) => l.code === language)!;

      const book: AudiobookEntry = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: title || file!.name.replace(/\.[^.]+$/, ""),
        originalText: extractedText,
        translatedText: correctedText,
        language,
        languageLabel: selectedLang.label,
        pdfName: file!.name,
        pdfSize: file!.size,
        createdAt: new Date().toISOString(),
        wordCount: correctedText.split(/\s+/).filter(Boolean).length,
      };

      saveBook(book);
      onBookCreated(book);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    }
  };

  const reset = () => {
    setFile(null); setFormat(null); setStep("upload"); setExtractedText("");
    setParagraphs([]); setLanguage("en"); setTitle(""); setError("");
    setCustomDict({}); setShowDict(false);
  };

  if (step === "done") {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-up">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Audiobook Created!</h3>
        <p className="text-muted-foreground text-sm mb-6">Your audiobook is ready in the library below.</p>
        <button onClick={reset} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
          Convert Another File
        </button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-up">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-sm mb-6">{error}</p>
        <button onClick={reset} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
          Try Again
        </button>
      </div>
    );
  }

  if (step === "extracting" || step === "processing") {
    const msg = step === "extracting" ? extractProgress : "Processing audiobook…";
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-up">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-pulse-soft">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{msg}</h3>
        <p className="text-muted-foreground text-sm">
          {step === "extracting" && format === "image" ? "OCR may take a moment…" : "Almost there…"}
        </p>
        <div className="mt-6 w-64 h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse-soft" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  // Paragraph editing step
  if (step === "edit") {
    return (
      <div className="glass-card p-6 space-y-5 animate-fade-up">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Edit Paragraphs</p>
              <p className="text-xs text-muted-foreground">{paragraphs.length} paragraphs · Edit text before conversion</p>
            </div>
          </div>
          <button onClick={() => setStep("configure")} className="text-xs text-muted-foreground hover:text-foreground underline">
            Back
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {paragraphs.map((p, i) => (
            <div key={i} className="group relative">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-mono mt-3 w-6 text-right shrink-0">
                  {i + 1}
                </span>
                <textarea
                  value={p}
                  onChange={(e) => handleParagraphChange(i, e.target.value)}
                  className="input-field min-h-[60px] text-sm leading-relaxed resize-y flex-1"
                  rows={Math.max(2, Math.ceil(p.length / 80))}
                />
                <button
                  onClick={() => removeParagraph(i)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-destructive hover:text-destructive/80 mt-3 transition-opacity"
                  title="Remove paragraph"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Dictionary section */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowDict(!showDict)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Pronunciation Dictionary
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDict ? "rotate-180" : ""}`} />
          </button>

          {showDict && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Add custom word replacements applied before text-to-speech conversion.
              </p>

              {/* Built-in examples */}
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Built-in corrections (sample)</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(DEFAULT_DICTIONARY).slice(0, 8).map(([k, v]) => (
                    <span key={k} className="text-xs bg-card px-2 py-1 rounded-lg border border-border">
                      {k} → {v}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground py-1">+{Object.keys(DEFAULT_DICTIONARY).length - 8} more</span>
                </div>
              </div>

              {/* Custom entries */}
              {Object.keys(customDict).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(customDict).map(([k, v]) => (
                    <span key={k} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg flex items-center gap-1">
                      {k} → {v}
                      <button onClick={() => setCustomDict(prev => { const n = { ...prev }; delete n[k]; return n; })} className="hover:text-destructive">✕</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add new */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Word (e.g. SQL)"
                  value={newDictKey}
                  onChange={(e) => setNewDictKey(e.target.value)}
                  className="input-field flex-1 py-2"
                />
                <input
                  type="text"
                  placeholder="Say as (e.g. sequel)"
                  value={newDictVal}
                  onChange={(e) => setNewDictVal(e.target.value)}
                  className="input-field flex-1 py-2"
                />
                <button
                  onClick={addDictEntry}
                  disabled={!newDictKey.trim() || !newDictVal.trim()}
                  className="btn-primary px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleConvert}
          className="btn-primary w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Create Audiobook
        </button>
      </div>
    );
  }

  if (step === "configure") {
    const FormatIcon = format ? FORMAT_LABELS[format].icon : FileText;
    const formatLabel = format ? FORMAT_LABELS[format].label : "File";

    return (
      <div className="glass-card p-6 space-y-5 animate-fade-up">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FormatIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatLabel} · {extractedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted
            </p>
          </div>
          <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">
            Change file
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Audiobook title</label>
          <input
            type="text"
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title…"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            Audio language
          </label>
          <div className="relative">
            <select
              className="input-field appearance-none pr-10"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="bg-muted rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">Extracted preview</p>
          <p className="text-sm text-foreground line-clamp-4 leading-relaxed">
            {extractedText.substring(0, 300)}…
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep("edit")}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-border text-foreground hover:bg-accent transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit & Correct
          </button>
          <button
            onClick={handleConvert}
            className="flex-1 btn-primary py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Create Audiobook
          </button>
        </div>
      </div>
    );
  }

  // Upload step
  return (
    <div className="space-y-4 animate-fade-up">
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`glass-card p-12 flex flex-col items-center text-center cursor-pointer transition-all duration-200 border-2 border-dashed ${
          dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-accent/50"
        }`}
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${
          dragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          <Upload className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {dragOver ? "Drop your file here" : "Upload a document"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Drag & drop or click to browse</p>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-medium">PDF</span>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-medium">DOCX</span>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-medium">TXT</span>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-medium">Images (OCR)</span>
        </div>
        <input ref={fileRef} type="file" accept={`${ACCEPTED_TYPES},${ACCEPTED_MIME}`} className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

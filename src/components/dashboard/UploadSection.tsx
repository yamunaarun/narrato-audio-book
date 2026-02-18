import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Languages, Mic2, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AudiobookEntry, saveBook } from "@/lib/audiobookStore";

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

type Step = "upload" | "extracting" | "configure" | "translating" | "done" | "error";

interface UploadSectionProps {
  onBookCreated: (book: AudiobookEntry) => void;
}

export default function UploadSection({ onBookCreated }: UploadSectionProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [extractedText, setExtractedText] = useState("");
  const [language, setLanguage] = useState("en");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".pdf") && f.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }
    setFile(f);
    setTitle(f.name.replace(".pdf", "").replace(/_/g, " "));
    setError("");
    setStep("extracting");

    try {
      // Dynamic import pdfjs
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        fullText += pageText + "\n";
      }

      if (!fullText.trim()) throw new Error("No text found in PDF");
      setExtractedText(fullText.trim());
      setStep("configure");
    } catch (err: any) {
      setError(err.message || "Failed to extract text from PDF");
      setStep("error");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleConvert = async () => {
    if (!user) return;
    setStep("translating");

    try {
      // Simulate translation (real implementation would use Google Translate API)
      await new Promise((r) => setTimeout(r, 1500));
      const selectedLang = LANGUAGES.find((l) => l.code === language)!;

      const book: AudiobookEntry = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: title || file!.name.replace(".pdf", ""),
        originalText: extractedText,
        translatedText: extractedText, // In production: translated text
        language,
        languageLabel: selectedLang.label,
        pdfName: file!.name,
        pdfSize: file!.size,
        createdAt: new Date().toISOString(),
        wordCount: extractedText.split(/\s+/).filter(Boolean).length,
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
    setFile(null);
    setStep("upload");
    setExtractedText("");
    setLanguage("en");
    setTitle("");
    setError("");
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
          Convert Another PDF
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

  if (step === "extracting" || step === "translating") {
    const msg = step === "extracting" ? "Extracting text from PDF…" : "Processing audiobook…";
    const sub = step === "extracting" ? "Reading pages and extracting content" : "Preparing text for audio playback";
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-up">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-pulse-soft">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{msg}</h3>
        <p className="text-muted-foreground text-sm">{sub}</p>
        <div className="mt-6 w-64 h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse-soft" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  if (step === "configure") {
    return (
      <div className="glass-card p-6 space-y-5 animate-fade-up">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {extractedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted
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
          {dragOver ? "Drop your PDF here" : "Upload a PDF document"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Drag & drop or click to browse</p>
        <span className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg font-medium">
          PDF files only · Max 50 pages extracted
        </span>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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

export interface AudiobookEntry {
  id: string;
  userId: string;
  title: string;
  originalText: string;
  translatedText: string;
  language: string;
  languageLabel: string;
  pdfName: string;
  pdfSize: number;
  createdAt: string;
  duration?: number;
  wordCount: number;
}

const STORE_KEY = "audiobook_library";

export function getBooks(userId: string): AudiobookEntry[] {
  const all = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  return all.filter((b: AudiobookEntry) => b.userId === userId);
}

export function saveBook(book: AudiobookEntry): void {
  const all = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  all.unshift(book);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

export function deleteBook(id: string): void {
  const all = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  localStorage.setItem(STORE_KEY, JSON.stringify(all.filter((b: AudiobookEntry) => b.id !== id)));
}

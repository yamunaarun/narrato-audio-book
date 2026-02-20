/**
 * Pronunciation dictionary for auto-correction before TTS.
 * Maps abbreviations/acronyms to their spoken form.
 */

export const DEFAULT_DICTIONARY: Record<string, string> = {
  // Tech terms
  "SQL": "sequel",
  "API": "A P I",
  "UI": "user interface",
  "UX": "user experience",
  "HTML": "H T M L",
  "CSS": "C S S",
  "JS": "JavaScript",
  "TS": "TypeScript",
  "AI": "Artificial Intelligence",
  "ML": "Machine Learning",
  "GPU": "G P U",
  "CPU": "C P U",
  "URL": "U R L",
  "JSON": "Jason",
  "CLI": "C L I",
  "SDK": "S D K",
  "REST": "rest",
  "OAuth": "O Auth",
  "npm": "N P M",
  "CRUD": "crud",
  "IoT": "Internet of Things",
  "SaaS": "sass",
  "AWS": "A W S",
  "GCP": "G C P",

  // Common abbreviations
  "Dr.": "Doctor",
  "Mr.": "Mister",
  "Mrs.": "Missus",
  "Ms.": "Miss",
  "Jr.": "Junior",
  "Sr.": "Senior",
  "vs.": "versus",
  "etc.": "etcetera",
  "e.g.": "for example",
  "i.e.": "that is",
  "w/": "with",
  "w/o": "without",

  // Units
  "km": "kilometers",
  "kg": "kilograms",
  "mb": "megabytes",
  "gb": "gigabytes",
  "tb": "terabytes",
  "MHz": "megahertz",
  "GHz": "gigahertz",
};

/**
 * Apply pronunciation dictionary to text.
 * Replaces exact word matches (case-sensitive for acronyms).
 */
export function applyDictionary(
  text: string,
  customDict: Record<string, string> = {}
): string {
  const dict = { ...DEFAULT_DICTIONARY, ...customDict };
  let result = text;

  for (const [key, replacement] of Object.entries(dict)) {
    // Escape special regex chars in key
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word boundary match
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Split text into paragraphs for editing.
 */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * If no double-newlines, split by single newlines or by sentence groups.
 */
export function smartSplitParagraphs(text: string): string[] {
  const byDouble = splitIntoParagraphs(text);
  if (byDouble.length > 1) return byDouble;

  // Fall back to splitting by single newlines
  const byLine = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;

  // Fall back to splitting every ~3 sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const paragraphs: string[] = [];
  let current = "";
  for (let i = 0; i < sentences.length; i++) {
    current += sentences[i];
    if ((i + 1) % 3 === 0 || i === sentences.length - 1) {
      paragraphs.push(current.trim());
      current = "";
    }
  }
  return paragraphs.filter(Boolean);
}

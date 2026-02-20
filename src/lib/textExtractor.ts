/**
 * Multi-format text extraction: PDF, DOCX, TXT, Images (OCR)
 */

export type SupportedFormat = "pdf" | "docx" | "txt" | "image";

export function detectFormat(file: File): SupportedFormat | null {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (name.endsWith(".txt") || type === "text/plain") return "txt";
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(name)) return "image";
  return null;
}

export const ACCEPTED_TYPES = ".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.tiff";
export const ACCEPTED_MIME = "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*";

export async function extractText(file: File, format: SupportedFormat): Promise<string> {
  switch (format) {
    case "pdf":   return extractPDF(file);
    case "docx":  return extractDOCX(file);
    case "txt":   return extractTXT(file);
    case "image": return extractImage(file);
  }
}

async function extractPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();

  const arrayBuffer = await file.arrayBuffer();
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

  if (!fullText.trim()) throw new Error("No text found in PDF. Try uploading as an image for OCR.");
  return fullText.trim();
}

async function extractDOCX(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (!result.value.trim()) throw new Error("No text found in DOCX file");
  return result.value.trim();
}

async function extractTXT(file: File): Promise<string> {
  const text = await file.text();
  if (!text.trim()) throw new Error("The text file is empty");
  return text.trim();
}

async function extractImage(file: File): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const { data: { text } } = await Tesseract.recognize(file, "eng", {
    logger: () => {}, // suppress logs
  });
  if (!text.trim()) throw new Error("No text could be recognized from the image. Try a clearer image.");
  return text.trim();
}

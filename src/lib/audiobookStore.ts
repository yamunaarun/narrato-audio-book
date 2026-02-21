import { supabase } from "@/integrations/supabase/client";

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
  paragraphs: string[];
}

// Fetch all books for user from database
export async function getBooks(userId: string): Promise<AudiobookEntry[]> {
  const { data, error } = await supabase
    .from("audiobooks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching audiobooks:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    originalText: row.original_text,
    translatedText: row.translated_text,
    language: row.language,
    languageLabel: row.language_label,
    pdfName: row.pdf_name,
    pdfSize: row.pdf_size,
    createdAt: row.created_at,
    wordCount: row.word_count,
    paragraphs: row.paragraphs || [],
  }));
}

// Save book to database
export async function saveBook(book: AudiobookEntry): Promise<void> {
  const { error } = await supabase.from("audiobooks").insert({
    id: book.id,
    user_id: book.userId,
    title: book.title,
    original_text: book.originalText,
    translated_text: book.translatedText,
    language: book.language,
    language_label: book.languageLabel,
    pdf_name: book.pdfName,
    pdf_size: book.pdfSize,
    word_count: book.wordCount,
    paragraphs: book.paragraphs,
  });

  if (error) throw new Error(error.message);
}

// Delete book from database
export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from("audiobooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Playback state helpers
export async function savePlaybackState(
  userId: string,
  audiobookId: string,
  positionSeconds: number,
  chunkIndex: number,
  speed: number
): Promise<void> {
  const { error } = await supabase.from("playback_state").upsert(
    {
      user_id: userId,
      audiobook_id: audiobookId,
      position_seconds: positionSeconds,
      chunk_index: chunkIndex,
      speed,
    },
    { onConflict: "user_id,audiobook_id" }
  );
  if (error) console.error("Error saving playback state:", error);
}

export async function getPlaybackState(
  userId: string,
  audiobookId: string
): Promise<{ positionSeconds: number; chunkIndex: number; speed: number } | null> {
  const { data, error } = await supabase
    .from("playback_state")
    .select("position_seconds, chunk_index, speed")
    .eq("user_id", userId)
    .eq("audiobook_id", audiobookId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    positionSeconds: data.position_seconds,
    chunkIndex: data.chunk_index,
    speed: data.speed,
  };
}

// User preferences helpers
export async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    preferredLanguage: data.preferred_language,
    preferredSpeed: data.preferred_speed,
    preferredVoice: data.preferred_voice,
    theme: data.theme,
  };
}

export async function saveUserPreferences(
  userId: string,
  prefs: { preferredLanguage?: string; preferredSpeed?: number; preferredVoice?: string; theme?: string }
): Promise<void> {
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      preferred_language: prefs.preferredLanguage || "en",
      preferred_speed: prefs.preferredSpeed || 1.0,
      preferred_voice: prefs.preferredVoice || null,
      theme: prefs.theme || "light",
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("Error saving preferences:", error);
}

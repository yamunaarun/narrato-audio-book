/**
 * Smart TTS engine: OpenAI online, browser SpeechSynthesis offline fallback.
 */

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`;

export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export const OPENAI_VOICES: { id: OpenAIVoice; label: string }[] = [
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
];

export async function synthesizeOnline(
  text: string,
  voice: OpenAIVoice = "alloy",
  speed: number = 1.0
): Promise<ArrayBuffer> {
  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text, voice, speed }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "TTS failed" }));
    throw new Error(err.error || `TTS failed (${resp.status})`);
  }

  return resp.arrayBuffer();
}

// Browser TTS fallback
export function synthesizeOffline(
  text: string,
  lang: string = "en-US",
  rate: number = 1.0,
  voice?: SpeechSynthesisVoice | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    if (voice) utter.voice = voice;
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utter);
  });
}

export function stopOfflineTTS() {
  window.speechSynthesis.cancel();
}

export function pauseOfflineTTS() {
  window.speechSynthesis.pause();
}

export function resumeOfflineTTS() {
  window.speechSynthesis.resume();
}

export function getLangCode(lang: string): string {
  const map: Record<string, string> = {
    en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT",
    pt: "pt-PT", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ar: "ar-SA",
    hi: "hi-IN", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR",
    ta: "ta-IN", te: "te-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN",
    kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", ur: "ur-PK",
  };
  return map[lang] || "en-US";
}

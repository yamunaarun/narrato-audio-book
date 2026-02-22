/**
 * Smart TTS engine: ElevenLabs online, browser SpeechSynthesis offline fallback.
 */

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`;

// ElevenLabs voice IDs and labels
export type ElevenLabsVoice = string;

export const ELEVENLABS_VOICES: { id: string; label: string }[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica" },
];

export async function synthesizeOnline(
  text: string,
  voiceId: string = "JBFqnCBsd6RMkjVDRZzb",
  speed: number = 1.0
): Promise<ArrayBuffer> {
  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text, voiceId, speed }),
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

/**
 * Browser-only TTS engine using SpeechSynthesis API (no API keys needed).
 */

export type BrowserVoice = { id: string; label: string };

// Get available browser voices
export function getBrowserVoices(): BrowserVoice[] {
  const voices = window.speechSynthesis.getVoices();
  return voices.map((v, i) => ({ id: String(i), label: `${v.name} (${v.lang})` }));
}

export function synthesizeOffline(
  text: string,
  lang: string = "en-US",
  rate: number = 1.0,
  voiceIndex?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    if (voiceIndex !== undefined) {
      const voices = window.speechSynthesis.getVoices();
      if (voices[voiceIndex]) utter.voice = voices[voiceIndex];
    }
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utter);
  });
}

export function stopTTS() {
  window.speechSynthesis.cancel();
}

export function pauseTTS() {
  window.speechSynthesis.pause();
}

export function resumeTTS() {
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

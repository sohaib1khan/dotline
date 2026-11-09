let preferredVoiceURI: string | null = null;
let voicesReady = false;

function warmVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const load = () => {
    voicesReady = window.speechSynthesis.getVoices().length > 0;
  };
  load();
  window.speechSynthesis.addEventListener("voiceschanged", load);
}

if (typeof window !== "undefined") {
  warmVoices();
}

export function setPreferredVoice(voiceURI: string | null) {
  preferredVoiceURI = voiceURI;
}

/** Prefer calmer local / natural-sounding English voices when none chosen. */
function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    let n = 0;
    if (/en(-|_)?(us|gb|au|ie|za|ca)/i.test(voice.lang) || voice.lang.toLowerCase().startsWith("en")) {
      n += 5;
    }
    if (voice.localService) n += 4;
    if (/natural|neural|premium|enhanced|samantha|karen|moira|daniel|google|microsoft/.test(name)) {
      n += 3;
    }
    if (/compact|robot|novelty|whisper|zarvox|bad/.test(name)) n -= 6;
    return n;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function speak(text: string, rate: number, voiceURI?: string | null) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  // Slightly slower + lower pitch reads warmer than the default “robot” cadence
  utter.rate = Math.max(0.5, Math.min(1.6, rate * 0.92));
  utter.pitch = 0.92;
  utter.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const wanted = voiceURI ?? preferredVoiceURI;
  if (wanted) {
    const match = voices.find((voice) => voice.voiceURI === wanted);
    if (match) utter.voice = match;
  } else {
    const natural = pickNaturalVoice(voices);
    if (natural) utter.voice = natural;
  }

  // Some browsers need a tick after voices load
  if (!voicesReady && voices.length === 0) {
    window.setTimeout(() => window.speechSynthesis.speak(utter), 50);
    return;
  }
  window.speechSynthesis.speak(utter);
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  return [...voices].sort((a, b) => a.name.localeCompare(b.name));
}

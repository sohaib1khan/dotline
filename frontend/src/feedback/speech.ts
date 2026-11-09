let preferredVoiceURI: string | null = null;

export function setPreferredVoice(voiceURI: string | null) {
  preferredVoiceURI = voiceURI;
}

export function speak(text: string, rate: number, voiceURI?: string | null) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = Math.max(0.5, Math.min(2, rate));
  const wanted = voiceURI ?? preferredVoiceURI;
  if (wanted) {
    const match = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === wanted);
    if (match) utter.voice = match;
  }
  window.speechSynthesis.speak(utter);
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

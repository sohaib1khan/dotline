import { audioFeedback } from "@/feedback/audio";
import { hapticsFeedback, isIphoneSafari, supportsPhoneVibration } from "@/feedback/haptics";
import { setPreferredVoice, speak } from "@/feedback/speech";
import { usePreferences } from "@/store/preferences";

function prefs() {
  return usePreferences.getState().settings;
}

function sfxVolume() {
  const p = prefs();
  return p.sfx_enabled ? p.volume : 0;
}

export const feedback = {
  dot(dot: number) {
    const { haptics_enabled, haptics_intensity } = prefs();
    audioFeedback.dot(dot, sfxVolume());
    if (haptics_enabled) hapticsFeedback.offPath(haptics_intensity * 0.5);
  },
  correct(message = "Correct") {
    const p = prefs();
    audioFeedback.correct(sfxVolume());
    if (p.speech_enabled) speak(message, p.speech_rate, p.speech_voice);
    if (p.haptics_enabled) hapticsFeedback.correct(p.haptics_intensity);
  },
  wrong(message = "Try again") {
    const p = prefs();
    audioFeedback.wrong(sfxVolume());
    if (p.speech_enabled) speak(message, p.speech_rate, p.speech_voice);
    if (p.haptics_enabled) hapticsFeedback.wrong(p.haptics_intensity);
  },
  levelUp(message = "Level up") {
    const p = prefs();
    audioFeedback.levelUp(sfxVolume());
    if (p.speech_enabled) speak(message, p.speech_rate, p.speech_voice);
    if (p.haptics_enabled) hapticsFeedback.levelUp(p.haptics_intensity);
  },
  badge(message = "Badge earned") {
    const p = prefs();
    audioFeedback.badge(sfxVolume());
    if (p.speech_enabled) speak(message, p.speech_rate, p.speech_voice);
    if (p.haptics_enabled) hapticsFeedback.correct(p.haptics_intensity);
  },
  offPath() {
    const p = prefs();
    audioFeedback.offPath(sfxVolume());
    if (p.haptics_enabled) hapticsFeedback.offPath(p.haptics_intensity);
  },
  speak(text: string) {
    const p = prefs();
    if (p.speech_enabled) speak(text, p.speech_rate, p.speech_voice);
  },
  setVoice(voiceURI: string | null) {
    setPreferredVoice(voiceURI);
  },
  testVibration() {
    const p = prefs();
    hapticsFeedback.test(p.haptics_intensity);
  },
  testRumble() {
    const p = prefs();
    hapticsFeedback.test(p.haptics_intensity);
  },
  supportsPhoneVibration,
  isIphoneSafari,
};

export { getVoices } from "@/feedback/speech";
export { getConnectedGamepads, setGamepadMapping } from "@/input/gamepad";

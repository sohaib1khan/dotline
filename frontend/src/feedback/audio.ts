let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, durationMs: number, volume: number, type: OscillatorType = "sine") {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.2;
  osc.connect(gain);
  gain.connect(audio.destination);
  const now = audio.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

const DOT_FREQ = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0];

export const audioFeedback = {
  dot(dot: number, volume: number) {
    const freq = DOT_FREQ[Math.min(5, Math.max(0, dot - 1))] ?? 300;
    tone(freq, 80, volume, "triangle");
  },
  correct(volume: number) {
    tone(523.25, 100, volume);
    window.setTimeout(() => tone(659.25, 140, volume), 90);
  },
  wrong(volume: number) {
    tone(180, 180, volume, "sawtooth");
  },
  levelUp(volume: number) {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      window.setTimeout(() => tone(freq, 120, volume), i * 100);
    });
  },
  badge(volume: number) {
    tone(880, 120, volume);
    window.setTimeout(() => tone(1174.7, 180, volume), 110);
  },
  offPath(volume: number) {
    tone(240, 40, volume * 0.5, "square");
  },
};

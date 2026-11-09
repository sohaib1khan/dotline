/** Soft wetland-style feedback tones (filtered, gentle envelopes — not square/saw beeps). */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

type ChimeOpts = {
  freq: number;
  durationMs: number;
  volume: number;
  type?: OscillatorType;
  attackMs?: number;
  /** Second partial for warmth (slightly detuned). */
  partial?: number;
  filterHz?: number;
};

function chime({
  freq,
  durationMs,
  volume,
  type = "sine",
  attackMs = 28,
  partial = 0,
  filterHz = 1800,
}: ChimeOpts) {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();

  const now = audio.currentTime;
  const dur = Math.max(0.05, durationMs / 1000);
  const attack = Math.min(attackMs / 1000, dur * 0.35);
  const peak = Math.max(0, Math.min(1, volume)) * 0.16;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterHz;
  filter.Q.value = 0.7;
  filter.connect(audio.destination);

  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(peak, now + attack);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  master.connect(filter);

  const makeOsc = (f: number, gainMul: number, oscType: OscillatorType) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = oscType;
    osc.frequency.value = f;
    gain.gain.value = gainMul;
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };

  makeOsc(freq, 1, type);
  if (partial > 0) {
    makeOsc(freq * partial * 1.002, 0.28, "triangle");
  }
}

const DOT_FREQ = [246.94, 277.18, 311.13, 329.63, 369.99, 415.3];

export const audioFeedback = {
  dot(dot: number, volume: number) {
    const freq = DOT_FREQ[Math.min(5, Math.max(0, dot - 1))] ?? 300;
    chime({
      freq,
      durationMs: 110,
      volume: volume * 0.85,
      type: "sine",
      attackMs: 18,
      partial: 2,
      filterHz: 2200,
    });
  },
  correct(volume: number) {
    chime({ freq: 392.0, durationMs: 160, volume, type: "sine", partial: 2, filterHz: 2400 });
    window.setTimeout(() => {
      chime({ freq: 523.25, durationMs: 220, volume, type: "triangle", partial: 1.5, filterHz: 2600 });
    }, 95);
  },
  wrong(volume: number) {
    // Soft descending pair — no harsh sawtooth
    chime({ freq: 220, durationMs: 160, volume: volume * 0.9, type: "triangle", filterHz: 900 });
    window.setTimeout(() => {
      chime({ freq: 174.61, durationMs: 200, volume: volume * 0.75, type: "sine", filterHz: 800 });
    }, 90);
  },
  levelUp(volume: number) {
    [349.23, 440.0, 523.25, 659.25].forEach((freq, i) => {
      window.setTimeout(() => {
        chime({
          freq,
          durationMs: 150,
          volume,
          type: i % 2 === 0 ? "sine" : "triangle",
          partial: 2,
          filterHz: 2800,
        });
      }, i * 115);
    });
  },
  badge(volume: number) {
    chime({ freq: 523.25, durationMs: 140, volume, type: "sine", partial: 2 });
    window.setTimeout(() => {
      chime({ freq: 698.46, durationMs: 220, volume, type: "triangle", partial: 1.5, filterHz: 3000 });
    }, 100);
  },
  offPath(volume: number) {
    chime({
      freq: 196.0,
      durationMs: 55,
      volume: volume * 0.45,
      type: "sine",
      attackMs: 8,
      filterHz: 700,
    });
  },
};

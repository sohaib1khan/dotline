export function supportsPhoneVibration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function isIphoneSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPhone = /iPhone|iPod/.test(ua) || (/iPad/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iPhone && webkit && notChrome;
}

async function rumble(duration: number, weak = 0.4, strong = 0.8) {
  const pads = navigator.getGamepads?.() ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  for (const pad of pads) {
    const actuator = (pad as Gamepad & { vibrationActuator?: { playEffect: Function } }).vibrationActuator;
    if (!actuator?.playEffect) continue;
    try {
      await actuator.playEffect("dual-rumble", {
        duration,
        startDelay: 0,
        weakMagnitude: weak,
        strongMagnitude: strong,
      });
    } catch {
      // Unsupported effect on this controller.
    }
  }
}

export const hapticsFeedback = {
  correct(intensity: number) {
    if (supportsPhoneVibration()) navigator.vibrate(Math.round(40 * intensity));
    void rumble(60, 0.3 * intensity, 0.7 * intensity);
  },
  wrong(intensity: number) {
    if (supportsPhoneVibration()) navigator.vibrate([40, 40, 40].map((v) => Math.round(v * intensity)));
    void rumble(120, 0.5 * intensity, 1 * intensity);
  },
  offPath(intensity: number) {
    if (supportsPhoneVibration()) navigator.vibrate(Math.round(15 * intensity));
    void rumble(25, 0.2 * intensity, 0.3 * intensity);
  },
  levelUp(intensity: number) {
    if (supportsPhoneVibration()) navigator.vibrate([30, 40, 30, 40, 80].map((v) => Math.round(v * intensity)));
    void rumble(200, 0.4 * intensity, 0.9 * intensity);
  },
  test(intensity: number) {
    if (supportsPhoneVibration()) navigator.vibrate(Math.round(80 * intensity));
    void rumble(120, 0.5 * intensity, 0.8 * intensity);
  },
};

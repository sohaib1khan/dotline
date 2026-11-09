import { emitInput } from "@/input/bus";
import { DEFAULT_GAMEPAD_MAPPING, type GamepadMapping } from "@/input/mapping";

let raf = 0;
let mapping: GamepadMapping = DEFAULT_GAMEPAD_MAPPING;
const prevButtons = new Map<number, boolean[]>();
const heldDotsByPad = new Map<number, Set<number>>();
const prevAxisDir = new Map<number, "left" | "right" | "none">();

export function setGamepadMapping(next: GamepadMapping) {
  mapping = next;
}

export function getConnectedGamepads(): Gamepad[] {
  return navigator.getGamepads?.()
    ? Array.from(navigator.getGamepads()).filter((g): g is Gamepad => Boolean(g))
    : [];
}

function poll() {
  const pads = getConnectedGamepads();
  for (const pad of pads) {
    const prev = prevButtons.get(pad.index) ?? pad.buttons.map(() => false);
    const next = pad.buttons.map((b) => b.pressed);
    const held = heldDotsByPad.get(pad.index) ?? new Set<number>();

    for (const [buttonIndex, dot] of Object.entries(mapping.dots)) {
      const idx = Number(buttonIndex);
      const was = prev[idx] ?? false;
      const is = next[idx] ?? false;
      if (is && !was) {
        held.add(dot);
        emitInput({ type: "dotPress", dot, down: true, source: "gamepad" });
      }
      if (!is && was) {
        emitInput({ type: "dotPress", dot, down: false, source: "gamepad" });
      }
    }

    const anyDotHeld = Object.keys(mapping.dots).some((button) => next[Number(button)]);
    const wasAnyDotHeld = Object.keys(mapping.dots).some((button) => prev[Number(button)]);
    if (wasAnyDotHeld && !anyDotHeld && held.size > 0) {
      const dots = Array.from(held).sort((a, b) => a - b);
      held.clear();
      emitInput({ type: "brailleChord", dots, source: "gamepad" });
    }

    if ((next[mapping.confirm] ?? false) && !(prev[mapping.confirm] ?? false)) {
      emitInput({ type: "confirm", source: "gamepad" });
    }
    if ((next[mapping.back] ?? false) && !(prev[mapping.back] ?? false)) {
      emitInput({ type: "back", source: "gamepad" });
    }
    if ((next[mapping.hint] ?? false) && !(prev[mapping.hint] ?? false)) {
      emitInput({ type: "hint", source: "gamepad" });
    }
    if ((next[mapping.repeat] ?? false) && !(prev[mapping.repeat] ?? false)) {
      emitInput({ type: "repeat", source: "gamepad" });
    }

    const axisX = pad.axes[0] ?? 0;
    const dir: "left" | "right" | "none" = axisX > 0.6 ? "right" : axisX < -0.6 ? "left" : "none";
    const prevDir = prevAxisDir.get(pad.index) ?? "none";
    if (dir === "right" && prevDir !== "right") emitInput({ type: "next", source: "gamepad" });
    if (dir === "left" && prevDir !== "left") emitInput({ type: "prev", source: "gamepad" });
    prevAxisDir.set(pad.index, dir);

    heldDotsByPad.set(pad.index, held);
    prevButtons.set(pad.index, next);
  }
  raf = window.requestAnimationFrame(poll);
}

export function attachGamepadInput() {
  if (raf) return;
  raf = window.requestAnimationFrame(poll);
}

export function detachGamepadInput() {
  if (!raf) return;
  window.cancelAnimationFrame(raf);
  raf = 0;
  heldDotsByPad.clear();
  prevButtons.clear();
  prevAxisDir.clear();
}

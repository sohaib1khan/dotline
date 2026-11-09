import { emitInput } from "@/input/bus";
import { KEYBOARD_DOTS, KEYBOARD_NAV } from "@/input/mapping";

const heldDots = new Set<number>();
const heldKeys = new Set<string>();
let attached = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    return;
  }

  const key = event.key.toLowerCase();
  const dot = KEYBOARD_DOTS[key];
  if (dot) {
    event.preventDefault();
    if (!heldKeys.has(key)) {
      heldKeys.add(key);
      heldDots.add(dot);
      emitInput({ type: "dotPress", dot, down: true, source: "keyboard" });
    }
    return;
  }

  const nav = KEYBOARD_NAV[key];
  if (nav && key !== " ") {
    // Space is reserved as braille space chord terminator / space character in Perkins;
    // navigation confirm uses Enter primarily. Still allow Space as confirm when no dots held.
    event.preventDefault();
    emitInput({ type: nav, source: "keyboard" });
  } else if (key === " " && heldDots.size === 0) {
    event.preventDefault();
    emitInput({ type: "brailleChord", dots: [], source: "keyboard" });
  }
}

function onKeyUp(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const dot = KEYBOARD_DOTS[key];
  if (!dot) return;
  event.preventDefault();
  if (!heldKeys.has(key)) return;
  heldKeys.delete(key);
  emitInput({ type: "dotPress", dot, down: false, source: "keyboard" });
  if (heldKeys.size === 0 && heldDots.size > 0) {
    const dots = Array.from(heldDots).sort((a, b) => a - b);
    heldDots.clear();
    emitInput({ type: "brailleChord", dots, source: "keyboard" });
  }
}

export function attachKeyboardInput() {
  if (attached) return;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  attached = true;
}

export function detachKeyboardInput() {
  if (!attached) return;
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  heldDots.clear();
  heldKeys.clear();
  attached = false;
}

import type { InputAction, InputListener } from "@/input/types";

const listeners = new Set<InputListener>();
const recent: InputAction[] = [];
const MAX_RECENT = 50;

export function emitInput(action: InputAction) {
  recent.push(action);
  if (recent.length > MAX_RECENT) recent.shift();
  for (const listener of listeners) listener(action);
}

export function subscribeInput(listener: InputListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentInputActions(): InputAction[] {
  return [...recent];
}

export function clearRecentInputActions() {
  recent.length = 0;
}

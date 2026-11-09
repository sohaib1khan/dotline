/** Active-time heartbeat client: visible tab + recent input only. */

import { apiPost } from "@/lib/api";

const INTERVAL_MS = 30_000;
const IDLE_LIMIT_MS = 120_000;

let started = false;
let lastInputAt = 0;
let timer: number | null = null;
let currentPage = "/";
let currentTrack: "braille" | "cursive" | null = null;

function markInput() {
  lastInputAt = Date.now();
}

function trackFromPath(path: string): "braille" | "cursive" | null {
  if (path.includes("/braille")) return "braille";
  if (path.includes("/cursive")) return "cursive";
  return null;
}

async function sendHeartbeat() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastInputAt > IDLE_LIMIT_MS) return;
  try {
    await apiPost("/api/activity/heartbeat", {
      track: currentTrack,
      page: currentPage.slice(0, 200),
    });
  } catch {
    // Ignore transient heartbeat failures.
  }
}

export function setHeartbeatLocation(path: string) {
  currentPage = path;
  currentTrack = trackFromPath(path);
}

export function startHeartbeat() {
  if (started || typeof window === "undefined") return;
  started = true;
  lastInputAt = Date.now();

  const onInput = () => markInput();
  window.addEventListener("keydown", onInput, true);
  window.addEventListener("pointerdown", onInput, true);
  window.addEventListener("touchstart", onInput, true);
  window.addEventListener("mousemove", onInput, true);
  window.addEventListener("wheel", onInput, true);
  window.addEventListener("gamepadconnected", onInput);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") markInput();
  });

  timer = window.setInterval(() => {
    void sendHeartbeat();
  }, INTERVAL_MS);
}

export function stopHeartbeat() {
  if (timer != null) window.clearInterval(timer);
  timer = null;
  started = false;
}

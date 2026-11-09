/** Client action trail + error ring buffer for bug reports. */

const MAX_ACTIONS = 20;
const MAX_ERRORS = 20;

export type TelemetryAction = {
  at: string;
  type: "route" | "click" | "nav";
  label: string;
};

export type TelemetryError = {
  at: string;
  message: string;
  source?: string;
};

const actions: TelemetryAction[] = [];
const errors: TelemetryError[] = [];
let currentRoute = "/";
let started = false;

function pushAction(entry: TelemetryAction) {
  actions.push(entry);
  if (actions.length > MAX_ACTIONS) actions.shift();
}

function pushError(entry: TelemetryError) {
  errors.push(entry);
  if (errors.length > MAX_ERRORS) errors.shift();
}

export function recordRoute(path: string) {
  currentRoute = path;
  pushAction({ at: new Date().toISOString(), type: "route", label: path });
}

export function recordClick(label: string) {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!clean) return;
  pushAction({ at: new Date().toISOString(), type: "click", label: clean });
}

export function getRecentActions(): TelemetryAction[] {
  return [...actions];
}

export function getRecentErrors(): TelemetryError[] {
  return [...errors];
}

export function getCurrentRoute(): string {
  return currentRoute;
}

function detectOs(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "unknown";
}

function isPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function estimateZoom(): number {
  const ratio = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
  return Math.round(ratio * 100) / 100;
}

export type BugContext = {
  app_version: string;
  route: string;
  lesson_or_game: string | null;
  browser: string;
  os: string;
  device_type: string;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  device_pixel_ratio: number;
  browser_zoom_estimate: number;
  pwa_installed: boolean;
  online: boolean;
  user_agent: string;
  settings: Record<string, unknown>;
  gamepad: { connected: boolean; id: string | null };
  vibration_api: boolean;
  webgl: boolean;
  recent_actions: TelemetryAction[];
  recent_errors: TelemetryError[];
};

export function buildBugContext(input: {
  settings: Record<string, unknown>;
  gamepadId: string | null;
  lessonOrGame?: string | null;
}): BugContext {
  const ua = navigator.userAgent;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return {
    app_version: "0.1.0",
    route: currentRoute,
    lesson_or_game: input.lessonOrGame ?? null,
    browser: detectBrowser(ua),
    os: detectOs(ua),
    device_type: touch ? "touch" : "desktop",
    screen: { width: window.screen.width, height: window.screen.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    device_pixel_ratio: window.devicePixelRatio || 1,
    browser_zoom_estimate: estimateZoom(),
    pwa_installed: isPwa(),
    online: navigator.onLine,
    user_agent: ua.slice(0, 400),
    settings: input.settings,
    gamepad: { connected: Boolean(input.gamepadId), id: input.gamepadId },
    vibration_api: typeof navigator.vibrate === "function",
    webgl: webglSupported(),
    recent_actions: getRecentActions(),
    recent_errors: getRecentErrors(),
  };
}

export function startTelemetry() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener(
    "error",
    (event) => {
      pushError({
        at: new Date().toISOString(),
        message: event.message || "error",
        source: event.filename ? `${event.filename}:${event.lineno}` : undefined,
      });
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "unhandledrejection";
    pushError({ at: new Date().toISOString(), message: message.slice(0, 300) });
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest("button, a, [role='button'], summary");
      if (!interactive) return;
      const label =
        interactive.getAttribute("aria-label") ||
        interactive.textContent ||
        interactive.getAttribute("title") ||
        interactive.tagName;
      recordClick(label);
    },
    true,
  );
}

/** Client action trail + error ring buffer for bug reports. */

import { readLastRoom, roomFromPath } from "@/store/room";

const MAX_ACTIONS = 60;
const MAX_ERRORS = 40;
const MAX_ROUTE_TRAIL = 25;

/** Routes that are about reporting/settings — not the page the learner meant to report. */
const META_ROUTE_PREFIXES = ["/app/report", "/app/inbox"];

export type TelemetryAction = {
  at: string;
  type: "route" | "click" | "nav" | "note";
  label: string;
};

export type TelemetryError = {
  at: string;
  message: string;
  source?: string;
  stack?: string;
};

const actions: TelemetryAction[] = [];
const errors: TelemetryError[] = [];
const routeTrail: { at: string; path: string; title: string }[] = [];
let currentRoute = "/";
let problemRoute = "/";
let problemTitle = "";
let started = false;

function pushAction(entry: TelemetryAction) {
  actions.push(entry);
  if (actions.length > MAX_ACTIONS) actions.shift();
}

function pushError(entry: TelemetryError) {
  errors.push(entry);
  if (errors.length > MAX_ERRORS) errors.shift();
}

function isMetaRoute(path: string): boolean {
  const bare = path.split("?")[0] || path;
  return META_ROUTE_PREFIXES.some((prefix) => bare === prefix || bare.startsWith(`${prefix}/`));
}

function pageTitle(): string {
  if (typeof document === "undefined") return "";
  return (document.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

export function recordRoute(path: string) {
  currentRoute = path;
  const title = pageTitle();
  pushAction({ at: new Date().toISOString(), type: "route", label: path });
  routeTrail.push({ at: new Date().toISOString(), path, title });
  if (routeTrail.length > MAX_ROUTE_TRAIL) routeTrail.shift();

  if (!isMetaRoute(path)) {
    problemRoute = path;
    problemTitle = title;
  }
}

/** Call after navigation when document.title may have updated. */
export function refreshProblemTitle() {
  if (isMetaRoute(currentRoute)) return;
  const title = pageTitle();
  if (!title) return;
  problemTitle = title;
  const last = routeTrail[routeTrail.length - 1];
  if (last && last.path === currentRoute) last.title = title;
}

export function recordClick(label: string) {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!clean) return;
  pushAction({ at: new Date().toISOString(), type: "click", label: clean });
}

export function recordNote(label: string) {
  pushAction({
    at: new Date().toISOString(),
    type: "note",
    label: label.replace(/\s+/g, " ").trim().slice(0, 200),
  });
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

/** Page the learner was on before opening Report / Inbox. */
export function getProblemRoute(): string {
  return problemRoute || currentRoute;
}

export function getProblemTitle(): string {
  return problemTitle || pageTitle();
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

function browserVersion(ua: string): string | null {
  const match =
    ua.match(/Edg\/([\d.]+)/i) ||
    ua.match(/Chrome\/([\d.]+)/i) ||
    ua.match(/Version\/([\d.]+).*Safari/i) ||
    ua.match(/Firefox\/([\d.]+)/i);
  return match?.[1] ?? null;
}

function isPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function webglInfo(): { supported: boolean; vendor: string | null; renderer: string | null } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return { supported: false, vendor: null, renderer: null };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      supported: true,
      vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "") : null,
      renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : null,
    };
  } catch {
    return { supported: false, vendor: null, renderer: null };
  }
}

function estimateZoom(): number {
  const ratio = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
  return Math.round(ratio * 100) / 100;
}

function connectionInfo(): Record<string, unknown> | null {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const conn = nav.connection;
  if (!conn) return null;
  return {
    effective_type: conn.effectiveType ?? null,
    downlink_mbps: conn.downlink ?? null,
    rtt_ms: conn.rtt ?? null,
    save_data: Boolean(conn.saveData),
  };
}

function describeLessonOrGame(pathname: string): {
  kind: string | null;
  track: string | null;
  lesson_id: string | null;
  game_key: string | null;
  label: string | null;
} {
  const lesson = pathname.match(/\/app\/(braille|cursive)\/lessons\/([^/?#]+)/);
  if (lesson) {
    return {
      kind: "lesson",
      track: lesson[1]!,
      lesson_id: lesson[2]!,
      game_key: null,
      label: `${lesson[1]} lesson ${lesson[2]}`,
    };
  }
  if (pathname.startsWith("/app/cursive/signature")) {
    return {
      kind: "signature_studio",
      track: "cursive",
      lesson_id: null,
      game_key: null,
      label: "Signature Studio",
    };
  }
  const game = pathname.match(/\/app\/games\/([^/?#]+)/);
  if (game) {
    return {
      kind: "game",
      track: null,
      lesson_id: null,
      game_key: game[1]!,
      label: `game ${game[1]}`,
    };
  }
  if (pathname.startsWith("/app/braille")) {
    return { kind: "track", track: "braille", lesson_id: null, game_key: null, label: "Braille units" };
  }
  if (pathname.startsWith("/app/cursive")) {
    return { kind: "track", track: "cursive", lesson_id: null, game_key: null, label: "Cursive units" };
  }
  if (pathname.startsWith("/app/rooms/")) {
    const room = pathname.split("/")[3] ?? null;
    return { kind: "statusboard", track: room, lesson_id: null, game_key: null, label: room ? `${room} room` : "room" };
  }
  return { kind: null, track: null, lesson_id: null, game_key: null, label: null };
}

export type BugContext = {
  captured_at: string;
  app_version: string;
  /** Page the learner was trying to use (not /app/report). */
  reported_page: string;
  reported_page_title: string;
  /** Where the report form itself was opened. */
  report_form_route: string;
  route: string;
  lesson_or_game: string | null;
  activity: ReturnType<typeof describeLessonOrGame>;
  room: string | null;
  locale: string | null;
  time_zone: string | null;
  referrer: string | null;
  browser: string;
  browser_version: string | null;
  os: string;
  device_type: string;
  languages: string[];
  screen: { width: number; height: number; avail_width: number; avail_height: number; color_depth: number };
  viewport: { width: number; height: number };
  device_pixel_ratio: number;
  browser_zoom_estimate: number;
  orientation: string | null;
  pwa_installed: boolean;
  display_mode: string;
  online: boolean;
  connection: Record<string, unknown> | null;
  user_agent: string;
  settings: Record<string, unknown>;
  gamepad: { connected: boolean; id: string | null; count: number };
  vibration_api: boolean;
  webgl: boolean;
  webgl_vendor: string | null;
  webgl_renderer: string | null;
  visibility_state: string;
  route_trail: { at: string; path: string; title: string }[];
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
  const reported = getProblemRoute();
  const reportedBare = reported.split("?")[0] || reported;
  const activity = describeLessonOrGame(reportedBare);
  const webgl = webglInfo();
  const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  const padCount = pads ? Array.from(pads).filter(Boolean).length : 0;
  const room = roomFromPath(reportedBare) ?? readLastRoom();

  return {
    captured_at: new Date().toISOString(),
    app_version: "0.1.0",
    reported_page: reported,
    reported_page_title: getProblemTitle() || pageTitle(),
    report_form_route: currentRoute,
    route: reported,
    lesson_or_game: input.lessonOrGame ?? activity.label,
    activity,
    room,
    locale: navigator.language || null,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    referrer: document.referrer ? document.referrer.slice(0, 300) : null,
    browser: detectBrowser(ua),
    browser_version: browserVersion(ua),
    os: detectOs(ua),
    device_type: touch ? "touch" : "desktop",
    languages: [...(navigator.languages || [navigator.language].filter(Boolean))],
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      avail_width: window.screen.availWidth,
      avail_height: window.screen.availHeight,
      color_depth: window.screen.colorDepth,
    },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    device_pixel_ratio: window.devicePixelRatio || 1,
    browser_zoom_estimate: estimateZoom(),
    orientation: screen.orientation?.type ?? null,
    pwa_installed: isPwa(),
    display_mode: window.matchMedia("(display-mode: standalone)").matches
      ? "standalone"
      : window.matchMedia("(display-mode: minimal-ui)").matches
        ? "minimal-ui"
        : "browser",
    online: navigator.onLine,
    connection: connectionInfo(),
    user_agent: ua.slice(0, 500),
    settings: input.settings,
    gamepad: {
      connected: Boolean(input.gamepadId) || padCount > 0,
      id: input.gamepadId,
      count: padCount,
    },
    vibration_api: typeof navigator.vibrate === "function",
    webgl: webgl.supported,
    webgl_vendor: webgl.vendor,
    webgl_renderer: webgl.renderer,
    visibility_state: document.visibilityState,
    route_trail: [...routeTrail],
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
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        stack: event.error instanceof Error ? event.error.stack?.slice(0, 800) : undefined,
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
    pushError({
      at: new Date().toISOString(),
      message: message.slice(0, 400),
      stack: reason instanceof Error ? reason.stack?.slice(0, 800) : undefined,
    });
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

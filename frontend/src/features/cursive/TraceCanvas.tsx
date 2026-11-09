import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  canvasToView,
  nearestDistance,
  sampleGlyph,
  samplePath,
  viewToCanvas,
  type Point,
  type StrokeDef,
  VIEW_BOX,
} from "@/features/cursive/geometry";
import { feedback } from "@/feedback";
import { emitStrokeFromPointer } from "@/input/pointer";
import { usePreferences } from "@/store/preferences";

export type TraceMode = "watch" | "trace" | "free";

type Props = {
  strokes: StrokeDef[];
  mode: TraceMode;
  mirror?: boolean;
  guideOpacity?: number;
  onOffPath?: () => void;
  onStrokeEnd?: (points: Point[]) => void;
  watchKey?: string | number;
};

function smoothStroke(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    out.push({
      x: (prev.x + cur.x * 2 + next.x) / 4,
      y: (prev.y + cur.y * 2 + next.y) / 4,
      pressure: cur.pressure,
    });
  }
  out.push(points[points.length - 1]!);
  return out;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  angle: number,
  size: number,
  color: string,
  lineScale = 1,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * lineScale;
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.5);
  ctx.lineTo(-size * 0.65, 0);
  ctx.lineTo(-size, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function canvasPoint(
  view: Point,
  width: number,
  height: number,
  mirror: boolean,
): Point {
  const p = viewToCanvas(view, width, height);
  return mirror ? { x: width - p.x, y: p.y, pressure: p.pressure } : p;
}

/** Direction cues in screen space so numbers stay upright (not mirrored). */
function drawDirectionCues(
  ctx: CanvasRenderingContext2D,
  strokes: StrokeDef[],
  width: number,
  height: number,
  color: string,
  labelColor: string,
  mirror: boolean,
  dpr: number,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  const s = dpr;
  strokes.forEach((stroke, strokeIndex) => {
    const samples = samplePath(stroke.path, 40);
    if (samples.length < 4) return;

    const start = canvasPoint(samples[0]!, width, height, mirror);
    const ahead = canvasPoint(samples[Math.min(5, samples.length - 1)]!, width, height, mirror);
    const angle = Math.atan2(ahead.y - start.y, ahead.x - start.x);

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(start.x, start.y, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = labelColor;
    ctx.font = `700 ${Math.round(13 * s)}px Atkinson Hyperlegible, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(strokeIndex + 1), start.x, start.y + 0.5 * s);

    const midIdx = Math.floor(samples.length * 0.55);
    const a = canvasPoint(samples[midIdx]!, width, height, mirror);
    const b = canvasPoint(samples[Math.min(midIdx + 1, samples.length - 1)]!, width, height, mirror);
    const midAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = Math.cos(midAngle + Math.PI / 2) * 10 * s;
    const ny = Math.sin(midAngle + Math.PI / 2) * 10 * s;
    drawArrowHead(ctx, { x: a.x + nx, y: a.y + ny }, midAngle, 10 * s, color, s);

    drawArrowHead(
      ctx,
      {
        x: start.x + Math.cos(angle) * 20 * s,
        y: start.y + Math.sin(angle) * 20 * s,
      },
      angle,
      11 * s,
      color,
      s,
    );
  });
  ctx.restore();
}

function drawStartLabel(
  ctx: CanvasRenderingContext2D,
  at: Point,
  accent: string,
  ink: string,
  panel: string,
  dpr: number,
) {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  const label = "START";
  const s = dpr;
  ctx.font = `700 ${Math.round(15 * s)}px Atkinson Hyperlegible, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const padX = 8 * s;
  const metrics = ctx.measureText(label);
  const boxW = Math.ceil(metrics.width + padX * 2);
  const boxH = Math.round(24 * s);
  // Keep the pill on-canvas and upright (caller already undoes left-hand mirror).
  let x = Math.round(at.x + 18 * s);
  let y = Math.round(at.y - 30 * s);
  const canvas = ctx.canvas;
  if (x + boxW > canvas.width - 4 * s) x = Math.max(4 * s, Math.round(at.x - boxW - 12 * s));
  if (y - boxH / 2 < 4 * s) y = Math.round(at.y + 30 * s);
  if (y + boxH / 2 > canvas.height - 4 * s) y = Math.round(canvas.height - 4 * s - boxH / 2);
  ctx.fillStyle = panel;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2 * s;
  const top = y - boxH / 2;
  const r = 6 * s;
  ctx.beginPath();
  ctx.moveTo(x + r, top);
  ctx.lineTo(x + boxW - r, top);
  ctx.quadraticCurveTo(x + boxW, top, x + boxW, top + r);
  ctx.lineTo(x + boxW, top + boxH - r);
  ctx.quadraticCurveTo(x + boxW, top + boxH, x + boxW - r, top + boxH);
  ctx.lineTo(x + r, top + boxH);
  ctx.quadraticCurveTo(x, top + boxH, x, top + boxH - r);
  ctx.lineTo(x, top + r);
  ctx.quadraticCurveTo(x, top, x + r, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(label, x + padX, y);
  ctx.restore();
}

export function TraceCanvas({
  strokes,
  mode,
  mirror = false,
  guideOpacity = 1,
  onOffPath,
  onStrokeEnd,
  watchKey,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const points = useRef<Point[]>([]);
  const guide = useRef<Point[]>([]);
  const lastOff = useRef(0);
  const watchProgress = useRef(0);
  const reduceMotion = usePreferences((s) => s.settings.reduce_motion);
  const textScale = usePreferences((s) => s.settings.text_scale);
  const tolerance = 28 * (textScale / 100);
  const guideWidth = 5.5 * (textScale / 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const nextW = Math.max(1, Math.round(rect.width * dpr));
      const nextH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      redraw(watchProgress.current);
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    window.addEventListener("resize", syncSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, [strokes, watchKey, mode, reduceMotion, guideOpacity, mirror, textScale]);

  useEffect(() => {
    guide.current = sampleGlyph(strokes);
    points.current = [];
    watchProgress.current = 0;
    redraw(0);
  }, [strokes, watchKey]);

  useEffect(() => {
    // Live looping ghost pen in every stage so learners can follow the path.
    if (reduceMotion) {
      watchProgress.current = 1;
      redraw(1);
      return;
    }
    let frame = 0;
    let start = performance.now();
    const duration = mode === "watch" ? 2200 : 2600;
    const tick = (now: number) => {
      const cycle = ((now - start) % (duration + 500)) / duration;
      const t = Math.min(1, cycle);
      watchProgress.current = t;
      if (!drawing.current) redraw(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, strokes, watchKey, reduceMotion]);

  function redraw(watchT = watchProgress.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--color-accent").trim() || "#6fbfab";
    const ink = styles.getPropertyValue("--color-ink").trim() || "#f4f7fb";
    const panel = styles.getPropertyValue("--color-panel").trim() || "#101a2b";
    const border = styles.getPropertyValue("--color-border").trim() || "#3d4f68";
    const accentInk = styles.getPropertyValue("--color-accent-ink").trim() || "#06201c";
    const surface2 = styles.getPropertyValue("--color-surface-2").trim() || panel;
    const cssW = canvas.getBoundingClientRect().width || canvas.width;
    const dpr = Math.max(1, canvas.width / Math.max(1, cssW));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    wash.addColorStop(0, panel);
    wash.addColorStop(1, surface2);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = canvas.width / VIEW_BOX.width;
    const sy = canvas.height / VIEW_BOX.height;

    // Writing lines (symmetric — no mirror needed)
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5 * dpr;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(20 * sx, 128 * sy);
    ctx.lineTo(180 * sx, 128 * sy);
    ctx.moveTo(20 * sx, 96 * sy);
    ctx.lineTo(180 * sx, 96 * sy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const effectiveGuide = mode === "free" ? Math.max(guideOpacity, 0.5) : guideOpacity;

    // Paths only inside the mirror transform — never text (mirrored glyphs look like “starf”).
    ctx.save();
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    if (effectiveGuide > 0.05) {
      // Crisp solid guide only — no glow / dash beads (those looked fuzzy).
      ctx.save();
      ctx.globalAlpha = mode === "free" ? Math.min(effectiveGuide, 0.5) : Math.min(effectiveGuide, 1);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(3.5, guideWidth);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      for (const stroke of strokes) {
        const path = new Path2D(stroke.path);
        ctx.save();
        ctx.scale(sx, sy);
        ctx.stroke(path);
        ctx.restore();
      }
      // Inner ink edge for contrast without blur
      ctx.globalAlpha = mode === "free" ? 0.25 : 0.4;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, guideWidth * 0.35);
      for (const stroke of strokes) {
        const path = new Path2D(stroke.path);
        ctx.save();
        ctx.scale(sx, sy);
        ctx.stroke(path);
        ctx.restore();
      }
      ctx.restore();
    }

    // Animated ghost pen — always on so free/trace still show how to move.
    if (guide.current.length > 1 && watchT > 0) {
      const count = Math.max(2, Math.floor(guide.current.length * watchT));
      ctx.beginPath();
      ctx.strokeStyle = ink;
      ctx.globalAlpha = mode === "free" ? 0.85 : 1;
      ctx.lineWidth = (guideWidth + (mode === "watch" ? 1.5 : 1)) * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      const first = viewToCanvas(guide.current[0]!, canvas.width, canvas.height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < count; i += 1) {
        const p = viewToCanvas(guide.current[i]!, canvas.width, canvas.height);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      const tip = viewToCanvas(guide.current[count - 1]!, canvas.width, canvas.height);
      const prev = viewToCanvas(
        guide.current[Math.max(0, count - 2)]!,
        canvas.width,
        canvas.height,
      );
      const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 7 * dpr, 0, Math.PI * 2);
      ctx.fill();
      drawArrowHead(ctx, tip, angle, 14 * dpr, accent, dpr);
    }

    const inkPoints = smoothStroke(points.current);
    if (inkPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = ink;
      ctx.lineWidth = (guideWidth + 1.5) * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.moveTo(inkPoints[0]!.x, inkPoints[0]!.y);
      for (let i = 1; i < inkPoints.length - 1; i += 1) {
        const midX = (inkPoints[i]!.x + inkPoints[i + 1]!.x) / 2;
        const midY = (inkPoints[i]!.y + inkPoints[i + 1]!.y) / 2;
        ctx.quadraticCurveTo(inkPoints[i]!.x, inkPoints[i]!.y, midX, midY);
      }
      const last = inkPoints[inkPoints.length - 1]!;
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Labels / badges in upright screen space
    if (effectiveGuide > 0.05) {
      ctx.save();
      ctx.globalAlpha = mode === "free" ? 0.85 : 1;
      drawDirectionCues(ctx, strokes, canvas.width, canvas.height, accent, accentInk, mirror, dpr);
      ctx.restore();
    }
    if (mode !== "watch" && guide.current.length > 0) {
      const start = canvasPoint(guide.current[0]!, canvas.width, canvas.height, mirror);
      drawStartLabel(ctx, start, accent, ink, panel, dpr);
    }
  }

  function pointerPos(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      pressure: event.pressure || 0.5,
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (mode === "watch") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [pointerPos(event)];
    emitStrokeFromPointer(event.nativeEvent, event.currentTarget.getBoundingClientRect(), "start");
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || mode === "watch") return;
    event.preventDefault();
    const point = pointerPos(event);
    const prev = points.current[points.current.length - 1];
    if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 1.2) return;
    points.current.push(point);
    emitStrokeFromPointer(event.nativeEvent, event.currentTarget.getBoundingClientRect(), "move");
    const view = canvasToView(point, event.currentTarget.width, event.currentTarget.height);
    if (mode === "trace" && nearestDistance(view, guide.current) > tolerance) {
      if (Date.now() - lastOff.current > 160) {
        lastOff.current = Date.now();
        feedback.offPath();
        onOffPath?.();
      }
    }
    redraw();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    emitStrokeFromPointer(event.nativeEvent, event.currentTarget.getBoundingClientRect(), "end");
    const mapped = smoothStroke(points.current).map((p) =>
      canvasToView(p, event.currentTarget.width, event.currentTarget.height),
    );
    onStrokeEnd?.(mapped);
  }

  return (
    <canvas
      ref={canvasRef}
      className={`cursive-canvas cursive-canvas-stage${mirror ? " is-mirrored-helper" : ""}`}
      aria-label={
        mode === "watch"
          ? "Watch the looping ghost pen and direction arrows"
          : "Trace on the canvas — follow the live ghost pen from START"
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

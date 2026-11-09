import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { feedback } from "@/feedback";
import { emitStrokeFromPointer } from "@/input/pointer";
import { usePreferences } from "@/store/preferences";

const GUIDE =
  "M 120 95 C 120 55, 70 45, 55 75 C 42 102, 70 125, 100 118 C 125 112, 135 95, 132 78 L 132 130";

const GUIDE_POINTS: { x: number; y: number }[] = [
  { x: 120, y: 90 },
  { x: 100, y: 60 },
  { x: 70, y: 58 },
  { x: 52, y: 80 },
  { x: 58, y: 108 },
  { x: 85, y: 122 },
  { x: 112, y: 112 },
  { x: 128, y: 90 },
  { x: 132, y: 110 },
  { x: 132, y: 130 },
];

const W = 480;
const H = 320;

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function smooth(points: { x: number; y: number }[]) {
  if (points.length < 3) return points;
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    out.push({
      x: (prev.x + cur.x * 2 + next.x) / 4,
      y: (prev.y + cur.y * 2 + next.y) / 4,
    });
  }
  out.push(points[points.length - 1]!);
  return out;
}

export function CursiveMiniDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const lastOffPathAt = useRef(0);
  const ghostT = useRef(0);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const reduceMotion = usePreferences((s) => s.settings.reduce_motion);

  useEffect(() => {
    redraw(0);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const cycle = ((now - start) % 2400) / 2400;
      ghostT.current = cycle;
      if (!drawing.current) redraw(cycle);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  function redraw(ghost = ghostT.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, canvas, points.current, ghost, reduceMotion);
  }

  function pointerPos(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function emitStroke(event: ReactPointerEvent<HTMLCanvasElement>, phase: "start" | "move" | "end") {
    const canvas = canvasRef.current;
    if (!canvas) return;
    emitStrokeFromPointer(event.nativeEvent, canvas.getBoundingClientRect(), phase);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [pointerPos(event)];
    setResult("idle");
    emitStroke(event, "start");
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const point = pointerPos(event);
    const prev = points.current[points.current.length - 1];
    if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 1.4) return;
    points.current.push(point);
    emitStroke(event, "move");
    if (isOffPath(point) && Date.now() - lastOffPathAt.current > 180) {
      lastOffPathAt.current = Date.now();
      feedback.offPath();
    }
    redraw();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    emitStroke(event, "end");
    const score = scoreTrace(smooth(points.current));
    if (score >= 0.5) {
      setResult("correct");
      feedback.correct("Nice tracing.");
    } else {
      setResult("wrong");
      feedback.wrong("Stay closer to the guide.");
    }
  }

  function clear() {
    points.current = [];
    setResult("idle");
    redraw();
  }

  return (
    <div className="demo-block demo-cursive" aria-labelledby="cursive-demo-title">
      <h2 id="cursive-demo-title" className="demo-title">
        Trace the letter a
      </h2>
      <p className="page-copy">
        <strong>Start on the glowing dot.</strong> Drag with your mouse, finger, or stylus along the
        dashed guide.
      </p>
      <div className={`trace-stage${result === "correct" ? " is-success" : ""}${result === "wrong" ? " is-wrong" : ""}`}>
        <canvas
          ref={canvasRef}
          className="cursive-canvas"
          width={W}
          height={H}
          aria-label="Cursive tracing canvas for letter a"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="demo-actions">
        <button className="secondary-button" type="button" onClick={clear}>
          Clear stroke
        </button>
      </div>
      {result === "correct" ? (
        <p className="success-text demo-result" role="status">
          Nice tracing — that reads as a.
        </p>
      ) : null}
      {result === "wrong" ? (
        <p className="field-error demo-result" role="status">
          Try again — stay closer to the glowing guide.
        </p>
      ) : null}
    </div>
  );
}

function isOffPath(point: { x: number; y: number }) {
  const mapped = { x: (point.x / W) * 200, y: (point.y / H) * 160 };
  let best = Infinity;
  for (const guide of GUIDE_POINTS) {
    best = Math.min(best, distance(mapped.x, mapped.y, guide.x, guide.y));
  }
  return best > 32;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stroke: { x: number; y: number }[],
  ghost: number,
  reduceMotion: boolean,
) {
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--color-accent").trim() || "#6fbfab";
  const ink = styles.getPropertyValue("--color-ink").trim() || "#f4f7fb";
  const panel = styles.getPropertyValue("--color-panel").trim() || "#101a2b";
  const surface2 = styles.getPropertyValue("--color-surface-2").trim() || panel;
  const border = styles.getPropertyValue("--color-border").trim() || "#3d4f68";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, panel);
  wash.addColorStop(1, surface2);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sx = canvas.width / 200;
  const sy = canvas.height / 160;

  ctx.strokeStyle = border;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24 * sx, 128 * sy);
  ctx.lineTo(176 * sx, 128 * sy);
  ctx.moveTo(24 * sx, 96 * sy);
  ctx.lineTo(176 * sx, 96 * sy);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const path = new Path2D(GUIDE);
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([8, 8]);
  ctx.shadowColor = accent;
  ctx.shadowBlur = reduceMotion ? 0 : 12;
  ctx.stroke(path);
  ctx.restore();

  const start = GUIDE_POINTS[0]!;
  const pulse = reduceMotion ? 1 : 0.75 + Math.sin(ghost * Math.PI * 2) * 0.25;
  ctx.beginPath();
  ctx.fillStyle = accent;
  ctx.arc(start.x * sx, start.y * sy, 10 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = ink;
  ctx.arc(start.x * sx, start.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  if (!reduceMotion && stroke.length === 0) {
    const idx = Math.min(GUIDE_POINTS.length - 1, Math.floor(ghost * (GUIDE_POINTS.length - 1)));
    const tip = GUIDE_POINTS[idx]!;
    ctx.beginPath();
    ctx.fillStyle = ink;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.arc(tip.x * sx, tip.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const inkStroke = smooth(stroke);
  if (inkStroke.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = ink;
    ctx.shadowColor = accent;
    ctx.shadowBlur = reduceMotion ? 0 : 6;
    ctx.moveTo(inkStroke[0]!.x, inkStroke[0]!.y);
    for (let i = 1; i < inkStroke.length - 1; i += 1) {
      const midX = (inkStroke[i]!.x + inkStroke[i + 1]!.x) / 2;
      const midY = (inkStroke[i]!.y + inkStroke[i + 1]!.y) / 2;
      ctx.quadraticCurveTo(inkStroke[i]!.x, inkStroke[i]!.y, midX, midY);
    }
    const last = inkStroke[inkStroke.length - 1]!;
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function scoreTrace(stroke: { x: number; y: number }[]): number {
  if (stroke.length < 8) return 0;
  const mapped = stroke.map((p) => ({
    x: (p.x / W) * 200,
    y: (p.y / H) * 160,
  }));
  let hits = 0;
  for (const guide of GUIDE_POINTS) {
    let best = Infinity;
    for (const point of mapped) {
      best = Math.min(best, distance(point.x, point.y, guide.x, guide.y));
    }
    if (best <= 22) hits += 1;
  }
  return hits / GUIDE_POINTS.length;
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Simple cursive-ish "a" guide path in viewBox 0 0 200 160 */
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

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export function CursiveMiniDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");

  useEffect(() => {
    redraw();
  }, []);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, canvas, points.current);
  }

  function pointerPos(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [pointerPos(event)];
    setResult("idle");
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    points.current.push(pointerPos(event));
    redraw();
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const score = scoreTrace(points.current);
    setResult(score >= 0.55 ? "correct" : "wrong");
  }

  function clear() {
    points.current = [];
    setResult("idle");
    redraw();
  }

  return (
    <div className="demo-block" aria-labelledby="cursive-demo-title">
      <h2 id="cursive-demo-title" className="demo-title">
        Cursive: trace the letter a
      </h2>
      <p className="page-copy">Follow the guide with mouse, finger, or stylus.</p>
      <canvas
        ref={canvasRef}
        className="cursive-canvas"
        width={360}
        height={240}
        aria-label="Cursive tracing canvas for letter a"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <button className="secondary-button" type="button" onClick={clear}>
        Clear
      </button>
      {result === "correct" ? (
        <p className="success-text" role="status">
          Nice tracing — that reads as a.
        </p>
      ) : null}
      {result === "wrong" ? (
        <p className="field-error" role="status">
          Try again — stay closer to the glowing guide.
        </p>
      ) : null}
    </div>
  );
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stroke: { x: number; y: number }[],
) {
  const styles = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = styles.getPropertyValue("--color-panel").trim() || "#101a2b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const path = new Path2D(GUIDE);
  ctx.save();
  ctx.scale(canvas.width / 200, canvas.height / 160);
  ctx.strokeStyle = styles.getPropertyValue("--color-accent").trim() || "#2dd4bf";
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.stroke(path);
  ctx.restore();

  if (stroke.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = styles.getPropertyValue("--color-ink").trim() || "#f4f7fb";
    ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
    for (let i = 1; i < stroke.length; i += 1) {
      ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
    }
    ctx.stroke();
  }
}

function scoreTrace(stroke: { x: number; y: number }[]): number {
  if (stroke.length < 8) return 0;
  const mapped = stroke.map((p) => ({
    x: (p.x / 360) * 200,
    y: (p.y / 240) * 160,
  }));

  let hits = 0;
  for (const guide of GUIDE_POINTS) {
    let best = Infinity;
    for (const point of mapped) {
      best = Math.min(best, distance(point.x, point.y, guide.x, guide.y));
    }
    if (best <= 18) hits += 1;
  }
  return hits / GUIDE_POINTS.length;
}

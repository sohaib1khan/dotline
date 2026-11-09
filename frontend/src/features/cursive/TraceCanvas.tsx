import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  canvasToView,
  nearestDistance,
  sampleGlyph,
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
  const tolerance = 22 * (textScale / 100);
  const guideWidth = 5 * (textScale / 100);

  useEffect(() => {
    guide.current = sampleGlyph(strokes);
    points.current = [];
    watchProgress.current = 0;
    redraw(0);
  }, [strokes, watchKey]);

  useEffect(() => {
    if (mode !== "watch") return;
    let frame = 0;
    let start = performance.now();
    const duration = reduceMotion ? 400 : 1800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      watchProgress.current = t;
      redraw(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, strokes, watchKey, reduceMotion]);

  function redraw(watchT = watchProgress.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const styles = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = styles.getPropertyValue("--color-panel").trim() || "#101a2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    const sx = canvas.width / VIEW_BOX.width;
    const sy = canvas.height / VIEW_BOX.height;

    // Baseline helpers
    ctx.strokeStyle = styles.getPropertyValue("--color-border").trim() || "#3d4f68";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20 * sx, 128 * sy);
    ctx.lineTo(180 * sx, 128 * sy);
    ctx.stroke();

    if (mode !== "free" || guideOpacity > 0.05) {
      ctx.save();
      ctx.globalAlpha = mode === "free" ? Math.min(guideOpacity, 0.25) : guideOpacity;
      ctx.strokeStyle = styles.getPropertyValue("--color-accent").trim() || "#2dd4bf";
      ctx.lineWidth = guideWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(mode === "watch" ? [] : [10, 8]);
      for (const stroke of strokes) {
        const path = new Path2D(stroke.path);
        ctx.save();
        ctx.scale(sx, sy);
        ctx.stroke(path);
        ctx.restore();
      }
      ctx.restore();
    }

    if (mode === "watch" && guide.current.length > 1) {
      const count = Math.max(2, Math.floor(guide.current.length * watchT));
      ctx.beginPath();
      ctx.strokeStyle = styles.getPropertyValue("--color-ink").trim() || "#f4f7fb";
      ctx.lineWidth = guideWidth + 1;
      ctx.lineCap = "round";
      const first = viewToCanvas(guide.current[0]!, canvas.width, canvas.height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < count; i += 1) {
        const p = viewToCanvas(guide.current[i]!, canvas.width, canvas.height);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const tip = viewToCanvas(guide.current[count - 1]!, canvas.width, canvas.height);
      ctx.fillStyle = styles.getPropertyValue("--color-accent").trim() || "#2dd4bf";
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (points.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = styles.getPropertyValue("--color-ink").trim() || "#f4f7fb";
      ctx.lineWidth = guideWidth + 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.moveTo(points.current[0]!.x, points.current[0]!.y);
      for (let i = 1; i < points.current.length; i += 1) {
        ctx.lineTo(points.current[i]!.x, points.current[i]!.y);
      }
      ctx.stroke();
    }
    ctx.restore();
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
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [pointerPos(event)];
    emitStrokeFromPointer(event.nativeEvent, event.currentTarget.getBoundingClientRect(), "start");
    redraw();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || mode === "watch") return;
    const point = pointerPos(event);
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
    const mapped = points.current.map((p) =>
      canvasToView(p, event.currentTarget.width, event.currentTarget.height),
    );
    onStrokeEnd?.(mapped);
  }

  return (
    <canvas
      ref={canvasRef}
      className={`cursive-canvas${mirror ? " is-mirrored-helper" : ""}`}
      width={520}
      height={360}
      aria-label={mode === "watch" ? "Watch the ghost pen" : "Trace on the canvas"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

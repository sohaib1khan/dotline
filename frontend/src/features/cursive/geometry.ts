export type Point = { x: number; y: number; pressure?: number };

export type StrokeDef = {
  path: string;
  direction?: string;
};

export type GlyphDef = {
  speak: string;
  case?: string;
  strokes: StrokeDef[];
};

export const VIEW_BOX = { width: 200, height: 160 };

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Sample an SVG path into evenly spaced points using Path2D + DOM path element. */
export function samplePath(pathData: string, samples = 48): Point[] {
  if (typeof document === "undefined") return [];
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", pathData);
  const length = el.getTotalLength();
  if (!length) return [];
  const points: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const pt = el.getPointAtLength((i / samples) * length);
    points.push({ x: pt.x, y: pt.y });
  }
  return points;
}

export function sampleGlyph(strokes: StrokeDef[], samplesPerStroke = 48): Point[] {
  return strokes.flatMap((stroke) => samplePath(stroke.path, samplesPerStroke));
}

export function resample(points: Point[], count: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: count }, () => ({ ...points[0]! }));
  const distances = [0];
  for (let i = 1; i < points.length; i += 1) {
    distances.push(distances[i - 1]! + distance(points[i - 1]!, points[i]!));
  }
  const total = distances[distances.length - 1] || 1;
  const out: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const target = (i / (count - 1)) * total;
    let idx = 1;
    while (idx < distances.length && distances[idx]! < target) idx += 1;
    const a = points[idx - 1]!;
    const b = points[Math.min(idx, points.length - 1)]!;
    const d0 = distances[idx - 1]!;
    const d1 = distances[Math.min(idx, distances.length - 1)]!;
    const t = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

export function scoreAgainstGuide(
  learner: Point[],
  guide: Point[],
  options?: { startTolerance?: number; shapeTolerance?: number },
): { score: number; feedback: string; startOk: boolean; directionOk: boolean } {
  const startTolerance = options?.startTolerance ?? 22;
  const shapeTolerance = options?.shapeTolerance ?? 18;
  if (learner.length < 6 || guide.length < 6) {
    return { score: 0, feedback: "Draw a longer stroke.", startOk: false, directionOk: false };
  }

  const mappedLearner = learner;
  const startOk = distance(mappedLearner[0]!, guide[0]!) <= startTolerance;
  const endGuide = guide[guide.length - 1]!;
  const endLearner = mappedLearner[mappedLearner.length - 1]!;
  const reverseStart = distance(mappedLearner[0]!, endGuide) < distance(mappedLearner[0]!, guide[0]!);
  const directionOk = !reverseStart && distance(endLearner, endGuide) < distance(endLearner, guide[0]!) * 1.4;

  const a = resample(mappedLearner, 40);
  const b = resample(guide, 40);
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += distance(a[i]!, b[i]!);
  }
  const avg = sum / a.length;
  let shape = Math.max(0, 1 - avg / (shapeTolerance * 2.2));
  if (!startOk) shape *= 0.75;
  if (!directionOk) shape *= 0.85;
  const score = Math.round(shape * 100);

  let feedback = "Nice tracing.";
  if (!startOk) feedback = "Start closer to the beginning of the guide.";
  else if (!directionOk) feedback = "Check your direction — follow the ghost pen.";
  else if (score < 55) feedback = "Stay closer to the guide path.";
  else if (avg > shapeTolerance) feedback = "A little too wide — tighten the curves.";

  return { score, feedback, startOk, directionOk };
}

export function nearestDistance(point: Point, guide: Point[]) {
  let best = Infinity;
  for (const g of guide) best = Math.min(best, distance(point, g));
  return best;
}

export function canvasToView(point: Point, width: number, height: number): Point {
  return {
    x: (point.x / width) * VIEW_BOX.width,
    y: (point.y / height) * VIEW_BOX.height,
    pressure: point.pressure,
  };
}

export function viewToCanvas(point: Point, width: number, height: number): Point {
  return {
    x: (point.x / VIEW_BOX.width) * width,
    y: (point.y / VIEW_BOX.height) * height,
    pressure: point.pressure,
  };
}

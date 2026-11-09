import { TraceCanvas, type TraceMode } from "@/features/cursive/TraceCanvas";
import type { Point, StrokeDef } from "@/features/cursive/geometry";

type Props = {
  strokes: StrokeDef[];
  mode: TraceMode;
  mirror?: boolean;
  onOffPath?: () => void;
  onStrokeEnd?: (points: Point[]) => void;
  watchKey?: string | number;
};

/**
 * Single interactive writing surface.
 * (Previously split into a non-interactive 3D box + small canvas — that empty
 * top box looked broken and stole space. Guidance now lives on the canvas.)
 */
export function TraceScene3D(props: Props) {
  const freeGuide = props.mode === "free" ? 0.55 : 1;
  return (
    <div className="cursive-3d-shell">
      <TraceCanvas {...props} guideOpacity={freeGuide} />
      <p className="meter cursive-guide-hint">
        <strong>
          {props.mode === "watch"
            ? "Watch the looping ghost pen — it shows the path live"
            : props.mode === "trace"
              ? "Start at START · follow the live ghost pen"
              : "Free write · the ghost pen keeps showing the path"}
        </strong>
      </p>
    </div>
  );
}

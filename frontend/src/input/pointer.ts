import { emitInput } from "@/input/bus";

export function emitStrokeFromPointer(
  event: PointerEvent | { clientX: number; clientY: number; pressure?: number },
  bounds: DOMRect,
  phase: "start" | "move" | "end",
) {
  const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
  const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
  const pressure = "pressure" in event && typeof event.pressure === "number" ? event.pressure : 0.5;
  emitInput({
    type: "strokePoint",
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    pressure,
    phase,
    source: "pointer",
  });
}

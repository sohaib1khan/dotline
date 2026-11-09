import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { sampleGlyph, type Point, type StrokeDef, VIEW_BOX } from "@/features/cursive/geometry";
import { TraceCanvas, type TraceMode } from "@/features/cursive/TraceCanvas";
import { usePreferences } from "@/store/preferences";

type Props = {
  strokes: StrokeDef[];
  mode: TraceMode;
  mirror?: boolean;
  onOffPath?: () => void;
  onStrokeEnd?: (points: Point[]) => void;
  watchKey?: string | number;
};

function Ribbon({ points, color }: { points: Point[]; color: string }) {
  const positions = useMemo(
    () =>
      points.map((p) => {
        const x = (p.x / VIEW_BOX.width) * 4 - 2;
        const y = 1.2 - (p.y / VIEW_BOX.height) * 2.4;
        return [x, y, 0.05] as [number, number, number];
      }),
    [points],
  );
  if (positions.length < 2) return null;
  return <Line points={positions} color={color} lineWidth={4} />;
}

function GuideRibbon({ strokes }: { strokes: StrokeDef[] }) {
  const guide = useMemo(() => sampleGlyph(strokes), [strokes]);
  return <Ribbon points={guide} color="#2dd4bf" />;
}

function Slate() {
  return (
    <mesh rotation={[-0.35, 0, 0]} position={[0, 0, 0]}>
      <boxGeometry args={[4.6, 3.2, 0.12]} />
      <meshStandardMaterial color="#1b2a40" />
    </mesh>
  );
}

export function TraceScene3D(props: Props) {
  const reducedVisuals = usePreferences((s) => s.settings.reduced_visuals);

  if (reducedVisuals) {
    return <TraceCanvas {...props} />;
  }

  return (
    <div className="cursive-3d-shell">
      <div className="cursive-3d-stage" aria-hidden="true">
        <Canvas camera={{ position: [0, 0.55, 4.4], fov: 40 }} dpr={[1, 1.5]}>
          <color attach="background" args={["#0b1220"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2, 3, 4]} intensity={1.05} />
          <Suspense fallback={null}>
            <Slate />
            <group rotation={[-0.35, 0, 0]}>
              <GuideRibbon strokes={props.strokes} />
            </group>
          </Suspense>
        </Canvas>
      </div>
      <TraceCanvas {...props} />
      <p className="meter">
        <strong>3D guide above</strong> · draw on the canvas · turn on Reduced visuals for flat-only
      </p>
    </div>
  );
}

export type BrailleChordAction = {
  type: "brailleChord";
  dots: number[];
  source: "keyboard" | "touch" | "gamepad";
};

export type NavAction = {
  type: "confirm" | "back" | "next" | "prev" | "hint" | "repeat";
  source: "keyboard" | "touch" | "gamepad";
};

export type StrokePointAction = {
  type: "strokePoint";
  x: number;
  y: number;
  pressure: number;
  phase: "start" | "move" | "end";
  source: "pointer";
};

export type DotPressAction = {
  type: "dotPress";
  dot: number;
  down: boolean;
  source: "keyboard" | "touch" | "gamepad";
};

export type InputAction = BrailleChordAction | NavAction | StrokePointAction | DotPressAction;

export type InputListener = (action: InputAction) => void;

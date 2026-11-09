/** Default Perkins-style keyboard and gamepad mappings. */

export const KEYBOARD_DOTS: Record<string, number> = {
  f: 1,
  d: 2,
  s: 3,
  j: 4,
  k: 5,
  l: 6,
};

export const KEYBOARD_NAV: Record<string, "confirm" | "back" | "next" | "prev" | "hint" | "repeat"> = {
  enter: "confirm",
  " ": "confirm",
  escape: "back",
  arrowright: "next",
  arrowleft: "prev",
  h: "hint",
  r: "repeat",
};

/**
 * Default gamepad mapping (standard browser Gamepad API indices):
 * left cluster → dots 1-2-3, right cluster → dots 4-5-6
 */
export const DEFAULT_GAMEPAD_MAPPING = {
  dots: {
    4: 1, // LB / L1 → dot 1
    0: 2, // A / cross → dot 2
    1: 3, // B / circle → dot 3
    5: 4, // RB / R1 → dot 4
    2: 5, // X / square → dot 5
    3: 6, // Y / triangle → dot 6
  } as Record<number, number>,
  confirm: 9, // Start
  back: 8, // Select/Back
  next: "axis-right" as const,
  prev: "axis-left" as const,
  hint: 12, // D-pad up
  repeat: 13, // D-pad down
};

export type GamepadMapping = typeof DEFAULT_GAMEPAD_MAPPING;

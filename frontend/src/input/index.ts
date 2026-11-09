import { attachGamepadInput, detachGamepadInput, getConnectedGamepads, setGamepadMapping } from "@/input/gamepad";
import { attachKeyboardInput, detachKeyboardInput } from "@/input/keyboard";
import { clearRecentInputActions, getRecentInputActions, subscribeInput } from "@/input/bus";
import { DEFAULT_GAMEPAD_MAPPING } from "@/input/mapping";

export {
  subscribeInput,
  getRecentInputActions,
  clearRecentInputActions,
  getConnectedGamepads,
  setGamepadMapping,
  DEFAULT_GAMEPAD_MAPPING,
};

export function startInputLayer() {
  attachKeyboardInput();
  attachGamepadInput();
}

export function stopInputLayer() {
  detachKeyboardInput();
  detachGamepadInput();
}

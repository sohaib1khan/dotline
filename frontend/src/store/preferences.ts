import { create } from "zustand";
import type { UserSettings } from "@/lib/types";
import { applyDocumentPreferences, type ThemeName } from "@/theme/tokens";

type PreferencesState = {
  settings: UserSettings;
  setSettings: (settings: Partial<UserSettings>) => void;
  hydrate: (settings: UserSettings) => void;
};

const DEFAULT_SETTINGS: UserSettings = {
  text_scale: 100,
  theme: "high_contrast_dark",
  reduce_motion: false,
  reduced_visuals: false,
  volume: 0.8,
  speech_rate: 1,
  speech_enabled: true,
  haptics_enabled: true,
  haptics_intensity: 0.7,
  handedness: "right",
  gamepad_mapping: null,
};

function syncDom(settings: UserSettings) {
  applyDocumentPreferences(settings.theme, settings.text_scale, settings.reduce_motion);
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (partial) => {
    const next = { ...get().settings, ...partial };
    syncDom(next);
    set({ settings: next });
  },
  hydrate: (settings) => {
    syncDom(settings);
    set({ settings });
  },
}));

export function themeLabel(theme: ThemeName): string {
  if (theme === "high_contrast_light") return "High-contrast light";
  if (theme === "yellow_on_black") return "Yellow on black";
  return "High-contrast dark";
}

import { create } from "zustand";
import type { UserSettings } from "@/lib/types";
import { applyDocumentPreferences, type ThemeName } from "@/theme/tokens";

type PreferencesState = {
  settings: UserSettings;
  setSettings: (settings: Partial<UserSettings>) => void;
  hydrate: (settings: UserSettings) => void;
};

const STORAGE_KEY = "dotline.guestPreferences";

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

function loadGuestSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function syncDom(settings: UserSettings) {
  applyDocumentPreferences(settings.theme, settings.text_scale, settings.reduce_motion);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: settings.theme,
        text_scale: settings.text_scale,
        reduce_motion: settings.reduce_motion,
        reduced_visuals: settings.reduced_visuals,
      }),
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}

const initial = loadGuestSettings();
syncDom(initial);

export const usePreferences = create<PreferencesState>((set, get) => ({
  settings: initial,
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

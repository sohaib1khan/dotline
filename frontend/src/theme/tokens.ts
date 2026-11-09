export type ThemeName = "high_contrast_dark" | "high_contrast_light" | "yellow_on_black";

export const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "high_contrast_dark", label: "High-contrast dark" },
  { value: "high_contrast_light", label: "High-contrast light" },
  { value: "yellow_on_black", label: "Yellow on black" },
];

export const TEXT_SCALE_OPTIONS = [100, 125, 150, 175, 200, 250, 300] as const;

export function applyDocumentPreferences(theme: ThemeName, textScale: number, reduceMotion: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty("--text-scale", String(textScale / 100));
  root.dataset.reduceMotion = reduceMotion ? "true" : "false";
  const themeColor =
    theme === "high_contrast_light" ? "#f4f7fb" : theme === "yellow_on_black" ? "#000000" : "#0b1220";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColor);
}

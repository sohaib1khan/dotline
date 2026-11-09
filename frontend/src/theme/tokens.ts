export type ThemeName = "high_contrast_dark" | "high_contrast_light" | "yellow_on_black";

export const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "high_contrast_dark", label: "Wetland night" },
  { value: "high_contrast_light", label: "Mist marsh" },
  { value: "yellow_on_black", label: "Sand on deep" },
];

export const TEXT_SCALE_OPTIONS = [100, 125, 150, 175, 200, 250, 300] as const;

const THEME_COLORS: Record<ThemeName, string> = {
  high_contrast_dark: "#0a1c1e",
  high_contrast_light: "#e7f2ee",
  yellow_on_black: "#041210",
};

export function applyDocumentPreferences(theme: ThemeName, textScale: number, reduceMotion: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty("--text-scale", String(textScale / 100));
  root.dataset.reduceMotion = reduceMotion ? "true" : "false";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
}

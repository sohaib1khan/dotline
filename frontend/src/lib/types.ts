import type { ThemeName } from "@/theme/tokens";

export type UserPublic = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: string;
  email_verified_at: string | null;
  is_active: boolean;
};

export type MeResponse = {
  user: UserPublic;
  email_configured: boolean;
  signups_open: boolean;
};

export type UserSettings = {
  text_scale: number;
  theme: ThemeName;
  reduce_motion: boolean;
  reduced_visuals: boolean;
  volume: number;
  speech_rate: number;
  speech_enabled: boolean;
  haptics_enabled: boolean;
  haptics_intensity: number;
  handedness: "left" | "right";
  gamepad_mapping: Record<string, unknown> | null;
};

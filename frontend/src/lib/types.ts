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
  sfx_enabled: boolean;
  speech_rate: number;
  speech_enabled: boolean;
  speech_voice: string | null;
  haptics_enabled: boolean;
  haptics_intensity: number;
  handedness: "left" | "right";
  daily_goal_minutes: 5 | 10 | 20;
  gamepad_mapping: Record<string, unknown> | null;
};

export type BadgePublic = {
  key: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
};

export type Statusboard = {
  first_name: string;
  tracks: string[];
  level: number;
  total_xp: number;
  xp_into_level: number;
  xp_for_next: number;
  xp_progress_ratio: number;
  streak_current: number;
  streak_longest: number;
  daily_goal_minutes: number;
  today_active_seconds: number;
  daily_goal_ratio: number;
  unread_inbox: number;
  latest_badges: BadgePublic[];
  continue_targets: { track: string; label: string; path: string; hint: string }[];
};

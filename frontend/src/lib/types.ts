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

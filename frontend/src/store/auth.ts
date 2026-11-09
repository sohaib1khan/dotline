import { create } from "zustand";
import { apiGet, apiPost, clearCsrf } from "@/lib/api";
import type { MeResponse, UserPublic } from "@/lib/types";

type AuthState = {
  user: UserPublic | null;
  loading: boolean;
  refresh: () => Promise<UserPublic | null>;
  setUser: (user: UserPublic | null) => void;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  refresh: async () => {
    try {
      const me = await apiGet<MeResponse>("/api/auth/me");
      set({ user: me.user, loading: false });
      return me.user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
  logout: async () => {
    try {
      await apiPost("/api/auth/logout", {});
    } finally {
      clearCsrf();
      set({ user: null, loading: false });
    }
  },
}));

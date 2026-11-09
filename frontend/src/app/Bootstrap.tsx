import { useEffect, type ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { startInputLayer, stopInputLayer } from "@/input";
import type { UserSettings } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";

export function Bootstrap({ children }: { children: ReactNode }) {
  const refresh = useAuth((s) => s.refresh);
  const hydrate = usePreferences((s) => s.hydrate);

  useEffect(() => {
    startInputLayer();
    return () => stopInputLayer();
  }, []);

  useEffect(() => {
    void (async () => {
      const user = await refresh();
      if (!user) return;
      try {
        const settings = await apiGet<UserSettings>("/api/me/settings");
        hydrate(settings);
      } catch {
        // Keep defaults if settings cannot load.
      }
    })();
  }, [hydrate, refresh]);

  return children;
}

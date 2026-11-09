import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setHeartbeatLocation, startHeartbeat, stopHeartbeat } from "@/lib/heartbeat";
import { useAuth } from "@/store/auth";

/** Starts active-time heartbeats for signed-in users and tracks route/track. */
export function HeartbeatBridge() {
  const location = useLocation();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!user) {
      stopHeartbeat();
      return;
    }
    startHeartbeat();
    return () => stopHeartbeat();
  }, [user]);

  useEffect(() => {
    setHeartbeatLocation(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

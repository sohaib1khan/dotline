import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordRoute, refreshProblemTitle, startTelemetry } from "@/lib/telemetry";

/** Starts global telemetry and records route changes. */
export function TelemetryBridge() {
  const location = useLocation();

  useEffect(() => {
    startTelemetry();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    recordRoute(path);
    // Title often updates after the route swap — refresh without duplicating the trail.
    const timer = window.setTimeout(() => refreshProblemTitle(), 150);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}

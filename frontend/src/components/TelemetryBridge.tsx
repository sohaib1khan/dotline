import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordRoute, startTelemetry } from "@/lib/telemetry";

/** Starts global telemetry and records route changes. */
export function TelemetryBridge() {
  const location = useLocation();

  useEffect(() => {
    startTelemetry();
  }, []);

  useEffect(() => {
    recordRoute(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

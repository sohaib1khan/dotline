import { startOfflineSyncWatch } from "@/pwa/syncQueue";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }

  const stopSync = startOfflineSyncWatch();

  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch(() => {
      // SW optional in insecure contexts / older browsers.
    });

  return () => {
    stopSync();
  };
}

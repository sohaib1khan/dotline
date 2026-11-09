import { useEffect, useState } from "react";
import {
  canPromptInstall,
  isIosSafari,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallAvailability,
} from "@/pwa/install";
import { flushOfflineQueue } from "@/pwa/syncQueue";
import { queuedCount } from "@/pwa/offlineQueue";

export function InstallAppCard() {
  const [canInstall, setCanInstall] = useState(canPromptInstall());
  const [standalone, setStandalone] = useState(isStandaloneDisplay());
  const [ios, setIos] = useState(false);
  const [queue, setQueue] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIos(isIosSafari());
    setStandalone(isStandaloneDisplay());
    const unsub = subscribeInstallAvailability(() => setCanInstall(canPromptInstall()));
    void queuedCount().then(setQueue);
    const onOnline = () => {
      void queuedCount().then(setQueue);
    };
    window.addEventListener("online", onOnline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  async function onInstall() {
    setBusy(true);
    setMessage("");
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        setMessage("Dotline was installed.");
        setStandalone(true);
      } else if (outcome === "dismissed") {
        setMessage("Install dismissed. You can try again anytime.");
      } else {
        setMessage("Install is not available in this browser right now.");
      }
    } finally {
      setBusy(false);
      setCanInstall(canPromptInstall());
    }
  }

  async function onSync() {
    setBusy(true);
    setMessage("");
    try {
      const result = await flushOfflineQueue();
      setQueue(result.remaining);
      setMessage(
        result.synced > 0
          ? `Synced ${result.synced} queued update${result.synced === 1 ? "" : "s"}.`
          : result.remaining
            ? "Still offline or sync blocked — try again when online."
            : "Nothing waiting to sync.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="banner" aria-labelledby="install-title">
      <h2 id="install-title" className="page-title" style={{ fontSize: "1.25rem" }}>
        Install & offline
      </h2>
      {standalone ? (
        <p>
          <strong>Running as an installed app.</strong>
        </p>
      ) : canInstall ? (
        <>
          <p>
            <strong>Install Dotline on this device</strong> for faster launch and offline practice.
          </p>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void onInstall()}>
            Install app
          </button>
        </>
      ) : ios ? (
        <>
          <p>
            <strong>Add to Home Screen (iPhone / iPad)</strong>
          </p>
          <ol className="plain-list">
            <li>Tap the Share button in Safari.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Tap Add — Dotline opens like an app.</li>
          </ol>
        </>
      ) : (
        <p>
          <strong>Install prompt unavailable here.</strong> On Android/desktop Chrome, use the browser
          install menu after visiting while online.
        </p>
      )}

      <p className="lede" style={{ marginTop: "0.75rem" }}>
        Offline queue: {queue} pending {queue === 1 ? "update" : "updates"}.
      </p>
      <button type="button" className="secondary-button" disabled={busy || queue === 0} onClick={() => void onSync()}>
        Sync now
      </button>
      {message ? (
        <p className="success-text" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type InboxMessage = {
  id: string;
  kind: string;
  sender: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  is_broadcast: boolean;
};

type InboxPayload = {
  messages: InboxMessage[];
  unread_count: number;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function InboxPage() {
  const [data, setData] = useState<InboxPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await apiGet<InboxPayload>("/api/inbox");
      setData(payload);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load inbox.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openMessage(message: InboxMessage) {
    setSelectedId(message.id);
    if (message.read_at || message.is_broadcast) return;
    try {
      const updated = await apiPost<InboxMessage>(`/api/inbox/${message.id}/read`, {});
      setData((prev) => {
        if (!prev) return prev;
        return {
          unread_count: Math.max(0, prev.unread_count - (message.read_at ? 0 : 1)),
          messages: prev.messages.map((row) => (row.id === updated.id ? updated : row)),
        };
      });
    } catch {
      // Keep message open even if mark-read fails.
    }
  }

  async function markAll() {
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/inbox/read-all", {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark all read.");
    } finally {
      setBusy(false);
    }
  }

  const selected = data?.messages.find((m) => m.id === selectedId) ?? null;

  return (
    <section aria-labelledby="inbox-title" className="inbox-page">
      <h1 id="inbox-title" className="page-title">
        Inbox
      </h1>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {!data ? (
        <p className="lede">Loading messages…</p>
      ) : (
        <>
          <div className="cta-row" style={{ justifyContent: "flex-start" }}>
            <p className="lede" style={{ margin: 0 }}>
              {data.unread_count} unread
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || data.unread_count === 0}
              onClick={() => void markAll()}
            >
              Mark all read
            </button>
          </div>

          {data.messages.length === 0 ? (
            <div className="banner" role="status">
              <strong>No messages yet.</strong>
              <p>Admin replies and system alerts will show up here.</p>
            </div>
          ) : (
            <div className="inbox-layout">
              <ul className="inbox-list" aria-label="Messages">
                {data.messages.map((message) => {
                  const unread = !message.read_at && !message.is_broadcast;
                  return (
                    <li key={message.id}>
                      <button
                        type="button"
                        className={`inbox-item${selectedId === message.id ? " is-selected" : ""}${
                          unread ? " is-unread" : ""
                        }`}
                        onClick={() => void openMessage(message)}
                        aria-current={selectedId === message.id ? "true" : undefined}
                      >
                        <span className="inbox-item-title">
                          {unread ? <span className="sr-only">Unread: </span> : null}
                          <strong>{message.title}</strong>
                        </span>
                        <span className="inbox-item-meta">
                          {message.kind} · {message.sender} · {formatWhen(message.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <article className="inbox-detail" aria-live="polite">
                {selected ? (
                  <>
                    <h2 className="page-title" style={{ fontSize: "1.35rem" }}>
                      {selected.title}
                    </h2>
                    <p className="lede">
                      From {selected.sender} · {formatWhen(selected.created_at)}
                    </p>
                    <p className="inbox-body">{selected.body}</p>
                  </>
                ) : (
                  <p className="lede">Select a message to read it.</p>
                )}
              </article>
            </div>
          )}
        </>
      )}
    </section>
  );
}

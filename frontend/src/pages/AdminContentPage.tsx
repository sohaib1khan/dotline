import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";

type LessonItem = {
  id?: string;
  label?: string;
  speak?: string;
  dots?: number[];
  key?: string;
  kind?: string;
  show_cell?: boolean;
};

type Lesson = {
  id: number;
  unit_id: number;
  order: number;
  title: string;
  type: string;
  content: {
    instruction?: string;
    items?: LessonItem[];
    pass_score?: number;
  };
  xp_reward: number;
  is_published: boolean;
};

type Unit = {
  id: number;
  track: string;
  order: number;
  title: string;
  description: string;
  is_published: boolean;
  lessons: Lesson[];
};

type Track = "braille" | "cursive";

export function AdminContentPage() {
  const [track, setTrack] = useState<Track>("braille");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [strokeKeys, setStrokeKeys] = useState<{ warmups: string[]; letters: string[] }>({
    warmups: [],
    letters: [],
  });
  const [alphabet, setAlphabet] = useState<Record<string, number[]>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reseedConfirm, setReseedConfirm] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet<Unit[]>(`/api/admin/content/units?track=${track}`);
    setUnits(data);
  }, [track]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load content."),
    );
    setUnitId(null);
    setLessonId(null);
    setDraft(null);
  }, [load]);

  useEffect(() => {
    void apiGet<{ warmups: string[]; letters: string[] }>("/api/admin/content/libraries/cursive-strokes")
      .then(setStrokeKeys)
      .catch(() => undefined);
    void apiGet<{ letters: Record<string, number[]> }>("/api/admin/content/libraries/braille-alphabet")
      .then((data) => setAlphabet(data.letters || {}))
      .catch(() => undefined);
  }, []);

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;

  function selectLesson(lesson: Lesson) {
    setLessonId(lesson.id);
    setDraft({ ...lesson, content: { ...lesson.content, items: [...(lesson.content.items || [])] } });
    setMessage("");
  }

  async function saveLesson() {
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await apiPut<Lesson>(`/api/admin/content/lessons/${draft.id}`, {
        title: draft.title,
        type: draft.type,
        content: draft.content,
        xp_reward: draft.xp_reward,
        is_published: draft.is_published,
      });
      setDraft(saved);
      setMessage("Lesson saved. Learners will see the change immediately.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleUnitPublished(unit: Unit) {
    setBusy(true);
    setError("");
    try {
      await apiPut(`/api/admin/content/units/${unit.id}`, { is_published: !unit.is_published });
      await load();
      setMessage(unit.is_published ? "Unit unpublished." : "Unit published.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function move(kind: "unit" | "lesson", id: number, direction: "up" | "down") {
    setBusy(true);
    try {
      const path =
        kind === "unit"
          ? `/api/admin/content/units/${id}/move`
          : `/api/admin/content/lessons/${id}/move`;
      await apiPost(path, { direction });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reorder failed.");
    } finally {
      setBusy(false);
    }
  }

  function addBrailleLetter(letter: string) {
    if (!draft) return;
    const dots = alphabet[letter];
    if (!dots) return;
    const items = [...(draft.content.items || [])];
    items.push({
      id: `${letter}-${items.length + 1}`,
      label: letter,
      speak: letter,
      dots,
      show_cell: true,
    });
    setDraft({ ...draft, content: { ...draft.content, items } });
  }

  function addCursiveKey(key: string, kind: "warmup" | "letter") {
    if (!draft) return;
    const items = [...(draft.content.items || [])];
    items.push({ id: `${key}-${items.length + 1}`, kind, key, label: key });
    setDraft({ ...draft, content: { ...draft.content, items } });
  }

  function removeItem(index: number) {
    if (!draft) return;
    const items = [...(draft.content.items || [])];
    items.splice(index, 1);
    setDraft({ ...draft, content: { ...draft.content, items } });
  }

  return (
    <section aria-labelledby="admin-content-title">
      <h1 id="admin-content-title" className="page-title">
        Content
      </h1>
      <p className="lede">Edit units and lessons. Changes apply to learners right away.</p>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <div className="banner" role="status">
          <strong>{message}</strong>
        </div>
      ) : null}

      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        {(["braille", "cursive"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`secondary-button${track === value ? " is-selected" : ""}`}
            aria-pressed={track === value}
            onClick={() => setTrack(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="admin-content-grid">
        <div>
          <h2 className="field-label">Units</h2>
          <ul className="inbox-list" aria-label="Units">
            {units.map((unit) => (
              <li key={unit.id}>
                <button
                  type="button"
                  className={`inbox-item${unitId === unit.id ? " is-selected" : ""}`}
                  onClick={() => {
                    setUnitId(unit.id);
                    setLessonId(null);
                    setDraft(null);
                  }}
                >
                  <span className="inbox-item-title">
                    <strong>
                      {unit.order}. {unit.title}
                    </strong>
                  </span>
                  <span className="inbox-item-meta">
                    {unit.is_published ? "published" : "draft"} · {unit.lessons.length} lessons
                  </span>
                </button>
                <div className="cta-row" style={{ justifyContent: "flex-start", marginTop: "0.35rem" }}>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void move("unit", unit.id, "up")}>
                    Up
                  </button>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void move("unit", unit.id, "down")}>
                    Down
                  </button>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void toggleUnitPublished(unit)}>
                    {unit.is_published ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="field-label">Lessons</h2>
          {!selectedUnit ? (
            <p className="lede">Select a unit.</p>
          ) : (
            <ul className="inbox-list" aria-label="Lessons">
              {selectedUnit.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={`inbox-item${lessonId === lesson.id ? " is-selected" : ""}`}
                    onClick={() => selectLesson(lesson)}
                  >
                    <span className="inbox-item-title">
                      <strong>
                        {lesson.order}. {lesson.title}
                      </strong>
                    </span>
                    <span className="inbox-item-meta">
                      {lesson.type} · {lesson.is_published ? "published" : "draft"} · {lesson.xp_reward} XP
                    </span>
                  </button>
                  <div className="cta-row" style={{ justifyContent: "flex-start", marginTop: "0.35rem" }}>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => void move("lesson", lesson.id, "up")}>
                      Up
                    </button>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => void move("lesson", lesson.id, "down")}>
                      Down
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="inbox-detail">
          <h2 className="field-label">Lesson editor</h2>
          {!draft ? (
            <p className="lede">Select a lesson to edit.</p>
          ) : (
            <div className="report-form">
              <div className="field">
                <label className="field-label" htmlFor="lesson-title">
                  Title
                </label>
                <input
                  id="lesson-title"
                  className="field-input"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="lesson-type">
                  Type
                </label>
                <input
                  id="lesson-type"
                  className="field-input"
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="lesson-instruction">
                  Instruction
                </label>
                <textarea
                  id="lesson-instruction"
                  className="field-input field-textarea"
                  rows={3}
                  value={draft.content.instruction || ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      content: { ...draft.content, instruction: event.target.value },
                    })
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="lesson-xp">
                  XP reward
                </label>
                <input
                  id="lesson-xp"
                  className="field-input"
                  type="number"
                  min={0}
                  value={draft.xp_reward}
                  onChange={(event) => setDraft({ ...draft, xp_reward: Number(event.target.value) })}
                />
              </div>
              <button
                type="button"
                className={`secondary-button${draft.is_published ? " is-selected" : ""}`}
                aria-pressed={draft.is_published}
                onClick={() => setDraft({ ...draft, is_published: !draft.is_published })}
              >
                {draft.is_published ? "Published" : "Draft"}
              </button>

              <h3 className="field-label">Items</h3>
              <ul className="plain-list">
                {(draft.content.items || []).map((item, index) => (
                  <li key={`${item.id || item.key || index}-${index}`}>
                    {item.label || item.key || "item"}{" "}
                    {item.dots ? `[${item.dots.join(",")}]` : ""}{" "}
                    <button type="button" className="secondary-button" onClick={() => removeItem(index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              {track === "braille" ? (
                <div>
                  <p className="field-label">Add braille letter</p>
                  <div className="choice-grid">
                    {Object.keys(alphabet).map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        className="secondary-button"
                        onClick={() => addBrailleLetter(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="field-label">Add cursive stroke</p>
                  <div className="choice-grid">
                    {strokeKeys.warmups.map((key) => (
                      <button key={key} type="button" className="secondary-button" onClick={() => addCursiveKey(key, "warmup")}>
                        {key}
                      </button>
                    ))}
                    {strokeKeys.letters.map((key) => (
                      <button key={key} type="button" className="secondary-button" onClick={() => addCursiveKey(key, "letter")}>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" className="primary-button" disabled={busy} onClick={() => void saveLesson()}>
                Save lesson
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="banner" style={{ marginTop: "1.5rem" }}>
        <strong>Re-seed from YAML</strong>
        <p>Restores defaults from content files. Type RESEED to confirm.</p>
        <div className="field">
          <label className="field-label" htmlFor="reseed-confirm">
            Confirm
          </label>
          <input
            id="reseed-confirm"
            className="field-input"
            value={reseedConfirm}
            onChange={(event) => setReseedConfirm(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={busy || reseedConfirm !== "RESEED"}
          onClick={() =>
            void (async () => {
              setBusy(true);
              setError("");
              try {
                const result = await apiPost<{ message: string }>("/api/admin/content/reseed", {
                  track,
                  confirm: "RESEED",
                });
                setMessage(result.message);
                setReseedConfirm("");
                await load();
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Reseed failed.");
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          Re-seed {track}
        </button>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPost, apiPut, apiUploadForm, downloadAuthenticated } from "@/lib/api";

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
    passage?: string;
    passage_speak?: string;
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
type EditorPane = "units" | "lessons" | "editor";

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
  const [importConfirm, setImportConfirm] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pane, setPane] = useState<EditorPane>("units");
  const [packOpen, setPackOpen] = useState(false);
  const [reseedOpen, setReseedOpen] = useState(false);

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
    setPane("units");
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

  function selectUnit(unit: Unit) {
    setUnitId(unit.id);
    setLessonId(null);
    setDraft(null);
    setPane("lessons");
  }

  function selectLesson(lesson: Lesson) {
    setLessonId(lesson.id);
    setDraft({ ...lesson, content: { ...lesson.content, items: [...(lesson.content.items || [])] } });
    setMessage("");
    setPane("editor");
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
      setMessage("Lesson saved. Learners see this immediately.");
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

  async function downloadPack() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await downloadAuthenticated("/api/admin/content/export", "dotline-course.zip");
      setMessage("Pack downloaded. Edit the YAML, then upload below.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download the course pack.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPack() {
    if (!importFile) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("confirm", "IMPORT");
      form.append("pack", importFile);
      const result = await apiUploadForm<{ message: string }>("/api/admin/content/import", form);
      setMessage(result.message);
      setImportConfirm("");
      setImportFile(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Import failed. Use a Dotline ZIP with braille/ and cursive/ folders.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page admin-content-page" aria-labelledby="admin-content-title">
      <header className="admin-page-header">
        <div>
          <h1 id="admin-content-title" className="page-title">
            Course content
          </h1>
          <p className="page-copy">
            <strong>Pick a track, choose a unit, edit a lesson.</strong> Or download a course pack —
            one <code>course.yaml</code> for braille and one for cursive.
          </p>
        </div>
        <div className="admin-segment" role="tablist" aria-label="Track">
          {(["braille", "cursive"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={track === value}
              className={`admin-segment-btn${track === value ? " is-selected" : ""}`}
              onClick={() => setTrack(value)}
            >
              {value === "braille" ? "Braille" : "Cursive"}
            </button>
          ))}
        </div>
      </header>

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

      <details
        className="admin-disclosure"
        open={packOpen}
        onToggle={(event) => setPackOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="admin-disclosure-summary">
          <strong>Course pack</strong>
          <span>Optional · download, edit YAML, upload</span>
        </summary>
        {packOpen ? (
          <div className="admin-pack-grid">
            <article className="admin-pack-step">
              <p className="admin-step-num">1</p>
              <h2 className="admin-card-title">Download</h2>
              <p className="page-copy">
                One ZIP with <strong>braille/course.yaml</strong> and{" "}
                <strong>cursive/course.yaml</strong> — every unit and lesson in two files.
              </p>
              <button type="button" className="primary-button" disabled={busy} onClick={() => void downloadPack()}>
                {busy ? "Working…" : "Download pack"}
              </button>
            </article>
            <article className="admin-pack-step">
              <p className="admin-step-num">2</p>
              <h2 className="admin-card-title">Edit offline</h2>
              <p className="page-copy">
                Edit only <code>braille/course.yaml</code> and <code>cursive/course.yaml</code>. Keep{" "}
                <code>alphabet.yaml</code> / <code>strokes.yaml</code> unless you change those
                libraries.
              </p>
            </article>
            <article className="admin-pack-step">
              <p className="admin-step-num">3</p>
              <h2 className="admin-card-title">Upload</h2>
              <div className="field">
                <label className="field-label" htmlFor="pack-file">
                  ZIP file
                </label>
                <input
                  id="pack-file"
                  className="field-input"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="import-confirm">
                  Type IMPORT to confirm
                </label>
                <input
                  id="import-confirm"
                  className="field-input"
                  value={importConfirm}
                  onChange={(event) => setImportConfirm(event.target.value)}
                  autoComplete="off"
                  placeholder="IMPORT"
                />
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !importFile || importConfirm !== "IMPORT"}
                onClick={() => void uploadPack()}
              >
                Replace course
              </button>
            </article>
          </div>
        ) : null}
      </details>

      <div className="admin-editor-tabs" role="tablist" aria-label="Editor sections">
        {(
          [
            ["units", "1 · Units"],
            ["lessons", "2 · Lessons"],
            ["editor", "3 · Edit"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`admin-segment-btn${pane === id ? " is-selected" : ""}`}
            aria-selected={pane === id}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-content-workspace">
        <div className={`admin-col${pane === "units" ? " is-active-pane" : ""}`}>
          <h2 className="admin-col-title">Units</h2>
          <ul className="admin-pick-list" aria-label="Units">
            {units.map((unit) => (
              <li key={unit.id} className={`admin-pick${unitId === unit.id ? " is-selected" : ""}`}>
                <button type="button" className="admin-pick-main" onClick={() => selectUnit(unit)}>
                  <strong>
                    {unit.order}. {unit.title}
                  </strong>
                  <span>
                    {unit.is_published ? "Published" : "Draft"} · {unit.lessons.length} lessons
                  </span>
                </button>
                <div className="admin-pick-actions">
                  <button type="button" className="admin-icon-btn" disabled={busy} onClick={() => void move("unit", unit.id, "up")} aria-label={`Move ${unit.title} up`}>
                    ↑
                  </button>
                  <button type="button" className="admin-icon-btn" disabled={busy} onClick={() => void move("unit", unit.id, "down")} aria-label={`Move ${unit.title} down`}>
                    ↓
                  </button>
                  <button type="button" className="admin-chip-btn" disabled={busy} onClick={() => void toggleUnitPublished(unit)}>
                    {unit.is_published ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={`admin-col${pane === "lessons" ? " is-active-pane" : ""}`}>
          <h2 className="admin-col-title">Lessons</h2>
          {!selectedUnit ? (
            <p className="admin-empty">
              <strong>Select a unit</strong> to see its lessons.
            </p>
          ) : (
            <ul className="admin-pick-list" aria-label="Lessons">
              {selectedUnit.lessons.map((lesson) => (
                <li key={lesson.id} className={`admin-pick${lessonId === lesson.id ? " is-selected" : ""}`}>
                  <button type="button" className="admin-pick-main" onClick={() => selectLesson(lesson)}>
                    <strong>
                      {lesson.order}. {lesson.title}
                    </strong>
                    <span>
                      {lesson.type} · {lesson.is_published ? "Published" : "Draft"} · {lesson.xp_reward} XP
                    </span>
                  </button>
                  <div className="admin-pick-actions">
                    <button type="button" className="admin-icon-btn" disabled={busy} onClick={() => void move("lesson", lesson.id, "up")} aria-label={`Move ${lesson.title} up`}>
                      ↑
                    </button>
                    <button type="button" className="admin-icon-btn" disabled={busy} onClick={() => void move("lesson", lesson.id, "down")} aria-label={`Move ${lesson.title} down`}>
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`admin-col admin-col-editor${pane === "editor" ? " is-active-pane" : ""}`}>
          <h2 className="admin-col-title">Lesson editor</h2>
          {!draft ? (
            <p className="admin-empty">
              <strong>Select a lesson</strong> to edit title, instruction, and items.
            </p>
          ) : (
            <div className="admin-editor-form">
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
              <div className="admin-editor-row">
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
                  <label className="field-label" htmlFor="lesson-xp">
                    XP
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
                <label className="field-label" htmlFor="lesson-passage">
                  Story passage (optional)
                </label>
                <textarea
                  id="lesson-passage"
                  className="field-input field-textarea"
                  rows={3}
                  value={draft.content.passage || ""}
                  onChange={(event) => {
                    const passage = event.target.value;
                    setDraft({
                      ...draft,
                      content: {
                        ...draft.content,
                        passage,
                        passage_speak: passage || undefined,
                      },
                    });
                  }}
                />
                <p className="meter">
                  <strong>Shown above the items.</strong> Included in course pack export/import.
                </p>
              </div>
              <button
                type="button"
                className={`admin-chip-btn${draft.is_published ? " is-selected" : ""}`}
                aria-pressed={draft.is_published}
                onClick={() => setDraft({ ...draft, is_published: !draft.is_published })}
              >
                {draft.is_published ? "Published" : "Draft"}
              </button>

              <h3 className="admin-col-title">Items</h3>
              <ul className="admin-item-list">
                {(draft.content.items || []).length === 0 ? (
                  <li>
                    <strong>No items yet.</strong> Add letters or strokes below.
                  </li>
                ) : null}
                {(draft.content.items || []).map((item, index) => (
                  <li key={`${item.id || item.key || index}-${index}`}>
                    <span>
                      <strong>{item.label || item.key || "item"}</strong>
                      {item.dots ? ` [${item.dots.join(",")}]` : ""}
                    </span>
                    <button type="button" className="admin-chip-btn" onClick={() => removeItem(index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <p className="field-label">{track === "braille" ? "Add braille letter" : "Add cursive stroke"}</p>
              <div className="admin-key-grid">
                {track === "braille"
                  ? Object.keys(alphabet).map((letter) => (
                      <button key={letter} type="button" className="admin-key-btn" onClick={() => addBrailleLetter(letter)}>
                        {letter}
                      </button>
                    ))
                  : [...strokeKeys.warmups, ...strokeKeys.letters].map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="admin-key-btn"
                        onClick={() =>
                          addCursiveKey(key, strokeKeys.warmups.includes(key) ? "warmup" : "letter")
                        }
                      >
                        {key}
                      </button>
                    ))}
              </div>

              <button type="button" className="primary-button" disabled={busy} onClick={() => void saveLesson()}>
                Save lesson
              </button>
            </div>
          )}
        </div>
      </div>

      <details
        className="admin-disclosure"
        open={reseedOpen}
        onToggle={(event) => setReseedOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="admin-disclosure-summary">
          <strong>Advanced · Re-seed {track}</strong>
          <span>Restore packaged YAML defaults</span>
        </summary>
        {reseedOpen ? (
          <div className="admin-reseed">
            <p className="page-copy">
              <strong>This overwrites database content for {track} from built-in files.</strong> Type
              RESEED to confirm.
            </p>
            <div className="field">
              <label className="field-label" htmlFor="reseed-confirm">
                Confirm
              </label>
              <input
                id="reseed-confirm"
                className="field-input"
                value={reseedConfirm}
                onChange={(event) => setReseedConfirm(event.target.value)}
                placeholder="RESEED"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="secondary-button"
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
        ) : null}
      </details>
    </section>
  );
}

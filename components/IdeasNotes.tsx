"use client";

import { useEffect, useState } from "react";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

const NOTES_KEY = "storyweaver-ideas-notes-v1";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function IdeasNotes({
  variant = "button",
}: {
  variant?: "button" | "panel";
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTES_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setNotes(parsed.filter((item): item is Note =>
          !!item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.content === "string"
        ));
      } else if (typeof parsed === "string" && parsed.trim()) {
        // One-time migration from the original single-note version.
        const migrated: Note[] = [{
          id: makeId(),
          title: "My first note",
          content: parsed,
          updatedAt: new Date().toISOString(),
        }];
        setNotes(migrated);
        window.localStorage.setItem(NOTES_KEY, JSON.stringify(migrated));
      }
    } catch {
      setMessage("Could not read saved notes from this browser.");
    }
  }, []);

  function persist(next: Note[]) {
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      setNotes(next);
      setMessage("Notes saved in this browser.");
      return true;
    } catch {
      setMessage("Could not save notes. Check browser storage permissions.");
      return false;
    }
  }

  function openNotes() {
    setMessage("");
    setOpen(true);
    if (notes.length === 0) {
      setSelectedId(null);
      setDraftTitle("");
      setDraftContent("");
    } else if (selectedId && notes.some((note) => note.id === selectedId)) {
      const note = notes.find((note) => note.id === selectedId)!;
      setDraftTitle(note.title);
      setDraftContent(note.content);
    } else {
      setSelectedId(notes[0].id);
      setDraftTitle(notes[0].title);
      setDraftContent(notes[0].content);
    }
  }

  function newNote() {
    setSelectedId(null);
    setDraftTitle("");
    setDraftContent("");
    setMessage("New note — add a title and save it.");
  }

  function saveCurrentNote() {
    const title = draftTitle.trim();
    if (!title) {
      setMessage("Give this note a title before saving.");
      return;
    }
    const now = new Date().toISOString();
    if (selectedId) {
      const next = notes.map((note) =>
        note.id === selectedId
          ? { ...note, title, content: draftContent, updatedAt: now }
          : note
      );
      if (persist(next)) setMessage("Note updated.");
    } else {
      const created: Note = {
        id: makeId(),
        title,
        content: draftContent,
        updatedAt: now,
      };
      if (persist([created, ...notes])) {
        setSelectedId(created.id);
        setMessage("Note created.");
      }
    }
  }

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setMessage("");
  }

  function deleteNote() {
    if (!selectedId) return;
    const note = notes.find((item) => item.id === selectedId);
    if (!window.confirm(`Delete "${note?.title ?? "this note"}"? This cannot be undone.`)) return;
    const next = notes.filter((item) => item.id !== selectedId);
    if (persist(next)) {
      setSelectedId(next[0]?.id ?? null);
      setDraftTitle(next[0]?.title ?? "");
      setDraftContent(next[0]?.content ?? "");
      setMessage("Note deleted.");
    }
  }

  return (
    <>
      <button
        type="button"
        className={variant === "panel" ? "iw-trigger iw-trigger-panel" : "iw-trigger"}
        onClick={openNotes}
        aria-haspopup="dialog"
      >
        <span className="iw-trigger-icon">▤</span>
        <span className="iw-trigger-copy">
          <strong>IDEAS &amp; NOTES</strong>
          <span>{variant === "panel" ? "Create, organize, and revisit your ideas." : `${notes.length} saved note${notes.length === 1 ? "" : "s"} · OPEN WORKSPACE`}</span>
        </span>
        <span className="iw-trigger-arrow">↗</span>
      </button>

      {open && (
        <div className="iw-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="iw-dialog" role="dialog" aria-modal="true" aria-labelledby="iw-title">
            <header className="iw-header">
              <div>
                <div className="iw-kicker">WRITER WORKSPACE</div>
                <h2 id="iw-title">Ideas &amp; Notes</h2>
                <p>Create separate notes for plot threads, characters, dialogue, and future scenes.</p>
              </div>
              <button type="button" className="iw-close" onClick={() => setOpen(false)} aria-label="Close notes">×</button>
            </header>

            <div className="iw-body">
              <aside className="iw-list">
                <div className="iw-list-head">
                  <span>SAVED NOTES ({notes.length})</span>
                  <button type="button" onClick={newNote}>+ NEW</button>
                </div>
                {notes.length === 0 ? (
                  <p className="iw-empty">No notes yet. Create your first note.</p>
                ) : notes.map((note) => (
                  <button
                    type="button"
                    key={note.id}
                    className={`iw-note-item ${selectedId === note.id ? "active" : ""}`}
                    onClick={() => selectNote(note)}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.content.trim().slice(0, 70) || "No content yet"}</span>
                  </button>
                ))}
              </aside>

              <div className="iw-editor">
                <label htmlFor="iw-note-title">NOTE TITLE</label>
                <input id="iw-note-title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="e.g. The signal's origin" />
                <label htmlFor="iw-note-content">NOTE CONTENT</label>
                <textarea id="iw-note-content" value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="Write down an idea before it disappears..." />
                <div className="iw-actions">
                  {selectedId && <button type="button" className="iw-delete" onClick={deleteNote}>DELETE NOTE</button>}
                  <span className="iw-spacer" />
                  <button type="button" className="iw-secondary" onClick={() => setOpen(false)}>CLOSE</button>
                  <button type="button" className="iw-save" onClick={saveCurrentNote}>SAVE NOTE</button>
                </div>
                {message && <p className="iw-message" role="status">{message}</p>}
              </div>
            </div>
            <footer className="iw-footer">Notes are stored locally in this browser and remain separate from your story scenes.</footer>
          </section>
        </div>
      )}

      <style jsx global>{`
        .iw-trigger {
          display: inline-flex; align-items: center; gap: 10px; padding: 10px 12px;
          border: 1px solid #303539; background: #101315; color: #d9dfe2;
          cursor: pointer; font-size: 10px; letter-spacing: 1px;
        }
        .iw-trigger:hover { border-color: #a52a31; }
        .iw-trigger-icon, .iw-trigger-arrow { color: #f12c35; font-size: 17px; }
        .iw-trigger-copy { display: grid; gap: 5px; text-align: left; }
        .iw-trigger-copy > span { color: #92999e; font-size: 9px; letter-spacing: .4px; }
        .iw-trigger-panel { width: 100%; min-height: 83px; padding: 14px; text-align: left; }
        .iw-trigger-panel .iw-trigger-copy { flex: 1; }
        .iw-backdrop {
          position: fixed; z-index: 9999; inset: 0; display: grid; place-items: center;
          padding: 18px; background: #000c; backdrop-filter: blur(5px);
        }
        .iw-dialog {
          display: grid; width: min(900px, 100%); max-height: 88vh; grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: hidden; border: 1px solid #3a4145; border-top: 2px solid #f12c35;
          background: #0d1012; color: #edf0f1; box-shadow: 0 24px 80px #0009;
          font-family: Arial, Helvetica, sans-serif;
        }
        .iw-header { display: flex; justify-content: space-between; gap: 16px; padding: 22px 24px; border-bottom: 1px solid #303539; }
        .iw-kicker { color: #f12c35; font-size: 9px; letter-spacing: 2px; }
        .iw-header h2 { margin: 9px 0; font: 32px Georgia, serif; }
        .iw-header p { margin: 0; color: #92999e; font-size: 11px; line-height: 1.6; }
        .iw-close { width: 34px; height: 34px; border: 1px solid #303539; background: #111416; color: white; font-size: 22px; cursor: pointer; }
        .iw-body { display: grid; min-height: 0; grid-template-columns: 240px minmax(0, 1fr); }
        .iw-list { overflow-y: auto; padding: 14px; border-right: 1px solid #303539; background: #0a0c0e; }
        .iw-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; color: #92999e; font-size: 9px; letter-spacing: 1px; }
        .iw-list-head button { border: 1px solid #5b272c; background: #1a1012; color: #ff6269; padding: 7px; font-size: 9px; cursor: pointer; }
        .iw-note-item { display: grid; width: 100%; gap: 6px; margin-bottom: 7px; padding: 11px; border: 1px solid #292e32; background: #101315; color: #d9dfe2; text-align: left; cursor: pointer; }
        .iw-note-item.active { border-color: #a52a31; background: #211113; }
        .iw-note-item strong { font-size: 11px; overflow-wrap: anywhere; }
        .iw-note-item span { color: #92999e; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
        .iw-empty { color: #92999e; font-size: 11px; line-height: 1.7; }
        .iw-editor { display: flex; min-width: 0; flex-direction: column; gap: 9px; overflow-y: auto; padding: 18px; }
        .iw-editor label { margin-top: 4px; color: #92999e; font-size: 9px; letter-spacing: 1.5px; }
        .iw-editor input, .iw-editor textarea { width: 100%; border: 1px solid #303539; outline: none; background: #080a0b; color: #edf0f1; padding: 12px; font: 12px Arial, sans-serif; }
        .iw-editor input:focus, .iw-editor textarea:focus { border-color: #9b363b; }
        .iw-editor textarea { flex: 1; min-height: 180px; resize: vertical; font: 14px/1.8 Georgia, serif; }
        .iw-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-top: 8px; }
        .iw-actions button { min-height: 36px; padding: 0 10px; border: 1px solid #3b4145; background: #111416; color: #e2e6e8; font-size: 9px; letter-spacing: .7px; cursor: pointer; }
        .iw-actions .iw-save { border-color: #b5222a; background: #94191f; color: white; }
        .iw-actions .iw-delete { border-color: #572b30; color: #ef8b91; }
        .iw-spacer { flex: 1; }
        .iw-message { margin: 0; color: #b4d1b8; font-size: 10px; }
        .iw-footer { padding: 12px 24px; border-top: 1px solid #303539; color: #777f84; font-size: 9px; }
        @media (max-width: 620px) {
          .iw-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(120px, 30vh) minmax(0, 1fr); }
          .iw-list { border-right: 0; border-bottom: 1px solid #303539; }
          .iw-dialog { max-height: 94vh; }
          .iw-header { padding: 16px; }
          .iw-editor { padding: 13px; }
        }
      `}</style>
    </>
  );
}

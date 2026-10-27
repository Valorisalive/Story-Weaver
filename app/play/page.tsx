"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadStories,
  starterStory,
  type StoryDocument,
  type StoryScene,
} from "../../lib/story-store";

type Visit = {
  sceneId: string;
  choiceText?: string;
};

export default function PlayPage() {
  const [story, setStory] = useState<StoryDocument>(starterStory);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [ready, setReady] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  useEffect(() => {
    try {
      // The Home page passes the selected story in ?story=<id>.
      // Keep the starter story as the default for existing /play links.
      const requestedStoryId = new URLSearchParams(window.location.search).get("story");
      const savedStories = loadStories();
      const savedStory = requestedStoryId
        ? savedStories.find((item) => item.id === requestedStoryId)
        : savedStories.find((item) => item.id === starterStory.id) ?? starterStory;

      if (!savedStory) {
        setStory({ ...starterStory, title: "Story not found", scenes: [] });
        setCurrentSceneId(null);
        setVisits([]);
        return;
      }

      const firstScene = savedStory.scenes[0] ?? null;
      setStory(savedStory);
      setCurrentSceneId(firstScene?.id ?? null);
      setVisits(firstScene ? [{ sceneId: firstScene.id }] : []);
    } catch {
      const firstScene = starterStory.scenes[0] ?? null;
      setStory(starterStory);
      setCurrentSceneId(firstScene?.id ?? null);
      setVisits(firstScene ? [{ sceneId: firstScene.id }] : []);
    } finally {
      setReady(true);
    }
  }, []);

  const currentScene = useMemo(
    () => story.scenes.find((scene) => scene.id === currentSceneId) ?? null,
    [story.scenes, currentSceneId],
  );

  const validChoices = useMemo(() => {
    if (!currentScene) return [];
    const sceneIds = new Set(story.scenes.map((scene) => scene.id));
    return currentScene.choices.filter((choice) => sceneIds.has(choice.target));
  }, [currentScene, story.scenes]);

  const isEnding = Boolean(currentScene?.ending) || validChoices.length === 0;
  const visitNumber = Math.max(visits.length, 1);
  const progressLabel = `${String(visitNumber).padStart(2, "0")} / PATH`;

  function chooseScene(targetId: string, choiceText: string) {
    const targetExists = story.scenes.some((scene) => scene.id === targetId);
    if (!targetExists) return;

    setCurrentSceneId(targetId);
    setVisits((current) => [...current, { sceneId: targetId, choiceText }]);
    setShowRestartConfirm(false);
  }

  function goBack() {
    if (visits.length < 2) return;
    const previousVisits = visits.slice(0, -1);
    setVisits(previousVisits);
    setCurrentSceneId(previousVisits[previousVisits.length - 1].sceneId);
  }

  function restartStory() {
    const firstScene = story.scenes[0] ?? null;
    setCurrentSceneId(firstScene?.id ?? null);
    setVisits(firstScene ? [{ sceneId: firstScene.id }] : []);
    setShowRestartConfirm(false);
  }

  function getSceneTitle(sceneId: string) {
    return story.scenes.find((scene) => scene.id === sceneId)?.title || "Untitled scene";
  }

  if (!ready) {
    return (
      <main className="play-loading">
        <span>LOADING STORY</span>
        <style jsx>{`
          .play-loading {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #090b0d;
            color: #b6bec3;
            font: 11px Arial, sans-serif;
            letter-spacing: 2px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="play-page">
      <style jsx global>{`
        .play-page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(120, 22, 29, 0.12), transparent 46%),
            #090b0d;
          color: #edf0f1;
          font-family: Arial, Helvetica, sans-serif;
        }
        .play-topbar {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px clamp(18px, 5vw, 72px);
          border-bottom: 1px solid #2c3236;
          background: rgba(12, 14, 16, 0.92);
        }
        .play-brand {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }
        .play-back {
          color: #9ba4a9;
          text-decoration: none;
          font-size: 12px;
          white-space: nowrap;
        }
        .play-back:hover { color: #fff; }
        .play-brand-copy { min-width: 0; }
        .play-eyebrow {
          margin: 0 0 6px;
          color: #f12c35;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .play-brand h1 {
          margin: 0;
          overflow: hidden;
          color: #f0f2f3;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .play-top-meta {
          color: #8c969c;
          font-size: 10px;
          letter-spacing: 1px;
          white-space: nowrap;
        }
        .play-shell {
          width: min(100% - 36px, 900px);
          margin: 0 auto;
          padding: clamp(36px, 8vh, 84px) 0 64px;
        }
        .play-overline {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
          color: #8d979d;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .play-progress {
          height: 2px;
          margin-bottom: 42px;
          background: #252a2e;
        }
        .play-progress-fill {
          height: 100%;
          background: #f12c35;
          transition: width 180ms ease;
        }
        .play-card {
          max-width: 760px;
          margin: 0 auto;
          padding: clamp(24px, 5vw, 54px);
          border: 1px solid #30373b;
          border-top: 2px solid #a92028;
          background: linear-gradient(145deg, #111518, #0d1012 70%);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }
        .play-scene-label {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0 0 22px;
          color: #f12c35;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .play-scene-label::before {
          width: 6px;
          height: 6px;
          background: #f12c35;
          content: "";
        }
        .play-card h2 {
          margin: 0 0 24px;
          color: #f2f0ed;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 5vw, 48px);
          font-weight: 400;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }
        .play-narrative {
          color: #b8c0c4;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(16px, 2vw, 19px);
          line-height: 1.9;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .play-narrative.empty {
          color: #78838a;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          font-style: italic;
        }
        .play-divider {
          height: 1px;
          margin: 34px 0 26px;
          background: #2c3236;
        }
        .play-choice-heading {
          margin: 0 0 14px;
          color: #8e989e;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .play-choices {
          display: grid;
          gap: 10px;
        }
        .play-choice {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 18px;
          border: 1px solid #343b3f;
          background: #101416;
          color: #e7eaeb;
          text-align: left;
          font-size: 13px;
          line-height: 1.5;
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .play-choice:hover {
          border-color: #b42a32;
          background: #171113;
        }
        .play-choice-arrow {
          flex: 0 0 auto;
          color: #f12c35;
          font-size: 18px;
        }
        .play-ending {
          padding: 18px;
          border: 1px solid #533036;
          background: rgba(119, 24, 32, 0.12);
          color: #c4cacc;
          font-size: 12px;
          line-height: 1.7;
        }
        .play-ending strong {
          display: block;
          margin-bottom: 5px;
          color: #f12c35;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .play-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
          margin-top: 22px;
        }
        .play-action {
          padding: 12px 15px;
          border: 1px solid #353c40;
          background: transparent;
          color: #b8c0c4;
          font-size: 10px;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .play-action:hover:not(:disabled) {
          border-color: #a92028;
          color: #fff;
        }
        .play-action:disabled {
          cursor: not-allowed;
          opacity: 0.35;
        }
        .play-action.primary {
          border-color: #b9232b;
          background: #97191f;
          color: #fff;
        }
        .play-history {
          max-width: 760px;
          margin: 28px auto 0;
          padding: 18px 0 0;
          border-top: 1px solid #252b2f;
        }
        .play-history h3 {
          margin: 0 0 12px;
          color: #8d979d;
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 2px;
        }
        .play-history-list {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .play-history-item {
          padding: 8px 10px;
          border: 1px solid #2d3438;
          color: #aab3b8;
          font-size: 10px;
        }
        .play-history-item.current {
          border-color: #8f252c;
          color: #f0dfe0;
        }
        .play-history-arrow { color: #657077; font-size: 10px; }
        .play-empty {
          padding: 40px 20px;
          border: 1px dashed #343b3f;
          color: #aeb7bc;
          text-align: center;
          line-height: 1.8;
        }
        @media (max-width: 560px) {
          .play-topbar { align-items: flex-start; }
          .play-top-meta { display: none; }
          .play-shell { width: min(100% - 24px, 900px); }
          .play-card { padding: 24px 18px; }
          .play-actions { flex-direction: column-reverse; }
          .play-action { width: 100%; }
        }
      `}</style>

      <header className="play-topbar">
        <div className="play-brand">
          <a className="play-back" href="/">← HOME</a>
          <div className="play-brand-copy">
            <p className="play-eyebrow">STORYWEAVER / PLAY MODE</p>
            <h1>{story.title || "UNTITLED STORY"}</h1>
          </div>
        </div>
        <div className="play-top-meta">INTERACTIVE READER</div>
      </header>

      <div className="play-shell">
        {!currentScene ? (
          <div className="play-empty">
            This story has no scenes yet. Return to the Home page to choose another story.
            <div>
              <a className="play-back" href="/">← Return home</a>
            </div>
          </div>
        ) : (
          <>
            <div className="play-overline">
              <span>YOUR STORY / LIVE PATH</span>
              <span>{progressLabel}</span>
            </div>
            <div
              className="play-progress"
              role="progressbar"
              aria-label="Scenes visited"
              aria-valuemin={1}
              aria-valuemax={Math.max(story.scenes.length, 1)}
              aria-valuenow={Math.min(visitNumber, Math.max(story.scenes.length, 1))}
            >
              <div
                className="play-progress-fill"
                style={{
                  width: `${Math.min(
                    100,
                    (visitNumber / Math.max(story.scenes.length, visitNumber, 1)) * 100,
                  )}%`,
                }}
              />
            </div>

            <article className="play-card">
              <p className="play-scene-label">
                {currentScene.ending ? "ENDING" : `SCENE ${String(visitNumber).padStart(2, "0")}`}
              </p>
              <h2>{currentScene.title || "Untitled Scene"}</h2>
              {currentScene.text.trim() ? (
                <div className="play-narrative">{currentScene.text}</div>
              ) : (
                <div className="play-narrative empty">
                  This scene has no narrative yet. Return to the Home page to choose another story.
                </div>
              )}

              <div className="play-divider" />

              {isEnding ? (
                <div className="play-ending">
                  <strong>{currentScene.ending ? "END OF PATH" : "NO AVAILABLE CHOICES"}</strong>
                  {currentScene.ending
                    ? "You have reached an ending."
                    : "This scene has no valid outgoing choices. You can restart or go back to explore another path."}
                </div>
              ) : (
                <>
                  <p className="play-choice-heading">WHAT DO YOU DO NEXT?</p>
                  <div className="play-choices">
                    {validChoices.map((choice, index) => (
                      <button
                        className="play-choice"
                        key={choice.id}
                        onClick={() => chooseScene(choice.target, choice.text)}
                      >
                        <span>
                          <span style={{ color: "#f12c35", marginRight: 12 }}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {choice.text || `Continue to ${getSceneTitle(choice.target)}`}
                        </span>
                        <span className="play-choice-arrow" aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </article>

            <div className="play-actions">
              <button
                className="play-action"
                onClick={goBack}
                disabled={visits.length < 2}
              >
                ← PREVIOUS SCENE
              </button>
              <button
                className="play-action primary"
                onClick={() => setShowRestartConfirm(true)}
              >
                RESTART STORY ↺
              </button>
            </div>

            {showRestartConfirm && (
              <div className="play-history" role="group" aria-label="Confirm restart">
                <h3>RESTART THIS STORY?</h3>
                <p style={{ color: "#aeb7bc", fontSize: 12, lineHeight: 1.7 }}>
                  Your current reading path will be cleared. The story itself will not be changed.
                </p>
                <div className="play-actions">
                  <button className="play-action" onClick={() => setShowRestartConfirm(false)}>
                    KEEP READING
                  </button>
                  <button className="play-action primary" onClick={restartStory}>
                    RESTART FROM BEGINNING
                  </button>
                </div>
              </div>
            )}

            <section className="play-history">
              <h3>PATH HISTORY</h3>
              <div className="play-history-list">
                {visits.map((visit, index) => (
                  <span key={`${visit.sceneId}-${index}`} style={{ display: "contents" }}>
                    {index > 0 && <span className="play-history-arrow" aria-hidden="true">→</span>}
                    <span
                      className={`play-history-item ${index === visits.length - 1 ? "current" : ""}`}
                      title={visit.choiceText ? `Choice: ${visit.choiceText}` : "Starting scene"}
                    >
                      {getSceneTitle(visit.sceneId)}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

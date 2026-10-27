"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadStories,
  saveStories,
  starterStory,
  type StoryDocument,
  type StoryScene,
} from "../../lib/story-store";

type Choice = {
  id: string;
  text: string;
  target: string;
};

type Scene = StoryScene;
type EditorView = "write" | "preview";

export default function EditorPage() {
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>(starterStory.scenes);
  const [storyId, setStoryId] = useState(starterStory.id);
  const [storyTitle, setStoryTitle] = useState(starterStory.title);
  const [activeId, setActiveId] = useState(starterStory.scenes[0].id);
  const [view, setView] = useState<EditorView>("write");
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("Loading story...");
  const [lastSaved, setLastSaved] = useState("");
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("story") || starterStory.id;
      const stories = loadStories();
      const selected = stories.find((item) => item.id === requestedId);

      if (!selected) {
        setNotice("Story not found — returning to your stories");
        router.replace("/");
        return;
      }

      if (selected.status === "Published") {
        setNotice("Published stories are read-only");
        router.replace(`/play?story=${encodeURIComponent(selected.id)}`);
        return;
      }

      const loadedScenes = selected.scenes.length > 0
        ? selected.scenes
        : [{ id: `scene-${Date.now()}`, title: "Untitled Scene", text: "", choices: [] }];
      setStoryId(selected.id);
      setStoryTitle(selected.title || "Untitled Story");
      setScenes(loadedScenes);
      setActiveId(loadedScenes[0].id);
      setStorageReady(true);
      setNotice("Ready to write");
    } catch {
      setNotice("Could not load saved stories — browser storage may be unavailable");
    }
  }, [router]);

  useEffect(() => {
    if (!storageReady) return;

    try {
      const stories = loadStories();
      const existing = stories.find((item) => item.id === storyId);
      if (!existing) throw new Error("The selected story no longer exists.");
      if (existing.status === "Published") {
        setNotice("Published stories are read-only");
        router.replace(`/play?story=${encodeURIComponent(storyId)}`);
        return;
      }

      saveStories(stories.map((item) => item.id === storyId
        ? { ...item, title: storyTitle, scenes, updatedAt: new Date().toISOString() }
        : item));

      const now = new Date();
      setLastSaved(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setNotice("Saved in this browser");
    } catch {
      setNotice("Save failed — browser storage may be unavailable");
    }
  }, [scenes, storageReady, router, storyId, storyTitle]);

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeId) ?? scenes[0],
    [scenes, activeId]
  );

  useEffect(() => {
    if (!activeScene) {
      setWordCount(0);
      return;
    }

    const words = activeScene.text.trim().match(/\S+/g);
    setWordCount(words?.length ?? 0);
  }, [activeScene?.text]);

  const totalWords = useMemo(
    () =>
      scenes.reduce((sum, scene) => {
        const words = scene.text.trim().match(/\S+/g);
        return sum + (words?.length ?? 0);
      }, 0),
    [scenes]
  );

  const brokenLinks = useMemo(
    () =>
      scenes.reduce(
        (count, scene) =>
          count +
          scene.choices.filter(
            (choice) => !scenes.some((item) => item.id === choice.target)
          ).length,
        0
      ),
    [scenes]
  );

  function updateScene(patch: Partial<Scene>) {
    if (!activeScene) return;

    setScenes((current) =>
      current.map((scene) =>
        scene.id === activeScene.id ? { ...scene, ...patch } : scene
      )
    );
  }

  function updateChoice(choiceId: string, patch: Partial<Choice>) {
    if (!activeScene) return;

    updateScene({
      choices: activeScene.choices.map((choice) =>
        choice.id === choiceId ? { ...choice, ...patch } : choice
      ),
    });
  }

  function setSceneEnding(ending: boolean) {
    if (!activeScene) return;

    if (ending && activeScene.choices.length > 0) {
      const confirmed = window.confirm(
        "Mark this scene as an ending? Its outgoing choices will be removed so the ending behaves consistently in Play Mode and Branch Map."
      );
      if (!confirmed) return;

      updateScene({ ending: true, choices: [] });
      return;
    }

    updateScene({ ending });
  }

  function addScene() {
    const id = `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newScene: Scene = {
      id,
      title: "Untitled Scene",
      text: "",
      choices: [],
    };

    setScenes((current) => [...current, newScene]);
    setActiveId(id);
    setView("write");
  }

  function addChoice() {
    if (!activeScene) return;

    const destination = scenes.find(
      (scene) => scene.id !== activeScene.id
    );

    const choice: Choice = {
      id: `choice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: "New choice",
      target: destination?.id ?? activeScene.id,
    };

    updateScene({ choices: [...activeScene.choices, choice] });
  }

  function deleteChoice(choiceId: string) {
    if (!activeScene) return;

    updateScene({
      choices: activeScene.choices.filter(
        (choice) => choice.id !== choiceId
      ),
    });
  }

  function deleteScene() {
    if (!activeScene || scenes.length <= 1) return;

    const deletedId = activeScene.id;
    const remaining = scenes
      .filter((scene) => scene.id !== deletedId)
      .map((scene) => ({
        ...scene,
        choices: scene.choices.filter(
          (choice) => choice.target !== deletedId
        ),
      }));

    setScenes(remaining);
    setActiveId(remaining[0].id);
    setView("write");
  }

  function resetDemoStory() {
    const confirmed = window.confirm(
      "Replace The Last Signal with the original demo story? Your current edits to this story will be lost."
    );

    if (!confirmed) return;

    const freshScenes = structuredClone(starterStory.scenes);
    setScenes(freshScenes);
    setActiveId(freshScenes[0].id);
    setView("write");
  }

  function navigateToChoice(choice: Choice) {
    const target = scenes.find((scene) => scene.id === choice.target);
    if (target) setActiveId(target.id);
  }

  function openStoryPreview() {
    try {
      const stories = loadStories();
      const existing = stories.find((item) => item.id === storyId);
      if (!existing) throw new Error("The selected story no longer exists.");

      saveStories(stories.map((item) => item.id === storyId
        ? { ...item, title: storyTitle, scenes, updatedAt: new Date().toISOString() }
        : item));

      router.push(`/play?story=${encodeURIComponent(storyId)}`);
    } catch {
      setNotice("Preview failed — could not save the story");
    }
  }

  if (!storageReady || !activeScene) {
    return (
      <main className="sw-loading">
        <div className="sw-loading-mark">W</div>
        <p>INITIALISING STORY WORKSPACE</p>
        <style jsx>{`
          .sw-loading {
            min-height: 100vh;
            display: grid;
            place-content: center;
            justify-items: center;
            gap: 16px;
            background: #090b0d;
            color: #92999e;
            font: 10px Arial, sans-serif;
            letter-spacing: 2px;
          }
          .sw-loading-mark {
            color: #f12c35;
            font: 44px Georgia, serif;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="sw-editor">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #090b0d;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible,
        a:focus-visible {
          outline: 2px solid #f12c35;
          outline-offset: 3px;
        }

        .sw-editor {
          --bg: #090b0d;
          --panel: #101315;
          --panel2: #14181b;
          --border: #303539;
          --muted: #899298;
          --text: #edf0f1;
          --red: #f12c35;
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 70% 0%, #1a1e2118, transparent 45%),
            var(--bg);
          color: var(--text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .sw-topbar {
          position: sticky;
          z-index: 10;
          top: 0;
          display: flex;
          min-height: 68px;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 12px 26px;
          border-bottom: 1px solid var(--border);
          background: #0b0d0ff5;
          backdrop-filter: blur(12px);
        }

        .sw-top-left,
        .sw-top-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .sw-back {
          color: #b6bdc1;
          font-size: 12px;
          text-decoration: none;
          white-space: nowrap;
        }

        .sw-back:hover {
          color: white;
        }

        .sw-divider {
          color: #41484c;
        }

        .sw-project-name {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .sw-project-sub {
          margin-top: 5px;
          color: var(--muted);
          font-size: 9px;
          letter-spacing: 1px;
        }

        .sw-save-state {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #aeb7bb;
          font-size: 10px;
          white-space: nowrap;
        }

        .sw-save-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #8fb99a;
        }

        .sw-button {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 13px;
          border: 1px solid #3b4145;
          background: #111416;
          color: #e2e6e8;
          font-size: 10px;
          letter-spacing: 1px;
          transition: background 150ms ease, border-color 150ms ease;
        }

        .sw-button:hover:not(:disabled) {
          border-color: #747c81;
          background: #1a1e21;
        }

        .sw-button.primary {
          border-color: #b5222a;
          background: #94191f;
          color: white;
        }

        .sw-button.primary:hover {
          border-color: #f12c35;
          background: #b72129;
        }

        .sw-button:disabled {
          cursor: not-allowed;
          opacity: 0.35;
        }

        .sw-layout {
          display: grid;
          min-height: calc(100vh - 68px);
          grid-template-columns: 248px minmax(0, 1fr);
        }

        .sw-sidebar {
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 24px 15px;
          border-right: 1px solid var(--border);
          background: #0c0e10;
        }

        .sw-label {
          margin: 0 9px 15px;
          color: #7f888d;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .sw-scene-list {
          display: grid;
          gap: 5px;
        }

        .sw-scene-item {
          display: flex;
          width: 100%;
          min-width: 0;
          align-items: flex-start;
          gap: 12px;
          padding: 13px 10px;
          border: 1px solid transparent;
          border-left: 2px solid transparent;
          background: transparent;
          color: #aeb5b9;
          text-align: left;
          transition: background 120ms ease;
        }

        .sw-scene-item:hover {
          background: #141719;
        }

        .sw-scene-item.active {
          border-color: #382326;
          border-left-color: var(--red);
          background: linear-gradient(90deg, #211214, #111214);
          color: white;
        }

        .sw-scene-num {
          padding-top: 2px;
          color: #727c81;
          font-size: 10px;
        }

        .sw-scene-item.active .sw-scene-num {
          color: var(--red);
        }

        .sw-scene-details {
          min-width: 0;
          flex: 1;
        }

        .sw-scene-name {
          display: block;
          overflow-wrap: anywhere;
          font-size: 12px;
          line-height: 1.5;
        }

        .sw-scene-type {
          display: block;
          margin-top: 6px;
          color: #788187;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .sw-scene-count {
          margin-top: 2px;
          color: #7d878c;
          font-size: 9px;
        }

        .sw-sidebar-actions {
          display: grid;
          gap: 8px;
          margin-top: 13px;
        }

        .sw-sidebar-button {
          width: 100%;
          padding: 12px 11px;
          border: 1px solid #303539;
          background: #101315;
          color: #b8c0c4;
          font-size: 10px;
          text-align: left;
        }

        .sw-sidebar-button:hover {
          border-color: #694045;
          color: white;
        }

        .sw-sidebar-button.danger {
          color: #d77a80;
        }

        .sw-sidebar-footer {
          margin-top: auto;
          padding: 22px 8px 0;
        }

        .sw-red-rule {
          width: 28px;
          height: 2px;
          background: var(--red);
        }

        .sw-sidebar-footer p {
          color: #727b80;
          font-size: 9px;
          line-height: 1.9;
          letter-spacing: 1px;
        }

        .sw-main {
          min-width: 0;
          padding: 32px clamp(20px, 4vw, 54px) 60px;
        }

        .sw-breadcrumb {
          margin-bottom: 24px;
          color: #7f888d;
          font-size: 9px;
          letter-spacing: 1.6px;
          line-height: 1.8;
        }

        .sw-breadcrumb span {
          color: var(--red);
        }

        .sw-heading-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 28px;
        }

        .sw-eyebrow {
          color: var(--red);
          font-size: 9px;
          letter-spacing: 2px;
        }

        .sw-heading-row h1 {
          margin: 10px 0 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(29px, 3.2vw, 43px);
          font-weight: 400;
          line-height: 1.1;
        }

        .sw-heading-row p {
          margin: 9px 0 0;
          color: #929ba0;
          font-size: 11px;
          line-height: 1.6;
        }

        .sw-ending-control {
          display: grid;
          gap: 8px;
          margin: 20px 0 24px;
          padding: 14px 16px;
          border: 1px solid rgba(241, 44, 53, 0.28);
          border-radius: 12px;
          background: rgba(241, 44, 53, 0.045);
        }
        .sw-ending-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e8e9ea;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }
        .sw-ending-toggle input {
          width: 16px;
          height: 16px;
          accent-color: #f12c35;
          cursor: pointer;
        }
        .sw-ending-control p {
          margin: 0;
          padding-left: 26px;
          color: #92989d;
          font-size: 12px;
          line-height: 1.55;
        }

        .sw-ending-badge {
          padding: 7px 9px;
          border: 1px solid #4b644b;
          color: #b0d0aa;
          font-size: 8px;
          letter-spacing: 1.3px;
          white-space: nowrap;
        }

        .sw-field {
          display: block;
          margin-bottom: 9px;
          color: #9aa2a7;
          font-size: 9px;
          letter-spacing: 1.8px;
        }

        .sw-input,
        .sw-textarea {
          display: block;
          width: 100%;
          border: 1px solid #303539;
          border-radius: 0;
          outline: none;
          background: #0f1214;
          color: #edf0f1;
          transition: border-color 150ms ease;
        }

        .sw-input:focus,
        .sw-textarea:focus {
          border-color: #9b363b;
        }

        .sw-input {
          min-height: 47px;
          margin-bottom: 24px;
          padding: 12px 14px;
          font-size: 14px;
        }

        .sw-textarea {
          min-height: 310px;
          padding: 19px;
          resize: vertical;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          line-height: 1.9;
        }

        .sw-textarea::placeholder,
        .sw-input::placeholder {
          color: #697278;
        }

        .sw-field-help {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 8px;
          margin-top: 9px;
          color: #747e83;
          font-size: 9px;
          line-height: 1.6;
        }

        .sw-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 33px 0 14px;
        }

        .sw-section-heading h2 {
          margin: 0;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 2px;
        }

        .sw-section-heading p {
          margin: 5px 0 0;
          color: #7e878c;
          font-size: 10px;
          line-height: 1.5;
        }

        .sw-choice-list {
          display: grid;
          gap: 9px;
        }

        .sw-choice-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(150px, 210px) 34px;
          align-items: center;
          gap: 9px;
          padding: 10px;
          border: 1px solid #303539;
          background: #101315;
        }

        .sw-choice-input,
        .sw-choice-select {
          width: 100%;
          min-width: 0;
          min-height: 39px;
          padding: 9px 10px;
          border: 1px solid #303539;
          border-radius: 0;
          outline: none;
          background: #090b0d;
          color: #e2e6e8;
          font-size: 11px;
        }

        .sw-choice-input:focus,
        .sw-choice-select:focus {
          border-color: #9b363b;
        }

        .sw-choice-select option {
          background: #111416;
        }

        .sw-remove-choice {
          width: 32px;
          height: 36px;
          border: 1px solid transparent;
          background: transparent;
          color: #929ba0;
          font-size: 20px;
        }

        .sw-remove-choice:hover {
          border-color: #572b30;
          color: var(--red);
        }

        .sw-empty-choices {
          padding: 18px;
          border: 1px dashed #343a3e;
          color: #929ba0;
          font-size: 11px;
          line-height: 1.7;
        }

        .sw-inspector {
          margin-top: 34px;
          border: 1px solid #303539;
          background: #0d1012;
        }

        .sw-inspector-heading {
          padding: 13px 15px;
          border-bottom: 1px solid #303539;
          color: #aeb5b9;
          font-size: 9px;
          letter-spacing: 1.8px;
        }

        .sw-inspector-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .sw-inspector-item {
          padding: 17px 14px;
          border-right: 1px solid #292e32;
        }

        .sw-inspector-item:last-child {
          border-right: 0;
        }

        .sw-inspector-item strong {
          display: block;
          font-size: 22px;
          font-weight: 400;
        }

        .sw-inspector-item span {
          display: block;
          margin-top: 7px;
          color: #7f888d;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .sw-preview {
          padding: clamp(20px, 4vw, 42px);
          border: 1px solid #303539;
          background:
            radial-gradient(ellipse at 100% 0%, #291315, transparent 48%),
            #0e1113;
        }

        .sw-preview-title {
          margin: 18px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 4vw, 39px);
          font-weight: 400;
          line-height: 1.2;
        }

        .sw-preview-copy {
          color: #c9cfd2;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          line-height: 2;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .sw-preview-choices {
          display: grid;
          gap: 10px;
          margin-top: 30px;
        }

        .sw-preview-choice {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 12px;
          padding: 15px;
          border: 1px solid #363c40;
          background: #101315;
          color: #e1e6e8;
          font-size: 11px;
          text-align: left;
        }

        .sw-preview-choice:hover {
          border-color: var(--red);
          background: #191113;
        }

        .sw-preview-choice span {
          color: var(--red);
        }

        .sw-end-label {
          margin-top: 25px;
          color: var(--red);
          font-size: 9px;
          letter-spacing: 2px;
        }

        .sw-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 28px;
          padding-top: 15px;
          border-top: 1px solid #292e32;
          color: #697278;
          font-size: 9px;
          line-height: 1.7;
        }

        @media (max-width: 900px) {
          .sw-layout {
            grid-template-columns: 205px minmax(0, 1fr);
          }

          .sw-topbar {
            padding-right: 16px;
            padding-left: 16px;
          }

          .sw-save-state {
            display: none;
          }

          .sw-main {
            padding-right: 22px;
            padding-left: 22px;
          }

          .sw-choice-card {
            grid-template-columns: minmax(0, 1fr) 34px;
          }

          .sw-choice-select {
            grid-column: 1;
            grid-row: 2;
          }

          .sw-remove-choice {
            grid-column: 2;
            grid-row: 1;
          }
        }

        @media (max-width: 650px) {
          .sw-topbar {
            position: static;
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            padding: 15px;
          }

          .sw-top-right {
            width: 100%;
            justify-content: space-between;
          }

          .sw-layout {
            grid-template-columns: minmax(0, 1fr);
          }

          .sw-sidebar {
            padding: 16px 12px;
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          .sw-sidebar > .sw-label {
            margin-bottom: 10px;
          }

          .sw-scene-list {
            display: flex;
            gap: 7px;
            overflow-x: auto;
            padding-bottom: 7px;
          }

          .sw-scene-item {
            width: 180px;
            min-width: 180px;
            min-height: 70px;
            padding: 10px;
            border: 1px solid #303539;
            border-left: 2px solid transparent;
          }

          .sw-scene-item.active {
            border-color: #57272b;
            border-left-color: var(--red);
          }

          .sw-sidebar-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sw-sidebar-footer {
            display: none;
          }

          .sw-main {
            padding: 23px 15px 35px;
          }

          .sw-heading-row {
            align-items: flex-start;
          }

          .sw-heading-row h1 {
            font-size: 31px;
          }

          .sw-textarea {
            min-height: 260px;
            padding: 14px;
          }
        }

        @media (max-width: 390px) {
          .sw-project-name {
            font-size: 10px;
            letter-spacing: 1px;
          }

          .sw-top-left {
            gap: 8px;
          }

          .sw-button {
            padding-right: 9px;
            padding-left: 9px;
            font-size: 9px;
          }

          .sw-inspector-item {
            padding: 13px 8px;
          }

          .sw-inspector-item strong {
            font-size: 19px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <header className="sw-topbar">
        <div className="sw-top-left">
          <a href="/" className="sw-back">
            ← Dashboard
          </a>
          <span className="sw-divider">/</span>
          <div>
            <div className="sw-project-name">STORY EDITOR</div>
            <div className="sw-project-sub">{storyTitle.toUpperCase()} / WORKSPACE</div>
          </div>
        </div>

        <div className="sw-top-right">
          <div className="sw-save-state">
            <span className="sw-save-dot" />
            <span>{notice}</span>
            {lastSaved && <span>· {lastSaved}</span>}
          </div>

          <button
            className="sw-button"
            onClick={openStoryPreview}
          >
            PREVIEW STORY ↗
          </button>

          <button
            className="sw-button primary"
            onClick={() => {
              try {
                const stories = loadStories();
                const existing = stories.find((item) => item.id === storyId);
                if (!existing) throw new Error("The selected story no longer exists.");
                saveStories(stories.map((item) => item.id === storyId
                  ? { ...item, title: storyTitle, scenes, updatedAt: new Date().toISOString() }
                  : item));

                setLastSaved(
                  new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                );
                setNotice("Saved successfully");
              } catch {
                setNotice("Save failed");
              }
            }}
          >
            SAVE DRAFT
          </button>
        </div>
      </header>

      <div className="sw-layout">
        <aside className="sw-sidebar">
          <p className="sw-label">STORY STRUCTURE / {scenes.length}</p>

          <div className="sw-scene-list">
            {scenes.map((scene, index) => (
              <button
                key={scene.id}
                className={`sw-scene-item ${
                  activeScene.id === scene.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveId(scene.id);
                  setView("write");
                }}
              >
                <span className="sw-scene-num">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="sw-scene-details">
                  <span className="sw-scene-name">
                    {scene.title || "Untitled Scene"}
                  </span>
                  <span className="sw-scene-type">
                    {scene.ending ? "ENDING" : "STORY SCENE"}
                  </span>
                  <span className="sw-scene-count">
                    {scene.choices.length}{" "}
                    {scene.choices.length === 1 ? "choice" : "choices"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="sw-sidebar-actions">
            <button className="sw-sidebar-button" onClick={addScene}>
              + Add scene
            </button>
            <button
              className="sw-sidebar-button danger"
              onClick={deleteScene}
              disabled={scenes.length <= 1}
            >
              − Delete selected
            </button>
          </div>

          <div className="sw-sidebar-footer">
            <div className="sw-red-rule" />
            <p>
              DIFFERENT PATHS.
              <br />
              A DEEPER WORLD.
            </p>
          </div>
        </aside>

        <section className="sw-main">
          <div className="sw-breadcrumb">
            MY STORIES / {storyTitle.toUpperCase()} / <span>SCENE EDITOR</span>
          </div>

          <div className="sw-heading-row">
            <div>
              <div className="sw-eyebrow">
                {view === "write" ? "SCENE WORKSPACE" : "READER MODE"}
              </div>
              <h1>
                {view === "write" ? "Shape the scene." : "Read the story."}
              </h1>
              <p>
                {view === "write"
                  ? "Every choice opens another path."
                  : "Choose a path to continue the narrative."}
              </p>
            </div>

            {activeScene.ending && (
              <span className="sw-ending-badge">ENDING</span>
            )}
          </div>

          {view === "write" ? (
            <>
              <label className="sw-field" htmlFor="story-title">
                STORY TITLE
              </label>
              <input
                id="story-title"
                className="sw-input"
                value={storyTitle}
                onChange={(event) => setStoryTitle(event.target.value)}
                placeholder="Name your story"
              />

              <label className="sw-field" htmlFor="scene-title">
                SCENE TITLE
              </label>

              <input
                id="scene-title"
                className="sw-input"
                value={activeScene.title}
                onChange={(event) =>
                  updateScene({ title: event.target.value })
                }
                placeholder="Name this scene"
              />

              <label className="sw-field" htmlFor="scene-narrative">
                NARRATIVE
              </label>

              <textarea
                id="scene-narrative"
                className="sw-textarea"
                value={activeScene.text}
                onChange={(event) =>
                  updateScene({ text: event.target.value })
                }
                placeholder="Write your scene here. Let the world unfold..."
              />

              <div className="sw-field-help">
                <span>Separate paragraphs with a blank line.</span>
                <span>
                  {wordCount} words in this scene · {totalWords} total
                </span>
              </div>

              <div className="sw-ending-control">
                <label className="sw-ending-toggle" htmlFor="scene-ending">
                  <input
                    id="scene-ending"
                    type="checkbox"
                    checked={Boolean(activeScene.ending)}
                    onChange={(event) => setSceneEnding(event.target.checked)}
                  />
                  <span>Mark this scene as an ending</span>
                </label>
                <p>
                  Ending scenes conclude a path. Marking a scene as an ending
                  removes its outgoing choices after confirmation.
                </p>
              </div>

              <div className="sw-section-heading">
                <div>
                  <h2>PLAYER CHOICES</h2>
                  <p>Decide where each choice takes the reader.</p>
                </div>

                {!activeScene.ending && (
                  <button className="sw-button" onClick={addChoice}>
                    + ADD CHOICE
                  </button>
                )}
              </div>

              {activeScene.choices.length > 0 ? (
                <div className="sw-choice-list">
                  {activeScene.choices.map((choice, index) => (
                    <div className="sw-choice-card" key={choice.id}>
                      <input
                        className="sw-choice-input"
                        aria-label={`Choice ${index + 1} text`}
                        value={choice.text}
                        onChange={(event) =>
                          updateChoice(choice.id, {
                            text: event.target.value,
                          })
                        }
                        placeholder="What can the reader choose?"
                      />

                      <select
                        className="sw-choice-select"
                        aria-label={`Choice ${index + 1} destination`}
                        value={choice.target}
                        onChange={(event) =>
                          updateChoice(choice.id, {
                            target: event.target.value,
                          })
                        }
                      >
                        {scenes.map((scene) => (
                          <option key={scene.id} value={scene.id}>
                            → {scene.title || "Untitled Scene"}
                          </option>
                        ))}
                      </select>

                      <button
                        className="sw-remove-choice"
                        aria-label={`Remove choice ${index + 1}`}
                        onClick={() => deleteChoice(choice.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sw-empty-choices">
                  No choices yet. Add a choice to connect this scene to
                  another part of your story.
                </div>
              )}

              <div className="sw-inspector">
                <div className="sw-inspector-heading">
                  /// SCENE INSPECTOR
                </div>

                <div className="sw-inspector-grid">
                  <div className="sw-inspector-item">
                    <strong>{scenes.length}</strong>
                    <span>TOTAL SCENES</span>
                  </div>
                  <div className="sw-inspector-item">
                    <strong>{activeScene.choices.length}</strong>
                    <span>CHOICES HERE</span>
                  </div>
                  <div className="sw-inspector-item">
                    <strong style={{ color: brokenLinks ? "#f15a60" : "#a9c7a5" }}>
                      {brokenLinks}
                    </strong>
                    <span>BROKEN LINKS</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <article className="sw-preview">
              <div className="sw-eyebrow">THE LAST SIGNAL / READER VIEW</div>
              <h2 className="sw-preview-title">
                {activeScene.title || "Untitled Scene"}
              </h2>

              <div className="sw-preview-copy">
                {activeScene.text || "This scene is waiting for its story."}
              </div>

              {activeScene.ending ? (
                <div className="sw-end-label">END OF THIS PATH</div>
              ) : (
                <div className="sw-preview-choices">
                  {activeScene.choices.map((choice) => (
                    <button
                      className="sw-preview-choice"
                      key={choice.id}
                      onClick={() => navigateToChoice(choice)}
                      disabled={!scenes.some((scene) => scene.id === choice.target)}
                    >
                      <span>→</span>
                      {choice.text}
                    </button>
                  ))}
                </div>
              )}

              <button
                className="sw-button"
                style={{ marginTop: 25 }}
                onClick={() => setActiveId(scenes[0].id)}
              >
                ↺ RESTART PATH
              </button>
            </article>
          )}

          <footer className="sw-footer">
            <span>STORYWEAVER / WORLDS TAKE SHAPE</span>
            <span>
              {notice}
              {lastSaved ? ` · LAST SAVE ${lastSaved}` : ""}
            </span>
            <button className="sw-button" onClick={resetDemoStory}>
              RESET DEMO STORY
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}

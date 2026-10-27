"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  loadStories,
  saveStories,
  STORY_STORAGE_KEY,
  starterStory,
  type StoryDocument,
  type StoryScene,
} from "../../lib/story-store";
import IdeasNotes from "../../components/IdeasNotes";

type SceneData = {
  title: string;
  description: string;
  kind: "start" | "scene" | "ending";
};

const POSITION_KEY = "storyweaver-branch-positions-v1";
const nodeTypes = { scene: SceneNode };

function createId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

function SceneNode({ data }: NodeProps<Node<SceneData>>) {
  return (
    <div className={`scene-node ${data.kind}`}>
      {data.kind !== "start" && (
        <Handle type="target" position={Position.Left} />
      )}
      <div className="node-kicker">
        <span className="node-dot" />
        {data.kind === "start"
          ? "ENTRY POINT"
          : data.kind === "ending"
            ? "ENDING"
            : "STORY SCENE"}
      </div>
      <div className="node-title">{data.title}</div>
      <div className="node-description">{data.description}</div>
      <div className="node-footer">
        {data.kind === "ending" ? "END OF PATH" : "BRANCH POINT ↗"}
      </div>
      {data.kind !== "ending" && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

function toNodes(
  scenes: StoryScene[],
  positions: Record<string, { x: number; y: number }>,
  existing: Node<SceneData>[] = [],
): Node<SceneData>[] {
  return scenes.map((scene, index) => {
    const previous = existing.find((node) => node.id === scene.id);
    const kind: SceneData["kind"] =
      index === 0 ? "start" : scene.ending ? "ending" : "scene";
    return {
      id: scene.id,
      type: "scene",
      position: positions[scene.id] ??
        previous?.position ?? {
          x: 80 + (index % 3) * 300,
          y: 70 + Math.floor(index / 3) * 230,
        },
      data: {
        title: scene.title || "Untitled Scene",
        description:
          scene.text.trim().slice(0, 105) ||
          "This scene is waiting for its story.",
        kind,
      },
    };
  });
}

function toEdges(scenes: StoryScene[]): Edge[] {
  const ids = new Set(scenes.map((scene) => scene.id));
  return scenes.flatMap((scene) =>
    scene.choices
      .filter((choice) => ids.has(choice.target))
      .map((choice) => ({
        id: choice.id,
        source: scene.id,
        target: choice.target,
        label: choice.text || "Untitled choice",
        type: "smoothstep" as const,
      })),
  );
}

export default function BranchMapPage() {
  const [story, setStory] = useState<StoryDocument>(starterStory);
  const [scenes, setScenes] = useState<StoryScene[]>(starterStory.scenes);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const externalChangeRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    starterStory.scenes[0]?.id ?? null,
  );
  const [notice, setNotice] = useState("Loading story...");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SceneData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  
  useEffect(() => {
    try {
      const saved = loadStories();
    const loadedStory =
      saved.find((item) => item.id === starterStory.id) ?? starterStory;
    const loadedScenes = loadedStory.scenes.length
      ? loadedStory.scenes
      : starterStory.scenes;
    let loadedPositions: Record<string, { x: number; y: number }> = {};
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [id, value] of Object.entries(parsed)) {
            if (
              value &&
              typeof value === "object" &&
              "x" in value &&
              "y" in value &&
              typeof value.x === "number" &&
              typeof value.y === "number" &&
              Number.isFinite(value.x) &&
              Number.isFinite(value.y) &&
              Math.abs(value.x) <= 100000 &&
              Math.abs(value.y) <= 100000
            ) {
              loadedPositions[id] = { x: value.x, y: value.y };
            }
          }
        }
      }
    } catch {
      // Invalid layout data is ignored; default positions will be used.
    }
    setStory(loadedStory);
    setScenes(loadedScenes);
    setPositions(loadedPositions);
    setNodes(toNodes(loadedScenes, loadedPositions));
    setEdges(toEdges(loadedScenes));
    setSelectedId(loadedScenes[0]?.id ?? null);
      setReady(true);
      setNotice("Story loaded");
    } catch {
      const fallbackScenes = structuredClone(starterStory.scenes);
      setStory(starterStory);
      setScenes(fallbackScenes);
      setNodes(toNodes(fallbackScenes, {}));
      setEdges(toEdges(fallbackScenes));
      setSelectedId(fallbackScenes[0]?.id ?? null);
      setStorageBlocked(true);
      setReady(true);
      setNotice("Could not read saved stories. Existing browser data was not overwritten.");
    }
  }, [setNodes, setEdges]);

  // Refresh node labels and edges when story content changes.
  // IMPORTANT: do not rebuild the React Flow nodes when `positions` changes.
  // Dragging updates positions continuously; rebuilding the node array during
  // a drag can interrupt React Flow's live drag state and make nodes flicker
  // or appear to disappear until the page is refreshed. Position changes are
  // already applied by `onNodesChange`; this effect is only for story changes.
  useEffect(() => {
    if (!ready) return;
    setNodes((current) => toNodes(scenes, positions, current));
    setEdges(toEdges(scenes));
  }, [scenes, ready, setNodes, setEdges]);

  // Save the shared story model. This does not clear or reset existing user data.
  useEffect(() => {
    if (!ready || storageBlocked || externalChangeRef.current) return;
    try {
      const allStories = loadStories();
      saveStories([
        ...allStories.filter((item) => item.id !== story.id),
        { ...story, scenes, updatedAt: new Date().toISOString() },
      ]);
      setNotice("Saved in this browser");
    } catch {
      setNotice("Save failed — browser storage may be unavailable");
    }
  }, [scenes, ready, story, storageBlocked]);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key !== STORY_STORAGE_KEY || !event.newValue) return;
      try {
        const remoteStories = JSON.parse(event.newValue) as Array<{ id?: string; scenes?: unknown }>;
        const remoteStory = remoteStories.find((item) => item.id === story.id);
        if (remoteStory && JSON.stringify(remoteStory.scenes) !== JSON.stringify(scenes)) {
          externalChangeRef.current = true;
          setNotice("This story changed in another tab. Refresh before saving to avoid overwriting newer edits.");
        }
      } catch {
        externalChangeRef.current = true;
        setNotice("Saved data changed in another tab. Refresh before continuing.");
      }
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [scenes, story.id]);

  useEffect(() => {
    if (!ready || storageBlocked) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
    } catch {
      setNotice("Could not save graph layout");
    }
  }, [positions, ready, storageBlocked]);

  const selectedScene = scenes.find((scene) => scene.id === selectedId);
  const reachableIds = useMemo(() => {
    const first = scenes[0];
    const visited = new Set<string>();
    if (!first) return visited;
    const queue = [first.id];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const scene = scenes.find((item) => item.id === id);
      for (const choice of scene?.choices ?? []) {
        if (
          scenes.some((item) => item.id === choice.target) &&
          !visited.has(choice.target)
        )
          queue.push(choice.target);
      }
    }
    return visited;
  }, [scenes]);
  const endings = scenes.filter((scene) => scene.ending);
  const reachableEndings = endings.filter((scene) =>
    reachableIds.has(scene.id),
  );
  const brokenLinks = scenes.reduce(
    (count, scene) =>
      count +
      scene.choices.filter(
        (choice) => !scenes.some((item) => item.id === choice.target),
      ).length,
    0,
  );

  // Diagnostics are derived from the same scenes used by the graph and reader.
  const unreachableScenes = scenes.filter(
    (scene) => !reachableIds.has(scene.id),
  );
  const deadEndScenes = scenes.filter(
    (scene) =>
      !scene.ending &&
      !scene.choices.some((choice) =>
        scenes.some((target) => target.id === choice.target),
      ),
  );
  const brokenBranches = scenes.flatMap((scene) =>
    scene.choices
      .filter((choice) => !scenes.some((target) => target.id === choice.target))
      .map((choice) => ({
        sceneTitle: scene.title || "Untitled Scene",
        choiceText: choice.text || "Untitled choice",
        targetId: choice.target,
      })),
  );
  const scenesInLoops = useMemo(() => {
    const visited = new Set<string>();
    const active = new Set<string>();
    const loopScenes = new Set<string>();
    const path: string[] = [];

    function visit(id: string) {
      if (active.has(id)) {
        const start = path.lastIndexOf(id);
        for (const pathId of path.slice(start)) loopScenes.add(pathId);
        return;
      }
      if (visited.has(id)) return;

      visited.add(id);
      active.add(id);
      path.push(id);
      const scene = scenes.find((item) => item.id === id);
      for (const choice of scene?.choices ?? []) {
        if (scenes.some((item) => item.id === choice.target)) {
          visit(choice.target);
        }
      }
      path.pop();
      active.delete(id);
    }

    for (const scene of scenes) visit(scene.id);
    return scenes.filter((scene) => loopScenes.has(scene.id));
  }, [scenes]);

  const duplicateConnections = scenes.flatMap((scene) => {
    const seenTargets = new Set<string>();
    return scene.choices.flatMap((choice) => {
      if (!scenes.some((item) => item.id === choice.target)) return [];
      if (seenTargets.has(choice.target)) {
        return [{ sceneTitle: scene.title || "Untitled Scene", choiceText: choice.text || "Untitled choice", targetId: choice.target }];
      }
      seenTargets.add(choice.target);
      return [];
    });
  });
  const endingWithChoices = scenes.filter(
    (scene) => scene.ending && scene.choices.length > 0,
  );
  const diagnosticCount =
    brokenBranches.length + unreachableScenes.length + deadEndScenes.length +
    duplicateConnections.length + endingWithChoices.length;

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) {
        setNotice("Choose both a source scene and a destination scene.");
        return;
      }
      if (!scenes.some((scene) => scene.id === source)) {
        setNotice("Branch not added: the source scene no longer exists.");
        return;
      }
      if (!scenes.some((scene) => scene.id === target)) {
        setNotice("Branch not added: the destination scene does not exist.");
        return;
      }
      const sourceScene = scenes.find((scene) => scene.id === source);
      if (sourceScene?.ending) {
        setNotice("Branch not added: ending scenes cannot have outgoing choices.");
        return;
      }
      if (sourceScene?.choices.some((choice) => choice.target === target)) {
        setNotice("Branch not added: this scene already has a connection to that destination.");
        return;
      }

      // Cycles are allowed: branching stories can intentionally loop back.
      setScenes((current) =>
        current.map((scene) =>
          scene.id === source
            ? {
                ...scene,
                choices: [
                  ...scene.choices,
                  {
                    id: createId("choice"),
                    text: "New choice",
                    target,
                  },
                ],
              }
            : scene,
        ),
      );
      setNotice("Branch added. Edit its choice text in the selected scene panel.");
    },
    [scenes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<SceneData>>[]) => {
      // React Flow must process every change (selection, dimensions, dragging, etc.).
      onNodesChange(changes);

      // Only persist actual position changes. Do not create a new positions
      // object for selection/dimension changes, or for unchanged coordinates.
      const hasPositionChange = changes.some(
        (change) => change.type === "position" && change.position,
      );
      if (!hasPositionChange) return;

      setPositions((current) => {
        let changed = false;
        const next = { ...current };

        for (const change of changes) {
          if (change.type !== "position" || !change.position) continue;

          const { x, y } = change.position;
          const previous = current[change.id];

          if (!previous || previous.x !== x || previous.y !== y) {
            next[change.id] = { x, y };
            changed = true;
          }
        }

        return changed ? next : current;
      });
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const removedIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedIds.length) {
        setScenes((current) =>
          current.map((scene) => ({
            ...scene,
            choices: scene.choices.filter(
              (choice) => !removedIds.includes(choice.id),
            ),
          })),
        );
      }
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  function addScene() {
    const id = createId("scene");
    const scene: StoryScene = {
      id,
      title: "Untitled Scene",
      text: "",
      choices: [],
    };
    setScenes((current) => [...current, scene]);
    setPositions((current) => ({
      ...current,
      [id]: {
        x: 80 + (scenes.length % 3) * 300,
        y: 70 + Math.floor(scenes.length / 3) * 230,
      },
    }));
    setSelectedId(id);
    setNotice("Scene added");
  }

  function deleteSelectedScene() {
    if (!selectedScene || selectedScene.id === scenes[0]?.id) return;
    const deletedId = selectedScene.id;
    setScenes((current) =>
      current
        .filter((scene) => scene.id !== deletedId)
        .map((scene) => ({
          ...scene,
          choices: scene.choices.filter(
            (choice) => choice.target !== deletedId,
          ),
        })),
    );
    setPositions((current) => {
      const next = { ...current };
      delete next[deletedId];
      return next;
    });
    setSelectedId(scenes.find((scene) => scene.id !== deletedId)?.id ?? null);
    setNotice("Scene deleted");
  }

  function updateSelected(patch: Partial<StoryScene>) {
    if (!selectedId) return;
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedId ? { ...scene, ...patch } : scene,
      ),
    );
  }

  function updateChoice(choiceId: string, patch: { text?: string; target?: string }) {
    if (!selectedId) return;
    if (patch.target && !scenes.some((scene) => scene.id === patch.target)) {
      setNotice("That destination no longer exists. Choose a valid scene.");
      return;
    }
    if (
      patch.target &&
      scenes.find((scene) => scene.id === selectedId)?.choices.some(
        (choice) => choice.id !== choiceId && choice.target === patch.target,
      )
    ) {
      setNotice("That scene already has a connection to this destination.");
      return;
    }
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedId
          ? {
              ...scene,
              choices: scene.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, ...patch } : choice,
              ),
            }
          : scene,
      ),
    );
    setNotice("Choice updated");
  }

  function addChoice() {
    if (!selectedScene) return;
    if (selectedScene.ending) {
      setNotice("Ending scenes cannot have outgoing choices. Remove ending status in the Editor first.");
      return;
    }
    const targetScene = scenes.find(
      (scene) =>
        scene.id !== selectedScene.id &&
        !selectedScene.choices.some((choice) => choice.target === scene.id),
    );
    if (!targetScene) {
      setNotice("No unconnected destination remains. Add another scene or edit an existing choice.");
      return;
    }
    const choice = {
      id: createId("choice"),
      text: "New choice",
      target: targetScene.id,
    };
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedScene.id
          ? { ...scene, choices: [...scene.choices, choice] }
          : scene,
      ),
    );
    setNotice("Choice added. Edit its text and destination below.");
  }

  function deleteChoice(choiceId: string) {
    if (!selectedId) return;
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedId
          ? { ...scene, choices: scene.choices.filter((choice) => choice.id !== choiceId) }
          : scene,
      ),
    );
    setNotice("Branch deleted");
  }

  if (!ready) {
    return <main className="branch-loading">LOADING STORY STRUCTURE...</main>;
  }

  return (
    <main className="branch-page">
      <style jsx global>{`
        .branch-page {
          min-height: 100vh;
          background: #090b0d;
          color: #edf0f1;
          font-family: Arial, Helvetica, sans-serif;
        }
        .branch-header {
          display: flex;
          min-height: 76px;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 15px 25px;
          border-bottom: 1px solid #303539;
          background: #0c0e10;
        }
        .branch-brand {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .branch-brand a {
          color: #a0a7ac;
          font-size: 12px;
          text-decoration: none;
        }
        .branch-brand strong {
          font-size: 12px;
          letter-spacing: 2px;
        }
        .branch-brand p {
          margin: 5px 0 0;
          color: #80898e;
          font-size: 10px;
        }
        .branch-button {
          padding: 11px 14px;
          border: 1px solid #3a4044;
          background: #111416;
          color: #e4e8ea;
          font-size: 10px;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .branch-button:hover:not(:disabled) {
          border-color: #f12c35;
        }
        .branch-button.primary {
          border-color: #b9232b;
          background: #97191f;
          color: white;
        }
        .branch-button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }
        .branch-workspace {
          display: grid;
          height: calc(100vh - 76px);
          min-height: 520px;
          grid-template-columns: minmax(0, 1fr) 275px;
        }
        .branch-canvas {
          min-width: 0;
          height: 100%;
          background: #090b0d;
        }
        .branch-sidebar {
          overflow-y: auto;
          padding: 23px 17px;
          border-left: 1px solid #303539;
          background: #0c0e10;
        }
        .branch-label {
          margin: 0 0 15px;
          color: #92999e;
          font-size: 10px;
          letter-spacing: 2px;
        }
        .branch-metric {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #262b2e;
          color: #a4acb0;
          font-size: 11px;
        }
        .branch-metric strong {
          max-width: 150px;
          color: #f0f2f3;
          font-weight: 500;
          text-align: right;
          overflow-wrap: anywhere;
        }
        .branch-sidebar h3 {
          margin: 26px 0 12px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 1.5px;
        }
        .branch-field {
          display: block;
          margin: 13px 0 7px;
          color: #899298;
          font-size: 9px;
          letter-spacing: 1px;
        }
        .branch-input,
        .branch-textarea {
          display: block;
          width: 100%;
          padding: 10px;
          border: 1px solid #303539;
          outline: none;
          background: #101315;
          color: white;
          font-size: 11px;
        }
        .branch-input:focus,
        .branch-textarea:focus {
          border-color: #a12c33;
        }
        .branch-textarea {
          min-height: 115px;
          resize: vertical;
          line-height: 1.6;
        }
        .choice-card {
          margin-top: 12px;
          padding: 11px;
          border: 1px solid #303539;
          background: #101315;
        }
        .choice-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          color: #b9c0c4;
          font-size: 9px;
          letter-spacing: 1px;
        }
        .choice-delete {
          border: 1px solid #593237;
          padding: 5px 7px;
          background: #1a1113;
          color: #f18a90;
          font-size: 9px;
          cursor: pointer;
        }
        .choice-delete:hover { border-color: #f12c35; }
        .branch-select {
          display: block;
          width: 100%;
          padding: 10px;
          border: 1px solid #303539;
          background: #101315;
          color: #f0f2f3;
          font-size: 11px;
        }
        .branch-select:focus { outline: none; border-color: #a12c33; }
        .choice-warning {
          margin: 7px 0 0;
          color: #f0b45e;
          font-size: 10px;
          line-height: 1.5;
        }
        .branch-note {
          margin-top: 18px;
          padding: 13px;
          border: 1px solid #303539;
          color: #969ea3;
          font-size: 11px;
          line-height: 1.7;
        }
        .branch-note strong {
          display: block;
          margin-bottom: 6px;
          color: #f12c35;
          font-size: 9px;
          letter-spacing: 1.5px;
        }
        .branch-status {
          margin-top: 14px;
          color: #a9c7a5;
          font-size: 10px;
          line-height: 1.6;
        }
        .diagnostics-panel {
          margin-top: 22px;
          padding: 13px;
          border: 1px solid #303539;
          background: #101315;
        }
        .diagnostics-summary {
          margin: 0 0 10px;
          color: #aeb6ba;
          font-size: 10px;
          line-height: 1.6;
        }
        .diagnostic-item {
          margin-top: 8px;
          padding: 9px;
          border-left: 2px solid #f15a60;
          background: #191113;
          color: #d9dfe1;
          font-size: 10px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
        .diagnostic-item.warning {
          border-left-color: #d6a84f;
          background: #19170f;
        }
        .diagnostic-item.ok {
          border-left-color: #82b58a;
          background: #111914;
        }
        .diagnostic-item strong {
          display: block;
          margin-bottom: 3px;
          color: #f0f2f3;
          font-size: 9px;
          letter-spacing: 0.5px;
        }
        .scene-node {
          width: 215px;
          border: 1px solid #3a4145;
          border-top: 2px solid #7a858a;
          background: #111518;
          box-shadow: 0 8px 24px #0007;
        }
        .scene-node.start {
          border-top-color: #f12c35;
        }
        .scene-node.ending {
          border-color: #71343a;
          border-top-color: #f12c35;
        }
        .node-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 12px;
          border-bottom: 1px solid #303539;
          color: #929ba0;
          font-size: 8px;
          letter-spacing: 1.5px;
        }
        .node-dot {
          width: 6px;
          height: 6px;
          background: #858e93;
        }
        .scene-node.start .node-dot,
        .scene-node.ending .node-dot {
          background: #f12c35;
        }
        .node-title {
          padding: 13px 12px 6px;
          color: #f1f3f4;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 17px;
          overflow-wrap: anywhere;
        }
        .node-description {
          min-height: 44px;
          padding: 0 12px 12px;
          color: #9ca5aa;
          font-size: 10px;
          line-height: 1.6;
        }
        .node-footer {
          padding: 9px 12px;
          border-top: 1px solid #303539;
          color: #f12c35;
          font-size: 8px;
          letter-spacing: 1px;
        }
        .scene-node .react-flow__handle {
          width: 9px;
          height: 9px;
          border: 1px solid #f12c35;
          background: #111518;
        }
        .branch-page .react-flow__edge-path {
          stroke: #697379;
          stroke-width: 1.5;
        }
        .branch-page .react-flow__edge-text {
          fill: #d8dddf;
          font-size: 10px;
        }
        .branch-page .react-flow__edge-textbg {
          fill: #111518;
          fill-opacity: 0.95;
        }
        .branch-page .react-flow__controls {
          overflow: hidden;
          border: 1px solid #3a4145;
          box-shadow: none;
        }
        .branch-page .react-flow__controls-button {
          border-bottom: 1px solid #303539;
          background: #111518;
          fill: #e2e6e8;
        }
        .branch-page .react-flow__minimap {
          border: 1px solid #3a4145;
          background: #111518;
        }
        .branch-page .react-flow__attribution {
          display: none;
        }
        .branch-loading {
          display: grid;
          min-height: 100vh;
          place-items: center;
          background: #090b0d;
          color: #aab2b6;
          font:
            11px Arial,
            sans-serif;
          letter-spacing: 2px;
        }
        @media (max-width: 850px) {
          .branch-workspace {
            height: auto;
            grid-template-columns: minmax(0, 1fr);
          }
          .branch-canvas {
            height: 65vh;
            min-height: 450px;
          }
          .branch-sidebar {
            border-top: 1px solid #303539;
            border-left: 0;
          }
          .branch-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <header className="branch-header">
        <div className="branch-brand">
          <a href="/editor">← Editor</a>
          <div>
            <strong>STORYWEAVER / BRANCH MAP</strong>
            <p>{story.title.toUpperCase()} · STORY STRUCTURE</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <IdeasNotes />
          <button className="branch-button primary" onClick={addScene}>
            + ADD SCENE
          </button>
        </div>
      </header>

      <div className="branch-workspace">
        <section className="branch-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            defaultEdgeOptions={{ type: "smoothstep" }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            onInit={(instance) => {
              // Refit after the graph has mounted with the loaded nodes.
              window.requestAnimationFrame(() => {
                void instance.fitView({ padding: 0.2, duration: 0 });
              });
            }}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1}
              color="#303539"
            />
            <Controls />
            <MiniMap
              nodeColor={(node) =>
                (node.data as SceneData).kind === "ending"
                  ? "#f12c35"
                  : "#465158"
              }
              maskColor="rgba(5,7,9,.75)"
            />
          </ReactFlow>
        </section>

        <aside className="branch-sidebar">
          <p className="branch-label">/// GRAPH ANALYSIS</p>
          <div className="branch-metric">
            <span>Total scenes</span>
            <strong>{scenes.length}</strong>
          </div>
          <div className="branch-metric">
            <span>Connections</span>
            <strong>{edges.length}</strong>
          </div>
          <div className="branch-metric">
            <span>Reachable scenes</span>
            <strong>
              {reachableIds.size} / {scenes.length}
            </strong>
          </div>
          <div className="branch-metric">
            <span>Reachable endings</span>
            <strong>
              {reachableEndings.length} / {endings.length}
            </strong>
          </div>
          <div className="branch-metric">
            <span>Disconnected scenes</span>
            <strong
              style={{
                color:
                  scenes.length - reachableIds.size ? "#f15a60" : "#a9c7a5",
              }}
            >
              {scenes.length - reachableIds.size}
            </strong>
          </div>
          <div className="branch-metric">
            <span>Broken links</span>
            <strong style={{ color: brokenLinks ? "#f15a60" : "#a9c7a5" }}>
              {brokenLinks}
            </strong>
          </div>

          <h3>STORY DIAGNOSTICS</h3>
          <div className="diagnostics-panel">
            <p className="diagnostics-summary">
              {diagnosticCount === 0
                ? "No broken branches, duplicate connections, unreachable scenes, or dead ends detected."
                : `${diagnosticCount} issue${diagnosticCount === 1 ? "" : "s"} found. Review the items below.`}
            </p>
            {brokenBranches.map((item, index) => (
              <div className="diagnostic-item" key={`broken-${item.sceneTitle}-${item.targetId}-${index}`}>
                <strong>BROKEN BRANCH</strong>
                “{item.choiceText}” in “{item.sceneTitle}” points to missing scene ID “{item.targetId}”.
              </div>
            ))}
            {duplicateConnections.map((item, index) => (
              <div className="diagnostic-item warning" key={`duplicate-${item.sceneTitle}-${item.targetId}-${index}`}>
                <strong>DUPLICATE CONNECTION</strong>
                “{item.choiceText}” in “{item.sceneTitle}” repeats a connection to scene ID “{item.targetId}”.
              </div>
            ))}
            {endingWithChoices.map((scene) => (
              <div className="diagnostic-item warning" key={`ending-choices-${scene.id}`}>
                <strong>ENDING HAS OUTGOING CHOICES</strong>
                “{scene.title || "Untitled Scene"}” is marked as an ending but still has outgoing choices. Remove the choices or clear ending status in the Editor.
              </div>
            ))}
            {unreachableScenes.map((scene) => (
              <div className="diagnostic-item warning" key={`unreachable-${scene.id}`}>
                <strong>UNREACHABLE SCENE</strong>
                “{scene.title || "Untitled Scene"}” cannot be reached from the first scene.
              </div>
            ))}
            {deadEndScenes.map((scene) => (
              <div className="diagnostic-item warning" key={`dead-end-${scene.id}`}>
                <strong>DEAD END</strong>
                “{scene.title || "Untitled Scene"}” is not marked as an ending and has no valid outgoing choices.
              </div>
            ))}
            {endings.length > 0 && reachableEndings.length < endings.length && (
              <div className="diagnostic-item warning" key="unreachable-ending-summary">
                <strong>ENDING ACCESSIBILITY</strong>
                {endings.length - reachableEndings.length} ending{endings.length - reachableEndings.length === 1 ? "" : "s"} cannot be reached from the first scene.
              </div>
            )}
            {scenesInLoops.length > 0 && (
              <div className="diagnostic-item warning" key="loop-summary">
                <strong>LOOP DETECTED</strong>
                A path loops back through: {scenesInLoops.map((scene) => scene.title || "Untitled Scene").join(", ")}. Loops can be intentional; review them if they are unexpected.
              </div>
            )}
            {diagnosticCount === 0 && scenesInLoops.length === 0 && (
              <div className="diagnostic-item ok">
                <strong>STRUCTURE LOOKS HEALTHY</strong>
                All scenes are reachable, every non-ending scene has a valid next choice, and no broken branches were found.
              </div>
            )}
            {endings.length === 0 && (
              <div className="diagnostic-item warning">
                <strong>NO ENDINGS</strong>
                No scene is currently marked as an ending.
              </div>
            )}
          </div>

          <h3>SELECTED SCENE</h3>
          {selectedScene ? (
            <>
              <label className="branch-field" htmlFor="map-scene-title">
                SCENE TITLE
              </label>
              <input
                id="map-scene-title"
                className="branch-input"
                value={selectedScene.title}
                onChange={(event) =>
                  updateSelected({ title: event.target.value })
                }
                onBlur={() => {
                  if (!selectedScene.title.trim()) {
                    updateSelected({ title: "Untitled Scene" });
                    setNotice("Blank scene title replaced with “Untitled Scene”.");
                  }
                }}
              />
              <label className="branch-field" htmlFor="map-scene-text">
                NARRATIVE
              </label>
              <textarea
                id="map-scene-text"
                className="branch-textarea"
                value={selectedScene.text}
                onChange={(event) =>
                  updateSelected({ text: event.target.value })
                }
              />
              <div className="branch-metric" style={{ marginTop: 12 }}>
                <span>Choices / branches</span>
                <strong>{selectedScene.choices.length}</strong>
              </div>
              <h3>CHOICES & DESTINATIONS</h3>
              {selectedScene.choices.map((choice, index) => {
                const targetExists = scenes.some((scene) => scene.id === choice.target);
                return (
                  <div className="choice-card" key={choice.id}>
                    <div className="choice-card-header">
                      <span>BRANCH {index + 1}</span>
                      <button
                        type="button"
                        className="choice-delete"
                        onClick={() => deleteChoice(choice.id)}
                        aria-label={`Delete branch ${index + 1}`}
                      >
                        DELETE
                      </button>
                    </div>
                    <label className="branch-field" htmlFor={`choice-text-${choice.id}`}>
                      CHOICE TEXT
                    </label>
                    <input
                      id={`choice-text-${choice.id}`}
                      className="branch-input"
                      value={choice.text}
                      onChange={(event) => updateChoice(choice.id, { text: event.target.value })}
                      placeholder="What does the reader choose?"
                    />
                    <label className="branch-field" htmlFor={`choice-target-${choice.id}`}>
                      DESTINATION SCENE
                    </label>
                    <select
                      id={`choice-target-${choice.id}`}
                      className="branch-select"
                      value={choice.target}
                      onChange={(event) => updateChoice(choice.id, { target: event.target.value })}
                    >
                      {!targetExists && (
                        <option value={choice.target}>Missing destination: {choice.target || "(empty)"}</option>
                      )}
                      {scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.title || "Untitled Scene"}{scene.id === selectedScene.id ? " (this scene / loop)" : ""}
                        </option>
                      ))}
                    </select>
                    {!targetExists && (
                      <p className="choice-warning">This branch is broken. Choose an existing destination or delete this branch.</p>
                    )}
                    {choice.target === selectedScene.id && targetExists && (
                      <p className="choice-warning">This branch loops back to the same scene. That is allowed if intentional.</p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="branch-button"
                style={{ width: "100%", marginTop: 12 }}
                onClick={addChoice}
              >
                + ADD CHOICE / BRANCH
              </button>
              <button
                className="branch-button"
                style={{ width: "100%", marginTop: 15 }}
                onClick={deleteSelectedScene}
                disabled={selectedScene.id === scenes[0]?.id}
              >
                DELETE SELECTED SCENE
              </button>
            </>
          ) : (
            <p style={{ color: "#92999e", fontSize: 11 }}>
              Select a node to inspect and edit it.
            </p>
          )}

          <div className="branch-note">
            <strong>CREATE A BRANCH</strong>Drag from a scene's right handle to
            another scene's left handle, or select a scene and use ADD CHOICE /
            BRANCH. Select a scene to edit each choice's text and destination.
          </div>
          <div className="branch-note">
            <strong>SHARED STORY DATA</strong>Scene text and branches use the same
            saved story data as the Editor and Play Mode. Changes are saved in this
            browser; revisit the other page to load the latest saved story. Node
            positions are saved separately. Loops are permitted and flagged for review.
          </div>
          <p className="branch-status">{notice}</p>
        </aside>
      </div>
    </main>
  );
}
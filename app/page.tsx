"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStories, saveStories, starterStory, type StoryDocument } from "../lib/story-store";
import IdeasNotes from "../components/IdeasNotes";

type Story = {
  id: number;
  title: string;
  description: string;
  genre: string;
  scenes: number;
  status: "Draft" | "Published";
  updated: string;
  cover: string;
  storyId?: string;
  coverImage?: string;
};

const COVER_STORAGE_KEY = "storyweaver-story-covers-v1";

async function prepareCoverImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened."));
    });
    const maxWidth = 900;
    const maxHeight = 1200;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not process this image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const initialStories: Story[] = [
  {
    id: 1,
    title: "The Last Signal",
    description:
      "A transmission from a dead civilisation changes everything we know about the stars.",
    genre: "Science fiction",
    scenes: 12,
    status: "Draft",
    updated: "Edited today",
    cover: "space",
  },
  {
    id: 2,
    title: "A Thousand Tomorrows",
    description:
      "Every morning, Mara wakes into a life she almost remembers.",
    genre: "Magical realism",
    scenes: 24,
    status: "Published",
    updated: "Edited yesterday",
    cover: "city",
  },
  {
    id: 3,
    title: "The Hollow House",
    description:
      "The house on Briar Lane has kept every secret ever whispered inside it.",
    genre: "Mystery",
    scenes: 8,
    status: "Draft",
    updated: "Edited 3 days ago",
    cover: "house",
  },
];

function StoryArtwork({
  cover,
  featured = false,
}: {
  cover: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`artwork artwork-${cover} ${
        featured ? "artwork-featured" : ""
      }`}
      aria-hidden="true"
    >
      <div className="artwork-grid" />
      {cover === "space" && (
        <>
          <div className="planet" />
          <div className="planet-shadow" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="star star-one" />
          <div className="star star-two" />
          <div className="star star-three" />
        </>
      )}
      {cover === "city" && (
        <div className="city-skyline">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="city-building"
              style={
                {
                  "--building-index": i,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      {cover === "house" && (
        <>
          <div className="house-body" />
          <div className="house-roof" />
          <div className="house-window window-one" />
          <div className="house-window window-two" />
          <div className="house-door" />
          <div className="house-tree tree-one" />
          <div className="house-tree tree-two" />
        </>
      )}
      {featured && (
        <div className="featured-art-caption">
          <span>TRANSMISSION LOG // 001</span>
          <span>UNKNOWN ORIGIN</span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [stories, setStories] = useState(initialStories);
  const [storiesReady, setStoriesReady] = useState(false);

  useEffect(() => {
    try {
      const savedStories = loadStories();
      let savedCovers: Record<string, string> = {};
      try {
        const rawCovers = window.localStorage.getItem(COVER_STORAGE_KEY);
        if (rawCovers) {
          const parsed: unknown = JSON.parse(rawCovers);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            savedCovers = parsed as Record<string, string>;
          }
        }
      } catch {
        savedCovers = {};
      }
      const mapped: Story[] = savedStories.map((saved, index) => ({
        id: saved.id === starterStory.id ? 1 : Number(saved.id.replace(/\\D/g, "")) || Date.now() + index,
        storyId: saved.id,
        title: saved.title,
        description: saved.description,
        genre: saved.genre,
        scenes: saved.scenes.length,
        status: saved.status,
        updated: "Saved in this browser",
        cover: saved.genre.toLowerCase().includes("mystery") ? "house" : saved.genre.toLowerCase().includes("magic") ? "city" : "space",
        coverImage: savedCovers[saved.id],
      }));
      setStories(mapped);
    } catch {
      // Keep the home page usable if browser storage is unavailable.
    } finally {
      setStoriesReady(true);
    }
  }, []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All stories");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("recent");




  const filteredStories = useMemo(() => {
    return stories
      .filter((story) => {
        const matchesSearch =
          `${story.title} ${story.description} ${story.genre}`
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchesFilter =
          filter === "All stories" ||
          (filter === "Drafts" && story.status === "Draft") ||
          (filter === "Published" && story.status === "Published");

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "scenes") return b.scenes - a.scenes;
        return b.id - a.id;
      });
  }, [stories, search, filter, sort]);

  const totalScenes = stories.reduce(
    (total, story) => total + story.scenes,
    0
  );

  const totalWords = stories.length * 4000;

  async function uploadCover(story: Story, file?: File) {
    if (!file) return;
    if (story.status === "Published") {
      window.alert("Published stories are locked. Their cover art cannot be changed.");
      return;
    }
    const storyId = story.storyId || (story.id === 1 || story.title === starterStory.title ? starterStory.id : `sample-${story.id}`);
    try {
      const coverImage = await prepareCoverImage(file);
      const raw = window.localStorage.getItem(COVER_STORAGE_KEY);
      const covers: Record<string, string> = raw ? JSON.parse(raw) as Record<string, string> : {};
      covers[storyId] = coverImage;
      window.localStorage.setItem(COVER_STORAGE_KEY, JSON.stringify(covers));
      setStories((items) => items.map((item) => item.id === story.id ? { ...item, storyId, coverImage } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The cover image could not be saved.";
      window.alert(`${message} Try a smaller image or a different file.`);
    }
  }

  function createStory() {
    const id = `story-${Date.now()}`;
    const now = new Date().toISOString();
    const newDocument: StoryDocument = {
      id,
      title: "Untitled Story",
      description: "A new world begins with a single decision.",
      genre: "Unclassified",
      status: "Draft",
      updatedAt: now,
      scenes: [{
        id: `scene-${Date.now()}`,
        title: "Opening Scene",
        text: "",
        choices: [],
      }],
    };

    try {
      const current = loadStories();
      saveStories([newDocument, ...current.filter((item) => item.id !== id)]);
      const newStory: Story = {
        id: Date.now(),
        storyId: id,
        title: newDocument.title,
        description: newDocument.description,
        genre: newDocument.genre,
        scenes: 1,
        status: "Draft",
        updated: "Created just now",
        cover: "space",
      };
      setStories((currentStories) => [newStory, ...currentStories.filter((item) => item.storyId !== id)]);
      setFilter("All stories");
      setSearch("");
      router.push(`/editor?story=${encodeURIComponent(id)}`);
    } catch {
      window.alert("StoryWeaver couldn't save this story in this browser. Check browser storage and try again.");
    }
  }

  function publishStory(story: Story) {
    const storyId = story.storyId || (story.id === 1 || story.title === starterStory.title
      ? starterStory.id
      : `sample-${String(story.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    try {
      const current = loadStories();
      let document = current.find((item) => item.id === storyId);
      if (!document) {
        document = {
          id: storyId,
          title: story.title,
          description: story.description,
          genre: story.genre,
          status: "Draft",
          updatedAt: new Date().toISOString(),
          scenes: structuredClone(starterStory.scenes).map((scene, index) => ({
            ...scene,
            id: `${storyId}-scene-${index + 1}`,
            choices: scene.choices.map((choice, choiceIndex) => ({
              ...choice,
              id: `${storyId}-choice-${index + 1}-${choiceIndex + 1}`,
            })),
          })),
        };
      }
      const published = { ...document, status: "Published" as const, updatedAt: new Date().toISOString() };
      saveStories([published, ...current.filter((item) => item.id !== storyId)]);
      setStories((items) => items.map((item) =>
        item.id === story.id
          ? { ...item, storyId, status: "Published", updated: "Published just now" }
          : item
      ));
    } catch {
      window.alert("StoryWeaver couldn't publish this story. Check browser storage and try again.");
    }
  }

  function deletePublishedStory(story: Story) {
    if (story.status !== "Published") return;
    const confirmed = window.confirm(
      `Delete published story "${story.title}"? This permanently removes the story and its saved cover from this browser. This cannot be undone.`
    );
    if (!confirmed) return;

    const storyId = story.storyId || (story.id === 1 || story.title === starterStory.title
      ? starterStory.id
      : `sample-${String(story.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);

    try {
      const current = loadStories();
      saveStories(current.filter((item) => item.id !== storyId));

      const rawCovers = window.localStorage.getItem(COVER_STORAGE_KEY);
      if (rawCovers) {
        const covers = JSON.parse(rawCovers) as Record<string, string>;
        delete covers[storyId];
        window.localStorage.setItem(COVER_STORAGE_KEY, JSON.stringify(covers));
      }

      setStories((items) => items.filter((item) => item.id !== story.id));
    } catch {
      window.alert("StoryWeaver couldn't delete this story. Your saved data has not been confirmed as deleted; please try again.");
    }
  }

  function openStory(story: Story) {
    let storyId = story.storyId;
    if (!storyId) {
      storyId = story.id === 1 || story.title === starterStory.title
        ? starterStory.id
        : `sample-${String(story.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      try {
        const current = loadStories();
        let document = current.find((item) => item.id === storyId);
        if (!document) {
          document = {
            id: storyId,
            title: story.title,
            description: story.description,
            genre: story.genre,
            status: story.status,
            updatedAt: new Date().toISOString(),
            scenes: structuredClone(starterStory.scenes).map((scene, index) => ({
              ...scene,
              id: `${storyId}-scene-${index + 1}`,
              choices: scene.choices.map((choice, choiceIndex) => ({
                ...choice,
                id: `${storyId}-choice-${index + 1}-${choiceIndex + 1}`,
              })),
            })),
          };
          saveStories([...current, document]);
        }
        setStories((currentStories) => currentStories.map((item) =>
          item.id === story.id ? { ...item, storyId } : item
        ));
      } catch {
        window.alert("StoryWeaver couldn't open this story because browser storage is unavailable.");
        return;
      }
    }
    const saved = loadStories().find((item) => item.id === storyId);
    if (story.status === "Published" || saved?.status === "Published") {
      router.push(`/play?story=${encodeURIComponent(storyId)}`);
      return;
    }
    router.push(`/editor?story=${encodeURIComponent(storyId)}`);
  }

  const featured = stories[0];

  return (
    <main className="noir-app">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #080a0b;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .noir-app {
          --bg: #080a0b;
          --panel: #0d1012;
          --panel-raised: #121619;
          --border: #292e32;
          --muted: #92999e;
          --text: #edf0f1;
          --red: #f12c35;
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 75% 0%, #1a1e21 0%, transparent 40%),
            var(--bg);
          color: var(--text);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          letter-spacing: 0.01em;
        }

        .noir-layout {
          display: flex;
          min-height: 100vh;
        }

        .noir-sidebar {
          position: sticky;
          top: 0;
          display: flex;
          flex: 0 0 238px;
          flex-direction: column;
          height: 100vh;
          min-height: 680px;
          padding: 27px 19px 20px;
          border-right: 1px solid var(--border);
          background: linear-gradient(160deg, #101315, #080a0b 70%);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 4px 3px 35px;
        }

        .brand-mark {
          position: relative;
          display: flex;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid #42474a;
          color: var(--red);
          font-size: 22px;
          font-weight: 300;
          transform: skew(-5deg);
        }

        .brand-mark::after {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 12px;
          height: 2px;
          background: var(--red);
          content: "";
        }

        .brand-name {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 3px;
        }

        .brand-sub {
          margin-top: 6px;
          color: #777f84;
          font-size: 8px;
          letter-spacing: 2px;
        }

        .side-label {
          margin: 8px 10px 12px;
          color: #666e73;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .side-nav {
          display: grid;
          gap: 5px;
        }

        .side-link {
          display: flex;
          min-height: 46px;
          align-items: center;
          gap: 13px;
          padding: 0 13px;
          border: 1px solid transparent;
          color: #a8afb4;
          text-align: left;
          background: transparent;
          transition: 150ms ease;
        }

        .side-link:hover {
          border-color: #292e32;
          color: white;
          background: #121517;
        }

        .side-link.active {
          border-color: #482124;
          border-left: 3px solid var(--red);
          color: white;
          background: linear-gradient(90deg, #291416, #121112);
        }

        .side-icon {
          width: 19px;
          color: #c0c6ca;
          font-size: 17px;
          text-align: center;
        }

        .side-link.active .side-icon {
          color: var(--red);
        }

        .side-link span:last-child {
          font-size: 11px;
          letter-spacing: 1px;
        }

        .side-bottom {
          margin-top: auto;
          padding: 20px 10px 4px;
          border-top: 1px solid var(--border);
        }

        .red-rule {
          width: 36px;
          height: 2px;
          margin-bottom: 14px;
          background: var(--red);
        }

        .side-bottom p {
          max-width: 155px;
          color: #777f84;
          font-size: 10px;
          line-height: 1.9;
          letter-spacing: 1.3px;
        }

        .noir-main {
          min-width: 0;
          flex: 1;
        }

        .topbar {
          display: flex;
          height: 76px;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 32px;
          border-bottom: 1px solid var(--border);
          background: #0b0d0f;
        }

        .search-box {
          display: flex;
          width: min(490px, 60%);
          height: 43px;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border: 1px solid #303539;
          background: #080a0b;
        }

        .search-symbol {
          color: #d6dadd;
          font-size: 20px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: white;
          font-size: 12px;
        }

        .search-box input::placeholder {
          color: #70777c;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          display: grid;
          width: 36px;
          height: 36px;
          place-items: center;
          border: 1px solid #555c61;
          border-radius: 50%;
          font-size: 14px;
        }

        .profile-label {
          font-size: 10px;
          letter-spacing: 1.5px;
        }

        .profile-sub {
          margin-top: 4px;
          color: #7f878c;
          font-size: 10px;
        }

        .page-content {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 27px 30px 40px;
        }

        .eyebrow {
          color: #8b9398;
          font-size: 10px;
          letter-spacing: 2.5px;
        }

        .hero-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .hero-heading h1 {
          margin: 12px 0 6px;
          font-size: clamp(29px, 3.2vw, 49px);
          font-weight: 800;
          letter-spacing: 1px;
          line-height: 1.1;
        }

        .hero-heading h1 span {
          color: var(--red);
        }

        .hero-heading p {
          margin: 10px 0 0;
          color: #92999e;
          font-size: 12px;
          letter-spacing: 1.5px;
        }

        .serial {
          padding-bottom: 7px;
          color: #737b80;
          font-size: 10px;
          letter-spacing: 2px;
        }

        .hero-columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 270px;
          gap: 20px;
        }

        .featured {
          position: relative;
          display: flex;
          min-height: 315px;
          overflow: hidden;
          border: 1px solid #34393d;
          background: #0b0d0e;
        }

        .featured::before,
        .featured::after {
          position: absolute;
          z-index: 2;
          width: 38px;
          height: 2px;
          background: var(--red);
          content: "";
        }

        .featured::before {
          top: 0;
          right: 0;
          transform: rotate(-45deg) translate(-1px, 13px);
        }

        .featured::after {
          right: 0;
          bottom: 0;
          transform: rotate(-45deg) translate(0, -13px);
        }

        .featured-copy {
          position: relative;
          z-index: 1;
          display: flex;
          width: 55%;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          padding: 30px;
          background: linear-gradient(90deg, #0b0d0e 55%, #0b0d0eeb 78%, transparent);
        }

        .red-text {
          color: var(--red);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .featured h2 {
          margin: 20px 0 12px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(28px, 3vw, 43px);
          font-weight: 400;
          line-height: 1.1;
        }

        .featured-description {
          max-width: 330px;
          color: #aab0b4;
          font-size: 13px;
          line-height: 1.8;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 17px;
        }

        .tag {
          padding: 6px 9px;
          border: 1px solid #363b3f;
          color: #b7bdc1;
          font-size: 9px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .primary-button {
          display: flex;
          align-items: center;
          gap: 22px;
          margin-top: 22px;
          padding: 13px 17px;
          border: 0;
          border-left: 4px solid #ff4149;
          background: linear-gradient(100deg, #9c171e, #491114);
          color: white;
          font-size: 10px;
          letter-spacing: 1.5px;
          transition: 150ms ease;
        }

        .primary-button:hover {
          background: linear-gradient(100deg, #cf222b, #68161b);
        }

        .artwork {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background-color: #101519;
        }

        .artwork-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(#a5b0b40a 1px, transparent 1px),
            linear-gradient(90deg, #a5b0b40a 1px, transparent 1px);
          background-size: 35px 35px;
          mask-image: linear-gradient(90deg, transparent, black);
        }

        .artwork-featured {
          left: 34%;
          background:
            radial-gradient(ellipse at 70% 35%, #626d74 0%, transparent 25%),
            radial-gradient(ellipse at 75% 68%, #424c50 0%, transparent 40%),
            linear-gradient(155deg, #343b40 0%, #171d21 44%, #080a0c 100%);
        }

        .planet {
          position: absolute;
          top: 15%;
          right: 9%;
          width: 175px;
          height: 175px;
          border: 1px solid #b0b9bb55;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 30%, #aeb8b9, #394249 43%, #111519 72%);
          box-shadow: 0 0 70px #7b8b941f;
        }

        .planet-shadow {
          position: absolute;
          top: 12%;
          right: 3%;
          width: 190px;
          height: 190px;
          border-radius: 50%;
          background: linear-gradient(120deg, transparent 40%, #090b0de8 74%);
        }

        .orbit {
          position: absolute;
          top: 44%;
          right: -4%;
          width: 300px;
          height: 55px;
          border: 1px solid #c7d0d02b;
          transform: rotate(-26deg);
        }

        .orbit-two {
          top: 53%;
          right: -7%;
          transform: rotate(-26deg);
        }

        .star {
          position: absolute;
          width: 3px;
          height: 3px;
          background: #f43a41;
          box-shadow: 0 0 12px #f43a41;
        }

        .star-one { top: 27%; right: 35%; }
        .star-two { top: 61%; right: 16%; }
        .star-three { top: 17%; right: 21%; }

        .featured-art-caption {
          position: absolute;
          right: 17px;
          bottom: 16px;
          display: flex;
          gap: 14px;
          color: #d1d5d6;
          font-size: 7px;
          letter-spacing: 1.3px;
        }

        .right-rail {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .quote-panel {
          display: flex;
          min-height: 80px;
          flex-direction: column;
          justify-content: center;
          padding: 10px 17px;
        }

        .quote-panel p {
          margin: 0;
          color: #aeb4b8;
          font-size: 12px;
          line-height: 1.8;
          letter-spacing: 1.8px;
        }

        .quote-line {
          width: 29px;
          height: 2px;
          margin-top: 13px;
          background: var(--red);
        }

        .overview {
          border: 1px solid #303539;
          background: linear-gradient(145deg, #111416, #090b0c);
        }

        .overview-title {
          padding: 13px 14px;
          border-bottom: 1px solid #303539;
          font-size: 10px;
          letter-spacing: 1.5px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 16px 0;
        }

        .stat {
          padding: 0 9px;
          border-right: 1px solid #292e32;
          text-align: center;
        }

        .stat:last-child {
          border: 0;
        }

        .stat strong {
          display: block;
          font-size: 23px;
          font-weight: 500;
        }

        .stat span {
          display: block;
          margin-top: 5px;
          color: #90979c;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .new-story {
          display: flex;
          min-height: 49px;
          align-items: center;
          justify-content: space-between;
          padding: 0 15px;
          border: 1px solid #472125;
          border-left: 5px solid var(--red);
          background: #100d0e;
          color: var(--red);
          font-size: 12px;
          letter-spacing: 2px;
          transition: 150ms ease;
        }

        .new-story:hover {
          background: #291113;
          border-color: var(--red);
        }

        .new-story span:first-child {
          font-size: 22px;
        }

        .idea-panel {
          display: flex;
          width: 100%;
          min-height: 83px;
          align-items: center;
          gap: 13px;
          padding: 14px;
          border: 1px solid #292e32;
          background: transparent;
          color: #b9c0c4;
          text-align: left;
          cursor: pointer;
          transition: 150ms ease;
        }

        .idea-panel:hover,
        .idea-panel:focus-visible {
          border-color: #694045;
          background: #111416;
          outline-offset: 3px;
        }

        .idea-icon {
          color: var(--red);
          font-size: 22px;
        }

        .idea-copy {
          display: grid;
          flex: 1;
          gap: 6px;
        }

        .idea-panel strong {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1.3px;
        }

        .idea-copy > span:not(.idea-note-status) {
          color: #8d959a;
          font-size: 11px;
          line-height: 1.6;
        }

        .idea-note-status {
          color: #c66b70;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .idea-open-mark {
          color: var(--red);
          font-size: 15px;
        }

        .notes-feedback {
          margin: -5px 0 0;
          color: #b4d1b8;
          font-size: 10px;
          line-height: 1.5;
        }

        .notes-backdrop {
          position: fixed;
          z-index: 100;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 20px;
          background: #000b;
          backdrop-filter: blur(5px);
        }

        .notes-dialog {
          display: grid;
          width: min(680px, 100%);
          max-height: min(85vh, 760px);
          grid-template-rows: auto auto minmax(180px, 1fr) auto auto;
          gap: 16px;
          overflow: auto;
          padding: clamp(20px, 4vw, 32px);
          border: 1px solid #3a4145;
          border-top: 2px solid var(--red);
          background: #0d1012;
          box-shadow: 0 24px 80px #0009;
        }

        .notes-dialog-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .notes-dialog-header h2 {
          margin: 10px 0 8px;
          color: var(--text);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 4vw, 36px);
          font-weight: 400;
        }

        .notes-dialog-header p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.7;
        }

        .notes-close {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          border: 1px solid #343a3e;
          background: #111416;
          color: #dce0e2;
          font-size: 24px;
        }

        .notes-label {
          color: #9aa2a7;
          font-size: 9px;
          letter-spacing: 1.8px;
        }

        .notes-textarea {
          width: 100%;
          min-height: 220px;
          resize: vertical;
          padding: 16px;
          border: 1px solid #303539;
          outline: none;
          background: #080a0b;
          color: #edf0f1;
          font: 14px/1.8 Georgia, "Times New Roman", serif;
        }

        .notes-textarea:focus {
          border-color: #9b363b;
        }

        .notes-textarea::placeholder {
          color: #697278;
        }

        .notes-dialog-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          color: #7f878c;
          font-size: 10px;
          line-height: 1.6;
        }

        .notes-actions {
          display: flex;
          gap: 8px;
        }

        .notes-cancel,
        .notes-save {
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #3b4145;
          background: #111416;
          color: #e2e6e8;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .notes-save {
          border-color: #b5222a;
          background: #94191f;
          color: white;
        }

        .notes-dialog-message {
          margin: 0;
          color: #b4d1b8;
          font-size: 11px;
        }

        .collection {
          margin-top: 28px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 19px;
        }

        .section-slashes {
          color: var(--red);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -5px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 2.5px;
        }

        .heading-rule {
          height: 1px;
          flex: 1;
          background: #303539;
        }

        .collection-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px solid #303539;
        }

        .tabs {
          display: flex;
          align-self: stretch;
          gap: 20px;
        }

        .tab {
          position: relative;
          padding: 13px 9px;
          border: 0;
          background: transparent;
          color: #92999e;
          font-size: 10px;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .tab.active {
          color: white;
        }

        .tab.active::after {
          position: absolute;
          right: 0;
          bottom: -1px;
          left: 0;
          height: 2px;
          background: var(--red);
          content: "";
        }

        .toolbar-tools {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-select {
          max-width: 110px;
          padding: 8px 4px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #c7cdd0;
          font-size: 10px;
          text-transform: uppercase;
        }

        .sort-select option {
          background: #111416;
        }

        .view-button {
          width: 31px;
          height: 30px;
          border: 1px solid #303539;
          background: #101315;
          color: #8e969b;
        }

        .view-button.active {
          border-color: #555d62;
          background: #22272a;
          color: white;
        }

        .collection-search {
          display: flex;
          width: 155px;
          height: 31px;
          align-items: center;
          gap: 7px;
          padding: 0 8px;
          border: 1px solid #303539;
        }

        .collection-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: white;
          font-size: 10px;
        }

        .story-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
          padding-top: 16px;
        }

        .story-grid.list-view {
          grid-template-columns: minmax(0, 1fr);
        }

        .story-card {
          display: flex;
          min-width: 0;
          min-height: 178px;
          overflow: hidden;
          border: 1px solid #2b3034;
          background: linear-gradient(135deg, #15191c, #0b0d0e 65%);
          transition: border-color 150ms ease, background 150ms ease;
        }

        .story-card:hover {
          border-color: #6d3438;
          background: #111416;
        }

        .story-cover {
          position: relative;
          flex: 0 0 37%;
          min-height: 178px;
          overflow: hidden;
          border-right: 1px solid #303539;
        }

        .story-cover .artwork {
          position: absolute;
        }

        .uploaded-story-cover {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cover-upload-control {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 6px 7px;
          background: rgba(8, 10, 11, 0.86);
          color: #f2f2f2;
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        .cover-upload-control:hover {
          border-color: var(--red);
          color: #ff737d;
        }

        .cover-upload-control input {
          display: none;
        }

        .artwork-city {
          background:
            radial-gradient(ellipse at 50% 55%, #9b6660 0%, transparent 45%),
            linear-gradient(180deg, #262d37, #6d5656 52%, #111619);
        }

        .city-skyline {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          display: flex;
          height: 80%;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
        }

        .city-building {
          width: calc(9% + var(--building-index) * 1%);
          height: calc(30% + (var(--building-index) % 4) * 18%);
          border: 1px solid #8c9293;
          background: linear-gradient(90deg, #141a20, #33383d);
        }

        .city-building:nth-child(3n) {
          height: 90%;
        }

        .city-building:nth-child(2n) {
          background: #22272b;
        }

        .artwork-house {
          background:
            radial-gradient(ellipse at 55% 70%, #4c4943, transparent 45%),
            linear-gradient(180deg, #182026, #303734 65%, #101313);
        }

        .house-body {
          position: absolute;
          right: 15%;
          bottom: 0;
          left: 15%;
          height: 43%;
          border: 1px solid #69716e;
          background: linear-gradient(90deg, #181c1c, #343938, #141717);
        }

        .house-roof {
          position: absolute;
          right: 6%;
          bottom: 39%;
          left: 6%;
          height: 36%;
          background: #171c1e;
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          filter: drop-shadow(0 0 2px #9aa09b);
        }

        .house-window {
          position: absolute;
          bottom: 20%;
          width: 8px;
          height: 13px;
          background: #e65c38;
          box-shadow: 0 0 10px #d94727;
        }

        .window-one { left: 35%; }
        .window-two { right: 34%; }

        .house-door {
          position: absolute;
          bottom: 0;
          left: 48%;
          width: 13px;
          height: 26%;
          background: #0c1011;
        }

        .house-tree {
          position: absolute;
          bottom: 0;
          width: 24px;
          height: 70%;
          background: #101717;
          clip-path: polygon(50% 0, 100% 45%, 72% 45%, 100% 76%, 62% 76%, 62% 100%, 38% 100%, 38% 76%, 0 76%, 28% 45%, 0 45%);
        }

        .tree-one { left: 0; }
        .tree-two { right: 0; height: 54%; }

        .story-info {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          padding: 15px 12px 11px;
        }

        .story-info h3 {
          margin: 0;
          overflow-wrap: anywhere;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.4;
        }

        .story-info > p {
          display: -webkit-box;
          overflow: hidden;
          margin: 6px 0 10px;
          color: #9ba2a7;
          font-size: 10px;
          line-height: 1.65;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .story-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: auto;
        }

        .story-meta span {
          padding: 4px 5px;
          border: 1px solid #33383c;
          color: #b0b7bb;
          font-size: 7px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .story-meta .published {
          color: #b4d1b8;
          border-color: #3a5641;
        }

        .story-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #292e32;
          color: #7f878c;
          font-size: 9px;
        }

        .story-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .publish-link {
          border: 1px solid #7b252d;
          border-radius: 4px;
          padding: 6px 8px;
          background: rgba(241, 44, 58, 0.08);
          color: #ff6b75;
          font-size: 9px;
          letter-spacing: 0.08em;
        }

        .publish-link:hover {
          background: rgba(241, 44, 58, 0.18);
        }

        .open-link {
          border: 0;
          background: transparent;
          color: #d0d5d8;
          font-size: 10px;
        }

        .open-link:hover {
          color: var(--red);
        }

        .delete-story-link {
          border: 1px solid #7b252d;
          border-radius: 4px;
          padding: 6px 8px;
          background: transparent;
          color: #ff6b75;
          font-size: 9px;
          letter-spacing: 0.08em;
          cursor: pointer;
        }

        .delete-story-link:hover {
          background: rgba(241, 44, 58, 0.16);
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: 45px 15px;
          border: 1px dashed #34393d;
          color: #9ba2a7;
          text-align: center;
        }

        .empty-state button {
          margin-top: 12px;
          border: 0;
          background: transparent;
          color: var(--red);
        }

        .bottom-line {
          margin-top: 30px;
          padding-top: 16px;
          border-top: 1px solid #272c30;
          color: #626a6f;
          font-size: 9px;
          letter-spacing: 1.4px;
        }

        @media (min-width: 1450px) {
          .page-content {
            padding-right: 42px;
            padding-left: 42px;
          }

          .featured {
            min-height: 340px;
          }
        }

        @media (max-width: 1150px) {
          .noir-sidebar {
            flex-basis: 200px;
            padding-right: 13px;
            padding-left: 13px;
          }

          .page-content {
            padding-right: 22px;
            padding-left: 22px;
          }

          .hero-columns {
            grid-template-columns: minmax(0, 1fr) 220px;
            gap: 12px;
          }

          .featured-copy {
            width: 65%;
            padding: 22px;
          }

          .story-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .toolbar-tools {
            gap: 5px;
          }

          .collection-search {
            width: 125px;
          }
        }

        @media (max-width: 800px) {
          .noir-sidebar {
            display: none;
          }

          .topbar {
            height: 65px;
            padding: 0 18px;
          }

          .page-content {
            padding: 25px 18px 32px;
          }

          .hero-columns {
            grid-template-columns: minmax(0, 1fr);
          }

          .featured {
            min-height: 300px;
          }

          .right-rail {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .quote-panel {
            display: none;
          }

          .overview {
            grid-row: span 2;
          }

          .collection-toolbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .tabs {
            width: 100%;
            gap: 10px;
          }

          .tab {
            padding-right: 7px;
            padding-left: 7px;
          }

          .toolbar-tools {
            width: 100%;
            padding-bottom: 10px;
          }

          .collection-search {
            width: auto;
            flex: 1;
          }

          .story-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .profile-label,
          .profile-sub {
            display: none;
          }

          .search-box {
            width: 100%;
          }

          .page-content {
            padding-right: 13px;
            padding-left: 13px;
          }

          .hero-heading h1 {
            font-size: 30px;
          }

          .hero-heading p {
            font-size: 10px;
            line-height: 1.7;
          }

          .serial {
            display: none;
          }

          .featured {
            min-height: 310px;
          }

          .featured-copy {
            width: 100%;
            padding: 20px;
            background: linear-gradient(90deg, #090b0df5, #090b0dd9 72%, #090b0d88);
          }

          .featured h2 {
            font-size: 33px;
          }

          .artwork-featured {
            left: 0;
          }

          .planet {
            right: -45px;
            width: 150px;
            height: 150px;
          }

          .right-rail {
            grid-template-columns: minmax(0, 1fr);
          }

          .overview {
            grid-row: auto;
          }

          .story-grid,
          .story-grid.list-view {
            grid-template-columns: minmax(0, 1fr);
          }

          .story-card {
            min-height: 155px;
          }

          .story-cover {
            min-height: 155px;
          }

          .story-info {
            padding: 12px 10px;
          }

          .story-info h3 {
            font-size: 15px;
          }

          .story-info > p {
            font-size: 10px;
          }

          .section-heading h2 {
            font-size: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="noir-layout">
        <aside className="noir-sidebar">
          <a href="#" className="brand">
            <div className="brand-mark">W</div>
            <div>
              <div className="brand-name">STORYWEAVER</div>
              <div className="brand-sub">WORLDS TAKE SHAPE</div>
            </div>
          </a>

          <div className="side-label">WORKSPACE / 01</div>

          <nav className="side-nav">
            <a href="#home" className="side-link active">
              <span className="side-icon">⌂</span>
              <span>HOME</span>
            </a>
            <a href="#collection" className="side-link">
              <span className="side-icon">▤</span>
              <span>MY STORIES</span>
            </a>
            <button
              onClick={() => router.push("/editor")}
              className="side-link"
            >
              <span className="side-icon">↗</span>
              <span>EDITOR</span>
            </button>
            <button
              onClick={() => router.push("/branch-map")}
              className="side-link"
            >
              <span className="side-icon">⌘</span>
              <span>BRANCH MAP</span>
            </button>
            <button
              onClick={() =>
                window.alert("Character management will be part of the editor.")
              }
              className="side-link"
            >
              <span className="side-icon">♧</span>
              <span>CHARACTERS</span>
            </button>
            <button
              onClick={() =>
                window.alert("Story locations will be available in a future update.")
              }
              className="side-link"
            >
              <span className="side-icon">⌖</span>
              <span>LOCATIONS</span>
            </button>
            <button
              onClick={() =>
                window.alert("Your story notes workspace is planned.")
              }
              className="side-link"
            >
              <span className="side-icon">▧</span>
              <span>NOTES</span>
            </button>
          </nav>

          <div className="side-bottom">
            <div className="red-rule" />
            <p>DIFFERENT PATHS.<br />A DEEPER WORLD.</p>
          </div>
        </aside>

        <section className="noir-main" id="home">
          <header className="topbar">
            <label className="search-box">
              <span className="search-symbol">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search stories, genres, or ideas..."
                aria-label="Search all stories"
              />
            </label>

            <div className="profile">
              <div className="avatar">W</div>
              <div>
                <div className="profile-label">WRITER</div>
                <div className="profile-sub">Keep writing.</div>
              </div>
            </div>
          </header>

          <div className="page-content">
            <div className="hero-heading">
              <div>
                <div className="eyebrow">WELCOME BACK / CREATOR</div>
                <h1>
                  STORIES <span>IN PROGRESS</span>
                </h1>
                <p>Different paths. A deeper world.</p>
              </div>
              <div className="serial">C.E. ∞ &nbsp; / &nbsp; 001</div>
            </div>

            <div className="hero-columns">
              <section className="featured">
                <StoryArtwork cover="space" featured />
                <div className="featured-copy">
                  <div className="red-text">CONTINUE WRITING</div>
                  <h2>{featured?.title ?? "A New Story"}</h2>
                  <div className="featured-description">
                    {featured?.description ??
                      "Every new world begins with a choice."}
                  </div>
                  <div className="tags">
                    <span className="tag">
                      {featured?.genre ?? "New story"}
                    </span>
                    <span className="tag">
                      {featured?.scenes ?? 0} SCENES
                    </span>
                    <span className="tag">
                      {featured?.status ?? "Draft"}
                    </span>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => featured && openStory(featured)}
                  >
                    OPEN STORY <span>→</span>
                  </button>
                </div>
              </section>

              <aside className="right-rail">
                <div className="quote-panel">
                  <p>“SOME STORIES<br />FIGHT IN SILENCE.”</p>
                  <div className="quote-line" />
                </div>

                <div className="overview">
                  <div className="overview-title">/// WRITING OVERVIEW</div>
                  <div className="stats">
                    <div className="stat">
                      <strong>{String(stories.length).padStart(2, "0")}</strong>
                      <span>STORIES</span>
                    </div>
                    <div className="stat">
                      <strong>{totalScenes}</strong>
                      <span>SCENES</span>
                    </div>
                    <div className="stat">
                      <strong>
                        {totalWords >= 1000
                          ? `${Math.round(totalWords / 1000)}K`
                          : totalWords}
                      </strong>
                      <span>WORDS*</span>
                    </div>
                  </div>
                </div>

                <button className="new-story" onClick={createStory}>
                  <span>＋</span>
                  <span>NEW STORY</span>
                  <span>»</span>
                </button>

                <IdeasNotes variant="panel" />
              </aside>
            </div>

            <section className="collection" id="collection">
              <div className="section-heading">
                <span className="section-slashes">//</span>
                <h2>YOUR COLLECTION</h2>
                <div className="heading-rule" />
              </div>

              <div className="collection-toolbar">
                <div className="tabs">
                  {["All stories", "Drafts", "Published"].map((name) => (
                    <button
                      key={name}
                      onClick={() => setFilter(name)}
                      className={`tab ${filter === name ? "active" : ""}`}
                    >
                      {name.toUpperCase()} (
                      {name === "All stories"
                        ? stories.length
                        : stories.filter((story) =>
                            name === "Drafts"
                              ? story.status === "Draft"
                              : story.status === "Published"
                          ).length}
                      )
                    </button>
                  ))}
                </div>

                <div className="toolbar-tools">
                  <select
                    className="sort-select"
                    aria-label="Sort stories"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="recent">Recent</option>
                    <option value="title">Title A–Z</option>
                    <option value="scenes">Most scenes</option>
                  </select>

                  <button
                    className={`view-button ${view === "grid" ? "active" : ""}`}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                  >
                    ▦
                  </button>
                  <button
                    className={`view-button ${view === "list" ? "active" : ""}`}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    ☷
                  </button>

                  <label className="collection-search">
                    <span>⌕</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Find a story..."
                      aria-label="Filter collection"
                    />
                  </label>
                </div>
              </div>

              <div className={`story-grid ${view === "list" ? "list-view" : ""}`}>
                {filteredStories.map((story) => (
                  <article className="story-card" key={story.id}>
                    <div className="story-cover">
                      {story.coverImage ? (
                        <img className="uploaded-story-cover" src={story.coverImage} alt={`Cover art for ${story.title}`} />
                      ) : (
                        <StoryArtwork cover={story.cover} />
                      )}
                      {story.status === "Draft" && (
                        <label className="cover-upload-control">
                          <span>{story.coverImage ? "CHANGE COVER" : "UPLOAD COVER"}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            aria-label={`Upload cover art for ${story.title}`}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              void uploadCover(story, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div className="story-info">
                      <h3>{story.title}</h3>
                      <p>{story.description}</p>
                      <div className="story-meta">
                        <span>{story.genre}</span>
                        <span>{story.scenes} scenes</span>
                        <span className={story.status === "Published" ? "published" : ""}>
                          {story.status}
                        </span>
                      </div>
                      <div className="story-footer">
                        <span>{story.updated}</span>
                        <div className="story-actions">
                          {story.status === "Draft" && (
                            <button
                              className="publish-link"
                              onClick={() => publishStory(story)}
                              aria-label={`Publish ${story.title}`}
                            >
                              PUBLISH
                            </button>
                          )}
                          <button
                            className="open-link"
                            onClick={() => openStory(story)}
                            aria-label={`${story.status === "Published" ? "Play" : "Open"} ${story.title}`}
                          >
                            {story.status === "Published" ? "PLAY ↗" : "OPEN ↗"}
                          </button>
                          {story.status === "Published" && (
                            <button
                              className="delete-story-link"
                              onClick={() => deletePublishedStory(story)}
                              aria-label={`Delete published story ${story.title}`}
                              title="Delete this published story"
                            >
                              DELETE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                {filteredStories.length === 0 && (
                  <div className="empty-state">
                    <p>No stories match your search.</p>
                    <button
                      onClick={() => {
                        setSearch("");
                        setFilter("All stories");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </section>

            <footer className="bottom-line">
              STORYWEAVER / WORLDS TAKE SHAPE
            </footer>
          </div>
        </section>
      </div>


    </main>
  );
}
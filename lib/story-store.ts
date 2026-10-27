
export type StoryChoice = {
  id: string;
  text: string;
  target: string;
};

export type StoryScene = {
  id: string;
  title: string;
  text: string;
  ending?: boolean;
  choices: StoryChoice[];
};

export type StoryDocument = {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: "Draft" | "Published";
  scenes: StoryScene[];
  updatedAt: string;
};

const STORAGE_KEY = "storyweaver-stories-v1";

export const starterStory: StoryDocument = {
  id: "the-last-signal",
  title: "The Last Signal",
  description:
    "A mysterious transmission arrives from a planet that vanished centuries ago.",
  genre: "Science fiction",
  status: "Draft",
  updatedAt: new Date().toISOString(),
  scenes: [
    {
      id: "arrival",
      title: "The Arrival",
      text:
        "The signal had been repeating for eleven hours when the observatory finally went silent.\n\nMara stared at the terminal. Three words appeared on the screen:\n\nWE REMEMBER YOU.",
      choices: [
        {
          id: "c1",
          text: "Trace the signal's origin",
          target: "signal",
        },
        {
          id: "c2",
          text: "Shut down the transmitter",
          target: "shutdown",
        },
      ],
    },
    {
      id: "signal",
      title: "The Signal",
      text:
        "The coordinates pointed beyond the outer colonies, into a dead sector of space erased from every modern map.\n\nThen another message appeared. It contained Mara's own name.",
      choices: [
        {
          id: "c3",
          text: "Follow the coordinates",
          target: "ending",
        },
        {
          id: "c4",
          text: "Return to the observatory",
          target: "arrival",
        },
      ],
    },
    {
      id: "shutdown",
      title: "Silence",
      text:
        "Mara pulled the power lever. The terminal went dark.\n\nFor a moment, the observatory was silent. Then every screen in the building switched on at once.",
      choices: [
        {
          id: "c5",
          text: "Investigate the screens",
          target: "signal",
        },
        {
          id: "c6",
          text: "Leave the building",
          target: "ending",
        },
      ],
    },
    {
      id: "ending",
      title: "Beyond",
      text:
        "The stars shifted on the display. One by one, they formed a constellation that should not exist.\n\nThe signal stopped.\n\nFor the first time in a thousand years, something answered.",
      ending: true,
      choices: [],
    },
  ],
};

export const STORY_STORAGE_KEY = "storyweaver-stories-v1";

function isValidStory(value: unknown): value is StoryDocument {
  if (!value || typeof value !== "object") return false;

  const story = value as Partial<StoryDocument>;
  return (
    typeof story.id === "string" &&
    story.id.trim().length > 0 &&
    typeof story.title === "string" &&
    (story.description === undefined || typeof story.description === "string") &&
    (story.genre === undefined || typeof story.genre === "string") &&
    (story.status === undefined || story.status === "Draft" || story.status === "Published") &&
    (story.updatedAt === undefined || typeof story.updatedAt === "string") &&
    Array.isArray(story.scenes) &&
    story.scenes.every(
      (scene) =>
        !!scene &&
        typeof scene.id === "string" &&
        scene.id.trim().length > 0 &&
        typeof scene.title === "string" &&
        typeof scene.text === "string" &&
        (scene.ending === undefined || typeof scene.ending === "boolean") &&
        Array.isArray(scene.choices) &&
        scene.choices.every(
          (choice) =>
            !!choice &&
            typeof choice.id === "string" &&
            choice.id.trim().length > 0 &&
            typeof choice.text === "string" &&
            typeof choice.target === "string",
        ),
    )
  );
}

export function loadStories(): StoryDocument[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORY_STORAGE_KEY);
  if (raw === null) return [structuredClone(starterStory)];

  // Do not silently replace corrupt data with the starter story. Throwing allows
  // the page to show a real storage/data error instead of overwriting user work.
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isValidStory)) {
    throw new Error("Saved StoryWeaver data is invalid.");
  }

  return parsed;
}

export function saveStories(stories: StoryDocument[]): void {
  if (typeof window === "undefined") {
    throw new Error("StoryWeaver can only save from a browser.");
  }
  if (!Array.isArray(stories) || !stories.every(isValidStory)) {
    throw new Error("Refusing to save invalid StoryWeaver data.");
  }

  // A failed quota/security write intentionally throws so callers can show
  // clear feedback rather than claiming that the story was saved.
  window.localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(stories));
}

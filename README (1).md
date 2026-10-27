# StoryWeaver

## Project Name

**StoryWeaver** --- an interactive branching-story creation and reading
application.

## Problem Statement

Writing a story with multiple paths can become difficult to organize.
Authors need a way to draft scenes, connect choices to different
outcomes, and follow the structure of a branching narrative without
losing track of how the pieces fit together.

## Target Users

-   Writers creating interactive fiction or choose-your-own-adventure
    stories.
-   Students and hobbyists learning narrative design.
-   Readers who enjoy stories with choices and multiple possible paths.

## Solution

StoryWeaver provides a browser-based workspace for creating and
organizing branching stories. Authors can write scenes, connect choices
to other scenes, inspect the story structure in a branch map, and play
through a story to experience its choices. Story data is currently
stored in the browser, so it is available in the same browser profile
rather than automatically syncing across devices.

## Key Features

-   **Story library:** View story cards from the Home page.
-   **Story editor:** Write and update scenes and their choices.
-   **Branch map:** View the story's branching structure and work with
    scene connections.
-   **Play Mode:** Read a story and follow its available choices.
-   **Draft and published status:** Mark stories as published; the
    interface is intended to prevent editing published stories.
-   **Cover images:** Upload a custom image for a story card on the Home
    page.
-   **Story management:** Delete published stories from the Home page
    with a confirmation step.
-   **Browser persistence:** Save story data locally using browser
    `localStorage`.

> **Storage note:** Because the current application uses browser
> `localStorage`, story data and cover images are not automatically
> shared between browsers or devices. Clearing browser site data may
> remove locally saved content.

## Tech Stack

-   **Next.js** --- application framework and routing.
-   **React** --- user interface components.
-   **TypeScript** --- typed application code.
-   **React Flow** --- interactive node-and-edge visualization for the
    branch map.
-   **Browser `localStorage`** --- local persistence for stories and
    related data.
-   **Git and GitHub** --- version control and source-code hosting.
-   **Vercel** --- recommended deployment platform for the Next.js
    application.

## Architecture

StoryWeaver is a Next.js application organized around route-level pages
and shared utilities.

-   `app/page.tsx` --- Home page and story library, including story-card
    actions and cover uploads.
-   `app/editor/page.tsx` --- scene and choice editing.
-   `app/branch-map/` --- visual branching map and related interactions.
-   `app/play/page.tsx` --- reader experience for playing through a
    story.
-   `components/` --- reusable interface components, including shared
    notes functionality where present.
-   `lib/story-store.ts` --- story data types, starter story, and
    local-storage read/write helpers.
-   `package.json` --- project scripts and dependencies.

Story content is stored in the browser under the
`storyweaver-stories-v1` local-storage key. Branch-map positions and
notes may use their own local-storage keys. This is a client-side
persistence model, not a server database.

## Local Setup

### Prerequisites

-   Node.js (use a current LTS release).
-   npm, which is included with Node.js.
-   Git.

### 1. Clone the repository

``` bash
git clone https://github.com/Valorisalive/Story-Weaver.git
cd Story-Weaver
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Start the development server

``` bash
npm run dev
```

### 4. Open the application

Visit <http://localhost:3000> in your browser.

### 5. Create a production build (optional)

``` bash
npm run build
npm start
```

If a command fails, check the error output and confirm that your Node.js
version is compatible with the installed Next.js version.

## Environment Variables

**No environment variables are currently documented as required** for
the local-storage-based application described here.

-   Do not commit secrets, API keys, or private credentials to GitHub.
-   If future features add external services (for example, cloud
    storage, authentication, or an image-generation API), document their
    variable names in this section and provide a safe example in
    `.env.example`.
-   Keep real values in a local `.env.local` file or the deployment
    provider's environment-variable settings; do not commit that file.

## Deployment

### GitHub repository

Source code: <https://github.com/Valorisalive/Story-Weaver>

### Deploy with Vercel

1.  Open <https://vercel.com/new>.
2.  Sign in with GitHub and authorize repository access if prompted.
3.  Import `Valorisalive/Story-Weaver`.
4.  Keep the detected Next.js framework settings and default build
    settings unless your project requires changes.
5.  Click **Deploy** and wait for the build to finish.
6.  Open the deployment URL provided by Vercel.

After connecting the repository, pushes to the configured production
branch can trigger new deployments. Add the final public deployment URL
to this section once deployment is complete.

**Live application:** Not yet listed. Add the Vercel URL here after a
successful deployment.

## Current Limitations

-   Stories are stored locally in the browser and do not automatically
    sync between users or devices.
-   Clearing browser site data can delete saved stories, notes, and
    covers.
-   A deployed site does not by itself provide accounts, server-side
    storage, or cross-device synchronization.

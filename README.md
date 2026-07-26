# Weekflow

A personal weekly/daily time-blocking planner. Dark, minimal, fast. Two view modes over one data model, a view-aware overview donut, category allocation settings, and optional read-only Google Calendar sync. Local-only persistence — no backend.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (v4)
- Zustand (`persist` → `localStorage` key `weekflow-state`)
- date-fns for date math
- Recharts for the overview donut
- Google Identity Services (client-side OAuth) for Google Calendar

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the built dist/
```

## Features

- **Week view** — 7-day grid, 6am–11pm hour rows, color-coded blocks, live current-time line.
- **Day view** — single-day vertical timeline with a day-pill strip and per-block task checklists.
- **View-aware overview** — "Week Overview" (whole week, hours vs. weekly goal with progress bars) that rescopes to "Daily Overview — [Day]" in Day view.
- **Add Block** — category / day / start–end / optional title. Press `c` to open it.
- **Tasks** — grouped per block for the day, inline add, completion progress.
- **Allocation options** — create / rename / recolor / set weekly goal / delete categories (deleting cascades its blocks & tasks). Open from the left rail.
- **Google Calendar sync** — read-only. Connect your Google account to pull the next 7 days of invites into the sidebar. See below.

## Google Calendar setup (optional)

The app runs fine without this — Calendar just shows placeholder events until connected.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Google Calendar API** (APIs & Services → Library).
3. Configure the **OAuth consent screen** (External; add yourself as a test user).
4. Create an **OAuth 2.0 Client ID**, type "Web application". Under Authorized JavaScript origins add `http://localhost:5173` and your deployed URL.
5. Provide the Client ID one of two ways:
   - Set `VITE_GOOGLE_CLIENT_ID` in `.env` (copy from `.env.example`) and in your Vercel project env vars, **or**
   - Paste it into the "Google Calendar" card in the sidebar at runtime.

The OAuth token is kept in memory only (never written to `localStorage`), so you reconnect each session. The scope is read-only.

## Deploy (Vercel)

Framework preset auto-detects as **Vite**. Build command `npm run build`, output `dist`. Add `VITE_GOOGLE_CLIENT_ID` in Project Settings → Environment Variables if you want Calendar wired at build time, then add the deployed URL to the OAuth client's Authorized JavaScript origins.

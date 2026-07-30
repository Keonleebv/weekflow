# Weekflow — Case Study

A personal weekly/daily **time-blocking planner with an attached journal**, built as a polished portfolio piece. Dark, minimal, fast. Plan your time, execute against it, reflect on how it went, and review the week — a full loop, not a bare calendar.

**Live:** https://weekflow-delta.vercel.app
**Repo:** `Keonleebv/weekflow`

---

## 1. What it is

Weekflow is one app with three modes sharing a single data model:

- **Week view** — 7-day grid, hour rows, color-coded blocks by category, a live current-time line, and a right sidebar with a donut allocation chart + task list.
- **Day view** — same sidebar, but the main area becomes a single-day vertical timeline with a day-pill strip to switch days.
- **Journal** — a per-day reflection log (per-block notes + an overall reflection), an optional mood tag, a real AI-generated bullet summary, and a cross-week streak indicator.

Layered on top: a view-aware allocation overview (week goals vs. actuals), Google Calendar overlaid directly on the timeline, cross-device account sync, first-run onboarding, a mobile layout, product analytics, recurring blocks with real multi-week history, task carryover, a weekly review, and estimate-accuracy tracking.

It is almost entirely a **static site with local persistence**. The only server-side pieces are (a) one serverless function for the AI summary, and (b) Supabase for optional cross-device sync. No always-on backend to maintain.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Build / framework | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (single `index.css`, dark-theme tokens) |
| State | Zustand + `persist` middleware (localStorage) |
| Charts | Recharts (donut) |
| Dates | date-fns |
| AI summary | One Vercel serverless function (`api/summarize.ts`) → Claude Haiku via `@anthropic-ai/sdk` |
| Cross-device sync | Supabase (Auth + Postgres + Realtime) |
| Calendar | Google Identity Services (client-side OAuth, read-only) |
| Rate limiting | Upstash Redis (with in-memory fallback) |
| Analytics | `@vercel/analytics` |
| Hosting | Vercel (static build + serverless function, zero extra config) |

---

## 3. Architecture

### Data model (ISO-date based)

The core insight that made multi-week history possible: **everything is keyed by real ISO calendar dates**, not by a 0–6 day index into a single fake week.

```ts
type Category = { id; name; color; weeklyGoalHours? };

type Block = {
  id; categoryId; title;
  date: string;                       // ISO date this instance occurs on
  startMinutes; endMinutes;
  recurrence: 'weekly' | 'biweekly' | null;
  seriesId?;                          // ties a recurring series together
  skipped?;                           // "delete just this occurrence" tombstone
  notes?;
  estimateAccuracy?: 'accurate' | 'over' | 'under' | null;
};

type Task = {
  id; title; categoryId?; done; blockId?;
  date: string;                       // independent of blockId → carryover works
  createdAt;
};

type JournalEntry = {                 // keyed by ISO date
  date; mood; overallBody;
  blockNotes: Record<blockId, string>;
  summary: { bullets; forTextHash; generatedAt } | null;
};

type WeeklyDigest = { weekOf; bullets; forTextHash; generatedAt };
```

`Task.date` existing **independently of `blockId`** is what lets an unfinished task carry over to *tomorrow* rather than waiting for its block to recur two weeks out.

### State & persistence

- A single Zustand store holds all content plus device-local view state (`view`, `mode`, `selectedDate`, `currentWeekStart`).
- `persist` middleware writes to `localStorage` under `weekflow-state`, with a versioned `migrate` step (v1 single-week day-index model → v2 ISO-date model, migrated once with no data loss).
- The storage adapter is isolated, so swapping to a real DB only touches that layer — which is exactly what the Supabase sync layer does, without rewriting components.

### Recurring blocks (lazy generation)

Recurrence is generated **lazily, one occurrence at a time** — never speculatively. Navigating to a week checks each active series and creates at most one occurrence for that week if the interval matches and the slot isn't already occupied (including `skipped` tombstones). This avoids overpopulating future weeks and keeps biweekly correct. Editing the series-driving instance updates future not-yet-generated occurrences; editing an already-generated instance stays isolated — surfaced with an inline "applies to future weeks" note so the effect is never silent.

---

## 4. Feature set (as shipped)

**Planning & execution**
- Week + Day views with drag-to-create, click-to-select, drag-to-move, and edge-resize.
- Add/Edit Block modal with category, times, recurrence, notes, and a smart time default (pre-fills from the category's most recent block).
- Task list grouped by block, inline add, per-task delete, and a **"Carried over"** section for overdue tasks (date-based, no duplication).
- View-aware allocation donut: "Week Overview" (hours vs. weekly goal, progress bars) vs. "Daily Overview — [Day]".

**Reflection**
- Journal mode: per-block collapsible notes + an overall reflection box, one-tap mood, autosave.
- Real cross-week **streak** counter (works across week/month boundaries because entries are ISO-keyed).
- **AI summary** — 2–4 bullet points from a real Claude call, cached per entry and invalidated by a content hash.
- **Weekly review** modal — hours vs. goal, mood trend, tasks completed, estimate-accuracy insights, and an AI week-in-review — reachable from a link on the Week Overview card, not a new nav destination.

**Insight (competitor-research-driven, low-friction)**
- Week-over-week allocation deltas per category.
- One-tap **estimate-accuracy** check on elapsed blocks (About right / Took longer / Was faster) — surfaced in the weekly review only once there's enough data to say something honest.
- Mid-week **pace flag** ("behind pace") once past the week's midpoint.
- **Data export** (JSON + CSV, properly escaped).

**Onboarding, mobile, metrics**
- 3-step first-run carousel for genuine new users (gated on an `onboarded` flag), not the demo seed.
- Mobile layout: bottom tab bar + swipe-up sheet + horizontally scrolling week grid below ~860px; new mobile users default to Day view.
- Product analytics via custom `track()` events at the key moments.

---

## 5. Cross-device sync (Supabase)

**The problem:** all state lived in `localStorage` — per-browser, per-device. Laptop and desktop each had a separate copy with no shared source of truth.

**The solution:** a login + a cloud datastore, added as a storage layer on top of the existing store without rewriting components.

### Design

- **Auth:** Supabase Auth — Google (one-tap) and email/password.
- **Storage:** one Postgres table, `weekflow_state`, holding **one JSONB row per user** (`user_id`, `data`, `updated_at`). The whole planner state serializes into `data`. Simple, and a perfect fit for a single-user document model.
- **Security:** Row Level Security — a user can only ever read/write their own row (`auth.uid() = user_id`). This is what makes the public anon key safe to ship in the client (it's designed to be public; RLS is the real guard).
- **Realtime:** a Supabase Realtime subscription on the user's row means a change on the laptop appears on the desktop **live**, no refresh.

### Sync engine

- **Pull on login**, **debounced push** on local edits, **realtime apply** on remote changes, with an echo-loop guard (ignore realtime events that match current content).
- **Conflict resolution: most-recently-edited-wins.** Each device tracks its own last-edit timestamp; on login it compares against the cloud row's `updated_at` and keeps whichever was edited more recently. First-ever login seeds the cloud from local data so nothing is lost.
- **Account isolation:** the local data is tagged with the account that owns it. On sign-out, local content resets to a blank state; on login, a different account never adopts or uploads the previous account's data. (A subtle trap caught here: Supabase fires `INITIAL_SESSION` with a *null* session on every logged-out page load — that must not be treated as a sign-out, or it wipes a genuine anonymous user's local data.)

### One-time setup (documented in the repo)

Create a Supabase project → run the provided SQL (table + RLS policies + realtime publication + a `GRANT` for the `authenticated` role) → enable Google + email providers → set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. When those env vars are absent, the app runs **local-only** — the whole sync layer is inert and the app behaves exactly as before.

---

## 6. Google Calendar integration

**Read-only, client-side, no backend.** Weekflow pulls your invites in to sit next to your own blocks; it never writes to your calendar — a deliberate scope decision, not an oversight.

### How it works

- Google Identity Services token client (implicit OAuth), scope `calendar.readonly`.
- **On the timeline, not just a sidebar list** — fetched events render directly on the day/week grid using the same pixel-per-minute math as native blocks, visually distinct (dashed border, "G" badge, non-editable).
- **Never persisted as blocks** — events are held in memory only and fetched fresh. Copying them into stored blocks would let them silently drift from the real calendar and would quietly undo the read-only decision.
- **Lazy fetch:** the visible week ± a one-week buffer, refetched on week navigation, with a quiet periodic refresh. The sidebar's rolling "next 7 days" list is a separate, smaller fetch.

### One-step connect via Google sign-in

Signing in with Google requests the calendar scope in the *same* OAuth handshake, so the calendar connects in one step (using the `provider_token` Supabase returns) — no second popup for Google users. Email/password users connect via the sidebar button.

### Account-scoped connection

The calendar connection follows the signed-in account: it disconnects on sign-out (no "synced" while logged out), the token is tagged with its owning account so one account never sees another's calendar, and it reconnects silently for its owner from a tab-scoped token. The token lives in `sessionStorage` (cleared when the tab closes) — never at rest in `localStorage`.

**Known limitation (accepted):** Google access tokens live ~1 hour and there's no client-side refresh token, so after expiry or a tab close, reconnecting is one deliberate **Connect** click. Truly permanent silent reconnection would need a server-side refresh-token flow — consciously left out as disproportionate for a single-user tool.

---

## 7. Unified overlap layout

Overlapping items used to render full-width and stack on top of each other, unreadable. Now **any** conflicting items — native↔native, native↔Google, Google↔Google — split into side-by-side columns via one shared algorithm.

1. **Cluster** items into transitively-connected overlap groups (A–B and B–C puts A and C together even if they never directly conflict). Sharing a boundary instant (back-to-back) is *not* a conflict — strict inequality.
2. **Assign columns** greedily within each cluster.
3. Every item in a cluster renders at `100% / totalColumns` width for its full span.

Visual treatment: edge-to-edge, rounded only on the group's outer corners, suppressed internal borders, seam handles between columns. It's the deliberately-simple version (an item chained to a conflict elsewhere stays narrower for its whole span) — a stated tradeoff over per-time-slice width reclamation.

The algorithm was ported as a **pure function** and verified against all six documented edge cases (identical, nested, back-to-back, staggered, three-way, live-add) *before* it touched any UI.

---

## 8. Security & hardening

The only surface that costs money or can be abused is the AI summary endpoint. It's hardened accordingly:

- **Secrets:** `ANTHROPIC_API_KEY` is server-side only — never `VITE_`-prefixed, never in the client bundle. Google Client ID and Supabase anon key are *public by design* and env-var'd anyway for easy per-environment swaps.
- **`/api/summarize`:** POST-only, Origin allowlist, 8000-char input cap, 512-token output cap, generic 500s (no internal detail leaked), a prompt-injection guard in the system prompt, and a `maxDuration` bound on the function.
- **Rate limiting:** per-IP (8/min) **and** an app-wide ceiling (120/min) — durable and global across serverless instances via Upstash Redis when configured, with an in-memory fallback otherwise.
- **The static site** is served from Vercel's CDN, which absorbs volumetric DDoS at the edge.
- **Cost backstop:** documented as an Anthropic monthly spend cap — the ultimate ceiling that code alone can't provide.

---

## 9. Product thinking

- **North Star candidate:** *Weekly Active Planning* — the share of weeks where a user both scheduled blocks *and* wrote a journal entry, tying together the product's two halves rather than measuring one.
- **Activation:** created ≥1 block *and* set ≥1 category goal in the first session (engaged with what makes it more than a bare calendar).
- **Engagement:** blocks/week, task completion rate, journal entries/week, AI summaries/week (a proxy for whether the journal is revisited, not abandoned).
- **Retention:** week-over-week active weeks and the distribution of journal streak lengths (median streak is a more honest signal than "% who journaled at all").
- **Honesty:** at N=1 none of this is statistically meaningful — the portfolio-worthy artifact is the *framework* (what to measure and why), not the dashboard.

---

## 10. Engineering decisions & tradeoffs (the honest list)

- **ISO-date model over a single fake week** — the change that unlocked recurrence, carryover, and cross-week streaks.
- **One JSONB row per user** instead of normalized tables — the right complexity for a single-user document; RLS makes the anon key safe.
- **Most-recently-edited-wins** conflict resolution — simple and predictable for a personal tool; clock-based, so acknowledged as vulnerable to significant device clock skew.
- **Calendar read-only + never-stored** — preserves the read-only guarantee in spirit, not just at the API call.
- **Deliberately-simple overlap layout** — no per-time-slice width reclamation; verified against edge cases instead of hand-waved.
- **Block height is strictly time-based** with internal scroll + fade — content never bleeds into the next block; a fixed regression guard against reintroducing content-count height estimates.
- **Consciously out of scope:** AI auto-scheduling, start/stop time tracking, third-party task aggregation, Gantt/Kanban — building any of them makes Weekflow a weaker clone of a bigger product instead of deepening its actual identity (planned block ↔ written reflection).

---

## 11. Testing & QA approach

- **Pure logic verified in isolation** — the overlap algorithm was checked against all six edge cases as a plain function before UI integration.
- **Real browser verification** — headless Playwright drove the actual UI (seeded state, real clicks/drags, DOM + geometry assertions) rather than reasoning about behavior. This caught real bugs: a block-delete that cascade-deleted linked carried-over tasks (fixed by unlinking), an `INITIAL_SESSION` that wiped anonymous data, and cross-account data isolation.
- **Pre-portfolio QA pass** — every enumerated scenario across recurrence, carryover, weekly review, journal, onboarding, mobile, export, and overflow was actually run; passes, failures, and on-the-spot fixes were logged plainly (what broke and how it was fixed is itself honest case-study material).

---

## 12. Known limitations / future work

- **Google Calendar persistence** — reconnect once per session after token expiry / tab close; a server-side refresh-token flow would make it permanent.
- **Past-midnight / multi-day blocks** — blocks are clamped to a single calendar day by design; true overnight blocks would need multi-day rendering + split hours math.
- **Conflict resolution** — clock-based last-write-wins; a server-arbitrated timestamp would be bulletproof.

---

## 13. What this demonstrates

- **End-to-end product ownership** — from a spec and a mockup to a shipped, deployed, verified app, including the unglamorous parts (auth, sync, conflict resolution, rate limiting, data migration).
- **Judgment about scope** — a clear, defended list of what *not* to build, and simple-version tradeoffs stated openly.
- **Real integrations done carefully** — Supabase auth + RLS + realtime, Google OAuth with account scoping, a hardened LLM endpoint — with secrets handled correctly throughout.
- **Honesty about what's proven vs. unproven** — verified with real browser tests, with limitations documented rather than hidden.

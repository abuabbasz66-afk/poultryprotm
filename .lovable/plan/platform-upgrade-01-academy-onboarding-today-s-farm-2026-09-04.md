# Platform Upgrade 01 — Academy, Onboarding & Today's Farm

## What already exists (verified, will be reused, not rebuilt)

- **Learning Center** — a full tutorial hub already exists (`src/components/learning-center.tsx`) with 32 recorded tutorials in a code catalog (`src/lib/tutorials.ts`), thumbnails and MP4s served from `public/tutorials/`. It renders on the landing page today.
- **Alerts engine** — `src/lib/alerts.ts` already derives production decline, mortality patterns, feed, price and activity alerts from real records, with read/dismiss state.
- **Dashboard** — `/dashboard` has three areas (Records / Analytics / AI) with real KPIs, forecasts and monitors.
- **Onboarding** — `/onboarding` already forces farm creation for users with no farm.
- **RBAC** — database-driven permissions via `my_farm_context()`; sidebar filters by permission.
- **Super admin** — existing `/super-admin` area and `is_super_admin()`.

So: no new competing tutorial system. The existing catalog becomes the seed for a database-backed Academy, and the existing alert engine feeds the new Action Centre.

## What will be built

### 1. Academy (database-backed)
New tables `academy_categories`, `academy_tutorials`, `academy_progress`, `academy_events`:
- Public read is limited to published tutorials in active categories (`TO anon` + `authenticated`).
- Only super admins can write tutorials/categories.
- Progress and view/completion events are strictly per-user (`auth.uid()`).
- Existing 32 tutorials + 8 categories (Getting Started, Daily Farm Records, Production, Feed Management, Health & Mortality, Finance & Analytics, AI Intelligence, Farm Management) are inserted as real rows pointing at the existing `/tutorials/...` files. No fake content.
- Video URL is a plain URL column, so YouTube/Vimeo/Storage links work later.

### 2. Academy UI
- **Public section** on the landing page, in the requested position (after "How PoultryPro Works", before AI Intelligence), titled "PoultryPro Academy" — premium card grid, thumbnail, play, category, difficulty, duration, plus "View All Tutorials".
- **Public route `/academy`** — full catalog with search + category filters.
- **Player route `/academy/$slug`** — video player (no autoplay sound), metadata, previous/next, related tutorials, and "Mark as Complete" for signed-in users.
- **Authenticated `/help`** — "Help Centre": search ("What do you want to learn?"), categories, featured, recently added, recommended, Getting Started. Added once to the sidebar under Workspace.
- **Contextual help** — a small, subtle `HelpHint` button placed on Production, Feed, Health/Mortality, Finance, Analytics and AI sections, deep-linking to the right tutorial.

### 3. Admin management
New `/super-admin` Academy tab: create/edit/archive tutorials, category, difficulty, duration, video + thumbnail URL, publish/feature toggles, reorder, with confirm dialogs on destructive actions. Gated by the existing super-admin role, server-side via RLS.

### 4. Onboarding checklist
`FarmSetupChecklist` on the dashboard: farm created, flock added, rooms added, first production record, feed record, farm profile completed — each derived from real queries (no fake states), with percentage complete and a "Complete" action linking to the right page. Minimize/dismiss state stored per user in the existing preference pattern (localStorage per farm + user).

### 5. Today's Farm Action Centre
Restructures the top of `/dashboard` Records area into:
- **Today's Farm** — Birds, Eggs, Feed, Mortality, Revenue from the database, each with a comparison to yesterday/recent average, or "Not enough data yet" when history is thin.
- **Needs Your Attention** — top alerts from the existing engine (neutral wording: risk signal / review recommended).
- **Today's Tasks** — generated from actual state (missing production record, missing feed record, low stock, open alert); tasks disappear once done.
- **Empty states** — new farms get explanatory copy plus a record button instead of bare zeros.
- Existing Records/Analytics/AI sections stay below, untouched.

## Technical notes

- Reads use the existing TanStack Query + Supabase client patterns; Academy queries are separate from dashboard queries so the dashboard is not slowed. Thumbnails lazy-load; public lists are limited.
- `src/lib/tutorials.ts` stays as the fallback/source of the seed, and the UI reads from the database.
- No service-role usage in client code; all Academy writes go through RLS-protected tables.
- Mobile: card grids collapse to one column, player is responsive, no horizontal overflow.

## Order of work

1. Migration (tables, grants, RLS) + seed of existing tutorials.
2. Academy data layer + public section + `/academy` + player.
3. Help Centre + contextual help buttons.
4. Super-admin Academy management.
5. Setup checklist + Today's Farm Action Centre.
6. Test: build, public/authenticated flows, mobile widths, permission checks.

## Limitations to expect

- Tutorial "views" analytics are counted per authenticated user only (no anonymous tracking) to avoid collecting unnecessary data.
- Videos remain the currently recorded files; no new recordings are produced.

## Goal

Make PoultryPro keep working with no internet: farmers keep recording, data is stored safely on the device, and everything uploads automatically once the connection returns. No database schema changes, no change to the current online behaviour.

## How it will work

```text
Farmer action ──► existing hook (useAddEgg, useAddFeed, ...)
                        │
                 online?├── yes ─► Supabase (as today) ─► also cached locally
                        └── no  ─► IndexedDB outbox (status: pending)
                                          │
                       connection returns │ (auto, + "Sync Now")
                                          ▼
                                  upload in order ─► confirmed ─► removed from outbox
```

## What gets built

**1. Local database layer (IndexedDB)**
- Two stores: `cache` (last-known server data per table) and `outbox` (pending writes).
- Every queued record carries: local ID, farm ID, user ID, timestamp, sync status, `created_offline: true`.
- All data is namespaced by user ID and cleared on sign-out, so another user on the same device can't see it.
- Values are stored encrypted (AES-GCM via WebCrypto) with a key derived from the signed-in session and held only for that session.

**2. Offline-capable reads**
- A caching wrapper around the existing React Query hooks writes every successful fetch to IndexedDB and, when offline, serves the last cached result.
- Cached: rooms, birds, egg production, feed history, mortality, health, prices/financials, farm profile, subscription status, settings, roles.
- Dashboard, charts and analytics keep rendering from that cache (bird count, eggs, feed, revenue, expenses, profit, mortality).

**3. Offline-capable writes**
- The existing mutation hooks get a shared `queueOrRun` helper: online → current Supabase path; offline (or network failure) → append to outbox and optimistically update the local cache so the UI updates instantly.
- Covers all recording modules: egg production, feed usage, feed purchases, feed formulation, mortality, health/medication/vaccination, water, financial transactions, sales, expenses, bird transfers, inventory and room records. (Any module without an existing table stays on its current table — no schema changes.)

**4. Automatic synchronisation**
- A sync engine listens for `online`, tab focus, and a periodic check; also registers Background Sync where the browser supports it.
- Uploads sequentially, preserves original timestamps, uses a deterministic local ID as the idempotency key so a retry can't create duplicates, and only deletes a queue item after the server confirms.
- Exponential-backoff retry if the connection drops mid-sync; thousands of queued rows are processed in batches so the UI stays responsive.

**5. Status indicator**
- Header pill: 🟢 Online / 🔴 Offline / 🟡 Syncing… / ☁ All changes synced, with pending count and last-sync time, plus a **Sync Now** button.
- Toasts: "Working offline — your records are saved on this device", "Internet connection restored", "Synchronising records…", "All records successfully synchronised".

**6. Conflict resolution**
- Before upload, compare the record's server `updated_at` against the version captured when it was edited offline.
- On mismatch, hold the item and show a dialog: "Two versions of this record exist" with side-by-side values and Keep Local / Keep Cloud / Merge. Nothing is ever overwritten silently.

**7. PWA shell**
- Add `vite-plugin-pwa` (generateSW) with a guarded registration wrapper: never registers in the Lovable preview/iframe/dev, supports `?sw=off`, network-first for HTML, cache-first for hashed assets.
- Web app manifest + icons so the app installs to the home screen and boots instantly offline.

## Technical notes

- New files: `src/lib/offline/db.ts` (IndexedDB + crypto), `outbox.ts`, `sync-engine.ts`, `use-online-status.ts`, `offline-query.ts`; `src/components/sync-status.tsx`, `src/components/conflict-dialog.tsx`; `src/pwa/register.ts`; `public/manifest.webmanifest`.
- Edited: `src/lib/farm-data.ts` and the other data modules (feed inventory/formulas) to route through `queueOrRun`; `src/components/app-sidebar.tsx` header for the status pill; `src/routes/__root.tsx` for provider + manifest tags; `vite.config.ts` for the PWA plugin.
- Supabase auth already persists its session in localStorage, so a previously signed-in device stays logged in offline; the `_authenticated` route guard will fall back to the cached session instead of redirecting when the network is down.
- Offline behaviour (service worker + install) only applies to the published app, not the Lovable editor preview.

## Caveats

- Background Sync API is Chromium-only; other browsers use the online-event + focus + interval fallback, which covers the same cases while the app is open.
- Records created offline appear to other users only after sync.

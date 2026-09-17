# PoultryPro Production PWA and Mobile Experience

## Goal
Upgrade the existing PoultryPro application in place into a polished installable mobile experience without replacing authentication, farm data, permissions, reports, or desktop workflows.

## What the audit found
- The official logo already powers valid 192px, 512px, maskable, Apple touch, and favicon assets.
- The manifest, guarded production service worker, install prompt, update notice, connection status, dedicated offline page, encrypted IndexedDB cache, idempotent outbox, retry engine, and conflict-review dialog already exist.
- Core production, mortality, health/medication, and legacy feed records already use the safe offline layer. Advanced feed, vaccination, rearing/water, and finance use separate data paths and are not all queue-enabled.
- Mobile currently uses a long desktop-style drawer; there is no one-handed bottom navigation or grouped More menu.
- Several major screens still use wide desktop tables on phones.
- Browser push delivery and saved notification-category preferences do not yet exist.

## Implementation

### 1. Harden the existing PWA
- Update the manifest orientation to `portrait-primary` and retain the current identity, colors, URLs, and official-logo icons.
- Add safe-area spacing for the top bar, bottom navigation, dialogs, prompts, and page content on notched iPhones/iPads.
- Keep the service worker disabled in development and Lovable preview.
- Add stale-cache cleanup and bounded asset retention while keeping HTML navigation network-first and excluding authentication, server calls, and private farm responses from runtime caching.
- Verify the generated worker’s update activation behavior; retain explicit user-controlled updates and add a Later action so form entry is never interrupted.
- Keep the dedicated `/offline` screen available while allowing previously loaded authenticated screens to render from encrypted local data.

### 2. Improve installation
- Extend the current prompt with platform-aware behavior: native install on supported Android/desktop browsers and Safari-specific Share → Add to Home Screen guidance on iPhone/iPad.
- Replace permanent dismissal with a respectful cooldown.
- Add a reusable Install PoultryPro action in Help/Settings so users can install later.
- Detect installed/standalone mode and never show installation prompts there.

### 3. Build mobile-first navigation
- Add a permission-filtered bottom bar for Home, Production, Feed, Health, and More on phones.
- Build a grouped More sheet from the existing navigation configuration, preserving every currently available module and its permission checks.
- Keep the desktop sidebar unchanged.
- Account for the iOS home indicator and add bottom content clearance so controls are never covered.

### 4. Refine the mobile dashboard and quick recording
- Reorganize the existing real-data dashboard for phones around Today’s Farm, key metrics, alerts/actions, quick recording, production/feed/health signals, weather, AI insights, and upcoming health tasks.
- Reuse existing queries and calculations only; do not add mock figures or duplicate business logic.
- Make quick actions permission-aware and open the existing record forms.
- Preserve the current desktop dashboard and analytics views.

### 5. Improve high-use mobile forms and records
- Standardize touch targets, numeric keyboard hints, mobile bottom sheets, validation, and selector sizing across production, feed, mortality, health/medication, vaccination, water/rearing, finance, broilers, and inventory.
- Use compact step grouping only for genuinely long forms; keep short forms fast.
- Convert the highest-use wide tables into mobile record cards while retaining desktop tables and horizontal scrolling where tabular comparison is essential.
- Add a mobile report-ready flow and Web Share support when the browser can share the generated file; retain PDF, Excel, CSV, and official report branding.
- Preserve private upload handling and use the device picker only after the user starts an upload.

### 6. Expand offline support safely
- Keep the current encrypted, per-user queue and deterministic UUID/idempotent sync design.
- Extend it only to eligible direct record writes in advanced feed, vaccination, and rearing/water after checking each payload and database trigger path.
- Do not queue multi-step, payment, inventory-consumption, or other transactional operations that cannot be replayed safely; show a clear connection-required message instead.
- Standardize wording: queued records say “Saved on this device” and confirmed server writes say “Saved”.
- Keep pending counts, retry/error state, conflict Review/Retry/Discard controls, confirmation before discard, and local queued records through session expiry.
- On explicit sign-out, continue clearing that user’s encrypted local farm cache to prevent account-to-account leakage.

### 7. Notifications and badging readiness
- Add a permission-aware notification preferences screen for production, feed, mortality, health, vaccination, medication, finance, and system categories.
- Persist preferences per signed-in user with narrow row-level access only if no equivalent storage already exists.
- Request browser notification permission only after the user enables notifications.
- Add feature-detected app badging based on actionable/pending counts and clear it when resolved.
- Prepare service-worker notification-click handling without claiming remote push delivery; actual background Web Push delivery requires a configured sender and signing credentials.

### 8. Session, farm, and permission safety
- Preserve the current authentication provider, session persistence, password recovery, farm membership, role permissions, and row-level security.
- Add a clear expired-session message and sign-in action without deleting pending local records automatically.
- Preserve the existing authorized farm context. Do not add a fake farm switcher; only expose switching if the signed-in account has multiple authorized farm memberships.
- Every mobile action remains filtered in the interface and enforced by existing database policies.

## Technical details
- Reuse `vite-plugin-pwa` with generated Workbox service worker; do not hand-write a new app-shell worker.
- Reuse `NAV_SECTIONS`, `usePermissions`, existing record dialogs, export engine, IndexedDB stores, outbox, sync engine, and conflict dialog.
- Any new preference table will include explicit authenticated/service grants, row-level security, and owner-only policies in the same migration.
- No private API responses will enter Cache Storage; previously loaded farm data remains encrypted in per-user IndexedDB.
- Keep changes incremental and split large dashboard/navigation pieces into focused components only where needed for mobile behavior.

## Validation
- Build and inspect the generated manifest/service worker/icon outputs.
- Test public and authenticated flows at phone, tablet, and desktop widths with Playwright, including standalone display emulation where possible.
- Verify sign-in/sign-out, dashboard, production, feed, mortality, health, finance, vaccination, rearing/water, reports, exports, uploads, permission-hidden actions, offline queue/reconnect, conflicts, install prompts, and update prompts.
- Verify no content is obscured by safe areas or the mobile bottom bar and no selected screen has incoherent overlap.
- Run focused tests and inspect build/runtime/network logs.

## Limitations to report
- iOS installation uses Safari’s Share → Add to Home Screen flow because iOS does not expose Android’s native install event.
- Offline support applies only to operations proven safe to replay; complex connected transactions remain connection-required.
- Remote background push cannot be delivered until a push sender/signing configuration is supplied; the app will be prepared without exposing secrets.

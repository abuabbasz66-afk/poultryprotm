<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Offline sync of natural-key tables (egg_production: UNIQUE farm_id,date) goes through BUSINESS_KEYS in src/lib/offline/sync-rules.ts; why: offline adds must merge into the day's row, never duplicate or overwrite silently.
- Sync errors are classified temporary (auto-retry, capped) vs permanent (status "error", user retries); why: permanent failures must not loop or hide.
- Mobile and desktop navigation destinations come only from `NAV_SECTIONS`; `mobileLabel` and `desktopLabel` mark direct links while all others derive into More menus, keeping routes, permissions, and premium metadata synchronized.
- Farm alerts/intelligence come from the pure engine in src/lib/intelligence/engine.ts (stable per-condition keys; lifecycle persisted in farm_alert_states); why: one source for dashboard, alerts page, bell and future notifications, without duplicate alerts.
- Dashboard workflow stages reuse records/analytics/predictive areas and the shared Action Centre for recommendations/actions; why: display five stages without duplicate intelligence, invented destinations or changed entitlements.
- Signed-out login helpers (phone→email lookup, failed-login logging) run only in src/lib/login.functions.ts, throttled via auth_rate_limits; why: browser-callable lookups allowed account enumeration and log flooding.
- Record-entry sanity checks live in src/lib/record-validation.ts and warn (confirm to save) rather than block; why: legitimate edge cases (multi-day egg collections) must remain recordable.
- Action Centre workflow (acknowledge/assign/start/resolve/dismiss/reopen) changes alert state only via the `alert_transition` DB function, which checks category write permission and writes `farm_alert_events`; a guard trigger lets browser sync only open or auto-resolve alerts. Why: workflow and its audit history must be enforced server-side.
- Public landing Action Centre examples use a standalone synthetic catalogue and read-only preview, never the farm intelligence hooks; why: public marketing must not fetch or persist private farm records.
- The homepage egg-value card uses an aggregate-only production valuation RPC with historical farm crate prices, broken-egg exclusion and coverage reporting; it never adds Finance sales or exposes farm rows. Why: show a live all-farm total without double counting, currency mixing or claiming verified payment receipts.
- The homepage's five-stage explanation lives in a dedicated presentational journey component with native expandable details and illustrative text only; why: keep lengthy public explanations accessible without coupling them to private farm data or calculations.
- Landing hero imagery uses bundled responsive WebP sources with matched preload sizing and priority loading; tablet UI is composited from the actual Farm Analytics interface using labelled synthetic records, never AI-generated metrics or customer data. Why: accurately show the product without implying verified live results.
- Google account identity fields are mirrored into a self-readable `public.profiles` table; roles and privileges remain governed by protected role and permission systems, never profile fields.
- SMS broadcasts use protected server functions, existing role and consent sources, persistent recipient claims and at most five provider submissions per request; ambiguous submissions are never automatically resent because the provider does not document idempotency.
- SMS delivery callbacks require verified provider signatures and deduplicate status events; browser queue continuation is resumable and must not be represented as an unattended worker.
- SMS activation uses a server-only designated owner identity plus the existing protected super-admin role; guarded platform settings and an audited service-only transition persist approval, configuration fingerprints invalidate changes, and test receipt stays separate from provider delivery status. Never use the legacy environment switch to authorise bulk sends.
- Layer vaccination schedules derive from the flock anchor date (Day 1 = hatch/placement day) via src/lib/vaccination.ts; treatments and procedures carry item_type so they are never presented as vaccines, and reference templates stay approval_status='reference' until a super admin approves (approval recorded with approver and date). Why: supplied templates are reference material, not prescriptions.
- Vaccination approval controls mirror existing programme RLS scope (global: super admin; farm-specific: that farm's health.write), and approval mutations must return the saved row with approver and date before reporting success. Why: RLS-filtered zero-row updates are not approvals.

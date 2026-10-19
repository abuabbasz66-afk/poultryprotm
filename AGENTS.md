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
- The homepage production-value card uses a dedicated owner-approved dated snapshot module, separate from live activity counts and the existing aggregate-only egg-sales RPC. Why: publish only the authorised summary without misrepresenting production value as live sales or changing financial records.
- The homepage's five-stage explanation lives in a dedicated presentational journey component with native expandable details and illustrative text only; why: keep lengthy public explanations accessible without coupling them to private farm data or calculations.
- Google account identity fields are mirrored into a self-readable `public.profiles` table; roles and privileges remain governed by protected role and permission systems, never profile fields.
- SMS broadcasts use protected server functions, existing role and consent sources, persistent recipient claims and at most five provider submissions per request; ambiguous submissions are never automatically resent because the provider does not document idempotency.
- SMS delivery callbacks require verified provider signatures and deduplicate status events; browser queue continuation is resumable and must not be represented as an unattended worker.
- SMS activation uses a server-only designated owner identity plus the existing protected super-admin role; guarded platform settings and an audited service-only transition persist approval, configuration fingerprints invalidate changes, and test receipt stays separate from provider delivery status. Never use the legacy environment switch to authorise bulk sends.

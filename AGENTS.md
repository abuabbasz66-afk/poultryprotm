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
- Mobile and desktop navigation destinations come only from `NAV_SECTIONS`, with `mobileLabel` marking bottom-bar items; why: routes, permissions, and premium metadata must stay synchronized.

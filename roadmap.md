# PoultryPro PWA and mobile upgrade

- [x] Harden manifest, service worker updates, safe areas, and install experience
- [x] Add permission-aware mobile bottom navigation and grouped More menu
- [x] Refine mobile dashboard and quick actions using live data
- [x] Improve high-use mobile forms and high-density record tables
- [x] Extend safe offline coverage and standardize queue/error/session UX
- [x] Add notification preferences and feature-detected badging readiness
- [x] Validate phone, tablet, desktop, offline, installed, auth, permissions, reports, and exports

## Landing page (2026-09-20)
- [x] Remove "Revenue tracked", "Premium farms", "Profit analysed" stats from landing page
- [x] Remove "Doctorate in Business Administration (DBA) — In View" founder credential
- [x] Remove Airtel Sponsored 3MTT NextGen winner recognition
- [x] Preserve the mobile bottom navigation alongside the sidebar navigation

## Live Demo redesign (2026-09-21)
- [x] Inspect the existing public presentation route, demo data boundary, and reusable analytics
- [x] Redesign the read-only walkthrough into seven interactive command-centre stages
- [x] Preserve the fixed ABZ demonstration dataset and expose unavailable metrics honestly
- [x] Test every stage, desktop/mobile layout, loading/failure states, and read-only behavior

## Academy video audit and UX upgrade (2026-09-22)
- [x] Audit all 33 published tutorials and record truthful playback results
- [x] Add provider-safe premium player, failures, progress, and completion behavior
- [x] Improve Academy discovery, featured content, categories, and learner shelves
- [x] Add admin Academy video health, URL validation, and video reporting
- [x] Verify desktop, mobile, refresh, navigation, slow network, and supported browsers
- [x] Deliver final audit totals and exact tutorials needing attention

## Growth, activation & conversion (2026-09-23)
- [x] product_events, user_onboarding, user_feedback tables + RPCs (migration 0006)
- [x] Client tracking helper (src/lib/growth.ts), fire-and-forget
- [x] Goal question in farm setup; goal-personalised getting-started checklist (DB-backed, reopenable from Help)
- [x] First-run empty state + first insight from real records
- [x] Upgrade dialog + checkout event tracking (server-side verification unchanged)
- [x] Feedback prompt after 3+ active days
- [x] Admin > Growth dashboard (stats, funnel, drop-off, feedback)
- [ ] Real Paystack test payment acceptance run (not performed - would be a live charge)

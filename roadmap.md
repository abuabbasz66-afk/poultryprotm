# PoultryPro PWA and mobile upgrade

## Five-stage dashboard workflow (2026-10-19)

- [x] Replace three-stage cards with compact Capture → Understand → Predict → Recommend → Act navigation using existing access checks and destinations
- [x] Verify signed-in stage navigation and desktop/tablet/mobile layout; 58 calculation/intelligence tests passed and automatic compilation passed; preserved compact header and kept unpublished

## Compact dashboard farm header (2026-10-19)

- [x] Reduce the existing farm banner to a compact desktop row and neatly wrapping mobile layout; preserve live data and controls
- [x] Verify signed-in desktop header at 120px, tablet/mobile wrapping, all farm details and no horizontal overflow; automatic compilation passed

## Admin Broadcast Messaging Centre (2026-10-18)

- [x] Add guarded owner-only test/live approval controls, provider verification and explicit configuration status
- [ ] Verify real provider account and the approved owner test — blocked by Termii credentials, funding, sender/route approval and delivery setup
- [x] Audit existing admin access, phone sources, consent and SMS provider capabilities
- [x] Add protected campaigns, recipient queue and audit history with safe duplicate prevention
- [x] Build overview, composer, confirmation, recipient selection and delivery history
- [x] Verify permissions, filtering, queue, mocked provider failures and UI without real sends
- [x] Document setup and limitations in docs/admin-broadcast-messaging.md; keep unpublished
- [ ] Enable bulk broadcasts — blocked until provider setup, actual owner test receipt and separate live activation approval

## Five-stage farm intelligence journey (2026-10-18)

- [x] Audit capability claims and preserve truthful release/preview labels; align public Premium copy with record-based tools
- [x] Expand the existing journey with explanations, illustrative scenario and correct CTAs
- [x] Verify mobile/desktop, expandable details, links and all 76 tests; automatic build OK; kept unpublished

## Intelligence-led landing page (2026-10-12)

- [x] Update hero and five-step decision workflow while preserving brand and navigation
- [x] Add private-data-free Action Centre illustration and honest capability availability
- [x] Preserve pricing, statistics, founder and achievements; add registration/tutorial guidance and verified-story space
- [x] Verify mobile/desktop, links, automated tests and preview build; keep unpublished

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

## Customer engagement & retention (2026-09-23)

- [x] Communication consent (WhatsApp/SMS/phone/marketing/account) with consent date + source
- [x] Real-data segmentation (11 segments) from farms, records, activity and payment events
- [x] 11 approved, personalised message templates (service vs promotional)
- [x] Frequency control: 1/24h, 3/7d promotional, configurable; stops on paid plan or opt-out
- [x] Admin → Customer Engagement: stats, segments, composer, message history, call requests
- [x] "Request a call" for farmers + admin call queue
- [ ] Automatic sending (needs an approved WhatsApp Business / SMS provider account)
- [ ] Delivery/read receipts (only available with a provider account)

## Data reliability (2026-09-27)

- [x] Egg offline sync on farm_id+date, outbox coalescing, error states/retry, farm-scoped overlay, conflict re-base, unit tests

## Mobile navigation consolidation (2026-09-27)

- [x] Remove the duplicate mobile hamburger drawer while preserving the desktop sidebar
- [x] Drive the bottom bar and complete More menu from the shared permission-aware navigation catalogue
- [x] Validate small-phone navigation, active states, browser back, and desktop sidebar

## Desktop navigation redesign (2026-09-27)

- [x] Replace the left sidebar with a two-row horizontal header driven by the shared navigation catalogue
- [x] Preserve alerts, sync status, farm access, profile, permissions, premium labels, and mobile bottom navigation
- [x] Validate route completeness, dropdown behavior, active states, laptop/tablet fit, mobile separation, and production build
- [ ] After publishing: revoke signed-out access to the phone lookup (see migration 0012)
- [ ] Owner decision: presentation demo shows real ABZ farm totals publicly — keep or switch to labelled sample data
- [ ] Owner approval: plan feature matrix before backend plan enforcement
- [ ] Owner: re-enter egg records 8–20 Sep 2026 from paper/WhatsApp notes
- [ ] Owner approval: backup restore drill in a separate test environment

## Pre-publish corrections (2026-10-12)

- [x] Public demo uses synthetic labelled DEMO DATA (no database read)
- [x] Rename revenue−feed "Profit" to "Feed Margin" with explanation; Finance shows "Operating profit"
- [x] Replace "Disease Prediction" marketing wording
- [x] Failed phone sign-in + rate limit verified
- [ ] Successful staff phone sign-in — blocked: needs authorised test staff account
- [ ] At publish: revoke public access to legacy phone lookup and old real-data demo function — blocked: needs deployment approval
- [x] Plan permission matrix drafted — awaiting owner approval before enforcement
- [ ] Import verified 8–20 Sep egg figures — blocked: needs original farm records

## Google account sign-up (2026-10-17)

- [x] Add Google sign-in option to the existing account screen
- [x] Store Google name/avatar in a self-scoped profile record; preserve separate role permissions
- [x] Verify account screen on phone and desktop; ensure first-time Google users land in farm setup
- [ ] Complete a real Google sign-in with an authorised account; provider round-trip not exercised in preview
- [x] Keep the change unpublished; no production release made

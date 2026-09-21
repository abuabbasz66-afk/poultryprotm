# PoultryPro Live Demo Redesign

## Goal
Turn `/presentation` into a fast, premium, seven-stage farm command-centre walkthrough using only the fixed ABZ Global Resources historical demonstration dataset. The authenticated farm application, users, subscriptions, permissions, and production records remain untouched.

## What will change

### 1. Keep one safe, read-only demo data boundary
- Preserve the existing zero-argument `demo_greenfield_data()` call and its server-fixed demonstration farm; no URL, browser value, or visitor input can select a farm.
- Extend that function only where the walkthrough needs missing read-only aggregates: room-level production history, real expense totals/categories, health/vaccination counts, and any genuinely available feed inventory/weather summary.
- Return aggregate or limited historical data only. Do not expose owner details, staff identities, notes, receipts, payments, authentication data, or records from any other farm.
- Remove the hardcoded fallback prices from the demo response. Missing source values become `null` and display “Not available in this demonstration.”
- No production table, production row, user, authentication rule, subscription rule, or RLS policy changes.

### 2. Replace the 12-slide tour with seven focused stages
1. **Overview** — branded PoultryPro welcome, ABZ historical-data disclosure, real birds/eggs/days/feed metrics, and immediate “Start Farm Walkthrough” / “Explore Dashboard” actions.
2. **Production** — selectable 7/30/90-day/all-time chart, room selector, eggs/crates/production percentage where supportable, room comparison, and evidence-based farm intelligence.
3. **Feed** — usage, daily average, cost, cost/kg, stock/runway when available, trend chart, and a factual “What the data says” review panel.
4. **Health** — mortality, mortality rate/trend, health and vaccination activity, with non-diagnostic risk language.
5. **Finance** — daily/monthly/all-time controls, revenue, feed cost, other expenses, profit/margin, and real expense breakdown.
6. **Intelligence** — full-width synthesis of only supported production, feed, mortality, health, finance, abnormal-activity, and weather signals; no fake AI output or unsupported confidence claims.
7. **Take Action** — “Now imagine this for your farm,” Capture/Understand/Predict, Create Free Account, Request a Demo, and Return to PoultryPro.

### 3. Premium interactive experience
- Use the existing PoultryPro forest/gold/cream tokens, typography, logo/available poultry imagery, icons, and lightweight chart patterns.
- Add a concise command-centre header, historical/read-only badges, “Farm Health Today” cards, short “Why this matters” callouts, and restrained entrance transitions that respect reduced-motion settings.
- Replace autoplay/presentation controls with fixed stage navigation, direct section selection, Previous/Next, “Step X of 7,” and a thin progress indicator.
- Keep controls large and touchable, charts readable, KPI grids stacked on small screens, and prevent horizontal page overflow.

### 4. Loading, missing-data, and failure states
- Replace the old loader with “Preparing your farm intelligence…” and a subtle progress treatment.
- If the request fails, show “Demo data could not be loaded,” Retry Demo, and Return to PoultryPro.
- Never render zero as if it were a known measurement when the source is absent.
- Weather appears only when valid demonstration data exists; otherwise show the requested unavailable message.

## Technical approach
- Refactor the oversized presentation route into small presentation-only components and pure calculation helpers; do not import authenticated dashboard hooks that could request the current visitor’s farm.
- Reuse existing calculation conventions for production, feed, mortality, and finance while adapting them to the fixed aggregate demo response.
- Use lightweight SVG charts for quick loading and reliable rendering across desktop and mobile.
- Keep route-specific metadata unique and add the required social metadata fields without exposing a private image URL.

## Verification
- Check the fixed demo function cannot accept or derive a caller-supplied farm ID and remains read-only.
- Verify every displayed value against the demonstration response and every missing value against the unavailable state.
- Test the complete flow: Landing Page → Launch Live Demo → Overview → Production → Feed → Health → Finance → Intelligence → Take Action.
- Exercise period and room controls, direct stage navigation, Previous/Next, retry behavior, account/demo/home actions, and reduced-motion behavior.
- Test desktop (1280px), tablet, and phone widths, including iPhone safe areas, touch targets, chart readability, and no horizontal overflow.
- Confirm the authenticated farm application and its routes are unchanged and the preview build is healthy.

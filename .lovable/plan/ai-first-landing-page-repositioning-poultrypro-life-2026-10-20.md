# AI-First Landing Page Repositioning (poultrypro.life)

## Goal
Reposition the public homepage as an AI-powered poultry farm management and intelligence platform, while keeping every claim truthful about what is actually built. Record-keeping stays the foundation; the story becomes Capture → Understand → Predict → Recommend → Act.

## Truthfulness guardrails (unchanged, enforced in copy)
- Rule-based findings and record-based estimates are live; validated ML predictions and disease-outbreak prediction are NOT — label them as roadmap, never as live.
- Estimates are not guarantees; feed margin is not net profit; no invented accuracy, savings, or prediction counts.
- Action Centre is available to authorised farm users (owner confirmed 18 Oct).
- Testimonials keep exact wording, attributions and basis chips; no photos/ratings/logos.
- "Total Revenue Tracked" card and its live aggregation stay unchanged.
- Pricing, entitlements, auth, database, calculations: untouched.
- Nothing published without explicit approval.

## What changes (all in `src/routes/index.tsx` + landing components)

1. **Hero** — New headline "AI-Powered Intelligence for Smarter Poultry Farming." with the supplied supporting copy; CTAs "Get Started" (auth signup), "Explore AI Features" (anchor to intelligence section), "View Live Demo" where appropriate. Keep forest/cream/gold palette, poultry imagery, existing dashboard visual.

2. **Five-stage framework** — Update `farm-intelligence-journey.tsx` headlines to the supplied stage headlines ("Every Farm Record Starts a Better Decision." etc.) with per-stage CTAs that link only to real destinations (/dashboard, /presentation, /pricing, /alerts preview anchors). Keep honest limitation notes.

3. **New "More Than Farm Records. Intelligence for Better Decisions." section** — the product journey (data captured → analysed → findings surfaced → outcomes explored → farmer decides), using the existing Action Centre preview and real feature descriptions; roadmap items labelled as such.

4. **Benefits section** — six cards (Production, Feed & Cost, Flock Health & Mortality, Room-Level Performance, Predictive Insights, Practical Recommendations), each mapped to a real feature, no dead links.

5. **Dashboard showcase** — improve the existing product section annotations; no fabricated numbers.

6. **Live statistics** — unchanged data connection; add one line explaining that better data powers better insights. Revenue card label/explanation untouched.

7. **Pricing** — presentation copy only (which tools support records / analytics / predictive insights per existing entitlements); prices, limits, billing untouched.

8. **Farmer Stories** — keep approved testimonials verbatim; add the supplied "Ready to manage your farm smarter?" CTA block if missing.

9. **Founder / achievements** — frame PoultryPro as a Greenfield Contracts & Agro Limited innovation; keep NXTGEN 2026 recognition factual (no AI-accuracy implication).

10. **New "Responsible AI. Practical Farming. Human Decisions." trust section** — record quality, estimates ≠ guarantees, rules vs ML, no vet replacement, farmer control, link to /privacy.

11. **FAQ** — add the supplied AI-focused questions with honest answers (what's live vs in development).

12. **CTAs & footer** — consistent CTA set, all pointing to real routes (/auth, /presentation, /pricing, /academy, contact).

13. **SEO** — update index head() title/description/og around AI-powered poultry farm management; keep canonical https://poultrypro.life.

## Verification
- Grep pass for forbidden claims (guaranteed, diagnose, predicts disease, ML accuracy figures).
- Playwright: desktop 1280 + mobile 390 screenshots of every section; click every CTA to confirm a real destination.
- Existing tests (platform-revenue, platform-egg-value) re-run; build must be clean.

## Explicitly NOT done
- No schema, permission, pricing, or calculation changes. No new backend. No publishing.

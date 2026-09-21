# PoultryPro Academy video audit and UX upgrade

## Confirmed baseline

- Audit all **33 published, non-archived tutorials** across the eight live categories.
- All current published records use same-origin direct MP4 files; none currently use YouTube or Vimeo.
- Every record currently has a title, description, category, URL, thumbnail, duration, difficulty, and publish state; one is featured.
- All 33 video and thumbnail files exist. Media inspection confirms valid H.264 video streams; no audio streams were detected, so audio will be reported as not applicable rather than failed.
- The current page uses a bare native video element. It does not detect providers, show a reliable failure state, track partial progress, or expose Academy video health to administrators.

## Build

### 1. Provider-safe player
- Add a reusable Academy player that detects approved YouTube, Vimeo, direct MP4, and approved storage URLs without accepting arbitrary iframe markup.
- Keep playback click-to-play with no sound autoplay; use YouTube privacy-enhanced embeds when applicable.
- Present a stable 16:9 thumbnail-first frame with title, duration, central play control, loading state, native/provider controls, keyboard focus, and mobile-safe sizing.
- Handle load, decode, network, and embed failures with a clear “Video unavailable” panel, one bounded retry, and “Report video.”
- Track real playback state, pause/resume/seek behavior, and meaningful watch progress. Never complete a tutorial on page open; auto-complete only after at least 85% playback, while preserving manual completion.

### 2. Tutorial and Academy experience
- Upgrade tutorial pages with the requested metadata, “What you’ll learn” derived only from stored description/keywords, watch status, progress bar, previous/next navigation, and completion control.
- Improve the Academy home with a featured section sourced from `is_featured`, published-category sections, functional search across title/description/category/keywords/learning objectives, and explicit empty results.
- Show only categories containing published tutorials. Preserve authenticated recommendations and add truthful Continue Learning, Recently Watched, and Completed sections from existing learner activity/progress.
- Keep thumbnails lazy and defer all video/player loading until the tutorial opens and the learner clicks play.

### 3. Progress and health records
- Extend the existing Academy progress record rather than creating a second progress system, adding last watched time and playback percentage while retaining existing completion data and access rules.
- Add one narrowly scoped Academy video-health record per tutorial for provider, URL reachability, playback verification, status, reason, and last-checked time.
- Add a narrowly scoped learner video-report record so “Report video” reaches administrators without exposing technical details or farm data.
- Preserve current Academy access controls; only platform administrators may read/update health results, while signed-in learners may submit their own reports.

### 4. Admin Academy and validation
- Add an Academy area to the existing platform administration screen with tutorial health totals and a mobile-friendly list showing tutorial, category, provider, URL status, playback status, status, and last checked.
- Add safe create/edit controls for existing Academy content without deleting tutorials. Validate supported URLs before save and show clear valid/warning feedback.
- Provide an administrator-triggered browser playback check. A successful real media decode and advancing playhead may be marked Working; a URL-only check remains “URL reachable — playback not automatically verified” and cannot become PASS.
- Flag failed or incomplete tutorials for review rather than silently presenting them as healthy.
- Do not add a fake schedule. If no existing scheduler is available, document the manual health check and leave scheduled checks unclaimed.

### 5. Complete playback audit
- Test every published tutorial’s record, URL, thumbnail, metadata load, decoded dimensions, play, pause, resume, seek, sustained playback, refresh, and direct tutorial-page opening.
- Test all tutorials in desktop Chromium and phone-sized Chromium/Safari-compatible layouts; test Firefox/WebKit where the installed runtime supports their codecs.
- Test at least one tutorial per category under throttled connectivity and verify bounded retry messaging.
- Verify no player overflow on phone layouts. Record headless fullscreen and real-device-only audio behavior as NOT TESTED where the environment cannot prove them.
- Produce a truthful final report with totals, per-problem tutorial names, provider, issue, recommendation, browser/mobile limitations, and any checks that could not be technically verified.

## Safety and scope

- Do not delete or replace working tutorial media.
- Do not touch farm records, subscriptions, authentication architecture, roles, or core farm features.
- No service credentials or private storage URLs enter the browser.
- Changes remain limited to Academy presentation/progress/health/reporting and the existing platform-admin Academy area.

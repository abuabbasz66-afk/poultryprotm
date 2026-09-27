# Simplify PoultryPro mobile navigation

## Goal
Keep the existing desktop/tablet sidebar unchanged while making the bottom bar the only navigation control on phones.

## Changes
- Remove the phone hamburger trigger and its duplicate slide-out sidebar; retain the branded top bar, alerts, and sync status.
- Keep Home, Production, Feed, Health, and More in the bottom navigation.
- Build More directly from the existing `NAV_SECTIONS` structure and the same permission checks used by the desktop sidebar.
- Exclude destinations already represented by the four primary bottom items, while retaining their distinct child destinations.
- Deduplicate repeated destinations by route, search state, and page anchor so every remaining destination appears once.
- Preserve section grouping, existing labels, icons, routes, permission visibility, and Pro indicators.
- Add the sidebar's account actions to More, including Back to site and Sign out.
- Highlight each active destination and keep More active whenever the current location is not one of the four primary destinations.
- Make the More sheet fit small Android screens with safe-area spacing and close it after navigation or browser back.

## Validation
- Check mobile navigation at 384 × 680 and desktop sidebar behavior at a desktop viewport.
- Verify primary links, More opening/closing, a secondary destination, active states, browser back, and permission-filtered rendering.
- Confirm the latest app build succeeds.

## Technical details
- Reuse `NAV_SECTIONS`; do not introduce another route catalogue or change backend/authentication logic.
- Share location-matching and destination identity helpers between desktop and mobile navigation where practical.
- Existing destination-level subscription enforcement remains authoritative; the mobile menu will preserve the current `premium` metadata and access behavior.

# Replace desktop sidebar with horizontal navigation

## Build
- Replace the authenticated desktop sidebar with a sticky two-row header using the selected clean top-navigation direction.
- Keep PoultryPro branding and farm identity in the upper row, with notifications, sync status, farm access, profile/settings, and sign out on the right.
- Mark desktop-primary destinations in the existing `NAV_SECTIONS` catalogue; derive all top links and More entries from that same source.
- Show the existing high-use destinations directly: Dashboard as Home, Production, Feed Management as Feed, Health Records as Health, Analytics & Reports, and AI Insights.
- Put every other permitted destination and distinct child destination in a compact, grouped, keyboard-accessible More menu without duplicate route definitions.
- Preserve permission filtering, Pro labels, active route/search/hash matching, mobile bottom navigation, alerts, sync behavior, and all routes.
- Remove desktop sidebar state and content offset; do not alter dashboard content or any business/backend behavior.

## Responsive behavior
- Phones keep the current top branding strip and bottom navigation only.
- Tablet and desktop use the horizontal header from the existing large-screen breakpoint.
- Use two fixed header rows and constrained menu labels so common laptop widths do not wrap or overflow.

## Validation
- Verify all catalogue destinations are represented in either primary navigation or More for the signed-in role.
- Test desktop primary links, More open/close/selection, active states, profile/sign-out controls, alerts, sync status, browser back, and mobile navigation.
- Check common laptop and phone widths, type checking, focused lint, tests, and the production build signal.

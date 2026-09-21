# Fix phone notifications

## What will change
- Fix service-worker registration so it starts even when the installed app has already finished loading.
- Make test and farm alerts wait for an active notification worker instead of using the unreliable mobile page fallback.
- Show an accurate status when alerts cannot run, rather than claiming they are active from permission alone.

## Verification
- Confirm the production build includes the notification worker and click handler.
- Test registration and notification readiness in the browser, including the already-loaded app case.

# PoultryPro Security Hardening

I inspected the live backend first: all 58 data tables already have access rules switched on, farm isolation runs through the shared `can(farm, permission)` / farm-membership helpers, Paystack verification and webhook signature checks already happen server-side, receipts are in a private bucket with per-farm path rules, no secret keys exist in app code, and spreadsheet-formula protection is already in the export engine.

So this is targeted hardening on top of a mostly solid base — not a rebuild. Nothing existing gets replaced or removed.

## What actually needs fixing

**1. Ownership cannot be reassigned**
Today a user with farm settings permission can update the farm record, including the owner field. A database guard will freeze the owner and farm identity on update, so nobody can hand themselves ownership. Deleting a farm stays owner-only.

**2. Staff roster writes made explicit**
Staff changes already flow through checked server routines, but the roster table itself has no written rules for add/change/remove. I'll add explicit owner-and-staff-manager-only rules so the intent is enforced and visible, matching what the app already does.

**3. Every high-privilege routine re-verified**
Sweep all privileged database routines: confirm each one checks the caller, has a locked search path, and is callable only by the audience it needs. Anything callable more widely than necessary gets locked down.

**4. Cross-farm attack tests**
A repeatable test script that signs in as a real staff account and attempts the ten attacks you listed — read/insert/update/delete another farm's records, self-promotion to owner, staff reaching billing, viewer writing production, signed-out access, forged farm id, and a room id from another farm. Each must be refused. Results reported back to you.

**5. Two-factor authentication (optional, mandatory for platform admins)**
New Security area in Settings: enable authenticator-app 2FA, scan the code, confirm, and see status. Platform administrator accounts are required to complete 2FA before the admin console opens. Existing farmers are never locked out — for them it stays optional.

**6. Session security panel**
Same Security area: current device, browser, sign-in time, last active, plus "Sign out of all other devices". No tokens ever displayed or recorded.

**7. Security event logging completed**
The event log already exists. I'll extend it to the missing events: 2FA on/off, permission changes, member added/removed, access denied, export created, payment verified/failed, subscription changed, webhook received/rejected, admin actions. No passwords, tokens or card data recorded.

**8. Platform Security dashboard**
New Security tab in the admin console, admin-only: failed and successful sign-ins, permission-denied events, recent admin actions, payment verification and webhook failures, recent exports, role and membership changes, and admin 2FA status — with filters by farm, user, event, date and severity.

**9. Protective response headers**
Add standard browser protections (content type, referrer, frame and transport rules, a permissions policy) on served pages, tested so nothing in the app breaks. A content-security policy is applied in report-only form first so it can't silently break payments, maps or fonts.

**10. Safer error messages**
User-facing failures say "You don't have permission to do that" instead of surfacing database wording; full detail keeps going to the logs only.

**11. Abuse limits**
Throttle repeated sign-in, password reset, export, import and payment-verification attempts, tuned loosely enough that a farmer on a weak connection is never blocked.

## Already verified as sound (no change)

Paystack amounts and plans verified server-side with signature-checked, idempotent webhooks; secret keys server-only; exports authorised through the same permission rules as the app; receipts bucket private and path-scoped; import validation and formula-injection defence in place; admin console gated on a database-verified administrator check, not a hidden link.

## Note on backups

Backups are managed by the hosting platform. I'll document the recovery process in the project rather than claim a restore has been rehearsed.

## Suggested order

Phase A — items 1-4 (data isolation and attack testing)
Phase B — items 5-7 (2FA, sessions, logging)
Phase C — items 8-11 (admin dashboard, headers, errors, limits)

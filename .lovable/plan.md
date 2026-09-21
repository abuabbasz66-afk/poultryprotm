# PoultryPro Security Hardening

A review of the current setup first: the app is already in good shape in most of the areas the brief covers. Every farm table has row-level protection, roles and permissions already live in the database (not the browser), payments are verified server-side with signed webhooks, spreadsheet formula injection is already neutralised, exports already run through the signed-in user's own permissions, and the only file store (receipts) is private. So this is a hardening pass on real gaps, not a rebuild.

## What is already covered (no work needed)

- Farm-by-farm isolation: all 59 data tables enforce access rules in the database; farm identity is always derived server-side, never from the browser.
- Roles and permissions are data-driven (`farm_roles`, `role_permissions`, per-member overrides) and checked in the database.
- Paystack: server-side verification, plan price checked server-side, signed webhooks, secrets held outside the app code.
- Exports: run as the signed-in user with their own permissions; every export is written to an export audit log.
- Activity and security logging already exists (`security_events`, `admin_audit_log`, `platform_activity_log`, `export_audit_log`).
- Super-admin area is gated by a database role check, not a hidden link.
- Receipts storage bucket is private.
- No secrets in the app code or browser bundle.

## Gaps to fix

### 1. Weather cache table has no access rules
Protection is switched on but no rules exist, so nothing can read or write it through the data layer. Add an explicit read-only rule for signed-in users and keep writes server-side.

### 2. Staff roster write rules (flagged by the scanner)
Confirm and tighten who can add, edit, remove staff rows, and prevent farm ownership being reassigned through an update.

### 3. Database helper functions callable by anyone
53 internal helper functions are currently callable by any signed-in visitor. Audit each one and revoke access from everything that is not intentionally called by the app or used by the access rules.

### 4. Two-factor authentication (new)
- Add a Security area in account settings with authenticator-app two-factor sign-in: enrol with a QR code, verify, list and remove devices.
- Sign-in prompts for the 6-digit code when the account has it enabled.
- Required for PoultryPro platform administrators; optional for everyone else. No existing user is locked out.

### 5. Session security panel (new)
In the same Security area: current device, browser, last active and sign-in time, plus "Sign out of all other devices". No tokens shown or logged.

### 6. Security audit events (extend, not duplicate)
Keep the existing `security_events` table and add the missing event types: two-factor on/off, farm access denied, export created, payment verified/failed, subscription changed, webhook received/rejected, member added/removed. Wire the events that are currently unlogged.

### 7. Rate limiting on sensitive endpoints
Gentle, per-account limits on sign-in attempts, password reset, payment verification and export generation — tuned so farmers on unstable connections are never blocked.

### 8. Security headers
Add content, transport, referrer and frame protections at the server response level, then verify the whole app still works (charts, images, payments, maps).

### 9. Input validation at the server
Server-side checks on bird counts, quantities, prices, dates and uploaded/imported files: no negative counts, no impossible dates, size and type limits on uploads, structure checks on imported files.

### 10. Platform Security Dashboard (new admin page)
A new tab in the existing super-admin area, visible only to platform administrators:
- Overview: failed and successful sign-ins, permission denials, recent admin actions, payment verification failures, webhook failures, recent exports, active alerts.
- Audit log with filters by person, farm, event, date and severity.
- Sign-in security: recent failures, unusual events, two-factor status of administrators.
- Farm access: new members, role changes, permission changes, denials.
- Payment security: verification failures, duplicate attempts, webhook failures, subscription anomalies.
No secrets displayed.

### 11. Written recovery procedure
A short document covering backups, how a restore is performed, who is responsible, and what to check afterwards.

## Penetration tests before sign-off

Run against the live database with two real separate farm accounts and a staff account, confirming each is refused:
read/insert/update/delete another farm's records; a manager promoting themselves to owner; staff reading billing; a read-only member creating production records; a signed-out visitor reading farm records; a tampered farm id in a request; a room or flock id belonging to another farm; an export request for another farm.
Results reported back with pass/fail per test.

## Order of work

1. Database gaps (items 1-3) and the penetration tests.
2. Audit events, validation, rate limiting (6, 7, 9).
3. Two-factor and session security (4, 5).
4. Security dashboard (10), headers (8), recovery document (11).

## Technical notes

- All changes are additive migrations plus new UI; no table is replaced, no data migrated, no existing route or permission removed.
- Two-factor uses Supabase Auth's built-in TOTP factors (`mfa.enroll` / `challenge` / `verify`), so no custom secret storage.
- Rate limiting: Supabase Auth's own limits for sign-in and reset; a small counter table for export and payment verification endpoints.
- Security headers set in the server response handler, with a report-first content policy to avoid breaking charts, PDF generation or Paystack.
- The security dashboard reads through new security-definer reporting functions restricted to `is_super_admin()`, mirroring the existing admin functions.

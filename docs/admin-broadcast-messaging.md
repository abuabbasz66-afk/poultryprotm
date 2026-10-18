# Admin Broadcast Messaging Centre

## Delivered

The existing platform-admin sidebar now includes Broadcast Messages. Only the existing protected super-admin role is authorised; no new role or duplicate account system was created.

The centre provides registered/valid-phone totals, actual submission and delivery counts, optional wallet balance, composer, GSM-7/Unicode segment calculations, searchable 25-user pages, role and verified-number filters, consent exclusions, duplicate-number removal, saved drafts, explicit confirmation, history, paginated delivery reports and status audit events.

Essential service broadcasts exclude explicit SMS opt-outs; legacy accounts without a recorded choice are included with a warning only for lawful, provider-approved service communications. Promotional broadcasts require recorded SMS and marketing consent and include a settings link. Consent and registered phone are rechecked before submission; daily/weekly existing promotional caps are enforced. No consent choice is automatically changed.

## Changed files

- `src/routes/super-admin.tsx`: admin menu and tab integration, metadata.
- `src/components/engagement/admin-broadcast-tab.tsx`: overview, composer, audience, confirmation, history and reports.
- `src/lib/broadcast.functions.ts`: authenticated and role-checked operations.
- `src/lib/broadcast-provider.server.ts`: Termii fetch adapter, balance, delivery reconciliation and HMAC verification.
- `src/lib/broadcast-rules.ts`: public-safe validation, segmentation and status rules.
- `src/routes/api/public/sms-delivery.ts`: signature-protected delivery callback.
- `src/lib/broadcast-rules.test.ts`, `src/lib/broadcast-provider.test.ts`: deterministic and mocked-provider tests.
- `src/lib/broadcast-security.sql`: rollback-only database regression checks.
- `AGENTS.md`, `roadmap.md`: architecture guidance and completion tracking.

## Applied migrations and access

- `0015_admin_sms_broadcast_centre.sql`: campaigns, recipient queue, events; protected audience lookup and lifecycle functions.
- `0016_sms_broadcast_reporting_and_retry.sql`: overview/report aggregates, consent recheck and conservative retry.
- `0017_sms_queue_eligibility_hardening.sql`: eligibility checks and existing daily/weekly limits.
- `0018_sms_broadcast_least_privilege_grants.sql`: explicitly removes inherited anonymous/direct write access.

Each new table has RLS with super-admin SELECT only for authenticated users. Writes and internal queue functions are service-role-only; browser server functions first verify the caller through their authenticated `is_super_admin()` check. Ordinary users cannot read phone recipients, campaigns or audits. Application-generated credentials are not persisted. Existing farm records, prices and accounts were not changed.

## Provider setup required

Use secure server-side secrets, never chat or client code:

- `TERMII_API_KEY`: account API credential.
- `TERMII_BASE_URL`: account-specific HTTPS API origin from Termii (restricted to a Termii hostname).
- `TERMII_SENDER_ID`: approved 3–11 character sender ID identifying PoultryPro.
- `TERMII_WEBHOOK_SECRET`: signing secret agreed with Termii.
- `SMS_OWNER_USER_ID`: securely configured to the account explicitly designated by the owner; requires the existing protected super-admin role as well.
- `SMS_LIVE_ENABLED`: deprecated and ignored by the updated implementation; never use it to bypass owner activation.

Configure the Termii delivery callback as `https://poultrypro.life/api/public/sms-delivery` only after publishing approval. Confirm HMAC-SHA512 raw-payload signing and actual delivery payload with Termii before activation. Account wallet funding, current Nigeria rate card, sender approval and DND-route approval are required. Promotional messages use generic routes, never DND bypass; they pause outside 08:00–20:00 Lagos time. Service routing requires approved transactional use.

Pricing API not verified: estimated cost stays unavailable, never an invented price. Balance is optional and failures show unavailable, not zero.

Official references: https://developer.termii.com/messaging-api, https://developer.termii.com/events-and-reports, https://developer.termii.com/history, https://developer.termii.com/balance, https://developer.termii.com/sender-id, https://termii.com/pricing.

## Reliability and limitations

Queue rows are persisted and atomically claimed in batches of at most five. The administrator's page invokes bounded processing requests; closing/navigating away pauses continuation. Resume from delivery reports. An unattended worker has NOT been provisioned, avoiding new external scheduling credentials or permanent database polling.

Termii production bulk-array support and idempotency were not established. Single-recipient submissions avoid relying on an unverified bulk contract. Network timeout/5xx/unrecognised responses are `unknown`, never automatically retried. Only explicit rejected submissions without a provider reference may be retried after confirmation, capped at three attempts. Accepted, sent and delivered remain distinct; completed means processing finished, not delivery guaranteed.

Webhook updates deduplicate references/status, reject unsigned/altered payloads and do not regress delivered to accepted. Status reconciliation is manual, five references per check; production provider payload compatibility still needs verification. Detailed raw provider responses are intentionally not stored because they may contain credentials or private account data; report safe status/reason and reference only.

## Verification

- All automated tests pass, including SMS segmentation, normalisation, consent, retry limits, mocked acceptance/errors/timeouts, route selection, optional balance and HMAC verification.
- Database rollback checks: outsider role rejection, ordinary-user RLS isolation, no anonymous table access, no browser direct writes/claims, consent revocation, duplicate claim prevention, ambiguous retry prevention, deduplicated events and preserved delivered status.
- Signed-in owner preview: real eligible recipient list, saved draft, explicit confirmation with send disabled, read-back through history and delivery report/audit.
- Mobile and desktop checked; no horizontal overflow; unsigned public callback returns 401.
- No real SMS sent. One development-review draft remains as an honest unsent audit record. Temporary database tests rolled back.
- Real provider round-trip, wallet/pricing, sender/DND approval, authenticated non-admin UI and high-volume/load testing remain unverified. Provider credentials, owner sending approval and a suitable test recipient are needed before those checks.
- Automatic preview compilation and focused lint passed; no manual production build was run (the project harness runs compilation).

All website changes remain unpublished.

## Owner activation follow-up (2026-10-18)

Exact initial blocker: all four Termii settings were absent. The designated owner has now been configured securely, and the owner authorised one real test to their own registered number after verification. No test has been submitted and no bulk activation has been granted.

- `0020_sms_owner_activation_controls.sql` reuses `platform_settings` and `admin_audit_log`; no duplicate roles, accounts or farm tables. A guard rejects browser writes, including through the generic settings function. The transition is callable only with privileged server credentials after the server verifies the designated owner and existing admin role.
- `src/lib/broadcast-activation.server.ts` enforces owner/test/bulk permissions before confirmation, processing and each submission. Test campaigns must contain exactly one recipient: the owner's own eligible registered number, and service content only.
- `src/lib/broadcast-activation-rules.ts` and its tests enforce separate test/live gates, current configuration matching, route approval, receipt confirmation and 24-hour verification expiry.
- Owner controls verify wallet funding and an active Nigeria sender through documented read-only Termii endpoints, require an explicit transactional/DND approval acknowledgement, record test receipt separately, then allow explicit bulk activation or deactivation. API credentials never reach the browser.
- A credential/owner change invalidates prior approvals. One test campaign is reserved per verification configuration; a different test requires separate review rather than automatic resend. Delivery statuses are not changed by receipt confirmation or activation.
- Preview checks: owner controls visible, missing settings listed, verification/live activation blocked, Select All preserved, direct activation RPC and generic settings bypass attempts rejected. Focused lint and automatic compilation passed. Mocked provider and activation tests passed; no real provider round-trip is verified.

Still required: secure Termii API key, account API URL, approved sender ID and confirmed delivery-signing secret; funded wallet and transactional/DND approval; confirm callback payload; submit the approved owner test, confirm actual receipt, and separately approve live activation. The published callback returned 401 to an unsigned probe, confirming it is reachable and rejects unsigned traffic, not that signed provider delivery works. No publication was performed. Estimated cost remains unavailable without a verified rate source. The browser-driven queue is not an unattended worker.

Official current references: https://developers.termii.com/sender-id, https://developers.termii.com/balance, https://developers.termii.com/messaging-api, https://developers.termii.com/events-and-reports, https://developers.termii.com/history.
# Missing and Incomplete Features

This document is deliberately evidence-based. A database column or a visible control is not treated as an implemented feature unless the active UI and server behavior complete the workflow.

## 1. Settings page integration

The Settings page now loads the authenticated user (`GET /api/auth`), mosque (`GET /api/mosque`), and mosque-specific settings (`GET /api/settings`). The user, mosque, and settings tabs submit to working endpoints (`PUT /api/auth`, `PUT /api/mosque`, `PUT /api/settings`) and the page can reset configuration via `POST /api/settings/reset`.

The previous gap where `src/app/(app)/settings/page.js` initialized hard-coded state and exposed save buttons with no handlers has been addressed. A current password is also required for password changes, and the registration-strength rule is enforced on `PUT /api/auth`.

Remaining follow-up work:

- ensure persisted settings flags such as `requireApprovalForDistribution` and similar policy toggles are enforced in distribution/donation routes;
- decide how `customCriteria`, `povertyThresholdPerPerson`, and `svfWeightExponent` should affect scoring and allocation, since the current scoring model does not yet consume all stored fields;
- continue aligning the security profile workflows with audit and session-management expectations.

## 2. Formula editor and custom criteria

The runtime SVF calculation is hard-coded in `src/lib/svf.js`. `MosqueSettings` stores individual point columns and an `svfWeights` JSON override. Those recognized numeric overrides do change `computeSVF()` through `loadEffectiveWeights()`; this is parameter tuning, not an arbitrary formula editor.

`customCriteria` is stored through the settings API but is never read by scoring. `povertyThresholdPerPerson`, `svfWeightExponent`, `svfMaxScore`, and `autoCalculateSVF` are also stored but not used by the current SVF/allocation code. A future imam-configurable formula needs a safe, versioned rule model rather than evaluating text or JavaScript from the database. Integrate it at the weight/rule resolution boundary in `src/lib/svf.js`, validate it in `/api/settings`, snapshot its version on distributions if it affects financial decisions, and recalculate families transactionally or through a controlled job.

## 3. Security and account recovery

Missing or incomplete flows include:

- forgot-password and reset-password routes, signed/hashed expiring reset tokens, and email delivery;
- email verification, if email is intended to identify an operator;
- session inventory, refresh-token issuance, token rotation/revocation, and logout from all devices;
- login throttling/rate limiting, audit logging, and suspicious-login protections;
- role-based authorization for `ADMIN` versus `IMAM`.

The `RefreshToken`, `AuditLog`, `Notification`, and roles schema elements are foundations only. They are not actively used by the current login/session flows. The login page links to a route that does not exist.

## 4. Demo mode

There is no demo-mode boundary. Seed scripts create development sample data directly in the configured database, which must not be presented as safe exploration of production data. A real demo mode should use a separate database/tenant or resettable isolated workspace, clearly label the environment, prevent production side effects, and disable external integrations if later added.

## 5. Backup, export, and restore

Donor list export is implemented, but there is still no general mosque-scoped backup/export/restore workflow. The `backup-*` directories are source snapshots, not database backups. Needed capabilities include mosque-scoped CSV/Excel/PDF exports for core operational data, an auditable database backup format, attachment handling, authorization, encryption/retention policy, validation before restore, and a restoration process that cannot overwrite unrelated mosques.

## 6. Audit logs and notifications

The schema provides `AuditLog` and `Notification`, but no active route creates, lists, or marks these records. The topbar notification panel always renders an empty static message. At minimum, log financial changes, score/configuration changes, user/session events, actor, tenant, timestamps, and before/after values with access controls and immutable retention semantics.

## 7. Reports and analytics

Dashboard aggregates exist, but no report page, PDF generation, Excel export, scheduled report, or downloadable statistic is implemented. A reporting layer should reuse tenant-scoped source queries, specify accounting definitions (especially cash vs all payment methods), support filters/date ranges, and avoid treating client-side cards as a canonical report source.

## Additional incomplete areas

- Distribution approval policy is persisted but confirmation still immediately creates `COMPLETED` records.
- Payment status does not set `paidAt`, and cancelling an item does not restore or reallocate funds.
- Family document routes exist but have no discovered UI workflow; unbounded Base64-in-database storage needs a deliberate limit/storage policy.
- Donor deletion has no soft-delete alternative; it is blocked once donations exist.
- Legacy test suites exist under root (`test-full-suite.mjs`, `test-sync-suite.mjs`), but there is no configured `npm test` script, lint script, CI workflow, observability, health check, or error-monitoring integration in the active package configuration.

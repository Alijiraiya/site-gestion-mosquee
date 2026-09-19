# Known Issues and Technical Debt

## High-impact correctness and security

| Finding                                                                      | Evidence                                                                                                                           | Impact                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| JWT has a known fallback secret.                                             | `src/lib/auth.js` uses `dev-insecure-secret-change-me` when `JWT_SECRET` is absent.                                                | Unsafe if deployment configuration is missing.                                                  |
| Browser token mirroring weakens the cookie model.                            | `src/lib/apiClient.js` stores `charity_token` in local storage.                                                                    | Tokens are accessible to XSS; login/register currently do not consistently populate that state. |
| Refresh-token/session tables are unused.                                     | `RefreshToken` exists in schema but login/logout use a single JWT cookie only.                                                     | No token revocation, session management, or logout-all-devices.                                 |
| Approval and policy flags are not enforced.                                  | `requireApprovalForDistribution` and `allowAnonymousDonations` are persisted, but distribution/donation handlers do not read them. | UI/settings can misrepresent business policy.                                                   |
| Distribution cancellation/payment states have no financial settlement logic. | Item status updates only change `paymentStatus`; `paidAt` is never set.                                                            | Ledger meaning and actual disbursement can diverge.                                             |

## Functional gaps visible in the UI

- The login page links to `/forgot-password`, but no page or API route exists.
- Topbar notification panel is a static empty state despite the `Notification` model.
- Family document API routes have no discovered UI upload/list/download controls.
- Donation, donor, family, and member item APIs are more complete than their list screens; several edit/delete/detail operations are not exposed in the current UI.
- `GET /api/children/:childId` is not implemented; the item route supports only PUT/DELETE.

## Financial and data-model concerns

- `GET /api/dashboard/financial-summary` only counts `CASH` donations, while headline stats count all donations and `Mosque.balance` is updated for all payment methods. Its derived balance therefore is not the stored mosque balance for non-cash donations.
- Explicit allocations sent to `/api/distribution/confirm` are summed and checked against balance, but the handler does not validate duplicate IDs, amount finiteness/positivity, or that allocated total is within the submitted budget.
- `POST /api/distributions` only checks a family is linked to the mosque; unlike the simulator/confirm path, it does not require `Family.status === ACTIVE` and `MosqueFamily.isActive === true`.
- Family CCP is globally unique even though the data model supports links to multiple mosques. Confirm that global uniqueness is intended for the business domain.
- The schema supports a many-to-many mosque-family link, but the active UI has no workflow to share/link an existing family with another mosque.
- Documents store full Base64 payloads in a text column without source-level file-size/type validation, antivirus scanning, or storage lifecycle policy.

## Code organization and maintenance debt

- `src/app/components/ui/` is a large generated-style Radix component collection, while the authenticated application uses `src/components/ui.jsx` and custom CSS. Two UI systems increase styling and accessibility maintenance.
- `src/styles/` contains additional styles but the root layout imports `src/app/globals.css`; assess which files are active before extending styles.
- `backup-svf-*` and `backup-settings-icons-*` duplicate active files but are committed as top-level source snapshots. They are not imported by the active app and can confuse searches and reviews.
- `src/imports/LandingPage/index.tsx` is a very large imported design artifact; it and similarly duplicated public/imported assets should be audited before future landing-page work.
- The Settings page contains local-only state for values that have server equivalents, creating a second source of truth.
- `src/lib/recalc.js` deliberately contains compatibility fallback handling for databases missing settings columns. This is useful during migrations but can mask incomplete deployments; deployment must verify migration status.

## Quality and process gaps

- Test files exist under the repository root, but there is no configured `npm test` script, lint script, ESLint configuration, Prettier configuration, or CI workflow in the active package configuration.
- No active `TODO`/`FIXME` source comments were found in active application code; the main incomplete behavior is indicated by inactive controls/comments and absent routes rather than TODO markers.
- The code logs server errors with `console.error`/`console.warn`; there is no structured observability or error-reporting integration.
- API validation is uneven. Several routes validate enums and dates carefully, but donor updates, member field parsing, and manual distribution lines need more consistent validation.

Treat this document as a triage list. Reconfirm each issue against the branch being deployed, because this repository contains dated backup directories and uncommitted documentation files.

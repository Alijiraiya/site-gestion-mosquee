# API Reference

All APIs live below `/api`. Unless stated otherwise, routes require a valid JWT in the `token` HTTP-only cookie or an `Authorization: Bearer <token>` header. Success is `{ "success": true, "data": ... }`; expected failures are `{ "success": false, "message": "..." }`. All tenant-scoped routes use the authenticated user's mosque.

Common errors are `401` (missing/invalid/expired authentication), `400` (validation or no linked mosque), `404` (resource absent or not owned), `409` (duplicate/conflict), and `422` (business rule such as inadequate balance). A handler may still produce `500` for unexpected database/runtime failures.

## Authentication

| Method and route      | Auth | Request/query                                                                                               | Success data                              | Errors                     |
| --------------------- | ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| `POST /auth/register` | No   | `firstName`, `lastName`, `email`, `password` (8+ chars); optional `phone`, `mosque` object                  | user, optional mosque, token; sets cookie | `400`, `409`, `500`        |
| `GET /auth/login`     | No   | Query progression: no query → wilayas; `wilaya` → communes; `wilaya` + `commune` → mosques                  | location options                          | `500`                      |
| `POST /auth/login`    | No   | `mosqueId`, `password`                                                                                      | user, mosque, token; sets cookie          | `400`, `401`, `403`, `500` |
| `POST /auth/logout`   | No   | None                                                                                                        | logout message; expires cookie            | —                          |
| `GET /auth`           | Yes  | None                                                                                                        | safe current user and mosque              | `401`                      |
| `PUT /auth`           | Yes  | Any of `firstName`, `lastName`, `phone`, `email`; `password` changes require `currentPassword` and 8+ chars | updated safe user and mosque              | `400`, `401`, `409`        |
| `GET /mosque`         | Yes  | None                                                                                                        | current mosque profile                    | `401`, `404`               |
| `PUT /mosque`         | Yes  | `name`, `wilaya`, `commune`, `address`, `phone`, `email`, `description`                                     | updated mosque                            | `400`, `409`               |

`POST /auth/register` creates an `IMAM`. When its optional mosque has a name, it creates the mosque and its settings in the same transaction. The registration response contains a token, and client code currently mirrors it to local storage; applications consuming this API should treat the HTTP-only cookie as the authoritative session transport.

## Families, members, children, and documents

| Method and route                   | Request/query                                                                                                                                                             | Success data                          | Key errors/behavior                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /families`                    | `search`/`q`, `status` (`ACTIVE` default, `ALL` supported), `maxIncome`, `minSvf`, `priority`, `employmentStatus`, `maritalStatus`                                        | `{ families, count }`                 | Validates enum filters; lists active mosque links only.                               |
| `POST /families`                   | Required: `firstName`, `lastName`, `dateOfBirth`, `ccp`, `wilaya`, `address`, `maritalStatus`, `housingStatus`, `housingType`; optional income/health/count/member fields | `{ family }`                          | Computes SVF/priority, creates mosque link and HEAD member; duplicate CCP is `409`.   |
| `GET /families/:id`                | None                                                                                                                                                                      | `{ family }`                          | Includes this mosque's junction row.                                                  |
| `PUT /families/:id`                | Editable family fields, including household/status data                                                                                                                   | `{ family }`                          | Recomputes SVF/priority; keeps declared member count above required floor.            |
| `DELETE /families/:id`             | None                                                                                                                                                                      | archive message                       | Soft-deletes: `ARCHIVED` plus inactive mosque link.                                   |
| `GET /families/:id/members`        | Optional `role`                                                                                                                                                           | `{ members, count }`                  | Role must be a `FamilyMemberRole`.                                                    |
| `POST /families/:id/members`       | `firstName`, `role`; optional name/date/health/occupation/income                                                                                                          | `{ member, svfScore }`                | A second HEAD returns `409`; rescores family.                                         |
| `GET /members/:memberId`           | None                                                                                                                                                                      | `{ member }`                          | Decimal income is serialized as a number/null.                                        |
| `PUT /members/:memberId`           | Any member fields                                                                                                                                                         | `{ member, svfScore }`                | Role changes rescore the family.                                                      |
| `DELETE /members/:memberId`        | None                                                                                                                                                                      | message and `svfScore`                | Physical deletion; rescores family.                                                   |
| `GET /families/:id/children`       | None                                                                                                                                                                      | `{ children, count }`                 | Compatibility view of member rows whose role is `CHILD`.                              |
| `POST /families/:id/children`      | `firstName`; optional member fields                                                                                                                                       | `{ child, svfScore }`                 | Forces role to `CHILD`, ignoring submitted role.                                      |
| `GET /children/:childId`           | —                                                                                                                                                                         | —                                     | **Not implemented**: the item route exports only PUT and DELETE, so GET receives 405. |
| `PUT /children/:childId`           | Any child fields                                                                                                                                                          | `{ child, svfScore }`                 | Forces role to remain `CHILD`.                                                        |
| `DELETE /children/:childId`        | None                                                                                                                                                                      | message and `svfScore`                | Deletes only a member currently role `CHILD`.                                         |
| `GET /families/:id/children/count` | None                                                                                                                                                                      | `count`, `schoolCount`, `orphanCount` | `count` is live CHILD-row count; other values are Family aggregate fields.            |
| `GET /families/:id/documents`      | None                                                                                                                                                                      | `{ documents, count }`                | Omits base64 content.                                                                 |
| `POST /families/:id/documents`     | `originalName`, `contentBase64`; optional `storedName`, `mimeType`, `size`, `notes`                                                                                       | `{ document }`                        | Stores Base64 in PostgreSQL.                                                          |
| `GET /documents/:docId/download`   | None                                                                                                                                                                      | Raw bytes/download headers            | Does not use JSON success envelope.                                                   |
| `DELETE /documents/:docId`         | None                                                                                                                                                                      | deletion message                      | Deletes database document.                                                            |

The family collection sample:

```http
POST /api/families
Content-Type: application/json

{
  "firstName": "Amina", "lastName": "Benali", "dateOfBirth": "1980-06-12",
  "ccp": "0011223344", "wilaya": "Alger", "address": "Bab El Oued",
  "maritalStatus": "WIDOWED", "housingStatus": "TENANT", "housingType": "APARTMENT",
  "monthlyIncome": 8000, "incomeSources": ["SOCIAL_AID"]
}
```

returns `201` with `{ "success": true, "data": { "family": { "id": "...", "svfScore": 75, "priority": "URGENT", ... } } }`.

## Donors and donations

| Method and route                  | Request/query                                                                                                        | Success data                         | Key errors/behavior                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET /donors`                     | `search`/`q`, optional `donorType`                                                                                   | `{ donors, count }`                  | Search matches name, phone, email.                                                          |
| `POST /donors`                    | Required `name`; optional contact/address/type/notes                                                                 | `{ donor }`                          | Same name + matching phone/email returns `409`.                                             |
| `GET /donors/:donorId`            | None                                                                                                                 | `{ donor }` with 20 latest donations | `404` if not in mosque.                                                                     |
| `PUT /donors/:donorId`            | Any donor profile fields                                                                                             | `{ donor }`                          | Does not change total donated.                                                              |
| `DELETE /donors/:donorId`         | None                                                                                                                 | deletion message                     | Blocked `409` if donations exist; no donor soft-delete field.                               |
| `GET /donors/:donorId/donations`  | None                                                                                                                 | `{ donations, count }`               | Validates donor ownership.                                                                  |
| `POST /donors/:donorId/donations` | `amount`, `category`, `paymentMethod`; optional `notes`, `receivedAt`                                                | `{ donation }`                       | Creates named donation and updates donor total/balance transactionally.                     |
| `GET /donations`                  | `category`, `paymentMethod`, `donorId`, `from`, `to`                                                                 | `{ donations, count }`               | Invalid dates are ignored rather than sent to Prisma.                                       |
| `POST /donations`                 | Positive `amount`, valid `category`, valid `paymentMethod`; optional `donorId`, `isAnonymous`, `notes`, `receivedAt` | `{ donation }`                       | Missing donor ID or `isAnonymous: true` makes it anonymous; increments balance.             |
| `GET /donations/:id`              | None                                                                                                                 | `{ donation }` with donor            | `404` if unavailable/foreign.                                                               |
| `PUT /donations/:id`              | Any amount/category/method/notes/date/donor/anonymous fields                                                         | `{ donation }`                       | Corrects balance and donor aggregates in a transaction.                                     |
| `DELETE /donations/:id`           | None                                                                                                                 | deletion message                     | Blocked `422` when current balance is below the amount, preventing reversal of spent money. |

Example anonymous donation:

```json
POST /api/donations
{ "amount": 5000, "category": "SADAQAH", "paymentMethod": "CASH", "isAnonymous": true }
```

The response is `201` and contains the created donation in the standard envelope. Categories are `ZAKAT_MAL`, `ZAKAT_FITR`, `SADAQAH`, `KAFFARA`, or `OTHER`; payment methods are `CASH`, `CCP`, or `BANK_TRANSFER`.

## Distribution and dashboard

| Method and route                     | Request/query                                                                                  | Success data                                                          | Key errors/behavior                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /distribution/calculate`       | Positive `budget`/`totalBudget`; optional `familyIds`, `reserve`, `minAmt`, `maxAmt`           | Water-Filling preview                                                 | No write; uses settings reserve/minimum when absent; unsatisfiable allocation is `422`.                                                                    |
| `POST /distribution/confirm`         | `budget`; optional `title`, `notes`, `familyIds`, allocation `distributions`, `method`, bounds | `{ distribution }`                                                    | Creates completed distribution, items, stamps aid date, decrements balance. Explicit allocations default to `MANUAL`; calculation path uses Water-Filling. |
| `GET /distributions`                 | None                                                                                           | `{ distributions, count }` including family names                     | Newest first.                                                                                                                                              |
| `POST /distributions`                | `familyId`, positive `amount`; optional `title`, `notes`, `itemNote`                           | `{ distribution }`                                                    | One-family manual aid; immediately completed and reduces balance.                                                                                          |
| `GET /distributions/:id`             | None                                                                                           | `{ distribution }` and items/families                                 | —                                                                                                                                                          |
| `PUT /distributions/:id`             | Either `{ status, notes? }` or `{ itemId, paymentStatus }`                                     | updated distribution or item                                          | Statuses: DRAFT/APPROVED/COMPLETED/CANCELLED; payment: PENDING/PAID/CANCELLED.                                                                             |
| `DELETE /distributions/:id`          | None                                                                                           | restoration message                                                   | Deletes header/items and restores `totalDistributed` to balance.                                                                                           |
| `GET /dashboard/stats`               | None                                                                                           | family/child/donor/donation counts, received, distributed, balance    | Active linked families only.                                                                                                                               |
| `GET /dashboard/financial-summary`   | None                                                                                           | cash-only `totalIn`, total distribution `totalOut`, derived `balance` | `totalIn` excludes non-cash donations.                                                                                                                     |
| `GET /dashboard/monthly-summary`     | `months` (1–36; default 6)                                                                     | monthly received/distributed buckets                                  | Invalid input defaults to six.                                                                                                                             |
| `GET /dashboard/social-distribution` | None                                                                                           | counts by marital status and priority                                 | Active linked families only.                                                                                                                               |

## Settings

| Method and route       | Request/query                                                                                   | Success data                                                                         | Key behavior                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `GET /settings`        | None                                                                                            | settings row, effective/default SVF weights, customized flag, Water-Filling defaults | Lazily creates missing settings.                                                             |
| `PUT /settings`        | Recognized boolean, SVF point/threshold, distribution, `customCriteria`, or `svfWeights` fields | updated settings, effective weights, recalculated family count                       | Validates numbers, accepts reserve as fraction or percent, recalculates every linked family. |
| `POST /settings/reset` | Optional `scope`: `svf`, `water-filling`, `all`                                                 | defaults/weight data and recalc count                                                | Upserts then resets the requested settings.                                                  |

These settings APIs are consumed by the current Settings page; it loads and saves settings through the API.

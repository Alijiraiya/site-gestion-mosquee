# Developer Guide

This guide is the day-to-day setup and extension reference for the ZAKAT donation-management application. It is a Next.js 16 App Router application with React 19, PostgreSQL, Prisma 7, `next-intl`, and a mixed JavaScript/TypeScript codebase.

## Prerequisites

- Node.js 20 or later
- npm (the committed `package-lock.json` makes npm the expected package manager)
- A running PostgreSQL server and permission to create/use a database

## Install and configure

From the repository root:

```bash
npm install
```

The `postinstall` script runs `prisma generate`, creating the Prisma client in `src/app/generated/prisma/`. This directory is generated and git-ignored; do not edit or commit it.

Create a root `.env` file. Environment files are ignored by Git.

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/charity_db?schema=public"
JWT_SECRET="replace-with-a-long-unique-random-secret"

# Optional: overrides the development credentials produced by the main seed.
SEED_IMAM_EMAIL="imam@mosque.dz"
SEED_IMAM_PASSWORD="imam1234"
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma, the `pg` connection pool, migrations, and seeds. |
| `JWT_SECRET` | Yes in every non-local environment | Signs seven-day authentication JWTs. The code has an insecure development fallback; never rely on that fallback outside local development. |
| `SEED_IMAM_EMAIL` | No | Email for the imam created or activated by `prisma/seed.js`. Defaults to `imam@mosque.dz`. |
| `SEED_IMAM_PASSWORD` | No | Password for that seed account. Defaults to `imam1234`; set a non-default value before seeding a shared database. |

## Database setup

1. Create an empty PostgreSQL database, for example `charity_db`.
2. Put its connection string in `.env` as `DATABASE_URL`.
3. Generate the current client and apply the tracked migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Or use the project shortcut, which creates and applies a development migration when the schema has changed:

```bash
npm run db:migrate
```

For an existing production database, use the deployment-safe command instead of `migrate dev`:

```bash
npx prisma migrate deploy
```

The app connects through Prisma's PostgreSQL adapter in `src/lib/prisma.js`. All application data belongs to a mosque, so registration or seeding must create both a user and a mosque before authenticated business routes will work.

### Prisma commands

| Command | Use |
| --- | --- |
| `npx prisma generate` | Regenerate the client after schema changes. |
| `npm run db:migrate` | Create/apply a development migration (`prisma migrate dev`). |
| `npx prisma migrate dev --name <description>` | Create a clearly named migration after editing `prisma/schema.prisma`. |
| `npx prisma migrate deploy` | Apply existing migrations in CI/production. |
| `npm run db:reset` | Drop, recreate, migrate, and seed the configured development database. **Destructive.** |
| `npm run db:seed` | Run the configured main seed. |
| `npm run db:studio` | Open Prisma Studio for the configured database. |
| `npx prisma format` | Format `prisma/schema.prisma`. |
| `npx prisma validate` | Validate the Prisma schema and datasource configuration. |

### Seed commands

The configured seed is `prisma/seed.js`:

```bash
npm run db:seed
```

It is safe to rerun: it upserts a default mosque, active imam, settings, a donor, a donation, a family, its mosque link, and a family member. It prints the actual seed login credentials. The sample data must only be used in local/development databases.

To add four additional test families after the main seed:

```bash
npx tsx prisma/seed-families.js
```

This second script requires a mosque to already exist and is also idempotent through each family's unique CCP value.

## Run, build, and quality checks

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000`, register at `/register`, then sign in at `/login`. The authenticated application is under the `(app)` route group, which produces URLs such as `/dashboard`, `/familles`, `/dons`, `/donateurs`, `/distributions`, and `/settings`.

Create and serve a production build:

```bash
npm run build
npm run start
```

`npm run build` runs `prisma generate && next build`, so it verifies both Prisma client generation and the Next.js production compilation.

### Linting

There is currently **no `lint` npm script and no ESLint/Prettier configuration** in this repository. Do not document or depend on `npm run lint` until the project adds that tooling.

Before opening a change, use the checks that do exist:

```bash
npx prisma format
npx prisma validate
npm run build
```

If the team adds ESLint, install/configure it explicitly and then add a `lint` script to `package.json`; do not assume a Next.js lint command is available.

## Common troubleshooting

| Symptom | Likely cause and resolution |
| --- | --- |
| `Cannot find module '@/app/generated/prisma/client'` or Prisma types are missing | Run `npx prisma generate`. It normally runs after `npm install`, but must be rerun after schema changes or after deleting generated files. |
| Prisma cannot connect, or reports an invalid datasource URL | Verify `DATABASE_URL`, PostgreSQL availability, database name, credentials, port, and `?schema=public`. Then run `npx prisma validate`. |
| Tables are missing or Prisma schema and database disagree | For local development, run `npx prisma migrate dev`. For production, commit the migration and run `npx prisma migrate deploy`. Do not use `db:reset` on valuable data. |
| `No mosque is linked to this account` from an API route | Register an imam with mosque details, or run the main seed. Most routes scope data using the authenticated user's mosque. |
| Login fails after seeding | Use the credentials printed by the seed; check `SEED_IMAM_EMAIL` and `SEED_IMAM_PASSWORD`. The account must be active, which the main seed ensures. |
| `Invalid or expired session` / repeated redirect to login | Clear the `token` cookie and `charity_*` browser local-storage entries, verify that the same `JWT_SECRET` is used by the server, and log in again. JWTs expire after seven days. |
| New translation does not appear | Add the same key to both `src/messages/fr.json` and `src/messages/ar.json`, use the matching namespace, then refresh the route. The selected locale is in the `locale` cookie. |
| Arabic layout is incorrectly aligned | Use CSS logical properties (`margin-inline-start`, `padding-inline`, etc.) and test with the `ar` locale. The root layout sets `dir="rtl"` for Arabic. |
| A newly added API route returns 401 | Call `getAuth(request)` and send the request through `api` from `src/lib/apiClient.js`, which includes cookies and its Bearer-token fallback. |
| `npm run build` fails only on a clean machine | Reinstall dependencies with `npm install`, ensure `.env` contains the required values, run `npx prisma generate`, then retry. |

## Add a new API endpoint

Route handlers live in `src/app/api`. Folder names become URL segments; a `route.js` file exports named HTTP-method functions.

For example, an authenticated mosque-scoped collection endpoint at `GET/POST /api/example` belongs in `src/app/api/example/route.js`:

```js
import { prisma } from "@/lib/prisma";
import { ok, created, fail, readJson } from "@/lib/apiResponse";
import { getAuth } from "@/lib/auth";

export async function GET(request) {
  const { mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const records = await prisma.example.findMany({
    where: { mosqueId: mosque.id },
    orderBy: { createdAt: "desc" },
  });
  return ok({ records, count: records.length });
}

export async function POST(request) {
  const { user, mosque, error } = await getAuth(request);
  if (error) return error;
  if (!mosque) return fail("No mosque is linked to this account.", 400);

  const [body, bodyError] = await readJson(request);
  if (bodyError) return bodyError;
  if (!body.name?.trim()) return fail("name is required.");

  const record = await prisma.example.create({
    data: { mosqueId: mosque.id, name: body.name.trim(), createdById: user.id },
  });
  return created({ record });
}
```

Follow these project rules:

1. Authenticate private endpoints with `getAuth(request)` before accessing data.
2. Enforce tenant ownership in **every** read, update, and delete (`where: { id, mosqueId: mosque.id }`, or an equivalent relation filter). Never trust a client-supplied mosque ID.
3. Parse JSON using `readJson`; validate required values, enums, numbers, and dates before calling Prisma. Return `fail(message, status)` for expected errors.
4. Return `ok(data)` for success and `created(data)` for creation. The standard response envelopes are `{ success: true, data }` and `{ success: false, message }`.
5. Use `prisma.$transaction` when one operation changes related financial or aggregate data, as donation creation does for donation, donor total, and mosque balance.
6. Put an item route at `src/app/api/example/[id]/route.js`; in Next.js 16 access it with `const { id } = await params`.
7. Call the route from client code with `api.get`, `api.post`, `api.put`, or `api.del` in `src/lib/apiClient.js`, not ad hoc `fetch`, unless there is a specific reason.

## Add a new page

This application uses the Next.js App Router.

- A public route such as `/about` is `src/app/about/page.js`.
- An authenticated route such as `/reports` is `src/app/(app)/reports/page.js`. The parentheses create a route group, so `(app)` is not part of the URL; its layout supplies the sidebar, toast provider, and client-side auth redirect.
- Dynamic pages follow the same convention, for example `src/app/(app)/families/[id]/page.js`.

Most existing application pages are client components because they load data and handle filters, modals, and form state. Start the file with `"use client"` only when it needs browser APIs, React hooks, or interaction. Keep static/server-capable work in a server component when possible.

Recommended page shape:

```jsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { Loading, EmptyState, ErrorState } from "@/components/ui";
import { api } from "@/lib/apiClient";
import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const t = useTranslations("Reports");
  const [state, setState] = useState({ loading: true, error: "" });
  const [reports, setReports] = useState([]);

  const load = useCallback(async () => {
    try {
      setState({ loading: true, error: "" });
      const data = await api.get("/reports");
      setReports(data.reports || []);
      setState({ loading: false, error: "" });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Topbar title={t("title")} subtitle={t("subtitle")} />
      <div className="content">
        {state.loading ? <Loading /> : state.error ? <ErrorState label={state.error} /> : reports.length === 0 ? <EmptyState label={t("empty")} /> : null}
      </div>
    </>
  );
}
```

Add the navigation entry in `src/components/Sidebar.jsx` when the page should be discoverable from the app. Reuse existing shared UI, `Topbar`, icon names, CSS classes, `format` helpers, loading/empty/error states, and translations rather than creating competing patterns. Test the page in French, Arabic/RTL, and light/dark themes.

## Add a new database model

1. Update `prisma/schema.prisma`. Use a `cuid()` primary key, `createdAt`/`updatedAt` where appropriate, explicit relations, meaningful `onDelete` behavior, and indexes for tenant keys and common filters.
2. If the record is tenant-owned, include `mosqueId` and its `Mosque` relation. The database model alone does not guarantee tenant isolation; API queries must still scope access by mosque.
3. Choose `Decimal @db.Decimal(14, 2)` for monetary values; do not use JavaScript floating-point fields for money. Add enum values only when their lifecycle is stable.
4. Format, validate, create a migration, and regenerate the client:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name add_example
npx prisma generate
```

5. Update any seed data that needs the model, add the API/UI integration, and run `npm run build`.

Do not manually edit files under `src/app/generated/prisma/`. They are produced from the schema. Be especially careful with a migration that deletes a column or tightens a required field: backfill real data in the migration first and review the generated SQL before applying it to shared environments.

## Add a new translation

`next-intl` loads messages from `src/messages/fr.json` and `src/messages/ar.json`. The locale is cookie-driven (`fr` or `ar`) and `src/i18n/request.ts` merges those files with the legacy `App` dictionary in `src/lib/i18n.js`.

1. Add the same nested key and compatible placeholders to **both** JSON files. For a new page, use a dedicated namespace:

```json
{
  "Reports": {
    "title": "Rapports",
    "subtitle": "Suivez les indicateurs",
    "empty": "Aucun rapport disponible"
  }
}
```

2. Add the Arabic equivalents at the same path in `ar.json`.
3. In a client component, read the namespace with `const t = useTranslations("Reports")` and render `t("title")`. In server-aware code, use the matching `next-intl` server API as appropriate.
4. For existing authenticated screens that call `useTranslations("App")`, add literal keys to the `AR`/`appMessages` mapping in `src/lib/i18n.js` when that is the established namespace for the component.
5. Never use a dot in a flat `App` message key; `next-intl` treats dots as namespace separators. Check existence with `t.has(key)` before invoking an optional key, because `t(key) || fallback` cannot recover from a missing-key error.
6. Toggle the language in the UI and verify both text and RTL layout.

## Coding conventions used here

- **Imports:** use the `@/` alias for `src` imports. Prefer named imports and keep local dependencies grouped at the top.
- **Languages:** the application is primarily `.js`/`.jsx`, with selected `.ts`/`.tsx` modules and generated Prisma output. Match the surrounding module rather than converting unrelated files.
- **Components:** function components with PascalCase names; client components explicitly start with `"use client"`. Use `useCallback` for functions referenced by effects and model async UI state as loading/error/data.
- **Routes:** export named `GET`, `POST`, `PUT`, and `DELETE` handlers. Use `ok`, `created`, `fail`, and `readJson` from `src/lib/apiResponse.js` for a consistent API contract.
- **Security and tenancy:** obtain identity through `getAuth`; never expose `passwordHash`; always scope business data to the current mosque. The role enum exists, but route-level authorization is not centralized, so add explicit role checks when implementing administrator-only functionality.
- **Data validation:** validate external input before Prisma. Convert Decimal fields deliberately for JSON responses using `Number`/the `num` helper where needed. Treat dates and enum values as untrusted input.
- **Money:** use Algerian dinars (DA) and schema Decimal fields. Use the formatting helpers in `src/lib/format.js` for display.
- **Styling:** reuse project CSS classes and the components in `src/components/ui.jsx` or `src/app/components/ui`. Prefer CSS logical properties so French LTR and Arabic RTL work without duplicate rules.
- **i18n and accessibility:** user-facing strings belong in translations, controls should have descriptive labels/titles, and new UI must work in `fr` and `ar`, dark and light themes.
- **Comments:** comments explain non-obvious business constraints or correctness decisions (for example, tenant ownership, transaction boundaries, and SVF invariants), not line-by-line syntax.
- **Generated and backup content:** do not edit generated Prisma client files. Treat `backup-*` directories as historical snapshots, not active source.

## Suggested pre-handoff check

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run build
git status --short
```

For database changes, also confirm the new migration is present under `prisma/migrations/`, has been reviewed, and is included in the change.

# Project Structure

The source tree separates routing, reusable interface elements, domain logic, data schema, and translated content. This keeps pages focused on interaction and makes server-side rules reusable by multiple APIs.

| Location | Why it exists |
| --- | --- |
| `src/app/` | App Router pages, layouts, global CSS, and all HTTP route handlers. This is the framework entry point. |
| `src/app/(app)/` | Authenticated screens sharing a sidebar/auth-check layout without adding `(app)` to URLs. |
| `src/app/api/` | Backend route handlers grouped by resource: auth, families, donors, donations, distributions, dashboard, documents, and settings. |
| `src/app/components/home/` | Landing-page-specific components; kept separate from the management application UI. |
| `src/app/components/ui/` | Generated/primitive Radix-style UI components used by the landing design. |
| `src/components/` | Reusable management UI: sidebar, topbar, charts, modals, icons, notifications, and shared UI helpers. |
| `src/components/forms/` | Domain form modals for families, members, donors, and donations. |
| `src/lib/` | Cross-cutting helpers and business rules: auth, Prisma, API client/response, SVF, Water-Filling, recalculation, formatting, i18n, theme. |
| `src/i18n/` | `next-intl` request configuration and locale policy. |
| `src/messages/` | French and Arabic nested translation catalogs. |
| `src/styles/` | Additional style sheets and font declarations. Global app styles are imported from `src/app/globals.css`. |
| `src/imports/LandingPage/` | Imported landing-page imagery and SVG path data. |
| `public/` | Static assets served directly by Next.js, including images and local fonts. |
| `prisma/` | Prisma schema, ordered migration history, and idempotent development seed scripts. |
| `docs/` | Team-facing technical documentation; this folder intentionally keeps topics separate. |
| `backup-*/` | Historical snapshots. They are not active source and should not be imported into new work. |

## Routing conventions

```text
src/app/page.js                         -> /
src/app/login/page.js                   -> /login
src/app/(app)/dashboard/page.js         -> /dashboard
src/app/api/donations/route.js          -> /api/donations
src/app/api/donations/[id]/route.js     -> /api/donations/:id
```

The `@/*` import alias maps to `src/*`, as defined in `jsconfig.json` and `tsconfig.json`. Use it for internal imports rather than long relative paths.

## Generated content

The Prisma client is generated into `src/app/generated/prisma/` from `prisma/schema.prisma`. It is ignored by Git and recreated by `prisma generate` (also run by `postinstall` and `npm run build`). Do not hand-edit it.

## Configuration files

- `package.json`: scripts and dependencies. There is no configured lint script.
- `prisma.config.ts`: schema location, migration directory, seed command, and `DATABASE_URL` loading.
- `next.config.mjs`: wraps Next configuration with the `next-intl` plugin.
- `postcss.config.mjs`: Tailwind/PostCSS integration.
- `next.config.mjs`, `jsconfig.json`, and `tsconfig.json`: framework, import alias, and TypeScript settings.

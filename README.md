# ZAKAT — Donation Management System

A multi-tenant web platform that lets a mosque manage its donors, donations and
beneficiary families, score each family's social vulnerability, and distribute a
donation pool fairly and automatically.

Built with Next.js 16 (App Router), React 19, Prisma 7 and PostgreSQL.
Fully bilingual — French and Arabic with RTL — and available in dark and light
themes.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix UI primitives, Recharts |
| Backend | Next.js Route Handlers |
| ORM | Prisma 7.8 with the `@prisma/adapter-pg` driver adapter |
| Database | PostgreSQL |
| Auth | `jsonwebtoken` access tokens, `bcryptjs` hashing, DB-backed refresh tokens |
| i18n | `next-intl` with a cookie-driven locale |
| Language | JavaScript with selected TypeScript modules |

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A running PostgreSQL instance

### Installation

```bash
git clone <repository-url>
cd Donation_Management _Web_App
npm install
```

`npm install` runs `prisma generate` automatically via the `postinstall` hook.

### Database setup

Create a `.env` file (see the next section), then apply the migrations:

```bash
npm run db:migrate
```

Optionally load demo data:

```bash
npm run db:seed
```

### Run

```bash
npm run dev
```

Open <http://localhost:3000>. Register a mosque from `/register`, then sign in
at `/login`.

---

## Environment variables

Create `.env` at the project root. It is git-ignored.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret used to sign access tokens |

Example:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/charity_db?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
```

---

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | `prisma generate` then a production build |
| `npm run start` | Serve the production build |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:reset` | Drop, recreate and re-seed the database |
| `npm run db:seed` | Run the seed script |
| `npm run db:studio` | Open Prisma Studio |

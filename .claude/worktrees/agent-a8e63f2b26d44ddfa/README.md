# Magazine Site

Modular monolith for a digital magazine/news publishing platform.

- `apps/web` — public reader-facing site (port 3000)
- `apps/editor` — private editorial application (port 3001)
- `packages/config` — shared server-side environment validation
- `packages/domain` — domain constants and pure invariants
- `packages/db` — Drizzle schema, PostgreSQL client, and SQL migrations

## Prerequisites

- Node.js `24.19.0` (see `.nvmrc`; `>=24.19.0 <25`)
- pnpm `11.22.0` (see `packageManager`; `>=11 <12`)
- PostgreSQL 16 or newer

## Install

```bash
pnpm install
```

## Environment

Copy `.env.example` to each application:

- `apps/web/.env.local`
- `apps/editor/.env.local`

`DATABASE_URL` is server-only and is required only when connecting to PostgreSQL
or applying migrations. It is not required for lint, typecheck, or production
build.

Do not commit `.env.local` files. Never prefix secrets with `NEXT_PUBLIC_`.

## Commands

```bash
pnpm dev          # web :3000 and editor :3001
pnpm dev:web      # http://localhost:3000
pnpm dev:editor   # http://localhost:3001
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`lint`, `typecheck`, and `build` fail if any included workspace fails.

## Database

PostgreSQL 16+ and Drizzle (`pg` driver). Workflow:

```bash
pnpm db:generate  # generate reviewed SQL from the TypeScript schema
pnpm db:check     # migration journal/snapshot consistency
pnpm db:migrate   # apply committed migrations to DATABASE_URL
```

Do not use `drizzle-kit push`. Generated SQL is the production migration path.
Do not apply migrations without an explicit target and approval.

Editor application authentication uses opaque server-side sessions.
There is no committed staff password or bootstrap user in this repository.

## Initial Staff Provisioning

Create the first staff account for an empty installation with:

```bash
pnpm staff:bootstrap
```

The command uses `DATABASE_URL`, shows only the target host/database, prompts for
email, display name, and a hidden password, then creates the initial
`SUPER_ADMIN` staff user with `ALL` scope. It refuses to run after any staff user
already exists.

For non-interactive operations, pass explicit metadata and pipe the password from
a secure stdin provider:

```bash
<password producer> | pnpm staff:bootstrap --email <email> --display-name '<name>' --password-stdin --yes
```

No default credential is committed or generated automatically. The command does
not handle subsequent staff administration, password resets, MFA enrollment, or
staff management UI.

## Health

- Web: `GET /api/health`
- Editor: `GET /api/health`

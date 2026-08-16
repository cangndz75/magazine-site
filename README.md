# Magazine Site

Modular monolith for a digital magazine/news publishing platform.

- `apps/web` — public reader-facing site (port 3000)
- `apps/editor` — private editorial application (port 3001)
- `packages/config` — shared server-side environment validation

## Prerequisites

- Node.js `24.19.0` (see `.nvmrc`; `>=24.19.0 <25`)
- pnpm `11.22.0` (see `packageManager`; `>=11 <12`)

## Install

```bash
pnpm install
```

## Environment

Copy `.env.example` to each application:

- `apps/web/.env.local`
- `apps/editor/.env.local`

Do not commit `.env.local` files. Never prefix secrets with `NEXT_PUBLIC_`.

## Commands

```bash
pnpm dev          # web :3000 and editor :3001
pnpm dev:web      # http://localhost:3000
pnpm dev:editor   # http://localhost:3001
pnpm lint
pnpm typecheck
pnpm build
```

`lint`, `typecheck`, and `build` fail if any included workspace fails.

## Health

- Web: `GET /api/health`
- Editor: `GET /api/health`

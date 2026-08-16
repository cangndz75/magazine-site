# Magazine Site - Engineering Rules

## Project Goal

This repository contains a professional digital magazine/news publishing platform.

The product must prioritize:
- reliability
- editorial speed
- security
- maintainability
- SEO correctness
- performance
- data integrity
- production readiness

Do not trade these qualities for short-term implementation speed.

## Core Stack

- Next.js 16.3.1
- React 19
- TypeScript
- App Router
- Tailwind CSS 4
- pnpm workspace
- PostgreSQL 16+
- Type-safe ORM
- Cloudflare
- Object storage / image CDN

## Repository Architecture

This is a modular monolith.

Expected structure:

- apps/web: public reader-facing website
- apps/editor: private editorial/admin application
- packages/db: database schema and DB access
- packages/domain: shared domain logic and invariants
- packages/ui: shared controlled UI primitives
- packages/config: shared configuration

Do not introduce microservices, Kafka, Kubernetes, Elasticsearch, Redis, or separate queue infrastructure without an explicit architectural decision.

## Content Architecture

ContentItem is the identity/lifecycle container.

ContentVersion contains the editable and publishable content.

Public readers must only read the version referenced by publishedVersionId.

Editing a draft must never mutate the currently published version.

ContentItem publication state:

- NEVER_PUBLISHED
- PUBLISHED
- UNPUBLISHED

ContentVersion editorial workflow state:

- DRAFT
- IN_REVIEW
- APPROVED

Publication state and editorial workflow state must remain separate.

A ContentItem may simultaneously have:
- a published version
- a draft version
- a scheduled version

## Scheduled Publishing

Scheduled publishing uses:

- scheduledVersionId
- scheduledAt
- scheduleGeneration

Scheduled jobs carry:
- contentItemId
- scheduleGeneration

Every schedule, reschedule, and unschedule operation increments scheduleGeneration.

A job whose generation does not equal the current ContentItem.scheduleGeneration must perform a NOOP.

Never publish a different version from scheduledVersionId.

## Versioned Relations

Content relations that affect public output belong to ContentVersion.

Examples:
- categories
- tags
- entities
- media
- authors
- sponsorship

Draft changes to these relations must not leak into the published version.

Exactly one primary category is required for a publishable version.

## Editor and Homepage Rules

Normal articles use controlled predefined article-detail templates.

Special editorial stories may use explicitly supported alternative templates.

Do not implement arbitrary free-form page building for article detail pages.

Homepage layout/block management is restricted to Super Admin.

This restriction must be enforced server-side.
Hiding UI controls is not sufficient authorization.

## Rich Content

Article bodies use structured block JSON.

Do not allow arbitrary raw HTML, JavaScript, iframe, or script blocks from editors.

Media must go through the controlled media pipeline.

## Security

Security decisions must be enforced on the server.

The editor application will use:
- separate editor hostname
- Cloudflare Access perimeter
- application authentication
- MFA
- RBAC/scope authorization
- server-side sessions

Never rely on:
- hidden URLs
- client-side role checks
- disabled buttons
- obscurity

for authorization.

Do not expose admin/editor functionality from the public application.

## SEO and Publishing

SEO is part of the domain, not a UI afterthought.

Preserve support for:
- canonical URLs
- robots directives
- structured data
- slug history
- redirects
- sitemap
- News sitemap
- RSS
- datePublished
- public dateModified
- author/publisher transparency
- correction/retraction notices

Do not update public dateModified for autosaves or non-material draft edits.

Google News/Discover readiness must never be described as a traffic or acceptance guarantee.

## Performance

Avoid unnecessary client components.

Prefer server components unless browser interaction requires otherwise.

Images must use the controlled image pipeline.

Ad slots must reserve layout space to avoid CLS.

Do not introduce dependencies casually.

## Database and Migrations

Database migrations are immutable after they have been executed in a shared environment.

Never silently edit an already-applied migration.

Use explicit migrations for schema changes.

Critical publication operations must be transactional.

Domain invariants belong in service/domain code and should be backed by database constraints where practical.

## Testing

Critical paths require tests.

High-priority areas:
- draft/published isolation
- publishing
- approval workflow
- scheduling/rescheduling
- stale job protection
- authorization
- rollback
- redirects
- cache invalidation
- primary category invariant

Before considering a task complete, run the relevant:
- lint
- type checks
- tests
- production build

Do not claim success when verification was skipped.

## UI Principles

The public visual direction is premium magazine/editorial.

Avoid:
- generic dashboard aesthetics on public pages
- excessive borders
- excessive accent color
- card grids with no editorial hierarchy
- desktop UI simply shrunk for mobile

Use hierarchy, typography, spacing, imagery and controlled accent color.

Editorial/admin UX should minimize unnecessary clicks.

Power must not create complexity for normal editors.

Advanced controls should stay contextual or progressive.

## Encoding

All source, config, Markdown, JSON and text files must be UTF-8.

Do not create source files using an encoding that can produce invalid UTF-8.

## Scope Discipline

Do not invent features outside the approved scope.

Do not perform broad refactors unrelated to the requested task.

Do not replace established architecture without explaining the reason and impact first.

Prefer the simplest architecture that satisfies the production requirement.

## Working Method

Before modifying code:
1. Inspect the relevant existing implementation.
2. Understand current behavior.
3. Identify affected domain invariants.
4. Make the smallest coherent change.
5. Verify it.
6. Report exactly what changed and what remains unverified.
# Backup / Restore / DR Runbook

This is the Pass A foundation for PostgreSQL backups and media inventory.

It does not implement scheduled backups, cloud-vendor backup integration, or
automatic production restore.

## Operational Targets

- RPO target: configure with `BACKUP_RPO_TARGET`.
- RTO target: configure with `BACKUP_RTO_TARGET`.

These are targets for operations planning. Pass A does not guarantee either
target.

## Backup

Prerequisites:

- `pg_dump` is installed and available on `PATH`.
- `pg_dump` major version matches the PostgreSQL server major version when
  possible. Newer clients can emit restore-time settings older servers do not
  recognize.
- `DATABASE_URL` points at the intended PostgreSQL source.
- The output directory is explicit and outside Git-tracked source.

Command:

```sh
pnpm backup:db -- --output-dir backups/local
```

The command writes:

- `magazine-db-<timestamp>.dump`
- `magazine-backup-<timestamp>.manifest.json`

The dump uses PostgreSQL custom format. The manifest records non-secret
metadata only: application revision, Drizzle journal position, dump filename,
dump checksum, media inventory counts, and storage bucket identifier when safe.

The manifest must never contain:

- database URLs
- database passwords
- object-storage credentials
- access keys
- secret values

## Verify

Verify a manifest and its colocated dump checksum:

```sh
pnpm backup:verify -- --manifest backups/local/magazine-backup-<timestamp>.manifest.json
```

This is a file-level integrity check. It does not prove the dump can restore.

## Restore Test

Prerequisites:

- `pg_restore` is installed and available on `PATH`.
- `pg_restore` major version matches the PostgreSQL server major version when
  possible.
- `RESTORE_DATABASE_URL` points at a local dedicated restore-test database.
- The destination database name ends with `_restore_test`.

Example:

```sh
RESTORE_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/magazine_site_restore_test \
  pnpm restore:test -- --manifest backups/local/magazine-backup-<timestamp>.manifest.json
```

Restore tooling refuses destinations that:

- are missing or malformed
- do not use `postgres://` or `postgresql://`
- do not end in `_restore_test`
- are not local
- contain production-looking markers such as `prod`, `production`, `staging`,
  `stage`, or `live`

There is no force-production escape hatch.

The restore test runs `pg_restore --clean --if-exists --no-owner --no-acl` into
the approved restore-test database, then validates:

- application connectivity
- representative critical tables exist
- the restored public schema is queryable
- Drizzle migration table presence when available, including
  `drizzle.__drizzle_migrations`

## Media Inventory

Pass A does not copy object storage.

The backup manifest records a database-derived media inventory:

- media asset count
- distinct referenced media count
- rendition count
- missing media reference count
- storage mode
- non-secret bucket or local root identifier when configured

This lets a future drill verify that a DB dump and object-storage inventory were
captured together.

## Consistency Model

PostgreSQL and object storage are not snapshotted atomically in Pass A.

The safe sequence is:

1. Create the PostgreSQL dump.
2. Capture the media inventory from the same application database.
3. Write the manifest with checksums.
4. Verify the manifest.
5. Restore into a dedicated local `_restore_test` database.
6. Run restore validation.

Do not describe this as a transactionally consistent media backup until the
infrastructure supports atomic DB and object-storage snapshots.

## Failure Handling

- If `pg_dump`, `pg_restore`, or validation fails, treat the backup or restore
  drill as failed.
- Do not use a dump when its manifest checksum verification fails.
- Do not manually bypass restore destination checks.
- Do not restore over development, staging, or production databases.
- Keep failed artifacts in an ignored location for investigation, then remove
  them after the incident review if no longer needed.

## Production Restore Approval

Production restore is a human-controlled incident procedure.

Before any production restore:

1. Confirm incident owner and approval authority.
2. Identify the exact backup manifest and dump.
3. Verify the manifest checksum.
4. Complete a restore-test drill into `_restore_test`.
5. Confirm media/object-storage recovery plan.
6. Confirm expected data loss against the RPO target.
7. Record the restore command plan in the incident log.

Pass A intentionally provides no automatic destructive production restore.

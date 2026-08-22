import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbEnv } from "@magazine/config/env/db";
import { postgresUrlToToolEnv } from "../src/backup/postgres-url";
import { assertToolAvailable, runCommand } from "../src/backup/tooling";
import { writeBackupManifest } from "../src/backup/manifest-io";

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) {
    return process.argv[directIndex + 1];
  }
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function safeTimestamp(value: string): string {
  return value.replaceAll(":", "").replaceAll(".", "").replaceAll("-", "");
}

async function main(): Promise<void> {
  const outputDir = readArg("--output-dir");
  if (!outputDir) {
    throw new Error("Usage: pnpm backup:db -- --output-dir <directory>");
  }

  const env = getDbEnv();
  await assertToolAvailable("pg_dump");

  const createdAt = process.env.BACKUP_CREATED_AT ?? new Date().toISOString();
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const stamp = safeTimestamp(createdAt);
  const dumpPath = path.join(resolvedOutputDir, `magazine-db-${stamp}.dump`);
  const manifestPath = path.join(resolvedOutputDir, `magazine-backup-${stamp}.manifest.json`);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const journalPath = path.join(repoRoot, "packages/db/drizzle/meta/_journal.json");

  await runCommand(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", dumpPath],
    { env: postgresUrlToToolEnv(env.DATABASE_URL) },
  );

  await writeBackupManifest({
    manifestPath,
    createdAt,
    applicationRevision: process.env.BACKUP_APP_REVISION ?? "unknown",
    databaseDumpPath: dumpPath,
    journalPath,
    databaseUrl: env.DATABASE_URL,
    env: process.env,
  });

  console.log(`Backup dump written: ${dumpPath}`);
  console.log(`Backup manifest written: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

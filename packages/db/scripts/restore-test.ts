import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertManifestHasNoSecrets, type BackupManifest } from "../src/backup/manifest";
import { postgresUrlToToolEnv } from "../src/backup/postgres-url";
import { assertSafeRestoreDatabaseUrl } from "../src/backup/restore-safety";
import { assertToolAvailable, runCommand } from "../src/backup/tooling";
import { verifyRestoredDatabase } from "../src/backup/restore-verify";

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) {
    return process.argv[directIndex + 1];
  }
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const manifestArg = readArg("--manifest");
  if (!manifestArg) {
    throw new Error("Usage: RESTORE_DATABASE_URL=postgresql://..._restore_test pnpm restore:test -- --manifest <manifest.json>");
  }

  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  const destination = assertSafeRestoreDatabaseUrl(restoreUrl);
  await assertToolAvailable("pg_restore");

  const manifestPath = path.resolve(manifestArg);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  assertManifestHasNoSecrets(manifest);
  const dumpPath = path.resolve(path.dirname(manifestPath), manifest.database.filename);

  await runCommand(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", destination.databaseName, dumpPath],
    { env: postgresUrlToToolEnv(restoreUrl ?? "") },
  );

  const verification = await verifyRestoredDatabase(restoreUrl ?? "");
  console.log(
    `Restore test verified database ${verification.databaseName} with ${verification.criticalTables.length} critical tables.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

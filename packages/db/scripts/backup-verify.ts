import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { assertManifestHasNoSecrets, type BackupManifest } from "../src/backup/manifest";

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) {
    return process.argv[directIndex + 1];
  }
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function main(): Promise<void> {
  const manifestArg = readArg("--manifest");
  if (!manifestArg) {
    throw new Error("Usage: pnpm backup:verify -- --manifest <manifest.json>");
  }

  const manifestPath = path.resolve(manifestArg);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  assertManifestHasNoSecrets(manifest);

  if (manifest.format !== "magazine.backup.manifest" || manifest.version !== 1) {
    throw new Error("Unsupported backup manifest format/version.");
  }

  const dumpPath = path.resolve(path.dirname(manifestPath), manifest.database.filename);
  const actual = await sha256File(dumpPath);
  if (actual !== manifest.database.sha256) {
    throw new Error("Database dump checksum does not match manifest.");
  }

  console.log(`Backup manifest verified: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

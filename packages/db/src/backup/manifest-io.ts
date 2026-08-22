import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { buildBackupManifest, serializeBackupManifest } from "./manifest";

type DrizzleJournal = {
  version: string;
  entries: { idx: number; tag: string }[];
};

export async function sha256File(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function loadDrizzleJournal(journalPath: string): Promise<{
  journalVersion: string;
  latestMigration: { idx: number; tag: string } | null;
}> {
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as DrizzleJournal;
  const latest = journal.entries.at(-1);
  return {
    journalVersion: journal.version,
    latestMigration: latest ? { idx: latest.idx, tag: latest.tag } : null,
  };
}

export function resolveMediaStorageSummary(
  env: Record<string, string | undefined>,
): {
  storageMode: "local" | "s3" | "unknown";
  bucketIdentifier: string | null;
} {
  if (env.MEDIA_STORAGE_MODE === "local") {
    return {
      storageMode: "local",
      bucketIdentifier: env.MEDIA_LOCAL_ROOT ?? null,
    };
  }
  if (env.MEDIA_STORAGE_MODE === "s3") {
    return {
      storageMode: "s3",
      bucketIdentifier: env.MEDIA_S3_BUCKET ?? null,
    };
  }
  return { storageMode: "unknown", bucketIdentifier: null };
}

export async function loadMediaInventory(input: {
  databaseUrl: string;
  env?: Record<string, string | undefined>;
}): Promise<ReturnType<typeof resolveMediaStorageSummary> & {
  assetCount: number;
  referencedObjectCount: number;
  renditionCount: number;
  missingReferenceCount: number;
}> {
  const pool = new Pool({
    connectionString: input.databaseUrl,
    application_name: "magazine_backup_media_inventory",
  });
  try {
    const result = await pool.query<{
      asset_count: string;
      referenced_object_count: string;
      rendition_count: string;
      missing_reference_count: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM media) AS asset_count,
         (SELECT count(DISTINCT media_id)::text FROM content_version_media) AS referenced_object_count,
         (SELECT count(*)::text FROM media_renditions) AS rendition_count,
         (
           SELECT count(*)::text
           FROM content_version_media cvm
           LEFT JOIN media m ON m.id = cvm.media_id
           WHERE m.id IS NULL
         ) AS missing_reference_count`,
    );
    const row = result.rows[0];
    return {
      ...resolveMediaStorageSummary(input.env ?? process.env),
      assetCount: Number(row?.asset_count ?? "0"),
      referencedObjectCount: Number(row?.referenced_object_count ?? "0"),
      renditionCount: Number(row?.rendition_count ?? "0"),
      missingReferenceCount: Number(row?.missing_reference_count ?? "0"),
    };
  } finally {
    await pool.end();
  }
}

export async function writeBackupManifest(input: {
  manifestPath: string;
  createdAt: string;
  applicationRevision: string;
  databaseDumpPath: string;
  journalPath: string;
  databaseUrl: string;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  const [databaseSha256, journal, mediaInventory] = await Promise.all([
    sha256File(input.databaseDumpPath),
    loadDrizzleJournal(input.journalPath),
    loadMediaInventory({ databaseUrl: input.databaseUrl, env: input.env }),
  ]);
  const manifest = buildBackupManifest({
    createdAt: input.createdAt,
    applicationRevision: input.applicationRevision,
    databaseFilename: path.basename(input.databaseDumpPath),
    databaseSha256,
    journalVersion: journal.journalVersion,
    latestMigration: journal.latestMigration,
    mediaInventory,
    rpoTarget: input.env?.BACKUP_RPO_TARGET,
    rtoTarget: input.env?.BACKUP_RTO_TARGET,
  });
  await writeFile(input.manifestPath, serializeBackupManifest(manifest), "utf8");
}

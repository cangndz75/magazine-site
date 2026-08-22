export type BackupManifest = {
  format: "magazine.backup.manifest";
  version: 1;
  createdAt: string;
  application: {
    revision: string;
  };
  database: {
    filename: string;
    format: "pg_dump_custom";
    sha256: string;
  };
  schema: {
    migrationTool: "drizzle";
    journalVersion: string;
    latestMigration: {
      idx: number;
      tag: string;
    } | null;
  };
  mediaInventory: {
    storageMode: "local" | "s3" | "unknown";
    bucketIdentifier: string | null;
    assetCount: number;
    referencedObjectCount: number;
    renditionCount: number;
    missingReferenceCount: number;
  };
  consistency: {
    atomicDatabaseAndMediaSnapshot: false;
    sequence: [
      "database_dump",
      "media_inventory_snapshot",
      "manifest_checksum",
      "restore_verification",
    ];
    limitation: string;
  };
  operationalTargets: {
    rpo: string;
    rto: string;
  };
};

const FORBIDDEN_KEY_PATTERN =
  /(password|passwd|pwd|secret|accessKey|access_key|credential|databaseUrl|database_url|url)/i;
const FORBIDDEN_VALUE_PATTERN =
  /(postgres(?:ql)?:\/\/[^/\s:]+:[^@\s]+@|AKIA[0-9A-Z]{16})/;

export function assertManifestHasNoSecrets(value: unknown): void {
  function visit(current: unknown, path: string): void {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      for (const [key, nested] of Object.entries(current)) {
        if (FORBIDDEN_KEY_PATTERN.test(key)) {
          throw new Error(`Backup manifest contains forbidden field: ${path}.${key}`);
        }
        visit(nested, `${path}.${key}`);
      }
      return;
    }
    if (typeof current === "string" && FORBIDDEN_VALUE_PATTERN.test(current)) {
      throw new Error(`Backup manifest contains credential-looking value: ${path}`);
    }
  }

  visit(value, "$");
}

export function serializeBackupManifest(manifest: BackupManifest): string {
  assertManifestHasNoSecrets(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function buildBackupManifest(input: {
  createdAt: string;
  applicationRevision: string;
  databaseFilename: string;
  databaseSha256: string;
  journalVersion: string;
  latestMigration: BackupManifest["schema"]["latestMigration"];
  mediaInventory: BackupManifest["mediaInventory"];
  rpoTarget?: string;
  rtoTarget?: string;
}): BackupManifest {
  return {
    format: "magazine.backup.manifest",
    version: 1,
    createdAt: input.createdAt,
    application: {
      revision: input.applicationRevision,
    },
    database: {
      filename: input.databaseFilename,
      format: "pg_dump_custom",
      sha256: input.databaseSha256,
    },
    schema: {
      migrationTool: "drizzle",
      journalVersion: input.journalVersion,
      latestMigration: input.latestMigration,
    },
    mediaInventory: input.mediaInventory,
    consistency: {
      atomicDatabaseAndMediaSnapshot: false,
      sequence: [
        "database_dump",
        "media_inventory_snapshot",
        "manifest_checksum",
        "restore_verification",
      ],
      limitation:
        "PostgreSQL and object storage are inventoried sequentially in this foundation pass; this is not a transactionally consistent media backup.",
    },
    operationalTargets: {
      rpo: input.rpoTarget ?? "configured target; not guaranteed by Pass A",
      rto: input.rtoTarget ?? "configured target; not guaranteed by Pass A",
    },
  };
}

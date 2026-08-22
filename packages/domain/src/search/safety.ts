const FORBIDDEN_SEARCH_KEYS = new Set([
  "body",
  "storageKey",
  "rightsNote",
  "internalNote",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "mfaSecret",
  "secretCiphertext",
  "recoveryCode",
  "recoveryCodes",
  "codeHash",
  "auditPayload",
  "eventId",
  "anonymousId",
  "anonId",
  "databaseUrl",
  "connectionString",
  "secret",
  "storageBucket",
  "draftVersionId",
  "scheduledVersionId",
  "publishedVersionId",
  "workflowStatus",
  "legalHoldAt",
]);

export function assertSafeSearchResultsDto(value: unknown): void {
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_SEARCH_KEYS.has(key)) {
        throw new Error(`Search DTO contains forbidden key: ${path}.${key}`);
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  };

  visit(value, "search");
}

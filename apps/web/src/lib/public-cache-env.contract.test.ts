import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getWebEnv } from "@magazine/config/env/web";

const SECRET = "12345678901234567890123456789012";

describe("web public cache env contract", () => {
  it("keeps the cache invalidation secret server-only", () => {
    const env = getWebEnv({
      NODE_ENV: "test",
      APP_ENV: "development",
      SITE_URL: "http://localhost:3000",
      EDITOR_URL: "http://localhost:3001",
      MEDIA_PUBLIC_BASE_URL: "http://localhost:3000/media",
      PUBLIC_CACHE_INVALIDATION_SECRET: SECRET,
    });

    assert.equal(env.PUBLIC_CACHE_INVALIDATION_SECRET, SECRET);
    assert.equal("NEXT_PUBLIC_PUBLIC_CACHE_INVALIDATION_SECRET" in env, false);
  });

  it("fails clearly when the production secret is missing", () => {
    assert.throws(
      () =>
        getWebEnv({
          NODE_ENV: "production",
          APP_ENV: "production",
          SITE_URL: "https://www.example.com",
          EDITOR_URL: "https://editor.example.com",
          MEDIA_PUBLIC_BASE_URL: "https://media.example.com",
        }),
      /Invalid web environment variables/,
    );
  });

  it("does not expose the secret through NEXT_PUBLIC_ in source", () => {
    const envSource = readFileSync(
      path.join(
        fileURLToPath(new URL("../../../../packages/config/src/env/web.ts", import.meta.url)),
      ),
      "utf8",
    );
    const routeSource = readFileSync(
      path.join(
        fileURLToPath(
          new URL("../app/api/internal/public-cache/invalidate/route.ts", import.meta.url),
        ),
      ),
      "utf8",
    );

    assert.equal(
      envSource.includes("NEXT_PUBLIC_PUBLIC_CACHE_INVALIDATION_SECRET"),
      false,
    );
    assert.equal(routeSource.includes("NEXT_PUBLIC_"), false);
    assert.equal(routeSource.includes("revalidateTag"), false);
    assert.equal(routeSource.includes("handlePublicCacheInvalidationPost"), true);
  });
});

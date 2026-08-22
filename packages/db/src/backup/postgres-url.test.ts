import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postgresUrlToToolEnv } from "./postgres-url";

describe("PostgreSQL tool environment", () => {
  it("moves credentials into env fields instead of command arguments", () => {
    const env = postgresUrlToToolEnv(
      "postgresql://user:p%40ss@localhost:5432/magazine_restore_test?sslmode=require",
      {},
    );

    assert.equal(env.PGHOST, "localhost");
    assert.equal(env.PGPORT, "5432");
    assert.equal(env.PGDATABASE, "magazine_restore_test");
    assert.equal(env.PGUSER, "user");
    assert.equal(env.PGPASSWORD, "p@ss");
    assert.equal(env.PGSSLMODE, "require");
  });
});

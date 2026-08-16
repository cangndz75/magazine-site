import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hash, verify } from "@node-rs/argon2";
import {
  ARGON2ID_ALGORITHM,
  ARGON2_MEMORY_COST_KIB,
  ARGON2_OUTPUT_LEN,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
} from "./password-params";

const OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: ARGON2_MEMORY_COST_KIB,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
  outputLen: ARGON2_OUTPUT_LEN,
};

describe("Argon2id password hashing", () => {
  it("hashes and verifies within one second using the locked parameters", async () => {
    const password = "correct-horse-battery";
    const started = Date.now();
    const digest = await hash(password, OPTIONS);
    const elapsed = Date.now() - started;

    assert.equal(digest.startsWith("$argon2id$"), true);
    assert.equal(await verify(digest, password, OPTIONS), true);
    assert.equal(await verify(digest, "wrong-password-value", OPTIONS), false);
    assert.equal(elapsed < 1000, true, `hash took ${elapsed}ms`);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "@magazine/domain";
import {
  BootstrapCliInputError,
  assertBootstrapPassword,
  assertPasswordConfirmation,
  normalizeBootstrapDisplayName,
  normalizeBootstrapEmail,
  parseBootstrapCliArgs,
  parseBootstrapRole,
} from "./bootstrap-cli";

describe("staff bootstrap CLI input", () => {
  it("normalizes canonical staff email", () => {
    assert.equal(
      normalizeBootstrapEmail("  FIRST.ADMIN@Example.TEST  "),
      "first.admin@example.test",
    );
  });

  it("rejects invalid email", () => {
    assert.throws(
      () => normalizeBootstrapEmail("not-an-email"),
      BootstrapCliInputError,
    );
  });

  it("normalizes display name and rejects empty values", () => {
    assert.equal(normalizeBootstrapDisplayName("  First Admin  "), "First Admin");
    assert.throws(() => normalizeBootstrapDisplayName("   "), BootstrapCliInputError);
  });

  it("accepts only real staff role enum values", () => {
    assert.equal(parseBootstrapRole(STAFF_ROLE.SUPER_ADMIN), STAFF_ROLE.SUPER_ADMIN);
    assert.throws(() => parseBootstrapRole("ADMIN"), BootstrapCliInputError);
  });

  it("uses the existing password policy and confirmation", () => {
    assertBootstrapPassword("correct-horse-battery");
    assert.throws(() => assertBootstrapPassword("short"), BootstrapCliInputError);
    assertPasswordConfirmation("correct-horse-battery", "correct-horse-battery");
    assert.throws(
      () => assertPasswordConfirmation("correct-horse-battery", "different-secret"),
      BootstrapCliInputError,
    );
  });

  it("parses safe options and rejects password arguments", () => {
    assert.deepEqual(
      parseBootstrapCliArgs([
        "--email",
        "first.admin@example.test",
        "--display-name",
        "First Admin",
        "--password-stdin",
        "--yes",
      ]),
      {
        email: "first.admin@example.test",
        displayName: "First Admin",
        passwordStdin: true,
        yes: true,
        help: false,
      },
    );

    assert.throws(
      () => parseBootstrapCliArgs(["--password", "correct-horse-battery"]),
      BootstrapCliInputError,
    );
  });

  it("fails closed on unknown options", () => {
    assert.throws(
      () => parseBootstrapCliArgs(["--unknown"]),
      BootstrapCliInputError,
    );
  });
});

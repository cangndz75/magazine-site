import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "@magazine/domain";
import { BootstrapCliInputError } from "./bootstrap-cli";
import {
  assertSuperAdminResetConfirmation,
  buildSuperAdminResetConfirmation,
  describeSanitizedDatabaseTarget,
  parsePasswordResetCliArgs,
  requiresSuperAdminResetConfirmation,
} from "./password-reset-cli";

describe("staff password reset CLI input", () => {
  it("rejects password and email argv options", () => {
    assert.throws(
      () => parsePasswordResetCliArgs(["--password", "secret"]),
      BootstrapCliInputError,
    );
    assert.throws(
      () => parsePasswordResetCliArgs(["--password-stdin"]),
      BootstrapCliInputError,
    );
    assert.throws(
      () => parsePasswordResetCliArgs(["--email", "admin@example.test"]),
      BootstrapCliInputError,
    );
  });

  it("accepts help only", () => {
    assert.deepEqual(parsePasswordResetCliArgs(["--help"]), {
      help: true,
    });
  });

  it("requires exact SUPER_ADMIN confirmation", () => {
    const email = "first.admin@example.test";
    const expected = buildSuperAdminResetConfirmation(email);
    assert.equal(expected, `RESET PASSWORD ${email}`);
    assertSuperAdminResetConfirmation(expected, email);
    assert.throws(
      () => assertSuperAdminResetConfirmation("RESET PASSWORD wrong@example.test", email),
      BootstrapCliInputError,
    );
  });

  it("detects SUPER_ADMIN confirmation requirement", () => {
    assert.equal(
      requiresSuperAdminResetConfirmation([STAFF_ROLE.SUPER_ADMIN]),
      true,
    );
    assert.equal(
      requiresSuperAdminResetConfirmation([STAFF_ROLE.EDITOR]),
      false,
    );
  });

  it("prints sanitized host:port/db without password", () => {
    const target = describeSanitizedDatabaseTarget(
      "postgresql://app_user:super-secret@db.example.test:5433/magazine_dev",
    );
    assert.equal(target.label, "db.example.test:5433/magazine_dev");
    assert.equal(target.host, "db.example.test");
    assert.equal(target.port, "5433");
    assert.equal(target.database, "magazine_dev");
    assert.equal(target.label.includes("super-secret"), false);
  });
});

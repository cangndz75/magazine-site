import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertToolAvailable, type CommandRunner } from "./tooling";

describe("PostgreSQL tooling checks", () => {
  it("resolves when the required tool runs", async () => {
    const calls: string[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(" ")}`);
    };

    await assertToolAvailable("pg_dump", runner);
    assert.deepEqual(calls, ["pg_dump --version"]);
  });

  it("fails clearly when the required tool is unavailable", async () => {
    const runner: CommandRunner = async () => {
      throw new Error("ENOENT");
    };

    await assert.rejects(
      () => assertToolAvailable("pg_restore", runner),
      /pg_restore is required/,
    );
  });
});

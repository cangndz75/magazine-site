import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertToolAvailable,
  resolveCommandInvocation,
  shouldUseWindowsCommandShell,
  type CommandRunner,
} from "./tooling";

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

  it("uses a Windows shell only for command wrappers on Windows", () => {
    assert.equal(
      shouldUseWindowsCommandShell("C:\\tools\\pg_dump.cmd"),
      process.platform === "win32",
    );
    assert.equal(shouldUseWindowsCommandShell("pg_dump"), false);
  });

  it("wraps Windows command files without enabling spawn shell mode", () => {
    const invocation = resolveCommandInvocation("C:\\tools\\pg_dump.cmd", [
      "--version",
    ]);

    if (process.platform === "win32") {
      assert.match(invocation.command, /cmd(?:\.exe)?$/i);
      assert.deepEqual(invocation.args.slice(0, 4), [
        "/d",
        "/s",
        "/c",
        "C:\\tools\\pg_dump.cmd",
      ]);
    } else {
      assert.equal(invocation.command, "C:\\tools\\pg_dump.cmd");
      assert.deepEqual(invocation.args, ["--version"]);
    }
  });
});

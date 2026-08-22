import { spawn } from "node:child_process";

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: {
    env?: NodeJS.ProcessEnv;
  },
) => Promise<void>;

export const runCommand: CommandRunner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const invocation = resolveCommandInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      env: options.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });

export function shouldUseWindowsCommandShell(command: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

export function resolveCommandInvocation(
  command: string,
  args: readonly string[],
): {
  command: string;
  args: readonly string[];
} {
  if (!shouldUseWindowsCommandShell(command)) {
    return { command, args };
  }

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

export async function assertToolAvailable(
  command: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  try {
    await runner(command, ["--version"]);
  } catch (error) {
    throw new Error(
      `${command} is required but was not available or failed to run: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

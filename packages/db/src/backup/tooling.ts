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
    const child = spawn(command, args, {
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

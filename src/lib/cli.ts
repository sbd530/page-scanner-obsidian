/**
 * Runs the installed `page-scanner` command on the Node it was installed for (./setup.ts) and
 * reads its `--json` answer. A child process rather than an import, for the reason raycast/src/lib/cli.ts
 * gives: the CLI starts its daemon by running its own entry point again, which inside Obsidian
 * would be Obsidian. Run as a file of its own under Node, the entry is `argv[1]` and starts
 * itself, and the daemon outlives the plugin. No `obsidian` import.
 */
import { execFile } from 'node:child_process';
import type { CliResult } from './cli-answer';

export interface Cli {
  node: string;
  /** The package's `dist/bin.js`. */
  entry: string;
}

/**
 * Runs one command with `--json` and resolves with its answer, whatever the exit code. Rejects
 * only when there is no answer to read: the process could not start, or printed no JSON.
 */
export function runCli<T>(
  cli: Cli,
  args: readonly string[],
  { timeoutMs = 60_000 }: { timeoutMs?: number } = {},
): Promise<CliResult<T>> {
  return new Promise((resolve, reject) => {
    execFile(
      cli.node,
      [cli.entry, ...args, '--json'],
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === 'number' ? error.code : -1) : 0;
        try {
          resolve({ exitCode, answer: JSON.parse(stdout) as CliResult<T>['answer'] });
        } catch {
          const reason = error?.killed ? `timed out after ${timeoutMs / 1000}s` : stderr.trim();
          reject(
            new Error(`page-scanner ${args[0] ?? ''} gave no answer: ${reason || 'no output'}`),
          );
        }
      },
    );
  });
}

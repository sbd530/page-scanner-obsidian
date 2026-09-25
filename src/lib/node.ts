/**
 * Which Node runs the CLI. Obsidian cannot lend its own: its Electron binary is built with the
 * `RunAsNode` fuse off, so `ELECTRON_RUN_AS_NODE=1 Obsidian` starts Obsidian's own command line
 * rather than Node. The plugin therefore needs a Node installed on the computer, 22 or later,
 * and the helper Chrome starts is named that same Node (`install --node`).
 *
 * A Node whose path survives an upgrade is preferred, since the helper keeps naming it: a
 * package manager's symlink, then a version manager's default alias. Last, the Node a login
 * shell finds, resolved to its real path, because fnm puts a per-shell symlink on PATH that is
 * gone once the shell is. No `obsidian` import, so it is tested.
 */
import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The oldest Node the CLI's commands were run on (Raycast's, when this was written). */
export const MIN_NODE_MAJOR = 22;

export interface NodeProbe {
  exists(path: string): boolean;
  /** `node --version`'s major, or null when it does not run. */
  major(path: string): Promise<number | null>;
  /** The path a login shell finds for `node`, or null. */
  shellNode(): Promise<string | null>;
}

/** Where Node is installed so that its path outlives an upgrade, most likely first. */
export function stableNodePaths(
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform === 'win32') {
    return [
      join(env.ProgramFiles ?? 'C:\\Program Files', 'nodejs', 'node.exe'),
      join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'Volta', 'bin', 'node.exe'),
    ];
  }
  return [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    join(home, '.volta', 'bin', 'node'),
    join(home, '.local', 'share', 'fnm', 'aliases', 'default', 'bin', 'node'),
    join(home, 'Library', 'Application Support', 'fnm', 'aliases', 'default', 'bin', 'node'),
  ];
}

export type NodeFound =
  | { ok: true; path: string; major: number }
  /** `tooOld` names the newest Node that was found, when every one was older than 22. */
  | { ok: false; tooOld?: { path: string; major: number } };

/** The first Node, 22 or later, among the stable paths and then the login shell's. */
export async function findNode(
  candidates: readonly string[],
  probe: NodeProbe,
): Promise<NodeFound> {
  let tooOld: { path: string; major: number } | undefined;
  const consider = async (path: string): Promise<NodeFound | null> => {
    const major = await probe.major(path);
    if (major === null) return null;
    if (major >= MIN_NODE_MAJOR) return { ok: true, path, major };
    if (!tooOld || major > tooOld.major) tooOld = { path, major };
    return null;
  };
  for (const path of candidates) {
    if (!probe.exists(path)) continue;
    const found = await consider(path);
    if (found) return found;
  }
  const fromShell = await probe.shellNode();
  if (fromShell && !candidates.includes(fromShell)) {
    const found = await consider(fromShell);
    if (found) return found;
  }
  return tooOld ? { ok: false, tooOld } : { ok: false };
}

/** Checks a Node named in the settings. */
export async function checkNode(path: string, probe: NodeProbe): Promise<NodeFound> {
  if (!probe.exists(path)) return { ok: false };
  const major = await probe.major(path);
  if (major === null) return { ok: false };
  return major >= MIN_NODE_MAJOR
    ? { ok: true, path, major }
    : { ok: false, tooOld: { path, major } };
}

function run(file: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout }, (error, stdout) => resolve(error ? null : stdout));
  });
}

/** The probe on this computer. */
export const systemProbe: NodeProbe = {
  exists: existsSync,
  async major(path) {
    const out = await run(path, ['--version'], 5_000);
    const major = out ? /^v(\d+)\./.exec(out.trim())?.[1] : undefined;
    return major === undefined ? null : Number(major);
  },
  async shellNode() {
    if (process.platform === 'win32') {
      const out = await run('where', ['node'], 5_000);
      return out?.split(/\r?\n/)[0]?.trim() || null;
    }
    // Obsidian started from the Dock has launchd's PATH, not the one the user's shell sets up.
    const shell = process.env.SHELL || '/bin/zsh';
    const out = await run(shell, ['-ilc', 'command -v node'], 10_000);
    const found = out?.trim().split('\n').pop()?.trim();
    if (!found || !found.startsWith('/')) return null;
    try {
      return realpathSync(found);
    } catch {
      return null;
    }
  },
};

/** The Node to use: the one named in the settings, or the first found on this computer. */
export function resolveNode(configured: string): Promise<NodeFound> {
  const named = configured.trim();
  if (named) return checkNode(named, systemProbe);
  return findNode(stableNodePaths(process.platform, homedir(), process.env), systemProbe);
}

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
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

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

export interface NodeVersion {
  path: string;
  major: number;
}

/**
 * Every Node that runs, among the stable paths and then the login shell's, in that order: the
 * caller wants the first one of 22 or later that has the CLI installed beside it (./setup.ts).
 */
export async function listNodes(
  candidates: readonly string[],
  probe: NodeProbe,
): Promise<NodeVersion[]> {
  const found: NodeVersion[] = [];
  const consider = async (path: string) => {
    const major = await probe.major(path);
    if (major !== null) found.push({ path, major });
  };
  for (const path of candidates) {
    if (probe.exists(path)) await consider(path);
  }
  const fromShell = await probe.shellNode();
  if (fromShell && !candidates.includes(fromShell)) await consider(fromShell);
  return found;
}

/** A Node named in the settings, as a list of one when it runs. */
export async function namedNode(path: string, probe: NodeProbe): Promise<NodeVersion[]> {
  if (!probe.exists(path)) return [];
  const major = await probe.major(path);
  return major === null ? [] : [{ path, major }];
}

function run(
  file: string,
  args: string[],
  timeout: number,
  options: { env?: NodeJS.ProcessEnv; shell?: boolean } = {},
): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, ...options }, (error, stdout) =>
      resolve(error ? null : String(stdout)),
    );
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

/** The Nodes to consider: the one named in the settings, or every one found on this computer. */
export function nodesToTry(configured: string): Promise<NodeVersion[]> {
  const named = configured.trim();
  if (named) return namedNode(named, systemProbe);
  return listNodes(stableNodePaths(process.platform, homedir(), process.env), systemProbe);
}

/**
 * The global `node_modules` folders a Node's npm installs into: what `npm root -g` beside it
 * answers (a prefix set in `.npmrc` included), and the default for its layout, `<prefix>/lib/
 * node_modules` beside `<prefix>/bin/node`, or `%APPDATA%\\npm\\node_modules` on Windows.
 */
export async function globalRoots(node: string): Promise<string[]> {
  const roots: string[] = [];
  const bin = dirname(node);
  const npm = join(bin, process.platform === 'win32' ? 'npm.cmd' : 'npm');
  if (existsSync(npm)) {
    const out = await run(npm, ['root', '-g'], 10_000, {
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` },
      shell: process.platform === 'win32',
    });
    const root = out?.trim().split(/\r?\n/).pop()?.trim();
    if (root) roots.push(root);
  }
  roots.push(
    process.platform === 'win32'
      ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules')
      : join(dirname(bin), 'lib', 'node_modules'),
  );
  return [...new Set(roots)];
}

/** The version of the CLI installed in a global root, or null. */
export function installedCliVersion(root: string): string | null {
  try {
    const pkg = JSON.parse(
      readFileSync(join(root, '@page-scanner', 'cli', 'package.json'), 'utf8'),
    ) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

/**
 * Which Node and which `page-scanner` command the plugin runs, found together.
 *
 * The plugin carries no CLI of its own: Obsidian's community directory refused a plugin that
 * wrote an embedded copy of it to disk (a self-installing plugin, by its rules), so the user
 * installs it with npm, `npm install -g @page-scanner/cli`. That lands in the global
 * `node_modules` of whichever Node their terminal's npm belongs to, which is not always the Node
 * found first (Homebrew's next to fnm's, say). So every Node found (./node.ts) is asked in turn
 * whether the CLI is installed beside it, and the pair is used together: the CLI runs on the Node
 * it was installed for, and the helper is installed naming that Node. No `obsidian` import, so it
 * is tested.
 */
import { join } from 'node:path';
import { MIN_NODE_MAJOR } from './node';

export const CLI_PACKAGE = '@page-scanner/cli';
/** The first release with `install --node` and the Edge Add-ons id, which the plugin relies on. */
export const MIN_CLI_VERSION = '0.3.2';
export const INSTALL_COMMAND = `npm install -g ${CLI_PACKAGE}`;

export interface SetupProbe {
  /** Nodes that run, with their major version, most stable path first. */
  nodes(): Promise<{ path: string; major: number }[]>;
  /** The global `node_modules` folders a Node's npm installs into. */
  globalRoots(node: string): Promise<string[]>;
  /** The version in `<root>/@page-scanner/cli/package.json`, or null when it is not there. */
  cliVersion(root: string): string | null;
}

export type Setup =
  | { ok: true; node: string; nodeMajor: number; entry: string; version: string }
  /** No Node of 22 or later; `tooOld` is the newest older one found. */
  | { ok: false; missing: 'node'; tooOld?: { path: string; major: number } }
  /** A Node, and no CLI installed for any Node found; `old` is an older release that is. */
  | {
      ok: false;
      missing: 'cli';
      node: string;
      nodeMajor: number;
      old?: { version: string; root: string };
    };

/** Compares two `x.y.z` versions: negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split('-')[0]!
      .split('.')
      .map((n) => Number(n) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The CLI's entry point inside a global root. */
export const cliEntry = (root: string) => join(root, CLI_PACKAGE, 'dist', 'bin.js');

export async function findSetup(probe: SetupProbe): Promise<Setup> {
  const nodes = await probe.nodes();
  const usable = nodes.filter((node) => node.major >= MIN_NODE_MAJOR);
  const first = usable[0];
  if (!first) {
    const tooOld = nodes.reduce<{ path: string; major: number } | undefined>(
      (newest, node) => (!newest || node.major > newest.major ? node : newest),
      undefined,
    );
    return tooOld ? { ok: false, missing: 'node', tooOld } : { ok: false, missing: 'node' };
  }
  let old: { version: string; root: string } | undefined;
  for (const node of usable) {
    for (const root of await probe.globalRoots(node.path)) {
      const version = probe.cliVersion(root);
      if (version === null) continue;
      if (compareVersions(version, MIN_CLI_VERSION) >= 0) {
        return { ok: true, node: node.path, nodeMajor: node.major, entry: cliEntry(root), version };
      }
      if (!old || compareVersions(version, old.version) > 0) old = { version, root };
    }
  }
  return {
    ok: false,
    missing: 'cli',
    node: first.path,
    nodeMajor: first.major,
    ...(old ? { old } : {}),
  };
}

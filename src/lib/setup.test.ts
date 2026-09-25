import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareVersions, findSetup, type SetupProbe } from './setup';

function probe(
  nodes: { path: string; major: number }[],
  roots: Record<string, string[]>,
  installed: Record<string, string>,
): SetupProbe {
  return {
    nodes: async () => nodes,
    globalRoots: async (node) => roots[node] ?? [],
    cliVersion: (root) => installed[root] ?? null,
  };
}

const brew = { path: '/opt/homebrew/bin/node', major: 26 };
const fnm = { path: '/Users/me/.local/share/fnm/aliases/default/bin/node', major: 24 };
const roots = {
  [brew.path]: ['/opt/homebrew/lib/node_modules'],
  [fnm.path]: ['/Users/me/.local/share/fnm/aliases/default/lib/node_modules'],
};

describe('findSetup', () => {
  it('pairs the CLI with the Node it was installed for, not the first Node found', async () => {
    const setup = await findSetup(probe([brew, fnm], roots, { [roots[fnm.path]![0]!]: '0.3.2' }));
    expect(setup).toEqual({
      ok: true,
      node: fnm.path,
      nodeMajor: 24,
      entry: join(roots[fnm.path]![0]!, '@page-scanner', 'cli', 'dist', 'bin.js'),
      version: '0.3.2',
    });
  });

  it('says the CLI is missing, naming the first Node, when none has it', async () => {
    expect(await findSetup(probe([brew, fnm], roots, {}))).toEqual({
      ok: false,
      missing: 'cli',
      node: brew.path,
      nodeMajor: 26,
    });
  });

  it('says which older release is installed, when that is all there is', async () => {
    const setup = await findSetup(
      probe([brew], roots, { '/opt/homebrew/lib/node_modules': '0.3.1' }),
    );
    expect(setup).toMatchObject({
      ok: false,
      missing: 'cli',
      old: { version: '0.3.1', root: '/opt/homebrew/lib/node_modules' },
    });
  });

  it('passes over a Node older than 22, and names the newest one when there is no other', async () => {
    const old = { path: '/usr/bin/node', major: 20 };
    expect(
      await findSetup(
        probe(
          [old],
          { [old.path]: ['/usr/lib/node_modules'] },
          { '/usr/lib/node_modules': '0.3.2' },
        ),
      ),
    ).toEqual({ ok: false, missing: 'node', tooOld: old });
    expect(await findSetup(probe([], {}, {}))).toEqual({ ok: false, missing: 'node' });
  });
});

describe('compareVersions', () => {
  it('compares x.y.z numerically', () => {
    expect(compareVersions('0.3.10', '0.3.2')).toBeGreaterThan(0);
    expect(compareVersions('0.3.2', '0.3.2')).toBe(0);
    expect(compareVersions('0.2.9', '0.3.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(0);
  });
});

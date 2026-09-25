import { describe, expect, it } from 'vitest';
import { checkNode, findNode, stableNodePaths, type NodeProbe } from './node';

function probe(versions: Record<string, number | null>, shell: string | null = null): NodeProbe {
  return {
    exists: (path) => path in versions,
    major: async (path) => versions[path] ?? null,
    shellNode: async () => shell,
  };
}

describe('findNode', () => {
  it('takes the first stable path that runs a Node of 22 or later', async () => {
    const found = await findNode(
      ['/opt/homebrew/bin/node', '/usr/local/bin/node'],
      probe({ '/opt/homebrew/bin/node': 26, '/usr/local/bin/node': 22 }),
    );
    expect(found).toEqual({ ok: true, path: '/opt/homebrew/bin/node', major: 26 });
  });

  it('passes over a Node that is too old or does not run', async () => {
    const found = await findNode(['/a', '/b', '/c'], probe({ '/a': 20, '/b': null, '/c': 24 }));
    expect(found).toEqual({ ok: true, path: '/c', major: 24 });
  });

  it("falls back to the login shell's Node", async () => {
    const shell = '/Users/me/.local/share/fnm/node-versions/v24.14.0/installation/bin/node';
    const found = await findNode(['/opt/homebrew/bin/node'], probe({ [shell]: 24 }, shell));
    expect(found).toEqual({ ok: true, path: shell, major: 24 });
  });

  it('names the newest Node it found when all are too old', async () => {
    const found = await findNode(['/a', '/b'], probe({ '/a': 18, '/b': 20 }));
    expect(found).toEqual({ ok: false, tooOld: { path: '/b', major: 20 } });
  });

  it('finds nothing on a computer without Node', async () => {
    expect(await findNode(['/a'], probe({}))).toEqual({ ok: false });
  });
});

describe('checkNode', () => {
  it('accepts a named Node of 22 or later, and says when it is older', async () => {
    const versions = probe({ '/new': 22, '/old': 20 });
    expect(await checkNode('/new', versions)).toEqual({ ok: true, path: '/new', major: 22 });
    expect(await checkNode('/old', versions)).toEqual({
      ok: false,
      tooOld: { path: '/old', major: 20 },
    });
    expect(await checkNode('/missing', versions)).toEqual({ ok: false });
  });
});

describe('stableNodePaths', () => {
  it("lists Homebrew's first on macOS, and Program Files on Windows", () => {
    expect(stableNodePaths('darwin', '/Users/me', {})[0]).toBe('/opt/homebrew/bin/node');
    expect(
      stableNodePaths('win32', 'C:\\Users\\me', { ProgramFiles: 'C:\\Program Files' })[0],
    ).toMatch(/Program Files.nodejs.node\.exe$/);
  });
});

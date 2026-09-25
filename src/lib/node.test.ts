import { describe, expect, it } from 'vitest';
import { listNodes, namedNode, stableNodePaths, type NodeProbe } from './node';

function probe(versions: Record<string, number | null>, shell: string | null = null): NodeProbe {
  return {
    exists: (path) => path in versions,
    major: async (path) => versions[path] ?? null,
    shellNode: async () => shell,
  };
}

describe('listNodes', () => {
  it('lists every stable path that runs, in order, then the login shell Node', async () => {
    const shell = '/Users/me/.local/share/fnm/node-versions/v24.14.0/installation/bin/node';
    const nodes = await listNodes(
      ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/broken', '/old'],
      probe({ '/opt/homebrew/bin/node': 26, '/broken': null, '/old': 18, [shell]: 24 }, shell),
    );
    expect(nodes).toEqual([
      { path: '/opt/homebrew/bin/node', major: 26 },
      { path: '/old', major: 18 },
      { path: shell, major: 24 },
    ]);
  });

  it('does not list the login shell Node twice', async () => {
    const nodes = await listNodes(['/a'], probe({ '/a': 22 }, '/a'));
    expect(nodes).toEqual([{ path: '/a', major: 22 }]);
  });

  it('finds nothing on a computer without Node', async () => {
    expect(await listNodes(['/a'], probe({}))).toEqual([]);
  });
});

describe('namedNode', () => {
  it('is the named Node when it runs, and nothing otherwise', async () => {
    const versions = probe({ '/new': 22, '/broken': null });
    expect(await namedNode('/new', versions)).toEqual([{ path: '/new', major: 22 }]);
    expect(await namedNode('/broken', versions)).toEqual([]);
    expect(await namedNode('/missing', versions)).toEqual([]);
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

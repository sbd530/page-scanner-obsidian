import { describe, expect, it } from 'vitest';
import type { StatusAnswer } from './cli-answer';
import { helperState } from './helper-state';

function status(nativeHost: Partial<StatusAnswer['nativeHost']>): StatusAnswer {
  return {
    paired: true,
    daemon: null,
    browsers: [],
    nativeHost: {
      hostInstalled: true,
      node: '/opt/homebrew/bin/node',
      nodeFound: true,
      browsers: [{ name: 'Google Chrome', installed: true, allowsStore: true }],
      ...nativeHost,
    },
  };
}

describe('helperState', () => {
  it('is missing with no wrapper, or with no browser set up', () => {
    expect(helperState(status({ hostInstalled: false }))).toBe('missing');
    expect(
      helperState(status({ browsers: [{ name: 'Chrome', installed: false, allowsStore: false }] })),
    ).toBe('missing');
  });

  it('is broken when the Node the wrapper names is gone', () => {
    expect(helperState(status({ nodeFound: false }))).toBe('broken');
  });

  it('is outdated when a manifest predates the Edge Add-ons id', () => {
    expect(
      helperState(
        status({
          browsers: [
            { name: 'Google Chrome', installed: true, allowsStore: true },
            { name: 'Microsoft Edge', installed: true, allowsStore: false },
          ],
        }),
      ),
    ).toBe('outdated');
  });

  it('is ready otherwise', () => {
    expect(helperState(status({}))).toBe('ready');
  });
});

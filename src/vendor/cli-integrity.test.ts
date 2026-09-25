import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLI_VENDOR } from './cli-integrity';

describe('the vendored CLI', () => {
  it('is the release package.json pins, not a local build', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      devDependencies: Record<string, string>;
    };
    // `vendor --local` writes `local` here; vendor the pinned release again before committing.
    expect(CLI_VENDOR.version).toBe(pkg.devDependencies['@page-scanner/cli']);
  });
});

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeVendoredCli } from './vendored';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const files = { 'page-scanner.mjs': 'console.log(1)', 'host.js': 'host' };
const hashes = {
  'page-scanner.mjs': sha(files['page-scanner.mjs']),
  'host.js': sha(files['host.js']),
};

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('writeVendoredCli', () => {
  it('writes the files and returns the bundle', () => {
    dir = mkdtempSync(join(tmpdir(), 'ps-obsidian-'));
    const bundle = writeVendoredCli(join(dir, 'cli'), files, hashes);
    expect(bundle).toBe(join(dir, 'cli', 'page-scanner.mjs'));
    expect(readFileSync(join(dir, 'cli', 'host.js'), 'utf8')).toBe('host');
  });

  it('writes a changed file again', () => {
    dir = mkdtempSync(join(tmpdir(), 'ps-obsidian-'));
    writeVendoredCli(dir, files, hashes);
    writeFileSync(join(dir, 'host.js'), 'tampered');
    writeVendoredCli(dir, files, hashes);
    expect(readFileSync(join(dir, 'host.js'), 'utf8')).toBe('host');
  });

  it('refuses what main.js carries when it does not match its hash', () => {
    dir = mkdtempSync(join(tmpdir(), 'ps-obsidian-'));
    expect(() => writeVendoredCli(dir, { ...files, 'host.js': 'other' }, hashes)).toThrow(
      /integrity check \(host\.js\)/,
    );
  });
});

#!/usr/bin/env node
/**
 * Builds the plugin as Obsidian loads it: `dist/main.js` and `dist/manifest.json`.
 *
 * `main.js` is CommonJS, with `obsidian`, `electron` and Node's own modules left to Obsidian's
 * `require`. It carries no CLI: the user installs `@page-scanner/cli` with npm (src/lib/setup.ts
 * says why). `--watch` rebuilds on every change, for `pnpm run dev`.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes('--watch');

const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  console.error(
    `manifest.json says ${manifest.version} and package.json ${pkg.version}; they are one version.`,
  );
  process.exit(1);
}

mkdirSync(join(here, 'dist'), { recursive: true });
copyFileSync(join(here, 'manifest.json'), join(here, 'dist', 'manifest.json'));

const options = {
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(here, 'dist', 'main.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // Obsidian 1.4's Electron.
  target: 'es2022',
  external: [
    'obsidian',
    'electron',
    '@codemirror/*',
    '@lezer/*',
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`),
  ],
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}

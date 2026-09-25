#!/usr/bin/env node
/**
 * Builds the plugin as Obsidian loads it: `dist/main.js` and `dist/manifest.json`.
 *
 * `main.js` is CommonJS, with `obsidian`, `electron` and Node's own modules left to Obsidian's
 * `require`, and it carries the vendored CLI (`vendor/`, from scripts/vendor-cli.mjs) as two
 * strings, imported from `virtual:page-scanner-cli`, because a plugin installs as main.js and
 * manifest.json only. `--watch` rebuilds on every change, for `pnpm run dev`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
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

const VENDORED = ['page-scanner.mjs', 'host.js'];

/** `virtual:page-scanner-cli`: the vendored files by name, as strings. */
const vendoredCli = {
  name: 'vendored-cli',
  setup(build) {
    build.onResolve({ filter: /^virtual:page-scanner-cli$/ }, () => ({
      path: 'page-scanner-cli',
      namespace: 'vendored-cli',
    }));
    build.onLoad({ filter: /.*/, namespace: 'vendored-cli' }, () => {
      const files = {};
      for (const name of VENDORED) {
        const file = join(here, 'vendor', name);
        if (!existsSync(file)) {
          return { errors: [{ text: `No vendor/${name}. Run \`pnpm run vendor\` first.` }] };
        }
        files[name] = readFileSync(file, 'utf8');
      }
      return {
        contents: `export default ${JSON.stringify(files)};`,
        loader: 'js',
        watchFiles: VENDORED.map((name) => join(here, 'vendor', name)),
      };
    });
  },
};

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
  plugins: [vendoredCli],
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}

#!/usr/bin/env node
/**
 * Vendors the `page-scanner` command into the plugin, from the @page-scanner/cli release on npm
 * that package.json pins:
 *
 * 1. `vendor/page-scanner.mjs`, the whole command in one file, bundled with esbuild from the
 *    package's `dist/bin.js`, not minified.
 * 2. `vendor/host.js`, the native messaging host `install` copies out, from beside it in the
 *    package, where `packagedHostPath()` in the bundle looks for it.
 * 3. `src/vendor/cli-integrity.ts`, the version and the SHA-256 of both files.
 *
 * `scripts/build.mjs` embeds both files in `main.js`, because an Obsidian plugin is installed as
 * main.js and manifest.json and nothing else; `src/lib/vendored.ts` writes them into the plugin's
 * folder before the first run and checks them against these hashes before every run.
 *
 * The same pinned version, esbuild version and options write the same bytes. The package is
 * Apache-2.0; its source maps carry its TypeScript source.
 *
 * `--local` bundles ../cli's own build instead (`pnpm --filter @page-scanner/cli build` first),
 * to try an unreleased CLI. Its integrity file names the version `local`, which
 * `src/vendor/cli-integrity.test.ts` refuses, so it cannot be committed by accident.
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const local = process.argv.includes('--local');
const cli = local
  ? join(here, '..', 'cli')
  : realpathSync(join(here, 'node_modules', '@page-scanner', 'cli'));
const { version } = JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8'));
const entry = join(cli, 'dist', 'bin.js');
const hostSource = join(cli, 'dist', 'native', 'host.js');

for (const file of [entry, hostSource]) {
  if (!existsSync(file)) {
    console.error(
      local
        ? `No ${file}. Run \`pnpm --filter @page-scanner/cli build\` first.`
        : `No ${file}. Run \`pnpm install\` in obsidian/.`,
    );
    process.exit(1);
  }
}

mkdirSync(join(here, 'vendor'), { recursive: true });
const bundle = join(here, 'vendor', 'page-scanner.mjs');
const host = join(here, 'vendor', 'host.js');

// The same banner as raycast/scripts/vendor-cli.mjs and the CLI's own scripts/bundle.mjs: ws
// asks for its optional native speedups with a guarded `require()`, and esbuild's CJS-shaped
// wrappers want __filename and __dirname.
const banner = `// @page-scanner/cli ${local ? 'local build' : version}, Apache-2.0, bundled by scripts/vendor-cli.mjs.
import { createRequire as __psCreateRequire } from 'node:module';
import { fileURLToPath as __psFileURLToPath } from 'node:url';
import { dirname as __psDirname } from 'node:path';
globalThis.require ??= __psCreateRequire(import.meta.url);
const __filename = __psFileURLToPath(import.meta.url);
const __dirname = __psDirname(__filename);
`;

const result = await esbuild.build({
  entryPoints: [entry],
  absWorkingDir: here,
  bundle: true,
  platform: 'node',
  format: 'esm',
  // The oldest Node the plugin runs it on (src/lib/node.ts).
  target: 'node22',
  sourcemap: false,
  external: ['bufferutil', 'utf-8-validate'],
  banner: { js: banner },
  logLevel: 'warning',
  write: false,
});
// Module paths written the npm way, as raycast/ does, so the bytes do not depend on pnpm's layout.
const code = result.outputFiles[0].text.replace(
  /(?:\.\.\/)*node_modules\/\.pnpm\/[^/"\s]+\/node_modules\//g,
  'node_modules/',
);
writeFileSync(bundle, code);
copyFileSync(hostSource, host);

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
mkdirSync(join(here, 'src', 'vendor'), { recursive: true });
writeFileSync(
  join(here, 'src', 'vendor', 'cli-integrity.ts'),
  `// Written by scripts/vendor-cli.mjs: the vendored CLI's version and the SHA-256 of its two files.
export const CLI_VENDOR = {
  version: '${local ? 'local' : version}',
  sha256: {
    'page-scanner.mjs': '${sha256(bundle)}',
    'host.js': '${sha256(host)}',
  },
} as const;
`,
);
console.log(
  `Vendored @page-scanner/cli ${local ? `(local build, ${version})` : version} into vendor/`,
);

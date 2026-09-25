/**
 * The CLI `main.js` carries (scripts/build.mjs), written where Node can run it, which main.ts
 * puts under `~/.page-scanner/`, outside the vault and apart from the plugin's own files. A file that is missing, or differs from the hash recorded when the CLI was vendored,
 * is written again from what `main.js` carries; one that still differs after that is refused
 * rather than run. No `obsidian` import, so it is tested.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function hashOf(file: string): string | null {
  try {
    return sha256(readFileSync(file));
  } catch {
    return null;
  }
}

/**
 * Puts each file in `directory` and returns the path of the bundle to run. Throws when what
 * `main.js` carries does not match its recorded hash, which is a build that went wrong.
 */
export function writeVendoredCli(
  directory: string,
  files: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
): string {
  mkdirSync(directory, { recursive: true });
  for (const [name, hash] of Object.entries(expected)) {
    const file = join(directory, name);
    if (hashOf(file) === hash) continue;
    const content = files[name];
    if (content === undefined || sha256(content) !== hash) {
      throw new Error(
        `The Page Scanner command inside the plugin failed its integrity check (${name}). Reinstall the plugin.`,
      );
    }
    writeFileSync(file, content);
  }
  return join(directory, 'page-scanner.mjs');
}

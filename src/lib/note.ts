/**
 * What goes in the vault for one scan: the PDF, and a note beside it with the same name that
 * is the page's Markdown (F36, front matter with its title, address and capture time) with the
 * PDF embedded under the front matter. No `obsidian` import, so it is tested.
 */

/**
 * A file name Obsidian can link to. Its own forbidden characters (`\ / :`), the ones that end
 * or change a wikilink (`[ ] | # ^`), and the ones Windows refuses are replaced with a dash.
 */
export function safeStem(name: string): string {
  const stem = name
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 120)
    .trim();
  return stem || 'Page';
}

/** A file name without its extension. */
export function stemOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * The name both files take: the page's title, which reads as a note's name in the file tree and
 * in a link, or the extension's file name for a page without one.
 */
export function noteStem(answer: {
  path: string;
  fileName: string;
  page?: { title: string } | undefined;
}): string {
  const title = answer.page?.title.trim();
  if (title) return safeStem(title);
  return safeStem(stemOf(answer.fileName || (answer.path.split(/[\\/]/).pop() ?? '')));
}

/**
 * The first stem that leaves both files free in `folder`: `name`, then `name 2`, `name 3`,
 * the way Obsidian names a second "Untitled".
 */
export function freeStem(folder: string, stem: string, taken: (path: string) => boolean): string {
  const prefix = folder ? `${folder}/` : '';
  const free = (candidate: string) =>
    !taken(`${prefix}${candidate}.pdf`) && !taken(`${prefix}${candidate}.md`);
  if (free(stem)) return stem;
  for (let n = 2; ; n++) {
    if (free(`${stem} ${n}`)) return `${stem} ${n}`;
  }
}

/** The note: the Markdown's front matter, then the PDF embedded, then the page's text. */
export function noteText(markdown: string, pdfName: string): string {
  const embed = `![[${pdfName}]]\n`;
  const frontMatter = /^---\n[\s\S]*?\n---\n/.exec(markdown);
  if (!frontMatter) return `${embed}\n${markdown}`;
  const rest = markdown.slice(frontMatter[0].length).replace(/^\n+/, '');
  return `${frontMatter[0]}\n${embed}${rest ? `\n${rest}` : ''}`;
}

import { describe, expect, it } from 'vitest';
import { freeStem, noteStem, noteText, safeStem, stemOf } from './note';

describe('safeStem', () => {
  it('replaces what breaks a file name or a wikilink', () => {
    expect(safeStem('Markdown: a [short] guide | #1 ^x')).toBe('Markdown- a -short- guide - -1 -x');
    expect(safeStem('a/b\\c')).toBe('a-b-c');
  });

  it('falls back to a name when nothing is left', () => {
    expect(safeStem('...')).toBe('Page');
    expect(safeStem('')).toBe('Page');
  });

  it('keeps a long name to 120 characters', () => {
    expect(safeStem('x'.repeat(300))).toHaveLength(120);
  });
});

describe('stemOf', () => {
  it('drops the extension', () => {
    expect(stemOf('Markdown - Wikipedia.pdf')).toBe('Markdown - Wikipedia');
  });
});

describe('noteStem', () => {
  const scan = {
    path: '/tmp/x/releases-20260925-2014.pdf',
    fileName: 'releases-20260925-2014.pdf',
  };

  it("names the files after the page's title", () => {
    expect(noteStem({ ...scan, page: { title: 'Releases · sbd530/page-scanner' } })).toBe(
      'Releases · sbd530-page-scanner',
    );
  });

  it("falls back to the extension's name for a page without a title", () => {
    expect(noteStem({ ...scan, page: { title: '  ' } })).toBe('releases-20260925-2014');
    expect(noteStem({ ...scan, fileName: '' })).toBe('releases-20260925-2014');
  });
});

describe('freeStem', () => {
  it('counts up until both files are free', () => {
    const taken = new Set(['Scans/Page.pdf', 'Scans/Page 2.md']);
    expect(freeStem('Scans', 'Page', (path) => taken.has(path))).toBe('Page 3');
    expect(freeStem('Scans', 'Other', (path) => taken.has(path))).toBe('Other');
    expect(freeStem('', 'Page', (path) => path === 'Page.md')).toBe('Page 2');
  });
});

describe('noteText', () => {
  it('embeds the PDF under the front matter', () => {
    const markdown =
      '---\ntitle: "Cat"\nsource: "https://x"\ncaptured: 2026-09-25T00:00:00.000Z\n---\n\n# Cat\n\nText.\n';
    expect(noteText(markdown, 'Cat.pdf')).toBe(
      '---\ntitle: "Cat"\nsource: "https://x"\ncaptured: 2026-09-25T00:00:00.000Z\n---\n\n![[Cat.pdf]]\n\n# Cat\n\nText.\n',
    );
  });

  it('puts the embed first when there is no front matter', () => {
    expect(noteText('# Cat\n', 'Cat.pdf')).toBe('![[Cat.pdf]]\n\n# Cat\n');
  });

  it('has only the embed when the page had no text', () => {
    expect(noteText('---\ntitle: "x"\n---\n', 'x.pdf')).toBe(
      '---\ntitle: "x"\n---\n\n![[x.pdf]]\n',
    );
  });
});

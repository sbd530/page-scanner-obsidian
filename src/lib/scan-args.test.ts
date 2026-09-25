import { describe, expect, it } from 'vitest';
import { scanArgs, type ScanSettings } from './scan-args';

const target = { tabId: 7, browserId: 'b1', out: '/tmp/x' };
const asExtension: ScanSettings = {
  pageSize: 'a4',
  scheme: 'extension',
  pageWidth: 'extension',
  hide: 'extension',
};

describe('scanArgs', () => {
  it('always asks for a PDF with its Markdown beside it', () => {
    expect(scanArgs(asExtension, target)).toEqual([
      'scan',
      '--tab',
      '7',
      '--browser',
      'b1',
      '--out',
      '/tmp/x',
      '--format',
      'pdf',
      '--page-size',
      'a4',
      '--markdown',
      'beside',
    ]);
  });

  it("passes a flag only for a choice that is not the extension's own", () => {
    const args = scanArgs(
      { pageSize: 'auto', scheme: 'dark', pageWidth: 'a4', hide: 'all' },
      target,
    );
    expect(args).toEqual(
      expect.arrayContaining(['--page-size', 'auto', '--scheme', 'dark', '--page-width', 'a4']),
    );
    expect(args.slice(-2)).toEqual(['--hide', 'all']);
  });
});

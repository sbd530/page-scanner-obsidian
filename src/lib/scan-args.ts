/**
 * The `page-scanner scan` arguments the settings stand for. Always a PDF with its Markdown
 * beside it, which the plugin then puts in the vault as a note that embeds the PDF. A choice
 * left at "As in Page Scanner's settings" passes no flag, so the extension's own setting
 * decides, as it does for a scan started in the browser. No `obsidian` import, so it is tested.
 */

export interface ScanSettings {
  pageSize: 'a4' | 'letter' | 'auto';
  scheme: 'extension' | 'auto' | 'light' | 'dark';
  pageWidth: 'extension' | 'window' | 'a4' | 'letter';
  hide: 'extension' | 'all' | 'none';
}

const EXTENSION = 'extension';

export function scanArgs(
  settings: ScanSettings,
  target: { tabId: number; browserId: string; out: string },
): string[] {
  const args = ['scan', '--tab', String(target.tabId), '--browser', target.browserId];
  args.push('--out', target.out, '--format', 'pdf', '--page-size', settings.pageSize);
  args.push('--markdown', 'beside');
  if (settings.scheme !== EXTENSION) args.push('--scheme', settings.scheme);
  if (settings.pageWidth !== EXTENSION) args.push('--page-width', settings.pageWidth);
  if (settings.hide !== EXTENSION) args.push('--hide', settings.hide);
  return args;
}

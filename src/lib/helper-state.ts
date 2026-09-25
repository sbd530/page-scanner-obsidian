/**
 * Where the helper stands, read from `status --json`, as in raycast/src/lib/helper-state.ts.
 */
import type { StatusAnswer } from './cli-answer';

export type HelperState = 'missing' | 'broken' | 'outdated' | 'ready';

/**
 * `broken` is a wrapper whose Node is gone, which only a new wrapper fixes; `outdated` is a
 * manifest written before Edge Add-ons had an id (CLI 0.3.1 and earlier); `missing` is a machine
 * where nobody has set it up, which is the user's to agree to.
 */
export function helperState(status: StatusAnswer): HelperState {
  const host = status.nativeHost;
  const installed = host.browsers.filter((browser) => browser.installed);
  if (!host.hostInstalled || installed.length === 0) return 'missing';
  if (!host.nodeFound) return 'broken';
  return installed.every((browser) => browser.allowsStore) ? 'ready' : 'outdated';
}

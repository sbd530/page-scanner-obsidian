/**
 * The tabs the picker offers, in the order it offers them. While Obsidian is in front no browser
 * window has focus, and the bridge does not say which was in front last, so rather than guess
 * (Raycast asks the browser over AppleScript, macOS only) the plugin lists the tabs and puts the
 * likely one first: the active tab of the focused window, then every window's active tab, then
 * the rest in the browser's order. Pages the extension cannot capture (the browser's own pages,
 * other extensions', the store) are left out. No `obsidian` import, so it is tested.
 */
import type { TabsAnswer } from './cli-answer';

export type Tab = TabsAnswer['tabs'][number];

export interface TabChoice {
  tab: Tab;
  /** The tab in front of its window. */
  active: boolean;
}

const CAPTURABLE = /^(https?|file):/i;
const STORES =
  /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons)\//i;

export function orderTabs(list: Pick<TabsAnswer, 'windows' | 'tabs'>): TabChoice[] {
  // A popup or an app window is not where someone reads a page.
  const normal = new Set(
    list.windows.filter((window) => window.windowType === 'normal').map((w) => w.windowId),
  );
  const focused = list.windows.find((window) => window.focused && normal.has(window.windowId));
  const rank = (tab: Tab) =>
    tab.active && tab.windowId === focused?.windowId ? 0 : tab.active ? 1 : 2;
  return list.tabs
    .filter((tab) => normal.has(tab.windowId) && CAPTURABLE.test(tab.url) && !STORES.test(tab.url))
    .map((tab, index) => ({ tab, index }))
    .sort((a, b) => rank(a.tab) - rank(b.tab) || a.index - b.index)
    .map(({ tab }) => ({ tab, active: tab.active }));
}

/** Whether a tab answers what was typed into the picker, by its title or its address. */
export function matchesQuery(tab: Tab, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${tab.title} ${tab.url}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

import { describe, expect, it } from 'vitest';
import type { TabsAnswer } from './cli-answer';
import { matchesQuery, orderTabs } from './tabs';

const windows: TabsAnswer['windows'] = [
  { windowId: 1, focused: false, windowType: 'normal', tabCount: 3 },
  { windowId: 2, focused: true, windowType: 'normal', tabCount: 1 },
  { windowId: 3, focused: false, windowType: 'popup', tabCount: 1 },
];
const tab = (tabId: number, windowId: number, url: string, active = false) => ({
  tabId,
  windowId,
  url,
  title: `Tab ${tabId}`,
  active,
});

describe('orderTabs', () => {
  it("puts the focused window's active tab first, then the other active tabs, then the rest", () => {
    const order = orderTabs({
      windows,
      tabs: [
        tab(10, 1, 'https://a.example/'),
        tab(11, 1, 'https://b.example/', true),
        tab(12, 1, 'https://c.example/'),
        tab(20, 2, 'https://d.example/', true),
      ],
    });
    expect(order.map((choice) => choice.tab.tabId)).toEqual([20, 11, 10, 12]);
    expect(order.map((choice) => choice.active)).toEqual([true, true, false, false]);
  });

  it("leaves out popups, the browser's own pages and the stores", () => {
    const order = orderTabs({
      windows,
      tabs: [
        tab(1, 1, 'chrome://settings/', true),
        tab(2, 1, 'chrome-extension://abc/editor.html'),
        tab(3, 1, 'https://chromewebstore.google.com/detail/x'),
        tab(6, 1, 'https://chrome.google.com/webstore/devconsole/x'),
        tab(4, 3, 'https://popup.example/', true),
        tab(5, 1, 'file:///Users/me/page.html'),
      ],
    });
    expect(order.map((choice) => choice.tab.tabId)).toEqual([5]);
  });
});

describe('matchesQuery', () => {
  it('matches every word against the title and the address', () => {
    const t = {
      ...tab(1, 1, 'https://en.wikipedia.org/wiki/Markdown'),
      title: 'Markdown - Wikipedia',
    };
    expect(matchesQuery(t, 'wiki mark')).toBe(true);
    expect(matchesQuery(t, '')).toBe(true);
    expect(matchesQuery(t, 'markdown github')).toBe(false);
  });
});

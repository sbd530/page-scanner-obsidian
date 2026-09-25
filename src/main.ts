/**
 * Page Scanner for Obsidian (FEATURES.md F47): **Scan a browser tab into the vault** lists the
 * browser's tabs through the bridge (F9), scans the one picked as a vector PDF with its Markdown
 * beside it (F13's `scan --markdown beside`), and puts both in the vault, the Markdown as a note
 * that embeds the PDF. The settings tab carries the setup steps and the scan's options.
 *
 * The CLI is the user's own install of `@page-scanner/cli` from npm, run as a child process on
 * the Node it was installed for (lib/setup.ts finds the pair; lib/node.ts says why not Obsidian's
 * runtime). The plugin carries no copy of it and writes nothing outside the vault itself.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizePath, Notice, Plugin, type TFile } from 'obsidian';
import {
  isSetupMissing,
  type ScanAnswer,
  type StatusAnswer,
  type TabsAnswer,
} from './lib/cli-answer';
import { runCli, type Cli } from './lib/cli';
import { helperState } from './lib/helper-state';
import { globalRoots, installedCliVersion, nodesToTry, type NodeVersion } from './lib/node';
import { freeStem, noteStem, noteText } from './lib/note';
import { failure, notConnected, Problem } from './lib/problem';
import { scanArgs, type ScanSettings } from './lib/scan-args';
import { findSetup, INSTALL_COMMAND, type Setup } from './lib/setup';
import { orderTabs, type Tab } from './lib/tabs';
import { PageScannerSettingTab } from './settings-tab';
import { pickTab } from './tab-modal';

export interface PageScannerSettings extends ScanSettings {
  /** The vault folder scans go in; the vault's root when empty. */
  folder: string;
  openNote: boolean;
  /** A Node to run the CLI with; found on the computer when empty. */
  nodePath: string;
  /** A connected browser's label or id, for a computer with more than one connected. */
  browser: string;
}

export const DEFAULT_SETTINGS: PageScannerSettings = {
  folder: 'Page Scanner',
  pageSize: 'a4',
  scheme: 'extension',
  pageWidth: 'extension',
  hide: 'extension',
  openNote: true,
  nodePath: '',
  browser: '',
};

/** Long enough for a service worker Chrome retired to come back; the CLI's own default is 30. */
const TABS_WAIT_SECONDS = 10;
/** After the helper is written again, Chrome retries the connection on a 30-second backoff. */
const REPAIR_WAIT_SECONDS = 35;
/** A long page takes a while; the CLI's own scan timeout still applies inside this. */
const SCAN_TIMEOUT_MS = 10 * 60_000;

export default class PageScannerPlugin extends Plugin {
  override settings: PageScannerSettings = { ...DEFAULT_SETTINGS };
  private nodes: Promise<NodeVersion[]> | null = null;
  private readonly roots = new Map<string, Promise<string[]>>();
  private busy = false;

  override async onload(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<PageScannerSettings>),
    };
    this.addCommand({
      id: 'scan-tab',
      name: 'Scan a browser tab into the vault',
      callback: () => void this.scanTab(),
    });
    this.addRibbonIcon('scan-line', 'Scan a browser tab', () => void this.scanTab());
    this.addSettingTab(new PageScannerSettingTab(this.app, this));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * The Node and the installed CLI to run, looked for again on every call: the CLI may have been
   * installed a moment ago. `again` also looks for the Nodes again, which the first check of the
   * settings tab and a change of the Node setting ask for; otherwise they, and each Node's
   * global folders, are looked for once, since that runs a login shell and npm.
   */
  lookUp(again = false): Promise<Setup> {
    if (again || !this.nodes) {
      this.nodes = nodesToTry(this.settings.nodePath);
      this.roots.clear();
    }
    const nodes = this.nodes;
    return findSetup({
      nodes: () => nodes,
      globalRoots: (node) => {
        let roots = this.roots.get(node);
        if (!roots) this.roots.set(node, (roots = globalRoots(node)));
        return roots;
      },
      cliVersion: installedCliVersion,
    });
  }

  /** The Node and the CLI to run, or a Problem saying which is missing. */
  async cli(): Promise<Cli> {
    const setup = await this.lookUp();
    if (setup.ok) return { node: setup.node, entry: setup.entry };
    if (setup.missing === 'node') {
      throw new Problem('Page Scanner needs Node.js 22 or later', {
        hint: setup.tooOld
          ? `The newest Node found is ${String(setup.tooOld.major)} (${setup.tooOld.path}).`
          : 'None was found on this computer. Install it from nodejs.org, or name one in the settings.',
        inSettings: true,
      });
    }
    throw new Problem(
      setup.old
        ? `Page Scanner's command is ${setup.old.version}, older than this plugin needs`
        : "Page Scanner's command is not installed",
      { hint: `Run ${INSTALL_COMMAND} in a terminal, then try again.`, inSettings: true },
    );
  }

  /** Writes the helper's manifests, naming the Node the plugin runs the CLI with. */
  async installHelper(cli: Cli): Promise<void> {
    const installed = await runCli<{ node: string }>(cli, ['install', '--node', cli.node]);
    if (!installed.answer.ok) throw failure(installed);
  }

  async status(cli: Cli): Promise<StatusAnswer> {
    const status = await runCli<StatusAnswer>(cli, ['status']);
    if (!status.answer.ok) throw failure(status);
    return status.answer;
  }

  openSettings(): void {
    const setting = (
      this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }
    ).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  async scanTab(): Promise<void> {
    if (this.busy) {
      new Notice('A scan is already running.');
      return;
    }
    this.busy = true;
    const notice = new Notice("Finding the browser's tabs", 0);
    try {
      const cli = await this.cli();
      const tabs = await this.listTabs(cli, notice);
      notice.hide();
      const choices = orderTabs(tabs);
      if (choices.length === 0) {
        throw new Problem('No tab to scan', { hint: 'Open the page in a browser window first.' });
      }
      const choice = await pickTab(this.app, choices);
      if (choice) await this.scan(cli, tabs.browserId, choice.tab);
    } catch (error) {
      notice.hide();
      this.tell(error);
    } finally {
      this.busy = false;
    }
  }

  private async listTabs(cli: Cli, notice: Notice): Promise<TabsAnswer> {
    const browser = this.settings.browser.trim() ? ['--browser', this.settings.browser.trim()] : [];
    let tabs = await runCli<TabsAnswer>(cli, [
      'tabs',
      '--wait',
      String(TABS_WAIT_SECONDS),
      ...browser,
    ]);
    // Nothing set up or nothing connected is repaired; several browsers, or a named one that is
    // not connected, is the user's to choose and is told as the CLI says it.
    if (isSetupMissing(tabs)) {
      await this.repairIfBroken(cli, notice);
      tabs = await runCli<TabsAnswer>(
        cli,
        ['tabs', '--wait', String(REPAIR_WAIT_SECONDS), ...browser],
        {
          timeoutMs: (REPAIR_WAIT_SECONDS + 15) * 1000,
        },
      );
      if (isSetupMissing(tabs)) throw notConnected();
    }
    if (!tabs.answer.ok) throw failure(tabs);
    return tabs.answer;
  }

  /**
   * No browser answered. Writes the helper again when its Node is gone or its manifest predates
   * Edge Add-ons, which the user agreed to when it was installed; throws, saying what is
   * missing, in every other case.
   */
  private async repairIfBroken(cli: Cli, notice: Notice): Promise<void> {
    const state = helperState(await this.status(cli));
    if (state === 'missing') {
      throw new Problem('Page Scanner is not set up yet', {
        hint: "Install the helper in the plugin's settings, then press Connect in the browser extension.",
        inSettings: true,
      });
    }
    if (state === 'ready') throw notConnected();
    notice.setMessage('Repairing the helper');
    await this.installHelper(cli);
    notice.setMessage('Waiting for the browser to reconnect');
  }

  private async scan(cli: Cli, browserId: string, tab: Tab): Promise<void> {
    const notice = new Notice(`Scanning ${tab.title || tab.url}`, 0);
    const out = mkdtempSync(join(tmpdir(), 'page-scanner-obsidian-'));
    try {
      const scan = await runCli<ScanAnswer>(
        cli,
        scanArgs(this.settings, { tabId: tab.tabId, browserId, out }),
        { timeoutMs: SCAN_TIMEOUT_MS },
      );
      if (!scan.answer.ok) throw failure(scan);
      const note = await this.keep(scan.answer);
      new Notice(`Saved ${note.basename}`);
      if (this.settings.openNote) await this.app.workspace.getLeaf(false).openFile(note);
    } finally {
      notice.hide();
      rmSync(out, { recursive: true, force: true });
    }
  }

  /** Moves the scan into the vault: the PDF, and the note that embeds it, under the page's title. */
  private async keep(answer: ScanAnswer): Promise<TFile> {
    const { vault } = this.app;
    const folder = this.settings.folder.trim() ? normalizePath(this.settings.folder.trim()) : '';
    if (folder && !vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
    const stem = freeStem(
      folder,
      noteStem(answer),
      (path) => vault.getAbstractFileByPath(path) !== null,
    );
    const prefix = folder ? `${folder}/` : '';
    const pdf = readFileSync(answer.path);
    await vault.createBinary(
      `${prefix}${stem}.pdf`,
      pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
    );
    const markdownPath = answer.page?.markdownPath;
    const markdown =
      markdownPath && markdownPath !== answer.path ? readFileSync(markdownPath, 'utf8') : '';
    return vault.create(`${prefix}${stem}.md`, noteText(markdown, `${prefix}${stem}.pdf`));
  }

  private tell(error: unknown): void {
    const problem =
      error instanceof Problem
        ? error
        : new Problem('Page Scanner did not answer', {
            hint: error instanceof Error ? error.message : String(error),
          });
    new Notice(
      createFragment((fragment) => {
        fragment.createEl('strong', { text: problem.message });
        if (problem.hint) fragment.createDiv({ text: problem.hint });
        if (problem.inSettings) {
          const link = fragment.createEl('a', { text: "Open the plugin's settings", href: '#' });
          link.addEventListener('click', (event) => {
            event.preventDefault();
            this.openSettings();
          });
        }
      }),
      15_000,
    );
  }
}

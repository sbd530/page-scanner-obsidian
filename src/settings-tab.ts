/**
 * The plugin's settings: the setup steps first, each done or to do and checked again every few
 * seconds while the tab is open, as raycast/'s Set up does; then the scan's options.
 */
import { PluginSettingTab, Setting, type App } from 'obsidian';
import type { StatusAnswer } from './lib/cli-answer';
import { helperState, type HelperState } from './lib/helper-state';
import { MIN_NODE_MAJOR } from './lib/node';
import { Problem, STORE_URL } from './lib/problem';
import { INSTALL_COMMAND, MIN_CLI_VERSION, type Setup } from './lib/setup';
import type PageScannerPlugin from './main';

const RECHECK_MS = 3_000;

interface Progress {
  setup: Setup;
  status?: StatusAnswer;
  error?: string;
}

export class PageScannerSettingTab extends PluginSettingTab {
  private readonly plugin: PageScannerPlugin;
  private setupEl: HTMLElement | null = null;
  private timer: number | null = null;
  private working = false;

  constructor(app: App, plugin: PageScannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Setup').setHeading();
    this.setupEl = containerEl.createDiv();
    this.setupEl.createEl('p', {
      text: 'Checking what is set up already.',
      cls: 'setting-item-description',
    });
    void this.refresh(true);
    this.timer = window.setInterval(() => void this.refresh(false), RECHECK_MS);

    new Setting(containerEl).setName('Scans').setHeading();
    const settings = this.plugin.settings;
    const save = () => this.plugin.saveSettings();

    new Setting(containerEl)
      .setName('Folder')
      .setDesc("Where the PDF and its note go in the vault. The vault's root when empty.")
      .addText((text) =>
        text
          .setPlaceholder('Page Scanner')
          .setValue(settings.folder)
          .onChange(async (value) => {
            settings.folder = value;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName('Page size')
      .setDesc('How the PDF is paged.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ a4: 'A4 pages', letter: 'US Letter pages', auto: 'One long page' })
          .setValue(settings.pageSize)
          .onChange(async (value) => {
            settings.pageSize = value as typeof settings.pageSize;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName('Theme')
      .setDesc("Which of a page's two themes to capture.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            extension: "As in Page Scanner's settings",
            auto: "The browser's",
            light: 'Light',
            dark: 'Dark',
          })
          .setValue(settings.scheme)
          .onChange(async (value) => {
            settings.scheme = value as typeof settings.scheme;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName('Page width')
      .setDesc('The width the page is laid out at before the capture.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            extension: "As in Page Scanner's settings",
            window: "The window's",
            a4: 'A4 sheet',
            letter: 'US Letter sheet',
          })
          .setValue(settings.pageWidth)
          .onChange(async (value) => {
            settings.pageWidth = value as typeof settings.pageWidth;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName('Hide clutter')
      .setDesc('Ads, cookie banners, chat widgets and pop-ups to hide before the capture.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            extension: "As in Page Scanner's settings",
            all: 'Hide all of them',
            none: 'Hide none of them',
          })
          .setValue(settings.hide)
          .onChange(async (value) => {
            settings.hide = value as typeof settings.hide;
            await save();
          }),
      );
    new Setting(containerEl)
      .setName('Open the note')
      .setDesc('Open the new note once the scan is saved.')
      .addToggle((toggle) =>
        toggle.setValue(settings.openNote).onChange(async (value) => {
          settings.openNote = value;
          await save();
        }),
      );

    new Setting(containerEl).setName('Advanced').setHeading();
    new Setting(containerEl)
      .setName('Node')
      .setDesc(
        `The Node.js the plugin runs Page Scanner's command with, ${String(MIN_NODE_MAJOR)} or later. Found on this computer when empty.`,
      )
      .addText((text) =>
        text
          .setPlaceholder('/opt/homebrew/bin/node')
          .setValue(settings.nodePath)
          .onChange(async (value) => {
            settings.nodePath = value;
            await save();
            void this.plugin.lookUp(true);
          }),
      );
    new Setting(containerEl)
      .setName('Browser')
      .setDesc('The connected browser to use, by label or ID, when more than one is connected.')
      .addText((text) =>
        text.setValue(settings.browser).onChange(async (value) => {
          settings.browser = value;
          await save();
        }),
      );
  }

  override hide(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.setupEl = null;
  }

  /** Checks the setup again and redraws it; `first` also looks for the Nodes again. */
  private async refresh(first: boolean): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      const progress = await this.check(first);
      if (this.setupEl) this.drawSetup(this.setupEl, progress);
    } finally {
      this.working = false;
    }
  }

  private async check(first: boolean): Promise<Progress> {
    const setup = await this.plugin.lookUp(first);
    if (!setup.ok) return { setup };
    try {
      return { setup, status: await this.plugin.status(await this.plugin.cli()) };
    } catch (error) {
      return { setup, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private drawSetup(el: HTMLElement, progress: Progress): void {
    el.empty();
    el.createEl('p', {
      cls: 'setting-item-description',
      text: 'The plugin scans through the Page Scanner extension in your browser, which needs a small helper on this computer to talk to it.',
    });

    const { setup } = progress;
    const node = new Setting(el).setName('1. Node.js');
    if (!setup.ok && setup.missing === 'node') {
      node.setDesc(
        setup.tooOld
          ? `To do. The newest Node found is ${String(setup.tooOld.major)} (${setup.tooOld.path}); install ${String(MIN_NODE_MAJOR)} or later from nodejs.org, or name one under Advanced.`
          : `To do. Install Node.js ${String(MIN_NODE_MAJOR)} or later from nodejs.org, or name one under Advanced.`,
      );
      return;
    }
    node.setDesc(`Done. ${setup.node} (${String(setup.nodeMajor)}).`);

    const command = new Setting(el).setName("2. Install Page Scanner's command");
    if (setup.ok) {
      command.setDesc(`Done. @page-scanner/cli ${setup.version}.`);
    } else {
      command
        .setDesc(
          createFragment((fragment) => {
            fragment.appendText(
              setup.old
                ? `To do. ${setup.old.version} is installed, and this plugin needs ${MIN_CLI_VERSION} or later. Update it in a terminal: `
                : 'To do. Run this in a terminal, with the npm that comes with Node.js: ',
            );
            fragment.createEl('code', { text: INSTALL_COMMAND });
          }),
        )
        .addButton((button) =>
          button.setButtonText('Copy').onClick(async () => {
            await navigator.clipboard.writeText(INSTALL_COMMAND);
            button.setButtonText('Copied');
          }),
        );
      return;
    }

    if (progress.error || !progress.status) {
      new Setting(el).setName('Page Scanner did not answer').setDesc(progress.error ?? '');
      return;
    }

    const state = helperState(progress.status);
    new Setting(el)
      .setName('3. Install the helper')
      .setDesc(helperText(state, progress.status.nativeHost.node))
      .addButton((button) => {
        if (state === 'ready') {
          button.setButtonText('Install again');
        } else {
          button.setButtonText(state === 'missing' ? 'Install helper' : 'Repair helper').setCta();
        }
        button.onClick(async () => {
          // Hold the recheck off, which would draw the button again mid-install.
          this.working = true;
          button.setDisabled(true).setButtonText('Installing');
          try {
            await this.plugin.installHelper(await this.plugin.cli());
          } catch (error) {
            button
              .setDisabled(false)
              .setButtonText(error instanceof Problem ? error.message : 'Failed');
            return;
          } finally {
            this.working = false;
          }
          await this.refresh(false);
        });
      });

    const browsers = progress.status.browsers.map((browser) => browser.label);
    const connect = new Setting(el).setName('4. Connect the browser');
    if (browsers.length > 0) {
      connect.setDesc(
        `Done. Connected: ${browsers.join(', ')}. Run "Scan a browser tab into the vault" from the command palette.`,
      );
    } else {
      connect.setDesc(
        createFragment((fragment) => {
          fragment.appendText('To do. Install ');
          fragment.createEl('a', {
            text: 'Page Scanner from the Chrome Web Store',
            href: STORE_URL,
          });
          fragment.appendText(
            ' if you have not. Then open its settings (the gear in its popup), go to Local agents, press Connect and allow what the browser asks. This checks again every few seconds.',
          );
        }),
      );
    }
  }
}

function helperText(state: HelperState, node: string | null): string {
  switch (state) {
    case 'ready':
      return 'Done.';
    case 'broken':
      return `Needs repair. The Node it ran on is gone (${node ?? 'unknown'}).`;
    case 'outdated':
      return 'Needs repair. It was set up before Page Scanner came to Edge Add-ons, so Edge cannot start it yet.';
    case 'missing':
      return 'To do. It tells Chrome, Edge, Brave, Arc and Vivaldi where the helper is, and changes nothing else.';
  }
}

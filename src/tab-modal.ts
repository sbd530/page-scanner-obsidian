/**
 * The picker: the open tabs, the likeliest first (lib/tabs.ts), filtered by what is typed.
 */
import { SuggestModal, type App } from 'obsidian';
import { matchesQuery, type TabChoice } from './lib/tabs';

class TabModal extends SuggestModal<TabChoice> {
  private readonly choices: TabChoice[];
  private readonly done: (choice: TabChoice | null) => void;

  constructor(app: App, choices: TabChoice[], done: (choice: TabChoice | null) => void) {
    super(app);
    this.choices = choices;
    this.done = done;
    this.setPlaceholder('Pick the tab to scan');
    this.setInstructions([
      { command: '↑↓', purpose: 'to choose' },
      { command: '↵', purpose: 'to scan' },
      { command: 'esc', purpose: 'to cancel' },
    ]);
    this.emptyStateText = 'No open tab matches.';
  }

  getSuggestions(query: string): TabChoice[] {
    return this.choices.filter((choice) => matchesQuery(choice.tab, query));
  }

  renderSuggestion(choice: TabChoice, el: HTMLElement): void {
    el.addClass('mod-complex');
    const content = el.createDiv({ cls: 'suggestion-content' });
    content.createDiv({ cls: 'suggestion-title', text: choice.tab.title || choice.tab.url });
    content.createDiv({ cls: 'suggestion-note', text: choice.tab.url });
    if (choice.active) {
      el.createDiv({ cls: 'suggestion-aux' }).createSpan({
        cls: 'suggestion-flair',
        text: 'In front',
      });
    }
  }

  onChooseSuggestion(choice: TabChoice): void {
    this.done(choice);
  }

  override onClose(): void {
    // Obsidian closes the modal before it reports the choice, so a cancel is only a cancel if
    // no choice follows in the same turn.
    window.setTimeout(() => this.done(null), 0);
  }
}

/** Resolves with the tab picked, or null when the picker was dismissed. */
export function pickTab(app: App, choices: TabChoice[]): Promise<TabChoice | null> {
  return new Promise((resolve) => {
    let settled = false;
    new TabModal(app, choices, (choice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
    }).open();
  });
}

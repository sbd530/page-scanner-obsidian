/**
 * The shape of the CLI's `--json` answers, its exit codes, and what a failure means for this
 * plugin. The same as raycast/src/lib/cli-answer.ts: no app imports another's source, so the
 * few lines are kept twice rather than shared.
 */

/** The exit codes the CLI documents (FEATURES.md F13). */
export const EXIT = {
  ok: 0,
  failed: 1,
  badArguments: 2,
  noBrowser: 3,
  notPaired: 4,
  daemonFailed: 5,
} as const;

/** What every `--json` answer carries on failure. */
export interface CliFailure {
  ok: false;
  code: number;
  error: string;
  message: string;
  hint?: string;
}

export interface CliResult<T> {
  exitCode: number;
  answer: (T & { ok: true }) | CliFailure;
}

/**
 * Whether a failure means the setup is missing or has come apart (nothing paired, or no browser
 * connected at all). Exit code 3 also covers several browsers connected with none named, and a
 * named browser that is not connected; those are the user's to choose, and are told as the CLI
 * says them.
 */
export function isSetupMissing(result: CliResult<unknown>): boolean {
  if (result.exitCode === EXIT.notPaired) return true;
  return (
    result.exitCode === EXIT.noBrowser && !result.answer.ok && result.answer.error === 'NO_BROWSER'
  );
}

/** `status --json`, the parts this plugin reads. */
export interface StatusAnswer {
  paired: boolean;
  daemon: { running: boolean } | null;
  browsers: { browserId: string; label: string }[];
  nativeHost: {
    hostInstalled: boolean;
    node: string | null;
    nodeFound: boolean;
    /** `allowsStore`: its manifest lets both store builds, Chrome's and Edge's, start the helper. */
    browsers: { name: string; installed: boolean; allowsStore: boolean }[];
  };
}

export interface TabsAnswer {
  browserId: string;
  label: string;
  windows: { windowId: number; focused: boolean; windowType: string; tabCount: number }[];
  tabs: { tabId: number; windowId: number; url: string; title: string; active: boolean }[];
}

export interface ScanAnswer {
  path: string;
  fileName: string;
  page?: { title: string; url: string; markdownPath?: string };
}

/**
 * A failure told to the user as a notice: what went wrong, what to do, and whether the plugin's
 * settings are where to do it. No `obsidian` import.
 */
import { isSetupMissing, type CliResult } from './cli-answer';

export const STORE_URL =
  'https://chromewebstore.google.com/detail/page-scanner/oinkohacnbkapdnnhpidmoidmidlgaoj';

export class Problem extends Error {
  readonly hint: string | undefined;
  /** The fix is in the plugin's settings (the setup steps, or the Node to use). */
  readonly inSettings: boolean;

  constructor(message: string, options: { hint?: string; inSettings?: boolean } = {}) {
    super(message);
    this.hint = options.hint;
    this.inSettings = options.inSettings ?? false;
  }
}

export function notConnected(): Problem {
  return new Problem('No browser is connected', {
    hint: "Keep the browser open. If it still does not connect, open Page Scanner's settings in the browser, Local agents, and press Connect.",
    inSettings: true,
  });
}

/** A CLI failure as the CLI words it. */
export function failure(result: CliResult<unknown>): Problem {
  const answer = result.answer;
  if (answer.ok) return new Problem('Page Scanner failed');
  return new Problem(answer.message, {
    ...(answer.hint ? { hint: answer.hint } : {}),
    inSettings: isSetupMissing(result),
  });
}

# Page Scanner for Obsidian

Save a browser tab into your vault as a vector PDF and a Markdown note. **Scan a browser tab into
the vault** lists the tabs open in your browser, scans the one you pick, and puts two files in a
folder of your vault: the PDF, with its text still selectable and searchable, and a note with the
page's text as Markdown and the PDF embedded under its properties.

It works through [Page Scanner](https://pagescanner.app), a Chrome and Edge extension that
captures whole pages, and Page Scanner's command-line tool, which you install with npm. Desktop
only.

## What a scan leaves in the vault

In the folder set in the settings (`Page Scanner` by default), two files named after the page's
title:

- `Markdown - Wikipedia.pdf`, the whole page as a vector PDF.
- `Markdown - Wikipedia.md`, the note:

  ```text
  ---
  title: "Markdown - Wikipedia"
  source: "https://en.wikipedia.org/wiki/Markdown"
  captured: 2026-09-25T11:02:41.000Z
  ---

  ![[Page Scanner/Markdown - Wikipedia.pdf]]

  # Markdown

  Markdown is a lightweight markup language …
  ```

Characters a file name or a link cannot hold (`[ ] | # ^ : / \`) become dashes, and a name the
vault already holds gets ` 2`, ` 3` added.

## Setting it up

1. Install Page Scanner 1.3.0 or newer from the
   [Chrome Web Store](https://chromewebstore.google.com/detail/page-scanner/oinkohacnbkapdnnhpidmoidmidlgaoj)
   or [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/edlmbcahnbpdfibbimdkdbgiemadanhh),
   in Chrome, Edge, Brave, Arc or Vivaldi.
2. Have [Node.js](https://nodejs.org) 22 or newer on the computer, and install the command-line
   tool in a terminal:

   ```sh
   npm install -g @page-scanner/cli
   ```

   Obsidian cannot run it with its own runtime, so the plugin looks for it beside each Node it
   finds (Homebrew's, `/usr/local/bin`, Volta's, fnm's default, or your shell's) and runs it on
   the Node it was installed for. A Node can also be named in the plugin's settings.

3. In Obsidian, open **Settings**, **Community plugins**, **Browse**, search for **Page Scanner**,
   install it and enable it.
4. Open the plugin's settings. The steps at the top say what is done: press
   **Install helper**, then open the extension's settings (the gear in its popup), go to
   **Local agents** and press **Connect**.
5. Run **Scan a browser tab into the vault** from the command palette, or press the ribbon's scan
   button, and pick the tab.

## Settings

| Setting       | Choices                                                            |
| ------------- | ------------------------------------------------------------------ |
| Folder        | a vault folder; the vault's root when empty                        |
| Page size     | A4, US Letter, one long page                                       |
| Theme         | as in Page Scanner's settings, the browser's, light, dark          |
| Page width    | as in Page Scanner's settings, the window's, A4, US Letter         |
| Hide clutter  | as in Page Scanner's settings, all of it, none of it               |
| Open the note | on by default                                                      |
| Node          | a Node.js 22 or newer to use; found on the computer when empty     |
| Browser       | a connected browser's label or id, when more than one is connected |

"As in Page Scanner's settings" leaves the choice to the extension's Capture settings. The
extension editor's output (a crop, marks, a frame, a stamp, PDF/A) is not applied to a scan
from Obsidian.

## What it does outside the vault

- **Files outside the vault.** The plugin runs Page Scanner's command-line tool, the
  [`@page-scanner/cli`](https://www.npmjs.com/package/@page-scanner/cli) package you install with
  npm, as a separate process with Node.js; to find it, it reads the global `node_modules` folder
  of each Node on the computer (and asks their npm where that is). The tool writes each scan into
  the system's temporary folder before the plugin moves it into the vault, and keeps its pairing
  and settings in `~/.page-scanner/`. **Install helper** writes a small launcher there, and for
  each browser a file saying where the launcher is: in the browser's `NativeMessagingHosts`
  folder on macOS and Linux, and under a registry value in `HKCU` on Windows. That is how the
  extension and the tool find each other.
- **Network use.** None beyond this computer. The tool runs a small background process that
  listens on `127.0.0.1` only: port 45711 for the extension, and a second local port for the
  tool's own commands, both behind a token. The page is captured by your own browser, as it is
  already loaded there. Nothing is sent to Page Scanner or anyone else, and there is no
  telemetry.
- **Nothing is downloaded or installed by the plugin.** The command-line tool is yours to install
  and update with npm; the plugin only runs the copy it finds, and never fetches code.

## License

Apache-2.0. The command-line tool it runs, `@page-scanner/cli`, is Apache-2.0 as well, by the same
author.

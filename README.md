<p align="center">
  <img src="media/edex-icon.png" alt="EDEX" width="180">
</p>

<h1 align="center">EDEX</h1>

A maintained fork of [eDEX-UI](https://github.com/GitSquared/edex-ui) — the sci-fi desktop
terminal — brought up to date and made usable as a daily driver on Apple Silicon.

The upstream project was archived at v2.2.8 on Electron 12. This fork picks it up from there:
native arm64, a current Electron, patched dependencies, and a terminal that no longer plays a
sound on every keystroke.

> Looking for the original project's README, screenshots and credits? See
> [README.upstream.md](README.upstream.md).

## What is different from upstream

All changes are dated **2026-08-14** and **2026-08-15**, and are described per-commit in
`git log`. The security review behind the second batch is written up in [AUDIT.md](AUDIT.md).

### Runtime and packaging
- **Electron 12 → 43** (Chromium 89 → 150), electron-builder 22 → 26, `electron-rebuild` →
  `@electron/rebuild`, `@electron/remote` 1 → 2, `node-pty` 0.10 → 1.1.
- **Native Apple Silicon build.** Upstream shipped x64, which ran through Rosetta and burned
  roughly 600% CPU while idle. Native arm64 brings that to about 40%.
- Refreshed `nanoid`, `pdfjs-dist`, `smoothie`, `systeminformation`, `ws`; `tar` pinned to
  >= 7.5.21 through `overrides` (transitive, critical advisory).

### Security
- **The terminal websocket binds to `127.0.0.1` only** and verifies `Origin`, accepting just
  the local renderer loaded from `file://`. Upstream listened on every interface and accepted
  whichever client connected first — the long-standing eDEX-UI exposure. Without the Origin
  check, a web page open in a browser could connect to the local port and drive the shell.
- **Untrusted values are escaped before they reach the DOM** — process names, volume labels,
  keyboard layout files, error text. Upstream interpolated them raw, which with node
  integration enabled meant a file named `<img src=x onerror=…>` executed code the moment it
  was displayed. See [AUDIT.md](AUDIT.md).
- **Paths typed into the shell are quoted properly**, so a file named `'; rm -rf ~; '` stays a
  file name.
- **pdf.js updated** from 2.16 to 4.10, with `eval` disabled in the viewer
  (CVE-2024-4367). `npm audit` in `src/` reports no vulnerabilities.
- **The update checker is gone.** It fetched releases from the upstream repository on every
  launch and dropped the response into modal markup, `onclick` handler included.

**Known limitation:** the renderer still runs with `nodeIntegration: true` and
`contextIsolation: false`, inherited from upstream. The injection paths above are closed, but
the architecture offers no second line of defence — treat the app as trusting whatever you
open with it. Moving to a preload bridge is a rewrite of the window-to-main plumbing and has
not been attempted.

### Interface
- Renamed to EDEX throughout; settings live in `~/Library/Application Support/EDEX` and are
  migrated once from the old eDEX-UI folder.
- **Layout fixed for tall, non-16:9 displays.** Key widths were expressed in `vh`, which only
  lines up on 16:9; they are now `vw`, so rows, Enter and the spacebar stay in place.
- **Quiet by default:** no sound on keystrokes, terminal output, modals or directory
  refreshes. Enter keeps its confirmation sound, and the boot theme still plays.
- The glitch title screen is skipped — the boot log hands straight over to the UI.
- `LANG` defaults to `ru_RU.UTF-8` when unset; without it Cyrillic input came out as digits.
- RAM watcher no longer errors out on macOS memory accounting.

### Added
- **"Open in EDEX"** — right-click a folder in Finder, get a terminal in it. The entry sits in
  the main context menu next to Terminal's own, and opens the folder in a free tab when EDEX is
  already running. A small Swift agent embedded in the bundle publishes the service, since
  Electron cannot register one itself. See [extras/](extras/).

## Requirements

macOS on Apple Silicon, Xcode command line tools, Node.js and npm.

Other platforms are inherited from upstream and left untouched — the fork is only tested on
macOS arm64.

## Running from source

```sh
npm run install-darwin   # installs deps and rebuilds node-pty against Electron's ABI
npm start
```

## Checks

```sh
npm run lint   # ESLint, tuned for real defects rather than style
npm test       # unit tests on node:test — escaping, shell quoting, argv and origin checks
```

Anything that needs a running app is in [SMOKE.md](SMOKE.md); run through it after a build.

## Building a distributable

```sh
npm run prebuild-darwin
./node_modules/.bin/electron-builder build -m --dir
npm run postbuild-darwin
```

The app lands in `dist/mac-arm64/EDEX.app`. It is unsigned, so ad-hoc sign it before use:

```sh
codesign --force --deep --sign - dist/mac-arm64/EDEX.app
```

If signing fails with resource-fork or xattr errors, copy the bundle out of any iCloud-synced
folder first (`ditto` to a local path strips the extended attributes that break signing), then
sign and move it into `/Applications`.

## Credits and attribution

eDEX-UI was created by **Gabriel "Squared" SAILLARD** ([gaby.dev](https://gaby.dev)) and
contributors, © 2017–2021. All of the original credits — including IceWolf for the sound
design and Rob "Arscan" Scanlon for the ENCOM Globe — are preserved in
[README.upstream.md](README.upstream.md).

This fork is maintained by Ilya Pitenin and carries no endorsement from the original author.
Please do not report issues with this fork to the upstream project.

## License

GPL-3.0, inherited from eDEX-UI — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

As a derivative work this fork is distributed under the same terms: source is available, the
original copyright notices are kept, and the modifications are documented above and in the
commit history.

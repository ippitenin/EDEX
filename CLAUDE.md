# Working on EDEX

A maintained fork of [eDEX-UI](https://github.com/GitSquared/edex-ui), targeting macOS on Apple
Silicon. Electron 43, `nodeIntegration: true`, no build step for the app code.

## Layout

| Path | What lives there |
|---|---|
| `src/_boot.js` | Main process: config seeding, window creation, the terminal websocket, IPC |
| `src/_renderer.js` | Renderer: UI assembly, settings editor, keyboard shortcuts, window helpers |
| `src/classes/` | One file per UI module — clock, netstat, filesystem, terminal, … |
| `src/utils/` | Pure, side-effect-free helpers; everything here is covered by `test/` |
| `build/` | electron-builder hooks (`afterPack`, `afterSign`) and the dev bundle script |
| `extras/service-helper/` | Swift agent that publishes the "Open in EDEX" Finder service |
| `test/` | `node:test` unit tests, one file per `src/utils/` module |

## Commands

```sh
npm run install-darwin   # deps + node-pty rebuilt against Electron's ABI
npm start                # fast launch; macOS calls it "Electron", see README
npm run start-app        # launches as EDEX through the dev bundle
npm run lint             # ESLint, tuned for defects rather than style
npm test                 # unit tests
npm run build-darwin     # signed .dmg into dist/
```

`SMOKE.md` is the manual checklist for anything that needs a running app. Run it after a build.

## Conventions

- **Comments explain why, not what.** The codebase is full of workarounds for macOS and Electron
  behaviour that look arbitrary without the reason written down. Match that: if a line exists
  because of a platform quirk, say which quirk.
- **New logic worth testing goes in `src/utils/`** as a pure function, with tests beside the
  existing ones. Reach for `extractDirFromArgv`, `isAllowedOrigin`, `pickNextDisplay` and friends
  before writing something similar.
- **The renderer has full Node access**, so anything that reaches the DOM from outside — file names,
  process names, error text — goes through `escapeHtml` / `purifyCSS` / `quoteForShell` in
  `src/utils/sanitize.js`. See `AUDIT.md` for what happens otherwise.
- **Adding a setting touches four places**: the defaults in `_boot.js`, the table row and the
  read-back in `_renderer.js`'s settings editor, and wherever it is consumed. Settings that
  `createWindow` reads need a full restart, not a UI reload.
- Commit subjects are lowercase, `type: what changed and why it mattered` — `fix:`, `feat:`,
  `docs:`, `build:`, `security:`, `refactor:`. Branches are named after the theme (`signing`,
  `encoding`, `hardening`) and merged with `--no-ff`.

## Things that will bite

- **Builds must land outside the project.** macOS hangs an empty `com.apple.FinderInfo` on bundle
  directories in watched locations like the Desktop, and `codesign` refuses to sign anything
  carrying it. Output goes to `~/Library/Caches/edex-build/`. Removing the attribute needs
  `xattr -r -d com.apple.FinderInfo`; `xattr -cr` gives up before reaching it.
- **Signing is what keeps granted permissions.** macOS binds TCC grants to the code signing
  requirement. With a certificate that requirement names the bundle id and the certificate and
  survives rebuilds; ad-hoc it falls back to the build's hash and every rebuild re-asks for
  everything. The identity is in `build/signing.env`, git-ignored.
- **`prebuild-src/` is a build artifact.** `prebuild-darwin` rsyncs `src/` into it and minifies;
  delete it before a build rather than letting rsync merge into leftovers.
- **The layout assumes 16:9.** Sizes are in `vh`/`vw`, and other ratios are patched by exact
  `@media (aspect-ratio: …)` rules in `assets/css/extra_ratios.css`, which do not match arbitrary
  window sizes. `keepGeometry` pulls the window back to 16:9 after a resize.
- **Settings live in `~/Library/Application Support/EDEX`** and are migrated once from the old
  `eDEX-UI` folder. Defaults are merged into an existing config on launch, so a new key reaches
  people who already have one — but values already in the file are never overwritten.
- **`app.setName()` does not rename the app** as far as macOS is concerned; the name comes from the
  running bundle's `Info.plist`. That is what `build/dev-app.js` exists for.

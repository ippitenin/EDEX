# Extras

## "Open in EDEX" — Finder quick action

Adds a Finder context-menu entry: right-click a folder → **Open in EDEX** → a terminal opens
in that directory. If EDEX is already running, the folder opens in a free tab instead of
launching a second instance.

### Install

```sh
cp -R "extras/Open in EDEX.workflow" ~/Library/Services/
```

The entry shows up in Finder's context menu right away — no logout needed. If you don't see
it, enable it under `System Settings → General → Quick Actions` (older macOS:
`Keyboard → Quick Actions`).

### Renaming it

The menu entry takes its name from the workflow's filename, so rename the bundle to whatever
suits your system language — `Открыть в EDEX.workflow`, `Im EDEX öffnen.workflow` — and the
menu follows. For consistency, also update `NSMenuItem → default` in
`Contents/Info.plist`; macOS falls back to it in some contexts.

### Configuration

The workflow shells out to:

```sh
EDEX_BIN="/Applications/EDEX.app/Contents/MacOS/EDEX"
```

If the app lives somewhere else, edit that path in `Contents/document.wflow`, or open the
workflow in Automator and edit the script there.

### How it works

Launching the binary with a folder path in argv is handled in `src/_boot.js`:

- on a cold start, `extractDirFromArgv()` overrides the start directory;
- if an instance is already running, `second-instance` fires and the path is forwarded to the
  window as an `open-dir-tab` event, which `src/_renderer.js` opens in a free tab.

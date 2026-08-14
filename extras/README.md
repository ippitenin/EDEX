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

### Localisation

The entry follows the system language. `NSMenuItem` in `Contents/Info.plist` holds one key
per locale, with `default` as the fallback:

```xml
<key>NSMenuItem</key>
<dict>
	<key>default</key>
	<string>Open in EDEX</string>
	<key>ru</key>
	<string>Открыть в EDEX</string>
</dict>
```

Add a key for any locale you want — `de`, `fr`, `ja`. This is the same mechanism Terminal
uses for its own "New Terminal at Folder" service. After editing, reinstall the bundle and
run `/System/Library/CoreServices/pbs -flush && killall Finder` to refresh the menu.

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

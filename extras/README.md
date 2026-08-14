# Extras

## "Open in EDEX" — Finder context menu entry

Right-click any folder in Finder and pick **Open in EDEX** to get a terminal in it. If EDEX is
already running, the folder opens in a free tab instead of launching a second instance.

The entry sits in the main context menu, alongside Terminal's own "New Terminal at Folder" —
no submenu, no checkbox to enable first.

## How it works

macOS puts an entry in that part of the menu only when an **application** publishes it through
`NSServices` in its own Info.plist. Electron has no API for registering a services provider, so
`service-helper/` is a small Swift agent that does it:

- macOS launches the agent when the entry is picked and hands it the selected folder
- the agent forwards the path to EDEX — re-executing the binary if the app is already running,
  so Electron's single-instance lock routes it through `second-instance` to a free tab
- the agent exits a few seconds later; it is `LSUIElement`, so it never shows up in the Dock

The built agent lives at `EDEX.app/Contents/Library/Services/EDEX Service.app`. Because it
belongs to a real bundle, the menu entry also picks up the EDEX icon.

### Why not an Automator quick action

An Automator workflow dropped in `~/Library/Services` was the first approach, and it is the
wrong one. Since Mojave such workflows always land under **Quick Actions**, have to be enabled
by hand in System Settings, and render with a fixed generic glyph that cannot be replaced.

## Building it

The helper is compiled and embedded automatically by `build/afterPack.js` on every
`electron-builder` run — no manual step. It needs the Xcode command line tools; without
`swiftc` the build still succeeds and simply ships without Finder integration.

To build it standalone:

```sh
swiftc -O -framework Cocoa -o "EDEX Service" extras/service-helper/main.swift
```

Then assemble a bundle with `Contents/MacOS/EDEX Service`, `Contents/Info.plist` (from
`extras/service-helper/`) and `Contents/Resources/icon.icns`.

## Localisation

The entry follows the system language. `NSMenuItem` in `service-helper/Info.plist` holds one
key per locale, with `default` as the fallback:

```xml
<key>NSMenuItem</key>
<dict>
	<key>default</key>
	<string>Open in EDEX</string>
	<key>ru</key>
	<string>Открыть в EDEX</string>
</dict>
```

Add a key for any locale you want — `de`, `fr`, `ja`. This is the same mechanism Terminal uses
for its own service.

## Troubleshooting

If the entry does not show up after installing a new build:

```sh
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/EDEX.app
/System/Library/CoreServices/pbs -flush
killall Finder
```

To confirm macOS sees the service at all:

```sh
/System/Library/CoreServices/pbs -dump | grep -A6 "com.edex.ui.service"
```

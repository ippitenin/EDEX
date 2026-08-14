# Smoke checklist

Run this after every build that changes the renderer, the terminal backend or the packaging.
The automated checks (`npm run lint`, `npm test`) cover the pieces that can be tested in
isolation; everything below needs a running app and a pair of eyes.

Build and install first:

```sh
npm run prebuild-darwin
CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder build -m --dir
npm run postbuild-darwin
```

Then sign ad-hoc and copy into `/Applications` (see README), and launch from Finder — not from
a terminal session, or the shell inherits that session's environment.

## Start-up

- [ ] Boot log scrolls, then the interface appears without the glitch title screen
- [ ] No error dialog on launch
- [ ] Window fills the screen; keyboard rows, Enter and spacebar line up, nothing overflows
- [ ] Clock, uptime, CPU graphs, memory grid and network panel all show live values

## Terminal

- [ ] Prompt appears in the main tab, shell is zsh, starting directory is home
- [ ] Typing works, including Cyrillic — characters appear as letters, not digit sequences
- [ ] Keystrokes are silent; Enter plays its confirmation sound
- [ ] `ls`, `cd ..`, `cd ~` — output renders, no sound on output
- [ ] Tab title shows the running process (run `top`, then quit it)
- [ ] Copy and paste through the app shortcuts

## Tabs

- [ ] Click each of the four EMPTY tabs in turn — every one opens a working shell
- [ ] Click them rapidly one after another — no `{"isTrusted":true}`, no error dialog
- [ ] Switch between tabs; each keeps its own directory and history
- [ ] Exit a shell with `exit` — the tab returns to EMPTY and focus moves to the previous tab

## Filesystem pane

- [ ] Follows the terminal: `cd` somewhere and the listing changes with it
- [ ] Click a folder to enter it, `..` to go back
- [ ] Disk usage bar shows a mount name and a percentage
- [ ] Open a folder holding a file named `<img src=x onerror=alert(1)>` — the name is shown as
      text, no dialog, nothing executes
- [ ] Click an image, a video and a PDF — each opens in its viewer and plays or renders
- [ ] Close a media modal; playback stops

## Finder integration

- [ ] Right-click a folder in Finder with EDEX closed → **Открыть в EDEX** → app starts in that
      folder
- [ ] Same with EDEX already running → folder opens in a free tab
- [ ] With all five tabs occupied → an explanatory dialog, no crash
- [ ] Try it on a folder whose name contains a space and an apostrophe

## Settings and shortcuts

- [ ] Open settings, change the theme, apply — colours change without a restart
- [ ] Switch the keyboard layout — the on-screen keyboard redraws
- [ ] Open the shortcuts help
- [ ] Trigger a shell-type shortcut from `shortcuts.json` — the command is typed into the
      terminal (this path was broken until the audit)

## Network behaviour

- [ ] Globe renders and rotates; connection list populates
- [ ] Turn Wi-Fi off: the network panel switches to offline **without** an error dialog
- [ ] Turn it back on: values resume

## Shutdown

- [ ] Quit with the app shortcut — no lingering EDEX processes:
      `pgrep -fl EDEX` prints nothing afterwards

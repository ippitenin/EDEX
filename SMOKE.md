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
- [ ] Window fills the work area with a title bar; close, minimise and zoom buttons are there
- [ ] Keyboard rows, Enter and spacebar line up, nothing overflows
- [ ] Window drags by its title bar and resizes; leaving fullscreen does not shrink it to a stamp
- [ ] `Ctrl+Shift+M` sends the window to the next display and back — in a window and in fullscreen
- [ ] Clock, uptime, CPU graphs, memory grid and network panel all show live values

## Terminal

- [ ] Prompt appears in the main tab, shell is zsh, starting directory is home
- [ ] Typing works, including Cyrillic — characters appear as letters, not digit sequences
- [ ] Keystrokes are silent; Enter plays its confirmation sound
- [ ] `ls`, `cd ..`, `cd ~` — output renders, no sound on output
- [ ] Tab title shows the running process (run `top`, then quit it)
- [ ] Copy and paste through the app shortcuts

## On-screen keyboard

Keys used to light up only when the character typed existed in the on-screen layout, so under a
Russian input source the letters stayed dark.

- [ ] Type with an English input source — every key lights up under its own label
- [ ] Switch macOS to Russian and type letters, digits and punctuation — the key in the same
      physical position lights up, with and without Shift
- [ ] Space, Enter, Backspace, arrows and the modifiers still light up in both

## Dropping files

- [ ] Drag a file from Finder onto the window at a shell prompt — its path is typed in, escaped
      with backslashes and followed by a space; nothing runs
- [ ] Drop two files at once — two paths, separated by a space
- [ ] Drop a file whose name has a space, an apostrophe and Cyrillic, then press Enter after
      `ls -l ` — the shell finds it
- [ ] Inside `claude`, drop an image — it becomes `[Image #1]`; drop two — `#1` and `#2`
- [ ] Drag the thumbnail of a fresh screenshot in — same result
- [ ] Open settings and drop a file — nothing appears in the terminal behind the modal

## Tabs

- [ ] Click each of the four EMPTY tabs in turn — every one opens a working shell
- [ ] Click them rapidly one after another — no `{"isTrusted":true}`, no error dialog
- [ ] Switch between tabs; each keeps its own directory and history
- [ ] Exit a shell with `exit` — the tab returns to EMPTY and focus moves to the previous tab

## Busy ports

A dev server on port 3000 used to crash EDEX on launch with `EADDRINUSE`.

- [ ] Hold the port — `nc -l 127.0.0.1 3000` in another terminal — and launch EDEX: no error
      dialog, the main terminal works
- [ ] With `nc -l 127.0.0.1 3002` held as well, open a tab — it opens on another port (the tab
      title shows `::<port>`); close it with `exit` and open it again — the slot is reusable
- [ ] Reload the UI (`Ctrl+Shift+F5`) while the port is shifted — the terminal reconnects

## Filesystem pane

- [ ] Follows the terminal: `cd` somewhere and the listing changes with it
- [ ] Click a folder to enter it, `..` to go back
- [ ] Disk usage bar shows a mount name and a percentage
- [ ] Open a folder holding a file named `<img src=x onerror=alert(1)>` — the name is shown as
      text, no dialog, nothing executes
- [ ] Open a folder with Russian and English names side by side — both are drawn with strokes of
      the same weight, and a name mixing the two (`Доступы.md`) reads as one font
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

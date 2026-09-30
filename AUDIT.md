# Code audit — 2026-08-15

A full pass over the fork's own code: `src/_boot.js`, `src/_renderer.js`, `src/ui.html` and the
18 classes then in `src/classes/`. The vendored `src/assets/vendor/encom-globe.js` was reviewed only
at its call sites.

Everything below is inherited from upstream eDEX-UI v2.2.8 unless noted. Findings are ordered by
severity; each names the file, the data source, and how it goes wrong.

**Status: all findings below are fixed**, apart from the two recorded as accepted (16) and
deferred (out of scope). Two of them — 15 and 18 — were marked fixed here in August but were not;
they were closed in the [follow-up](#follow-up--2026-09-30), which also lists what that pass found
and what is still open. See `git log` for the commit that addresses each one, and `SMOKE.md` for
what to re-check after a build.

Line numbers refer to the code as it was at `8f9b2cc`, when this was written.

A second set of defects surfaced once ESLint was in place — they are listed under "Found while
fixing" at the end.

## The multiplier

The renderer runs with `nodeIntegration: true` and `contextIsolation: false`
(`src/_boot.js:234`). There is no boundary between page content and the operating system: any
markup injected into the UI executes with the user's full privileges — reading files, spawning
processes, opening sockets.

That is why every unescaped interpolation below is not a cosmetic bug but a remote code execution
path. The escaping helper `window._escapeHtml` exists (`src/_renderer.js:6`) and is correct; it is
simply not applied everywhere.

Removing the multiplier itself (preload bridge + context isolation) is out of scope for this pass —
see the closing section.

---

## Critical — code execution through injected markup

### 1. Process names in the top list
`src/classes/toplist.class.js:50` and `:180`

`proc.name`, `proc.user`, `proc.state` and `proc.started` come from `systeminformation` and land in
`innerHTML` raw, both in the sidebar top-five and in the full "Active Processes" window.

*Scenario:* name any executable `<img src=x onerror="...">` and run it. As soon as it enters the
top five by CPU — or the process window is opened — the payload executes. No privileges needed
beyond writing a file.

### 2. Process name in the tab title
`src/_renderer.js:495` and `:587`

The foreground process reported by the tty tracker is interpolated into the tab label. Same source
class as above, reached by simply running a badly named binary in the terminal.

### 3. Keyboard layout files
`src/classes/keyboard.class.js:5` and `:72`

A layout is `JSON.parse`d from the user's layouts directory and `keyObj.name` is written straight
into a key's `innerHTML`. eDEX invites users to download community layouts; one hostile file is a
full compromise.

### 4. Update checker
`src/classes/updateChecker.class.js:57`

The GitHub API response — `release.tag_name` and `release.html_url` — is interpolated into markup
*including an `onclick` attribute*. Remote data, in an executable context, fetched on every start.
The check also points at the upstream repository, which this fork does not publish to.

*Resolution: the class is removed entirely rather than patched.*

### 5. Modal titles and messages
`src/classes/modal.class.js:52-53`

Neither `title` nor `message` is escaped. Callers pass file names, mount points and error strings.
This is what turns findings 6 and 7 from noise into working payloads.

### 6. Volume names
`src/classes/filesystem.class.js:528,533`

The mount point label is unescaped. A mounted disk image whose name carries markup fires as soon as
the filesystem pane refreshes — and volume names are attacker-controlled in any downloaded `.dmg`.

### 7. Global error handler
`src/_renderer.js:34`

Error text, file path, line and column are appended to the boot screen unescaped. Error messages
routinely quote file names, so a crafted name reaches the DOM through a failure path.

### 8. CPU model and user name
`src/classes/cpuinfo.class.js:27`, `src/_renderer.js:400`

Same class of defect, low practical reach — both values would have to be forged at the OS level.
Fixed for consistency.

---

## High — known vulnerable dependency

### 9. pdfjs-dist 2.16.105
`npm audit`: GHSA-wgrm-67xf-hhpq, arbitrary JavaScript execution from a crafted PDF.

The fork already passes `isEvalSupported: false` (`src/classes/docReader.class.js`), which closes
the published vector, but the library stays several major versions behind its fixes.

---

## Medium — functional defects

### 10. Race when opening a terminal tab
`src/_boot.js:350-379` with `src/_renderer.js:564-575`

The `Terminal` constructor creates the WebSocket server, and `ttyspawn-reply: SUCCESS` is sent
synchronously right after — before the socket is listening. The renderer connects immediately, hits
a refused connection, and `onerror` throws.

*This is the `{"isTrusted":true}` dialog observed in use.* It is timing-dependent, which is why the
main tab (created while the UI is still loading) never shows it and extra tabs sometimes do.

### 11. Network errors become modal dialogs
`src/classes/netstat.class.js:53`

`.catch(e => {throw e})` rethrows a GeoIP lookup failure into the global handler, so losing
connectivity pops an error window over the terminal.

### 12. Process window keeps polling after it closes
`src/classes/toplist.class.js:218,240`

`clearInterval` in the close callback is commented out; the interval only stops on its next tick via
a `removed` flag, so the window fires one more full process query after being dismissed.

### 13. Broken fallback in modal id generation
`src/classes/modal.class.js:10`

The collision branch calls `require("nanoid")()`, but nanoid 3 exports an object — this throws
`TypeError` instead of generating an id. Unreachable in practice, wrong in principle.

---

## Low — hygiene

### 14. Thrown strings instead of Errors
13 sites across the classes (`throw "Missing parameters"`). No stack trace, and `instanceof Error`
checks slide past them.

### 15. Theme name is not constrained to the themes directory
`src/_renderer.js:73,75` — `require(path.join(themesDir, settings.theme + ".json"))`. A crafted
settings file can traverse out of the directory. Requires editing one's own config, so the practical
risk is negligible, but the value should be constrained to a file name.

### 16. Content-Security-Policy allows inline script
`src/ui.html:5` — `default-src file: 'unsafe-inline'`. Required by the codebase's `onclick="…"`
pattern; meaningless as a boundary while node integration is on. Recorded, not fixed.

---

## Verified as sound

- `window._escapeHtml` — correct, covers the five significant characters.
- `window._purifyCSS` — strips `<`, so a theme cannot break out of `<style>`; external URLs in
  themes are additionally blocked by the CSP's `file:` restriction.
- File names in the filesystem pane and the fuzzy finder — escaped at construction
  (`src/classes/filesystem.class.js:193`).
- `eval` is disabled globally (`src/_renderer.js:1`).
- The terminal websocket binds to loopback and verifies `Origin` (fork change).
- Shell commands interpolate only numeric pids — no injection surface.
- Timers: 20 intervals against 6 clears, but the difference is dashboard updaters that legitimately
  live for the process lifetime. Only finding 12 is a real leak.

---

## Found while fixing

ESLint, added as part of this pass, immediately surfaced defects the reading missed. All fixed.

### 17. Shell-type keyboard shortcuts never worked
`src/classes/keyboard.class.js:384`

`let fn = (cut.linebreak) ? writelr : write;` — the method names were written as bare
identifiers rather than strings, so every shell shortcut threw a ReferenceError instead of
typing its command. The feature was broken for as long as it has existed.

### 18. Queued PDF page never rendered
`src/classes/docReader.class.js:32`

`renderPage(pageNumPending)` instead of `this.renderPage(…)`. Flipping pages faster than they
render threw, and the queued page was dropped.

### 19. Command injection through the fuzzy finder
`src/classes/fuzzyFinder.class.js:128`

The selected path was typed into the shell wrapped in hand-written single quotes. A file named
`don't` broke the command; a file named `'; rm -rf ~; '` ran it. Now quoted through
`quoteForShell`, which is covered by round-trip tests against `/bin/sh`.

### 20. The minifier skipped most of the source tree
`prebuild-minify.js:32,34`

The `.json` and `file-icons-match.js` filters used `return`, which abandons the whole directory
rather than skipping one file. Everything sorted after the first `.json` — including entire
subdirectories — shipped unminified.

---

## Out of scope

Context isolation with a preload bridge. It is the one change that would downgrade every finding
above from "system compromise" to "broken pixels", and it means rewriting how the window talks to
the main process. Deliberately deferred — the fixes here stand on their own.

---

## Follow-up — 2026-09-30

A second pass, made while refactoring the code that had grown since August. Line numbers here
refer to the code before the `refactor` branch; the commits on that branch say where each fix
landed.

### Corrections to the list above

- **15 was never fixed.** The theme name still went into `require()` unconstrained. Theme and
  keyboard layout names now go through `resolveNamedFile`, which refuses anything with a path
  separator or a dot entry.
- **18 was fixed only halfway.** The call gained its `this.`, but it sat inside plain `function`
  callbacks, where `this` is undefined in a class body, so a queued page still threw. The callbacks
  are arrow functions now.
- **"File names in the filesystem pane … escaped at construction"** held for the listing and
  nowhere else, and storing the name pre-escaped caused a finding of its own (21).
- **"The terminal websocket … verifies Origin"** is true, but its one-client limit compared
  `clients.length` on a `Set` and never applied (24).

### Found and fixed

21. **A folder's name ran as a command when it was clicked** — `src/classes/filesystem.class.js`.
    The panel typed `cd "<name>"` into the shell and pressed Enter; double quotes leave `$(…)` and
    backticks live. Shift-click and the disks view did the same with paths. Everything now goes
    through `quoteForShell`, and the names are stored raw so `R&D` is no longer sent as `R&amp;D`.
22. **Strings from the disk inside `onclick` attributes** — theme and layout names, mount points,
    and the path for "Save to Disk". HTML escaping is undone before the handler runs, so a quote in
    a name broke out. Handlers now carry only an index, and `Modal` accepts functions as actions.
23. **Unescaped markup in the filesystem panel and the editors** — volume labels and mount points
    in the disks view, the contents of a text file in the editor (`</textarea>` closed it), every
    value of `settings.json` in the settings editor, triggers and commands in the shortcuts help,
    and layout row names used as element ids.
24. **The terminal socket accepted more than one client** — `src/classes/terminal.class.js`. The
    limit is meant to back up the Origin check, which lets a client without an Origin through.
25. **Crashes and dead ends in the main process** — quitting before the main terminal existed, a
    reserved tab slot without `close()`, a rejected `ready` handler leaving the app with no window
    and no dialog, a tab whose socket failed leaving its shell running, a closed tab's timer and
    IPC listener outliving it, any value in `shellArgs` stopping the terminal from starting
    (node-pty refuses a string), and a non-numeric port collapsing the tab slots.
26. **Crashes in the renderer** — the editor opening on the text `undefined` after a read error
    (and Save writing it over the file), the filesystem panel dying for good on an unreadable
    directory or an entry deleted mid-read, the fuzzy finder with no results or opened twice,
    a shortcut with a modifier other than Ctrl, Alt or Shift, and `env` being saved as
    `"[object Object]"`.

### Still open

Found in the same pass and left for their own changes, as none of them is a security issue or a
crash:

- **On-screen keyboard:** CapsLock always ends up off after a physical CapsLock press
  (`keyboard.class.js`, two `if`s in a row); the cedilla dead key never releases; Ctrl+T sends ^R
  (`CTRLSEQ[9]` repeats `[8]`, as upstream shipped it); acute on `E` gives `E`. The tables in
  `src/utils/keyboard.js` reproduce these on purpose — the test fixture records the old behaviour.
- **Panels that stop updating:** the CPU graphs freeze for good if systeminformation once answers
  without per-core data (`cpuinfo.class.js`, `updatingCPUload` stays set), and the memory panel
  does the same on a throw inside its update.
- **Listener leaks:** the media player adds three document listeners per file opened, and
  `remakeKeyboard` keeps adding touch and blur listeners to the reused container.
- **Terminal client:** the F11 handler is bound to the first tab's textarea whichever tab is
  created; `cursorBlink || true` is always true.
- **Settings editor:** a volume of 0 shows and saves as 1.0.
- **Disk usage:** the fallback percentage is computed as size / used instead of used / size.
- **Tabs:** `ttyspawn-reply` carries no request id, so two tabs spawned at the same moment could
  both take the first answer.
- **Netstat:** `new require("https").Agent(…)` only works because Node lets `Agent` be called
  without `new`.
- **System panel:** between 23:59:00 and midnight the date updater reschedules itself with a zero
  delay, spinning for up to a minute.
- **Dev bundle:** `build/dev-app.js` only rebuilds when the Electron version changes, so its
  version string and its link to `src/` go stale after a version bump or a move of the checkout.
- **Shortcuts:** deleting the example `neofetch` shortcut brings it back on the next launch, since
  defaults are matched by type and action.
- **Dependencies:** `npm audit` reports high severity advisories against Electron 43.4.0 and its
  bundled `undici`.


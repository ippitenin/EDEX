# Code audit — 2026-08-15

A full pass over the fork's own code: `src/_boot.js`, `src/_renderer.js`, `src/ui.html` and the
17 classes in `src/classes/`. The vendored `src/assets/vendor/encom-globe.js` was reviewed only
at its call sites.

Everything below is inherited from upstream eDEX-UI v2.2.8 unless noted. Findings are ordered by
severity; each names the file, the data source, and how it goes wrong.

**Status: all findings below are fixed**, apart from the two recorded as accepted (16) and
deferred (out of scope). See `git log` for the commit that addresses each one, and `SMOKE.md`
for what to re-check after a build.

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

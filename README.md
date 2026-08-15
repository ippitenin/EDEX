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
npm run build-darwin
```

That is the whole thing — npm runs `prebuild-darwin` and `postbuild-darwin` around it. The app is
built and signed under `~/Library/Caches/edex-build/`, and the finished `.dmg` is copied into
`dist/`.

The output lives outside the project on purpose. macOS asynchronously puts an empty
`com.apple.FinderInfo` on bundle directories in watched locations like the Desktop, and `codesign`
refuses to sign anything carrying it — so a build inside such a folder fails partway through
signing the nested bundles, unpredictably.

### Signing, and why it matters here

macOS binds granted permissions — Desktop, Documents, Downloads, Photos, Apple Music — to the
app's code signing requirement. Signed with a certificate that requirement names the bundle id and
the certificate, so it survives rebuilds and the permissions stay granted. Signed ad-hoc there is
no certificate to name and macOS falls back to the hash of the build itself, which changes every
time you rebuild: every rebuild looks like a brand new app and re-asks for everything.

The build signs ad-hoc unless you point it at a certificate, which is fine for a one-off build and
tiresome if you rebuild often. To set one up, create a self-signed code signing certificate:

```sh
openssl req -x509 -newkey rsa:2048 -sha256 -days 7300 -nodes \
  -keyout key.pem -out cert.pem -subj "/CN=EDEX Local Signing" \
  -addext "basicConstraints=critical,CA:false" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning"

openssl pkcs12 -export -legacy -out cert.p12 -inkey key.pem -in cert.pem \
  -name "EDEX Local Signing" -passout pass:changeit
security import cert.p12 -k ~/Library/Keychains/login.keychain-db -P changeit -T /usr/bin/codesign
security add-trusted-cert -r trustRoot -p codeSign -k ~/Library/Keychains/login.keychain-db cert.pem
```

The last command asks for your password and is what makes electron-builder able to find the
certificate — it only looks at identities that are trusted for code signing. Confirm with
`security find-identity -v -p codesigning`, delete `key.pem` and `cert.p12` (the private key now
lives in the keychain), then name the certificate in `build/signing.env`, which is git-ignored:

```sh
export CSC_NAME="EDEX Local Signing"
```

A self-signed certificate solves the rebuild problem on your own machine and nothing else. It
means nothing to anyone else's Mac: Gatekeeper will still refuse a downloaded build until the user
allows it by hand. Distributing without that warning needs an Apple Developer ID and notarisation.

`mac.timestamp` is set to `none` deliberately. A trusted timestamp keeps a signature valid past the
certificate's expiry, which is pointless for a local certificate good until 2046, and it costs a
network round-trip to Apple for each of the ~230 nested objects being signed — the difference
between a build that takes ten minutes and one that takes eighty seconds. Notarised distribution
builds do need it; remove the line if that ever becomes the goal.

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

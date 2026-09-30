const signale = require("signale");
const electron = require("electron");
const {app, BrowserWindow, dialog, shell, ipcMain: ipc} = electron;
const fs = require("fs");
const path = require("path");
const url = require("url");
const which = require("which");
const remoteMain = require("@electron/remote/main");
const Terminal = require("./classes/terminal.class.js").Terminal;
const {findFreePort} = require("./utils/net.js");
const {extractDirFromArgv, pickStartDisplay, resolveSpawnCwd, firstFreeSlot} = require("./utils/system.js");
const {mergeMissingSettings, mergeMissingShortcuts, buildShellEnv, preferredPort} = require("./utils/config.js");

// Declared ahead of everything that can throw: the crash handler below reads them, and a let still
// in its temporal dead zone would turn the crash report itself into a ReferenceError.
let win = null;
let tty = null;
let extraTtys = null;

// Keep config under EDEX; migrate from the historical eDEX-UI folder if present. This runs before
// the single-instance lock, whose files live in userData — the folder has to be settled first.
function useUserDataDir() {
    const newUserData = path.join(app.getPath("appData"), "EDEX");
    const oldUserData = path.join(app.getPath("appData"), "eDEX-UI");
    try {
        if (!fs.existsSync(newUserData) && fs.existsSync(oldUserData)) {
            fs.renameSync(oldUserData, newUserData);
        }
    } catch {
        // Migration is best-effort; fall back to a fresh config dir
    }
    app.setPath("userData", newUserData);
}
useUserDataDir();

function closeExtraTtys() {
    Object.keys(extraTtys).forEach(key => {
        if (extraTtys[key] !== null) {
            extraTtys[key].close();
        }
    });
}

function fatal(e) {
    signale.fatal(e);
    dialog.showErrorBox("EDEX crashed", e.message || "Cannot retrieve error message.");
    if (tty) {
        tty.close();
    }
    if (extraTtys) {
        closeExtraTtys();
    }
    process.exit(1);
}
process.on("uncaughtException", fatal);

signale.start(`Starting EDEX v${app.getVersion()}`);
signale.info(`With Node ${process.versions.node} and Electron ${process.versions.electron}`);
signale.info(`Renderer is Chrome ${process.versions.chrome}`);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    signale.fatal("Error: Another instance of EDEX is already running. Cannot proceed.");
    app.exit(1);
}

// A second launch with a folder argument opens that folder in a new tab of the running instance
app.on("second-instance", (e, argv) => {
    const dir = extractDirFromArgv(argv);
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
        if (dir) win.webContents.send("open-dir-tab", dir);
    }
});

signale.time("Startup");

remoteMain.initialize();

ipc.on("log", (e, type, content) => {
    signale[type](content);
});

const userData = app.getPath("userData");
const settingsFile = path.join(userData, "settings.json");
const shortcutsFile = path.join(userData, "shortcuts.json");
const lastWindowStateFile = path.join(userData, "lastWindowState.json");
const themesDir = path.join(userData, "themes");
const innerThemesDir = path.join(__dirname, "assets/themes");
const kblayoutsDir = path.join(userData, "keyboards");
const innerKblayoutsDir = path.join(__dirname, "assets/kb_layouts");
const fontsDir = path.join(userData, "fonts");
const innerFontsDir = path.join(__dirname, "assets/fonts");

// Unset proxy env variables to avoid connection problems on the internal websockets
// See #222
if (process.env.http_proxy) delete process.env.http_proxy;
if (process.env.https_proxy) delete process.env.https_proxy;

// Bypass GPU acceleration blocklist, trading a bit of stability for a great deal of performance, mostly on Linux
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-video-decode");

// A fresh install has no config folder yet, and everything below writes into it. Upstream first
// hit this on Windows, but it holds on every platform.
try {
    fs.mkdirSync(userData);
    signale.info(`Created config dir at ${userData}`);
} catch {
    signale.info(`Base config dir is ${userData}`);
}
// Defaults are seeded on first run and topped up on every later one: a key or a shortcut added in a
// new version has to reach the people who already have a config, not just fresh installs. Values
// that are already in the file are never touched — this fills gaps, it does not reset preferences.
const defaultSettings = {
    shell: (process.platform === "win32") ? "powershell.exe" : "bash",
    shellArgs: '',
    cwd: userData,
    keyboard: "en-US",
    theme: "tron",
    termFontSize: 15,
    audio: true,
    audioVolume: 1.0,
    disableFeedbackAudio: false,
    clockHours: 24,
    pingAddr: "1.1.1.1",
    port: 3000,
    nointro: false,
    nocursor: false,
    forceFullscreen: false,
    allowWindowed: false,
    excludeThreadsFromToplist: true,
    hideDotfiles: false,
    fsListView: false,
    experimentalGlobeFeatures: false,
    experimentalFeatures: false
};

const defaultShortcuts = [
    { type: "app", trigger: "Ctrl+Shift+C", action: "COPY", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+V", action: "PASTE", enabled: true },
    { type: "app", trigger: "Ctrl+Tab", action: "NEXT_TAB", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+Tab", action: "PREVIOUS_TAB", enabled: true },
    { type: "app", trigger: "Ctrl+X", action: "TAB_X", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+S", action: "SETTINGS", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+K", action: "SHORTCUTS", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+F", action: "FUZZY_SEARCH", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+L", action: "FS_LIST_VIEW", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+H", action: "FS_DOTFILES", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+M", action: "NEXT_MONITOR", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+P", action: "KB_PASSMODE", enabled: true },
    { type: "app", trigger: "Ctrl+Shift+I", action: "DEV_DEBUG", enabled: false },
    { type: "app", trigger: "Ctrl+Shift+F5", action: "DEV_RELOAD", enabled: true },
    { type: "shell", trigger: "Ctrl+Shift+Alt+Space", action: "neofetch", linebreak: true, enabled: false }
];

// A config we cannot parse is left strictly alone: overwriting it would throw away settings the
// user can still rescue by hand.
function readConfig(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
        signale.warn(`Could not parse ${file}, leaving it as it is`);
        return null;
    }
}

function seedSettings(file, defaults) {
    const merged = mergeMissingSettings(readConfig(file, {}), defaults);
    if (!merged || !merged.added.length) return;

    fs.writeFileSync(file, JSON.stringify(merged.settings, "", 4));
    signale.info(`Seeded ${merged.added.length} setting(s) in ${file}: ${merged.added.join(", ")}`);
}

function seedShortcuts(file, defaults) {
    const merged = mergeMissingShortcuts(readConfig(file, []), defaults);
    if (!merged || !merged.added.length) return;

    fs.writeFileSync(file, JSON.stringify(merged.shortcuts, "", 4));
    signale.info(`Seeded ${merged.added.length} shortcut(s) in ${file}: ${merged.added.map(cut => cut.action).join(", ")}`);
}

function seedWindowState(file) {
    if (fs.existsSync(file)) return;
    fs.writeFileSync(file, JSON.stringify({
        useFullscreen: true
    }, "", 4));
    signale.info(`Default last window state written to ${file}`);
}

// The renderer loads themes, layouts and fonts from the config folder, next to the ones people add
// themselves. The built-in ones are copied there on every launch, so an update reaches them too.
// Plain read and write rather than copyFileSync: these come out of app.asar in a build, and that is
// the path Electron's asar support is known to handle.
function mirrorAssets() {
    signale.pending("Mirroring internal assets...");
    [
        {from: innerThemesDir, to: themesDir, encoding: "utf-8"},
        {from: innerKblayoutsDir, to: kblayoutsDir, encoding: "utf-8"},
        {from: innerFontsDir, to: fontsDir, encoding: null}
    ].forEach(({from, to, encoding}) => {
        try {
            fs.mkdirSync(to);
        } catch {
            // Folder already exists
        }
        fs.readdirSync(from).forEach(file => {
            fs.writeFileSync(path.join(to, file), fs.readFileSync(path.join(from, file), {encoding}));
        });
    });
}

// Inherited from upstream, where the update checker read it back. Nothing does any more, but the
// file sits in existing config folders and stays accurate this way.
function logVersion() {
    const versionHistoryPath = path.join(userData, "versions_log.json");
    const versionHistory = fs.existsSync(versionHistoryPath) ? require(versionHistoryPath) : {};
    const version = app.getVersion();
    if (typeof versionHistory[version] === "undefined") {
        versionHistory[version] = {
            firstSeen: Date.now(),
            lastSeen: Date.now()
        };
    } else {
        versionHistory[version].lastSeen = Date.now();
    }
    fs.writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, 0, 2), {encoding:"utf-8"});
}

seedSettings(settingsFile, defaultSettings);
seedShortcuts(shortcutsFile, defaultShortcuts);
seedWindowState(lastWindowStateFile);
mirrorAssets();
logVersion();

function createWindow(settings) {
    signale.info("Creating window...");

    const display = pickStartDisplay(electron.screen.getAllDisplays(), electron.screen.getPrimaryDisplay(), settings.monitor);
    // workArea, not bounds: with a title bar the window would otherwise sit under the menu bar and
    // the Dock. Upstream added a pixel to each side to guarantee full coverage of the screen, which
    // only made sense for a frameless window that was never meant to be moved.
    let {x, y, width, height} = display.workArea;
    win = new BrowserWindow({
        title: "EDEX",
        x,
        y,
        width,
        height,
        show: false,
        resizable: true,
        movable: true,
        fullscreen: settings.forceFullscreen || false,
        // Passing fullscreen: false explicitly is enough for Electron to mark the window as not
        // fullscreenable, and macOS then draws the green button as a zoom "+" that merely fills the
        // work area instead of the arrows that enter real fullscreen.
        fullscreenable: true,
        autoHideMenuBar: true,
        frame: true,
        backgroundColor: '#000000',
        webPreferences: {
            devTools: true,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: true,
            nodeIntegration: true,
            nodeIntegrationInSubFrames: false,
            allowRunningInsecureContent: false,
            experimentalFeatures: settings.experimentalFeatures || false
        }
    });

    remoteMain.enable(win.webContents);

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'ui.html'),
        protocol: 'file:',
        slashes: true
    }));

    signale.complete("Frontend window created!");
    win.show();
    // Only matters with forceFullscreen on: the window then opens fullscreen, unless the last
    // session left fullscreen with the toggle the renderer records in lastWindowState.json.
    if (settings.forceFullscreen && !require(lastWindowStateFile)["useFullscreen"]) {
        win.setFullScreen(false);
    }

    signale.watch("Waiting for frontend connection...");
}

function startTty(settings, env, cwd, port) {
    return new Terminal({
        role: "server",
        shell: settings.shell,
        params: settings.shellArgs || '',
        cwd,
        env,
        port
    });
}

// Where the main shell is — or, before it has reported anything, where it was started.
function mainCwd(settings) {
    return tty.getCwd() || settings.cwd;
}

async function loadSettings() {
    signale.pending(`Loading settings file...`);
    let settings = require(settingsFile);

    // Folder passed on the command line (Finder "Open in EDEX") overrides the start directory for this launch
    const startDir = extractDirFromArgv(process.argv);
    if (startDir) {
        settings.cwd = startDir;
        signale.info(`Start directory overridden by command line: ${startDir}`);
    }
    signale.pending(`Resolving shell path...`);
    settings.shell = await which(settings.shell);
    signale.info(`Shell found at ${settings.shell}`);
    signale.success(`Settings loaded!`);

    if (!fs.existsSync(settings.cwd)) throw new Error("Configured cwd path does not exist.");
    return settings;
}

async function spawnExtraTty(e, arg, settings, env) {
    // Slots are keyed by the port they would ideally get, and reserved before the await below
    // so two tabs opened at once cannot claim the same one.
    const slot = firstFreeSlot(extraTtys);
    if (slot === null) {
        signale.error("TTY spawn denied (Reason: exceeded max TTYs number)");
        e.sender.send("ttyspawn-reply", "ERROR: max number of ttys reached");
        return;
    }
    extraTtys[slot] = {};

    // A dev server can hold the slot's port just as it can hold the main one.
    let port;
    try {
        port = await findFreePort(Number(slot));
    } catch (err) {
        signale.error(`TTY slot ${slot} found no port to listen on:`, err.message);
        extraTtys[slot] = null;
        e.sender.send("ttyspawn-reply", "ERROR: "+err.message);
        return;
    }

    signale.pending(`Creating new TTY process on port ${port}`);
    let term = startTty(settings, env, resolveSpawnCwd(arg, tty.getCwd(), settings.cwd), port);
    signale.success(`New terminal back-end initialized at ${port}`);

    const release = () => {
        term.wss.close();
        extraTtys[slot] = null;
        term = null;
    };
    term.onclosed = (code, signal) => {
        term.ondisconnected = () => {};
        signale.complete(`TTY exited at ${port}`, code, signal);
        release();
    };
    term.onopened = pid => {
        signale.success(`TTY ${port} connected to frontend (process PID ${pid})`);
    };
    term.onresized = () => {};
    term.ondisconnected = () => {
        term.onclosed = () => {};
        term.close();
        release();
    };

    extraTtys[slot] = term;

    // Answer only once the socket is actually accepting connections. Replying straight
    // after the constructor raced the bind: the renderer connected to a port nobody was
    // listening on yet, and the refusal surfaced as an unexplained error dialog.
    let replied = false;
    const reply = message => {
        if (replied) return;
        replied = true;
        e.sender.send("ttyspawn-reply", message);
    };

    if (term.wss.address()) {
        reply("SUCCESS: "+port);
    } else {
        term.wss.once("listening", () => reply("SUCCESS: "+port));
    }

    term.wss.once("error", err => {
        signale.error(`TTY ${port} could not open its socket:`, err.message);
        if (extraTtys[slot] === term) extraTtys[slot] = null;
        reply("ERROR: "+err.message);
    });
}

// Registered in one go and before the window exists, with no await in between: the renderer asks
// for the port, the directory and the overrides as soon as it loads.
function registerIpc(settings, env) {
    // The renderer used to read the port from settings.json, which is no longer where the terminal
    // necessarily is. Synchronous, because the renderer needs it before it can build the terminal.
    ipc.on("tty-port", e => {
        e.returnValue = tty.port;
    });

    // The filesystem panel comes up ahead of the terminal and needs a directory to show meanwhile.
    ipc.on("tty-cwd", e => {
        e.returnValue = mainCwd(settings);
    });

    // Support for more terminals, used for creating tabs (currently limited to 4 extra terms)
    extraTtys = {};
    const basePort = Number(settings.port || 3000) + 2;
    for (let i = 0; i < 4; i++) {
        extraTtys[basePort+i] = null;
    }
    ipc.on("ttyspawn", (e, arg) => spawnExtraTty(e, arg, settings, env));

    // Backend support for theme and keyboard hotswitch
    let themeOverride = null;
    let kbOverride = null;
    ipc.on("getThemeOverride", e => {
        e.sender.send("getThemeOverride", themeOverride);
    });
    ipc.on("getKbOverride", e => {
        e.sender.send("getKbOverride", kbOverride);
    });
    ipc.on("setThemeOverride", (e, arg) => {
        themeOverride = arg;
    });
    ipc.on("setKbOverride", (e, arg) => {
        kbOverride = arg;
    });
}

async function onReady() {
    const settings = await loadSettings();

    // An app launched from Finder gets launchd's bare environment, not the one a login shell builds
    // from .zprofile and friends — no PATH additions, no locale. shell-env asks the shell itself.
    const env = buildShellEnv(await require("shell-env")(settings.shell), {
        version: app.getVersion(),
        overrides: settings.env
    });

    // The configured port is only a preference. 3000 is also where Next.js, Create React App and
    // most dev servers listen by default, and with one of them running the fixed bind failed with
    // EADDRINUSE and took the whole app down on launch.
    const wantedPort = preferredPort(settings.port);
    const ttyPort = await findFreePort(wantedPort);
    if (ttyPort !== wantedPort) {
        signale.warn(`Port ${wantedPort} is held by another program, the terminal uses ${ttyPort} instead`);
    }

    signale.pending(`Creating new terminal process on port ${ttyPort}`);
    tty = startTty(settings, env, settings.cwd, ttyPort);
    signale.success(`Terminal back-end initialized!`);
    tty.onclosed = (code, signal) => {
        tty.ondisconnected = () => {};
        signale.complete("Terminal exited", code, signal);
        app.quit();
    };
    tty.onopened = () => {
        signale.success("Connected to frontend!");
        signale.timeEnd("Startup");
    };
    tty.onresized = (cols, rows) => {
        signale.info("Resized TTY to ", cols, rows);
    };
    tty.ondisconnected = () => {
        signale.error("Lost connection to frontend");
        signale.watch("Waiting for frontend connection...");
    };

    registerIpc(settings, env);

    // Support for multithreaded systeminformation calls
    signale.pending("Starting multithreaded calls controller...");
    require("./_multithread.js");

    createWindow(settings);
}

app.on('ready', onReady);

app.on('web-contents-created', (e, contents) => {
    // Prevent creating more than one window
    contents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });

    // Prevent loading something else than the UI
    contents.on('will-navigate', (e, url) => {
        if (url !== contents.getURL()) e.preventDefault();
    });
});

app.on('window-all-closed', () => {
    signale.info("All windows closed");
    app.quit();
});

app.on('before-quit', () => {
    tty.close();
    closeExtraTtys();
    signale.complete("Shutting down...");
});

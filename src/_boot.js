const signale = require("signale");
const {app, BrowserWindow, dialog, shell} = require("electron");

// Keep config under EDEX; migrate from the historical eDEX-UI folder if present
{
    const _fs = require("fs");
    const _path = require("path");
    const _newUserData = _path.join(app.getPath("appData"), "EDEX");
    const _oldUserData = _path.join(app.getPath("appData"), "eDEX-UI");
    try {
        if (!_fs.existsSync(_newUserData) && _fs.existsSync(_oldUserData)) {
            _fs.renameSync(_oldUserData, _newUserData);
        }
    } catch(e) {
        // Migration is best-effort; fall back to a fresh config dir
    }
    app.setPath("userData", _newUserData);
}

process.on("uncaughtException", e => {
    signale.fatal(e);
    dialog.showErrorBox("EDEX crashed", e.message || "Cannot retrieve error message.");
    if (tty) {
        tty.close();
    }
    if (extraTtys) {
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] !== null) {
                extraTtys[key].close();
            }
        });
    }
    process.exit(1);
});

signale.start(`Starting EDEX v${app.getVersion()}`);
signale.info(`With Node ${process.versions.node} and Electron ${process.versions.electron}`);
signale.info(`Renderer is Chrome ${process.versions.chrome}`);

// Extract an absolute directory path from a command line (used by the Finder "Open in EDEX" action)
function extractDirFromArgv(argv) {
    for (let i = argv.length - 1; i > 0; i--) {
        const a = argv[i];
        if (typeof a === "string" && !a.startsWith("-") && require("path").isAbsolute(a)) {
            try {
                if (require("fs").statSync(a).isDirectory()) return a;
            } catch(e) {
                // Not a directory, keep looking
            }
        }
    }
    return null;
}

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

const electron = require("electron");
require('@electron/remote/main').initialize()
const ipc = electron.ipcMain;
const path = require("path");
const url = require("url");
const fs = require("fs");
const which = require("which");
const Terminal = require("./classes/terminal.class.js").Terminal;
const {findFreePort} = require("./utils/net.js");

ipc.on("log", (e, type, content) => {
    signale[type](content);
});

var win, tty, extraTtys;
const settingsFile = path.join(electron.app.getPath("userData"), "settings.json");
const shortcutsFile = path.join(electron.app.getPath("userData"), "shortcuts.json");
const lastWindowStateFile = path.join(electron.app.getPath("userData"), "lastWindowState.json");
const themesDir = path.join(electron.app.getPath("userData"), "themes");
const innerThemesDir = path.join(__dirname, "assets/themes");
const kblayoutsDir = path.join(electron.app.getPath("userData"), "keyboards");
const innerKblayoutsDir = path.join(__dirname, "assets/kb_layouts");
const fontsDir = path.join(electron.app.getPath("userData"), "fonts");
const innerFontsDir = path.join(__dirname, "assets/fonts");

// Unset proxy env variables to avoid connection problems on the internal websockets
// See #222
if (process.env.http_proxy) delete process.env.http_proxy;
if (process.env.https_proxy) delete process.env.https_proxy;

// Bypass GPU acceleration blocklist, trading a bit of stability for a great deal of performance, mostly on Linux
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-video-decode");

// Fix userData folder not setup on Windows
try {
    fs.mkdirSync(electron.app.getPath("userData"));
    signale.info(`Created config dir at ${electron.app.getPath("userData")}`);
} catch(e) {
    signale.info(`Base config dir is ${electron.app.getPath("userData")}`);
}
// Defaults are seeded on first run and topped up on every later one: a key or a shortcut added in a
// new version has to reach the people who already have a config, not just fresh installs. Values
// that are already in the file are never touched — this fills gaps, it does not reset preferences.
const defaultSettings = {
    shell: (process.platform === "win32") ? "powershell.exe" : "bash",
    shellArgs: '',
    cwd: electron.app.getPath("userData"),
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
    const current = readConfig(file, {});
    if (current === null || typeof current !== "object" || Array.isArray(current)) return;

    const missing = Object.keys(defaults).filter(key => typeof current[key] === "undefined");
    if (!missing.length) return;

    missing.forEach(key => { current[key] = defaults[key]; });
    fs.writeFileSync(file, JSON.stringify(current, "", 4));
    signale.info(`Seeded ${missing.length} setting(s) in ${file}: ${missing.join(", ")}`);
}

// Shortcuts are matched on type and action rather than on the trigger, so a rebound key keeps the
// binding the user chose instead of picking up a duplicate.
function seedShortcuts(file, defaults) {
    const current = readConfig(file, []);
    if (current === null || !Array.isArray(current)) return;

    const known = new Set(current.map(cut => `${cut.type}:${cut.action}`));
    const missing = defaults.filter(cut => !known.has(`${cut.type}:${cut.action}`));
    if (!missing.length) return;

    fs.writeFileSync(file, JSON.stringify(current.concat(missing), "", 4));
    signale.info(`Seeded ${missing.length} shortcut(s) in ${file}: ${missing.map(cut => cut.action).join(", ")}`);
}

seedSettings(settingsFile, defaultSettings);
seedShortcuts(shortcutsFile, defaultShortcuts);
//Create default window state file
if(!fs.existsSync(lastWindowStateFile)) {
    fs.writeFileSync(lastWindowStateFile, JSON.stringify({
        useFullscreen: true
    }, "", 4));
    signale.info(`Default last window state written to ${lastWindowStateFile}`);
}

// Copy default themes & keyboard layouts & fonts
signale.pending("Mirroring internal assets...");
try {
    fs.mkdirSync(themesDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerThemesDir).forEach(e => {
    fs.writeFileSync(path.join(themesDir, e), fs.readFileSync(path.join(innerThemesDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(kblayoutsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerKblayoutsDir).forEach(e => {
    fs.writeFileSync(path.join(kblayoutsDir, e), fs.readFileSync(path.join(innerKblayoutsDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(fontsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerFontsDir).forEach(e => {
    fs.writeFileSync(path.join(fontsDir, e), fs.readFileSync(path.join(innerFontsDir, e)));
});

// Version history logging
const versionHistoryPath = path.join(electron.app.getPath("userData"), "versions_log.json");
var versionHistory = fs.existsSync(versionHistoryPath) ? require(versionHistoryPath) : {};
var version = app.getVersion();
if (typeof versionHistory[version] === "undefined") {
	versionHistory[version] = {
		firstSeen: Date.now(),
		lastSeen: Date.now()
	};
} else {
	versionHistory[version].lastSeen = Date.now();
}
fs.writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, 0, 2), {encoding:"utf-8"});

function createWindow(settings) {
    signale.info("Creating window...");

    let display;
    if (!isNaN(settings.monitor)) {
        display = electron.screen.getAllDisplays()[settings.monitor] || electron.screen.getPrimaryDisplay();
    } else {
        display = electron.screen.getPrimaryDisplay();
    }
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

    require('@electron/remote/main').enable(win.webContents);

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'ui.html'),
        protocol: 'file:',
        slashes: true
    }));

    signale.complete("Frontend window created!");
    win.show();
    // The window is resizable and movable in every mode now, so the only thing left to restore is
    // whether the last session ended in fullscreen.
    if (settings.forceFullscreen && !require(lastWindowStateFile)["useFullscreen"]) {
        win.setFullScreen(false);
    }

    signale.watch("Waiting for frontend connection...");
}

app.on('ready', async () => {
    signale.pending(`Loading settings file...`);
    let settings = require(settingsFile);

    // Folder passed on the command line (Finder "Open in EDEX") overrides the start directory for this launch
    const startDir = extractDirFromArgv(process.argv);
    if (startDir) {
        settings.cwd = startDir;
        signale.info(`Start directory overridden by command line: ${startDir}`);
    }
    signale.pending(`Resolving shell path...`);
    settings.shell = await which(settings.shell).catch(e => { throw(e) });
    signale.info(`Shell found at ${settings.shell}`);
    signale.success(`Settings loaded!`);

    if (!require("fs").existsSync(settings.cwd)) throw new Error("Configured cwd path does not exist.");

    // See #366
    let cleanEnv = await require("shell-env")(settings.shell).catch(e => { throw e; });

    Object.assign(cleanEnv, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "EDEX",
        TERM_PROGRAM_VERSION: app.getVersion(),
        LANG: cleanEnv.LANG || "ru_RU.UTF-8"
    }, settings.env);

    // The configured port is only a preference. 3000 is also where Next.js, Create React App and
    // most dev servers listen by default, and with one of them running the fixed bind failed with
    // EADDRINUSE and took the whole app down on launch.
    const preferredPort = Number(settings.port) || 3000;
    const ttyPort = await findFreePort(preferredPort);
    if (ttyPort !== preferredPort) {
        signale.warn(`Port ${preferredPort} is held by another program, the terminal uses ${ttyPort} instead`);
    }

    signale.pending(`Creating new terminal process on port ${ttyPort}`);
    tty = new Terminal({
        role: "server",
        shell: settings.shell,
        params: settings.shellArgs || '',
        cwd: settings.cwd,
        env: cleanEnv,
        port: ttyPort
    });
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

    // The renderer used to read the port from settings.json, which is no longer where the terminal
    // necessarily is. Synchronous, because the renderer needs it before it can build the terminal.
    ipc.on("tty-port", e => {
        e.returnValue = tty.port;
    });

    // Support for multithreaded systeminformation calls
    signale.pending("Starting multithreaded calls controller...");
    require("./_multithread.js");

    createWindow(settings);

    // Support for more terminals, used for creating tabs (currently limited to 4 extra terms)
    extraTtys = {};
    let basePort = settings.port || 3000;
    basePort = Number(basePort) + 2;

    for (let i = 0; i < 4; i++) {
        extraTtys[basePort+i] = null;
    }

    ipc.on("ttyspawn", async (e, arg) => {
        // Slots are keyed by the port they would ideally get, and reserved before the await below
        // so two tabs opened at once cannot claim the same one.
        let slot = null;
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] === null && slot === null) {
                extraTtys[key] = {};
                slot = key;
            }
        });

        if (slot === null) {
            signale.error("TTY spawn denied (Reason: exceeded max TTYs number)");
            e.sender.send("ttyspawn-reply", "ERROR: max number of ttys reached");
        } else {
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
            let spawnCwd = (typeof arg === "string" && arg !== "true" && fs.existsSync(arg)) ? arg : (tty.tty._cwd || settings.cwd);
            let term = new Terminal({
                role: "server",
                shell: settings.shell,
                params: settings.shellArgs || '',
                cwd: spawnCwd,
                env: cleanEnv,
                port: port
            });
            signale.success(`New terminal back-end initialized at ${port}`);
            term.onclosed = (code, signal) => {
                term.ondisconnected = () => {};
                term.wss.close();
                signale.complete(`TTY exited at ${port}`, code, signal);
                extraTtys[slot] = null;
                term = null;
            };
            term.onopened = pid => {
                signale.success(`TTY ${port} connected to frontend (process PID ${pid})`);
            };
            term.onresized = () => {};
            term.ondisconnected = () => {
                term.onclosed = () => {};
                term.close();
                term.wss.close();
                extraTtys[slot] = null;
                term = null;
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
    });

    // Backend support for theme and keyboard hotswitch
    let themeOverride = null;
    let kbOverride = null;
    ipc.on("getThemeOverride", (e, arg) => {
        e.sender.send("getThemeOverride", themeOverride);
    });
    ipc.on("getKbOverride", (e, arg) => {
        e.sender.send("getKbOverride", kbOverride);
    });
    ipc.on("setThemeOverride", (e, arg) => {
        themeOverride = arg;
    });
    ipc.on("setKbOverride", (e, arg) => {
        kbOverride = arg;
    });
});

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
    Object.keys(extraTtys).forEach(key => {
        if (extraTtys[key] !== null) {
            extraTtys[key].close();
        }
    });
    signale.complete("Shutting down...");
});

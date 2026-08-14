// Lint rules for EDEX.
//
// Deliberately narrow: this catches mistakes that break the app at runtime — undefined
// identifiers, unreachable code, thrown strings, promises dropped on the floor. Formatting and
// style are left alone, so diffs stay readable and reviews stay about behaviour.

"use strict";

const browserGlobals = {
    window: "readonly",
    document: "readonly",
    navigator: "readonly",
    location: "readonly",
    fetch: "readonly",
    WebSocket: "readonly",
    Audio: "readonly",
    Image: "readonly",
    FontFace: "readonly",
    CustomEvent: "readonly",
    Event: "readonly",
    HTMLElement: "readonly",
    getComputedStyle: "readonly",
    requestAnimationFrame: "readonly",
    cancelAnimationFrame: "readonly",
    localStorage: "readonly",
    performance: "readonly",
    screen: "readonly"
};

const nodeGlobals = {
    require: "readonly",
    module: "writable",
    exports: "writable",
    process: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    Buffer: "readonly",
    global: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setInterval: "readonly",
    clearInterval: "readonly",
    setImmediate: "readonly",
    URL: "readonly",
    TextDecoder: "readonly",
    TextEncoder: "readonly"
};

// Values the app hangs off the window object and then reaches without the prefix, plus the
// classes ui.html pulls in through <script> tags before the renderer runs.
const edexGlobals = {
    _escapeHtml: "readonly",
    _purifyCSS: "readonly",
    _encodePathURI: "readonly",
    _delay: "readonly",
    _loadTheme: "readonly",
    AudioManager: "readonly",
    Clock: "readonly",
    Conninfo: "readonly",
    Cpuinfo: "readonly",
    DocReader: "readonly",
    FilesystemDisplay: "readonly",
    FuzzyFinder: "readonly",
    HardwareInspector: "readonly",
    Keyboard: "readonly",
    LocationGlobe: "readonly",
    MediaPlayer: "readonly",
    Netstat: "readonly",
    RAMwatcher: "readonly",
    Sysinfo: "readonly",
    Toplist: "readonly",
    si: "readonly",
    settings: "readonly",
    theme: "readonly",
    term: "readonly",
    fsDisp: "readonly",
    keyboard: "readonly",
    audioManager: "readonly",
    modals: "readonly",
    Modal: "readonly",
    Terminal: "readonly",
    signale: "readonly",
    electron: "readonly",
    remote: "readonly",
    ipc: "readonly",
    tty: "readonly",
    win: "readonly",
    // Modules and paths the renderer declares at top level and the classes read directly.
    path: "readonly",
    fs: "readonly",
    settingsDir: "readonly",
    themesDir: "readonly",
    keyboardsDir: "readonly",
    fontsDir: "readonly",
    settingsFile: "readonly",
    shortcutsFile: "readonly",
    lastWindowStateFile: "readonly",
    // Loaded by ui.html as a plain script.
    pdfjsLib: "readonly"
};

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "src/node_modules/**",
            "dist/**",
            "prebuild-src/**",
            "src/assets/vendor/**",
            "src/assets/misc/file-icons-match.js",
            "file-icons/**"
        ]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "commonjs",
            globals: {...browserGlobals, ...nodeGlobals, ...edexGlobals}
        },
        linterOptions: {
            reportUnusedDisableDirectives: true
        },
        rules: {
            // Runtime breakage
            "no-undef": "error",
            "no-unreachable": "error",
            "no-dupe-keys": "error",
            "no-dupe-args": "error",
            "no-dupe-class-members": "error",
            "no-duplicate-case": "error",
            "no-func-assign": "error",
            "no-obj-calls": "error",
            "no-sparse-arrays": "error",
            "no-unsafe-negation": "error",
            "use-isnan": "error",
            "valid-typeof": "error",
            "no-cond-assign": "error",
            "no-self-assign": "error",
            "no-self-compare": "error",
            "no-constant-condition": ["error", {checkLoops: false}],

            // Error handling
            "no-throw-literal": "error",
            "no-ex-assign": "error",
            "no-unsafe-finally": "error",
            // require-atomic-updates fires on every `window.x = await …` in the renderer's
            // start-up sequence, which is single-threaded and sequential. All noise, no signal.
            "require-atomic-updates": "off",

            // Hygiene that hides bugs
            "no-unused-vars": ["warn", {args: "none", varsIgnorePattern: "^_"}],
            "no-redeclare": "error",
            "no-fallthrough": "warn",
            "no-empty": ["warn", {allowEmptyCatch: true}]
        }
    },
    {
        // Build tooling runs in plain Node, without the browser or app globals.
        files: ["build/**/*.js", "prebuild-minify.js", "file-icons-generator.js", "eslint.config.js"],
        languageOptions: {
            globals: nodeGlobals
        }
    }
];

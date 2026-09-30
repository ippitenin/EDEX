"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {
    mergeMissingSettings,
    mergeMissingShortcuts,
    buildShellEnv,
    formatEnvSetting,
    parseEnvSetting,
    preferredPort,
    parseShellArgs
} = require("../src/utils/config.js");

const DEFAULTS = {shell: "bash", port: 3000, audio: true, theme: "tron"};

// What _boot.js did before the merge moved here: add the missing keys to the parsed object in place.
// The file written back has to come out byte for byte the same, key order included.
function legacySeed(current, defaults) {
    Object.keys(defaults).filter(key => typeof current[key] === "undefined")
        .forEach(key => { current[key] = defaults[key]; });
    return JSON.stringify(current, "", 4);
}

test("an empty settings file gets every default", () => {
    const {settings, added} = mergeMissingSettings({}, DEFAULTS);
    assert.deepStrictEqual(settings, DEFAULTS);
    assert.deepStrictEqual(added, ["shell", "port", "audio", "theme"]);
});

test("values already in the file win, falsy ones included", () => {
    const current = {shell: "", port: 0, audio: false, theme: null};
    const {settings, added} = mergeMissingSettings(current, DEFAULTS);
    assert.deepStrictEqual(settings, current);
    assert.deepStrictEqual(added, []);
});

test("unknown keys survive and missing ones go at the end, in the order of the defaults", () => {
    const current = {custom: 1, theme: "blade", zzz: [1, 2]};
    const {settings, added} = mergeMissingSettings(current, DEFAULTS);
    assert.deepStrictEqual(Object.keys(settings), ["custom", "theme", "zzz", "shell", "port", "audio"]);
    assert.deepStrictEqual(added, ["shell", "port", "audio"]);
});

test("the merged file is written exactly as before", () => {
    const samples = [
        {},
        {theme: "blade"},
        {custom: {nested: true}, port: 8080, env: {FOO: "bar"}},
        JSON.parse('{"__proto__": {"x": 1}, "shell": "zsh"}')
    ];
    for (const sample of samples) {
        const expected = legacySeed(JSON.parse(JSON.stringify(sample)), DEFAULTS);
        const {settings} = mergeMissingSettings(sample, DEFAULTS);
        assert.strictEqual(JSON.stringify(settings, "", 4), expected);
    }
});

test("a __proto__ key from the file is kept, not swallowed by the prototype setter", () => {
    const current = JSON.parse('{"__proto__": {"polluted": true}}');
    const {settings} = mergeMissingSettings(current, DEFAULTS);
    assert.ok(Object.prototype.hasOwnProperty.call(settings, "__proto__"));
    assert.strictEqual({}.polluted, undefined);
});

test("the parsed settings are not modified in place", () => {
    const current = {theme: "blade"};
    mergeMissingSettings(current, DEFAULTS);
    assert.deepStrictEqual(current, {theme: "blade"});
});

test("a file that does not hold an object is left alone", () => {
    for (const junk of [null, [], [1], "text", 42, true]) {
        assert.strictEqual(mergeMissingSettings(junk, DEFAULTS), null, JSON.stringify(junk));
    }
});

const SHORTCUTS = [
    {type: "app", trigger: "Ctrl+Shift+C", action: "COPY", enabled: true},
    {type: "app", trigger: "Ctrl+Shift+V", action: "PASTE", enabled: true},
    {type: "shell", trigger: "Ctrl+Shift+Alt+Space", action: "neofetch", linebreak: true, enabled: false}
];

test("an empty shortcuts list gets every default, in order", () => {
    const {shortcuts, added} = mergeMissingShortcuts([], SHORTCUTS);
    assert.deepStrictEqual(shortcuts, SHORTCUTS);
    assert.deepStrictEqual(added, SHORTCUTS);
});

test("a rebound shortcut is recognised by its action, not duplicated", () => {
    const current = [{type: "app", trigger: "Alt+C", action: "COPY", enabled: false}];
    const {shortcuts, added} = mergeMissingShortcuts(current, SHORTCUTS);
    assert.deepStrictEqual(shortcuts[0], current[0], "the user's trigger and switch stay");
    assert.deepStrictEqual(added.map(cut => cut.action), ["PASTE", "neofetch"]);
});

test("the user's own shortcuts keep their place and the missing ones go at the end", () => {
    const own = {type: "shell", trigger: "Ctrl+Alt+G", action: "git status", enabled: true};
    const {shortcuts} = mergeMissingShortcuts([own, SHORTCUTS[1]], SHORTCUTS);
    assert.deepStrictEqual(shortcuts, [own, SHORTCUTS[1], SHORTCUTS[0], SHORTCUTS[2]]);
});

test("the same action under another type is a different shortcut", () => {
    const current = [{type: "shell", trigger: "Ctrl+Alt+C", action: "COPY", enabled: true}];
    const {added} = mergeMissingShortcuts(current, SHORTCUTS);
    assert.ok(added.some(cut => cut.type === "app" && cut.action === "COPY"));
});

test("a complete list needs nothing, and is not modified in place", () => {
    const current = SHORTCUTS.map(cut => ({...cut}));
    const {added} = mergeMissingShortcuts(current, SHORTCUTS);
    assert.deepStrictEqual(added, []);
    assert.deepStrictEqual(current, SHORTCUTS);
});

test("a file that does not hold a list is left alone", () => {
    for (const junk of [null, {}, "text", 42]) {
        assert.strictEqual(mergeMissingShortcuts(junk, SHORTCUTS), null, JSON.stringify(junk));
    }
});

test("a null entry in the shortcuts fails loudly", () => {
    // The renderer cannot run with one either; a crash dialog at launch beats a half-built UI.
    assert.throws(() => mergeMissingShortcuts([null], SHORTCUTS), TypeError);
});

test("the shell environment names the terminal", () => {
    const env = buildShellEnv({PATH: "/usr/bin", LANG: "en_GB.UTF-8"}, {version: "2.4.0"});
    assert.deepStrictEqual(env, {
        PATH: "/usr/bin",
        LANG: "en_GB.UTF-8",
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "EDEX",
        TERM_PROGRAM_VERSION: "2.4.0"
    });
});

test("a login environment without a locale gets one", () => {
    // Apps launched from Finder have no LANG, and non-ASCII paths come out mangled without it.
    assert.strictEqual(buildShellEnv({}, {version: "1"}).LANG, "ru_RU.UTF-8");
});

test("overrides from settings win over everything", () => {
    const env = buildShellEnv({LANG: "en_US.UTF-8"}, {version: "1", overrides: {TERM: "vt100", LANG: "C", FOO: "bar"}});
    assert.strictEqual(env.TERM, "vt100");
    assert.strictEqual(env.LANG, "C");
    assert.strictEqual(env.FOO, "bar");
});

test("the login environment is not modified in place", () => {
    const login = {PATH: "/usr/bin"};
    buildShellEnv(login, {version: "1", overrides: {FOO: "bar"}});
    assert.deepStrictEqual(login, {PATH: "/usr/bin"});
});

test("the preferred port falls back to 3000", () => {
    assert.strictEqual(preferredPort(3000), 3000);
    assert.strictEqual(preferredPort("3000"), 3000);
    assert.strictEqual(preferredPort(8080), 8080);
    for (const junk of [undefined, null, 0, "", "abc", NaN]) {
        assert.strictEqual(preferredPort(junk), 3000, String(junk));
    }
});

test("shell arguments from the settings editor become a list", () => {
    // node-pty throws on a string, which kept the terminal from starting.
    assert.deepStrictEqual(parseShellArgs("-l"), ["-l"]);
    assert.deepStrictEqual(parseShellArgs(" -l  -i "), ["-l", "-i"]);
});

test("no shell arguments means an empty list, so the terminal adds --login itself", () => {
    for (const empty of ["", "   ", undefined, null, 0]) {
        assert.deepStrictEqual(parseShellArgs(empty), [], String(empty));
    }
});

test("a list of shell arguments written into settings.json by hand passes through", () => {
    assert.deepStrictEqual(parseShellArgs(["-c", "echo hi"]), ["-c", "echo hi"]);
});

test("an env override that is not an object is ignored", () => {
    // The settings editor used to save env as "[object Object]", which spread into variables 0, 1, 2…
    for (const junk of ["[object Object]", ["A=1"], null, 42]) {
        const env = buildShellEnv({PATH: "/usr/bin"}, {version: "1", overrides: junk});
        assert.strictEqual(env.PATH, "/usr/bin");
        assert.ok(!("0" in env), JSON.stringify(junk));
    }
});

test("env shows in the settings editor as JSON", () => {
    assert.strictEqual(formatEnvSetting({EDITOR: "vim", LANG: "C"}), '{"EDITOR":"vim","LANG":"C"}');
    assert.strictEqual(formatEnvSetting(undefined), "");
    assert.strictEqual(formatEnvSetting(null), "");
});

test("a broken env value is shown as it is, so it can be fixed", () => {
    assert.strictEqual(formatEnvSetting("[object Object]"), "[object Object]");
});

test("env survives a round trip through the settings editor", () => {
    const env = {EDITOR: "vim", PATH: "/opt/bin:/usr/bin", QUOTE: "it's \"quoted\""};
    assert.deepStrictEqual(parseEnvSetting(formatEnvSetting(env)), {env});
});

test("an empty env field removes the setting", () => {
    assert.deepStrictEqual(parseEnvSetting(""), {env: undefined});
    assert.deepStrictEqual(parseEnvSetting("   "), {env: undefined});
});

test("an env field that is not a JSON object is refused rather than saved", () => {
    for (const text of ["[object Object]", "EDITOR=vim", "[1, 2]", '"text"', "42", "null"]) {
        const result = parseEnvSetting(text);
        assert.ok(result.error, text);
        assert.ok(!("env" in result), text);
    }
});

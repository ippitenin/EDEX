"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {
    extractDirFromArgv,
    isAllowedOrigin,
    parseProcessName,
    parseCwdOutput
} = require("../src/utils/system.js");

// A stand-in filesystem: only the listed paths exist, and only as directories.
function fakeFs(directories) {
    return {
        statSync(target) {
            if (!directories.includes(target)) {
                const err = new Error(`ENOENT: ${target}`);
                err.code = "ENOENT";
                throw err;
            }
            return {isDirectory: () => true};
        }
    };
}

test("extractDirFromArgv finds the folder the Finder service appends", () => {
    const argv = ["/Applications/EDEX.app/Contents/MacOS/EDEX", "/Users/me/Projects"];
    assert.strictEqual(extractDirFromArgv(argv, fakeFs(["/Users/me/Projects"])), "/Users/me/Projects");
});

test("extractDirFromArgv prefers the last directory on the line", () => {
    const argv = ["EDEX", "/Users/me/A", "/Users/me/B"];
    assert.strictEqual(extractDirFromArgv(argv, fakeFs(["/Users/me/A", "/Users/me/B"])), "/Users/me/B");
});

test("extractDirFromArgv ignores flags and relative paths", () => {
    const argv = ["EDEX", "--nointro", "relative/path"];
    assert.strictEqual(extractDirFromArgv(argv, fakeFs(["relative/path"])), null);
});

test("extractDirFromArgv skips paths that do not exist", () => {
    const argv = ["EDEX", "/Users/me/gone"];
    assert.strictEqual(extractDirFromArgv(argv, fakeFs([])), null);
});

test("extractDirFromArgv never returns argv[0]", () => {
    // The executable's own path is a real path, but it is not a folder the user picked.
    const argv = ["/Applications/EDEX.app"];
    assert.strictEqual(extractDirFromArgv(argv, fakeFs(["/Applications/EDEX.app"])), null);
});

test("extractDirFromArgv tolerates junk input", () => {
    assert.strictEqual(extractDirFromArgv(undefined, fakeFs([])), null);
    assert.strictEqual(extractDirFromArgv([], fakeFs([])), null);
});

test("isAllowedOrigin accepts the local renderer", () => {
    assert.ok(isAllowedOrigin("file://"));
    assert.ok(isAllowedOrigin("null"));
    assert.ok(isAllowedOrigin(undefined), "a missing Origin header is the local client");
});

test("isAllowedOrigin refuses web pages", () => {
    // This is the check that stops a site in the user's browser from driving the terminal.
    assert.ok(!isAllowedOrigin("http://evil.example"));
    assert.ok(!isAllowedOrigin("https://evil.example"));
    assert.ok(!isAllowedOrigin("http://localhost:3000"));
    assert.ok(!isAllowedOrigin("file://evil.example"));
});

test("parseProcessName reads the macOS ps output", () => {
    assert.strictEqual(parseProcessName("74600 /bin/zsh"), "zsh");
});

test("parseProcessName handles a bare name", () => {
    assert.strictEqual(parseProcessName("1234 node"), "node");
});

test("parseProcessName copes with a failed command", () => {
    assert.strictEqual(parseProcessName(""), "");
    assert.strictEqual(parseProcessName(undefined), "");
});

test("parseCwdOutput keeps paths with spaces intact", () => {
    // awk joins fields with spaces and leaves a trailing one; the path itself must survive.
    assert.strictEqual(parseCwdOutput("/Users/me/My Design Files \n"), "/Users/me/My Design Files");
});

test("parseCwdOutput handles non-ASCII paths", () => {
    assert.strictEqual(parseCwdOutput("/Users/me/Desktop/Дизайн "), "/Users/me/Desktop/Дизайн");
});

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {execFileSync} = require("node:child_process");
const {escapeHtml, purifyCSS, quoteForShell, escapePathForPaste, encodePathURI} = require("../src/utils/sanitize.js");

test("escapeHtml neutralises tags", () => {
    assert.strictEqual(
        escapeHtml('<img src=x onerror="alert(1)">'),
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
});

test("escapeHtml handles every significant character", () => {
    assert.strictEqual(escapeHtml("&<>\"'"), "&amp;&lt;&gt;&quot;&#039;");
});

test("escapeHtml leaves ordinary text alone", () => {
    assert.strictEqual(escapeHtml("Отчёт 2026 (final).pdf"), "Отчёт 2026 (final).pdf");
});

test("escapeHtml coerces non-strings instead of throwing", () => {
    // Callers pass pids, byte counts and timestamps through the same path as names.
    assert.strictEqual(escapeHtml(1234), "1234");
    assert.strictEqual(escapeHtml(undefined), "");
    assert.strictEqual(escapeHtml(null), "");
});

test("escapeHtml is not fooled by an already-escaped string", () => {
    // Double escaping is ugly but safe; silently unescaping would not be.
    assert.strictEqual(escapeHtml("&lt;b&gt;"), "&amp;lt;b&amp;gt;");
});

test("purifyCSS prevents breaking out of a style block", () => {
    assert.strictEqual(
        purifyCSS("red; } </style><script>alert(1)</script>"),
        "red; } /style>script>alert(1)/script>"
    );
});

test("purifyCSS survives non-strings", () => {
    assert.strictEqual(purifyCSS(42), "42");
    assert.strictEqual(purifyCSS(undefined), "");
});

test("quoteForShell wraps a plain path", () => {
    assert.strictEqual(quoteForShell("/Users/me/Documents"), "'/Users/me/Documents'");
});

test("quoteForShell keeps spaces in one argument", () => {
    assert.strictEqual(quoteForShell("/Users/me/My Files"), "'/Users/me/My Files'");
});

test("quoteForShell defuses an embedded single quote", () => {
    assert.strictEqual(quoteForShell("/tmp/don't"), "'/tmp/don'\\''t'");
});

// The real question is not what the quoted string looks like but what a shell makes of it, so
// ask one: printf echoes its argument back, and it must come back byte for byte.
function shellRoundTrip(value) {
    return execFileSync("/bin/sh", ["-c", `printf '%s' ${quoteForShell(value)}`], {encoding: "utf8"});
}

test("quoteForShell survives a round trip through a real shell", () => {
    for (const value of [
        "/Users/me/Documents",
        "/Users/me/My Files",
        "/tmp/don't",
        "/tmp/Отчёт (2026).pdf",
        '/tmp/say "hi"',
        "/tmp/back\\slash",
        "/tmp/$HOME/${PATH}",
        "/tmp/`whoami`",
        "/tmp/a*b?c[d]"
    ]) {
        assert.strictEqual(shellRoundTrip(value), value, `mangled: ${value}`);
    }
});

test("quoteForShell defuses a command injection attempt", () => {
    // Left unquoted, this would end the argument and run rm. Quoted, it stays a file name.
    const hostile = "/tmp/'; rm -rf ~; '";
    assert.strictEqual(shellRoundTrip(hostile), hostile);
});

test("escapePathForPaste leaves a plain path untouched", () => {
    assert.strictEqual(escapePathForPaste("/Users/me/Pictures/shot-1_final.v2.png"), "/Users/me/Pictures/shot-1_final.v2.png");
});

test("escapePathForPaste escapes spaces the way Terminal.app does", () => {
    assert.strictEqual(escapePathForPaste("/Users/me/My Files/a b.png"), "/Users/me/My\\ Files/a\\ b.png");
});

test("escapePathForPaste keeps Cyrillic readable", () => {
    assert.strictEqual(escapePathForPaste("/Users/me/Снимок экрана.png"), "/Users/me/Снимок\\ экрана.png");
});

function pasteRoundTrip(value) {
    return execFileSync("/bin/sh", ["-c", `printf '%s' ${escapePathForPaste(value)}`], {encoding: "utf8"});
}

test("escapePathForPaste survives a round trip through a real shell", () => {
    for (const value of [
        "/Users/me/Documents",
        "/Users/me/My Files",
        "/tmp/don't",
        "/tmp/Отчёт (2026).pdf",
        '/tmp/say "hi"',
        "/tmp/back\\slash",
        "/tmp/$HOME/${PATH}",
        "/tmp/`whoami`",
        "/tmp/a*b?c[d]",
        "/tmp/~tilde & #hash; pipe|.png",
        "/tmp/'; rm -rf ~; '",
        // macOS puts a narrow no-break space before AM/PM in screenshot names.
        "/tmp/Screenshot 2026-09-30 at 3.37.10\u202fPM.png",
        "/tmp/two\nlines.png",
        "/tmp/tab\there.png"
    ]) {
        assert.strictEqual(pasteRoundTrip(value), value, `mangled: ${JSON.stringify(value)}`);
    }
});

// What Claude Code does with a paste, reduced to the steps that decide whether a dropped image
// becomes an attachment: split on a space that precedes a slash, strip one pair of outer quotes,
// drop the backslashes. Several paths must come out the other end as several paths.
function readPasteLikeClaudeCode(text) {
    return text.split(/ (?=\/)/).filter(part => part.trim()).map(part => {
        part = part.trim();
        if (/^(".*"|'.*')$/.test(part)) part = part.slice(1, -1);
        return part.replace(/\\(.)/g, "$1");
    });
}

test("escapePathForPaste keeps several dropped files apart for a program reading the paste", () => {
    const files = ["/Users/me/My Files/one.png", "/tmp/don't.png", "/Users/me/Снимок экрана (2).png"];
    const pasted = files.map(escapePathForPaste).join(" ")+" ";
    assert.deepStrictEqual(readPasteLikeClaudeCode(pasted), files);
});

test("quoteForShell would not survive the same reading, which is why drops do not use it", () => {
    const files = ["/tmp/one.png", "/tmp/two.png"];
    const pasted = files.map(quoteForShell).join(" ")+" ";
    assert.notDeepStrictEqual(readPasteLikeClaudeCode(pasted), files);
});

test("escapePathForPaste coerces non-strings instead of throwing", () => {
    assert.strictEqual(escapePathForPaste(undefined), "");
    assert.strictEqual(escapePathForPaste(null), "");
    assert.strictEqual(escapePathForPaste(42), "42");
});

test("encodePathURI keeps a # in a path from starting a fragment", () => {
    assert.strictEqual(encodePathURI("/Users/me/C#/song.mp3"), "/Users/me/C%23/song.mp3");
    const url = new URL("file://" + encodePathURI("/Users/me/C#/song.mp3"));
    assert.strictEqual(url.hash, "");
    assert.strictEqual(decodeURIComponent(url.pathname), "/Users/me/C#/song.mp3");
});

test("encodePathURI encodes spaces, quotes and non-ASCII names and leaves the slashes", () => {
    assert.strictEqual(encodePathURI("/My Files/\"q\".pdf"), "/My%20Files/%22q%22.pdf");
    assert.strictEqual(encodePathURI("/Документы/отчёт.pdf"), encodeURI("/Документы/отчёт.pdf"));
    assert.strictEqual(encodePathURI("/a%b"), "/a%25b");
});

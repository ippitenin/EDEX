"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {execFileSync} = require("node:child_process");
const {escapeHtml, purifyCSS, quoteForShell} = require("../src/utils/sanitize.js");

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

// Escaping helpers for the renderer.
//
// The renderer runs with node integration, so anything interpolated into markup executes with
// the user's privileges. Every value that originates outside the app — file names, process
// names, volume labels, error strings — has to pass through escapeHtml on the way into the DOM.
//
// Kept dependency-free and side-effect-free so the test suite can exercise it directly.

"use strict";

const HTML_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
};

/**
 * Makes a value safe to interpolate into HTML. Non-string input is coerced rather than thrown
 * on: callers pass process ids, sizes and timestamps alongside real strings.
 */
function escapeHtml(text) {
    if (text === null || typeof text === "undefined") return "";
    if (typeof text !== "string") text = String(text);
    return text.replace(/[&<>"']/g, c => HTML_ENTITIES[c]);
}

/**
 * Strips the one character that would let a theme break out of its <style> block. External
 * resources are additionally blocked by the page's Content-Security-Policy.
 */
function purifyCSS(str) {
    if (typeof str === "undefined" || str === null) return "";
    if (typeof str !== "string") str = String(str);
    return str.replace(/[<]/g, "");
}

/**
 * Quotes a path for a POSIX shell. Single quotes protect everything except a single quote
 * itself, which is closed, escaped and reopened — the standard '\'' dance.
 *
 * Without this, a file named  don't stop  or worse,  '; rm -rf ~; '  turns "type this path into
 * the terminal" into "run whatever the file name says".
 */
function quoteForShell(value) {
    if (typeof value === "undefined" || value === null) return "''";
    if (typeof value !== "string") value = String(value);
    return "'" + value.replace(/'/g, "'\\''") + "'";
}

/**
 * Escapes a path for pasting into the terminal the way Terminal.app does when a file is dropped
 * on it: a backslash in front of every character a shell could read as syntax.
 *
 * quoteForShell would satisfy the shell just as well, but the text does not always land in one.
 * Programs that take dropped files from the paste stream — Claude Code turning an image path
 * into an attachment, for one — split several paths on "a space followed by /" and strip at
 * most one pair of outer quotes, so  '/a.png' '/b.png'  reaches them as a single path that does
 * not exist. Backslash escaping is the form both sides agree on.
 *
 * The one thing a backslash cannot protect is a line break: the shell reads the pair as a line
 * continuation and drops both. Names carrying control characters fall back to quoteForShell.
 */
function escapePathForPaste(value) {
    if (typeof value === "undefined" || value === null) return "";
    if (typeof value !== "string") value = String(value);
    if (/[\x00-\x1f\x7f]/.test(value)) return quoteForShell(value);
    return value.replace(/[^A-Za-z0-9_\-.,:+@%/\u0080-\uffff]/g, "\\$&");
}

/**
 * Turns a file path into something a src="…" or a URL-taking API loads as that file. encodeURI
 * leaves # alone, and the rest of the path after one would be read as a fragment — a PDF or a song
 * in a folder called "C#" did not load.
 */
function encodePathURI(value) {
    return encodeURI(value).replace(/#/g, "%23");
}

module.exports = {escapeHtml, purifyCSS, quoteForShell, escapePathForPaste, encodePathURI};

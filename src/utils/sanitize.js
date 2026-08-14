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

module.exports = {escapeHtml, purifyCSS, quoteForShell};

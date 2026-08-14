// Helpers for the main process: command-line parsing, websocket origin checks and the parsers
// for the platform tools the terminal shells out to.
//
// These are the pieces where a silent mistake is expensive — a broken origin check exposes the
// terminal socket, a broken parser makes the process readout go blank — so they live here,
// free of side effects and covered by tests.

"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Picks a usable directory out of a command line, scanning from the end so the most recent
 * argument wins. Used by the Finder "Open in EDEX" service, which appends a folder path.
 *
 * Returns null when no argument names an existing directory.
 */
function extractDirFromArgv(argv, fsImpl = fs) {
    if (!Array.isArray(argv)) return null;
    for (let i = argv.length - 1; i > 0; i--) {
        const arg = argv[i];
        if (typeof arg !== "string" || arg.startsWith("-") || !path.isAbsolute(arg)) continue;
        try {
            if (fsImpl.statSync(arg).isDirectory()) return arg;
        } catch (e) {
            // Not a directory, or gone — keep looking.
        }
    }
    return null;
}

/**
 * Decides whether a websocket client may attach to the terminal.
 *
 * Only the local renderer may, and it loads from file://, which browsers report as either
 * "file://" or the opaque "null". A page open in a browser sends its own http(s) origin and is
 * refused — without this check any site could reach the loopback port and drive the shell.
 */
function isAllowedOrigin(origin) {
    if (!origin) return true;
    return origin === "file://" || origin === "null";
}

/**
 * Reads a foreground process name out of `ps -o pid=,comm= -g <pgid> | sort -n | tail -1`.
 *
 * macOS reports comm as an absolute path, so the basename is taken. Linux uses a different
 * invocation whose output is already just the name.
 */
function parseProcessName(psOutput) {
    if (typeof psOutput !== "string") return "";
    const line = psOutput.trim();
    if (!line) return "";
    const separator = line.indexOf(" ");
    const name = (separator === -1 ? line : line.slice(separator + 1)).trim();
    return name.split("/").pop();
}

/**
 * Reads a working directory out of the awk-trimmed tail of `lsof -a -d cwd -p <pid>`.
 *
 * The awk step joins fields with spaces, so a trailing space is expected — and paths containing
 * spaces must survive intact.
 */
function parseCwdOutput(lsofOutput) {
    if (typeof lsofOutput !== "string") return "";
    return lsofOutput.trim();
}

module.exports = {extractDirFromArgv, isAllowedOrigin, parseProcessName, parseCwdOutput};

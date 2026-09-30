// Helpers for the configuration the main process seeds, reads and hands to the shell.
//
// Seeding runs on every launch against files the user edits by hand, so a mistake here does not
// crash anything — it quietly rewrites someone's settings. That is why the decisions live in
// plain functions with tests, and _boot.js keeps only the reading and the writing.

"use strict";

/**
 * Tops up a settings object with the defaults it lacks.
 *
 * Returns null when the file does not hold an object at all: that is a config we cannot make sense
 * of, and the caller leaves it alone. Otherwise returns the merged copy and the keys that were
 * added, in the order of the defaults. Values already present — false, 0 and "" included — win.
 */
function mergeMissingSettings(current, defaults) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return null;

    const added = Object.keys(defaults).filter(key => typeof current[key] === "undefined");
    // Spread rather than Object.assign: a "__proto__" key that came out of JSON.parse is an own
    // property, and assigning it would go through the prototype setter and drop it from the file.
    const settings = {...current};
    added.forEach(key => { settings[key] = defaults[key]; });
    return {settings, added};
}

/**
 * Appends the default shortcuts a shortcuts list lacks.
 *
 * Shortcuts are matched on type and action rather than on the trigger, so a rebound key keeps the
 * binding the user chose instead of picking up a duplicate. Returns null when the file does not
 * hold a list.
 *
 * A null entry throws a TypeError, on purpose: the renderer cannot run with one either, and a crash
 * dialog at launch says more than an interface that comes up half-built.
 */
function mergeMissingShortcuts(current, defaults) {
    if (!Array.isArray(current)) return null;

    const known = new Set(current.map(cut => `${cut.type}:${cut.action}`));
    const added = defaults.filter(cut => !known.has(`${cut.type}:${cut.action}`));
    return {shortcuts: current.concat(added), added};
}

/**
 * Builds the environment the shell starts with, from the one a login shell would have.
 *
 * LANG falls back to ru_RU.UTF-8 because an app launched from Finder inherits no locale at all, and
 * without one zsh and lsof mangle every non-ASCII path. The overrides from settings.env come last,
 * so they can replace anything, TERM and LANG included.
 */
function buildShellEnv(loginEnv, {version, overrides} = {}) {
    return Object.assign({}, loginEnv, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "EDEX",
        TERM_PROGRAM_VERSION: version,
        LANG: loginEnv.LANG || "ru_RU.UTF-8"
    }, overrides);
}

/**
 * The terminal port the settings ask for. Only a preference — see findFreePort — and 3000 when
 * the value is missing or not a number.
 */
function preferredPort(value) {
    return Number(value) || 3000;
}

module.exports = {mergeMissingSettings, mergeMissingShortcuts, buildShellEnv, preferredPort};

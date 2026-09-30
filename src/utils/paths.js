// Paths the renderer builds or shows: fitting one into a space too narrow for it, and turning a
// name from the settings into a file inside one known folder.
//
// Fitting a path into a space too narrow for it:
//
// The filesystem panel shows the working directory in its title bar, and a deep path simply ran
// out of the panel and over the keyboard. What matters in such a path is where it starts and
// where it ends — the volume or home at one end, the folder being looked at on the other — so
// the middle is what gives way, a whole folder at a time, the way breadcrumbs collapse.
//
// How wide a string comes out depends on the font and the window, which only the renderer knows.
// The caller passes that in as a predicate, which keeps this module free of the DOM and lets the
// test suite drive it with a plain character count.

"use strict";

const path = require("path");

const ELLIPSIS = "…";

/**
 * Returns the longest version of a path that satisfies fits(text), dropping folders from the
 * middle first. The result is, in order of preference:
 *
 *   /Users/me/Projects/app/src/utils     the path itself
 *   /Users/me/…/src/utils                head and tail kept, the tail grown first
 *   …/src/utils                          the head given up
 *   …tils                                the end of the last name, when nothing else fits
 *
 * fits is expected to be monotonic: if a string fits, so does any shorter one.
 */
function shortenPath(fullPath, fits) {
    if (typeof fullPath === "undefined" || fullPath === null) return "";
    if (typeof fullPath !== "string") fullPath = String(fullPath);
    if (fits(fullPath)) return fullPath;

    const root = fullPath.startsWith("/") ? "/" : "";
    const parts = fullPath.split("/").filter(part => part.length > 0);
    const head = count => root + parts.slice(0, count).join("/");
    const tail = count => parts.slice(parts.length - count).join("/");

    // Head and tail around the gap. At least one folder has to go, or there is no gap to mark.
    if (parts.length >= 3 && fits(`${head(1)}/${ELLIPSIS}/${tail(1)}`)) {
        let h = 1;
        let t = 1;
        let grew = true;
        while (grew && h + t < parts.length - 1) {
            grew = false;
            // The end of the path says where you are, so it gets the first claim on the space.
            if (fits(`${head(h)}/${ELLIPSIS}/${tail(t + 1)}`)) {
                t++;
                grew = true;
            }
            if (h + t < parts.length - 1 && fits(`${head(h + 1)}/${ELLIPSIS}/${tail(t)}`)) {
                h++;
                grew = true;
            }
        }
        return `${head(h)}/${ELLIPSIS}/${tail(t)}`;
    }

    // No room for both ends: keep as many trailing folders as fit.
    if (parts.length >= 2 && fits(`${ELLIPSIS}/${tail(1)}`)) {
        let t = 1;
        while (t < parts.length - 1 && fits(`${ELLIPSIS}/${tail(t + 1)}`)) t++;
        return `${ELLIPSIS}/${tail(t)}`;
    }

    // Not even the last name fits whole: show as much of its end as possible.
    for (let start = 1; start < fullPath.length; start++) {
        const candidate = ELLIPSIS + fullPath.slice(start);
        if (fits(candidate)) return candidate;
    }
    return ELLIPSIS;
}

/**
 * Turns a theme or keyboard layout name into the file it names inside dir, or null when the name
 * could point anywhere else.
 *
 * The names come from settings.json and from the hotswitch message, and go straight into a
 * require(). Joined as they were, "../../somewhere/x" loaded a file from outside the folder.
 * Rejecting separators and the two dot entries is enough to keep the result in dir; names that
 * merely start with a dot, contain spaces or are not Latin are fine.
 */
function resolveNamedFile(dir, name, ext) {
    if (typeof name !== "string" || name === "" || name === "." || name === "..") return null;
    if (/[/\\\0]/.test(name)) return null;
    return path.join(dir, name + ext);
}

module.exports = {shortenPath, resolveNamedFile};

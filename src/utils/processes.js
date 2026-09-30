// Process lists as the top-processes panel and the process window show them.
//
// Both used to carry their own copy of these two pieces, and a fix to one would have missed the
// other. Kept dependency-free and side-effect-free so the test suite can exercise it directly.

"use strict";

/**
 * Folds processes that share a name into the one with the lowest pid, adding up their CPU and
 * memory — what the excludeThreadsFromToplist setting asks for, since systeminformation lists
 * every thread of a multi-process app as a process of its own.
 *
 * Works in place, as it always has: the list is sorted by pid and the surviving entries carry the
 * totals. Returns the folded list.
 */
function mergeThreadsByName(list) {
    return list.sort((a, b) => a.pid - b.pid).filter((proc, index, sorted) => {
        const first = sorted.findIndex(other => other.name === proc.name);
        if (first !== -1 && first !== index) {
            sorted[first].cpu = sorted[first].cpu + proc.cpu;
            sorted[first].mem = sorted[first].mem + proc.mem;
            return false;
        }
        return true;
    });
}

/**
 * Busiest first: CPU decides, memory breaks near-ties. The panel's order and the process window's
 * order before a column is picked.
 */
function compareByLoad(a, b) {
    return (b.cpu - a.cpu) * 100 + b.mem - a.mem;
}

module.exports = {mergeThreadsByName, compareByLoad};

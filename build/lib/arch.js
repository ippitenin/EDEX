// The swiftc target for the Finder service helper, from the architecture electron-builder is
// packaging for.
//
// The helper used to be compiled for whatever machine ran the build (process.arch). That is right
// for an arm64 Mac building the arm64 app and wrong for anything else: an x64 build made on Apple
// Silicon — or an arm64 one made from a Node running under Rosetta — would ship a helper that
// cannot run beside the app it belongs to.

"use strict";

const CPU = {x64: "x86_64", arm64: "arm64"};

// Matches LSMinimumSystemVersion in extras/service-helper/Info.plist.
const MINIMUM_MACOS = "11.0";

/**
 * Takes an electron-builder architecture name — Arch[context.arch] in an afterPack hook — and
 * returns the swiftc -target triple for it.
 *
 * A universal build calls afterPack once per slice and once more for the merged bundle, where the
 * helper would need both slices joined with lipo. Nothing does that yet, so it is refused rather
 * than quietly shipping a single-architecture helper inside a universal app.
 */
function swiftTargetForArch(archName) {
    if (!Object.prototype.hasOwnProperty.call(CPU, archName)) {
        throw new Error(`the Finder service helper cannot be built for "${archName}", only for ${Object.keys(CPU).join(" and ")}`);
    }
    return `${CPU[archName]}-apple-macos${MINIMUM_MACOS}`;
}

module.exports = {swiftTargetForArch};

// codesign refuses to sign anything carrying a resource fork or Finder information, and something
// in the system hangs an empty com.apple.FinderInfo on bundle directories (.app, .framework) that
// live in watched locations such as the Desktop. It appears asynchronously and only breaks builds
// once a signing identity is configured, since that is when the nested bundles — the service
// helper, the Electron helpers, the frameworks — start being signed one by one. ditto, which the
// dev bundle is copied with, faithfully carries it over from node_modules inside the project too.
//
// Because it comes back on its own, clearing it is not a fix on its own: the real one is writing
// bundles under ~/Library/Caches, where it never shows up. This stays as a second line of defence.
//
// Note `xattr -cr`, the usual advice, does not work: it gives up on com.apple.fileprovider.fpfs#P,
// which the file provider owns and will not release, before ever reaching FinderInfo. Deleting only
// the attribute codesign objects to succeeds and leaves the provider's bookkeeping intact.

"use strict";

const {execFileSync} = require("child_process");

function stripFinderInfo(bundlePath) {
    try {
        execFileSync("xattr", ["-r", "-d", "com.apple.FinderInfo", bundlePath], {stdio: "ignore"});
    } catch {
        // Nothing to remove is the normal case, and is not worth reporting either way.
    }
}

module.exports = {stripFinderInfo};

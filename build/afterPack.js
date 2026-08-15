// Prepares the packaged app for signing: embeds the "Open in EDEX" service helper, then strips the
// extended attribute that stops codesign from signing the bundle at all.

const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const HELPER_NAME = "EDEX Service";

exports.default = async function(context) {
    if (context.electronPlatformName !== "darwin") return;

    const projectDir = context.packager.info.projectDir;
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

    embedServiceHelper(projectDir, appPath);
    stripFinderInfo(appPath);
};

// Electron cannot publish an NSServices provider by itself, so a tiny Swift agent does it.
// Living inside the app bundle is what makes macOS list the entry in the main Finder context
// menu — the same place Terminal's "New Terminal at Folder" appears — rather than burying it
// under Quick Actions like an Automator workflow.
//
// Requires the Xcode command line tools. If swiftc is missing the build still succeeds; the
// app just ships without the Finder integration.
function embedServiceHelper(projectDir, appPath) {
    const sourceDir = path.join(projectDir, "extras", "service-helper");
    const bundlePath = path.join(appPath, "Contents", "Library", "Services", `${HELPER_NAME}.app`);

    try {
        execFileSync("which", ["swiftc"], {stdio: "ignore"});
    } catch (e) {
        console.warn("  • swiftc not found, skipping the Finder service helper");
        return;
    }

    const macosDir = path.join(bundlePath, "Contents", "MacOS");
    const resourcesDir = path.join(bundlePath, "Contents", "Resources");
    fs.rmSync(bundlePath, {recursive: true, force: true});
    fs.mkdirSync(macosDir, {recursive: true});
    fs.mkdirSync(resourcesDir, {recursive: true});

    execFileSync("swiftc", [
        "-O",
        "-target", `${process.arch === "x64" ? "x86_64" : "arm64"}-apple-macos11.0`,
        "-framework", "Cocoa",
        "-o", path.join(macosDir, HELPER_NAME),
        path.join(sourceDir, "main.swift")
    ], {stdio: "inherit"});

    fs.copyFileSync(path.join(sourceDir, "Info.plist"), path.join(bundlePath, "Contents", "Info.plist"));
    fs.copyFileSync(path.join(projectDir, "media", "icon.icns"), path.join(resourcesDir, "icon.icns"));

    console.log(`  • embedded the Finder service helper  path=${path.relative(projectDir, bundlePath)}`);
}

// codesign refuses to sign anything carrying a resource fork or Finder information, and something
// in the system hangs an empty com.apple.FinderInfo on bundle directories (.app, .framework) that
// live in watched locations such as the Desktop. It appears asynchronously and only breaks builds
// once a signing identity is configured, since that is when the nested bundles — the service
// helper, the Electron helpers, the frameworks — start being signed one by one.
//
// Because it comes back on its own, clearing it here is not a fix on its own: the real one is
// build-darwin writing its output under ~/Library/Caches, where it never shows up. This stays as a
// second line of defence for anyone who points the output somewhere watched.
//
// Note `xattr -cr`, the usual advice, does not work: it gives up on com.apple.fileprovider.fpfs#P,
// which the file provider owns and will not release, before ever reaching FinderInfo. Deleting only
// the attribute codesign objects to succeeds and leaves the provider's bookkeeping intact.
function stripFinderInfo(appPath) {
    try {
        execFileSync("xattr", ["-r", "-d", "com.apple.FinderInfo", appPath], {stdio: "ignore"});
    } catch {
        // Nothing to remove is the normal case, and is not worth reporting either way.
    }
}

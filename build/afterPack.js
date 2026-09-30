// Prepares the packaged app for signing: embeds the "Open in EDEX" service helper, then strips the
// extended attribute that stops codesign from signing the bundle at all.

const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");
const {Arch} = require("builder-util");
const {swiftTargetForArch} = require("./lib/arch.js");
const {stripFinderInfo} = require("./lib/xattr.js");

// Must match CFBundleName, CFBundleExecutable and NSPortName in extras/service-helper/Info.plist.
const HELPER_NAME = "EDEX Service";
exports.HELPER_NAME = HELPER_NAME;

exports.default = async function(context) {
    if (context.electronPlatformName !== "darwin") return;

    const projectDir = context.packager.info.projectDir;
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

    embedServiceHelper(projectDir, appPath, Arch[context.arch]);
    stripFinderInfo(appPath);
};

// Electron cannot publish an NSServices provider by itself, so a tiny Swift agent does it.
// Living inside the app bundle is what makes macOS list the entry in the main Finder context
// menu — the same place Terminal's "New Terminal at Folder" appears — rather than burying it
// under Quick Actions like an Automator workflow.
//
// Requires the Xcode command line tools. If swiftc is missing the build still succeeds; the
// app just ships without the Finder integration.
function embedServiceHelper(projectDir, appPath, archName) {
    const sourceDir = path.join(projectDir, "extras", "service-helper");
    const bundlePath = path.join(appPath, "Contents", "Library", "Services", `${HELPER_NAME}.app`);

    try {
        execFileSync("which", ["swiftc"], {stdio: "ignore"});
    } catch {
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
        "-target", swiftTargetForArch(archName),
        "-framework", "Cocoa",
        "-o", path.join(macosDir, HELPER_NAME),
        path.join(sourceDir, "main.swift")
    ], {stdio: "inherit"});

    fs.copyFileSync(path.join(sourceDir, "Info.plist"), path.join(bundlePath, "Contents", "Info.plist"));
    fs.copyFileSync(path.join(projectDir, "media", "icon.icns"), path.join(resourcesDir, "icon.icns"));

    console.log(`  • embedded the Finder service helper  path=${path.relative(projectDir, bundlePath)}`);
}

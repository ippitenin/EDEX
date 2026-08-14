// Builds the "Open in EDEX" service helper and embeds it in the packaged app.
//
// Electron cannot publish an NSServices provider by itself, so a tiny Swift agent does it.
// Living inside the app bundle is what makes macOS list the entry in the main Finder context
// menu — the same place Terminal's "New Terminal at Folder" appears — rather than burying it
// under Quick Actions like an Automator workflow.
//
// Requires the Xcode command line tools. If swiftc is missing the build still succeeds; the
// app just ships without the Finder integration.

const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const HELPER_NAME = "EDEX Service";

exports.default = async function(context) {
    if (context.electronPlatformName !== "darwin") return;

    const projectDir = context.packager.info.projectDir;
    const sourceDir = path.join(projectDir, "extras", "service-helper");
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
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
};

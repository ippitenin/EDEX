"use strict";

// Build tooling, and the names the build relies on staying in step across files that know nothing
// of each other. None of this breaks loudly: a mismatch ships an app whose Finder service cannot
// find it, or a version that says one thing in Finder and another in the About box.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const {Arch} = require("builder-util");
const {swiftTargetForArch} = require("../build/lib/arch.js");
const {HELPER_NAME} = require("../build/afterPack.js");
const {finderServiceHelper} = require("../src/utils/system.js");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf-8");

// The one-line <key>…</key><string>…</string> pairs are all this needs from a plist.
function plistString(xml, key) {
    const match = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
    return match && match[1];
}

test("the service helper is compiled for the architecture being packaged", () => {
    assert.strictEqual(swiftTargetForArch("arm64"), "arm64-apple-macos11.0");
    assert.strictEqual(swiftTargetForArch("x64"), "x86_64-apple-macos11.0");
});

test("the architecture names come from electron-builder's own enum", () => {
    // afterPack receives context.arch as a number and maps it through Arch.
    assert.strictEqual(swiftTargetForArch(Arch[Arch.arm64]), "arm64-apple-macos11.0");
    assert.strictEqual(swiftTargetForArch(Arch[Arch.x64]), "x86_64-apple-macos11.0");
});

test("architectures the helper cannot be built for are refused", () => {
    // Universal would need both slices joined with lipo; the others are not Macs.
    for (const arch of ["universal", "ia32", "armv7l", undefined, "constructor"]) {
        assert.throws(() => swiftTargetForArch(arch), /cannot be built/, String(arch));
    }
});

test("the helper's minimum macOS matches the target it is compiled for", () => {
    const plist = read("extras/service-helper/Info.plist");
    assert.strictEqual(`arm64-apple-macos${plistString(plist, "LSMinimumSystemVersion")}`, swiftTargetForArch("arm64"));
});

test("the app and src/ declare the same version", () => {
    // Finder shows the root one, app.getVersion() — and so the About box and TERM_PROGRAM_VERSION —
    // reads the one in src/.
    assert.strictEqual(JSON.parse(read("src/package.json")).version, JSON.parse(read("package.json")).version);
});

test("the service helper looks for the bundle id and executable the app is built with", () => {
    const pkg = JSON.parse(read("package.json"));
    const swift = read("extras/service-helper/main.swift");
    assert.ok(swift.includes(`let edexBundleID = "${pkg.build.appId}"`), "bundle id");
    assert.ok(swift.includes(`"Contents/MacOS/${pkg.build.productName}"`), "executable");
});

test("the helper bundle is named the way its Info.plist says", () => {
    const plist = read("extras/service-helper/Info.plist");
    assert.strictEqual(plistString(plist, "CFBundleName"), HELPER_NAME);
    assert.strictEqual(plistString(plist, "CFBundleExecutable"), HELPER_NAME);
    assert.strictEqual(plistString(plist, "NSPortName"), HELPER_NAME);
});

test("the app registers the helper afterPack embeds", () => {
    // The helper is not registered by macOS together with the app; EDEX runs it with --register on
    // every launch. A renamed bundle or a dropped flag would quietly bring the missing menu entry back.
    const helper = finderServiceHelper("/Applications/EDEX.app/Contents/MacOS/EDEX", "/Users/me");
    assert.ok(helper.endsWith(`/Contents/Library/Services/${HELPER_NAME}.app/Contents/MacOS/${HELPER_NAME}`), helper);
    assert.ok(read("src/_boot.js").includes(`["--register"]`), "_boot.js passes the flag");
    assert.ok(read("extras/service-helper/main.swift").includes(`"--register"`), "main.swift reads the flag");
});

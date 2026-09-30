"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {codeForKeySlot} = require("../src/utils/keyboard.js");

const layoutsDir = path.join(__dirname, "..", "src", "assets", "kb_layouts");
const ROWS = ["row_numbers", "row_1", "row_2", "row_3", "row_space"];

function loadLayout(name) {
    return JSON.parse(fs.readFileSync(path.join(layoutsDir, name), "utf8"));
}

// Walks a layout the way the Keyboard class does and returns what each physical key types.
function cmdByCode(layout) {
    const found = {};
    for (const row of Object.keys(layout)) {
        layout[row].forEach((keyObj, index) => {
            const code = codeForKeySlot(row, index);
            if (code !== null) found[code] = keyObj.cmd;
        });
    }
    return found;
}

// The table is only right if it agrees with the layout whose key names match the codes, so
// check it against the real file rather than against a copy of itself.
test("every code lands on the key that types its character in en-US", () => {
    const keys = cmdByCode(loadLayout("en-US.json"));

    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
        assert.strictEqual(keys["Key"+letter.toUpperCase()], letter, `Key${letter.toUpperCase()}`);
    }
    for (const digit of "0123456789") {
        assert.strictEqual(keys["Digit"+digit], digit, `Digit${digit}`);
    }
    assert.deepStrictEqual(
        ["Backquote", "Minus", "Equal", "BracketLeft", "BracketRight", "Semicolon", "Quote", "Backslash", "Comma", "Period", "Slash"].map(code => keys[code]),
        ["`", "-", "=", "[", "]", ";", "'", "\\", ",", ".", "/"]
    );
});

test("the key a Russian layout reports as р is found where H sits", () => {
    // The regression this module exists for: KeyH has to resolve without looking at the character.
    assert.strictEqual(loadLayout("en-US.json").row_2[6].cmd, "h");
    assert.strictEqual(codeForKeySlot("row_2", 6), "KeyH");
});

test("no two slots claim the same physical key", () => {
    const seen = new Set();
    for (const row of ROWS) {
        for (let index = 0; index < 20; index++) {
            const code = codeForKeySlot(row, index);
            if (code === null) continue;
            assert.ok(!seen.has(code), `${code} appears twice`);
            seen.add(code);
        }
    }
    assert.strictEqual(seen.size, 48);
});

test("keys the keyboard already finds by code are left alone", () => {
    // Slot 0 of each row is ESC, TAB, CAPS, SHIFT; the ends are BACK, ENTER, SHIFT and arrows.
    for (const row of ROWS) assert.strictEqual(codeForKeySlot(row, 0), null, `${row}[0]`);
    assert.strictEqual(codeForKeySlot("row_numbers", 14), null);
    assert.strictEqual(codeForKeySlot("row_1", 13), null);
    assert.strictEqual(codeForKeySlot("row_2", 13), null);
    assert.strictEqual(codeForKeySlot("row_3", 12), null);
    for (let index = 0; index < 8; index++) assert.strictEqual(codeForKeySlot("row_space", index), null);
});

test("rows and indexes a custom layout might invent resolve to nothing", () => {
    assert.strictEqual(codeForKeySlot("row_function", 1), null);
    assert.strictEqual(codeForKeySlot("toString", 1), null);
    assert.strictEqual(codeForKeySlot("row_1", -1), null);
    assert.strictEqual(codeForKeySlot("row_1", 1.5), null);
    assert.strictEqual(codeForKeySlot("row_1", "1"), null);
    assert.strictEqual(codeForKeySlot(undefined, undefined), null);
});

test("every bundled layout has a character key in each mapped slot", () => {
    for (const name of fs.readdirSync(layoutsDir).filter(f => f.endsWith(".json"))) {
        let layout;
        try {
            layout = loadLayout(name);
        } catch {
            // en-WORKMAN.json ships truncated upstream and cannot be loaded by the app either.
            continue;
        }
        const keys = cmdByCode(layout);
        assert.strictEqual(Object.keys(keys).length, 48, `${name} is missing slots`);
        for (const [code, cmd] of Object.entries(keys)) {
            // Dead keys (ESCAPED|-- ACUTE and friends) are character keys; modifiers are not.
            assert.ok(typeof cmd === "string" && !/^ESCAPED\|-- (CTRL|SHIFT|ALT|FN|CAPSLCK)/.test(cmd), `${name}: ${code} maps to a modifier`);
        }
    }
});

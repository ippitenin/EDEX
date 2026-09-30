// The on-screen keyboard's data: which physical key each slot stands for, what the dead keys do
// to the next character, and the control sequences keys send.
//
// Which physical key each slot stands for:
//
// A layout file only says which character each slot types. Matching a key press against those
// characters works as long as the system layout produces them — and stops the moment it does
// not: under a Russian layout the H key reports "р", which no slot in en-US.json carries, so
// nothing lights up. KeyboardEvent.code names the physical key whatever the input language is,
// and every layout ships the same grid, so the slot's position is enough to know its code.
//
// Kept dependency-free and side-effect-free so the test suite can exercise it directly.

"use strict";

// Each row starts at index 1: slot 0 is ESC, TAB, CAPS or SHIFT, which the keyboard already
// finds by code. The same goes for whatever follows the last entry (BACK, ENTER, SHIFT, the
// arrows) — and for the extra key pt-BR squeezes in before the right shift, which simply keeps
// being matched by character.
const CHARACTER_SLOTS = {
    row_numbers: ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    row_1: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
    row_2: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"],
    row_3: ["IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"]
};

/**
 * Returns the KeyboardEvent.code of the physical key behind a slot of the on-screen keyboard,
 * or null for slots that are not character keys (or rows a custom layout made up).
 */
function codeForKeySlot(rowId, index) {
    if (!Object.prototype.hasOwnProperty.call(CHARACTER_SLOTS, rowId)) return null;
    if (!Number.isInteger(index)) return null;
    return CHARACTER_SLOTS[rowId][index - 1] || null;
}

// What a dead key (ESCAPED|-- ACUTE and friends in a layout) does to the character typed after it.
// A character a table does not list comes through unchanged. These were thirteen switch
// statements in keyboard.class.js, 720 lines between them; test/fixtures/keyboard-legacy.json
// holds what those returned, and the tests hold these tables to it.
//
// Most results are single precomposed characters. The few with no precomposed form — J, V, M and
// dotless j with an accent — are a letter plus a combining mark, written out as \u escapes so
// they can be told apart from what they look like. Maps rather than objects, so that "constructor"
// typed after a dead key does not find Object.prototype's.
const DEAD_KEYS = {
    CIRCUM: new Map([
        ["a", "â"], ["A", "Â"], ["z", "ẑ"], ["Z", "Ẑ"], ["e", "ê"], ["E", "Ê"],
        ["y", "ŷ"], ["Y", "Ŷ"], ["u", "û"], ["U", "Û"], ["i", "î"], ["I", "Î"],
        ["o", "ô"], ["O", "Ô"], ["s", "ŝ"], ["S", "Ŝ"], ["g", "ĝ"], ["G", "Ĝ"],
        ["h", "ĥ"], ["H", "Ĥ"], ["j", "ĵ"], ["J", "Ĵ"], ["w", "ŵ"], ["W", "Ŵ"],
        ["c", "ĉ"], ["C", "Ĉ"], ["1", "¹"], ["2", "²"], ["3", "³"], ["4", "⁴"],
        ["5", "⁵"], ["6", "⁶"], ["7", "⁷"], ["8", "⁸"], ["9", "⁹"], ["0", "⁰"]
    ]),
    TREMA: new Map([
        ["a", "ä"], ["A", "Ä"], ["e", "ë"], ["E", "Ë"], ["t", "ẗ"], ["y", "ÿ"],
        ["Y", "Ÿ"], ["u", "ü"], ["U", "Ü"], ["i", "ï"], ["I", "Ï"], ["o", "ö"],
        ["O", "Ö"], ["h", "ḧ"], ["H", "Ḧ"], ["w", "ẅ"], ["W", "Ẅ"], ["x", "ẍ"],
        ["X", "Ẍ"]
    ]),
    ACUTE: new Map([
        ["a", "á"], ["A", "Á"], ["c", "ć"], ["C", "Ć"], ["e", "é"], ["E", "E"],
        ["g", "ǵ"], ["G", "Ǵ"], ["i", "í"], ["I", "Í"], ["j", "ȷ\u0301"], ["J", "J\u0301"],
        ["k", "ḱ"], ["K", "Ḱ"], ["l", "ĺ"], ["L", "Ĺ"], ["m", "ḿ"], ["M", "Ḿ"],
        ["n", "ń"], ["N", "Ń"], ["o", "ó"], ["O", "Ó"], ["p", "ṕ"], ["P", "Ṕ"],
        ["r", "ŕ"], ["R", "Ŕ"], ["s", "ś"], ["S", "Ś"], ["u", "ú"], ["U", "Ú"],
        ["v", "v\u0301"], ["V", "V\u0301"], ["w", "ẃ"], ["W", "Ẃ"], ["y", "ý"], ["Y", "Ý"],
        ["z", "ź"], ["Z", "Ź"], ["ê", "ế"], ["Ê", "Ế"], ["ç", "ḉ"], ["Ç", "Ḉ"]
    ]),
    GRAVE: new Map([
        ["a", "à"], ["A", "À"], ["e", "è"], ["E", "È"], ["i", "ì"], ["I", "Ì"],
        ["m", "m\u0300"], ["M", "M\u0300"], ["n", "ǹ"], ["N", "Ǹ"], ["o", "ò"], ["O", "Ò"],
        ["u", "ù"], ["U", "Ù"], ["v", "v\u0300"], ["V", "V\u0300"], ["w", "ẁ"], ["W", "Ẁ"],
        ["y", "ỳ"], ["Y", "Ỳ"], ["ê", "ề"], ["Ê", "Ề"]
    ]),
    CARON: new Map([
        ["a", "ǎ"], ["A", "Ǎ"], ["c", "č"], ["C", "Č"], ["d", "ď"], ["D", "Ď"],
        ["e", "ě"], ["E", "Ě"], ["g", "ǧ"], ["G", "Ǧ"], ["h", "ȟ"], ["H", "Ȟ"],
        ["i", "ǐ"], ["I", "Ǐ"], ["j", "ǰ"], ["k", "ǩ"], ["K", "Ǩ"], ["l", "ľ"],
        ["L", "Ľ"], ["n", "ň"], ["N", "Ň"], ["o", "ǒ"], ["O", "Ǒ"], ["r", "ř"],
        ["R", "Ř"], ["s", "š"], ["S", "Š"], ["t", "ť"], ["T", "Ť"], ["u", "ǔ"],
        ["U", "Ǔ"], ["z", "ž"], ["Z", "Ž"], ["1", "₁"], ["2", "₂"], ["3", "₃"],
        ["4", "₄"], ["5", "₅"], ["6", "₆"], ["7", "₇"], ["8", "₈"], ["9", "₉"],
        ["0", "₀"]
    ]),
    BAR: new Map([
        ["a", "ⱥ"], ["A", "Ⱥ"], ["b", "ƀ"], ["B", "Ƀ"], ["c", "ȼ"], ["C", "Ȼ"],
        ["d", "đ"], ["D", "Đ"], ["e", "ɇ"], ["E", "Ɇ"], ["g", "ǥ"], ["G", "Ǥ"],
        ["h", "ħ"], ["H", "Ħ"], ["i", "ɨ"], ["I", "Ɨ"], ["j", "ɉ"], ["J", "Ɉ"],
        ["l", "ł"], ["L", "Ł"], ["o", "ø"], ["O", "Ø"], ["p", "ᵽ"], ["P", "Ᵽ"],
        ["r", "ɍ"], ["R", "Ɍ"], ["t", "ŧ"], ["T", "Ŧ"], ["u", "ʉ"], ["U", "Ʉ"],
        ["y", "ɏ"], ["Y", "Ɏ"], ["z", "ƶ"], ["Z", "Ƶ"]
    ]),
    BREVE: new Map([
        ["a", "ă"], ["A", "Ă"], ["e", "ĕ"], ["E", "Ĕ"], ["g", "ğ"], ["G", "Ğ"],
        ["i", "ĭ"], ["I", "Ĭ"], ["o", "ŏ"], ["O", "Ŏ"], ["u", "ŭ"], ["U", "Ŭ"],
        ["à", "ằ"], ["À", "Ằ"]
    ]),
    TILDE: new Map([
        ["a", "ã"], ["A", "Ã"], ["e", "ẽ"], ["E", "Ẽ"], ["i", "ĩ"], ["I", "Ĩ"],
        ["n", "ñ"], ["N", "Ñ"], ["o", "õ"], ["O", "Õ"], ["u", "ũ"], ["U", "Ũ"],
        ["v", "ṽ"], ["V", "Ṽ"], ["y", "ỹ"], ["Y", "Ỹ"], ["ê", "ễ"], ["Ê", "Ễ"]
    ]),
    MACRON: new Map([
        ["a", "ā"], ["A", "Ā"], ["e", "ē"], ["E", "Ē"], ["g", "ḡ"], ["G", "Ḡ"],
        ["i", "ī"], ["I", "Ī"], ["o", "ō"], ["O", "Ō"], ["u", "ū"], ["U", "Ū"],
        ["y", "ȳ"], ["Y", "Ȳ"], ["é", "ḗ"], ["É", "Ḗ"], ["è", "ḕ"], ["È", "Ḕ"]
    ]),
    CEDILLA: new Map([
        ["c", "ç"], ["C", "Ç"], ["d", "ḑ"], ["D", "Ḑ"], ["e", "ȩ"], ["E", "Ȩ"],
        ["g", "ģ"], ["G", "Ģ"], ["h", "ḩ"], ["H", "Ḩ"], ["k", "ķ"], ["K", "Ķ"],
        ["l", "ļ"], ["L", "Ļ"], ["n", "ņ"], ["N", "Ņ"], ["r", "ŗ"], ["R", "Ŗ"],
        ["s", "ş"], ["S", "Ş"], ["t", "ţ"], ["T", "Ţ"]
    ]),
    OVERRING: new Map([
        ["a", "å"], ["A", "Å"], ["u", "ů"], ["U", "Ů"], ["w", "ẘ"], ["y", "ẙ"]
    ]),
    GREEK: new Map([
        ["b", "β"], ["p", "π"], ["P", "Π"], ["d", "δ"], ["D", "Δ"], ["l", "λ"],
        ["L", "Λ"], ["j", "θ"], ["J", "Θ"], ["z", "ζ"], ["w", "ω"], ["W", "Ω"],
        ["A", "α"], ["u", "υ"], ["U", "Υ"], ["i", "ι"], ["e", "ε"], ["t", "τ"],
        ["s", "σ"], ["S", "Σ"], ["r", "ρ"], ["R", "Ρ"], ["n", "ν"], ["m", "μ"],
        ["y", "ψ"], ["Y", "Ψ"], ["x", "ξ"], ["X", "Ξ"], ["k", "κ"], ["q", "χ"],
        ["Q", "Χ"], ["g", "γ"], ["G", "Γ"], ["h", "η"], ["f", "φ"], ["F", "Φ"]
    ]),
    IOTASUB: new Map([
        ["o", "ǫ"], ["O", "Ǫ"], ["a", "ą"], ["A", "Ą"], ["u", "ų"], ["U", "Ų"],
        ["i", "į"], ["I", "Į"], ["e", "ę"], ["E", "Ę"]
    ])
};

/**
 * Applies a dead key to the character typed after it. An unknown dead key leaves it unchanged too.
 */
function applyDeadKey(deadKey, cmd) {
    if (!Object.prototype.hasOwnProperty.call(DEAD_KEYS, deadKey)) return cmd;
    const table = DEAD_KEYS[deadKey];
    return table.has(cmd) ? table.get(cmd) : cmd;
}

// What Ctrl plus a key sends, by the n in the ~~~CTRLSEQn~~~ placeholders of the layout files.
// These used to be raw control bytes in the source, invisible in any editor. Index 9 repeats 8
// (^R); that is what upstream shipped, and it is kept until someone decides what Ctrl+T should do.
const CTRLSEQ = Object.freeze([
    "",
    "\x1b", "\x1c", "\x1d", "\x1e", "\x1f", // 1–5: ESC, ^\, ^], ^^, ^_
    "\x11", "\x17", "\x12", "\x12", "\x19", // 6–10: ^Q, ^W, ^R, ^R, ^Y
    "\x15", "\x10", "\x01", "\x13", "\x04", // 11–15: ^U, ^P, ^A, ^S, ^D
    "\x06", "\x1a", "\x18", "\x03", "\x16", // 16–20: ^F, ^Z, ^X, ^C, ^V
    "\x02"                                  // 21: ^B
]);

// The sequences the special keys send, which the keyboard also has to recognise coming back.
const KEY_SEQUENCES = Object.freeze({
    ESCAPE: "\x1b",
    BACKSPACE: "\b",
    ARROW_UP: "\x1bOA",
    ARROW_LEFT: "\x1bOD",
    ARROW_DOWN: "\x1bOB",
    ARROW_RIGHT: "\x1bOC"
});

/**
 * Splits a shortcut trigger such as "Shift+Ctrl+F" into its key and the modifier combination the
 * on-screen keyboard files it under — "CtrlShift": Ctrl, Alt and Shift in that order, whatever
 * order the trigger names them in. Anything else stays in the combination as written, which is
 * how the keyboard recognises a trigger it cannot handle.
 */
function parseShortcutTrigger(trigger) {
    const mods = trigger.split("+");
    const key = mods.pop();
    const order = ["Ctrl", "Alt", "Shift"];
    mods.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return {category: mods.join(""), key};
}

module.exports = {codeForKeySlot, applyDeadKey, CTRLSEQ, KEY_SEQUENCES, parseShortcutTrigger};

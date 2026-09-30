// Maps the slots of the on-screen keyboard to the physical keys they stand for.
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

module.exports = {codeForKeySlot};

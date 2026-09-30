"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {shortenPath} = require("../src/utils/paths.js");

// The renderer measures in pixels; one unit per character is enough to pin the logic down.
const within = limit => text => text.length <= limit;

const DEEP = "/private/tmp/claude-501/-Users-ilyapitenin-Desktop-VibeCode-EDEX/b0d505d0-a46d-4a42-ad0e-4e79b5e6ccb1/scratchpad/sample/Демис";

test("a path that fits is returned untouched", () => {
    assert.strictEqual(shortenPath("/Users/me/Desktop", within(40)), "/Users/me/Desktop");
    assert.strictEqual(shortenPath(DEEP, within(DEEP.length)), DEEP);
});

test("a path that does not fit loses folders from the middle, never from either end", () => {
    const short = shortenPath(DEEP, within(60));
    assert.ok(short.length <= 60, short);
    assert.ok(short.startsWith("/private/"), short);
    assert.ok(short.endsWith("/sample/Демис"), short);
    assert.strictEqual(short.split("…").length, 2, "exactly one gap");
    assert.ok(short.includes("/…/"), "the gap stands in for whole folders");
});

test("every folder that remains is one the path really has, in order", () => {
    const original = DEEP.split("/");
    for (let limit = 20; limit < DEEP.length; limit += 7) {
        const kept = shortenPath(DEEP, within(limit)).split("/").filter(part => part !== "…");
        let from = 0;
        for (const part of kept) {
            const at = original.indexOf(part, from);
            assert.ok(at >= from, `limit ${limit}: ${part} is not from the path`);
            from = at + 1;
        }
    }
});

test("the space is used: one more folder on either side would not have fitted", () => {
    const parts = DEEP.split("/").filter(Boolean);
    for (let limit = 30; limit < DEEP.length; limit += 5) {
        const short = shortenPath(DEEP, within(limit));
        if (!short.includes("/…/")) continue;
        const [head, tail] = short.split("/…/");
        const h = head.split("/").filter(Boolean).length;
        const t = tail.split("/").length;
        if (h + t >= parts.length - 1) continue;
        const moreTail = `${head}/…/${parts.slice(parts.length - t - 1).join("/")}`;
        const moreHead = `/${parts.slice(0, h + 1).join("/")}/…/${tail}`;
        assert.ok(moreTail.length > limit && moreHead.length > limit, `limit ${limit}: ${short} could have kept more`);
    }
});

test("the end of the path gets the space before the beginning does", () => {
    // Room for exactly one extra folder: it has to be the parent of the current one.
    assert.strictEqual(shortenPath("/aaaa/bbbb/cccc/dddd/eeee", within(17)), "/aaaa/…/dddd/eeee");
});

test("when both ends cannot stay, the beginning goes", () => {
    const short = shortenPath("/Volumes/Archive/2026/Проекты/Очень длинное название папки", within(32));
    assert.strictEqual(short, "…/Очень длинное название папки");
});

test("when not even the last name fits, its end is kept", () => {
    assert.strictEqual(shortenPath("/Users/me/a-very-long-folder-name", within(10)), "…lder-name");
});

test("a relative path and text that is not a path at all are handled", () => {
    assert.strictEqual(shortenPath("one/two/three/four", within(12)), "one/…/four");
    assert.strictEqual(shortenPath("Showing available block devices", within(100)), "Showing available block devices");
    assert.strictEqual(shortenPath("Showing available block devices", within(8)), "…devices");
});

test("the result always fits, or is the bare ellipsis when nothing can", () => {
    for (let limit = 0; limit <= DEEP.length; limit++) {
        const short = shortenPath(DEEP, within(limit));
        assert.ok(short.length <= limit || short === "…", `limit ${limit}: ${short}`);
    }
    assert.strictEqual(shortenPath(DEEP, () => false), "…");
});

test("odd input is coerced instead of thrown on", () => {
    assert.strictEqual(shortenPath(undefined, within(10)), "");
    assert.strictEqual(shortenPath(null, within(10)), "");
    assert.strictEqual(shortenPath("", within(10)), "");
    assert.strictEqual(shortenPath("/", within(10)), "/");
    assert.strictEqual(shortenPath(12345, within(10)), "12345");
});

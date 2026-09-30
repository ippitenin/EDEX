"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {pad, splitDuration, formatRuntime, formatMediaTime, formatBytes} = require("../src/utils/format.js");

// The copies these functions replaced, verbatim, to hold the new ones to byte-for-byte output.
const legacy = {
    // toplist.class.js
    formatRuntime(ms) {
        const msInDay = 24 * 60 * 60 * 1000;
        let days = Math.floor(ms / msInDay);
        let remainingMS = ms % msInDay;
        const msInHour = 60 * 60 * 1000;
        let hours = Math.floor(remainingMS / msInHour);
        remainingMS = ms % msInHour;
        let msInMin = 60 * 1000;
        let minutes = Math.floor(remainingMS / msInMin);
        remainingMS = ms % msInMin;
        let seconds = Math.floor(remainingMS / 1000);
        return `${days < 10 ? "0" : ""}${days}:${hours < 10 ? "0" : ""}${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    },
    // mediaPlayer.class.js
    mediaTimeToHMS(time) {
        let seconds = parseInt(time);
        const hours = parseInt(seconds / 3600);
        seconds = seconds % 3600;
        const minutes = parseInt(seconds / 60);
        seconds = seconds % 60;
        return (hours < 10 ? "0" : "") + hours + ":" +
            (minutes < 10 ? "0" : "") + minutes + ":" +
            (seconds < 10 ? "0" : "") + seconds;
    },
    // sysinfo.class.js, uptime
    uptime(raw) {
        let days = Math.floor(raw/86400);
        raw -= days*86400;
        let hours = Math.floor(raw/3600);
        raw -= hours*3600;
        let minutes = Math.floor(raw/60);
        if (hours.toString().length !== 2) hours = "0"+hours;
        if (minutes.toString().length !== 2) minutes = "0"+minutes;
        return `${days}d${hours}:${minutes}`;
    },
    // filesystem.class.js
    formatBytes(a,b) {if(0==a)return"0 Bytes";var c=1024,d=b||2,e=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"],f=Math.floor(Math.log(a)/Math.log(c));return parseFloat((a/Math.pow(c,f)).toFixed(d))+" "+e[f]}
};

// A spread of values: small ones digit by digit, then boundaries and big jumps.
function* samples(limit) {
    for (let v = 0; v < 200; v++) yield v;
    for (let v = 200; v < limit; v = Math.ceil(v * 1.37) + 1) {
        yield v - 1; yield v; yield v + 1;
    }
}

test("pad fills to the width and leaves longer values alone", () => {
    assert.strictEqual(pad(7), "07");
    assert.strictEqual(pad(12), "12");
    assert.strictEqual(pad(123), "123");
    assert.strictEqual(pad(80, 3), "080");
    assert.strictEqual(pad(NaN), "NaN");
});

test("splitDuration breaks seconds into days, hours, minutes and seconds", () => {
    assert.deepStrictEqual(splitDuration(0), {days: 0, hours: 0, minutes: 0, seconds: 0});
    assert.deepStrictEqual(splitDuration(90061), {days: 1, hours: 1, minutes: 1, seconds: 1});
    assert.deepStrictEqual(splitDuration(86399), {days: 0, hours: 23, minutes: 59, seconds: 59});
});

test("process runtimes read exactly as the process window showed them", () => {
    for (const ms of samples(400 * 86400 * 1000)) {
        assert.strictEqual(formatRuntime(ms), legacy.formatRuntime(ms), String(ms));
    }
    // The window passes a Date, the difference between now and the start time.
    const runtime = new Date(3 * 86400000 + 4 * 3600000 + 5 * 60000 + 6000 + 789);
    assert.strictEqual(formatRuntime(runtime), "03:04:05:06");
    assert.strictEqual(formatRuntime(runtime), legacy.formatRuntime(runtime));
    assert.strictEqual(formatRuntime(NaN), legacy.formatRuntime(NaN));
});

test("media times read exactly as the player showed them", () => {
    for (const s of samples(500 * 3600)) {
        assert.strictEqual(formatMediaTime(s), legacy.mediaTimeToHMS(s), String(s));
        assert.strictEqual(formatMediaTime(s + 0.73), legacy.mediaTimeToHMS(s + 0.73), String(s + 0.73));
    }
    // Before the metadata loads, and for a stream.
    for (const odd of [NaN, Infinity, undefined]) {
        assert.strictEqual(formatMediaTime(odd), legacy.mediaTimeToHMS(odd), String(odd));
    }
});

test("uptime reads exactly as the system panel showed it", () => {
    for (const raw of samples(1000 * 86400)) {
        const {days, hours, minutes} = splitDuration(raw);
        assert.strictEqual(`${days}d${pad(hours)}:${pad(minutes)}`, legacy.uptime(raw), String(raw));
    }
});

test("file sizes read exactly as the filesystem panel showed them", () => {
    for (const bytes of samples(2 ** 60)) {
        assert.strictEqual(formatBytes(bytes), legacy.formatBytes(bytes), String(bytes));
    }
    assert.strictEqual(formatBytes(1536), "1.5 KB");
    assert.strictEqual(formatBytes(0), "0 Bytes");
});

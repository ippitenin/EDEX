// Numbers into the text the panels show: clock digits, durations, sizes.
//
// Each panel used to carry its own copy of the same zero-padding and hour-minute arithmetic,
// written slightly differently every time. The output of each is kept exactly as it was — the
// tests compare against the copies these replaced.
//
// Kept dependency-free and side-effect-free so the test suite can exercise it directly.

"use strict";

/**
 * Left-pads a number with zeros to the given width: 7 becomes "07". Longer values are left as they
 * are, and so is anything that is not a finite number ("NaN" stays "NaN").
 */
function pad(value, width = 2) {
    return String(value).padStart(width, "0");
}

/**
 * Splits a number of seconds into whole days, hours, minutes and seconds.
 */
function splitDuration(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return {days, hours, minutes, seconds};
}

/**
 * How long a process has been running, from milliseconds, as DD:HH:MM:SS.
 */
function formatRuntime(ms) {
    const {days, hours, minutes, seconds} = splitDuration(Math.floor(ms / 1000));
    return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * A media position or duration, from seconds, as HH:MM:SS; hours do not wrap at 24. parseInt, not
 * Math.floor, because that is what the player always did — an Infinity duration (a stream) comes
 * out as NaN:NaN:NaN rather than as a number of hours.
 */
function formatMediaTime(time) {
    let seconds = parseInt(time);
    const hours = parseInt(seconds / 3600);
    seconds = seconds % 3600;
    const minutes = parseInt(seconds / 60);
    seconds = seconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const BYTE_UNITS = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

/**
 * A file size in binary units with at most two decimals and no trailing zeros: 1536 is "1.5 KB".
 */
function formatBytes(bytes) {
    if (bytes == 0) return "0 Bytes";
    const unit = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, unit)).toFixed(2)) + " " + BYTE_UNITS[unit];
}

module.exports = {pad, splitDuration, formatRuntime, formatMediaTime, formatBytes};

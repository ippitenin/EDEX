"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {mergeThreadsByName, compareByLoad} = require("../src/utils/processes.js");

// The copy the top list and the process window each carried, verbatim.
function legacyMerge(list) {
    return list.sort((a, b) => {
        return (a.pid-b.pid);
    }).filter((e, index, a) => {
        let i = a.findIndex(x => x.name === e.name);
        if (i !== -1 && i !== index) {
            a[i].cpu = a[i].cpu+e.cpu;
            a[i].mem = a[i].mem+e.mem;
            return false;
        }
        return true;
    });
}

const clone = list => list.map(proc => ({...proc}));

const LIST = [
    {pid: 900, name: "Electron Helper", cpu: 2.5, mem: 1.0},
    {pid: 12, name: "zsh", cpu: 0.1, mem: 0.2},
    {pid: 450, name: "Electron Helper", cpu: 4.0, mem: 2.5},
    {pid: 30, name: "WindowServer", cpu: 12.0, mem: 3.0},
    {pid: 451, name: "Electron Helper", cpu: 1.5, mem: 0.5},
    {pid: 13, name: "zsh", cpu: 0.0, mem: 0.1}
];

test("processes sharing a name fold into the one with the lowest pid", () => {
    const merged = mergeThreadsByName(clone(LIST));
    assert.deepStrictEqual(merged.map(p => p.pid), [12, 30, 450]);
    const helper = merged.find(p => p.name === "Electron Helper");
    assert.strictEqual(helper.cpu, 8.0);
    assert.strictEqual(helper.mem, 4.0);
});

test("the fold is the one the panels did before", () => {
    assert.deepStrictEqual(mergeThreadsByName(clone(LIST)), legacyMerge(clone(LIST)));
    assert.deepStrictEqual(mergeThreadsByName([]), []);
});

test("the busiest process comes first, memory breaking near-ties", () => {
    const sorted = clone(LIST).sort(compareByLoad);
    assert.strictEqual(sorted[0].name, "WindowServer");
    const tie = [{cpu: 1, mem: 1}, {cpu: 1, mem: 5}].sort(compareByLoad);
    assert.strictEqual(tie[0].mem, 5);
    // The order the top list always used.
    const legacyOrder = clone(LIST).sort((a, b) => ((b.cpu-a.cpu)*100 + b.mem-a.mem));
    assert.deepStrictEqual(sorted, legacyOrder);
});

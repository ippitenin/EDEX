"use strict";

const test = require("node:test");
const assert = require("node:assert");
const net = require("net");
const {findFreePort} = require("../src/utils/net.js");

// Holds a loopback port the way a dev server would, until the test lets it go.
function occupy(port = 0) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve(server));
    });
}

function release(server) {
    return new Promise(resolve => server.close(resolve));
}

// Proves the answer is usable, not merely different: the caller is about to bind it.
async function assertBindable(port) {
    const server = await occupy(port);
    await release(server);
}

test("findFreePort keeps the preferred port when nobody holds it", async () => {
    const probe = await occupy();
    const port = probe.address().port;
    await release(probe);

    assert.strictEqual(await findFreePort(port), port);
});

test("findFreePort moves off a port someone else is listening on", async () => {
    const squatter = await occupy();
    const taken = squatter.address().port;
    try {
        const port = await findFreePort(taken);
        assert.notStrictEqual(port, taken);
        await assertBindable(port);
    } finally {
        await release(squatter);
    }
});

test("findFreePort falls back to a system-assigned port for nonsense input", async () => {
    for (const bad of [NaN, 0, -1, 70000, "3000", undefined]) {
        const port = await findFreePort(bad);
        assert.ok(Number.isInteger(port) && port > 0 && port < 65536, `${bad} gave ${port}`);
        await assertBindable(port);
    }
});

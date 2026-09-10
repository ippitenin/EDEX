// Port selection for the terminal websockets.
//
// The terminal used to bind a fixed port straight from the settings — 3000 by default, which is
// also the default of Next.js, Create React App, Express and half the dev servers out there. With
// one of them running, the bind failed with EADDRINUSE and took the whole app down. The configured
// port is now only a preference; this finds out whether it can be had before anything commits to it.
//
// Unlike its neighbours this module touches the network, but only to bind and immediately release
// a loopback socket, so it is still safe to exercise from the tests.

"use strict";

const net = require("net");

// Errors that mean "not this port, try another" rather than something worth surfacing.
const PORT_UNAVAILABLE = new Set(["EADDRINUSE", "EACCES", "ERR_SOCKET_BAD_PORT"]);

function isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port < 65536;
}

function listenOnce(port, host) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once("error", reject);
        server.listen(port, host, () => {
            const bound = server.address().port;
            server.close(() => resolve(bound));
        });
    });
}

/**
 * Resolves to `preferred` if it can be bound on `host`, otherwise to a port the system picks.
 *
 * The probe binds the same host the websocket will, so a dev server listening on `::` or
 * `0.0.0.0` is caught exactly as it would collide with the real bind. The port is released before
 * the caller takes it; on loopback that gap is microseconds and nothing races for it in practice.
 */
async function findFreePort(preferred, host = "127.0.0.1") {
    if (isValidPort(preferred)) {
        try {
            return await listenOnce(preferred, host);
        } catch (e) {
            if (!PORT_UNAVAILABLE.has(e.code)) throw e;
        }
    }
    return listenOnce(0, host);
}

module.exports = {findFreePort};

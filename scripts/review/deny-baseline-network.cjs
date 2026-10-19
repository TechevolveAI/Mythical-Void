// Test-process guard, not an application setting or an operating-system sandbox.
const deny = () => { throw new Error('PRIVATE_BASELINE_NETWORK_DENIED'); };
const net = require('node:net');
net.Socket.prototype.connect = deny;
net.Server.prototype.listen = deny;
net.connect = net.createConnection = deny;
require('node:tls').connect = deny;
require('node:dgram').createSocket = deny;
for (const name of ['node:http', 'node:https']) {
    const api = require(name);
    api.request = api.get = deny;
}
for (const api of [require('node:dns'), require('node:dns').promises]) {
    for (const key of Object.keys(api)) {
        if (/^(lookup|resolve|reverse)/.test(key) && typeof api[key] === 'function') api[key] = deny;
    }
}
globalThis.fetch = () => Promise.reject(new Error('PRIVATE_BASELINE_NETWORK_DENIED'));
globalThis.WebSocket = class { constructor() { deny(); } };
Object.defineProperty(globalThis, Symbol.for('mythical.privateBaseline.networkDenied'), { value: true });

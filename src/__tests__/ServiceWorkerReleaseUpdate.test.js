const fs = require('fs');
const path = require('path');
const vm = require('vm');

const workerSource = fs.readFileSync(
    path.resolve(__dirname, '../../public/sw.js'),
    'utf8'
);

function createWorker(clients) {
    const listeners = {};
    const waits = [];
    const context = {
        URL,
        Promise,
        Set,
        console: { log: jest.fn() },
        setTimeout: callback => {
            callback();
            return 1;
        },
        caches: {
            keys: jest.fn(async () => ['mythical-creature-vold']),
            delete: jest.fn(async () => true),
            match: jest.fn(),
            open: jest.fn()
        },
        self: {
            location: {
                hostname: 'mythicalvoid.com',
                origin: 'https://mythicalvoid.com'
            },
            clients: {
                claim: jest.fn(async () => undefined),
                matchAll: jest.fn(async () => clients)
            },
            addEventListener: (type, handler) => {
                listeners[type] = handler;
            }
        }
    };
    vm.runInNewContext(workerSource, context);
    return {
        context,
        listeners,
        activate: async () => {
            listeners.activate({
                waitUntil: promise => waits.push(promise)
            });
            await Promise.all(waits);
        }
    };
}

function createClient(overrides = {}) {
    return {
        id: 'client-23',
        url: 'https://mythicalvoid.com/play/',
        visibilityState: 'visible',
        postMessage: jest.fn(),
        navigate: jest.fn(async () => undefined),
        ...overrides
    };
}

describe('service worker release synchronization', () => {
    test('refreshes an unacknowledged visible legacy game client once', async () => {
        const client = createClient();
        const worker = createWorker([client]);

        await worker.activate();

        expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'MYTHICAL_VOID_RELEASE_READY'
        }));
        expect(client.navigate).toHaveBeenCalledTimes(1);
        expect(client.navigate).toHaveBeenCalledWith(client.url);
        expect(worker.context.caches.delete)
            .toHaveBeenCalledWith('mythical-creature-vold');
    });

    test('does not force-navigate a current client that acknowledges the release', async () => {
        const client = createClient();
        const worker = createWorker([client]);
        client.postMessage.mockImplementation(message => {
            worker.listeners.message({
                data: {
                    type: 'MYTHICAL_VOID_RELEASE_ACK',
                    version: message.version
                },
                source: client
            });
        });

        await worker.activate();

        expect(client.navigate).not.toHaveBeenCalled();
    });

    test.each([
        ['hidden game client', { visibilityState: 'hidden' }],
        ['non-game client', { url: 'https://mythicalvoid.com/parents/' }],
        ['different origin', { url: 'https://example.com/play/' }]
    ])('does not force-navigate a %s', async (_label, overrides) => {
        const client = createClient(overrides);
        const worker = createWorker([client]);

        await worker.activate();

        expect(client.navigate).not.toHaveBeenCalled();
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const clientSource = fs.readFileSync(
    path.resolve(__dirname, '../../public/pwa-install.js'),
    'utf8'
);

function createClient({ documentRelease = '', controlled = false } = {}) {
    const listeners = {};
    const windowListeners = {};
    const posted = [];
    const reload = jest.fn();
    const serviceWorker = {
        controller: controlled ? {} : null,
        addEventListener: jest.fn((type, handler) => {
            listeners[type] = handler;
        }),
        register: jest.fn()
    };
    const context = {
        console,
        setInterval: jest.fn(),
        URL,
        document: {
            querySelector: jest.fn(selector => {
                if (selector === 'meta[name="mythical-void-release"]') {
                    return documentRelease
                        ? { getAttribute: () => documentRelease }
                        : null;
                }
                return null;
            }),
            addEventListener: jest.fn(),
            visibilityState: 'visible'
        },
        navigator: { serviceWorker },
        window: {
            location: {
                hostname: 'mythicalvoid.com',
                reload
            },
            navigator: {},
            isSecureContext: true,
            matchMedia: jest.fn(() => ({ matches: false })),
            setInterval: jest.fn(),
            addEventListener: jest.fn((type, handler) => {
                windowListeners[type] = handler;
            })
        }
    };
    context.window.window = context.window;
    vm.runInNewContext(clientSource, context);
    return {
        listeners,
        posted,
        reload,
        sendRelease(version) {
            listeners.message({
                data: { type: 'MYTHICAL_VOID_RELEASE_READY', version },
                source: { postMessage: message => posted.push(message) }
            });
        }
    };
}

describe('game document release handshake', () => {
    test('acknowledges only the worker that matches the loaded game document', () => {
        const client = createClient({ documentRelease: 'release-23' });

        client.sendRelease('release-23');

        expect(client.reload).not.toHaveBeenCalled();
        expect(client.posted).toEqual([{
            type: 'MYTHICAL_VOID_RELEASE_ACK',
            version: 'release-23'
        }]);
    });

    test.each([
        ['an older document', 'release-22'],
        ['a legacy document with no marker', '']
    ])('reloads %s even when it was not controlled at load', (_label, documentRelease) => {
        const client = createClient({ documentRelease, controlled: false });

        client.sendRelease('release-23');

        expect(client.posted).toEqual([]);
        expect(client.reload).toHaveBeenCalledTimes(1);
    });
});

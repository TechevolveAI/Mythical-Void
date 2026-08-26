const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSystem(relativePath, className, singletonName, runtime = {}) {
    const filePath = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { devLog, devWarn } from '../utils/devLogger.js';",
            'const devLog = () => {}; const devWarn = () => {};'
        )
        .replace(
            `export default ${singletonName};`,
            `module.exports = { ${className}, ${singletonName} };`
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {
            location: { protocol: 'http:' },
            envLoader: { get: jest.fn(() => 'test-nasa-key') }
        },
        localStorage: {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        },
        fetch: runtime.fetch || jest.fn(),
        Date,
        Math,
        Promise,
        setInterval: runtime.setInterval || jest.fn(() => 23),
        clearInterval: runtime.clearInterval || jest.fn(),
        setTimeout
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return {
        System: sandbox.module.exports[className],
        sandbox
    };
}

function successfulResponse(payload = []) {
    return {
        ok: true,
        status: 200,
        json: async () => payload
    };
}

describe('external data singleton lifecycle', () => {
    test('NASA initialization shares one request and one tracking interval', async () => {
        const fetchMock = jest.fn(async () => successfulResponse({
            media_type: 'image',
            title: 'Test APOD',
            url: 'https://example.test/apod.jpg'
        }));
        const setIntervalMock = jest.fn(() => 23);
        const clearIntervalMock = jest.fn();
        const { System } = loadSystem(
            'systems/NASAContentSystem.js',
            'NASAContentSystem',
            'nasaContentSystem',
            {
                fetch: fetchMock,
                setInterval: setIntervalMock,
                clearInterval: clearIntervalMock
            }
        );
        const system = new System();

        await Promise.all([
            system.initialize(),
            system.initialize(),
            system.initialize()
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(setIntervalMock).toHaveBeenCalledTimes(1);
        expect(system.isInitialized).toBe(true);
        system.destroy();
        expect(clearIntervalMock).toHaveBeenCalledWith(23);
        expect(system.issCheckInterval).toBeNull();
    });

    test('NASA teardown prevents an in-flight initialization from reactivating', async () => {
        let finishRequest;
        const fetchMock = jest.fn(() => new Promise(resolve => {
            finishRequest = resolve;
        }));
        const setIntervalMock = jest.fn(() => 23);
        const { System } = loadSystem(
            'systems/NASAContentSystem.js',
            'NASAContentSystem',
            'nasaContentSystem',
            { fetch: fetchMock, setInterval: setIntervalMock }
        );
        const system = new System();

        const initialization = system.initialize();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        system.destroy();
        finishRequest(successfulResponse({ media_type: 'image' }));
        await initialization;

        expect(setIntervalMock).not.toHaveBeenCalled();
        expect(system.isInitialized).toBe(false);
    });

    test('space-weather initialization and refresh requests are coalesced', async () => {
        const fetchMock = jest.fn(async () => successfulResponse([]));
        const setIntervalMock = jest.fn(() => 77);
        const clearIntervalMock = jest.fn();
        const { System } = loadSystem(
            'systems/SpaceWeatherSystem.js',
            'SpaceWeatherSystem',
            'spaceWeatherSystem',
            {
                fetch: fetchMock,
                setInterval: setIntervalMock,
                clearInterval: clearIntervalMock
            }
        );
        const system = new System();

        await Promise.all([
            system.initialize(),
            system.initialize(),
            system.initialize()
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(setIntervalMock).toHaveBeenCalledTimes(1);

        system.cache.data = null;
        await Promise.all([system.refresh(), system.refresh(), system.refresh()]);
        expect(fetchMock).toHaveBeenCalledTimes(4);

        system.destroy();
        expect(clearIntervalMock).toHaveBeenCalledWith(77);
        expect(system.refreshInterval).toBeNull();
    });

    test('space-weather teardown ignores late network completion', async () => {
        const pendingRequests = [];
        const fetchMock = jest.fn(() => new Promise(resolve => {
            pendingRequests.push(resolve);
        }));
        const setIntervalMock = jest.fn(() => 77);
        const { System } = loadSystem(
            'systems/SpaceWeatherSystem.js',
            'SpaceWeatherSystem',
            'spaceWeatherSystem',
            { fetch: fetchMock, setInterval: setIntervalMock }
        );
        const system = new System();
        const weatherUpdated = jest.fn();
        system.on('weatherUpdated', weatherUpdated);

        const initialization = system.initialize();
        expect(pendingRequests).toHaveLength(2);
        system.destroy();
        pendingRequests.forEach(resolve => resolve(successfulResponse([])));
        await initialization;

        expect(setIntervalMock).not.toHaveBeenCalled();
        expect(weatherUpdated).not.toHaveBeenCalled();
        expect(system.isInitialized).toBe(false);
    });
});

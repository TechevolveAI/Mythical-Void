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
        setTimeout: runtime.setTimeout || setTimeout,
        clearTimeout: runtime.clearTimeout || clearTimeout,
        AbortController
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
    test('NASA initialization stays network-quiet and shares one tracking interval', async () => {
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

        expect(fetchMock).not.toHaveBeenCalled();
        expect(setIntervalMock).toHaveBeenCalledTimes(1);
        expect(system.isInitialized).toBe(true);
        system.destroy();
        expect(clearIntervalMock).toHaveBeenCalledWith(23);
        expect(system.issCheckInterval).toBeNull();
    });

    test('NASA daily content remains an explicit on-demand request', async () => {
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

        await system.initialize();
        expect(fetchMock).not.toHaveBeenCalled();

        const dailyContent = system.getDailyContentQueue();
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        finishRequest(successfulResponse({ media_type: 'image' }));
        await dailyContent;

        expect(setIntervalMock).toHaveBeenCalledTimes(1);
        system.destroy();
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
        expect(fetchMock).not.toHaveBeenCalled();
        expect(setIntervalMock).not.toHaveBeenCalled();

        system.cache.data = null;
        await Promise.all([system.refresh(), system.refresh(), system.refresh()]);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        system.destroy();
        expect(clearIntervalMock).not.toHaveBeenCalled();
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

        await system.initialize();
        const refresh = system.refresh();
        await Promise.resolve();
        await Promise.resolve();
        expect(pendingRequests).toHaveLength(2);
        system.destroy();
        pendingRequests.forEach(resolve => resolve(successfulResponse([])));
        await refresh;

        expect(setIntervalMock).not.toHaveBeenCalled();
        expect(weatherUpdated).not.toHaveBeenCalled();
        expect(system.isInitialized).toBe(false);
    });

    test.each([
        ['NASAContentSystem', 'nasaContentSystem', 'systems/NASAContentSystem.js'],
        ['SpaceWeatherSystem', 'spaceWeatherSystem', 'systems/SpaceWeatherSystem.js']
    ])('%s aborts a stalled external request at its deadline', async (
        className,
        singletonName,
        relativePath
    ) => {
        const clearTimeoutMock = jest.fn();
        const setTimeoutMock = jest.fn(callback => {
            callback();
            return 91;
        });
        const fetchMock = jest.fn(() => new Promise(() => {}));
        const { System } = loadSystem(relativePath, className, singletonName, {
            fetch: fetchMock,
            setTimeout: setTimeoutMock,
            clearTimeout: clearTimeoutMock
        });
        const system = new System();

        await expect(system.fetchWithTimeout('https://example.test/data'))
            .rejects.toMatchObject({ name: 'TimeoutError' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
        expect(clearTimeoutMock).toHaveBeenCalledWith(91);
    });
});

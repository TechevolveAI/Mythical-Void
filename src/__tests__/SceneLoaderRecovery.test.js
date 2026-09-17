const fs = require('fs');
const path = require('path');

function createLoader() {
    const source = fs.readFileSync(path.join(__dirname, '../utils/SceneLoader.js'), 'utf8')
        .replace(/^import .*;$/gm, '')
        .replace(/^export .*;$/gm, '');
    return new Function('devLog', 'devWarn', 'requestIdleCallback', `${source}\nreturn new SceneLoaderClass();`)(
        jest.fn(), jest.fn(), callback => callback()
    );
}

describe('optional scene downloads and explicit entry', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); delete window.UXEnhancements; });

    test('a refused Forest warmup resolves without an unhandled rejection or hover retry storm', async () => {
        const loader = createLoader();
        const download = jest.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
        loader.sceneImports.MythicalForestLevel = download;
        await expect(loader.preloadLevel('mythical_forest')).resolves.toBeNull();
        for (let i = 0; i < 5; i++) await expect(loader.preloadLevel('mythical_forest')).resolves.toBeNull();
        expect(download).toHaveBeenCalledTimes(1);
        expect(loader.getStats()).toMatchObject({ loadedCount: 0, pendingCount: 0 });
        jest.advanceTimersByTime(15001);
        await loader.preloadLevel('mythical_forest');
        expect(download).toHaveBeenCalledTimes(2);
    });

    test('clicking Enter can recover immediately even during background retry backoff', async () => {
        const loader = createLoader();
        const sceneClass = class {};
        loader.sceneImports.MythicalForestLevel = jest.fn()
            .mockRejectedValueOnce(new Error('server unavailable'))
            .mockResolvedValueOnce({ default: sceneClass });
        await loader.preloadLevel('mythical_forest');
        const game = { scene: { keys: {}, add: jest.fn(), start: jest.fn() } };
        await expect(loader.loadAndStart(game, 'MythicalForestLevel')).resolves.toBe(true);
        expect(game.scene.add).toHaveBeenCalledWith('MythicalForestLevel', sceneClass, false);
        expect(game.scene.start).toHaveBeenCalledWith('MythicalForestLevel', {});
    });

    test('required entry still reports failure and releases loading UI without starting a missing scene', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const loader = createLoader();
        loader.sceneImports.MythicalForestLevel = jest.fn().mockRejectedValue(new Error('offline'));
        const game = { scene: { keys: {}, add: jest.fn(), start: jest.fn() } };
        window.UXEnhancements = { showLoading: jest.fn(), hideLoading: jest.fn() };
        await expect(loader.loadAndStart(game, 'MythicalForestLevel')).resolves.toBe(false);
        expect(window.UXEnhancements.hideLoading).toHaveBeenCalledTimes(1);
        expect(game.scene.add).not.toHaveBeenCalled();
        expect(game.scene.start).not.toHaveBeenCalled();
        await expect(loader.preload('MythicalForestLevel')).rejects.toThrow('offline');
    });

    test('concurrent requests coalesce and failed imports leave no permanently pending task', async () => {
        const loader = createLoader();
        const download = jest.fn(() => new Promise(() => {}));
        loader.sceneImports.MythicalForestLevel = download;
        const first = loader.preloadLevel('mythical_forest');
        const second = loader.preloadLevel('mythical_forest');
        await jest.advanceTimersByTimeAsync(15001);
        await expect(first).resolves.toBeNull();
        await expect(second).resolves.toBeNull();
        expect(download).toHaveBeenCalledTimes(1);
        expect(loader.getStats()).toMatchObject({ loadedCount: 0, pendingCount: 0 });
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['HatchingScene', 'PersonalityScene', 'NamingScene', 'SoulRevealScene', 'GameScene', 'HubWorldScene'])(
        '%s background hints tolerate unavailable downloads', async current => {
            const loader = createLoader();
            for (const sceneName of Object.keys(loader.sceneImports)) {
                loader.sceneImports[sceneName] = jest.fn().mockRejectedValue(new Error('offline'));
            }
            loader.preloadAnticipated(current);
            await jest.advanceTimersByTimeAsync(0);
            expect(loader.getStats()).toMatchObject({ loadedCount: 0, pendingCount: 0 });
        }
    );
});

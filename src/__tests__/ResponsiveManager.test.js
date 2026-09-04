const ResponsiveManager = require('../systems/ResponsiveManager.js');

function createGame() {
    return {
        canvas: { style: {} },
        scale: {
            resize: jest.fn()
        },
        events: {
            emit: jest.fn()
        }
    };
}

describe('ResponsiveManager', () => {
    test('preserves the full portrait viewport instead of forcing a 4:3 canvas', () => {
        const manager = new ResponsiveManager();
        const game = createGame();
        Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
        manager.game = game;

        manager.handleResize();

        expect(game.scale.resize).toHaveBeenCalledWith(390, 844);
        expect(manager.isMobile).toBe(true);
        expect(game.events.emit).toHaveBeenCalledWith('resize', expect.objectContaining({
            width: 390,
            height: 844,
            windowWidth: 390,
            windowHeight: 844
        }));
    });

    test('does not mutate scene text sizes during resize', () => {
        const manager = new ResponsiveManager();
        const text = { type: 'Text', setFontSize: jest.fn() };
        const game = createGame();
        game.scene = { scenes: [{ children: { list: [text] } }] };
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
        manager.game = game;

        manager.handleResize();

        expect(game.scale.resize).toHaveBeenCalledWith(1280, 720);
        expect(text.setFontSize).not.toHaveBeenCalled();
    });

    test('does not resize WebGL while the mobile keyboard changes the visual viewport', () => {
        const manager = new ResponsiveManager();
        const game = createGame();
        manager.game = game;
        manager.lastGameSize = { width: 390, height: 844 };
        window.mobileViewportController = {
            update: () => ({
                layoutWidth: 390,
                layoutHeight: 844,
                visualWidth: 390,
                visualHeight: 470,
                keyboardOpen: true,
                bottomOcclusion: 374
            })
        };

        manager.handleResize();

        expect(game.scale.resize).not.toHaveBeenCalled();
        expect(game.events.emit).toHaveBeenCalledWith(
            'resize',
            expect.objectContaining({
                width: 390,
                height: 844,
                viewportState: expect.objectContaining({ keyboardOpen: true })
            })
        );
        delete window.mobileViewportController;
    });

    test('does not synthesize mouse events from native touch input', () => {
        const manager = new ResponsiveManager();
        manager.addTouchStyles = jest.fn(() => false);
        manager.addManagedEvent = jest.fn();

        manager.setupTouchSupport();

        expect(manager.addManagedEvent).not.toHaveBeenCalled();
        expect(ResponsiveManager.prototype.setupTouchToMouse).toBeUndefined();
        expect(ResponsiveManager.prototype.preventDefaults).toBeUndefined();
    });

    test('does not resize Phaser while destroying responsive support', () => {
        const manager = new ResponsiveManager();
        const game = createGame();
        manager.game = game;
        manager.isMobile = false;

        manager.destroy();

        expect(game.scale.resize).not.toHaveBeenCalled();
        expect(manager.game).toBeNull();
        expect(manager.isDestroyed).toBe(true);
    });

    test('cancels a pending resize when destroyed', () => {
        jest.useFakeTimers();
        const manager = new ResponsiveManager();
        const game = createGame();
        manager.game = game;
        manager.resizeHandler = manager.debounce(() => manager.handleResize(), 100);
        manager.registerCleanup(() => manager.resizeHandler.cancel());

        manager.resizeHandler();
        manager.destroy();
        jest.advanceTimersByTime(150);

        expect(game.scale.resize).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('ignores stale resize callbacks after destruction', () => {
        const manager = new ResponsiveManager();
        const game = createGame();
        manager.game = game;
        manager.isDestroyed = true;

        expect(() => manager.handleResize()).not.toThrow();
        expect(game.scale.resize).not.toHaveBeenCalled();
    });
});

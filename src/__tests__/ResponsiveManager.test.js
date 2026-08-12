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

    test('does not synthesize mouse events from native touch input', () => {
        const manager = new ResponsiveManager();
        manager.addTouchStyles = jest.fn(() => false);
        manager.addManagedEvent = jest.fn();

        manager.setupTouchSupport();

        expect(manager.addManagedEvent).not.toHaveBeenCalled();
        expect(ResponsiveManager.prototype.setupTouchToMouse).toBeUndefined();
        expect(ResponsiveManager.prototype.preventDefaults).toBeUndefined();
    });
});

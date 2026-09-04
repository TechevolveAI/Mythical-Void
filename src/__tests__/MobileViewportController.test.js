const MobileViewportController = require('../systems/MobileViewportController.js');

function createWindow({
    width = 390,
    height = 844,
    visualWidth = width,
    visualHeight = height,
    offsetTop = 0,
    maxTouchPoints = 5
} = {}) {
    const listeners = new Map();
    const visualListeners = new Map();
    return {
        innerWidth: width,
        innerHeight: height,
        navigator: { maxTouchPoints, userAgent: 'CriOS iPhone' },
        matchMedia: () => ({ matches: true }),
        addEventListener: (type, handler) => listeners.set(type, handler),
        removeEventListener: (type) => listeners.delete(type),
        dispatchEvent: jest.fn(),
        visualViewport: {
            width: visualWidth,
            height: visualHeight,
            offsetLeft: 0,
            offsetTop,
            addEventListener: (type, handler) => visualListeners.set(type, handler),
            removeEventListener: (type) => visualListeners.delete(type)
        }
    };
}

function createDocument() {
    return {
        documentElement: {
            clientWidth: 390,
            clientHeight: 844,
            dataset: {},
            style: { setProperty: jest.fn() }
        }
    };
}

describe('MobileViewportController', () => {
    test('keeps stable layout dimensions while reporting browser chrome', () => {
        const controller = new MobileViewportController({
            windowRef: createWindow({ visualHeight: 780 }),
            documentRef: createDocument()
        });
        const snapshot = controller.read();

        expect(snapshot.layoutHeight).toBe(844);
        expect(snapshot.visualHeight).toBe(780);
        expect(snapshot.bottomOcclusion).toBe(64);
        expect(snapshot.keyboardOpen).toBe(false);
    });

    test('recognizes an on-screen keyboard without shrinking game dimensions', () => {
        const controller = new MobileViewportController({
            windowRef: createWindow({ visualHeight: 470 }),
            documentRef: createDocument()
        });
        const snapshot = controller.read();

        expect(snapshot.keyboardOpen).toBe(true);
        expect(snapshot.layoutWidth).toBe(390);
        expect(snapshot.layoutHeight).toBe(844);
    });
});

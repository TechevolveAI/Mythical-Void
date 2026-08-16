const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCanvasTapBridge() {
    const filePath = path.join(__dirname, '../utils/CanvasTapBridge.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export function createCanvasTapBridge',
            'function createCanvasTapBridge'
        )
        .concat('\nmodule.exports = { createCanvasTapBridge };\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        performance: { now: () => 0 },
        Number,
        Array
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports.createCanvasTapBridge;
}

describe('CanvasTapBridge', () => {
    const createCanvasTapBridge = loadCanvasTapBridge();

    test('maps an iOS-style touch release into game space exactly once', () => {
        const canvas = document.createElement('canvas');
        canvas.getBoundingClientRect = () => ({
            left: 10,
            top: 20,
            width: 390,
            height: 844
        });
        let timestamp = 1000;
        const onActivate = jest.fn();
        const bridge = createCanvasTapBridge({
            canvas,
            getGameSize: () => ({ width: 390, height: 844 }),
            getBounds: () => ({ x: 250, y: 600, width: 130, height: 60 }),
            onActivate,
            now: () => timestamp
        });

        const touchEvent = new Event('touchend', {
            bubbles: true,
            cancelable: true
        });
        Object.defineProperty(touchEvent, 'changedTouches', {
            value: [{ clientX: 330, clientY: 650 }]
        });
        canvas.dispatchEvent(touchEvent);
        bridge.activateGamePoint(320, 630);

        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(touchEvent.defaultPrevented).toBe(true);

        timestamp += 350;
        bridge.activateGamePoint(320, 630);
        expect(onActivate).toHaveBeenCalledTimes(2);
        bridge.destroy();
    });

    test('ignores releases outside the target and removes native listeners', () => {
        const canvas = document.createElement('canvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 200,
            height: 400
        });
        const onActivate = jest.fn();
        const bridge = createCanvasTapBridge({
            canvas,
            getGameSize: () => ({ width: 400, height: 800 }),
            getBounds: () => ({ x: 250, y: 600, width: 130, height: 60 }),
            onActivate,
            now: () => 1000
        });

        const outsideEvent = new Event('pointerup', {
            bubbles: true,
            cancelable: true
        });
        Object.defineProperties(outsideEvent, {
            clientX: { value: 40 },
            clientY: { value: 40 }
        });
        canvas.dispatchEvent(outsideEvent);
        expect(onActivate).not.toHaveBeenCalled();

        bridge.destroy();
        const removedListenerEvent = new Event('pointerup', {
            bubbles: true,
            cancelable: true
        });
        Object.defineProperties(removedListenerEvent, {
            clientX: { value: 160 },
            clientY: { value: 315 }
        });
        canvas.dispatchEvent(removedListenerEvent);
        expect(onActivate).not.toHaveBeenCalled();
    });
});

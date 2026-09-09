const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadOverlay(sceneWindow, createCanvasTapBridge) {
    const filePath = path.join(__dirname, '../ui/ControlsTutorialOverlay.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            "import { devLog } from '../utils/devLogger.js';",
            'const devLog = () => {};'
        )
        .replace(
            "import { createCanvasTapBridge } from '../utils/CanvasTapBridge.js';",
            'const createCanvasTapBridge = bridgeFactory;'
        )
        .replace(
            'export default class ControlsTutorialOverlay',
            'class ControlsTutorialOverlay'
        )
        .concat('\nmodule.exports = ControlsTutorialOverlay;\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: sceneWindow,
        document,
        console,
        performance,
        bridgeFactory: createCanvasTapBridge,
        Phaser: {
            Geom: {
                Rectangle: Object.assign(class Rectangle {}, {
                    Contains: () => true
                })
            }
        }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createDisplayObject(overrides = {}) {
    return {
        active: true,
        alpha: 1,
        fillStyle() { return this; },
        fillRect() { return this; },
        fillCircle() { return this; },
        lineStyle() { return this; },
        lineBetween() { return this; },
        setOrigin() { return this; },
        setDepth() { return this; },
        setScrollFactor() { return this; },
        setInteractive() { return this; },
        setBackgroundColor() { return this; },
        setAlpha(value) { this.alpha = value; return this; },
        setData() { return this; },
        on() { return this; },
        removeAllListeners: jest.fn(),
        destroy: jest.fn(function destroy() { this.active = false; }),
        getBounds: () => ({ x: 85, y: 754, width: 220, height: 54 }),
        ...overrides
    };
}

describe('ControlsTutorialOverlay', () => {
    test('native fieldwork action releases play even when progress recording throws', () => {
        const domContainer = document.createElement('div');
        domContainer.style.pointerEvents = 'none';
        document.body.appendChild(domContainer);
        const resume = jest.fn();
        const bridgeDestroy = jest.fn();
        const sceneWindow = {
            GameState: {
                get: jest.fn(() => false),
                set: jest.fn(() => { throw new Error('storage unavailable'); }),
                recordOpeningMilestone: jest.fn(),
                save: jest.fn()
            }
        };
        const ControlsTutorialOverlay = loadOverlay(
            sceneWindow,
            jest.fn(() => ({ destroy: bridgeDestroy }))
        );
        const scene = {
            scale: { width: 390, height: 844 },
            mobileControls: {
                suspend: jest.fn(() => true),
                resume
            },
            game: {
                canvas: document.createElement('canvas'),
                domContainer
            },
            add: {
                graphics: jest.fn(() => createDisplayObject()),
                text: jest.fn(() => createDisplayObject()),
                dom: jest.fn((x, y, node) => {
                    domContainer.appendChild(node);
                    return createDisplayObject({
                        destroy: jest.fn(() => node.remove())
                    });
                })
            },
            input: {
                keyboard: {
                    once: jest.fn(),
                    off: jest.fn()
                }
            }
        };
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const overlay = new ControlsTutorialOverlay(scene);

        overlay.show();
        const action = domContainer.querySelector(
            '[data-testid="field-controls-continue"]'
        );
        expect(action).not.toBeNull();
        expect(domContainer.style.pointerEvents).toBe('auto');

        action.dispatchEvent(new Event('pointerdown', {
            bubbles: true,
            cancelable: true
        }));

        expect(overlay.isVisible).toBe(false);
        expect(domContainer.querySelector('[data-testid="field-controls-continue"]')).toBeNull();
        expect(domContainer.style.pointerEvents).toBe('none');
        expect(bridgeDestroy).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            '[ControlsTutorialOverlay] Progress record failed:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
        domContainer.remove();
    });
});

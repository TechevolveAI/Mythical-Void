const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMobileControls() {
    const filePath = path.join(__dirname, '../systems/MobileControls.js');
    const source = fs.readFileSync(filePath, 'utf8');

    const transformed = source
        .replace(/import[\s\S]*?;[\r\n]*/g, '')
        .replace(/export default class MobileControls/g, 'class MobileControls')
        .replace(/export default /g, '')
        .concat('\nmodule.exports = MobileControls;');

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        devLog: jest.fn(),
        window: {
            matchMedia: jest.fn(() => ({ matches: false })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            setTimeout: () => 0,
            clearTimeout: () => {},
            FeedbackManager: {}
        },
        document: {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            documentElement: {},
            hidden: false
        },
        navigator: {
            maxTouchPoints: 5,
            userAgent: 'Mobile Safari/604.1'
        },
        documentElement: {},
        Number,
        Math,
        JSON,
        Array,
        Object,
        String,
        Boolean,
        Promise,
        setTimeout: () => 0,
        clearTimeout: () => {},
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {}
    };

    sandbox.performance = { now: () => 0 };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('MobileControls pointer ownership', () => {
    function createScene(overrides = {}) {
        const events = [];

        const scene = {
            scale: { width: 390, height: 844, on: jest.fn(), off: jest.fn() },
            game: {
                canvas: {
                    getBoundingClientRect: () => ({
                        left: 0,
                        top: 0,
                        width: 390,
                        height: 844
                    }),
                    addEventListener: jest.fn((type, handler) => {
                        events.push({ type, handler });
                    }),
                    removeEventListener: jest.fn()
                },
                events: { emit: jest.fn() }
            },
            events: { emit: jest.fn() },
            add: { graphics: jest.fn() },
            tweens: { add: jest.fn() },
            input: {
                on: jest.fn((type, handler) => {
                    events.push({ type: `input_${type}`, handler });
                }),
                off: jest.fn(),
                emit: jest.fn()
            },
            ...overrides
        };

        return { scene, events };
    }

    function attachControlFixtures(controls) {
        controls.joystickBase = {
            clear: jest.fn(),
            fillStyle: jest.fn(),
            fillCircle: jest.fn(),
            lineStyle: jest.fn(),
            strokeCircle: jest.fn()
        };
        controls.joystickThumb = {
            clear: jest.fn(),
            fillStyle: jest.fn(),
            fillCircle: jest.fn(),
            lineStyle: jest.fn(),
            strokeCircle: jest.fn()
        };
        controls.joystickGlow = { setAlpha: jest.fn() };
        controls.joystickCenterX = 90;
        controls.joystickCenterY = 760;
        controls.joystickMaxDistance = 35;
        controls.joystickHitBounds = {
            left: 0,
            right: 390,
            top: 700,
            bottom: 844
        };
        controls.getCanvasGamePoint = jest.fn(() => ({ x: 40, y: 760 }));
        controls.isJoystickHit = jest.fn(() => true);
        controls.updateJoystickFromPointer = jest.fn();
        controls.scene.tweens = {
            add: jest.fn()
        };
        controls.scene.game.events.emit = jest.fn();
    }

    test('does not activate joystick from pointermove without pointerdown', () => {
        const MobileControls = loadMobileControls();
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        controls.isMobile = true;
        controls.scene = scene;

        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        const move = events.find(evt => evt.type === 'pointermove');
        expect(move).toBeDefined();

        move.handler({
            pointerId: 7,
            clientX: 40,
            clientY: 760,
            preventDefault: jest.fn()
        });

        expect(controls.joystickActive).toBe(false);
        expect(controls.activePointerId).toBeNull();
    });

    test('only resets joystick when the active pointer ends', () => {
        const MobileControls = loadMobileControls();
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        controls.isMobile = true;
        controls.scene = scene;

        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        controls.activePointerId = 9;
        controls.joystickActive = true;

        const touchEnd = events.find(evt => evt.type === 'touchend');
        expect(touchEnd).toBeDefined();

        const finishSpy = jest.spyOn(controls, 'finishJoystickInput');

        touchEnd.handler({
            changedTouches: [{ identifier: 3 }],
            touches: [],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(finishSpy).not.toHaveBeenCalled();

        touchEnd.handler({
            changedTouches: [{ identifier: 9 }],
            touches: [],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(finishSpy).toHaveBeenCalledWith(9);
    });

    test('normalizes mixed pointer ids and ignores non-active fallback events', () => {
        const MobileControls = loadMobileControls();
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        controls.isMobile = true;
        controls.scene = scene;

        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        controls.activePointerId = 12;
        controls.joystickActive = true;
        const finishSpy = jest.spyOn(controls, 'finishJoystickInput');
        const resetSpy = jest.spyOn(controls, 'resetJoystick');

        const touchEnd = events.find(evt => evt.type === 'touchend');
        expect(touchEnd).toBeDefined();

        touchEnd.handler({
            changedTouches: [{ identifier: '12' }],
            touches: [],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(finishSpy).toHaveBeenCalledWith(12);
        expect(finishSpy).toHaveBeenCalledTimes(1);
        const resetCallsAfterFirstEnd = resetSpy.mock.calls.length;

        controls.joystickActive = false;
        controls.activePointerId = 12;
        touchEnd.handler({
            changedTouches: [{ identifier: '13' }],
            touches: [],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(finishSpy).toHaveBeenCalledTimes(1);
        expect(resetSpy).toHaveBeenCalledTimes(resetCallsAfterFirstEnd);
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMobileControls(environment = {}) {
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
    Object.assign(sandbox.window, environment.window || {});
    Object.assign(sandbox.navigator, environment.navigator || {});
    Object.assign(sandbox.document, environment.document || {});
    Object.assign(
        sandbox.document.documentElement,
        environment.documentElement || {}
    );

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

    test('desktop Chromium API support does not create a touch dock', () => {
        const MobileControls = loadMobileControls({
            window: {
                TouchEvent: function TouchEvent() {},
                matchMedia: jest.fn(() => ({ matches: false }))
            },
            navigator: {
                maxTouchPoints: 0,
                userAgent: 'Mozilla/5.0 Chrome/126.0 Safari/537.36'
            }
        });

        const { scene } = createScene({
            scale: { width: 1440, height: 900, on: jest.fn(), off: jest.fn() }
        });
        const controls = new MobileControls(scene);

        expect(controls.isMobile).toBe(false);
    });

    test('desktop emulation touch event properties do not create a touch dock', () => {
        const MobileControls = loadMobileControls({
            window: {
                ontouchstart: null,
                TouchEvent: function TouchEvent() {},
                innerWidth: 1440,
                innerHeight: 900,
                matchMedia: jest.fn(() => ({ matches: false }))
            },
            documentElement: { ontouchstart: null },
            navigator: {
                maxTouchPoints: 0,
                userAgent: 'Mozilla/5.0 Chrome/126.0 Safari/537.36'
            }
        });

        const { scene } = createScene({
            scale: { width: 1440, height: 900, on: jest.fn(), off: jest.fn() }
        });

        expect(new MobileControls(scene).isMobile).toBe(false);
    });

    test('a stray desktop touch event does not force the fallback dock', () => {
        const addEventListener = jest.fn();
        const MobileControls = loadMobileControls({
            document: { addEventListener },
            navigator: {
                maxTouchPoints: 0,
                userAgent: 'Mozilla/5.0 Chrome/126.0 Safari/537.36'
            }
        });
        const { scene } = createScene({
            forceMobileControls: false,
            scale: { width: 1440, height: 900, on: jest.fn(), off: jest.fn() }
        });
        const controls = new MobileControls(scene);
        const show = jest.spyOn(controls, 'show');
        jest.spyOn(controls, 'detectMobile').mockReturnValue(false);

        controls.setupFallbackTouchListener();
        const touchHandler = addEventListener.mock.calls.find(
            call => call[0] === 'touchstart'
        )?.[1];
        touchHandler?.({});

        expect(show).not.toHaveBeenCalled();
        expect(controls.isVisible).toBe(false);
    });

    test('touch hardware still creates the dock on phones and tablets', () => {
        const MobileControls = loadMobileControls({
            navigator: {
                maxTouchPoints: 5,
                userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'
            }
        });

        const { scene } = createScene();
        expect(new MobileControls(scene).isMobile).toBe(true);
    });

    test('a visible compact touch dock survives a resize when detection changes', () => {
        const MobileControls = loadMobileControls();
        const { scene } = createScene({ forceMobileControls: false });
        const controls = new MobileControls(scene);
        controls.isVisible = true;
        jest.spyOn(controls, 'detectMobile').mockReturnValue(false);
        const hide = jest.spyOn(controls, 'hide').mockImplementation(() => {});
        const show = jest.spyOn(controls, 'show').mockImplementation(() => {});

        controls.handleResize();

        expect(hide).toHaveBeenCalledTimes(1);
        expect(show).toHaveBeenCalledWith(true);
    });

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

    test('uses native touch events when a browser does not synthesize pointer events', () => {
        const MobileControls = loadMobileControls();
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        controls.isMobile = true;
        controls.scene = scene;

        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        const touchStart = events.find(evt => evt.type === 'touchstart');
        const touchMove = events.find(evt => evt.type === 'touchmove');
        expect(touchStart).toBeDefined();
        expect(touchMove).toBeDefined();

        const startEvent = {
            changedTouches: [{ identifier: 0, clientX: 40, clientY: 760 }],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        };
        touchStart.handler(startEvent);

        expect(controls.joystickActive).toBe(true);
        expect(controls.activePointerId).toBe(0);
        expect(startEvent.preventDefault).toHaveBeenCalled();

        const moveEvent = {
            touches: [{ identifier: 0, clientX: 70, clientY: 760 }],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        };
        touchMove.handler(moveEvent);

        expect(controls.updateJoystickFromPointer).toHaveBeenCalledTimes(2);
        expect(moveEvent.preventDefault).toHaveBeenCalled();
    });

    test('uses only native touch ownership for iOS joystick drags', () => {
        const MobileControls = loadMobileControls({
            navigator: {
                maxTouchPoints: 5,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/140.0 Mobile'
            }
        });
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        const pointerDown = events.find(evt => evt.type === 'pointerdown');
        const touchStart = events.find(evt => evt.type === 'touchstart');
        const pointerUp = events.find(evt => evt.type === 'pointerup');

        pointerDown.handler({
            pointerId: 1,
            pointerType: 'touch',
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(controls.joystickActive).toBe(false);

        touchStart.handler({
            changedTouches: [{ identifier: 1, clientX: 40, clientY: 780 }],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(controls.joystickActive).toBe(true);
        expect(controls.joystickInputSource).toBe('touch');

        pointerUp.handler({
            pointerId: 1,
            pointerType: 'touch',
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });
        expect(controls.joystickActive).toBe(true);
    });

    test('keeps pointer ownership for Android touch input', () => {
        const MobileControls = loadMobileControls({
            navigator: {
                maxTouchPoints: 5,
                userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B) Chrome/140 Mobile'
            }
        });
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();

        events.find(evt => evt.type === 'pointerdown').handler({
            pointerId: 7,
            pointerType: 'touch',
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });

        expect(controls.joystickActive).toBe(true);
        expect(controls.activePointerId).toBe(7);
        expect(controls.joystickInputSource).toBe('pointer');
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

    test('accepts touch identifier zero and preserves a short directional flick', () => {
        const MobileControls = loadMobileControls();
        const { scene, events } = createScene();
        const controls = new MobileControls(scene);
        controls.isMobile = true;
        controls.scene = scene;

        attachControlFixtures(controls);
        controls.setupCanvasJoystickInput();
        controls.activePointerId = 0;
        controls.joystickActive = true;
        controls.joystickActivatedAt = 0;
        controls.lastJoystickMagnitude = 1;

        const touchEnd = events.find(evt => evt.type === 'touchend');
        const resetSpy = jest.spyOn(controls, 'resetJoystick');
        touchEnd.handler({
            changedTouches: [{ identifier: 0 }],
            preventDefault: jest.fn(),
            stopImmediatePropagation: jest.fn()
        });

        expect(controls.joystickActive).toBe(false);
        expect(controls.pendingJoystickReset).toBe(0);
        expect(resetSpy).not.toHaveBeenCalled();
        expect(controls.finishJoystickInput(0)).toBe(false);
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');

const INPUTS = ['touch', 'pointer'];

function dispatch(target, type, properties = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    target.dispatchEvent(event);
    return event;
}

// Only rendering and Phaser delivery are stubbed; control handlers, timers,
// DOM propagation, coordinate conversion, and layout calculations run normally.
function displayObject(x = 0, y = 0, width = 0, height = 0) {
    const object = new EventEmitter();
    Object.assign(object, { x, y, width, height, visible: true });
    for (const method of [
        'setOrigin', 'setScrollFactor', 'setDepth', 'setAlpha', 'setData',
        'clear', 'fillStyle', 'fillCircle', 'lineStyle', 'strokeCircle',
        'fillTriangle', 'fillRect', 'fillRoundedRect', 'strokeRoundedRect',
        'beginPath', 'moveTo', 'lineTo', 'strokePath', 'lineBetween', 'arc'
    ]) {
        object[method] = jest.fn(() => object);
    }
    object.setPosition = (nextX, nextY) => {
        Object.assign(object, { x: nextX, y: nextY });
        return object;
    };
    object.setVisible = visible => {
        object.visible = visible;
        return object;
    };
    object.setInteractive = () => {
        object.input = { enabled: true };
        return object;
    };
    object.destroy = jest.fn(() => object.removeAllListeners());
    return object;
}

function createHarness(inputSource = 'touch') {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const captures = new Set();
    canvas.setPointerCapture = jest.fn(id => captures.add(id));
    canvas.hasPointerCapture = id => captures.has(id);
    canvas.releasePointerCapture = jest.fn(id => {
        captures.delete(id);
        dispatch(canvas, 'lostpointercapture', { pointerId: id });
    });
    let rect = { left: 23, top: 17, width: 195, height: 422 };
    canvas.getBoundingClientRect = () => rect;
    const insets = { '--sat': '47px', '--sar': '0px', '--sab': '34px', '--sal': '0px' };
    let viewport = {};
    const sandbox = {
        module: { exports: {} },
        console: { log: jest.fn(), warn: jest.fn() },
        devLog: jest.fn(),
        document,
        navigator: {
            maxTouchPoints: 5,
            userAgent: inputSource === 'touch'
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari/604.1'
                : 'Mozilla/5.0 (Linux; Android 13) Chrome/140 Mobile'
        },
        window: {
            innerWidth: 390,
            innerHeight: 844,
            matchMedia: () => ({ matches: true }),
            addEventListener: window.addEventListener.bind(window),
            removeEventListener: window.removeEventListener.bind(window),
            setTimeout: window.setTimeout.bind(window),
            clearTimeout: window.clearTimeout.bind(window),
            mobileViewportController: { getSnapshot: () => viewport },
            AudioManager: { playButtonClick: jest.fn() },
            FeedbackManager: { vibrate: jest.fn() }
        },
        getComputedStyle: () => ({ getPropertyValue: name => insets[name] || '0px' }),
        performance,
        Promise
    };
    const layoutPath = path.join(__dirname, '../systems/MobileControlLayout.js');
    const layoutSource = fs.readFileSync(layoutPath, 'utf8')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { getMobileControlLayout, getJoystickVector, getSafeAreaInsets };');
    vm.runInNewContext(layoutSource, sandbox, { filename: layoutPath });
    const layout = sandbox.module.exports;
    Object.assign(sandbox, layout, { module: { exports: {} } });
    const controlsPath = path.join(__dirname, '../systems/MobileControls.js');
    const controlsSource = fs.readFileSync(controlsPath, 'utf8')
        .replace(/import[\s\S]*?;[\r\n]*/g, '')
        .replace('export default MobileControls;', 'module.exports = MobileControls;');
    vm.runInNewContext(controlsSource, sandbox, { filename: controlsPath });

    const vectors = [];
    const scene = {
        scale: Object.assign(new EventEmitter(), { width: 390, height: 844 }),
        game: { canvas, events: new EventEmitter() },
        input: new EventEmitter(),
        add: { graphics: displayObject, zone: displayObject, text: displayObject },
        tweens: { add: jest.fn() },
        fireCombatProjectile: jest.fn(),
        handleSpaceInteraction: jest.fn(),
        openInventory: jest.fn(),
        openChat: jest.fn()
    };
    scene.game.events.on('virtual-joystick', vector => vectors.push(vector));
    const controls = new sandbox.module.exports(scene);
    controls.show();

    const point = (id, x, y) => ({
        identifier: id,
        clientX: rect.left + x * rect.width / scene.scale.width,
        clientY: rect.top + y * rect.height / scene.scale.height
    });
    const send = (phase, id, x, y, otherTouches = []) => {
        const touch = point(id, x, y);
        if (inputSource === 'pointer') {
            return dispatch(canvas, `pointer${phase}`, {
                pointerId: id, pointerType: 'touch',
                clientX: touch.clientX, clientY: touch.clientY
            });
        }
        const type = { down: 'start', up: 'end', move: 'move', cancel: 'cancel' }[phase];
        return dispatch(canvas, `touch${type}`, {
            changedTouches: [touch],
            touches: phase === 'up' || phase === 'cancel'
                ? otherTouches : [...otherTouches, touch]
        });
    };
    const start = (id = 0, dx = 0, dy = 0) => send(
        'down', id, controls.joystickCenterX + dx, controls.joystickCenterY + dy
    );
    const drag = (dx, dy, id = 0) => send(
        'move', id, controls.joystickTouchOrigin.x + dx,
        controls.joystickTouchOrigin.y + dy
    );

    return {
        controls, scene, canvas, captures, vectors, point, send, start, drag, layout, insets,
        vector: () => vectors.at(-1),
        setViewport: value => { viewport = value; },
        resize: (width, height) => {
            Object.assign(scene.scale, { width, height });
            rect = { left: 31, top: 11, width: width * 0.75, height: height * 0.75 };
            scene.scale.emit('resize', { width, height });
        },
        dispose: () => {
            controls.destroy();
            canvas.remove();
        }
    };
}

describe('MobileInputLifecycle behavior', () => {
    let harnesses;
    let hidden;
    const setup = source => {
        const harness = createHarness(source);
        harnesses.push(harness);
        return harness;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        harnesses = [];
        hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    });

    afterEach(() => {
        harnesses.forEach(harness => harness.dispose());
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe.each(INPUTS)('%s ownership', source => {
        test('refreshes and a toolbar resize preserve the owner until a real release', () => {
            const h = setup(source);
            const thumb = h.controls.joystickThumb;
            const originalY = h.controls.joystickCenterY;
            h.start();
            h.drag(0, 35);
            const held = h.vector();
            for (let i = 0; i < 8; i += 1) h.scene.scale.emit('resize');
            h.resize(390, 800);
            jest.advanceTimersByTime(1000);
            h.drag(0, 35);
            expect(h.vector()).toEqual(held);
            expect(h.controls.activePointerId).toBe(0);
            expect(thumb.destroy).not.toHaveBeenCalled();
            h.send('up', 0, 0, 0);
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            expect(thumb.destroy).toHaveBeenCalledTimes(1);
            expect(h.controls.joystickCenterY).toBeLessThan(originalY);
            h.start(1);
            h.drag(-35, 0, 1);
            expect(h.vector().x).toBeLessThan(-0.8);
            h.send('cancel', 1, 0, 0);
            expect(h.vector()).toEqual({ x: 0, y: 0 });
        });

        test.each([
            ['down', 0, 35, 0, 1],
            ['left', -35, 0, -1, 0],
            ['down-left', -35, 35, -1, 1]
        ])('holds %s for two seconds without strobing or losing ownership', (
            direction, dx, dy, signX, signY
        ) => {
            const h = setup(source);
            h.start();
            h.drag(dx, dy);
            const held = h.vector();
            const firstHeldVector = h.vectors.length - 1;
            expect(Math.sign(held.x)).toBe(signX);
            expect(Math.sign(held.y)).toBe(signY);
            expect(Math.hypot(held.x, held.y)).toBeGreaterThan(0.8);
            for (let frame = 0; frame < 20; frame += 1) {
                jest.advanceTimersByTime(100);
                h.drag(dx, dy);
                expect(h.vector()).toEqual(held);
                expect(h.controls.activePointerId).toBe(0);
            }
            expect(h.vectors.slice(firstHeldVector).every(vector => (
                Math.hypot(vector.x, vector.y) > 0.8
            ))).toBe(true);
            h.send('up', 0, 0, 0);
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            expect(h.controls.activePointerId).toBeNull();
            expect(jest.getTimerCount()).toBe(0);
        });

        test('uses the landing point for downward movement from the upper pad', () => {
            const h = setup(source);
            h.start(0, 0, -35);
            h.drag(0, 26);
            expect(h.vector().x).toBeCloseTo(0);
            expect(h.vector().y).toBeGreaterThan(0.5);
            jest.advanceTimersByTime(2000);
            expect(h.vector().y).toBeGreaterThan(0.5);
        });

        test.each([
            ['attack', 'fireCombatProjectile'],
            ['interact', 'handleSpaceInteraction'],
            ['inventory', 'openInventory'],
            ['chat', 'openChat']
        ])('allows a second finger to %s without stealing held down-left input', (id, method) => {
            const h = setup(source);
            h.start();
            h.drag(-30, 30);
            const held = h.vector();
            const button = h.controls.actionButtons[id];
            const owner = h.point(0, h.controls.joystickCenterX - 30, h.controls.joystickCenterY + 30);
            // A downstream Phaser input delivery must still receive this start.
            const deliverAction = jest.fn(() => button.zone.emit('pointerdown', { id: 9 }));
            h.canvas.addEventListener(source === 'touch' ? 'touchstart' : 'pointerdown', deliverAction);
            const event = h.send('down', 9, button.x, button.y, [owner]);
            expect(event.defaultPrevented).toBe(false);
            expect(deliverAction).toHaveBeenCalledTimes(1);
            expect(h.scene[method]).toHaveBeenCalledTimes(1);
            expect(h.controls.activePointerId).toBe(0);
            h.send('move', 9, button.x - 12, button.y + 12, [owner]);
            h.send('cancel', 9, button.x, button.y, [owner]);
            h.send('up', 9, button.x, button.y, [owner]);
            jest.advanceTimersByTime(500);
            expect(h.vector()).toEqual(held);
            expect(h.controls.activePointerId).toBe(0);
            expect(h.scene[method]).toHaveBeenCalledTimes(1);
        });

        test('does not acquire an action finger that drifts into the joystick', () => {
            const h = setup(source);
            const button = h.controls.actionButtons.attack;
            h.send('down', 9, button.x, button.y);
            h.send('move', 9, h.controls.joystickCenterX, h.controls.joystickCenterY + 30);
            expect(h.controls.activePointerId).toBeNull();
            expect(h.vector()).toEqual({ x: 0, y: 0 });
        });

        test('a normal short release preserves its pulse but cannot reset the next finger', () => {
            const h = setup(source);
            h.start(0, -30, 0);
            jest.advanceTimersByTime(20);
            h.send('up', 0, 0, 0);
            expect(h.controls.joystickActive).toBe(false);
            expect(h.vector().x).toBeLessThan(-0.5);
            expect(jest.getTimerCount()).toBe(1);
            jest.advanceTimersByTime(119);
            expect(h.vector().x).toBeLessThan(-0.5);
            jest.advanceTimersByTime(1);
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            h.start(0, -30, 0);
            h.send('up', 0, 0, 0);
            h.start(2);
            h.drag(0, 35, 2);
            jest.advanceTimersByTime(500);
            expect(h.vector().y).toBeGreaterThan(0.8);
            expect(h.controls.activePointerId).toBe(2);
        });

        test.each(['blur', 'pagehide', 'visibilitychange'])('%s stops held input and a pending flick', eventName => {
            const h = setup(source);
            for (const released of [false, true]) {
                h.start(0, -30, 30);
                if (released) h.send('up', 0, 0, 0);
                hidden.mockReturnValue(true);
                dispatch(eventName === 'visibilitychange' ? document : window, eventName);
                expect(h.vector()).toEqual({ x: 0, y: 0 });
                expect(h.controls.activePointerId).toBeNull();
                expect(jest.getTimerCount()).toBe(0);
                const emissions = h.vectors.length;
                h.send('move', 0, 10, 10);
                jest.advanceTimersByTime(500);
                expect(h.vectors).toHaveLength(emissions);
                hidden.mockReturnValue(false);
                dispatch(document, 'visibilitychange');
            }
            h.start(2);
            h.drag(0, 35, 2);
            expect(h.vector().y).toBeGreaterThan(0.8);
        });

        test.each(['hide', 'destroy'])('%s removes listeners and cancels an exit-time flick', method => {
            const h = setup(source);
            h.start(0, -30, 0);
            h.send('up', 0, 0, 0);
            const elements = h.controls.getControlElements();
            h.controls[method]();
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            expect(jest.getTimerCount()).toBe(0);
            expect(h.scene.scale.listenerCount('resize')).toBe(0);
            expect(h.scene.input.listenerCount('pointerup')).toBe(0);
            elements.forEach(element => expect(element.destroy).toHaveBeenCalledTimes(1));
            const emissions = h.vectors.length;
            h.start();
            h.send('move', 0, 10, 10);
            h.send('up', 0, 10, 10);
            h.send('cancel', 0, 10, 10);
            dispatch(window, 'blur');
            dispatch(window, 'pagehide');
            dispatch(window, 'pointerup', { pointerId: 0 });
            hidden.mockReturnValue(true);
            dispatch(document, 'visibilitychange');
            h.resize(844, 390);
            jest.advanceTimersByTime(500);
            expect(h.vectors).toHaveLength(emissions);
            expect(h.controls.isVisible).toBe(false);
        });

        test('suspension immediately cancels a released short flick until explicitly resumed', () => {
            const h = setup(source);
            h.start(0, -30, 0);
            h.send('up', 0, 0, 0);
            expect(h.controls.suspend()).toBe(true);
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            expect(jest.getTimerCount()).toBe(0);
            h.start();
            expect(h.controls.activePointerId).toBeNull();
            h.controls.resume();
            h.start(2);
            h.drag(0, 35, 2);
            expect(h.vector().y).toBeGreaterThan(0.8);
        });

        test('rotation preserves modal suspension and keeps new action zones disabled', () => {
            const h = setup(source);
            h.start();
            h.drag(-30, 30);
            h.controls.suspend();
            h.resize(844, 390);
            expect(h.controls.isSuspended).toBe(true);
            h.controls.getControlElements().forEach(element => {
                expect(element.visible).toBe(false);
                if (element.input) expect(element.input.enabled).toBe(false);
            });
            h.start();
            expect(h.controls.activePointerId).toBeNull();
            expect(h.vector()).toEqual({ x: 0, y: 0 });
            h.controls.resume();
            h.start(2);
            h.drag(-35, 0, 2);
            expect(h.vector().x).toBeLessThan(-0.8);
            Object.values(h.controls.actionButtons).forEach(button => {
                expect(button.zone.input.enabled).toBe(true);
            });
        });

        test('viewport changes rebuild hit geometry, clear old input, and leave one working listener', () => {
            const h = setup(source);
            for (const [width, height, sideInset, bottomOcclusion] of [
                [320, 568, 0, 0], [844, 390, 44, 21], [390, 844, 0, 80]
            ]) {
                h.start();
                h.drag(-30, 30);
                const oldElements = h.controls.getControlElements();
                h.insets['--sal'] = `${sideInset}px`;
                h.insets['--sar'] = `${sideInset}px`;
                h.setViewport({ bottomOcclusion });
                h.resize(width, height);
                expect(h.vector()).toEqual({ x: 0, y: 0 });
                expect(h.controls.activePointerId).toBeNull();
                oldElements.forEach(element => expect(element.destroy).toHaveBeenCalledTimes(1));
                const dock = h.controls.layout;
                expect(dock.dockBottom).toBe(height - Math.max(34, bottomOcclusion));
                expect(dock.joystick.x - dock.joystick.radius).toBeGreaterThanOrEqual(sideInset);
                Object.values(h.controls.actionButtons).forEach(button => {
                    expect(button.zone.x + button.zone.width / 2).toBeLessThanOrEqual(width - sideInset);
                    expect(button.zone.y + button.zone.height / 2).toBeLessThanOrEqual(dock.dockBottom);
                });
                expect(h.scene.scale.listenerCount('resize')).toBe(1);
                expect(h.scene.input.listenerCount('pointerup')).toBe(1);
                h.send('move', 0, 10, 10);
                expect(h.vector()).toEqual({ x: 0, y: 0 });
                h.start(2);
                const beforeMove = h.vectors.length;
                h.drag(-35, 35, 2);
                expect(h.vectors).toHaveLength(beforeMove + 1);
                expect(h.vector().x).toBeLessThan(-0.5);
                expect(h.vector().y).toBeGreaterThan(0.5);
                jest.advanceTimersByTime(200);
                h.send('up', 2, 0, 0);
            }
        });

        test('resize cancels an old flick timer before the next gesture starts', () => {
            const h = setup(source);
            h.start(0, -30, 0);
            h.send('up', 0, 0, 0);
            expect(jest.getTimerCount()).toBe(1);
            h.resize(844, 390);
            expect(jest.getTimerCount()).toBe(0);
            h.start(2);
            h.drag(0, 35, 2);
            jest.advanceTimersByTime(500);
            expect(h.vector().y).toBeGreaterThan(0.8);
            expect(h.controls.activePointerId).toBe(2);
        });
    });

    test.each([
        ['touch', 'touchcancel', 'canvas'],
        ['pointer', 'pointercancel', 'canvas'],
        ['pointer', 'pointercancel', 'window'],
        ['pointer', 'lostpointercapture', 'canvas']
    ])('%s %s on %s aborts immediately, without a synthetic flick', (source, type, target) => {
        const h = setup(source);
        // Isolate the canvas listener so the window capture fallback cannot mask it.
        if (target === 'canvas') h.canvas.remove();
        h.start(0, -30, 30);
        jest.advanceTimersByTime(20);
        const event = id => source === 'touch'
            ? { changedTouches: [h.point(id, 0, 0)], touches: [] }
            : { pointerId: id, pointerType: 'touch' };
        dispatch(target === 'canvas' ? h.canvas : window, type, event(9));
        expect(h.controls.activePointerId).toBe(0);
        dispatch(target === 'canvas' ? h.canvas : window, type, event(0));
        expect(h.vector()).toEqual({ x: 0, y: 0 });
        expect(h.controls.activePointerId).toBeNull();
        expect(jest.getTimerCount()).toBe(0);
        h.start(2);
        h.drag(0, 35, 2);
        jest.advanceTimersByTime(500);
        expect(h.vector().y).toBeGreaterThan(0.8);
    });

    test.each(['pointerup', 'pointercancel', 'lostpointercapture'])('native touch ignores synthetic %s for the same ID', type => {
        const h = setup('touch');
        h.start();
        h.drag(-30, 30);
        const held = h.vector();
        dispatch(h.canvas, type, { pointerId: 0, pointerType: 'touch' });
        jest.advanceTimersByTime(500);
        expect(h.vector()).toEqual(held);
        expect(h.controls.activePointerId).toBe(0);
    });

    test.each(['blur', 'suspend', 'hide', 'destroy', 'resize'])('%s releases a held native pointer capture', operation => {
        const h = setup('pointer');
        h.start();
        h.drag(-30, 30);
        expect(h.captures.has(0)).toBe(true);
        if (operation === 'blur') dispatch(window, 'blur');
        else if (operation === 'resize') h.resize(844, 390);
        else h.controls[operation]();
        expect(h.captures.size).toBe(0);
        expect(h.canvas.releasePointerCapture).toHaveBeenCalledTimes(1);
        expect(h.vector()).toEqual({ x: 0, y: 0 });
        expect(jest.getTimerCount()).toBe(0);
    });

    test('an outside-canvas release defers once and is invalidated by scene exit', async () => {
        const h = setup('pointer');
        h.start(0, -30, 0);
        jest.advanceTimersByTime(200);
        dispatch(window, 'pointerup', { pointerId: 0 });
        await Promise.resolve();
        expect(h.vector()).toEqual({ x: 0, y: 0 });
        h.start(2, -30, 0);
        dispatch(window, 'pointerup', { pointerId: 2 });
        h.controls.destroy();
        const emissions = h.vectors.length;
        await Promise.resolve();
        jest.advanceTimersByTime(500);
        expect(h.vectors).toHaveLength(emissions);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('a secondary Phaser pointer slot cannot release an unrelated native pointer ID', () => {
        const h = setup('pointer');
        h.start(2);
        h.drag(-30, 30, 2);
        const held = h.vector();
        jest.advanceTimersByTime(200);
        // Phaser's slot id is not a DOM pointerId or a Touch.identifier.
        h.scene.input.emit('pointerup', {
            id: 2, identifier: 27,
            event: { type: 'touchend', changedTouches: [h.point(27, 300, 760)] }
        });
        expect(h.vector()).toEqual(held);
        expect(h.controls.activePointerId).toBe(2);
        h.scene.input.emit('pointerup', { id: 2, event: { pointerId: 9 } });
        expect(h.vector()).toEqual(held);
    });

    test('the Phaser fallback releases only a verified native pointer ID', () => {
        const h = setup('pointer');
        h.start(7);
        h.drag(-30, 30, 7);
        jest.advanceTimersByTime(200);
        h.scene.input.emit('pointerup', { id: 1, event: { pointerId: 7 } });
        expect(h.vector()).toEqual({ x: 0, y: 0 });
        expect(h.controls.activePointerId).toBeNull();
        expect(h.captures.size).toBe(0);
    });

    test('keyboard viewport occlusion does not replace the CSS home-indicator inset', () => {
        const h = setup();
        h.setViewport({ offsetTop: 50, offsetLeft: 12, rightOcclusion: 18, bottomOcclusion: 300 });
        expect(h.layout.getSafeAreaInsets()).toEqual({ top: 50, left: 12, right: 18, bottom: 300 });
        h.setViewport({ bottomOcclusion: 300, keyboardOpen: true });
        expect(h.layout.getSafeAreaInsets().bottom).toBe(34);
    });
});

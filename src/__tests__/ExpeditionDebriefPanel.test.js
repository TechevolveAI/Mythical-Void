const fs = require('fs');
const path = require('path');
const EventEmitter = require('eventemitter3');
const TouchManager = require('phaser/src/input/touch/TouchManager');

function loadPanel() {
    const source = fs.readFileSync(path.join(__dirname, '../ui/ExpeditionDebriefPanel.js'), 'utf8')
        .replace(/^import .*;$/gm, '')
        .replace('export default class ', 'class ');
    return new Function(`${source}\nreturn ExpeditionDebriefPanel;`)();
}

const model = {
    title: 'A living world', context: 'Mythical Forest / Forest Core recovered',
    finding: 'The forest is connected.', creatureMoment: 'Your creature feels the roots recover.',
    fieldNote: 'Keep the roots safe.', nextStep: 'NEXT: Crystal Caves',
    actionLabel: 'INSTALL FOREST CORE', color: '#8FE3CF'
};

describe('Expedition completion browser control', () => {
    let panel;
    afterEach(() => {
        panel?.destroy();
        document.body.innerHTML = '';
        delete window.visualViewport;
        jest.restoreAllMocks();
    });

    test('one native action completes once without animation or provider callbacks', () => {
        const onContinue = jest.fn();
        panel = new (loadPanel())({ onContinue });
        expect(panel.show(model)).toBe(true);
        expect(panel.show(model)).toBe(false);
        const button = document.querySelector('button');
        expect(document.activeElement).toBe(button);
        expect(document.querySelector('details').open).toBe(false);
        button.click();
        button.click();
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    test('long story and untrusted names remain text, with action outside scrollable content', () => {
        panel = new (loadPanel())({ onContinue: jest.fn() });
        panel.show({ ...model, finding: '<img src=x onerror=alert(1)>'.repeat(100), color: 'url(https://example.com)' });
        expect(document.querySelector('img')).toBeNull();
        expect(document.querySelector('button').closest('footer')).not.toBeNull();
        expect(document.querySelector('.expedition-debrief-story').contains(document.querySelector('button'))).toBe(false);
        expect(panel.root.style.getPropertyValue('--debrief-accent')).toBe('');
    });

    test('tracks visual viewport size and removes every viewport listener on shutdown', () => {
        const viewport = new EventTarget();
        Object.assign(viewport, { width: 390, height: 620, offsetTop: 12, offsetLeft: 0 });
        window.visualViewport = viewport;
        const remove = jest.spyOn(viewport, 'removeEventListener');
        const onContinue = jest.fn();
        panel = new (loadPanel())({ onContinue });
        panel.show(model);
        expect(panel.root.style.height).toBe('620px');
        viewport.height = 360;
        viewport.dispatchEvent(new Event('resize'));
        expect(panel.root.style.height).toBe('360px');
        expect(panel.root.style.top).toBe('12px');
        panel.destroy();
        panel.destroy();
        expect(remove).toHaveBeenCalledTimes(2);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onContinue).not.toHaveBeenCalled();
    });

    test('captures gate keys, keeps tab focus inside and Escape continues once', () => {
        const onContinue = jest.fn();
        panel = new (loadPanel())({ onContinue });
        panel.show(model);
        const gameListener = jest.fn();
        document.addEventListener('keydown', gameListener);
        document.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(gameListener).not.toHaveBeenCalled();
        document.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(panel.root.contains(document.activeElement)).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        expect(onContinue).toHaveBeenCalledTimes(1);
        document.removeEventListener('keydown', gameListener);
    });

    test('a rejected or failed handoff leaves a retryable native control', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const onContinue = jest.fn().mockReturnValueOnce(false).mockImplementationOnce(() => { throw new Error('handoff'); });
        panel = new (loadPanel())({ onContinue });
        panel.show(model);
        panel.button.click();
        expect(panel.button.disabled).toBe(false);
        panel.button.click();
        expect(panel.button.disabled).toBe(false);
        expect(panel.error.hidden).toBe(false);
        panel.button.click();
        expect(panel.root).toBeNull();
    });
});

describe('Hub debrief handoff behavior', () => {
    let Hub;
    let acknowledge;
    let getNext;
    let openScenes;
    beforeEach(() => {
        openScenes = [];
        acknowledge = jest.fn();
        getNext = jest.fn(() => null);
        const source = fs.readFileSync(path.join(__dirname, '../scenes/HubWorldScene.js'), 'utf8')
            .replace(/import[\s\S]*?;\s*/g, '')
            .replace('export default class ', 'class ');
        Hub = new Function('Phaser', 'acknowledgeProjectBeaconDebrief', 'getNextProjectBeaconDebrief', 'ExpeditionDebriefPanel', `${source}\nreturn HubWorldScene;`)(
            { Scene: class {} }, acknowledge, getNext, loadPanel()
        );
    });
    afterEach(() => {
        openScenes.forEach(scene => scene.projectBeaconDebriefPanel?.destroy());
        document.body.innerHTML = '';
        delete window.GameState;
        jest.restoreAllMocks();
    });

    function liveHub(enabled = true, count = 1) {
        const scene = new Hub();
        const queue = Array.from({ length: count }, (_, index) => ({
            ...model, id: `debrief-${index}`, levelId: 'mythicalForest',
            shipPartId: 'forest_core', nextGate: { label: 'Crystal Caves' }
        }));
        const input = new EventEmitter();
        let inputEnabled = enabled;
        const inputWrites = [];
        Object.defineProperty(input, 'enabled', {
            get: () => inputEnabled,
            set: value => { inputEnabled = value; inputWrites.push(value); }
        });
        Object.assign(scene, {
            input,
            scene: { start: jest.fn() },
            getPendingProjectBeaconDebrief: () => queue[0] || null,
            focusProjectBeaconNextRoute: jest.fn()
        });
        getNext.mockImplementation(() => queue[0] || null);
        acknowledge.mockImplementation((state, id) => {
            expect(queue[0].id).toBe(id);
            queue.shift();
            return true;
        });
        openScenes.push(scene);
        return { scene, input, inputWrites };
    }

    function hub() {
        const scene = new Hub();
        Object.assign(scene, {
            isProjectBeaconDebriefOpen: true,
            projectBeaconDebriefPanel: { destroy: jest.fn() },
            scene: { start: jest.fn() },
            focusProjectBeaconNextRoute: jest.fn(),
            showPendingProjectBeaconDebrief: jest.fn()
        });
        return scene;
    }

    test.each(['forest_core', 'crystal_core', 'dimensional_drive', 'hull_plating', 'aurora_reactor'])(
        '%s leaves for reconstruction synchronously and cannot double-continue', shipPartId => {
            const scene = hub();
            const debrief = { id: 'pending', shipPartId, nextGate: { label: 'Next realm' } };
            expect(scene.completeProjectBeaconDebrief(debrief)).toBe(true);
            expect(scene.completeProjectBeaconDebrief(debrief)).toBe(false);
            expect(acknowledge).toHaveBeenCalledTimes(1);
            expect(scene.scene.start).toHaveBeenCalledTimes(1);
            expect(scene.scene.start).toHaveBeenCalledWith('GameScene', {
                biome: 'nebula', shipReconstructionHandoff: true,
                shipReconstructionNextGateLabel: 'Next realm'
            });
        }
    );

    test('older queued results remain reviewable before reconstruction', () => {
        const scene = hub();
        const done = jest.fn();
        getNext.mockReturnValue({ id: 'second' });
        scene.completeProjectBeaconDebrief({ id: 'first', shipPartId: 'forest_core' }, done);
        expect(scene.showPendingProjectBeaconDebrief).toHaveBeenCalledWith(done);
        expect(scene.scene.start).not.toHaveBeenCalled();
    });

    test('preview cannot mutate progress; shutdown cannot navigate', () => {
        const scene = hub();
        const done = jest.fn();
        scene.completeProjectBeaconDebrief({ isPreview: true, shipPartId: 'forest_core' }, done);
        expect(acknowledge).not.toHaveBeenCalled();
        expect(scene.scene.start).not.toHaveBeenCalled();
        expect(done).toHaveBeenCalledTimes(1);
        scene.isProjectBeaconDebriefOpen = true;
        scene._isShuttingDown = true;
        expect(scene.completeProjectBeaconDebrief({ id: 'first' }, done)).toBe(false);
        expect(done).toHaveBeenCalledTimes(1);
    });

    describe.each([true, false])('original input.enabled=%s', enabled => {
        test('native completion restores the original state before synchronous navigation', () => {
            const { scene, input } = liveHub(enabled);
            scene.scene.start.mockImplementation(() => expect(input.enabled).toBe(enabled));
            expect(scene.showPendingProjectBeaconDebrief()).toBe(true);
            expect(input.enabled).toBe(false);
            scene.projectBeaconDebriefPanel.button.click();
            expect(input.enabled).toBe(enabled);
            expect(scene.scene.start).toHaveBeenCalledTimes(1);
            expect(document.querySelector('[role="dialog"]')).toBeNull();
        });

        test('queued dialogs keep input suspended without overwriting the original state', () => {
            const { scene, input, inputWrites } = liveHub(enabled, 2);
            scene.showPendingProjectBeaconDebrief();
            const firstPanel = scene.projectBeaconDebriefPanel;
            firstPanel.button.click();
            expect(scene.projectBeaconDebriefPanel).not.toBe(firstPanel);
            expect(scene.projectBeaconDebriefPanel.root.isConnected).toBe(true);
            expect(input.enabled).toBe(false);
            expect(inputWrites).not.toContain(true);
            expect(scene.scene.start).not.toHaveBeenCalled();
            scene.projectBeaconDebriefPanel.button.click();
            expect(input.enabled).toBe(enabled);
            expect(acknowledge).toHaveBeenCalledTimes(2);
            expect(scene.scene.start).toHaveBeenCalledTimes(1);
        });

        test.each(['init', 'shutdown'])('%s restores once and removes the native dialog', method => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const { scene, input, inputWrites } = liveHub(enabled);
            scene.showPendingProjectBeaconDebrief();
            expect(input.enabled).toBe(false);
            scene[method]();
            expect(input.enabled).toBe(enabled);
            expect(document.querySelector('[role="dialog"]')).toBeNull();
            expect(scene.isProjectBeaconDebriefOpen).toBe(false);
            const writes = inputWrites.length;
            scene[method]();
            expect(inputWrites).toHaveLength(writes);
            expect(acknowledge).not.toHaveBeenCalled();
            expect(scene.scene.start).not.toHaveBeenCalled();
        });

        test('Escape preview completion restores input before its callback', () => {
            const { scene, input } = liveHub(enabled);
            scene.getPendingProjectBeaconDebrief = () => ({ ...model, isPreview: true });
            const done = jest.fn(() => expect(input.enabled).toBe(enabled));
            scene.showPendingProjectBeaconDebrief(done);
            scene.projectBeaconDebriefPanel.button.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', bubbles: true, cancelable: true
            }));
            expect(done).toHaveBeenCalledTimes(1);
            expect(input.enabled).toBe(enabled);
            expect(acknowledge).not.toHaveBeenCalled();
        });
    });

    test('real Phaser window touch delivery cannot activate hidden Hub controls through the dialog', () => {
        const { scene, input } = liveHub();
        const objects = [];
        const drawable = (x, y, text) => {
            const object = new EventEmitter();
            Object.assign(object, { x, y, text });
            for (const method of [
                'setOrigin', 'setDepth', 'setPosition', 'setAlpha', 'fillStyle',
                'fillRoundedRect', 'lineStyle', 'strokeRoundedRect'
            ]) object[method] = () => object;
            object.setInteractive = () => {
                object.input = { enabled: true, localX: 10, localY: 10 };
                return object;
            };
            objects.push(object);
            return object;
        };
        window.GameState = { getCollectionStatus: () => ({ count: 2, max: 8 }), get: () => 0 };
        Object.assign(scene, {
            dims: { width: 390, height: 844, isMobile: true },
            add: { text: drawable, zone: drawable, graphics: () => drawable() },
            createShipPartsDisplay: jest.fn(), createMobileNavArrows: jest.fn(),
            showCreatureCollection: jest.fn()
        });
        scene.createUI();
        scene.createCollectionButton();
        const back = objects.find(object => typeof object.text === 'string' && object.text.includes('Back'));
        const collection = scene.collectionButton.zone;

        // Execute Phaser's real dispatch methods without booting its renderer/audio.
        // Hit-testing is fixed to the known Back and collection coordinates.
        const source = fs.readFileSync(require.resolve('phaser/src/input/InputPlugin'), 'utf8').replace(/\r/g, '');
        const method = name => {
            const match = source.match(new RegExp(`${name}: function \\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n    \\},`));
            return new Function('Events', 'CONST', `return function(${match[1]}) {${match[2]}}`)(
                require('phaser/src/input/events'), require('phaser/src/input/const')
            );
        };
        const canvas = document.createElement('canvas');
        document.body.append(canvas);
        const manager = {
            canvas, enabled: true, events: new EventEmitter(),
            game: { canvas, config: { autoFocus: false, inputWindowEvents: true } },
            onTouchStart: jest.fn(event => {
                const touch = event.changedTouches[0];
                input.update(require('phaser/src/input/const').TOUCH_START, [{
                    x: touch.pageX, y: touch.pageY, downElement: event.target
                }]);
            }),
            onTouchEnd: jest.fn(), onTouchCancel: jest.fn()
        };
        Object.assign(input, {
            manager, _eventData: {}, _eventContainer: {}, topOnly: true,
            isActive: () => input.enabled,
            hitTestPointer: pointer => pointer.x === 30 ? [back] : [collection],
            sortGameObjects() {}, sortDropZones() {},
            processDragDownEvent: () => 0, processOverEvents: () => 0,
            processDownEvents: method('processDownEvents'), update: method('update')
        });
        const touchManager = new TouchManager(manager);
        touchManager.enabled = true;
        touchManager.target = canvas;
        touchManager.startListeners();
        const touchAt = (target, x, y) => {
            const event = new Event('touchstart', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'changedTouches', {
                value: [{ identifier: 1, pageX: x, pageY: y, target }]
            });
            target.dispatchEvent(event);
            return event;
        };
        try {
            // Establish that the same native route reaches the actual Hub callbacks.
            touchAt(canvas, 30, 30);
            touchAt(canvas, 330, 70);
            expect(scene.scene.start).toHaveBeenCalledWith('GameScene');
            expect(scene.showCreatureCollection).toHaveBeenCalledTimes(1);
            scene.scene.start.mockClear();
            scene.showCreatureCollection.mockClear();
            scene.showPendingProjectBeaconDebrief();
            const panel = scene.projectBeaconDebriefPanel;
            expect(touchAt(panel.root, 30, 30).defaultPrevented).toBe(false);
            expect(touchAt(panel.root, 330, 70).defaultPrevented).toBe(false);
            expect(manager.onTouchStart).toHaveBeenCalledTimes(4);
            expect(scene.scene.start).not.toHaveBeenCalled();
            expect(scene.showCreatureCollection).not.toHaveBeenCalled();

            const story = panel.root.querySelector('.expedition-debrief-story');
            const move = new Event('touchmove', { bubbles: true, cancelable: true });
            story.dispatchEvent(move);
            expect(move.defaultPrevented).toBe(false);
            panel.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            expect(document.activeElement).toBe(story);
            const scrollKey = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
            story.dispatchEvent(scrollKey);
            expect(scrollKey.defaultPrevented).toBe(false);
            panel.button.click();
            expect(acknowledge).toHaveBeenCalledTimes(1);
            expect(scene.scene.start).toHaveBeenCalledWith('GameScene', expect.objectContaining({ shipReconstructionHandoff: true }));
            expect(input.enabled).toBe(true);
        } finally {
            touchManager.stopListeners();
            for (const [event, handler] of [
                ['touchstart', touchManager.onTouchStartWindow],
                ['touchend', touchManager.onTouchEndWindow],
                ['touchcancel', touchManager.onTouchCancelWindow]
            ]) window.removeEventListener(event, handler);
            canvas.remove();
        }
    });
});

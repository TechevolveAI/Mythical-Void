const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const legalConfig = require('../config/legal.json');

function createModal(width = 1280, height = 720) {
    const filename = path.join(__dirname, '../ui/AgeGateModal.js');
    const source = fs.readFileSync(filename, 'utf8')
        .replace("import legalConfig from '../config/legal.json';", '')
        .replace('export default AgeGateModal;', 'module.exports = AgeGateModal;');
    const context = { module: { exports: {} }, legalConfig, localStorage, window };
    vm.runInNewContext(source, context, { filename });
    const objects = [];
    function object(type, x, y, width, height, text) {
        const item = Object.assign(new EventEmitter(), { type, x, y, width, height, text, destroyed: false });
        for (const method of ['fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle',
            'strokeRoundedRect', 'setScrollFactor', 'setDepth', 'setOrigin', 'clear']) {
            item[method] = () => item;
        }
        item.setInteractive = () => { item.interactive = true; return item; };
        item.destroy = () => { item.destroyed = true; item.removeAllListeners(); };
        objects.push(item);
        return item;
    }
    const scene = {
        // Deliberately stale camera bounds, as during the scale resize event.
        cameras: { main: { width: 1280, height: 720 } },
        scale: Object.assign(new EventEmitter(), { gameSize: { width, height } }),
        events: new EventEmitter(),
        add: {
            graphics: () => object('graphics'),
            text: (x, y, text) => object('text', x, y, 0, 0, text),
            zone: (x, y, width, height) => object('zone', x, y, width, height)
        },
        time: { delayedCall: jest.fn((delay, callback) => setTimeout(callback, delay)) }
    };
    const modal = new context.module.exports(scene);
    const onComplete = jest.fn();
    modal.show(onComplete);
    return {
        modal, scene, objects, onComplete,
        zones: () => objects.filter(item => item.interactive && !item.destroyed),
        resize: (width, height) => {
            scene.scale.gameSize = { width, height };
            scene.scale.emit('resize', scene.scale.gameSize);
        }
    };
}

function expectTouchableInside(zones, width, height) {
    for (const zone of zones) {
        expect(zone.width).toBeGreaterThanOrEqual(44);
        expect(zone.height).toBeGreaterThanOrEqual(44);
        expect(zone.x - zone.width / 2).toBeGreaterThanOrEqual(0);
        expect(zone.y - zone.height / 2).toBeGreaterThanOrEqual(0);
        expect(zone.x + zone.width / 2).toBeLessThanOrEqual(width);
        expect(zone.y + zone.height / 2).toBeLessThanOrEqual(height);
        for (const other of zones) {
            if (other === zone) continue;
            const separated = Math.abs(zone.x - other.x) >= (zone.width + other.width) / 2
                || Math.abs(zone.y - other.y) >= (zone.height + other.height) / 2;
            expect(separated).toBe(true);
        }
    }
}

describe('age gate survives phone rotation', () => {
    beforeEach(() => { localStorage.clear(); jest.useFakeTimers(); });
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    test.each([[320, 568], [390, 844], [844, 390], [568, 320], [320, 375]])(
        'all four choices fit a %s by %s viewport from first render', (width, height) => {
            const f = createModal(width, height);
            expect(f.zones()).toHaveLength(4);
            expectTouchableInside(f.zones(), width, height);
            expect(localStorage.length).toBe(0);
            expect(f.onComplete).not.toHaveBeenCalled();
        }
    );

    test('repeated rotations replace old hit areas without choosing an age', () => {
        const f = createModal();
        for (const [width, height] of [[390, 844], [844, 390], [320, 568], [568, 320], [1280, 720]]) {
            const oldObjects = f.objects.slice();
            f.resize(width, height);
            expect(oldObjects.every(item => item.destroyed)).toBe(true);
            expect(f.zones()).toHaveLength(4);
            expectTouchableInside(f.zones(), width, height);
            expect(f.scene.scale.listenerCount('resize')).toBe(1);
        }
        expect(localStorage.length).toBe(0);
        expect(f.onComplete).not.toHaveBeenCalled();
        expect(f.scene.time.delayedCall).not.toHaveBeenCalled();
    });

    test.each([0, 1])('local-play notice for option %s survives rotation and completes once', index => {
        const f = createModal(390, 844);
        f.zones()[index].emit('pointerup');
        expect(localStorage.getItem('mythical_void_age_group')).toBe(legalConfig.ageGate.options[index].storeAs);
        expect(f.modal.isVisible).toBe(true);
        for (const [width, height] of [[844, 390], [320, 568], [568, 320]]) {
            f.resize(width, height);
            expect(f.zones()).toHaveLength(1);
            expectTouchableInside(f.zones(), width, height);
            expect(f.objects.filter(item => !item.destroyed && item.text === legalConfig.ageGate.options[index].notice)).toHaveLength(1);
            expect(f.onComplete).not.toHaveBeenCalled();
        }
        f.zones()[0].emit('pointerup');
        f.modal.complete();
        expect(f.onComplete).not.toHaveBeenCalled();
        expect(f.zones()).toHaveLength(0);
        jest.advanceTimersByTime(50);
        expect(f.onComplete).toHaveBeenCalledTimes(1);
        expect(f.scene.scale.listenerCount('resize')).toBe(0);
        expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        expect(f.scene.events.listenerCount('destroy')).toBe(0);
    });

    test.each([2, 3])('option %s still continues on release without a local-play notice', index => {
        const f = createModal(844, 390);
        const button = f.zones()[index];
        button.emit('pointerdown');
        expect(localStorage.length).toBe(0);
        button.emit('pointerup');
        expect(localStorage.getItem('mythical_void_age_group')).toBe(legalConfig.ageGate.options[index].storeAs);
        expect(f.zones()).toHaveLength(0);
        expect(f.onComplete).not.toHaveBeenCalled();
        jest.advanceTimersByTime(50);
        expect(f.onComplete).toHaveBeenCalledTimes(1);
    });

    test.each(['shutdown', 'destroy'])('%s removes the panel and resize listeners', event => {
        const f = createModal();
        f.zones()[0].emit('pointerup');
        f.scene.events.emit(event);
        const objectCount = f.objects.length;
        f.resize(844, 390);
        jest.advanceTimersByTime(100);
        expect(f.objects).toHaveLength(objectCount);
        expect(f.objects.every(item => item.destroyed)).toBe(true);
        expect(f.modal.isVisible).toBe(false);
        expect(f.onComplete).not.toHaveBeenCalled();
        expect(f.scene.scale.listenerCount('resize')).toBe(0);
        expect(f.scene.events.listenerCount('shutdown')).toBe(0);
        expect(f.scene.events.listenerCount('destroy')).toBe(0);
    });

    test('showing the modal again replaces its previous callback and listener', () => {
        const f = createModal();
        const nextComplete = jest.fn();
        f.modal.show(nextComplete);
        expect(f.scene.scale.listenerCount('resize')).toBe(1);
        expect(f.zones()).toHaveLength(4);
        f.zones()[3].emit('pointerup');
        jest.advanceTimersByTime(50);
        expect(nextComplete).toHaveBeenCalledTimes(1);
        expect(f.onComplete).not.toHaveBeenCalled();
    });
});

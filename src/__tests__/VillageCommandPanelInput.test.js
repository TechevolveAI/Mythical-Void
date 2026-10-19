const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '../ui/VillageCommandPanel.js');
const source = fs.readFileSync(file, 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export default class VillageCommandPanel', 'class VillageCommandPanel')
    + '\nmodule.exports = VillageCommandPanel;';

describe('Village command panel input ownership', () => {
    let panel, scene, onClose, onTick;
    beforeEach(() => {
        jest.useFakeTimers();
        const context = { module: { exports: {} }, window, document, console,
            requestAnimationFrame: callback => window.setTimeout(callback, 0) };
        vm.runInNewContext(source, context, { filename: file });
        scene = { input: { enabled: true }, physics: { world: { isPaused: false },
            pause: jest.fn(), resume: jest.fn() },
            mobileControls: { suspend: jest.fn(() => true), resume: jest.fn() } };
        panel = new context.module.exports(scene);
        // Exercise real show/destroy and native events without art dependencies.
        panel.render = jest.fn(() => {
            const close = document.createElement('button');
            close.className = 'village-command-close';
            close.addEventListener('click', () => panel.destroy());
            panel.root.replaceChildren(close);
        });
        onClose = jest.fn(); onTick = jest.fn();
    });
    afterEach(() => {
        panel.destroy();
        document.body.replaceChildren();
        jest.clearAllTimers(); jest.useRealTimers();
    });
    const show = () => panel.show({ getSnapshot: () => ({ plots: [], definitions: [] }), onClose, onTick });

    test('blocks the underlying shop while open and restores it once on close', () => {
        expect(show()).toBe(true);
        expect(scene.input.enabled).toBe(false);
        expect(scene.physics.pause).toHaveBeenCalledTimes(1);
        panel.root.querySelector('button').click();
        expect(scene.input.enabled).toBe(true);
        expect(scene.physics.resume).toHaveBeenCalledTimes(1);
        expect(scene.mobileControls.resume).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        panel.destroy();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('does not enable controls or physics that were already disabled', () => {
        scene.input.enabled = false;
        scene.physics.world.isPaused = true;
        scene.mobileControls.suspend.mockReturnValue(false);
        show(); panel.destroy();
        expect(scene.input.enabled).toBe(false);
        expect(scene.physics.resume).not.toHaveBeenCalled();
        expect(scene.mobileControls.resume).not.toHaveBeenCalled();
    });

    test('Escape closes only this panel, not the shop beneath it', () => {
        const underlyingEscape = jest.fn();
        window.addEventListener('keydown', underlyingEscape);
        try {
            show();
            const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
            window.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(underlyingEscape).not.toHaveBeenCalled();
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(underlyingEscape).toHaveBeenCalledTimes(1);
        } finally { window.removeEventListener('keydown', underlyingEscape); }
    });

    test('a rejected second show cannot overwrite the original input state', () => {
        show();
        expect(show()).toBe(false);
        panel.destroy();
        expect(scene.input.enabled).toBe(true);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('teardown removes refresh callbacks and tolerates an already-destroyed scene', () => {
        show(); jest.advanceTimersByTime(1100);
        expect(onTick).toHaveBeenCalledTimes(1);
        scene.input = null; scene.physics = null;
        expect(() => panel.destroy()).not.toThrow();
        jest.advanceTimersByTime(5000);
        expect(onTick).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.village-command-modal')).toBeNull();
    });

    test('refresh retains every planner scroll surface, including desktop columns', () => {
        show();
        panel.guided = true;
        panel.getSnapshot = () => ({ definitions: [], plots: [], buildings: [], phase: { complete: false } });
        const classes = ['village-command-shell', 'village-command-body',
            'village-building-catalog', 'village-site-plan', 'village-guided-stage'];
        const renderSurfaces = () => panel.root.replaceChildren(...classes.map(className => {
            const node = document.createElement('section');
            node.className = className;
            return node;
        }));
        renderSurfaces();
        classes.forEach((className, index) => {
            const node = panel.root.querySelector('.' + className);
            node.scrollTop = 100 + index;
            node.scrollLeft = 10 + index;
        });
        panel.renderGuided = renderSurfaces;
        Object.getPrototypeOf(panel).render.call(panel);
        classes.forEach((className, index) => {
            const node = panel.root.querySelector('.' + className);
            expect(node.scrollTop).toBe(100 + index);
            expect(node.scrollLeft).toBe(10 + index);
        });
    });
});

const fs = require('fs');
const path = require('path');

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
    beforeEach(() => {
        acknowledge = jest.fn();
        getNext = jest.fn(() => null);
        const source = fs.readFileSync(path.join(__dirname, '../scenes/HubWorldScene.js'), 'utf8')
            .replace(/import[\s\S]*?;\s*/g, '')
            .replace('export default class ', 'class ');
        Hub = new Function('Phaser', 'acknowledgeProjectBeaconDebrief', 'getNextProjectBeaconDebrief', `${source}\nreturn HubWorldScene;`)(
            { Scene: class {} }, acknowledge, getNext
        );
    });

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
});

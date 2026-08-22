const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSanctuaryInteractionDirector() {
    const filePath = path.join(
        __dirname,
        '../systems/world/SanctuaryInteractionDirector.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export default class SanctuaryInteractionDirector',
            'class SanctuaryInteractionDirector'
        )
        .concat('\nmodule.exports = SanctuaryInteractionDirector;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Math,
        Number,
        Map
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const SanctuaryInteractionDirector = loadSanctuaryInteractionDirector();

const createDisplayObject = () => ({
    destroyed: false,
    data: new Map(),
    events: new Map(),
    setPosition: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setOrigin: jest.fn().mockReturnThis(),
    setData: jest.fn(function setData(key, value) {
        this.data.set(key, value);
        return this;
    }),
    getData: jest.fn(function getData(key) {
        return this.data.get(key);
    }),
    setInteractive: jest.fn().mockReturnThis(),
    on: jest.fn(function on(event, handler) {
        this.events.set(event, handler);
        return this;
    }),
    fillStyle: jest.fn().mockReturnThis(),
    fillCircle: jest.fn().mockReturnThis(),
    fillEllipse: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    lineBetween: jest.fn().mockReturnThis(),
    strokeCircle: jest.fn().mockReturnThis(),
    strokeEllipse: jest.fn().mockReturnThis(),
    destroy: jest.fn(function destroy() {
        this.destroyed = true;
    })
});

const createGraphics = () => createDisplayObject();

const createScene = () => ({
    player: { x: 0, y: 0 },
    sanctuaryPresentationMode: 'ambient',
    sanctuaryPromptOwnerId: null,
    showInteractionHint: jest.fn(),
    hideInteractionHint: jest.fn(),
    mobileControls: { updateInteractIcon: jest.fn() },
    add: {
        graphics: jest.fn(createGraphics),
        text: jest.fn(() => createDisplayObject()),
        zone: jest.fn(() => createDisplayObject())
    },
    tweens: {
        add: jest.fn(() => ({ stop: jest.fn() }))
    }
});

describe('SanctuaryInteractionDirector', () => {
    it('presents only the nearest offered interaction', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);

        director.offer({
            id: 'portal',
            target: { x: 100, y: 0, active: true },
            message: 'Press SPACE · Begin an expedition',
            icon: 'portal'
        });
        director.offer({
            id: 'heart',
            target: { x: 40, y: 0, active: true },
            message: 'Press SPACE · Open Village Plan',
            icon: 'heart'
        });

        expect(director.active.id).toBe('heart');
        expect(scene.sanctuaryPromptOwnerId).toBe('heart');
        expect(scene.showInteractionHint).toHaveBeenLastCalledWith(
            'Press SPACE · Open Village Plan',
            { persistent: true, ownerId: 'heart' }
        );
        expect(scene.mobileControls.updateInteractIcon)
            .toHaveBeenLastCalledWith('heart');
        expect(scene.add.graphics).toHaveBeenCalledTimes(2);
    });

    it('uses priority only when candidates are within the same local range', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);
        director.offer({
            id: 'garden',
            target: { x: 50, y: 0, active: true },
            message: 'Garden',
            priority: 10
        });
        director.offer({
            id: 'heart',
            target: { x: 64, y: 0, active: true },
            message: 'Heart',
            priority: 40
        });

        expect(director.active.id).toBe('heart');
    });

    it('activates the resolved action and falls back after withdrawal', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);
        const portalAction = jest.fn();
        const heartAction = jest.fn();
        director.offer({
            id: 'portal',
            target: { x: 90, y: 0, active: true },
            message: 'Portal',
            action: portalAction
        });
        director.offer({
            id: 'heart',
            target: { x: 30, y: 0, active: true },
            message: 'Heart',
            action: heartAction
        });

        expect(director.activate()).toBe(true);
        expect(heartAction).toHaveBeenCalledTimes(1);
        director.withdraw('heart');
        expect(director.active.id).toBe('portal');
        expect(director.activate()).toBe(true);
        expect(portalAction).toHaveBeenCalledTimes(1);
    });

    it('suppresses the world halo during story moments', () => {
        const scene = createScene();
        scene.sanctuaryPresentationMode = 'story';
        const director = new SanctuaryInteractionDirector(scene);
        director.offer({
            id: 'heart',
            target: { x: 30, y: 0, active: true },
            message: 'Heart'
        });

        expect(scene.add.graphics).not.toHaveBeenCalled();
        expect(director.indicator).toBeNull();
    });

    it('uses a tappable world beacon instead of the HUD prompt on touch layouts', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);
        const action = jest.fn();

        director.offer({
            id: 'heart',
            target: { x: 30, y: 0, width: 150, height: 130, active: true },
            message: 'Tap the Village Heart · Decide together',
            verb: 'DECIDE',
            label: 'TOGETHER',
            icon: '?',
            hintMode: 'world',
            action
        });

        const hitZone = director.indicatorElements.find(element => (
            element.getData?.('sanctuaryInteractionBeaconHitZone') === true
        ));
        expect(scene.hideInteractionHint).toHaveBeenCalledTimes(1);
        expect(scene.showInteractionHint).not.toHaveBeenCalled();
        expect(hitZone).toBeTruthy();
        expect(hitZone.getData('interactionId')).toBe('heart');
        expect(scene.add.zone).toHaveBeenCalledWith(30, -105.5, 164, 52);
        hitZone.events.get('pointerdown')({ event: { stopPropagation: jest.fn() } });
        expect(action).toHaveBeenCalledTimes(1);
    });

    it('refreshes dynamic landmark presentation without re-offering it', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);
        let repaired = false;
        director.offer({
            id: 'ship',
            target: { x: 30, y: 0, active: true },
            message: 'Recover field kit',
            icon: 'kit',
            presentation: () => repaired
                ? { message: 'Review ship archive', icon: 'ship' }
                : { message: 'Recover field kit', icon: 'kit' }
        });

        repaired = true;
        director.update();

        expect(scene.showInteractionHint).toHaveBeenLastCalledWith(
            'Review ship archive',
            { persistent: true, ownerId: 'ship' }
        );
        expect(scene.mobileControls.updateInteractIcon)
            .toHaveBeenLastCalledWith('ship');
    });
});

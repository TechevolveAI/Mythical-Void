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
    setPosition: jest.fn(function setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }),
    setDepth: jest.fn().mockReturnThis(),
    setScrollFactor: jest.fn().mockReturnThis(),
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
    hasVisibleTouchControls: jest.fn(() => false),
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

    it('lets a plot-anchored command replace the generic landmark beacon', () => {
        const scene = createScene();
        const director = new SanctuaryInteractionDirector(scene);
        director.offer({
            id: 'heart',
            target: { x: 30, y: 0, active: true },
            message: 'Build at the highlighted root',
            suppressWorldBeacon: true
        });

        expect(scene.add.graphics).not.toHaveBeenCalled();
        expect(director.indicator).toBeNull();
        expect(director.active.suppressWorldBeacon).toBe(true);
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

    it('keeps touch beacons above the mobile dock and inside the viewport', () => {
        const scene = createScene();
        scene.hasVisibleTouchControls.mockReturnValue(true);
        scene.cameras = {
            main: {
                x: 0,
                y: 0,
                width: 390,
                zoom: 1,
                worldView: { x: 0, y: 0 }
            }
        };
        scene.mobileControls.layout = { dockTop: 700 };
        const director = new SanctuaryInteractionDirector(scene);

        director.offer({
            id: 'heart',
            target: { x: 380, y: 790, width: 150, height: 80, active: true },
            message: 'Tap the Village Heart',
            verb: 'DECIDE',
            label: 'TOGETHER',
            ownerLabel: 'VILLAGE HEART',
            hintMode: 'world'
        });

        const hitZone = director.indicatorElements.find(element => (
            element.getData?.('sanctuaryInteractionBeaconHitZone') === true
        ));
        expect(hitZone.x).toBe(195);
        expect(hitZone.y).toBe(664);
        expect(hitZone.getData('mobileViewportClamped')).toBe(true);
        expect(hitZone.getData('mobileDockClearance')).toBe(36);
        expect(hitZone.getData('mobileDockAnchored')).toBe(true);
        expect(hitZone.getData('coordinateSpace')).toBe('screen');
        expect(hitZone.getData('ownershipLabel')).toBe('VILLAGE HEART');
        expect(hitZone.getData('ownershipRelation')).toBe('named-target');
        expect(hitZone.setScrollFactor).toHaveBeenCalledWith(0);

        const ownerText = director.indicatorElements.find(element => (
            element.getData?.('sanctuaryInteractionOwnerLabel') === 'VILLAGE HEART'
        ));
        expect(ownerText).toBeTruthy();

        scene.cameras.main.worldView = { x: 50, y: 100 };
        director.update();
        expect(hitZone.x).toBe(195);
        expect(hitZone.y).toBe(664);
    });

    it('adapts world prompts between touch and desktop layouts', () => {
        const scene = createScene();
        let touchControlsVisible = true;
        scene.hasVisibleTouchControls.mockImplementation(
            () => touchControlsVisible
        );
        const director = new SanctuaryInteractionDirector(scene);

        director.offer({
            id: 'shop',
            target: { x: 30, y: 0, width: 120, height: 80, active: true },
            message: 'Press SPACE · Visit the Cosmic Shop',
            verb: 'SHOP',
            label: 'SUPPLIES & BUILDING',
            worldPrompt: true
        });

        expect(director.active.hintMode).toBe('world');
        expect(scene.hideInteractionHint).toHaveBeenCalledTimes(1);
        touchControlsVisible = false;
        director.update({ force: true });
        expect(director.active.hintMode).toBe('hud');
        expect(scene.showInteractionHint).toHaveBeenLastCalledWith(
            'Press SPACE · Visit the Cosmic Shop',
            { persistent: true, ownerId: 'shop' }
        );
        expect(director.beacon).toBeNull();
        expect(director.indicator.getData('commandChannel')).toBe('hud');
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

const Pan = require('phaser/src/cameras/2d/effects/Pan');
const EventEmitter = require('eventemitter3');
const { fixture } = require('./mountainEncounterFixture.cjs');

function entranceFixture({ phone = true } = {}) {
    const f = fixture(), { scene } = f;
    const wallTimers = new Map();
    let wallNow = 0, nextId = 0;
    const wallSet = jest.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
        const id = ++nextId; wallTimers.set(id, { callback, at: wallNow + delay }); return id;
    });
    const wallClear = jest.spyOn(window, 'clearTimeout').mockImplementation(id => wallTimers.delete(id));
    const wallAdvance = delta => {
        const end = wallNow + delta;
        for (;;) {
            const next = [...wallTimers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            const [id, timer] = next;
            wallNow = timer.at; wallTimers.delete(id); timer.callback();
        }
        wallNow = end;
    };
    const drawing = (x = 0, y = 0) => {
        const value = f.object(x, y);
        for (const name of ['setOrigin', 'setScrollFactor', 'setVisible', 'setText', 'clearTint',
            'lineStyle', 'fillStyle', 'strokeCircle', 'fillRect', 'fillTriangle', 'lineBetween']) {
            value[name] = jest.fn(() => value);
        }
        return value;
    };
    const camera = Object.assign(new EventEmitter(), { scene, width: phone ? 390 : 1280,
        height: phone ? 844 : 720, scrollX: 0, scrollY: 0,
        getScroll(x, y, out) { return out.set(x - this.width / 2, y - this.height / 2); },
        setScroll(x, y) { this.scrollX = x; this.scrollY = y; },
        centerOn(x, y) { this.setScroll(x - this.width / 2, y - this.height / 2); },
        stopFollow: jest.fn(), startFollow: jest.fn() });
    camera.panEffect = new Pan(camera);
    camera.pan = (...args) => camera.panEffect.start(...args);
    const pan = jest.spyOn(camera, 'pan');
    const panStart = jest.fn(); camera.on('camerapanstart', panStart);
    const actor = (x, y) => {
        const value = f.actor(x, y);
        value.width = 360; value.height = 330;
        value.setImmovable = flag => { value.body.immovable = flag; return value; };
        value.setCollideWorldBounds = flag => { value.body.collideWorldBounds = flag; return value; };
        value.setOrigin = (ox, oy) => { value.originX = ox; value.originY = oy; return value; };
        value.setAngle = angle => { value.angle = angle; return value; };
        value.setTint = jest.fn(() => value); value.clearTint = jest.fn(() => value);
        value.getBounds = () => ({ left: value.x - 20, right: value.x + 20 });
        return value;
    };
    scene.player.getBounds = () => ({ left: scene.player.x - 20, right: scene.player.x + 20 });
    Object.assign(scene, { boss: null, bossFightActive: false, bossCombatReady: false,
        bossMaxHealth: 24, guardianTransitionGuards: new Map(), cameras: { main: camera },
        levelWidth: 5200, isMobile: phone, cameraLeadAmount: 120, cameraBaseOffsetY: 0,
        createTitanTexture: jest.fn(), createBossHealthBar: jest.fn(), retirePeakPatrolsForTitan: jest.fn(),
        updateBossHealthBar: jest.fn(),
        clearGuardianGateState: jest.fn(), getTraversalSupport: () => ({ body: { top: 400 } }),
        resetJoystick: jest.fn(), releaseAllPlatformerActionButtons: jest.fn(), clearVirtualJumpInput: jest.fn(),
        mountainBody: drawing(), mountainName: drawing(), bossSubtitle: drawing(),
        replySignals: [], titanAttackIndex: 0, titanAttacksCompleted: 0, titanRecoveryUntil: 0,
        titanRecoveryDamage: 0, titanLastHitAt: -Infinity });
    scene.input.keyboard.resetKeys = jest.fn();
    scene.add.text = drawing;
    scene.add.graphics = drawing;
    scene.physics.add.sprite = jest.fn(actor);
    const begin = jest.spyOn(scene, 'beginTitanCombat');
    const execute = jest.spyOn(scene, 'executeTitanAttack');
    const step = delta => {
        for (let elapsed = 0; elapsed < delta;) {
            const tick = Math.min(20, delta - elapsed); elapsed += tick;
            f.advance(tick); camera.panEffect.update(f.clock.now, tick); wallAdvance(tick);
            scene.updateTitanEntrance?.(f.clock.now, tick); scene.updateDeferredTitanCombat?.();
        }
    };
    return { ...f, camera, pan, panStart, begin, execute, wallTimers, wallAdvance, step, actor,
        currentPan: () => scene.titanEntrance?.pan || camera.panEffect,
        close() {
            scene.cancelGuardianTransitions(); f.close(); camera.panEffect.destroy(); camera.removeAllListeners();
            wallTimers.clear(); wallSet.mockRestore(); wallClear.mockRestore();
        } };
}

module.exports = { entranceFixture };

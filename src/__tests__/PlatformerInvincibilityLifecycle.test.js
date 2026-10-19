const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const TweenManager = require('phaser/src/tweens/TweenManager');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const names = ['takeDamage', 'startInvincibilityFlash', 'endInvincibility', 'beginInvincibility',
    'respawnAtCheckpoint', 'retryFromCheckpoint', 'checkAndFixStuckPlayer', 'onPlayerDeath',
    'enterLevelCompletionState', 'shutdown'];
const methods = Object.fromEntries(cls.body.body.filter(node => names.includes(node.key?.name)).map(node => [
    node.key.name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
        {}, { log() {}, warn() {} })
]));

// Real Phaser Clock/TimerEvent, with fake scene services and tween ownership.
// No Phaser Game, browser, WebGL, audio, player records or backend is started.
function fixture() {
    const events = new EventEmitter(), activeTweens = new Set(), allTweens = [];
    const scene = { ...methods, sys: { events }, events, health: 4, maxHealth: 4,
        maxCrystalEnergy: 5, crystalEnergy: 5, invincibilityDuration: 1500,
        isInvincible: false, isPlayerDead: false, isRespawning: false, guardRecoveryUntil: 0,
        checkpointPosition: { x: 150, y: 500 }, levelHeight: 900,
        resetPlatformerRecoveryInput: jest.fn(), armCenteringStance: jest.fn(),
        clearDeathScreen: jest.fn(), showPlatformerMobileControls: jest.fn(),
        updateHealthDisplay: jest.fn(), updateEnergyDisplay: jest.fn(),
        showFloatingText: jest.fn(), resumeFailureRecoveryClock: jest.fn(),
        physics: { resume: jest.fn(), pause: jest.fn() }, input: { keyboard: { enabled: true, off: jest.fn() } },
        cameras: { main: { shakeEffect: { reset: jest.fn() } } },
        onPlayerDeath: jest.fn(function() { this.isPlayerDead = true; }),
        tweens: { add(config) {
            const tween = { ...config, stop: jest.fn(() => activeTweens.delete(tween)) };
            activeTweens.add(tween); allTweens.push(tween); return tween;
        } }
    };
    function player() {
        const object = { active: true, x: 150, y: 500, alpha: 1, facingRight: true,
            body: { enable: true, embedded: false, blocked: {}, velocity: { x: 0, y: 0 } } };
        object.setPosition = jest.fn((x, y) => { Object.assign(object, { x, y }); return object; });
        object.setVelocity = jest.fn((x, y) => { Object.assign(object.body.velocity, { x, y }); return object; });
        object.setAlpha = jest.fn(value => { object.alpha = value; return object; });
        object.setScale = jest.fn(() => object);
        object.setTint = jest.fn(() => object);
        object.clearTint = jest.fn(() => object);
        return object;
    }
    scene.player = player();
    const clock = new Clock(scene); scene.time = clock;
    for (const name of ['hidePlatformerMobileControls', 'clearVirtualJumpInput', 'showDeathScreen',
        'cleanupPlatformerInputHandlers', 'destroyGeneratedVideoReadyNotice', 'clearGeneratedVideoPlayback',
        'clearCurrentEcologyModal', 'clearCurrentEcologyNode', 'clearAutonomousRescueMoment', 'clearMobileControlCoach',
        'clearTraversalLandingGuides', 'cancelGuardianTransitions', 'clearGuardianGateState',
        'destroyPlatformerMobileControls', 'destroyGuardianTeamSupportEcho']) scene[name] = jest.fn();
    scene.pauseFailureRecoveryClock = () => { clock.paused = true; };
    scene.tweens.killAll = jest.fn(() => activeTweens.clear());
    const advance = delta => { clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate(); };
    return { scene, clock, activeTweens, allTweens, player, advance,
        close() { scene.endInvincibility(); clock.destroy(); } };
}

test.each(['respawn', 'retry'])('an earlier hit cannot end a newer %s protection period', recovery => {
    const f = fixture();
    try {
        f.scene.takeDamage(1); f.advance(1000);
        if (recovery === 'retry') f.scene.retryFromCheckpoint(); else f.scene.respawnAtCheckpoint();
        f.advance(500);
        expect(f.scene.isInvincible).toBe(true);
        expect(f.activeTweens.size).toBe(1);
        const health = f.scene.health;
        f.scene.takeDamage(1);
        expect(f.scene.health).toBe(health);
        f.advance(999); expect(f.scene.isInvincible).toBe(true);
        f.advance(1); expect(f.scene.isInvincible).toBe(false);
        expect(f.activeTweens.size).toBe(0);
        expect(f.scene.player.alpha).toBe(1);
    } finally { f.close(); }
});

test('100 repeated checkpoint recoveries own only one protection timer and flash', () => {
    const f = fixture();
    try {
        for (let index = 0; index < 100; index++) {
            f.scene.respawnAtCheckpoint(); f.advance(10);
            expect(f.activeTweens.size).toBe(1);
        }
        f.advance(1500); f.advance(1);
        expect(f.scene.isInvincible).toBe(false);
        expect(f.activeTweens.size).toBe(0);
        expect(f.clock._active.length + f.clock._pendingInsertion.length + f.clock._pendingRemoval.length).toBe(0);
    } finally { f.close(); }
});

test('a retired timer callback cannot end a newer period or alter a replacement player', () => {
    const f = fixture();
    try {
        f.scene.respawnAtCheckpoint(); f.clock.preUpdate();
        const old = f.clock._active.find(event => event.delay === 1500);
        f.advance(100);
        const previous = f.scene.player;
        f.scene.player = f.player(); f.scene.respawnAtCheckpoint();
        const currentTween = f.scene.invincibilityTween;
        const previousAlphaCalls = previous.setAlpha.mock.calls.length;
        const currentAlphaCalls = f.scene.player.setAlpha.mock.calls.length;
        old.callback.apply(old.callbackScope, old.args);
        expect(f.scene.isInvincible).toBe(true);
        expect(f.scene.invincibilityTween).toBe(currentTween);
        expect(previous.setAlpha.mock.calls.length).toBe(previousAlphaCalls);
        expect(f.scene.player.setAlpha.mock.calls.length).toBe(currentAlphaCalls);
    } finally { f.close(); }
});

test('a 500ms stuck rescue cannot shorten an existing 1500ms recovery', () => {
    const f = fixture();
    try {
        f.scene.respawnAtCheckpoint(); f.advance(100);
        Object.assign(f.scene.player.body, { embedded: true, blocked: { down: true, left: true } });
        f.scene.stuckFrameCount = 30;
        f.scene.checkAndFixStuckPlayer();
        f.advance(500);
        expect(f.scene.isInvincible).toBe(true);
        f.advance(900); expect(f.scene.isInvincible).toBe(false);
        expect(f.activeTweens.size).toBe(0);
    } finally { f.close(); }
});

test.each([1, 0.5])('protection uses remaining simulation time across pause and timeScale %s', scale => {
    const f = fixture();
    try {
        f.clock.timeScale = scale;
        f.scene.respawnAtCheckpoint(); f.clock.preUpdate();
        f.clock.paused = true; f.advance(20000);
        f.scene.beginInvincibility(500, { flash: false });
        expect(f.scene.isInvincible).toBe(true);
        f.clock.paused = false;
        f.advance(1499 / scale); expect(f.scene.isInvincible).toBe(true);
        f.advance(1 / scale); expect(f.scene.isInvincible).toBe(false);
        expect(f.activeTweens.size).toBe(0);
    } finally { f.close(); }
});

test('stuck rescue alone retains its existing short non-flashing protection', () => {
    const f = fixture();
    try {
        Object.assign(f.scene.player.body, { embedded: true, blocked: { down: true, left: true } });
        f.scene.stuckFrameCount = 30; f.scene.checkAndFixStuckPlayer();
        expect(f.scene.isInvincible).toBe(true); expect(f.activeTweens.size).toBe(0);
        f.advance(499); expect(f.scene.isInvincible).toBe(true);
        f.advance(1); expect(f.scene.isInvincible).toBe(false);
    } finally { f.close(); }
});

test.each(['death', 'completion', 'shutdown'])('%s retires protection before a captured timer can run late', reason => {
    const f = fixture();
    try {
        f.scene.respawnAtCheckpoint(); f.clock.preUpdate();
        const timer = f.clock._active[0], callback = timer.callback;
        if (reason === 'death') methods.onPlayerDeath.call(f.scene);
        else if (reason === 'completion') f.scene.enterLevelCompletionState();
        else f.scene.shutdown();
        expect(f.scene.isInvincible).toBe(false); expect(f.activeTweens.size).toBe(0);
        expect(f.scene.invincibilityPeriod).toBeNull();
        const current = f.scene.player;
        const alphaCalls = current?.setAlpha.mock.calls.length;
        callback();
        expect(f.scene.invincibilityPeriod).toBeNull();
        expect(current?.setAlpha.mock.calls.length).toBe(alphaCalls);
        if (reason === 'death') expect(current.alpha).toBe(0);
    } finally { f.close(); }
});

test('installed TweenManager removes retired infinite flashes and leaves alpha stable after expiry', () => {
    const f = fixture(), manager = new TweenManager(f.scene);
    f.scene.tweens = manager;
    manager.getDelta = () => 20;
    try {
        for (let index = 0; index < 100; index++) {
            f.scene.respawnAtCheckpoint(); f.advance(10); manager.step(true);
            expect(manager.tweens.length).toBe(1);
        }
        f.advance(1500); manager.step(true);
        expect(manager.tweens.length).toBe(0);
        expect(f.scene.player.alpha).toBe(1);
        for (let index = 0; index < 20; index++) manager.step(true);
        expect(f.scene.player.alpha).toBe(1);
    } finally { f.close(); manager.destroy(); }
});

test.each(['dead', 'complete', 'retired', 'invalid-duration'])('cannot arm protection while %s', state => {
    const f = fixture();
    try {
        if (state === 'dead') f.scene.isPlayerDead = true;
        if (state === 'complete') f.scene.levelCompletionActive = true;
        if (state === 'retired') f.scene.player.active = false;
        expect(f.scene.beginInvincibility(state === 'invalid-duration' ? NaN : 1500)).toBe(false);
        expect(f.scene.isInvincible).toBe(false);
        expect(f.activeTweens.size).toBe(0);
        expect(f.clock._pendingInsertion.length).toBe(0);
    } finally { f.close(); }
});

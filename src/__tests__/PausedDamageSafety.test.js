const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const World = require('phaser/src/physics/arcade/World');

const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const names = ['takeDamage', 'onPitFall'];

// Native Clock and physics pause, inert drawing/feedback, no Game or renderer.
function fixture() {
    const feedback = { AudioManager: { playError: jest.fn(), playAchievement: jest.fn() } };
    const scene = Object.fromEntries(cls.body.body.filter(node => names.includes(node.key?.name)).map(node => [
        node.key.name, new Function('window', 'console', `return ({${source.slice(node.start, node.end)}}).${node.key.name};`)(
            feedback, { log() {} })
    ]));
    const events = new EventEmitter();
    Object.assign(scene, { events, sys: { events, scale: { width: 390, height: 844 }, isActive: () => true },
        health: 3, maxHealth: 3, damageTaken: 0, guardRecoveryUntil: 0, invincibilityDuration: 1500,
        isInvincible: false, isPlayerDead: false, isRespawning: false, pauseMenuActive: false,
        resetPlatformerRecoveryInput: jest.fn(), attemptAutonomousCreatureRescue: jest.fn(() => false),
        updateHealthDisplay: jest.fn(), updateKatanaUpgradeDisplay: jest.fn(), beginGuardRecovery: jest.fn(),
        onOptionalRouteGuardConsumed: jest.fn(), pulseGuardianTeamSupportEcho: jest.fn(),
        showFloatingText: jest.fn(), armCenteringStance: jest.fn(), beginInvincibility: jest.fn(),
        onPlayerDeath: jest.fn(), cameras: { main: { width: 390, height: 844 } } });
    const player = scene.player = { x: 100, y: 200, facingRight: true,
        setTint: jest.fn(), clearTint: jest.fn(), setVelocity: jest.fn() };
    const clock = scene.time = new Clock(scene);
    const world = new World(scene, { gravity: { y: 500 }, debug: false });
    scene.physics = { world };
    scene.add = { graphics: () => {
        const object = {};
        for (const name of ['fillStyle', 'fillRect', 'setScrollFactor', 'setDepth', 'destroy']) object[name] = jest.fn(() => object);
        return object;
    } };
    const chargeFields = ['optionalRouteGuardCharges', 'powerupShieldHits', 'guardianShieldHitsRemaining',
        'guardianGuardCharges', 'communityGuardCharges', 'auroraGuardCharges'];
    return { scene, world, clock, player, feedback, chargeFields,
        close() { clock.destroy(); world.shutdown(); events.removeAllListeners(); } };
}

const states = {
    menu: f => { f.scene.pauseMenuActive = true; },
    'paused physics': f => { f.world.pause(); },
    'paused clock': f => { f.clock.paused = true; },
    'inactive scene': f => { f.scene.sys.isActive = () => false; },
    'checkpoint recovery': f => { f.scene.isRespawning = true; }
};

describe('player health and expedition guards cannot be spent behind paused play', () => {
    test.each(Object.entries(states))('%s ignores ordinary and forced damage before feedback or accounting', (_name, stop) => {
        const f = fixture();
        try {
            stop(f);
            f.scene.takeDamage(1); f.scene.takeDamage(1, true);
            expect(f.scene.health).toBe(3); expect(f.scene.damageTaken).toBe(0);
            expect(f.scene.updateHealthDisplay).not.toHaveBeenCalled();
            expect(f.scene.beginInvincibility).not.toHaveBeenCalled();
            expect(f.scene.onPlayerDeath).not.toHaveBeenCalled();
            expect(f.player.setVelocity).not.toHaveBeenCalled();
            expect(f.feedback.AudioManager.playError).not.toHaveBeenCalled();
            expect(f.clock._pendingInsertion).toHaveLength(0);
        } finally { f.close(); }
    });

    test.each(['optionalRouteGuardCharges', 'powerupShieldHits', 'guardianGuardCharges', 'communityGuardCharges', 'auroraGuardCharges'])(
        'the pause menu cannot spend %s', field => {
            const f = fixture();
            try {
                f.scene[field] = 2;
                f.scene.guardianShieldHitsRemaining = field === 'powerupShieldHits' ? 2 : 0;
                f.scene.guardianTeamSupport = { abilityName: 'Synthetic guard' };
                f.scene.optionalRouteGuardLabel = 'Synthetic guard';
                const before = f.chargeFields.map(key => f.scene[key]);
                f.scene.pauseMenuActive = true;
                f.scene.takeDamage(1);
                expect(f.chargeFields.map(key => f.scene[key])).toEqual(before);
                expect(f.scene.beginGuardRecovery).not.toHaveBeenCalled();
                expect(f.scene.showFloatingText).not.toHaveBeenCalled();
                expect(f.feedback.AudioManager.playAchievement).not.toHaveBeenCalled();
                f.scene.pauseMenuActive = false;
                f.scene.takeDamage(1);
                expect(f.scene[field]).toBe(1);
                expect(f.scene.beginGuardRecovery).toHaveBeenCalledTimes(1);
                expect(f.scene.health).toBe(3);
            } finally { f.close(); }
        }
    );

    test.each(Object.entries(states))('%s cannot charge a pit heart or start recovery work', (_name, stop) => {
        const f = fixture();
        try {
            stop(f);
            const recovering = f.scene.isRespawning;
            f.scene.onPitFall();
            expect(f.scene.health).toBe(3);
            expect(f.scene.isRespawning).toBe(recovering);
            expect(f.scene.resetPlatformerRecoveryInput).not.toHaveBeenCalled();
            expect(f.scene.updateHealthDisplay).not.toHaveBeenCalled();
            expect(f.clock._pendingInsertion).toHaveLength(0);
        } finally { f.close(); }
    });

    test.each(['isPlayerDead', 'levelCompletionActive'])('a %s world cannot charge another pit heart', field => {
        const f = fixture();
        try {
            f.scene[field] = true;
            f.scene.onPitFall();
            expect(f.scene.health).toBe(3);
            expect(f.scene.isRespawning).toBe(false);
            expect(f.scene.onPlayerDeath).not.toHaveBeenCalled();
            expect(f.scene.resetPlatformerRecoveryInput).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('normal resumed damage keeps its existing health, protection, feedback and knockback', () => {
        const f = fixture();
        try {
            f.scene.pauseMenuActive = true;
            f.scene.takeDamage(1);
            f.scene.pauseMenuActive = false;
            f.scene.takeDamage(1);
            expect(f.scene.health).toBe(2); expect(f.scene.damageTaken).toBe(1);
            expect(f.scene.updateHealthDisplay).toHaveBeenCalledTimes(1);
            expect(f.scene.beginInvincibility).toHaveBeenCalledTimes(1);
            expect(f.player.setVelocity).toHaveBeenCalledWith(-200, -150);
            expect(f.feedback.AudioManager.playError).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('ordinary invincibility and forced pit-style damage retain their existing difference when playing', () => {
        const f = fixture();
        try {
            f.scene.isInvincible = true;
            f.scene.takeDamage(1);
            expect(f.scene.health).toBe(3);
            f.scene.takeDamage(1, true);
            expect(f.scene.health).toBe(2);
        } finally { f.close(); }
    });

    test('a normal lethal pit still charges exactly one heart and opens death recovery', () => {
        const f = fixture();
        try {
            f.scene.health = 1;
            f.scene.onPitFall();
            expect(f.scene.health).toBe(0);
            expect(f.scene.isRespawning).toBe(false);
            expect(f.scene.onPlayerDeath).toHaveBeenCalledTimes(1);
            expect(f.scene.updateHealthDisplay).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('a normal non-lethal pit retains its 300ms recovery and cannot charge twice before respawn', () => {
        const f = fixture();
        try {
            f.scene.respawnAtCheckpoint = jest.fn(() => { f.scene.isRespawning = false; });
            f.scene.onPitFall();
            expect(f.scene.health).toBe(2); expect(f.scene.isRespawning).toBe(true);
            f.scene.onPitFall(); f.scene.takeDamage(1);
            expect(f.scene.health).toBe(2);
            f.clock.preUpdate(); f.clock.update(299, 299); f.clock.preUpdate();
            expect(f.scene.respawnAtCheckpoint).not.toHaveBeenCalled();
            f.clock.update(300, 1); f.clock.preUpdate();
            expect(f.scene.respawnAtCheckpoint).toHaveBeenCalledTimes(1);
            expect(f.scene.isRespawning).toBe(false);
            expect(f.scene.updateHealthDisplay).toHaveBeenCalledTimes(1);
            f.scene.takeDamage(1);
            expect(f.scene.health).toBe(1);
        } finally { f.close(); }
    });
});

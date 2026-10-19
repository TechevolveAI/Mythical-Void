const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');

const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration');

// Actual Forest hit/defeat methods and installed Clock; scene, drawing,
// restoration and service boundaries are fictional. No game or saves run.
function fixture() {
    const services = { FeedbackManager: { cameraFlash: jest.fn() },
        FXLibrary: { stardustBurst: jest.fn() }, AudioManager: { playAttack: jest.fn() } };
    const trace = [], completions = [];
    const actor = () => {
        const value = { active: true, x: 5800, y: 1060, body: { setAllowGravity: jest.fn() } };
        for (const name of ['setVelocity', 'setY', 'clearTint', 'setTint']) value[name] = jest.fn(() => value);
        return value;
    };
    const scene = { events: new EventEmitter(), boss: actor(), player: actor(),
        bossHealth: 4, bossMaxHealth: 18, bossPhase: 2, bossFightActive: true,
        bossEntranceComplete: true, bossPhaseAttackCount: 1, forestBossNextHitAt: 0,
        forestBossHits: 0, forestRecoveryDamage: 0, bossTargetScale: 1,
        updateBossHealthBar: jest.fn(), requestForestBossPhase2: jest.fn(),
        bossInstructionText: { setText: jest.fn() }, bossCorruptionText: { setText: jest.fn() },
        astronautFollower: { setContextualFormation: jest.fn() }, bossUI: {},
        combatJuice: { registerHit: jest.fn(), screenShake: jest.fn(), hitFlash: jest.fn(), hitStop: jest.fn() },
        showFloatingText: jest.fn(), clearForestBossPacing: jest.fn(),
        enterLevelCompletionState: jest.fn(() => { scene.levelCompletionActive = true; trace.push('freeze'); }),
        continueAfterForestRestoration: jest.fn(), tweens: { add: jest.fn() },
        showForestRestorationSequence: jest.fn(({ onComplete }) => {
            trace.push('restoration'); completions.push(onComplete); return true;
        }) };
    scene.boss.isRecovering = true;
    scene.sys = { events: scene.events };
    const clock = scene.time = new Clock(scene);
    for (const name of ['damageBoss', 'onBossDefeated']) {
        const node = declaration.body.body.find(node => node.key.name === name);
        scene[name] = new Function('window', 'console',
            `return ({${source.slice(node.start, node.end)}}).${name};`)(services, { log() {} });
    }
    return { scene, services, trace, completions, actor, clock,
        advance(delta) { clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate(); },
        close() { clock.destroy(); } };
}

describe('Forest finishing hits cannot be consumed by optional presentation', () => {
    test.each(['instruction', 'health-bar', 'combo', 'text', 'shake', 'flash', 'hit-stop', 'sound'])(
        'a failed %s still reaches the earned restoration exactly once', failure => {
            const f = fixture();
            try {
                const fail = () => { throw Error('SYNTHETIC_OPTIONAL_FAILURE'); };
                const targets = { instruction: f.scene.bossInstructionText.setText,
                    'health-bar': f.scene.updateBossHealthBar, combo: f.scene.combatJuice.registerHit,
                    text: f.scene.showFloatingText, shake: f.scene.combatJuice.screenShake,
                    flash: f.scene.combatJuice.hitFlash, 'hit-stop': f.scene.combatJuice.hitStop,
                    sound: f.services.AudioManager.playAttack };
                targets[failure].mockImplementation(fail);
                expect(() => expect(f.scene.damageBoss(3)).toBe(true)).not.toThrow();
                expect(f.scene.bossHealth).toBe(0);
                expect(f.scene.bossDefeated).toBe(true);
                expect(f.scene.damageBoss(3)).toBe(false);
                expect(f.scene.showForestRestorationSequence).toHaveBeenCalledTimes(1);
                f.completions[0](); expect(f.scene.continueAfterForestRestoration).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        }
    );

    test.each(['formation', 'corruption-label', 'clear-tint', 'tint', 'camera', 'particles', 'text', 'bar-fade'])(
        'a failed victory %s cannot skip the established restoration', failure => {
            const f = fixture();
            try {
                const fail = () => { throw Error('SYNTHETIC_OPTIONAL_FAILURE'); };
                const targets = { formation: f.scene.astronautFollower.setContextualFormation,
                    'corruption-label': f.scene.bossCorruptionText.setText, 'clear-tint': f.scene.boss.clearTint,
                    tint: f.scene.boss.setTint, camera: f.services.FeedbackManager.cameraFlash,
                    particles: f.services.FXLibrary.stardustBurst, text: f.scene.showFloatingText,
                    'bar-fade': f.scene.tweens.add };
                targets[failure].mockImplementation(fail);
                expect(() => f.scene.onBossDefeated()).not.toThrow();
                expect(f.scene.showForestRestorationSequence).toHaveBeenCalledTimes(1);
                expect(f.scene.enterLevelCompletionState).toHaveBeenCalledTimes(1);
                f.completions[0](); expect(f.scene.continueAfterForestRestoration).toHaveBeenCalledTimes(1);
            } finally { f.close(); }
        }
    );

    test.each(['boss', 'player'])('a feedback callback replacing the %s cannot continue into another fight', binding => {
        const f = fixture();
        try {
            const replacement = f.actor();
            f.scene.updateBossHealthBar.mockImplementation(() => {
                f.scene[binding] = replacement; f.scene.bossHealth = 18;
            });
            expect(f.scene.damageBoss(3)).toBe(false);
            expect(f.scene.bossHealth).toBe(18);
            expect(f.scene.showForestRestorationSequence).not.toHaveBeenCalled();
            expect(f.scene.combatJuice.registerHit).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('retirement during victory feedback cannot move a replacement into the old restoration', () => {
        const f = fixture();
        try {
            f.services.FeedbackManager.cameraFlash.mockImplementation(() => { f.scene.player = f.actor(); });
            f.scene.onBossDefeated();
            expect(f.services.FXLibrary.stardustBurst).not.toHaveBeenCalled();
            expect(f.scene.showForestRestorationSequence).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test.each(['replacement', 'restored'])('fallback tint completion cannot repaint a %s Guardian', change => {
        const f = fixture();
        try {
            f.scene.combatJuice = null; f.scene.bossHealth = 18;
            expect(f.scene.damageBoss(1)).toBe(true);
            if (change === 'replacement') f.scene.boss = f.actor();
            else f.scene.onBossDefeated();
            const calls = f.scene.boss.clearTint.mock.calls.length;
            f.advance(100);
            expect(f.scene.boss.clearTint).toHaveBeenCalledTimes(calls);
        } finally { f.close(); }
    });

    test('ordinary fallback still clears after100ms during its own battle', () => {
        const f = fixture();
        try {
            f.scene.combatJuice = null; f.scene.bossHealth = 18;
            expect(f.scene.damageBoss(1)).toBe(true);
            expect(f.scene.boss.setTint).toHaveBeenCalledWith(0x8B2FC9);
            f.advance(99); expect(f.scene.boss.clearTint).not.toHaveBeenCalled();
            f.advance(1); expect(f.scene.boss.clearTint).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('normal damage, freeze, restoration payload and one final sound remain', () => {
        const f = fixture();
        try {
            expect(f.scene.damageBoss(3)).toBe(true);
            expect(f.scene.bossHealth).toBe(0); expect(f.scene.forestRecoveryDamage).toBe(4);
            expect(f.scene.forestBossNextHitAt).toBe(400); expect(f.scene.forestBossHits).toBe(1);
            expect(f.trace).toEqual(['freeze', 'restoration']);
            expect(f.scene.boss.setTint).toHaveBeenCalledWith(0x8FE3CF);
            expect(f.services.FeedbackManager.cameraFlash).toHaveBeenCalledWith(f.scene, 600, 143, 227, 207);
            expect(f.services.FXLibrary.stardustBurst).toHaveBeenCalledWith(f.scene, 5800, 1060,
                { count: 35, color: [0x8FE3CF, 0x90EE90, 0xFFFFFF], duration: 1800 });
            expect(f.services.AudioManager.playAttack).toHaveBeenCalledTimes(1);
            expect(f.scene.damageBoss(3)).toBe(false);
            expect(f.scene.showForestRestorationSequence).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });

    test('required defeat failure remains visible, not reclassified as optional feedback', () => {
        const f = fixture();
        try {
            f.scene.onBossDefeated = () => { throw Error('SYNTHETIC_REQUIRED_DEFEAT_FAILURE'); };
            expect(() => f.scene.damageBoss(3)).toThrow('SYNTHETIC_REQUIRED_DEFEAT_FAILURE');
        } finally { f.close(); }
    });

    test('required restoration setup failure remains visible', () => {
        const f = fixture();
        try {
            f.scene.showForestRestorationSequence.mockImplementation(() => { throw Error('SYNTHETIC_REQUIRED_RESTORATION_FAILURE'); });
            expect(() => f.scene.onBossDefeated()).toThrow('SYNTHETIC_REQUIRED_RESTORATION_FAILURE');
            expect(f.scene.continueAfterForestRestoration).not.toHaveBeenCalled();
        } finally { f.close(); }
    });
});

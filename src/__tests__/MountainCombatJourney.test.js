const { fixture } = require('./support/mountainEncounterFixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

function combat({ phone = true } = {}) {
    const f = fixture(), { scene } = f;
    const drawing = (x = 0, y = 0) => {
        const value = f.object(x, y);
        for (const name of ['lineStyle', 'fillStyle', 'strokeCircle', 'fillRect', 'fillTriangle', 'lineBetween']) {
            value[name] = jest.fn(() => value);
        }
        value.setText = jest.fn(() => value);
        return value;
    };
    scene.add.graphics = jest.fn(() => drawing());
    const camera = { width: phone ? 390 : 1280, height: phone ? 844 : 720, scrollX: 0,
        panEffect: { reset: jest.fn() }, centerOn: jest.fn(), stopFollow: jest.fn(), startFollow: jest.fn() };
    Object.assign(scene, { cameras: { main: camera }, levelWidth: 8000,
        cameraLeadAmount: 120, cameraBaseOffsetY: 0, isMobile: phone,
        bossCombatReady: false, bossHealth: 24, bossMaxHealth: 24,
        titanAttackIndex: 0, titanRecoveryDamage: 0, titanRecoveryUntil: 0,
        titanAttacksCompleted: 0, titanLastHitAt: -Infinity,
        resetJoystick: jest.fn(), releaseAllPlatformerActionButtons: jest.fn(), clearVirtualJumpInput: jest.fn(),
        updateBossHealthBar: jest.fn(), bossSubtitle: drawing(), bossNameText: drawing(),
        bossPressureText: drawing(), bossHealthBar: drawing(),
        scheduleGuardianTransition: jest.fn(() => ({})) });
    scene.input.keyboard.resetKeys = jest.fn();
    for (const actor of [scene.boss, scene.player]) {
        actor.getBounds = () => ({ left: actor.x - actor.displayWidth / 2, right: actor.x + actor.displayWidth / 2 });
        actor.setTint = jest.fn(() => actor);
        actor.clearTint = jest.fn(() => actor);
    }
    const step = delta => { f.advance(delta); scene.updateDeferredTitanCombat?.(); };
    const until = (condition, limit = 20000) => {
        for (let elapsed = 0; !condition() && elapsed < limit; elapsed += 20) step(20);
        expect(condition()).toBe(true);
    };
    return { ...f, camera, drawing, step, until,
        close() { scene.bossAttackTimer?.remove(false); scene.bossAttackPreviewTimer?.remove(false);
            scene.titanWarningTimer?.remove(false); scene.titanAttackUnlockTimer?.remove(false);
            scene.titanPhaseRecoveryTimer?.remove(false); f.close(); } };
}

describe('joined mountain combat controls', () => {
    test('the real scene update services the handoff and lifecycle hooks clear it', () => {
        const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js'), 'utf8');
        const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
        const text = name => {
            const node = cls.body.body.find(node => node.key?.name === name || node.kind === name);
            return source.slice(node.start, node.end);
        };
        const update = text('update');
        expect(update.indexOf('this.updateDeferredTitanCombat()')).toBeGreaterThan(update.indexOf('super.update(time, delta)'));
        expect(update.indexOf('this.updateDeferredTitanCombat()')).toBeLessThan(update.indexOf('if (this.levelCompletionActive) return'));
        for (const name of ['constructor', 'init', 'startBossFight', 'shutdown']) {
            expect(text(name)).toContain('this.deferredTitanCombat = null');
        }
    });

    test.each([true, false])('real opening, attacks, phase and victory handoff with phone framing=%s', phone => {
        const f = combat({ phone }), { scene } = f;
        const attacks = jest.spyOn(scene, 'executeTitanAttack');
        const phase = jest.spyOn(scene, 'enterTitanPhase');
        try {
            f.world.pause();
            expect(scene.beginTitanCombat()).toBe(true);
            expect(f.world.isPaused).toBe(false);
            expect(scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
            expect(scene.titanOpeningCameraFraming).toBe(phone);
            expect(scene.damageBoss(100)).toBe(false);
            f.step(1199); expect(attacks).not.toHaveBeenCalled();
            f.step(1); expect(scene.titanAttackLocked).toBe(true);
            const originalX = scene.boss.x;
            f.step(1); f.step(350);
            expect(scene.boss.x).toBeGreaterThan(originalX);
            expect(scene.damageBoss(100)).toBe(false);

            for (let opening = 0; opening < 6; opening++) {
                f.until(() => scene.titanRecoveryUntil > f.clock.now && !scene.titanPhaseRecoveryTimer && scene.titanRecoveryDamage === 0);
                expect(scene.damageBoss(100)).toBe(true);
                expect(scene.bossHealth).toBe(24 - (opening + 1) * 4);
                expect(scene.damageBoss(100)).toBe(false);
                if (opening < 5) {
                    const completed = scene.titanAttacksCompleted;
                    f.until(() => scene.titanAttacksCompleted > completed);
                }
            }
            expect(attacks.mock.calls.map(args => args[0])).toEqual(expect.arrayContaining(['gravityCrush', 'starRain', 'voidPunch', 'singularity']));
            expect(phase).toHaveBeenCalledTimes(1); expect(phase).toHaveBeenCalledWith(3);
            expect(scene.bossDefeated).toBe(true); expect(scene.bossFightActive).toBe(false);
            expect(scene.boss.body.enable).toBe(false);
            expect(scene.commitPeakVictory).toHaveBeenCalledTimes(1);
            expect(scene.scheduleGuardianTransition).toHaveBeenCalledWith('peaks-saved-victory', 1800, expect.any(Function));
            expect(scene.bossEncounterEffects.size).toBe(0); f.onlyPersistent();
        } finally { f.close(); }
    });

    test.each(['death', 'pause-menu', 'clock-pause'])('an intro handoff cannot resume combat through %s', reason => {
        const f = combat(), { scene } = f;
        try {
            f.world.pause();
            if (reason === 'death') scene.onPlayerDeath();
            if (reason === 'pause-menu') scene.pauseMenuActive = true;
            if (reason === 'clock-pause') f.clock.paused = true;
            expect(scene.beginTitanCombat()).toBe(false);
            expect(scene.bossCombatReady).toBe(false);
            expect(f.world.isPaused).toBe(true);
            expect(scene.showPlatformerMobileControls).not.toHaveBeenCalled();
            if (reason === 'death') scene.retryFromCheckpoint();
            else { scene.pauseMenuActive = false; f.clock.paused = false; }
            f.step(20);
            expect(scene.bossCombatReady).toBe(true);
            expect(f.world.isPaused).toBe(false);
            const controls = scene.showPlatformerMobileControls.mock.calls.length;
            f.step(20); expect(scene.showPlatformerMobileControls).toHaveBeenCalledTimes(controls);
            f.step(1200); expect(scene.titanAttackLocked).toBe(true);
        } finally { f.close(); }
    });

    test.each(['boss', 'player', 'body', 'plugin', 'encounter', 'clock', 'world', 'completion', 'defeat', 'fight-ended'])(
        'a deferred handoff is discarded after %s replacement or retirement', change => {
            const f = combat(), { scene } = f;
            try {
                scene.pauseMenuActive = true; f.world.pause();
                expect(scene.beginTitanCombat()).toBe(false);
                if (change === 'boss') scene.boss = f.actor(4890, 400);
                if (change === 'player') scene.player = f.actor();
                if (change === 'body') scene.player.body = f.actor().body;
                if (change === 'plugin') scene.scene = {};
                if (change === 'encounter') scene.guardianEncounter = { active: true };
                if (change === 'clock') scene.time = { paused: false };
                if (change === 'world') scene.physics.world = {};
                if (change === 'completion') scene.levelCompletionActive = true;
                if (change === 'defeat') scene.bossDefeated = true;
                if (change === 'fight-ended') scene.bossFightActive = false;
                scene.pauseMenuActive = false;
                expect(scene.updateDeferredTitanCombat()).toBe(false);
                expect(scene.deferredTitanCombat).toBeNull();
                expect(f.world.isPaused).toBe(true);
                expect(scene.showPlatformerMobileControls).not.toHaveBeenCalled();
            } finally { f.close(); }
        }
    );

    test('reinitialisation drops the pending handoff without starting combat', () => {
        const f = combat(), { scene } = f;
        try {
            scene.pauseMenuActive = true; f.world.pause();
            expect(scene.beginTitanCombat()).toBe(false);
            scene.init({}); scene.pauseMenuActive = false;
            expect(scene.updateDeferredTitanCombat()).toBe(false);
            expect(scene.deferredTitanCombat).toBeNull();
            expect(scene.showPlatformerMobileControls).not.toHaveBeenCalled();
        } finally { f.close(); }
    });

    test('a valid resumed handoff frames the current camera once after replacement', () => {
        const f = combat(), { scene } = f;
        try {
            scene.pauseMenuActive = true; f.world.pause();
            expect(scene.beginTitanCombat()).toBe(false);
            const camera = { ...f.camera, centerOn: jest.fn(), stopFollow: jest.fn() };
            scene.cameras.main = camera; scene.pauseMenuActive = false;
            expect(scene.updateDeferredTitanCombat()).toBe(true);
            expect(camera.centerOn).toHaveBeenCalledTimes(1);
            expect(f.camera.centerOn).not.toHaveBeenCalled();
            expect(scene.updateDeferredTitanCombat()).toBe(false);
            expect(scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
        } finally { f.close(); }
    });
});

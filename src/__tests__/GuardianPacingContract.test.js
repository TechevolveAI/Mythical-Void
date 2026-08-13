const fs = require('fs');
const path = require('path');

const LEVELS_DIR = path.join(__dirname, '../scenes/levels');

function readLevel(fileName) {
    return fs.readFileSync(path.join(LEVELS_DIR, fileName), 'utf8');
}

describe('guardian encounter pacing contracts', () => {
    test('Reef attacks warn before danger and end in a real damage opening', () => {
        const source = readLevel('ReefLevel.js');

        expect(source).toContain('createReefBossTelegraph({');
        expect(source).toContain('damageZone.body.enable = false;');
        expect(source).toContain('damageZone.body.enable = true;');
        expect(source).toContain("'CURRENT EXPOSED // STRIKE NOW'");
        expect(source).toContain(
            'const recoveryBonus = this.time.now < this.bossRecoveryUntil ? 1 : 0;'
        );
        expect(source).toContain('this.requestReefBossPhase(2);');
        expect(source).toContain('this.requestReefBossPhase(3);');
        expect(source).toContain('if (this.pendingBossPhase) {');
    });

    test('Reef echo summons use the shared readable combat contract', () => {
        const source = readLevel('ReefLevel.js');
        const createMinion = source.match(
            /createVoidMinion\(x, y\) \{([\s\S]*?)\n    \}\n\n    updateBoss/
        );

        expect(createMinion).not.toBeNull();
        expect(createMinion[1]).toContain('this.enemies.add(body);');
        expect(createMinion[1]).toContain('this.configureEnemyCombat(body, {');
        expect(createMinion[1]).not.toContain(
            'this.physics.add.overlap(this.player, body'
        );
    });

    test('Final Void resolves every attack as windup, hazard, then recovery', () => {
        const source = readLevel('FinalVoidLevel.js');

        expect(source).toContain('const FINAL_BOSS_ATTACK_PACING = Object.freeze({');
        expect(source).toContain('this.showFinalBossAttackTelegraph(pacing);');
        expect(source).toContain(
            'this.bossAttackWindupTimer = this.time.delayedCall(pacing.windup'
        );
        expect(source).toContain('pacing.activeWindow');
        expect(source).toContain('this.openFinalBossRecovery(850);');
        expect(source).toContain("'BEACON OPENING // STRIKE NOW'");
    });

    test('Final Void marks storm impacts and Oblivion safe space before damage', () => {
        const source = readLevel('FinalVoidLevel.js');

        expect(source).toContain('const groundMark = this.add.graphics()');
        expect(source).toContain('this.time.delayedCall(450, () => {');
        expect(source).toContain('const safeLane = this.add.graphics().setDepth(849);');
        expect(source).toContain('safeLane.fillStyle(0x8FE3CF, 0.14);');
    });

    test('Final Void clears pacing timers on defeat and shutdown', () => {
        const source = readLevel('FinalVoidLevel.js');

        expect(source).toContain('clearFinalBossPacingTimers() {');
        expect(source.match(/this\.clearFinalBossPacingTimers\(\);/g).length)
            .toBeGreaterThanOrEqual(2);
        expect(source).toContain('this.bossPhaseTransitionTimer?.remove?.();');
    });

    test('Final Void defers phase shifts until the active hazard resolves', () => {
        const source = readLevel('FinalVoidLevel.js');

        expect(source).toContain('requestFinalBossPhase(phase, message, tint) {');
        expect(source).toContain(
            'if (this.bossAttackWindupTimer || this.bossAttackResolutionTimer)'
        );
        expect(source).toContain(
            'this.pendingBossPhase = { phase, message, tint };'
        );
        expect(source).toContain('if (this.pendingBossPhase) {');
    });

    test.each([
        ['MythicalForestLevel.js', 'this.boss.isRecovering ? 1 : 0'],
        ['CrystalCavesLevel.js', 'this.boss.isRecovering ? 1 : 0'],
        ['VoidPeaksLevel.js', 'this.time.now < this.titanRecoveryUntil ? 1 : 0'],
        ['AuroraDepthsLevel.js', 'this.time.now < this.bossRecoveryUntil ? 1 : 0']
    ])('%s recovery cue provides bonus stabilization damage', (fileName, contract) => {
        expect(readLevel(fileName)).toContain(contract);
    });
});

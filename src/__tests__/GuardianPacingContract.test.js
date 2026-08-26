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

    test('Reef frames the mobile arena before enabling controls or attacks', () => {
        const source = readLevel('ReefLevel.js');

        expect(source).toContain('const REEF_GUARDIAN_ARENA = Object.freeze({');
        expect(source).toContain('stageReefGuardianArenaEntry() {');
        expect(source).toContain('this.player.body?.updateFromGameObject?.();');
        expect(source).toContain(
            "const arena = this.getTraversalSupport?.('reef-guardian-arena');"
        );
        expect(source).toContain(
            'this.player.y += arena.body.top - body.bottom - 4;'
        );
        expect(source).not.toMatch(
            /stageReefGuardianArenaEntry\(\)[\s\S]*?this\.player\.body\.reset\(/
        );
        expect(source).toMatch(
            /startBossFight\(\)[\s\S]*this\.hidePlatformerMobileControls\(\);[\s\S]*this\.stageReefGuardianArenaEntry\(\);/
        );
        expect(source).toContain('beginReefGuardianCombat(camera = this.cameras.main)');
        expect(source).toMatch(
            /beginReefGuardianCombat[\s\S]*this\.physics\.resume\(\);[\s\S]*this\.showPlatformerMobileControls\(\);[\s\S]*this\.startBossAI\(\);/
        );
        expect(source).toContain('!this.bossCombatReady ||');
        expect(source).toContain('openingGraceMs: 3000');
        expect(source).toContain('const NYXVORAL_MOBILE_DISPLAY_WIDTH = 300;');
        expect(source).toContain('camera.width * 0.2');
        expect(source).toContain('this.bossCombatReadyAt = this.time.now;');
        expect(source).toMatch(
            /this\.bossAttackPreviewTimer = this\.time\.delayedCall\([\s\S]*REEF_GUARDIAN_ARENA\.openingGraceMs/
        );
        expect(source).toContain('this.bossContactDamageConsumed = true;');
        expect(source).toContain(
            'this.takeDamage(REEF_GUARDIAN_ARENA.contactDamage);'
        );
        expect(source).toContain(
            'const targetX = this.player.body?.center?.x ?? this.player.x;'
        );
        expect(source).toContain(
            'const targetY = this.player.body?.center?.y ?? this.player.y;'
        );
        expect(source).toMatch(
            /if \(isMobileLayout\) \{\s*this\.cameras\.main\.setZoom\(1\);/
        );
        expect(source).toContain('this.bossAttackPreviewTimer?.remove?.();');
    });

    test('Crystal frames the mobile arena before enabling controls or attacks', () => {
        const source = readLevel('CrystalCavesLevel.js');

        expect(source).toContain(
            'const CRYSTAL_GUARDIAN_ARENA = Object.freeze({'
        );
        expect(source).toContain('stageCrystalGuardianArenaEntry() {');
        expect(source).toContain('this.player.body?.updateFromGameObject?.();');
        expect(source).toContain(
            "const arena = this.getTraversalSupport?.('caves-guardian-arena');"
        );
        expect(source).toContain(
            'this.player.y += arena.body.top - body.bottom - 4;'
        );
        expect(source).not.toMatch(
            /stageCrystalGuardianArenaEntry\(\)[\s\S]*?this\.player\.body\.reset\(/
        );
        expect(source).toMatch(
            /startBossFight\(\)[\s\S]*this\.hidePlatformerMobileControls\(\);[\s\S]*this\.stageCrystalGuardianArenaEntry\(\);/
        );
        expect(source).toContain(
            'beginCrystalGuardianCombat(camera = this.cameras.main)'
        );
        expect(source).toContain('openingGraceMs: 3000');
        expect(source).toContain(
            'const CRYSTAL_GUARDIAN_MOBILE_DISPLAY_HEIGHT = 170;'
        );
        expect(source).toContain('this.bossCombatReadyAt = this.time.now;');
        expect(source).toMatch(
            /beginCrystalGuardianCombat[\s\S]*this\.physics\.resume\(\);[\s\S]*this\.showPlatformerMobileControls\(\);[\s\S]*this\.startBossAI\(\);/
        );
        expect(source).toMatch(
            /if \(isMobileLayout\) \{\s*this\.cameras\.main\.setZoom\(1\);/
        );
        expect(source).toContain('!this.bossCombatReady ||');
        expect(source).toContain('this.bossAttackPreviewTimer?.remove?.();');
    });

    test('Void Peaks frames the Titan before enabling controls or attacks', () => {
        const source = readLevel('VoidPeaksLevel.js');

        expect(source).toContain('const TITAN_ARENA = Object.freeze({');
        expect(source).toContain('stageTitanArenaEntry() {');
        expect(source).toContain('this.player.body?.updateFromGameObject?.();');
        expect(source).toContain(
            "const arena = this.getTraversalSupport?.('peak-titan-gate');"
        );
        expect(source).toContain(
            'this.player.y += arena.body.top - body.bottom - 4;'
        );
        expect(source).not.toMatch(
            /stageTitanArenaEntry\(\)[\s\S]*?this\.player\.body\.reset\(/
        );
        expect(source).toMatch(
            /startBossFight\(\)[\s\S]*this\.hidePlatformerMobileControls\(\);[\s\S]*this\.stageTitanArenaEntry\(\);/
        );
        expect(source).toContain(
            'beginTitanCombat(camera = this.cameras.main)'
        );
        expect(source).toContain('openingGraceMs: 3000');
        expect(source).toContain(
            'const COSMIC_TITAN_MOBILE_DISPLAY_HEIGHT = 240;'
        );
        expect(source).toContain('this.bossCombatReadyAt = this.time.now;');
        expect(source).toContain('camera.width * 0.35');
        expect(source).toContain('this.clearGuardianGateState();');
        expect(source).toMatch(
            /beginTitanCombat[\s\S]*this\.physics\.resume\(\);[\s\S]*this\.showPlatformerMobileControls\(\);[\s\S]*this\.startTitanAttackLoop\(\);/
        );
        expect(source).toContain('!this.bossCombatReady ||');
        expect(source).toContain('this.bossAttackPreviewTimer?.remove?.();');
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

const fs = require('fs');
const path = require('path');

const levelPath = path.join(__dirname, '../scenes/levels/AuroraDepthsLevel.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

describe('fifth expedition rescue loop', () => {
    test('uses the shared one-shot lifecycle in normal and boss-preview modes', () => {
        const source = readLevel();
        const createMethod = source.match(
            /\n    create\(\)\s*\{([\s\S]*?)\n    \}\n\n    startTestMode/
        )?.[1] || '';
        const testMode = source.match(
            /startTestMode\(\)\s*\{([\s\S]*?)\n    \}\n\n    showLevelEntry/
        )?.[1] || '';
        const startLevel = source.match(
            /startLevel\(\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';

        expect(createMethod).toContain('super.create()');
        expect(createMethod).not.toContain('this.createLevelContent()');
        expect(testMode).toContain('this.startBossFight()');
        expect(testMode).not.toContain('this.spawnShadowPhoenix()');
        expect(testMode).not.toContain('this.createTestArenaPlatform()');
        expect(startLevel).toContain('this.createLevelSpecificContentOnce()');
        expect(startLevel).not.toContain('this.createLevelContent()');
    });

    test('builds an authored traversal route with visible shadow-current hazards', () => {
        const source = readLevel();

        expect(source).toContain('const ledges = [');
        expect(source).toContain("this.createPlatform(x, y, width, 28, 'one-way')");
        expect(source).toContain('this.createShadowCurrents()');
        expect(source).toContain('{ x: 810, width: 150 }');
        expect(source).toContain('{ x: 2020, width: 170 }');
        expect(source).toContain('{ x: 3230, width: 180 }');
        expect(source).toContain('this.takeDamage(1)');
    });

    test('places three full-height prisms with checkpoints and the exposure reveal', () => {
        const source = readLevel();

        expect(source).toContain("id: 'aurora_prism_1'");
        expect(source).toContain("id: 'aurora_prism_2'");
        expect(source).toContain("id: 'aurora_prism_3'");
        expect(source).toContain(
            'this.add.zone(\n                prism.x,\n                this.levelHeight / 2,\n                120,\n                this.levelHeight'
        );
        expect(source).toContain(
            'this.setCheckpoint(prism.x, this.levelHeight - 130, {'
        );
        expect(source).toContain('Project Beacon is carrying farther than expected.');
        expect(source).toContain('Your companion bends the signal down, away from the sky.');
        expect(source).toContain("Earth's symbol appears. Your companion stays beside you.");
        expect(source).toContain("event: 'beacon_exposure_risk_discovered'");
    });

    test('keeps the Phoenix shield closed until the uplink risk is understood', () => {
        const source = readLevel();
        const arena = source.match(
            /createBossArena\(\)\s*\{([\s\S]*?)\n    \}\n\n    startBossFight/
        )?.[1] || '';

        expect(arena).toContain('this.levelHeight / 2');
        expect(arena).toContain('this.levelHeight');
        expect(arena).toContain('if (!this.uplinkRiskUnderstood)');
        expect(arena).toContain('The Phoenix keeps its shield raised. Align the aurora prisms.');
        expect(arena).toContain('return;');
    });

    test('implements five collectible fragments and their optional egg reward', () => {
        const source = readLevel();

        expect(source).toContain('createAuroraFragments()');
        expect(source).toContain('this.collectAuroraFragment');
        expect(source).toContain('AURORA FRAGMENT ${this.starFragmentsCollected}/${this.totalStarFragments}');
        expect(source).toContain("id: 'quiet_aurora_egg'");
        expect(source).toContain("name: 'Quiet Aurora Egg'");
        expect(source).toContain('this.auroraEggAwarded = true');
    });

    test('uses stable responsive boss geometry and an off-screen Phoenix cue', () => {
        const source = readLevel();

        expect(source).toContain(
            'this.isMobile || screenWidth <= 480 || screenHeight < 620'
        );
        expect(source).toContain('const barY = isMobileLayout ? 118 : 60');
        expect(source).toContain('isShortLandscape ? 82 : 212');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
        expect(source).toContain('this.bossBarConfig = {');
        expect(source).toContain('this.createBossIndicator()');
        expect(source).toContain('this.updateBossIndicator()');
        expect(source).toContain("'PHOENIX >'");
        expect(source).toContain("'< PHOENIX'");
        expect(source).toContain('THE PHOENIX IS SHIELDING THE UPLINK');
        expect(source).toContain('Release the Void pressure');
    });

    test('prevents delayed damage after the guardian restoration begins', () => {
        const source = readLevel();
        const defeat = source.match(
            /onBossDefeated\(\)\s*\{([\s\S]*?)\n    \}\n\n    showBossVictory/
        )?.[1] || '';

        expect(source).toContain('if (!this.boss?.active || this.bossDefeated) return;');
        expect(source).toContain('if (this.bossDefeated)');
        expect(defeat).toContain('this.boss.body.enable = false');
        expect(defeat).toContain('this.bossBody.body.enable = false');
        expect(defeat).toContain('this.bossAITimer?.remove?.()');
        expect(defeat).toContain('PHOENIX SIGNAL STABLE');
    });

    test('uses a dedicated Phoenix combat body independent of transparent artwork', () => {
        const source = readLevel();
        const spawn = source.match(
            /spawnShadowPhoenix\(\)\s*\{([\s\S]*?)\n    \}\n\n    createBossAmbientEffects/
        )?.[1] || '';
        const update = source.match(
            /update\(time, delta\)\s*\{([\s\S]*?)\n    \}\n\n    createLevelContent/
        )?.[1] || '';

        expect(spawn).toContain(
            'this.bossBody = this.add.zone(spawnX, spawnY + 35, 160, 210)'
        );
        expect(spawn).toContain('this.physics.add.existing(this.bossBody)');
        expect(update).toContain(
            'this.bossBody.setPosition(this.boss.x, this.boss.y + 35)'
        );
        expect(source).toMatch(
            /shutdown\(\)[\s\S]*this\.bossBody\?\.destroy\?\.\(\)/
        );
    });

    test('keeps the isolated Phoenix preview inside basic attack range', () => {
        const source = readLevel();
        const testMode = source.match(
            /startTestMode\(\)\s*\{([\s\S]*?)\n    \}\n\n    getTestBossSpawnX/
        )?.[1] || '';
        const spawn = source.match(
            /spawnShadowPhoenix\(\)\s*\{([\s\S]*?)\n    \}\n\n    createBossAmbientEffects/
        )?.[1] || '';

        expect(testMode).toContain('this.getTestBossSpawnX() - 420');
        expect(testMode).toContain('this.levelHeight - 360');
        expect(spawn).toContain('? this.getTestBossSpawnX()');
    });

    test('restores the guardian and awards the canonical fifth ship system', () => {
        const source = readLevel();

        expect(source).toContain('AURORA PHOENIX RESTORED');
        expect(source).toContain('QUIET UPLINK READY');
        expect(source).toContain('Phoenix Gift: Aurora Reactor');
        expect(source).toContain('Exposure Risk: Confirmed');
        expect(source).toContain("achievementLevelId: 'auroraDepths'");
        expect(source).toContain("shipPartId: 'aurora_reactor'");
        expect(source).not.toContain('SHADOW PHOENIX EXTINGUISHED');
    });

    test('makes the expedition entry keyboard-accessible and single-fire', () => {
        const source = readLevel();
        const entry = source.match(
            /showLevelEntry\(\)\s*\{([\s\S]*?)\n    \}\n\n    clearLevelEntryKeyHandler/
        )?.[1] || '';

        expect(entry).toContain('if (this.levelEntryDismissing) return');
        expect(entry).toContain('enterBtn.disableInteractive()');
        expect(entry).toContain('overlay.disableInteractive()');
        expect(entry).toContain("if (!['Enter', ' '].includes(event.key)) return");
        expect(entry).toContain("window.addEventListener('keydown', this.levelEntryKeyHandler)");
        expect(source).toMatch(
            /shutdown\(\)[\s\S]*this\.clearLevelEntryKeyHandler\(\)/
        );
    });
});

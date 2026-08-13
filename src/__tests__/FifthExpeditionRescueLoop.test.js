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
        expect(testMode).toContain('this.showPlatformerMobileControls()');
        expect(testMode).not.toContain('this.spawnShadowPhoenix()');
        expect(testMode).not.toContain('this.createTestArenaPlatform()');
        expect(startLevel).toContain('this.createLevelSpecificContentOnce()');
        expect(startLevel).not.toContain('this.createLevelContent()');
    });

    test('builds an authored traversal route with visible shadow-current hazards', () => {
        const source = readLevel();

        expect(source).toContain('const ledges = [');
        expect(source).toContain("this.createPlatform(x, y, width, 28, 'one-way')");
        expect(source).toContain("[0, 810, 'aurora-ground-1']");
        expect(source).toContain("[3410, 1590, 'aurora-ground-4']");
        expect(source).toContain("'aurora-lower-prism'");
        expect(source).toContain("'aurora-heart-launch'");
        expect(source).toContain("'aurora-sky-prism'");
        expect(source).toContain("'aurora-phoenix-gate'");
        expect(source).toContain('this.createShadowCurrents()');
        expect(source).toContain('{ x: 810, width: 150 }');
        expect(source).toContain('{ x: 2020, width: 170 }');
        expect(source).toContain('{ x: 3230, width: 180 }');
        expect(source).toContain('this.takeDamage(1)');
    });

    test('places three localized prisms with checkpoints and the exposure reveal', () => {
        const source = readLevel();

        expect(source).toContain("id: 'aurora_prism_1'");
        expect(source).toContain("id: 'aurora_prism_2'");
        expect(source).toContain("id: 'aurora_prism_3'");
        expect(source).toContain(
            'this.createObjectiveTriggerZone(\n                prism.x,\n                prism.y - 35,\n                { width: 160, height: 210 }'
        );
        expect(source).toContain('activationSupportIds: [\'aurora-lower-prism\']');
        expect(source).toContain('activationSupportIds: [\'aurora-heart-launch\']');
        expect(source).toContain('activationSupportIds: [\'aurora-sky-prism\']');
        expect(source).toContain('this.isPlayerGroundedOnTraversalSupport(');
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain("mainSupportIds: ['aurora-ground-3']");
        expect(source).toContain("optionalSupportIds: ['aurora-quiet-step-1']");
        expect(source).toContain('rejoinSupportIds: [');
        expect(source).toContain('LAND ON THE LIT PLATFORM');
        expect(source).toContain('const companionName = this.getCompanionName()');
        expect(source).toContain('Project Beacon can reach Earth from here.');
        expect(source).toContain('If Earth hears this, anyone can. Help me turn it down.');
        expect(source).toContain('It is quiet. The choice can wait.');
        expect(source).toContain('EARTH CONTACT POSSIBLE // NOTHING TRANSMITTED');
        expect(source).toContain("event: 'beacon_exposure_risk_discovered'");
    });

    test('visibly refracts every aligned uplink beam down into the Fend', () => {
        const source = readLevel();

        expect(source).toContain('graphics.lineBetween(x, y - 50, x, y + 58)');
        expect(source).toContain('graphics.lineBetween(x, y + 58, x - 34, y + 92)');
        expect(source).not.toContain('graphics.lineBetween(x, y - 50, x, 50)');
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
        expect(source).toContain('isShortLandscape ? 76 : 72');
        expect(source).toContain('QUIET ALIGNMENT ${current}/3 // ${nextPrism}');
        expect(source).toContain('EARTH CAN BE REACHED BY CHOICE');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
        expect(source).toContain('this.bossBarConfig = {');
        expect(source).toContain('this.createBossIndicator()');
        expect(source).toContain('this.updateBossIndicator()');
        expect(source).toContain("'PHOENIX >'");
        expect(source).toContain("'< PHOENIX'");
        expect(source).toContain('THE PHOENIX IS SHIELDING THE UPLINK');
        expect(source).toContain('BREAK VOID PRESSURE // KEEP THE UPLINK QUIET');
    });

    test('frames the Phoenix encounter as containing exposure rather than harming an ally', () => {
        const source = readLevel();

        expect(source).toContain('AURORA PHOENIX // SHIELDING US');
        expect(source).toContain('BREAK VOID PRESSURE // KEEP THE UPLINK QUIET');
        expect(source).toContain('UPLINK EXPOSURE // ${exposure}/${this.bossMaxHealth}');
        expect(source).toContain('UPLINK EXPOSURE // CONTAINED');
        expect(source).toContain('`EXPOSURE -${finalAmount}`');
        expect(source).toContain('this.boss.setTint(0xA9F3E4)');
        expect(source).not.toContain('this.boss.setTint(0xFF0000)');
    });

    test('teaches counterplay and prevents Phoenix hazards from overlapping', () => {
        const source = readLevel();

        expect(source).toContain('FLAME DIVE // DODGE ACROSS ITS PATH');
        expect(source).toContain('SHADOW FEATHERS // MOVE THROUGH THE GAPS');
        expect(source).toContain('SHADOW FIRE // LEAVE THE GROUND PATH');
        expect(source).toContain('REBIRTH RING // JUMP THROUGH THE WAVE');
        expect(source).toContain('ECHO DIVES // KEEP MOVING');
        expect(source).toContain('const attackWindow = PHOENIX_ATTACK_WINDOWS[attackType] || 1900');
        expect(source).toContain('this.bossAttackUnlockTimer?.remove?.()');
        expect(source).toContain(
            'PHOENIX_ATTACK_WINDUP + attackWindow + PHOENIX_RECOVERY_WINDOW'
        );
        expect(source).not.toContain('this.time.delayedCall(1500, () => {');
    });

    test('supports deterministic local previews for every Phoenix attack', () => {
        const source = readLevel();
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(source).toContain("'flame_dive'");
        expect(source).toContain("'shadow_feathers'");
        expect(source).toContain("'fire_trail'");
        expect(source).toContain("'rebirth_nova'");
        expect(source).toContain("'shadow_clones'");
        expect(source).toContain('this.executeBossAttack(this.bossAttackPreview)');
        expect(source).toContain('if (this.bossAttackPreview) return;');
        expect(gameSource).toContain("'flame_dive'");
        expect(gameSource).toContain("'shadow_clones'");
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
        expect(source).toContain('Earth Contact: Possible, not transmitted');
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

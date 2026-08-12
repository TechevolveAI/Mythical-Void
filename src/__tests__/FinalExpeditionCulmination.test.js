const fs = require('fs');
const path = require('path');

const finalVoidSource = fs.readFileSync(
    path.join(__dirname, '../scenes/levels/FinalVoidLevel.js'),
    'utf8'
);

describe('Final Void expedition culmination', () => {
    test('builds traversal before the boss encounter', () => {
        expect(finalVoidSource).toMatch(
            /createLevelContent\(\)\s*\{[\s\S]*createVoidFractures\(\);[\s\S]*createBondAnchors\(\);[\s\S]*createBossArena\(\);[\s\S]*createEmpressGate\(\);/
        );
        expect(finalVoidSource).toContain('const ledges = [');
        expect(finalVoidSource).toContain('const fractures = [');
    });

    test('requires all three bond signals to open the Empress seal', () => {
        expect(finalVoidSource).toContain('this.bondAnchorsActivated === 3');
        expect(finalVoidSource).toContain('this.finalSignalReady = true');
        expect(finalVoidSource).toMatch(
            /createEmpressGate\(\)[\s\S]*if \(!this\.finalSignalReady\)[\s\S]*BOND SIGNALS REQUIRED[\s\S]*this\.startBossFight\(\);/
        );
    });

    test('reveals the living network, Earth route, and companion trust in order', () => {
        [
            'restored living systems answer ${companionName} together.',
            'Project Beacon finds a route to Earth - and an open door back here.',
            '${companionName} stands beside you. No command was needed.'
        ].forEach(line => expect(finalVoidSource).toContain(line));
        expect(finalVoidSource).toContain('ROUTE PROTECTED // NO SIGNAL TRANSMITTED');
        expect(finalVoidSource).toContain(
            'Number(ecology?.restoredCount)'
        );
    });

    test('targets attacks inside the active end arena', () => {
        expect(finalVoidSource).toMatch(
            /getBossArenaBounds\(\)[\s\S]*left: this\.levelWidth - 620[\s\S]*right: this\.levelWidth - 40/
        );
        expect(finalVoidSource.match(/this\.getBossArenaBounds\(\)/g).length).toBeGreaterThanOrEqual(5);
    });

    test('guards delayed combat effects after the fight ends', () => {
        expect(finalVoidSource).toContain('isBossCombatActive()');
        expect(finalVoidSource.match(/!this\.isBossCombatActive\(\)/g).length).toBeGreaterThanOrEqual(12);
        expect(finalVoidSource).toContain('!this.highPowerRevealActive');
        expect(finalVoidSource).toContain('this.boss.body.enable = false');
    });

    test('lets the network recover the pair before the companion acts alone', () => {
        expect(finalVoidSource).toMatch(
            /if \(phase === 4\)\s*\{\s*this\.grantBondRecovery\(phase\);/
        );
        expect(finalVoidSource).toContain(
            'THE NETWORK ANSWERS: +1 HEART / +1 ENERGY'
        );
        expect(finalVoidSource).toMatch(
            /phase === 5[\s\S]*!this\.triggerCompanionHighPowerRescue\(\)[\s\S]*this\.grantBondRecovery\(phase\);/
        );
    });

    test('turns phase five into an autonomous world-scale rescue', () => {
        expect(finalVoidSource).toContain(
            'attemptAutonomousHighPowerRescue?.('
        );
        expect(finalVoidSource).toContain('if (!this.boss?.active) return false');
        expect(finalVoidSource).toContain(
            "trigger: 'five_system_collapse'"
        );
        expect(finalVoidSource).toContain('commit: !this.testMode');
        expect(finalVoidSource).toContain('this.physics?.pause?.()');
        expect(finalVoidSource).toContain('this.health = this.maxHealth');
        expect(finalVoidSource).toContain(
            'this.crystalEnergy = this.maxCrystalEnergy'
        );
        expect(finalVoidSource).toContain(
            'FIVE LIVING SYSTEMS STABILIZED  //  NO COMMAND GIVEN'
        );
        expect(finalVoidSource).toContain(
            'EARTH IMPACT ESTIMATE  //  CITY-SCALE IF WITNESSED'
        );
        expect(finalVoidSource).toContain(
            'UPLINK CONTAINED  //  NOTHING TRANSMITTED'
        );
        expect(finalVoidSource).toContain(
            'PROJECT BEACON // POWER WITNESSED, TRUST NOT COMMANDED'
        );
    });

    test('renders a distinct high-power expression for every affinity', () => {
        ['moon', 'nebula', 'crystal', 'void'].forEach(affinity => {
            expect(finalVoidSource).toContain(`affinity === '${affinity}'`);
        });
        expect(finalVoidSource).toContain('for (let index = 0; index < 12; index++)');
        expect(finalVoidSource).toContain('count: 77');
    });

    test('offers a non-mutating local preview and cleans up its cinematic', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(gameSource).toContain("previewParams.has('testHighPower')");
        expect(gameSource).toContain('highPowerPreview: true');
        expect(gameSource).toContain('launchLocalHighPowerPreview(game)');
        expect(gameSource).toContain(
            "activeScene.scene?.key !== 'FinalVoidLevel'"
        );
        expect(hatchingSource).toContain(
            "previewParams.has('testHighPower')"
        );
        expect(finalVoidSource).toContain('commit: !this.testMode');
        expect(finalVoidSource).toMatch(
            /shutdown\(\)[\s\S]*this\.clearCompanionHighPowerMoment\(\)/
        );
    });

    test('keeps the boss HUD responsive and points toward an offscreen Empress', () => {
        expect(finalVoidSource).toContain(
            'this.isMobile || screenWidth <= 480 || screenHeight < 620'
        );
        expect(finalVoidSource).toContain('const barY = compact ? 118 : 60');
        expect(finalVoidSource).toContain('compact ? 158 : 112');
        expect(finalVoidSource).toContain('isShortLandscape ? 76 : 72');
        expect(finalVoidSource).toContain('BOND ${current}/3 // ${nextSignal}');
        expect(finalVoidSource).toContain('EMPRESS SEAL OPEN');
        expect(finalVoidSource).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
        expect(finalVoidSource).toContain('this.bossBarConfig = { barX, barY, barWidth, barHeight }');
        expect(finalVoidSource).toContain('updateBossIndicator()');
        expect(finalVoidSource).toContain("setText(`${offscreenRight ? '>' : '<'} EMPRESS`)");
    });

    test('uses a dedicated Empress combat body independent of transparent artwork', () => {
        expect(finalVoidSource).toContain(
            'this.bossBody = this.add.zone(spawnX, spawnY + 60, 170, 380)'
        );
        expect(finalVoidSource).toContain('this.physics.add.existing(this.bossBody)');
        expect(finalVoidSource).toContain(
            'this.bossBody.setPosition(this.boss.x, this.boss.y + 60)'
        );
        expect(finalVoidSource).toContain('this.bossBody.body.enable = false');
        expect(finalVoidSource).toMatch(
            /shutdown\(\)[\s\S]*this\.bossBody\?\.destroy\?\.\(\)/
        );
    });

    test('makes the expedition entry keyboard-accessible and single-fire', () => {
        expect(finalVoidSource).toContain('if (this.levelEntryDismissing) return');
        expect(finalVoidSource).toContain('enterBtn.disableInteractive()');
        expect(finalVoidSource).toContain('overlay.disableInteractive()');
        expect(finalVoidSource).toContain(
            "if (!['Enter', ' '].includes(event.key)) return"
        );
        expect(finalVoidSource).toContain(
            "window.addEventListener('keydown', this.levelEntryKeyHandler)"
        );
        expect(finalVoidSource).toMatch(
            /shutdown\(\)[\s\S]*this\.clearLevelEntryKeyHandler\(\)/
        );
    });

    test('requires a final player-operated repair before the campaign handoff', () => {
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        expect(finalVoidSource).toContain("shipPartId: 'command_module'");
        expect(finalVoidSource).toContain(
            'ecologyResult.networkStatus.toUpperCase()'
        );
        expect(finalVoidSource).toContain(
            '`${networkResult} - COMMAND MODULE RECOVERED\\nUPLINK HELD - NO SIGNAL SENT`'
        );
        expect(finalVoidSource).toContain('UPLINK HELD - NO SIGNAL SENT');
        expect(finalVoidSource).toContain('Guardian Gift: Command Module');
        expect(finalVoidSource).toContain('GUARDIAN GIFT // COMMAND MODULE');
        expect(finalVoidSource).toContain(
            'FINAL REPAIR // BLACK-BOX RECOVERY READY'
        );
        expect(finalVoidSource).toContain('[ INSTALL AT WANDERER-77 ]');
        expect(finalVoidSource).toContain('continueFinaleAfterRepair: true');
        expect(finalVoidSource).toContain('Uplink held. Nothing was transmitted.');
        expect(finalVoidSource).not.toContain('SHIP COMPLETE');
        expect(gameSceneSource).toContain('finishFinaleAfterCommandRepair()');
        expect(gameSceneSource).toContain("this.scene.start('VictoryScene')");
        expect(gameSceneSource).toMatch(
            /getShipReconstructionSnapshot\(window\.GameState\)\.complete[\s\S]*finishFinaleAfterCommandRepair\(\)/
        );
        expect(finalVoidSource).not.toContain('Collect all parts to complete your ship!');
    });

    test('condenses the final repair result into a non-overlapping mobile hierarchy', () => {
        expect(finalVoidSource).toContain(
            'width, height, isCompact, panelWidth, panelHeight, panelX, panelY'
        );
        expect(finalVoidSource).toContain(
            "? 'COMMAND MODULE RECOVERED\\nBLACK-BOX REPAIR READY'"
        );
        expect(finalVoidSource).toContain(
            "'UPLINK HELD // NOTHING TRANSMITTED'"
        );
        expect(finalVoidSource).toContain(
            "'INSTALL THE MODULE AT WANDERER-77'"
        );
        expect(finalVoidSource).toContain(
            'this.getGuardianSanctuaryArrivalCopy({ compact: true })'
        );
        expect(finalVoidSource).toContain('y(isCompact ? 198 : 205)');
        expect(finalVoidSource).toContain('y(isCompact ? 304 : 290)');
        expect(finalVoidSource).toMatch(
            /if \(!isCompact\) \{[\s\S]*FINAL REPAIR \/\/ BLACK-BOX RECOVERY READY/
        );
    });
});

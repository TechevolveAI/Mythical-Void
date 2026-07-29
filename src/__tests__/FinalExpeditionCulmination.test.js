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
            'Five living systems answer your companion together.',
            'Project Beacon finds a route to Earth - and an open door back here.',
            'Your companion stands beside you. No command was needed.'
        ].forEach(line => expect(finalVoidSource).toContain(line));
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
        expect(finalVoidSource).toContain('this.boss.body.enable = false');
    });

    test('lets the bond network support the player in late phases', () => {
        expect(finalVoidSource).toMatch(
            /if \(phase === 4 \|\| phase === 5\)\s*\{\s*this\.grantBondRecovery\(phase\);/
        );
        expect(finalVoidSource).toContain(
            'THE NETWORK ANSWERS: +1 HEART / +1 ENERGY'
        );
        expect(finalVoidSource).toContain(
            'YOUR COMPANION HOLDS THE LINE: +1 HEART / +1 ENERGY'
        );
    });

    test('keeps the boss HUD responsive and points toward an offscreen Empress', () => {
        expect(finalVoidSource).toContain(
            'this.isMobile || screenWidth <= 480 || screenHeight < 620'
        );
        expect(finalVoidSource).toContain('const barY = compact ? 118 : 60');
        expect(finalVoidSource).toContain('compact ? 158 : 112');
        expect(finalVoidSource).toContain('isShortLandscape ? 82 : 212');
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

    test('awards the Command Module and hands the complete campaign to VictoryScene', () => {
        expect(finalVoidSource).toContain("shipPartId: 'command_module'");
        expect(finalVoidSource).toContain('FINAL_SHIP_PART_IDS.every');
        expect(finalVoidSource).toContain("this.scene.start('VictoryScene')");
        expect(finalVoidSource).toContain('BEACON LINE RESTORED - SHIP COMPLETE');
    });
});

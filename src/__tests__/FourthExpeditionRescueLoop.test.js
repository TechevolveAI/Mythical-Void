const fs = require('fs');
const path = require('path');

const levelPath = path.join(__dirname, '../scenes/levels/VoidPeaksLevel.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

describe('fourth expedition rescue loop', () => {
    test('uses the base one-shot lifecycle and does not duplicate the boss arena in test mode', () => {
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
        expect(testMode).not.toContain('this.createBossArena()');
        expect(startLevel).not.toContain('this.createLevelContent()');
        expect(startLevel).toContain('this.showPlatformerMobileControls()');
    });

    test('places three full-height warning relays with safe checkpoints', () => {
        const source = readLevel();

        expect(source).toContain("id: 'peaks_relay_1'");
        expect(source).toContain("id: 'peaks_relay_2'");
        expect(source).toContain("id: 'peaks_relay_3'");
        expect(source).toContain(
            'this.add.zone(\n                relay.x,\n                this.levelHeight / 2,\n                110,\n                this.levelHeight'
        );
        expect(source).toContain(
            'this.setCheckpoint(relay.x, relay.respawnY, {'
        );
        expect(source).toContain('PROJECT BEACON RELAY ${this.beaconRelaysActivated}/3');
        expect(source).toContain(
            "{ id: 'peaks_relay_3', x: 3680, y: 600, label: 'SUMMIT RELAY', respawnY: 480 }"
        );
    });

    test('turns the third relay into the distant creature-network reveal', () => {
        const source = readLevel();

        expect(source).toContain('Your companion sends a warning into the peaks.');
        expect(source).toContain('Distant settlements answer your companion.');
        expect(source).toContain('The replies are coordinated warnings.');
        expect(source).toContain('Restore the warning relays and reach Titan Pass');
        expect(source).toContain('this.creatureNetworkReached = true');
        expect(source).toContain("event: 'creature_warning_network_reached'");
    });

    test('keeps Titan Pass closed until the warning network answers', () => {
        const source = readLevel();
        const gate = source.match(
            /createTitanGate\(\)\s*\{([\s\S]*?)\n    \}\n\n    createBossArena/
        )?.[1] || '';

        expect(gate).toContain('if (!this.creatureNetworkReached)');
        expect(gate).toContain('Titan Pass is silent. Restore the warning relays.');
        expect(gate).toContain('return;');
    });

    test('rewards the complete fragment route with a signal-touched egg', () => {
        const source = readLevel();

        expect(source).toContain("id: 'peak_signal_egg'");
        expect(source).toContain("name: 'Signal Egg'");
        expect(source).toContain('ALL SIGNAL FRAGMENTS - EGG AWAKENED');
        expect(source).toContain('this.cosmicEggAwarded = true');
    });

    test('protects the player during the intro and after restoration begins', () => {
        const source = readLevel();
        const startBoss = source.match(
            /startBossFight\(\)\s*\{([\s\S]*?)\n    \}\n\n    spawnCosmicTitan/
        )?.[1] || '';
        const defeatBoss = source.match(
            /defeatBoss\(\)\s*\{([\s\S]*?)\n    \}\n\n    showBossVictory/
        )?.[1] || '';

        expect(startBoss).toContain('this.physics.pause()');
        expect(source).toContain('this.physics.resume()');
        expect(source).toContain('if (!marker.active || this.bossDefeated)');
        expect(source).toContain('if (this.bossDefeated) return;');
        expect(defeatBoss).toContain('this.boss.body.enable = false');
    });

    test('uses responsive restoration language for the Titan encounter', () => {
        const source = readLevel();

        expect(source).toContain(
            'const isMobileLayout = this.isMobile || width <= 480 || height < 620'
        );
        expect(source).toContain('const barY = isMobileLayout ? 118 : 60');
        expect(source).toContain('isMobileLayout ? 165 : 90');
        expect(source).toContain('isShortLandscape ? 82 : 212');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
        expect(source).toContain('this.createBossIndicator()');
        expect(source).toContain('this.updateBossIndicator()');
        expect(source).toContain("'TITAN >'");
        expect(source).toContain("'< TITAN'");
        expect(source).toContain('this.bossIndicator?.setVisible?.(false)');
        expect(source).toContain('Clear the Void pressure');
        expect(source).toContain('TITAN SIGNAL STABLE');
        expect(source).toContain('COSMIC TITAN RESTORED');
        expect(source).toContain('WARNING NETWORK RESTORED');
        expect(source).toContain("Titan's Gift: Hull Plating");
        expect(source).not.toContain('COSMIC TITAN CONQUERED');
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

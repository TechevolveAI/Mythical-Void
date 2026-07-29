const fs = require('fs');
const path = require('path');

const levelPath = path.join(__dirname, '../scenes/levels/ReefLevel.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

describe('third expedition rescue loop', () => {
    test('uses the base one-shot lifecycle without recreating content after entry', () => {
        const source = readLevel();
        const createMethod = source.match(
            /\n    create\(\)\s*\{([\s\S]*?)\n    \}\n\n    startTestMode/
        )?.[1] || '';
        const entryDismissal = source.match(
            /const dismissEntry = \(\) => \{([\s\S]*?)\n        \};/
        )?.[1] || '';

        expect(createMethod).toContain('super.create()');
        expect(createMethod).not.toContain('this.createLevelContent()');
        expect(entryDismissal).not.toContain('this.createLevelContent()');
    });

    test('synchronizes three full-height waypoint crossings with checkpoints', () => {
        const source = readLevel();

        expect(source).toContain("id: 'reef_waypoint_1'");
        expect(source).toContain("id: 'reef_waypoint_2'");
        expect(source).toContain("id: 'reef_waypoint_3'");
        expect(source).toContain(
            'this.add.zone(\n                waypoint.x,\n                this.levelHeight / 2,\n                110,\n                this.levelHeight'
        );
        expect(source).toContain(
            'this.setCheckpoint(anchor.x, anchor.respawnY, {'
        );
        expect(source).toContain('PROJECT BEACON WAYPOINT ${this.beaconAnchorsActivated}/3');
    });

    test('turns waypoint synchronization into the companion-led route discovery', () => {
        const source = readLevel();

        expect(source).toContain('Your companion answers the ancient signal.');
        expect(source).toContain(
            'Three signals align. A route appears through the Void.'
        );
        expect(source).toContain('this.reefRouteAligned = true');
        expect(source).toContain("event: 'reef_route_aligned'");
    });

    test('requires both the aligned route and the actual Drive pickup before the boss', () => {
        const source = readLevel();
        const trigger = source.match(
            /createBossTrigger\(\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Start boss fight/
        )?.[1] || '';

        expect(trigger).toContain('const missingRoute = !this.reefRouteAligned');
        expect(trigger).toContain('const missingDrive = !this.shipPartCollected');
        expect(trigger).toContain('return;');
        expect(source).toContain('const collectX = part.x');
        expect(source).toContain('DIMENSIONAL DRIVE SECURED');
    });

    test('freezes the long boss intro and restores control with camera follow', () => {
        const source = readLevel();
        const startBoss = source.match(
            /startBossFight\(\)\s*\{([\s\S]*?)\n    \}\n\n    showBossIntro/
        )?.[1] || '';

        expect(startBoss).toContain('this.physics.pause()');
        expect(source).toContain('camera.startFollow(this.player');
        expect(source).toContain('this.physics.resume()');
    });

    test('makes the restoration window non-damaging and clears boss minions', () => {
        const source = readLevel();
        const defeat = source.match(
            /defeatBoss\(\)\s*\{([\s\S]*?)\n    \}\n\n    showVictoryScreen/
        )?.[1] || '';

        expect(defeat).toContain('this.bossBody.body.enable = false');
        expect(defeat).toContain('this.bossMinions.forEach');
        expect(defeat).toContain('PASSAGE GUARDIAN STABLE');
        expect(source).toContain('STELLAR PASSAGE RESTORED');
        expect(source).toContain("Nyx'voral's Trust: Returned");
        expect(source).not.toContain("`Nyx'voral Defeated: ✓`");
    });

    test('separates compact objective and guardian UI from mobile controls', () => {
        const source = readLevel();

        expect(source).toContain('const y = isMobileLayout ? 118 : 55');
        expect(source).toContain('this.isMobile || width <= 480 || height < 620');
        expect(source).toContain('isShortLandscape ? 82 : 92');
        expect(source).toContain(
            'return `DRIVE: ${driveState}\\nWAYPOINTS: ${this.beaconAnchorsActivated}/3\\nFRAGMENTS: ${this.starFragmentsCollected}/${this.totalStarFragments}`'
        );
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
    });

    test('keeps shared companion, camera, and shield systems active while swimming', () => {
        const source = readLevel();
        const update = source.match(
            /update\(time, delta\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Create swim indicator/
        )?.[1] || '';

        expect(update).toContain('this.astronautFollower?.update(delta)');
        expect(update).toContain('this.updateCameraLead()');
        expect(update).toContain('this.updateShield(delta)');
    });

    test('makes the Reef entry keyboard accessible and single-fire', () => {
        const source = readLevel();
        const entry = source.match(
            /showLevelEntry\(\)\s*\{([\s\S]*?)\n    \}\n\n    clearLevelEntryKeyHandler/
        )?.[1] || '';

        expect(entry).toContain("['Enter', ' '].includes(event.key)");
        expect(entry).toContain("window.addEventListener('keydown', this.levelEntryKeyHandler)");
        expect(entry).toContain('if (this.levelEntryDismissing)');
        expect(entry).toContain('enterBtn.disableInteractive()');
        expect(entry).toContain('overlay.disableInteractive()');
        expect(source).toMatch(
            /shutdown\(\)[\s\S]*this\.clearLevelEntryKeyHandler\(\)/
        );
    });

    test('keeps harmless crystal facets inside safe platform silhouettes', () => {
        const source = readLevel();

        expect(source).toContain('y + height - 5');
        expect(source).toContain('y + 7');
        expect(source).not.toContain('facetX, y - 15');
    });
});

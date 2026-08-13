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

    test('synchronizes three localized waypoint crossings with checkpoints', () => {
        const source = readLevel();

        expect(source).toContain("id: 'reef_waypoint_1'");
        expect(source).toContain("id: 'reef_waypoint_2'");
        expect(source).toContain("id: 'reef_waypoint_3'");
        expect(source).toContain("activationSupportIds: ['reef-drift-relay']");
        expect(source).toContain("activationSupportIds: ['reef-traveler-relay']");
        expect(source).toContain("activationSupportIds: ['reef-passage-vector']");
        expect(source).toContain("activationSupportIds: ['reef-drive-relic']");
        expect(source).toContain(
            'this.createObjectiveTriggerZone(\n                waypointX,\n                waypointY,\n                { width: 150, height: 150 }'
        );
        expect(source).toContain('SWIM THROUGH');
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain('this.setCheckpoint(supportCheckpoint.x, supportCheckpoint.y, {');
        expect(source).toContain('PROJECT BEACON WAYPOINT ${this.beaconAnchorsActivated}/3');
        expect(source).toContain("traversalLinks: ['reef-current-crown']");
        expect(source).toContain("traversalLinks: ['reef-sky-rise']");
        expect(source).toMatch(/id: 'reef-current-crown'[\s\S]*?oneWay: true/);
        expect(source).toMatch(/id: 'reef-sky-rise'[\s\S]*?oneWay: true/);
        expect(source).toContain('this.createDriftAscentCurrent();');
        expect(source).toContain('this.createTravelerAscentCurrent();');
        expect(source).toContain("id: 'reef-drift-ascent'");
        expect(source).toContain("id: 'reef-traveler-ascent'");
        expect(source).toContain("destinationId: 'reef-current-crown'");
        expect(source).toContain("destinationId: 'reef-sky-rise'");
        expect(source).toContain('DRIFT CURRENT  ↗');
        expect(source).toContain('TRAVELER CURRENT  ↗');
        expect(source).toContain('createForwardAscentCurrent({');
    });

    test('turns waypoint synchronization into the companion-led route discovery', () => {
        const source = readLevel();

        expect(source).toContain('const companionName = this.getCompanionName()');
        expect(source).toContain('This signal did not come from Earth.');
        expect(source).toContain('It is a traveler relay. Someone crossed before us.');
        expect(source).toContain('I can hold the route open. Stay with me.');
        expect(source).toContain('this.reefRouteAligned = true');
        expect(source).toContain("event: 'reef_route_aligned'");
    });

    test('makes the Reef current a visible and mechanically stronger katana link', () => {
        const source = readLevel();

        expect(source).toContain('CURRENT LINK ACTIVE // KATANA STRIKES AMPLIFIED');
        expect(source).toContain('const currentLinkedDamage = meleeDamage + 1');
        expect(source).toContain(
            "this.resolveBossHit(currentLinkedDamage, { source: 'katana_current' })"
        );
        expect(source).toContain('reefAmplified: true');
    });

    test('makes the Star Trench return current visible, narrow, and mechanically honest', () => {
        const source = readLevel();

        expect(source).toContain("const id = 'reef-star-trench-return';");
        expect(source).toContain('const startX = 2460;');
        expect(source).toContain('const width = 260;');
        expect(source).toContain('const top = 540;');
        expect(source).toContain('visual.fillRoundedRect(startX, top, width, currentHeight, 28);');
        expect(source).toContain("'STAR TRENCH RETURN ↑'");
        expect(source).toContain("destinationId: 'reef-drive-step'");
        expect(source).toContain('this.abyssAscentCurrent = current;');
        expect(source).toContain(
            'this.player.body.top < destination.body.top'
        );
        expect(source).not.toContain('const width = 1000;');
        expect(source).not.toContain(
            'visual.fillRect(startX, this.levelHeight - 210, width, 210);'
        );
    });

    test('gives every Reef support a stable identity and a one-way current landing', () => {
        const source = readLevel();

        expect(source).toContain("id: 'reef-opening-1'");
        expect(source).toContain("id: 'reef-trench-3'");
        expect(source).toContain("traversalLinks: ['reef-drive-step']");
        expect(source).toContain("id: 'reef-drive-step'");
        expect(source).toContain('oneWay: true');
        expect(source).toContain("id: 'reef-guardian-arena'");
        expect(source).toContain("activationSupportIds: ['reef-trench-3']");
        expect(source).toContain('body.traversalId = id;');
        expect(source).toContain('body.traversalLinks = [...traversalLinks];');
        expect(source).toContain("body.platformType = oneWay ? 'one-way' : 'solid';");
        expect(source).toContain('body.body.checkCollision.down = false;');
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
        expect(source).toContain(
            'this.getGuardianSanctuaryArrivalCopy({ compact: true })'
        );
        expect(source).not.toContain("Nyx'voral's Trust: Returned");
        expect(source).not.toContain("`Nyx'voral Defeated: ✓`");
    });

    test('presents Nyx\'voral as trapped inside a repairable passage', () => {
        const source = readLevel();

        expect(source).toContain("NYX\\'VORAL // TRAPPED");
        expect(source).toContain(
            'CURRENT LINK ACTIVE // KATANA STRIKES AMPLIFIED'
        );
        expect(source).toContain(
            'BROKEN ROUTE // ${routeFracture}/${this.bossMaxHealth}'
        );
        expect(source).toContain('BROKEN ROUTE // RESTORED');
        expect(source).toContain('`ROUTE FRACTURE -${finalAmount}`');
    });

    test('names the counterplay and prevents overlap for every Reef hazard', () => {
        const source = readLevel();

        expect(source).toContain(
            "voidLunge: 'VOID LUNGE // DODGE ACROSS ITS PATH'"
        );
        expect(source).toContain(
            "dimensionalTear: 'DIMENSIONAL TEAR // LEAVE THE RIFT'"
        );
        expect(source).toContain(
            "summonMinions: 'VOID ECHOES // CLEAR THE SWARM'"
        );
        expect(source).toContain('voidLunge: 2600');
        expect(source).toContain('dimensionalTear: 2200');
        expect(source).toContain('summonMinions: 3400');
        expect(source).toContain('this.bossAttackLocked = true');
        expect(source).toContain('this.time.delayedCall(\n            attackWindow');
    });

    test('supports deterministic mobile previews for each Reef hazard', () => {
        const source = readLevel();
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(source).toContain('data?.bossAttackPreview');
        expect(source).toContain('this.bossAttack(this.bossAttackPreview)');
        expect(source).toMatch(
            /if \(this\.bossAttackPreview\)[\s\S]*this\.bossAttack\(this\.bossAttackPreview\)[\s\S]*else \{[\s\S]*this\.startBossAI\(\)/
        );
        expect(gameSource).toContain("'voidLunge'");
        expect(gameSource).toContain("'dimensionalTear'");
        expect(gameSource).toContain("'summonMinions'");
    });

    test('points the off-screen indicator at the moving guardian body', () => {
        const source = readLevel();

        expect(source).toContain(
            'const bossWorldX = this.bossBody?.x ?? this.boss.x'
        );
        expect(source).toContain(
            'const bossWorldY = this.bossBody?.y ?? this.boss.y'
        );
        expect(source).toContain('const bossScreenX = bossWorldX - camera.scrollX');
        expect(source).toContain('const bossScreenY = bossWorldY - camera.scrollY');
        expect(source).not.toContain('const bossScreenX = this.boss.x - camera.scrollX');
    });

    test('separates compact objective and guardian UI from mobile controls', () => {
        const source = readLevel();

        expect(source).toContain('const y = isMobileLayout ? 118 : 55');
        expect(source).toContain('this.isMobile || width <= 480 || height < 620');
        expect(source).toContain('isShortLandscape ? 76 : 72');
        expect(source).toContain('ROUTE ${current}/3 // ${nextWaypoint}');
        expect(source).toContain('PASSAGE GUARDIAN AHEAD');
        expect(source).toContain('RECOVER THE DIMENSIONAL DRIVE');
        expect(source).toContain('getDriveCompassText()');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
    });

    test('keeps shared companion, camera, and shield systems active while swimming', () => {
        const source = readLevel();
        const update = source.match(
            /update\(time, delta\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Create swim indicator/
        )?.[1] || '';

        expect(update).toContain('super.update(time, delta)');
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        expect(platformerSource).toContain('this.astronautFollower?.update(delta)');
        expect(platformerSource).toContain('this.updateCameraLead()');
        expect(platformerSource).toContain('this.updateShield(delta)');
    });

    test('persists route, Drive, fragment, and free-blast state at Reef checkpoints', () => {
        const source = readLevel();

        expect(source).toContain('getExpeditionRouteState()');
        expect(source).toContain('reefRouteChoice: this.reefRouteChoice');
        expect(source).toContain('shipPartCollected: this.shipPartCollected === true');
        expect(source).toContain('reefFragmentMask: this.reefCollectedFragmentMask');
        expect(source).toContain('starTrenchProgress: Number(route?.progress)');
        expect(source).toContain('restoreReefRouteState(resume.routeState');
        expect(source).toContain('this.clearShipPartPickup();');
        expect(source).toContain('this.retireCollectedReefFragments();');
        expect(source).toContain('onFreeSpecialAttackConsumed()');
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

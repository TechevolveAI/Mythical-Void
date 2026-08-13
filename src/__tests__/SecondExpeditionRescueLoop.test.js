const fs = require('fs');
const path = require('path');
const vm = require('vm');

const levelPath = path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

function loadLevelClass() {
    const transformed = readLevel()
        .replace(
            "import PlatformerLevelScene from '../PlatformerLevelScene.js';",
            'const PlatformerLevelScene = class { constructor(config) { this.sceneConfig = config; } };'
        )
        .replace(
            /import \{\s*buildCreaturePowerProfile,[\s\S]*?\} from '\.\.\/\.\.\/systems\/CreaturePowerProfile\.js';/,
            'const buildCreaturePowerProfile = () => ({ affinityPower: { id: "radiant_pulse", name: "Radiant Pulse" }, color: 0xFFD54F });\n' +
            'const recordCreaturePowerEvent = () => ({ changed: true });'
        )
        .replace(
            "import { calculateBallisticLaunchVelocity } from '../../systems/TraversalTopology.js';",
            'const calculateBallisticLaunchVelocity = () => -748;'
        )
        .replace('export default CrystalCavesLevel;', 'module.exports = CrystalCavesLevel;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {},
        Phaser: {},
        Date,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: levelPath });
    return sandbox.module.exports;
}

describe('second expedition rescue loop', () => {
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

    test('places three authored Project Beacon anchors through the caves', () => {
        const source = readLevel();

        expect(source).toContain("id: 'caves_anchor_1'");
        expect(source).toContain("id: 'caves_anchor_2'");
        expect(source).toContain("id: 'caves_anchor_3'");
        expect(source).toContain('PROJECT BEACON ANCHOR ${anchorNumber}/3');
        expect(source).toContain("activationSupportIds: ['caves-echo-upper']");
        expect(source).toContain("activationSupportIds: ['caves-grove-step']");
        expect(source).toContain("activationSupportIds: ['caves-guardian-left']");
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain('this.setCheckpoint(supportCheckpoint.x, supportCheckpoint.y, {');
    });

    test('keeps cave anchors local, ordered, and aligned with the full Beacon route', () => {
        const source = readLevel();
        const checkpoints = source.match(
            /createBeaconCheckpoints\(\)\s*\{([\s\S]*?)\n    \}\n\n    drawCaveBeacon/
        )?.[1] || '';

        expect(checkpoints).toContain('this.createObjectiveTriggerZone(');
        expect(checkpoints).toContain('{ width: 150, height: 190 }');
        expect(checkpoints).toContain('this.canActivateOrderedRouteSignal(');
        expect(checkpoints).toContain('this.isPlayerGroundedOnTraversalSupport(');
        expect(checkpoints.indexOf('this.canActivateOrderedRouteSignal(')).toBeLessThan(
            checkpoints.indexOf('this.isPlayerGroundedOnTraversalSupport(')
        );
        expect(checkpoints).toContain('this.refreshCaveRouteReadability();');
        expect(source).toContain('this.canActivateOrderedRouteSignal(');
        expect(source).toContain('this.beaconAnchorsActivated++');
        expect(source).toContain('this.caveRouteAligned = true');
        expect(source).toContain("event: 'crystal_route_aligned'");
    });

    test('powers a named Crystal Lift after route alignment while retaining recovery steps', () => {
        const source = readLevel();

        expect(source).toContain("id: 'caves-core-lift'");
        expect(source).toContain("destinationId: 'caves-core-refuge'");
        expect(source).toContain("'CRYSTAL LIFT\\nCORE ASCENT ↑'");
        expect(source).toContain("'CRYSTAL LIFT\\nALIGN 3 ANCHORS'");
        expect(source).toContain('calculateBallisticLaunchVelocity({');
        expect(source).toContain('this.player.setVelocityY(launchVelocity)');
        expect(source).toContain("'caves-core-step-low'");
        expect(source).toContain("'caves-core-step-mid'");
        expect(source).toContain("{ traversalLinks: ['caves-core-refuge'] }");
    });

    test('makes the wounded-grove companion moment unavoidable across traversal paths', () => {
        const source = readLevel();

        expect(source).toContain(
            'this.add.zone(x, this.levelHeight / 2, 190, this.levelHeight)'
        );
        expect(source).toContain('`${companionName}: ${powerProfile.affinityPower.name}`');
        expect(source).toContain('THE FRACTURED CURRENT STABILIZES');
        expect(source).toContain("eventId: 'crystal_grove_response'");
        expect(source).toContain("outcome: 'fractured_current_stabilized'");
        expect(source).toContain('powerProfile.color');
        expect(source).toContain("event: 'crystal_grove_tended'");
        expect(source).toContain('LIVING PULSE RESTORED');
        expect(source).toContain('[ REQUIRED ] Reach the fractured grove');
    });

    test('keeps all five Star Fragments collectible before the Core finale', () => {
        const source = readLevel();
        const finalFragment = source.match(
            /\{ x: (\d+), y: this\.levelHeight - 550 \}\s+\/\/ Final approach/
        );
        const core = source.match(/const coreX = (\d+);/);

        expect(finalFragment).not.toBeNull();
        expect(core).not.toBeNull();
        expect(Number(finalFragment[1])).toBeLessThan(Number(core[1]));
    });

    test('frames the cave guardian outcome as restoration rather than destruction', () => {
        const source = readLevel();

        expect(source).toContain('THE CAVE GUARDIAN IS HURTING');
        expect(source).toContain('CRYSTAL GUARDIAN // WOUNDED');
        expect(source).toContain('STRIKE THE UNSTABLE PULSE');
        expect(source).toContain(
            'UNSTABLE PULSE // ${unstablePulse}/${this.bossMaxHealth}'
        );
        expect(source).toContain('UNSTABLE PULSE // STABLE');
        expect(source).toContain('`PULSE -${finalAmount}`');
        expect(source).toContain('GUARDIAN PULSE STABLE');
        expect(source).toContain('CRYSTAL GUARDIAN RESTORED');
        expect(source).toContain('Guardian Gifts: Crystal Core');
        expect(source).toContain("katanaUpgradeId: 'crystal_edge'");
        expect(source).not.toContain('💎 CRYSTAL GOLEM DEFEATED 💎');
    });

    test('names the safe response and full lock window for each guardian hazard', () => {
        const source = readLevel();

        expect(source).toContain("ground_slam: 'GROUND PULSE // JUMP'");
        expect(source).toContain(
            "crystal_barrage: 'CRYSTAL BARRAGE // MOVE BETWEEN SHOTS'"
        );
        expect(source).toContain(
            "charge: 'GUARDIAN CHARGE // GET BEHIND IT'"
        );
        expect(source).toContain('ground_slam: 1400');
        expect(source).toContain('crystal_barrage: 2900');
        expect(source).toContain('charge: 1700');
        expect(source).toContain(
            'pacing.windup + attackWindow + pacing.recovery'
        );
        expect(source).toContain('this.bossAttackUnlockTimer?.remove?.()');
    });

    test('supports deterministic mobile previews for every guardian attack', () => {
        const source = readLevel();
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(source).toContain("'ground_slam'");
        expect(source).toContain("'crystal_barrage'");
        expect(source).toContain("'charge'");
        expect(source).toContain('data?.bossAttackPreview');
        expect(source).toContain(
            'this.bossPerformAttack(this.bossAttackPreview)'
        );
        expect(source).toContain('if (this.bossAttackPreview)');
        expect(source).toMatch(
            /if \(this\.bossAttackPreview\)[\s\S]*this\.bossPerformAttack\(this\.bossAttackPreview\)[\s\S]*else \{[\s\S]*this\.startBossAI\(\)/
        );
        expect(gameSource).toContain("'ground_slam'");
        expect(gameSource).toContain("'crystal_barrage'");
        expect(gameSource).toContain("'charge'");
    });

    test('requires both rescue objectives before the Crystal Core can answer', () => {
        const source = readLevel();
        const CrystalCavesLevel = loadLevelClass();
        const scene = new CrystalCavesLevel();
        const core = source.match(
            /createCrystalCoreEngine\(\)\s*\{([\s\S]*?)\n    \}\n\n    canActivateCrystalCore/
        )?.[1] || '';
        const gate = source.match(
            /canActivateCrystalCore\(\)\s*\{([\s\S]*?)\n    \}\n\n    getCrystalCoreHintText/
        )?.[1] || '';

        expect(gate).toContain('this.caveRouteAligned && this.crystalWoundTended');
        expect(core).toContain('if (!this.canActivateCrystalCore())');
        expect(core.indexOf('if (!this.canActivateCrystalCore())'))
            .toBeLessThan(core.indexOf('this.crystalCoreFound = true'));
        expect(source).toContain('The Core signal is incomplete. Align the Beacon anchors.');
        expect(source).toContain('Your companion still hears the fractured grove.');
        expect(source).toContain('Touch to Answer the Guardian');
        expect(source).toContain("{ text: 'Beacon Route Aligned', done: this.caveRouteAligned }");

        expect(scene.canActivateCrystalCore()).toBe(false);
        expect(scene.getCrystalCoreHintText()).toBe('Align the Beacon anchors');
        scene.caveRouteAligned = true;
        expect(scene.canActivateCrystalCore()).toBe(false);
        expect(scene.getCrystalCoreHintText()).toBe('Tend the fractured grove');
        scene.crystalWoundTended = true;
        expect(scene.canActivateCrystalCore()).toBe(true);
        expect(scene.getCrystalCoreHintText()).toBe('Touch to Answer the Guardian');
    });

    test('makes the cave entry keyboard accessible and single-fire', () => {
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

    test('separates compact objective and guardian UI from mobile controls', () => {
        const source = readLevel();

        expect(source).toContain('const barY = isMobileLayout ? 118 : 55');
        expect(source).toContain('this.isMobile || width <= 480 || height < 620');
        expect(source).toContain('isShortLandscape ? 76 : 72');
        expect(source).toContain(': 28;');
        expect(source).toContain('FOLLOW THE CAVE PULSE →');
        expect(source).toContain('FRACTURED GROVE AHEAD');
        expect(source).toContain('REACH IT TOGETHER →');
        expect(source).toContain('USE THE CRYSTAL LIFT ↑');
        expect(source).toContain('STRIKE THE UNSTABLE PULSE');
        expect(source).toContain('OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
    });

    test('changes the live objective from route-finding to companion rescue and guardian contact', () => {
        const CrystalCavesLevel = loadLevelClass();
        const scene = new CrystalCavesLevel();
        scene.starFragmentsCollected = 0;
        scene.totalStarFragments = 5;
        scene.beaconAnchorsActivated = 0;
        scene.crystalWoundTended = false;
        scene.caveRouteAligned = false;
        scene.bossFightActive = false;
        scene.bossDefeated = false;

        expect(scene.getCrystalObjectiveText()).toContain('ROUTE 1/3 // ECHO PASS');
        scene.beaconAnchorsActivated = 2;
        expect(scene.getCrystalObjectiveText()).toContain('FRACTURED GROVE AHEAD');
        scene.crystalWoundTended = true;
        expect(scene.getCrystalObjectiveText()).toContain('ROUTE 3/3 // GUARDIAN THRESHOLD');
        scene.beaconAnchorsActivated = 3;
        scene.caveRouteAligned = true;
        expect(scene.getCrystalObjectiveText()).toContain('CRYSTAL CORE AHEAD');
        scene.bossFightActive = true;
        expect(scene.getCrystalObjectiveText()).toContain('STABILIZE THE GUARDIAN');
    });
});

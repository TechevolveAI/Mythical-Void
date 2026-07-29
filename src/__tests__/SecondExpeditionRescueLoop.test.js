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
        expect(source).toContain(
            'this.setCheckpoint(checkpoint.x, checkpoint.respawnY, {'
        );
    });

    test('makes cave anchors unavoidable and aligns the full Beacon route', () => {
        const source = readLevel();
        const checkpoints = source.match(
            /createBeaconCheckpoints\(\)\s*\{([\s\S]*?)\n    \}\n\n    drawCaveBeacon/
        )?.[1] || '';

        expect(checkpoints).toContain('this.levelHeight / 2');
        expect(checkpoints).toContain('this.levelHeight');
        expect(source).toContain('this.beaconAnchorsActivated++');
        expect(source).toContain('this.caveRouteAligned = true');
        expect(source).toContain("event: 'crystal_route_aligned'");
    });

    test('makes the wounded-grove companion moment unavoidable across traversal paths', () => {
        const source = readLevel();

        expect(source).toContain(
            'this.add.zone(x, this.levelHeight / 2, 190, this.levelHeight)'
        );
        expect(source).toContain('Your companion tends the fractured crystal.');
        expect(source).toContain('The cave answers with a steadier pulse.');
        expect(source).toContain("event: 'crystal_grove_tended'");
        expect(source).toContain('LIVING PULSE RESTORED');
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
        expect(source).toContain('Stabilize the wounded pulse');
        expect(source).toContain('GUARDIAN PULSE STABLE');
        expect(source).toContain('CRYSTAL GUARDIAN RESTORED');
        expect(source).toContain('Guardian Gifts: Crystal Core');
        expect(source).toContain("katanaUpgradeId: 'crystal_edge'");
        expect(source).not.toContain('💎 CRYSTAL GOLEM DEFEATED 💎');
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
        expect(source).toContain('isShortLandscape ? 82 : 92');
        expect(source).toContain('ANCHORS: ${this.beaconAnchorsActivated}/3');
        expect(source).toContain('FRAGMENTS: ${this.starFragmentsCollected}/${this.totalStarFragments}');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
    });
});

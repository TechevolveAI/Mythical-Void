const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('secondary journey reliability contract', () => {
    const hub = read('scenes/HubWorldScene.js');
    const inventory = read('scenes/InventoryScene.js');
    const forest = read('scenes/levels/MythicalForestLevel.js');
    const loader = read('utils/SceneLoader.js');

    test('starts a gate exactly once with an independent mobile fallback', () => {
        expect(hub).toContain('beginGateSceneTransition(gate)');
        expect(hub).toContain('this.gateTransitionStarted = true');
        expect(hub).toContain('this.gateTransitionFallback = setTimeout(() => {');
        expect(hub).toContain('this.isTransitioning = false;');
    });

    test('release smoke traverses the real Sanctuary to Hub to Forest handoff', () => {
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smoke).toContain('async function smokeHubForestTransition');
        expect(smoke).toContain("scene.openHubWorld();");
        expect(smoke).toContain("entry.id === 'mythical_forest'");
        expect(smoke).toContain('hub.enterGate(gate);');
        expect(smoke).toContain('Forest field brief after Hub entry');
        expect(smoke).toContain('Forest live gameplay after Hub entry');
        expect(smoke).toContain('scene?.platformerControlsVisible === true');
    });

    test('registers unknown lazy scenes without calling a throwing getScene lookup', () => {
        expect(loader).toContain('game.scene.keys?.[sceneName]');
        expect(loader).not.toContain('if (game.scene.getScene(sceneName))');
        expect(loader).toContain("this.preload('MythicalForestLevel')");
    });

    test('starts purchased egg hatching before Inventory shutdown can cancel it', () => {
        const transition = inventory.slice(
            inventory.indexOf('// Prepare data for HatchingScene'),
            inventory.indexOf('/**\n     * Equip selected item')
        );
        expect(transition).toContain("this.scene.start('HatchingScene', hatchData)");
        expect(transition).not.toContain('setTimeout(() =>');
        expect(inventory).toContain('The selected egg could not be reserved for hatching');
    });

    test('starts the first Forest field brief from permanent local media', () => {
        expect(hub).toContain("momentId: 'first_forest_arrival'");
        expect(forest).toContain('showFirstForestArrivalCinematic');
        expect(forest).toContain("momentId: 'first_forest_arrival'");
        expect(forest).toContain('PROJECT BEACON // FIELD BRIEF');
        expect(forest).toContain("'story.projectBeacon.firstForestCinematicSeen'");
        expect(forest).toContain('FOREST_ARRIVAL_CINEMATIC_VERSION = 2');
        expect(forest).toContain('CINEMATIC_MEDIA.mythicalForestArrival.url');
        expect(forest).toContain('FOREST_ARRIVAL_TEXTURE');
        expect(forest).toContain('createForestArrivalMotionBackdrop');
        expect(forest).toContain('A signal is moving through the forest.');
        expect(forest).toContain('clearForestArrivalBackdrop()');
        expect(forest).toContain('prepareCinematic?.(this');
        expect(forest).not.toContain('Promise.race([presentation, timeout])');
    });

    test('starts Forest gameplay on accepted input instead of waiting on fade completion', () => {
        const dismiss = forest.slice(
            forest.indexOf('const dismissEntry = () => {'),
            forest.indexOf('// Click button to enter')
        );
        expect(dismiss.indexOf('this.startLevel();')).toBeLessThan(
            dismiss.indexOf('this.tweens.add({')
        );
    });

    test('starts every later expedition before its entry fade completes', () => {
        const levelFiles = [
            'CrystalCavesLevel.js',
            'ReefLevel.js',
            'VoidPeaksLevel.js',
            'AuroraDepthsLevel.js',
            'FinalVoidLevel.js'
        ];
        levelFiles.forEach(fileName => {
            const source = read(`scenes/levels/${fileName}`);
            const dismiss = source.slice(
                source.indexOf('const dismissEntry = () => {'),
                source.indexOf("enterBtn.on('pointerdown', dismissEntry)")
            );
            expect(dismiss.indexOf('this.physics.resume();')).toBeGreaterThan(-1);
            expect(dismiss.indexOf('this.physics.resume();')).toBeLessThan(
                dismiss.indexOf('this.tweens.add({')
            );
        });
    });
});

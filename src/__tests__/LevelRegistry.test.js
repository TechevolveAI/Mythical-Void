const fs = require('fs');
const path = require('path');
const { expectForestCompletionConnection, expectPeaksCompletionConnection, expectCrystalCompletionConnection, expectReefCompletionConnection, expectAuroraCompletionConnection } = require('./support/forestCompletionContract.cjs');

function readSource(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('level registry coverage', () => {
    const playableLevelMappings = {
        crystal_caves: 'CrystalCavesLevel',
        stellar_reef: 'ReefLevel',
        mythical_forest: 'MythicalForestLevel',
        void_peaks: 'VoidPeaksLevel',
        aurora_depths: 'AuroraDepthsLevel',
        final_void: 'FinalVoidLevel'
    };

    const completionContracts = {
        CrystalCavesLevel: { levelId: 'crystalCaves', shipPartId: 'crystal_core' },
        ReefLevel: { levelId: 'cosmicReef', shipPartId: 'dimensional_drive' },
        MythicalForestLevel: { levelId: 'mythicalForest', shipPartId: 'forest_core' },
        VoidPeaksLevel: { levelId: 'voidPeaks', shipPartId: 'hull_plating' },
        AuroraDepthsLevel: { levelId: 'auroraDepths', shipPartId: 'aurora_reactor' },
        FinalVoidLevel: { levelId: 'finalVoid', shipPartId: 'command_module' }
    };

    test('hub level gates are present in GameState, HubWorldScene, and SceneLoader', () => {
        const gameStateSource = readSource('systems/GameState.js');
        const hubWorldSource = readSource('scenes/HubWorldScene.js');
        const gateControllerSource = readSource('scenes/controllers/HubGateTransitionController.js');
        const sceneLoaderSource = readSource('utils/SceneLoader.js');

        expect(hubWorldSource).toContain("import HubGateTransitionController from './controllers/HubGateTransitionController.js'");
        expect(hubWorldSource).toContain('this.getGateEntryController().enter(gate)');

        Object.entries(playableLevelMappings).forEach(([gateId, sceneKey]) => {
            expect(gameStateSource).toContain(`${gateId}:`);
            expect(gateControllerSource).toContain(`${gateId}: '${sceneKey}'`);
            expect(sceneLoaderSource).toContain(`'${gateId}': '${sceneKey}'`);
            if (sceneKey === 'FinalVoidLevel') {
                expect(sceneLoaderSource).toContain("FinalVoidLevel: () => finalVoidRelease.encounter === 'trumptopus'");
                expect(sceneLoaderSource).toContain("import('../scenes/levels/TrumptopusLevel.js')");
                expect(sceneLoaderSource).toContain("import('../scenes/levels/FinalVoidLevel.js')");
            } else expect(sceneLoaderSource).toContain(`${sceneKey}: () => import('../scenes/levels/${sceneKey}.js')`);
        });
    });

    test('each registered playable level has a scene file', () => {
        Object.values(playableLevelMappings).forEach(sceneKey => {
            const levelPath = path.join(__dirname, '..', 'scenes', 'levels', `${sceneKey}.js`);
            expect(fs.existsSync(levelPath)).toBe(true);
        });
    });

    test('every playable level uses the shared completion contract with its canonical reward', () => {
        Object.entries(completionContracts).forEach(([sceneKey, contract]) => {
            const levelSource = readSource(`scenes/levels/${sceneKey}.js`);
            if (sceneKey === 'MythicalForestLevel') expectForestCompletionConnection();
            else if (sceneKey === 'VoidPeaksLevel') expectPeaksCompletionConnection();
            else if (sceneKey === 'CrystalCavesLevel') expectCrystalCompletionConnection();
            else if (sceneKey === 'ReefLevel') expectReefCompletionConnection();
            else if (sceneKey === 'AuroraDepthsLevel') expectAuroraCompletionConnection();
            else {
                expect(levelSource).toContain('this.completeLevelProgression({');
                expect(levelSource).toContain(`achievementLevelId: '${contract.levelId}'`);
                expect(levelSource).toContain(`shipPartId: '${contract.shipPartId}'`);
            }
        });
    });

    test('regional victories share the Sanctuary summary; final manual repair remains separate', () => {
        Object.keys(completionContracts).forEach(sceneKey => {
            const levelSource = readSource(`scenes/levels/${sceneKey}.js`);

            if (sceneKey === 'FinalVoidLevel') {
                expect(levelSource).toContain('[ INSTALL AT WANDERER-77 ]');
                expect(levelSource).toContain('continueFinaleAfterRepair: true');
            } else {
                if (sceneKey === 'MythicalForestLevel') expectForestCompletionConnection();
                else if (sceneKey === 'VoidPeaksLevel') expectPeaksCompletionConnection();
                else if (sceneKey === 'CrystalCavesLevel') expectCrystalCompletionConnection();
                else if (sceneKey === 'ReefLevel') expectReefCompletionConnection();
                else if (sceneKey === 'AuroraDepthsLevel') expectAuroraCompletionConnection();
                else expect(levelSource).toContain('this.showRegionalVictorySummary()');
                expect(levelSource).not.toContain('this.returnToSanctuary()');
            }
        });

        const baseLevelSource = readSource('scenes/PlatformerLevelScene.js');
        expect(baseLevelSource).toMatch(
            /returnToHub\([\s\S]*?this\.scene\.start\('HubWorldScene'\)/
        );
        expect(baseLevelSource).toContain('shipReconstructionHandoff: result.shipPartAwarded === true');
    });

    test('every playable boss route implements test mode', () => {
        Object.keys(completionContracts).forEach(sceneKey => {
            const levelSource = readSource(`scenes/levels/${sceneKey}.js`);
            if (sceneKey === 'FinalVoidLevel') {
                expect(levelSource).toContain(
                    'this.testMode = data?.testMode || this.resultPreview'
                );
            } else {
                expect(levelSource).toContain(
                    'this.testMode = data?.testMode || false'
                );
            }
            expect(levelSource).toContain('startTestMode()');
            expect(levelSource).toContain('if (this.testMode)');
        });
    });

    test('level-entry QA can reproduce the real mobile viewport contract', () => {
        const gameSource = readSource('game.js');
        expect(gameSource).toContain('platformerPreviewSize:');
        expect(gameSource).toContain("urlParams.get('previewSize') === 'mobile'");
    });

    test('final unlock and New Game+ reference the current five-level campaign', () => {
        const hubWorldSource = readSource('scenes/HubWorldScene.js');
        const victorySource = readSource('scenes/VictoryScene.js');

        expect(hubWorldSource).toContain("'hull_plating'");
        expect(hubWorldSource).not.toContain("{ icon: '👑', name: 'Command Module', delay: 2400");
        expect(victorySource).toContain("hubWorld.gates.stellar_reef.unlocked");
        expect(victorySource).toContain("hubWorld.gates.void_peaks.unlocked");
        expect(victorySource).not.toContain("hubWorld.gates.reef.unlocked");
    });
});

const fs = require('fs');
const path = require('path');

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
        const sceneLoaderSource = readSource('utils/SceneLoader.js');

        Object.entries(playableLevelMappings).forEach(([gateId, sceneKey]) => {
            expect(gameStateSource).toContain(`${gateId}:`);
            expect(hubWorldSource).toContain(`'${gateId}': '${sceneKey}'`);
            expect(sceneLoaderSource).toContain(`'${gateId}': '${sceneKey}'`);
            expect(sceneLoaderSource).toContain(`${sceneKey}: () => import('../scenes/levels/${sceneKey}.js')`);
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
            expect(levelSource).toContain('this.completeLevelProgression({');
            expect(levelSource).toContain(`achievementLevelId: '${contract.levelId}'`);
            expect(levelSource).toContain(`shipPartId: '${contract.shipPartId}'`);
        });
    });

    test('every victory returns through the Hub so queued debriefs appear immediately', () => {
        Object.keys(completionContracts).forEach(sceneKey => {
            const levelSource = readSource(`scenes/levels/${sceneKey}.js`);

            expect(levelSource).toContain('[ RETURN TO HUB ]');
            expect(levelSource).toContain('this.returnToHub()');
            expect(levelSource).not.toContain('this.returnToSanctuary()');
        });

        const baseLevelSource = readSource('scenes/PlatformerLevelScene.js');
        expect(baseLevelSource).toMatch(
            /returnToHub\(\) \{[\s\S]*?this\.scene\.start\('HubWorldScene'\)/
        );
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

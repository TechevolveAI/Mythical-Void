const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const zonesSource = read('systems/world/SanctuaryZones.js');
const builderSource = read('systems/world/WorldBuilder.js');
const gameSceneSource = read('scenes/GameScene.js');
const gameSource = read('game.js');
const hatchingSource = read('scenes/HatchingScene.js');

describe('Signal Garden sanctuary contract', () => {
    test('replaces the locked placeholder with an interactive Sanctuary landmark', () => {
        expect(zonesSource).toContain("name: 'Signal Garden'");
        expect(zonesSource).toContain("onInteract: 'tendSignalGarden'");
        expect(zonesSource).toContain('locked: false');
        expect(zonesSource).not.toContain('(Coming Soon)');
    });

    test('builds and refreshes all four visual growth stages', () => {
        expect(builderSource).toContain(
            'const signalGarden = this.createSignalGarden(landmarks.signalGarden)'
        );
        expect(builderSource).toContain('refreshSignalGarden(garden, requestedStage');
        ['seed', 'sprout', 'bud', 'bloom'].forEach(stage => {
            expect(builderSource).toContain(`'${stage}'`);
        });
    });

    test('supports keyboard and mobile tending with saved relationship rewards', () => {
        expect(gameSceneSource).toContain('handleSignalGardenProximity');
        expect(gameSceneSource).toContain("updateInteractIcon('🌱')");
        expect(gameSceneSource).toContain('this.tendSignalGarden()');
        expect(gameSceneSource).toContain(
            "window.GameState.set('world.signalGarden', result.state)"
        );
        expect(gameSceneSource).toContain("this.recordBondActivity('garden')");
        expect(gameSceneSource).toContain("garden: 5");
        expect(gameSceneSource).toContain(
            "event: 'signal_garden_tended'"
        );
    });

    test('provides a local non-mutating stage preview route', () => {
        expect(gameSource).toContain("const testGarden = urlParams.get('testGarden')");
        expect(gameSource).toContain(
            "game.scene.start('GameScene', { signalGardenPreview: testGarden })"
        );
        expect(hatchingSource).toContain("previewParams.has('testGarden')");
        expect(gameSceneSource).toContain('createSignalGardenPreview()');
    });
});

const fs = require('fs');
const path = require('path');
const projectBeacon = require('../config/project-beacon.json');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const gameSceneSource = read('scenes/GameScene.js');
const waypointSource = read('systems/ui/ProjectBeaconWaypoint.js');
const collectibleSource = read('systems/CollectibleManager.js');
const gameSource = read('game.js');
const hatchingSource = read('scenes/HatchingScene.js');

describe('Living Signal first-session contract', () => {
    test('uses a dedicated observation objective instead of generic loot', () => {
        const mission = projectBeacon.fieldMissions.find(
            entry => entry.id === 'beacon_living_signals'
        );

        expect(mission.objective).toEqual(expect.objectContaining({
            type: 'observe_living_signal',
            target: 3
        }));
        expect(mission.objective.signalIds).toEqual([
            'echo_bloom',
            'memory_stone',
            'rootlight'
        ]);
        expect(collectibleSource).not.toContain(
            "trackProgress('observe_living_signal'"
        );
        expect(gameSceneSource).toContain(
            "trackProgress?.('observe_living_signal'"
        );
    });

    test('requires a short companion-led listening dwell and saves each encounter', () => {
        expect(gameSceneSource).toContain('checkLivingSignalProximity(delta');
        expect(gameSceneSource).toContain('this.livingSignalDwellMs >= 800');
        expect(gameSceneSource).toContain('nearest.distance > 150');
        expect(gameSceneSource).toContain('approach with your companion and stay close');
        expect(gameSceneSource).toContain('LIVING SIGNAL // APPROACH');
        expect(gameSceneSource).not.toContain(
            "activeStoryQuest?.id !== 'beacon_living_signals'"
        );
        expect(gameSceneSource).toContain(
            "window.GameState.set('world.livingSignals', result.state)"
        );
        expect(gameSceneSource).toContain("this.recordBondActivity('signal')");
        expect(gameSceneSource).toContain('showLivingSignalMoment(result)');
    });

    test('targets only unobserved authored signals', () => {
        expect(waypointSource).toContain("targetKey: 'nearestLivingSignal'");
        expect(waypointSource).toContain('scene.livingSignals || []');
        expect(waypointSource).toContain('!signal.observed');
        expect(waypointSource).not.toContain("targetKey: 'nearestCollectible'");
    });

    test('provides local non-mutating encounter previews', () => {
        expect(gameSource).toContain(
            "const testLivingSignal = urlParams.get('testLivingSignal')"
        );
        expect(gameSource).toContain('livingSignalPreview: testLivingSignal');
        expect(hatchingSource).toContain("previewParams.has('testLivingSignal')");
        expect(gameSceneSource).toContain('createLivingSignalPreview()');
    });
});

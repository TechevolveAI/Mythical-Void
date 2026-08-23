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
        expect(gameSceneSource).toContain('Not an Earth transmission');
        expect(gameSceneSource).toContain(
            'LIVING SIGNAL // LISTEN TOGETHER'
        );
        expect(gameSceneSource).toContain('LISTENING ${percent}% // HOLD STILL');
        expect(gameSceneSource).toContain('this.livingSignalDwellMs / 800');
        expect(gameSceneSource).toContain('listeningProgress?.arc?.(');
        expect(projectBeacon.fieldMissions.find(
            mission => mission.id === 'beacon_living_signals'
        ).briefing).toContain('not messages from Earth');
        expect(gameSceneSource).not.toContain(
            "activeStoryQuest?.id !== 'beacon_living_signals'"
        );
        expect(gameSceneSource).toContain(
            "window.GameState.set('world.livingSignals', result.state)"
        );
        expect(gameSceneSource).toContain('recordCurrentSignalObservation');
        expect(gameSceneSource).toContain('window.GameState.save?.()');
        expect(gameSceneSource).toContain("this.recordBondActivity('signal')");
        expect(gameSceneSource).toContain('this.showLivingSignalMoment({');
        expect(gameSceneSource).toContain('CURRENT NETWORK // ${currentStatus}');
        expect(gameSceneSource).toContain(
            'NEXT // Follow the marked pulse. Listen ${result.progress}/${result.total}.'
        );
        expect(gameSceneSource).toContain(
            'NEXT // Follow your companion toward the World Gate.'
        );
    });

    test('leaves observed signals visibly alive and linked instead of consuming them', () => {
        expect(gameSceneSource).toContain('setLivingSignalLinkedState(');
        expect(gameSceneSource).toContain(
            'CURRENT LINKED // ${progress}/${total}'
        );
        expect(gameSceneSource).toContain('signal.container?.addAt?.(linkVisual, 0)');
        expect(gameSceneSource).toContain('signal.container?.setAlpha?.(0.96)');
        expect(gameSceneSource).not.toContain("setText('SIGNAL HEARD')");
        expect(gameSceneSource).not.toContain('signal.container?.setAlpha(0.58)');
    });

    test('keeps signal captions quiet until the player approaches', () => {
        expect(gameSceneSource).toContain('showLabel = false');
        expect(gameSceneSource).toContain('.setVisible(showLabel)');
        expect(gameSceneSource).toContain('setLivingSignalLabelFocus(signalId = null)');
        expect(gameSceneSource).toContain('this.setLivingSignalLabelFocus();');
        expect(gameSceneSource).toContain(
            'this.setLivingSignalLabelFocus(nearest.signal.signalId);'
        );
        expect(gameSceneSource).toContain('if (nearest.signal.observed)');
        expect(gameSceneSource).toContain('}, false, { showLabel: true });');
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
        expect(gameSource).toContain("'testLivingSignalProgress'");
        expect(gameSource).toContain('livingSignalPreview: testLivingSignal');
        expect(gameSource).toContain('livingSignalPreviewSize:');
        expect(gameSceneSource).toContain(
            "this.livingSignalPreviewSize === 'mobile'"
        );
        expect(gameSceneSource).toContain(
            "this.livingSignalPreviewSize === 'mobile'\n            ? 390"
        );
        expect(gameSource).toContain('livingSignalProgressPreview: Number.isFinite(');
        expect(hatchingSource).toContain("previewParams.has('testLivingSignal')");
        expect(gameSceneSource).toContain('createLivingSignalPreview()');
        expect(gameSceneSource).toContain(
            'data?.livingSignalProgressPreview !== null'
        );
        expect(gameSceneSource).toContain(
            'data?.livingSignalProgressPreview !== undefined'
        );
    });
});

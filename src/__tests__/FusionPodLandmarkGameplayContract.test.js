const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('Fusion Pod physical landmark gameplay contract', () => {
    const zones = read('../systems/world/SanctuaryZones.js');
    const world = read('../systems/world/WorldBuilder.js');
    const scene = read('../scenes/GameScene.js');
    const bootstrap = read('../game.js');

    test('places one persistent interactable Fusion Pod in the Sanctuary', () => {
        expect(zones).toContain('fusionPod: {');
        expect(zones).toContain("onInteract: 'openFusionPod'");
        expect(world).toContain(
            'createFusionPodLandmark(landmarkData, snapshotOverride = null)'
        );
        expect(world).toContain('fusionPodLandmark');
        expect(world).toContain("'FUSION POD'");
    });

    test('wires proximity, mobile affordance, interaction, and state refresh', () => {
        expect(scene).toContain('handleFusionPodProximity');
        expect(scene).toContain("id: 'fusionPod'");
        expect(scene).toContain("icon: '🧬'");
        expect(scene).toContain('this.offerSanctuaryInteraction({');
        expect(scene).toContain('if (this.nearFusionPod)');
        expect(scene).toContain('this.openFusionPod();');
        expect(scene).toContain("'fusionPodDiscovered'");
        expect(scene).toContain("'breedingCompleted'");
        expect(scene).toContain('refreshFusionPodWorldLandmark()');
    });

    test('keeps local responsive previews non-mutating and out of production routes', () => {
        expect(bootstrap).toContain(
            "const testFusionLandmark = urlParams.get("
        );
        expect(bootstrap).toContain('isLocalPreview &&');
        expect(scene).toContain('createFusionLandmarkPreview()');
        expect(scene).toContain('TWO CREATURES REQUIRED');
        expect(scene).toContain('FIELD CALIBRATION 3/5');
        expect(scene).toContain('TWO ADULT CREATURES READY');
    });
});

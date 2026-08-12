const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('rescued resident gameplay contract', () => {
    const platformer = read('scenes/PlatformerLevelScene.js');
    const gameScene = read('scenes/GameScene.js');
    const worldBuilder = read('systems/world/WorldBuilder.js');
    const aurora = read('scenes/levels/AuroraDepthsLevel.js');
    const finalVoid = read('scenes/levels/FinalVoidLevel.js');
    const gameState = read('systems/GameState.js');
    const globalInit = read('global-init.js');

    test('releases a non-boss resident at the shared completion boundary', () => {
        expect(platformer).toContain('?.recordRescuedResident?.(');
        expect(platformer).toContain('showRescuedResidentReleaseMoment');
        expect(platformer).toContain('PROJECT BEACON // LIFE SIGNAL RELEASED');
        expect(platformer).toContain('RETURN WITH ${resident.name.toUpperCase()}');
        expect(platformer).toContain("momentId: `resident_release_${resident.id}`");
    });

    test('spawns persistent residents with moving interaction zones', () => {
        expect(worldBuilder).toContain('refreshRescuedResidents(garden, snapshot = null)');
        expect(worldBuilder).toContain('zone.rescuedResidentId = definition.id');
        expect(worldBuilder).toContain("'SUPPORT READY'");
        expect(worldBuilder).toContain('zone.body?.updateFromGameObject?.()');
        expect(gameState).toContain('rescuedResidents: {');
        expect(globalInit).toContain("import './systems/RescuedResidents.js'");
    });

    test('lets the player check supplies and understand the benefit', () => {
        expect(gameScene).toContain('this.setupRescuedResidentOverlaps()');
        expect(gameScene).toContain('this.interactWithRescuedResident();');
        expect(gameScene).toContain('SANCTUARY // RESCUED RESIDENT');
        expect(gameScene).toContain('SUPPORT APPLIES ON THE NEXT EXPEDITION');
        expect(gameScene).toContain('rescued_resident_check_in');
    });

    test('makes the Aurora-to-Final-Void handoff explicit', () => {
        expect(aurora).toContain('FINAL ROUTE IDENTIFIED');
        expect(aurora).toContain(
            'Install the Aurora Reactor at Wanderer-77. The Final Void opens next.'
        );
        expect(aurora).toContain('[ INSTALL AURORA REACTOR ]');
        expect(gameScene).toContain(
            "this.shipReconstructionNextGateLabel === 'The Final Void'"
        );
        expect(gameScene).toContain("this.scene.start('HubWorldScene')");
        expect(gameScene).toContain('this.shipEvidenceBoardModal?.hide?.()');
    });

    test('keeps a local visual preview for release-scene regression testing', () => {
        expect(finalVoid).toContain(
            "?.getRescuedResidentByLevel?.('finalVoid')"
        );
        expect(finalVoid).toContain('this.showRescuedResidentReleaseMoment(');
    });
});

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
        expect(platformer).toContain(
            'WELCOME ${resident.name.toUpperCase()} TO THE SANCTUARY'
        );
        expect(platformer).toContain("momentId: `resident_release_${resident.id}`");
    });

    test('spawns persistent residents with moving interaction zones', () => {
        expect(worldBuilder).toContain('refreshRescuedResidents(garden, snapshot = null, {');
        expect(worldBuilder).toContain('zone.rescuedResidentId = definition.id');
        expect(worldBuilder).toContain("'COMMUNITY'");
        expect(worldBuilder).toContain('zone.body?.updateFromGameObject?.()');
        expect(worldBuilder).toContain("'single_world_location_v2'");
        expect(worldBuilder).toContain('presence.representedInVillage && !arrivalPending');
        expect(gameScene).toContain('this.refreshSanctuaryResidentPresence(nextSnapshot);');
        expect(gameState).toContain('rescuedResidents: {');
        expect(globalInit).toContain("import './systems/RescuedResidents.js'");
    });

    test('welcomes every rescued resident into the Sanctuary exactly once', () => {
        const residents = read('systems/RescuedResidents.js');

        expect(residents).toContain('sanctuaryArrivalSeenIds');
        expect(residents).toContain('getPendingRescuedResidentArrival(gameState)');
        expect(residents).toContain('snapshot.rescued.find(');
        expect(residents).toContain('acknowledgeRescuedResidentArrival(');
        expect(gameScene).toContain('scheduleRescuedResidentArrival({ initialDelay: 1900 })');
        expect(gameScene).toContain('playRescuedResidentArrival({ force = false } = {})');
        expect(gameScene).toContain('finishRescuedResidentArrival({ skipped = false } = {})');
        expect(gameScene).toContain("event: 'rescued_resident_arrival'");
        expect(worldBuilder).toContain('playRescuedResidentArrival(garden, resident');
        expect(worldBuilder).toContain('JOINED THE SANCTUARY`');
        expect(worldBuilder).toContain('SANCTUARY RESIDENT');
        expect(worldBuilder).toContain(
            ".setData('residentCommunityStatus', 'sanctuary_resident')"
        );
        expect(worldBuilder).toContain(".setData('authoredPortraitVisible', Boolean(portrait))");
    });

    test('lets the player talk with residents and understand their contribution', () => {
        expect(gameScene).toContain('this.setupRescuedResidentOverlaps()');
        expect(gameScene).toContain('this.interactWithRescuedResident();');
        expect(gameScene).toContain('SANCTUARY // COMMUNITY');
        expect(gameScene).toContain('THEIR WORK CHANGES THE NEXT EXPEDITION');
        expect(gameScene).toContain('resident.contributionLine');
        expect(gameScene).toContain('LIVES IN THE SIGNAL GARDEN');
        expect(gameScene).toContain(".setData('rescuedResidentAuthoredPortrait', true)");
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

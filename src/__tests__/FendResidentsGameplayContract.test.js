const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Fend resident gameplay contract', () => {
    const gameScene = read('scenes/GameScene.js');
    const worldBuilder = read('systems/world/WorldBuilder.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');
    const beaconModal = read('ui/ProjectBeaconLogModal.js');
    const globalInit = read('global-init.js');

    test('renders separate resident interaction zones and prioritizes them over the garden', () => {
        expect(worldBuilder).toContain('refreshFendResidents(garden, snapshot = null)');
        expect(worldBuilder).toContain('zone.residentId = definition.id');
        expect(gameScene).toContain('this.setupFendResidentOverlaps()');
        expect(gameScene).toMatch(
            /if \(this\.nearFendResidentId\)[\s\S]*this\.interactWithFendResident\(\);[\s\S]*if \(this\.nearSignalGarden\)/
        );
    });

    test('uses a responsive full-width field exchange instead of another nested card', () => {
        expect(gameScene).toContain('showFendResidentExchange(result)');
        expect(gameScene).toContain("overlay.fillRect(0, top, width, bandHeight)");
        expect(gameScene).toContain('FEND COMMONS // COOPERATIVE REQUEST');
        expect(gameScene).toContain('TRUST +8  //  COMMUNITY MEMORY RECORDED');
    });

    test('surfaces resident progress in Project Beacon and loads the state system globally', () => {
        expect(beaconModal).toContain(
            'SETTLERS ${log.fendResidents.metCount}/${log.fendResidents.totalResidents}'
        );
        expect(beaconModal).toContain(
            'REQUESTS ${log.fendResidents.completedCount}/${log.fendResidents.totalResidents}'
        );
        expect(globalInit).toContain("import './systems/FendResidents.js';");
    });

    test('provides local non-saving preview routes for all resident stages and exchanges', () => {
        expect(game).toContain("['0', '1', '2', '3', '4'].includes(testResidents)");
        expect(game).toContain('residentPreview: Number(testResidents)');
        expect(game).toContain('residentExchangePreview: Number(testResidentExchange)');
        expect(hatching).toContain("previewParams.has('testResidents')");
        expect(hatching).toContain("previewParams.has('testResidentExchange')");
    });
});

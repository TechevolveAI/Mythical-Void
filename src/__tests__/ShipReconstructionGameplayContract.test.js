const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Wanderer-77 reconstruction gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/ShipEvidenceBoardModal.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const gameState = read('systems/GameState.js');
    const game = read('game.js');

    test('routes recovered systems through a player-operated ship repair', () => {
        expect(scene).toContain(
            'getShipReconstructionSnapshot'
        );
        expect(scene).toContain(
            'installShipReconstructionStep'
        );
        expect(scene).toMatch(
            /senseiMemory\.ready[\s\S]*shipReconstruction\.ready[\s\S]*shipEvidence\.ready/
        );
        expect(story).toContain(
            'SHIP RECONSTRUCTION //'
        );
        expect(story).toContain(
            'formatShipReconstructionObjective'
        );
        const hub = read('scenes/HubWorldScene.js');
        expect(hub).toContain('shipReconstructionHandoff: true');
        expect(hub).toContain('`INSTALL ${partName.toUpperCase()}`');
        expect(scene).toContain('this.shipReconstructionHandoff');
        expect(scene).toContain(
            'WANDERER-77 // RECOVERED SYSTEM READY TO INSTALL'
        );
        expect(scene).toContain(
            'if (!snapshot.available && !reconstruction.available) return;'
        );
        expect(modal).toContain(
            '!snapshot?.available &&\n            !reconstruction?.available'
        );
        expect(modal).toContain(
            'snapshot?.available ? snapshot.sections : []'
        );
        expect(modal).toContain("overlay.on('pointerdown', pointer => {");
        expect(modal).toContain('this.activatePointerRegion(pointer)');
        expect(modal).toContain('registerPointerRegion({');
        expect(modal).toContain('activatePointerRegion(pointer)');
        expect(modal).not.toContain("close.on('pointerdown', () => this.hide())");
        expect(modal).not.toContain("zone.on('pointerup'");
        expect(modal).toContain(
            'const archiveComplete = snapshot?.complete === true;'
        );
        expect(modal).toContain('priority: 30');
        expect(modal).toContain('priority: 50');
        expect(modal).toContain('(buttonWidth - labelText.width) / 2');
        expect(modal).toContain('(buttonHeight - labelText.height) / 2');
        expect(scene).toContain(
            'INSTALL ${currentReconstruction.readyStep.partName.toUpperCase()} BEFORE THE NEXT EXPEDITION'
        );
        expect(scene).toContain('WANDERER-77 SYSTEM ONLINE${nextRoute}');
        expect(scene).toMatch(
            /if \(this\.shipReconstructionHandoff\)[\s\S]*currentReconstruction\.finalVoidReady[\s\S]*this\.scene\.start\('HubWorldScene'\)/
        );
        expect(scene).toMatch(
            /this\.continueFinaleAfterRepair \|\|[\s\S]*this\.shipReconstructionHandoff[\s\S]*shipEvidenceBoardModal\?\.hide/
        );
    });

    test('keeps repair, departure, transmission, and consent separate', () => {
        expect(modal).toContain(
            'WANDERER-77 RECONSTRUCTION'
        );
        expect(modal).toContain(
            'Capability is not permission to launch'
        );
        expect(modal).toContain(
            'NO LAUNCH  //  TRAVEL UNDECIDED'
        );
        expect(legacy).toContain(
            "secureReturnVector: 'unavailable'"
        );
        const hub = read('scenes/HubWorldScene.js');
        expect(hub).toContain('this.shipReconstruction?.finalVoidReady');
        expect(hub).not.toContain('VOID VOYAGE READY');
    });

    test('persists and resets the reconstruction ledger', () => {
        expect(gameState).toContain('shipReconstruction: {');
        expect(gameState).toContain('completedStepIds: []');
        expect(gameState).toContain('shipFieldSupport: {');
        expect(read('scenes/VictoryScene.js')).toContain(
            'shipReconstruction: {'
        );
        expect(read('scenes/VictoryScene.js')).toContain(
            'shipFieldSupport: {'
        );
    });

    test('provides non-saving repair previews for responsive QA', () => {
        expect(game).toContain("'repair_0'");
        expect(game).toContain("'repair_3'");
        expect(game).toContain("'repair_final'");
        expect(game).toContain("'repair_complete'");
        expect(game).toContain("'berth'");
        expect(scene).toContain(
            "this.shipEvidencePreview.startsWith('repair_')"
        );
        const hub = read('scenes/HubWorldScene.js');
        expect(game).toContain("'finalApproach'");
        expect(hub).toContain(
            "this.progressionPreviewSize === 'mobile'"
        );
    });

    test('turns the first repair into bounded current-game utility', () => {
        expect(scene).toContain(
            'serviceCompanionAtPoweredBerth'
        );
        expect(scene).toContain(
            'powered_berth_service'
        );
        expect(modal).toContain(
            'SERVICE COMPANION AT POWERED BERTH'
        );
        expect(modal).toContain(
            'BERTH ${reconstruction.fieldSupport.status}'
        );
    });

    test('states the later local diagnostic benefits in the repair ledger', () => {
        const reconstruction = read('systems/ShipReconstruction.js');
        expect(reconstruction).toContain(
            'local route modelling are available'
        );
        expect(reconstruction).toContain(
            'read local Current stress without taking a sample'
        );
        expect(reconstruction).toContain(
            'local stellar forecast without sending Fend coordinates'
        );
        expect(reconstruction).toContain(
            'verify its local diagnostic model'
        );
    });
});

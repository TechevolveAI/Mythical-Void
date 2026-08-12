const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Wanderer-77 ship evidence gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/ShipEvidenceBoardModal.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const gameState = read('systems/GameState.js');
    const victory = read('scenes/VictoryScene.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('uses the ship as the ordered review hub', () => {
        expect(scene).toMatch(
            /if \(senseiMemory\.ready\)[\s\S]*showSenseiMemory\(\)[\s\S]*else if \(shipEvidence\.ready\)[\s\S]*showShipEvidenceBoard\(\)[\s\S]*else if \(consent\.ready\)/
        );
        expect(scene).toContain(
            'Open ship and evidence board'
        );
        expect(scene).toContain(
            'shipEvidenceBoardModal?.isVisible'
        );
        expect(scene).toContain(
            'this.shipEvidenceBoardModal?.destroy?.()'
        );
    });

    test('states the protected evidence boundary without implying departure', () => {
        expect(modal).toContain(
            'WANDERER-77 // SHIP & EVIDENCE BOARD'
        );
        expect(modal).toContain('NO TRANSMISSION');
        expect(modal).toContain('COORDINATES SEALED');
        expect(modal).toContain('TRAVEL UNDECIDED');
        expect(modal).toContain('buttonHeight = 50');
        expect(modal).toContain('44');
    });

    test('surfaces the review in Project Beacon and the sequel capsule', () => {
        expect(story).toContain('SHIP ARCHIVE // REVIEW');
        expect(story).toContain('shipEvidence,');
        expect(legacy).toContain(
            'export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
        expect(legacy).toContain('shipArchive: {');
        expect(legacy).toContain("transmissionStatus: 'not_sent'");
    });

    test('persists and resets the campaign review at the correct boundary', () => {
        expect(gameState).toContain('shipArchive: {');
        expect(gameState).toContain('archiveHistory');
        expect(victory).toContain('shipArchive: {');
        expect(victory).toContain('reviewedSectionIds: []');
    });

    test('provides local desktop and mobile previews for every section', () => {
        expect(game).toContain(
            "'protocol_complete'"
        );
        expect(game).toContain('shipEvidencePreview: testShipBoard');
        expect(game).toContain('shipEvidencePreviewSize:');
        expect(scene).toContain(
            "this.shipEvidencePreviewSize === 'mobile'"
        );
        expect(hatching).toContain(
            "previewParams.has('testShipBoard')"
        );
    });
});

const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Protected Return Protocol gameplay contract', () => {
    const globalInit = read('global-init.js');
    const gameState = read('systems/GameState.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/ShipEvidenceBoardModal.js');
    const victory = read('scenes/VictoryScene.js');
    const game = read('game.js');

    test('loads before save migration and persists a bounded protocol record', () => {
        expect(globalInit).toMatch(
            /import '\.\/systems\/ProtectedReturnProtocol\.js';[\s\S]*import '\.\/systems\/GameState\.js';/
        );
        expect(gameState).toContain(
            'protectedReturnProtocol: {'
        );
        expect(gameState).toContain(
            "transmissionStatus: 'not_sent'"
        );
        expect(gameState).toContain(
            'normalizeProtectedReturnState'
        );
    });

    test('plays through the ship only after evidence and companion boundaries', () => {
        expect(scene).toMatch(
            /else if \(shipEvidence\.ready\)[\s\S]*else if \(consent\.ready\)[\s\S]*protectedReturn\.ready/
        );
        expect(scene).toContain(
            "event: 'protected_return_safeguard'"
        );
        expect(modal).toContain(
            'PROTECTED RETURN PROTOCOL'
        );
        expect(modal).toContain(
            'REPORT HELD  //  NO TRANSMISSION'
        );
        expect(modal).toContain(
            'OPEN RETURN PROTOCOL'
        );
    });

    test('makes the objective visible without choosing departure or contact', () => {
        expect(story).toContain(
            'RETURN PROTOCOL // ${protectedReturn.completedCount} OF ${protectedReturn.totalSteps}'
        );
        expect(story).toContain(
            'RETURN PROTOCOL // SEALED'
        );
        expect(story).toContain(
            'formatProtectedReturnObjective'
        );
        expect(story).toContain(
            'protectedReturn,'
        );
    });

    test('exports only the sealed packet contract for later chapters', () => {
        expect(legacy).toContain(
            'export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
        expect(legacy).toContain(
            'protectedReturnProtocol: {'
        );
        expect(legacy).toContain(
            'reportableEvidence: normalizeStringList'
        );
        expect(legacy).toContain(
            'protectedFindings: normalizeStringList'
        );
        expect(legacy).toContain(
            "transmissionStatus: 'not_sent'"
        );
    });

    test('resets the current run and provides desktop/mobile preview routes', () => {
        expect(victory).toContain(
            'protectedReturnProtocol: {'
        );
        expect(victory).toContain(
            'completedStepIds: []'
        );
        expect(game).toContain("'protocol_0'");
        expect(game).toContain("'protocol_3'");
        expect(game).toContain("'protocol_complete'");
        expect(scene).toContain(
            "this.shipEvidencePreview.startsWith('protocol_')"
        );
    });
});

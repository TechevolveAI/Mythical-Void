const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Remain and Defend gameplay contract', () => {
    const campaign = read('systems/RemainAndDefendCampaign.js');
    const story = read('systems/ProjectBeaconStory.js');
    const log = read('ui/ProjectBeaconLogModal.js');
    const scene = read('scenes/GameScene.js');
    const legacy = read('systems/CampaignLegacy.js');
    const state = read('systems/GameState.js');
    const globalInit = read('global-init.js');
    const game = read('game.js');

    test('coordinates existing systems rather than copying their state', () => {
        [
            'getCurrentEcologySnapshot',
            'getFendCommunitySnapshot',
            'getFendResidentsSnapshot',
            'getFendCultureSnapshot',
            'getCompanionConsentSnapshot',
            'getSenseiMemorySnapshot',
            'getShipEvidenceSnapshot',
            'getProtectedReturnSnapshot',
            'getCurrentVeilSnapshot'
        ].forEach(helper => expect(campaign).toContain(helper));
        expect(campaign).toContain(
            "gameState.set('story.projectBeacon.remainAndDefend', state)"
        );
        expect(campaign).not.toContain('playerName');
        expect(campaign).not.toContain('coordinates:');
    });

    test('gives Project Beacon one readable recovery chapter', () => {
        expect(story).toContain('getRemainAndDefendSnapshot(gameState)');
        expect(story).toContain('REMAIN AND DEFEND // COMMONS COUNCIL');
        expect(story).toContain('remainAndDefend,');
        expect(log).toContain("'recovery'");
        expect(log).toContain('REMAIN AND DEFEND // RECOVERY CHAPTER');
        expect(log).toContain('campaign.phases.forEach');
        expect(log).toContain('HOLD THE COMMONS COUNCIL');
        expect(log).toContain('buttonHeight = 48');
        expect(log).toContain('const short = height < 520');
        expect(log).toContain('const columnCount = short ? 2 : 1');
        expect(game).toContain(
            "['mission', 'recovery', 'archive', 'memory'].includes("
        );
        expect(scene).toContain(
            "const recoveryPreview = this.beaconLogPreview === 'recovery'"
        );
    });

    test('makes Ilyra the physical route into the closing council', () => {
        expect(scene).toContain(
            'const recovery = getRemainAndDefendSnapshot(window.GameState)'
        );
        expect(scene).toContain("action = 'Hold Commons Council'");
        expect(scene).toContain("this.recoveryLogModal.show('recovery')");
        expect(scene).toMatch(
            /residentId === 'ilyra'[\s\S]*recovery\.councilReady[\s\S]*showRemainAndDefendCampaign/
        );
    });

    test('advances the portable chronology only after chapter completion', () => {
        expect(legacy).toContain(
            'CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
        expect(legacy).toMatch(
            /sourceChapter: remainAndDefend\.complete[\s\S]*'remain_and_defend'[\s\S]*'crashfall'/
        );
        expect(legacy).toMatch(
            /nextChapter: remainAndDefend\.complete[\s\S]*'secret_homecoming'[\s\S]*'remain_and_defend'/
        );
        expect(legacy).toContain("transmissionStatus: 'not_sent'");
    });

    test('provides a default save record, migration, and global runtime hook', () => {
        expect(state).toContain('remainAndDefend: {');
        expect(state).toContain('seenRemainOperations');
        expect(globalInit).toContain(
            "import './systems/RemainAndDefendCampaign.js';"
        );
    });
});

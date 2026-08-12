const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Quiet Current gameplay consequence contract', () => {
    const globalInit = read('global-init.js');
    const gameState = read('systems/GameState.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const world = read('systems/world/WorldBuilder.js');
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/CurrentVeilModal.js');
    const victory = read('scenes/VictoryScene.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('loads before save migration and persists only bounded mission state', () => {
        expect(globalInit).toMatch(
            /import '\.\/systems\/CurrentVeilMission\.js';[\s\S]*import '\.\/systems\/GameState\.js';/
        );
        expect(gameState).toContain('currentVeilMission: {');
        expect(gameState).toContain(
            'normalizeCurrentVeilState'
        );
        expect(gameState).toContain(
            "transmissionStatus: 'not_sent'"
        );
    });

    test('places three authored anchors in the world without saving their coordinates', () => {
        expect(world).toContain('refreshCurrentVeilMission');
        expect(world).toContain('CURRENT_VEIL_ANCHORS');
        expect(world).toContain('currentVeilAnchorId');
        expect(scene).toContain(
            'setupCurrentVeilAnchorOverlaps'
        );
        expect(scene).toContain(
            'interactWithCurrentVeilAnchor'
        );
        expect(scene).toContain(
            "event: 'current_veil_anchor_stabilized'"
        );
    });

    test('starts with Ilyra and verifies at Wanderer-77 after all anchors', () => {
        expect(scene).toMatch(
            /residentId === 'ilyra'[\s\S]*currentVeil\.available[\s\S]*showCurrentVeilMission/
        );
        expect(scene).toContain(
            "currentVeil.verificationReady"
        );
        expect(scene).toContain(
            'verifyPacket: true'
        );
        expect(modal).toContain(
            'A ROUTE WITHOUT COORDINATES'
        );
        expect(modal).toContain(
            'ROUTE INFERENCE BLOCKED'
        );
        expect(modal).toContain('NO SIGNAL SENT');
        expect(modal).toContain('buttonHeight = 50');
    });

    test('surfaces the consequence in Project Beacon and the sequel capsule', () => {
        expect(story).toContain(
            'FEND CONSEQUENCE // QUIET CURRENT'
        );
        expect(story).toContain(
            'QUIET CURRENT // VERIFY'
        );
        expect(story).toContain('currentVeil,');
        expect(legacy).toContain(
            'export const CAMPAIGN_LEGACY_SCHEMA_VERSION = 16'
        );
        expect(legacy).toContain('currentVeil: {');
        expect(legacy).toContain(
            "survivalProofStatus: 'preserved'"
        );
        expect(legacy).toContain(
            "transmissionStatus: 'not_sent'"
        );
    });

    test('resets the current run and exposes deterministic responsive previews', () => {
        expect(victory).toContain(
            "state?.set('world.currentVeilMission'"
        );
        expect(game).toContain("'testCurrentVeil'");
        expect(game).toContain(
            'currentVeilPreview: testCurrentVeil'
        );
        expect(scene).toContain(
            'createCurrentVeilPreview()'
        );
        expect(scene).toContain(
            "this.currentVeilPreviewSize === 'mobile'"
        );
        expect(hatching).toContain(
            "previewParams.has('testCurrentVeil')"
        );
    });
});

const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Companion Earth memory gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/CompanionEarthMemoryModal.js');
    const system = read('systems/CompanionEarthMemory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const homecoming = read('systems/HomecomingHandoff.js');
    const gameState = read('systems/GameState.js');
    const victory = read('scenes/VictoryScene.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('turns Wanderer-77 into a readable companion-led story objective', () => {
        expect(scene).toContain('showCompanionEarthMemory()');
        expect(scene).toContain(
            'Your companion has an Earth question'
        );
        expect(scene).toMatch(
            /earthMemory\.ready \|\| earthMemory\.complete[\s\S]*showCompanionEarthMemory\(\)/
        );
        expect(modal).toContain('YOUR COMPANION ASKS ABOUT EARTH');
        expect(modal).toContain(
            'Show me why it is worth saving.'
        );
    });

    test('offers three authored memories tied to friendship, nature, and humanity', () => {
        expect(system).toContain("id: 'dojo_dawn'");
        expect(system).toContain("id: 'ocean_after_storm'");
        expect(system).toContain("id: 'city_lights'");
        expect(system).toContain('Sensei');
        expect(system).toContain('our planets already share');
        expect(system).toContain('every light');
    });

    test('does not imply travel, reveal coordinates, or send Earth data', () => {
        expect(system).toContain("invitationStatus: 'not_offered'");
        expect(system).toContain('travelConsentRecorded: false');
        expect(system).toContain("transmissionStatus: 'not_sent'");
        expect(modal).toContain(
            'LOCAL MEMORY // NO INVITATION // NO TRANSMISSION'
        );
        expect(modal).toContain(
            'TRAVEL REMAINS UNDISCUSSED'
        );
        expect(system).not.toContain('freeText');
    });

    test('carries only the authored memory ID into the future Homecoming handoff', () => {
        expect(legacy).toContain('companionEarthMemory: {');
        expect(legacy).toContain('travelConsentRecorded: false');
        expect(homecoming).toContain('const EARTH_MEMORY_IDS');
        expect(homecoming).toContain('earthMemory: {');
        expect(homecoming).toContain("invitationStatus: 'not_offered'");
    });

    test('uses full-width bands and stable mobile touch targets', () => {
        expect(modal).toContain('overlay.fillRect(0, top, width, bandHeight)');
        expect(modal).toContain('y + height / 2');
        expect(modal).toMatch(
            /width - 22,[\s\S]*top \+ 28,[\s\S]*44,[\s\S]*44/
        );
        expect(modal).toContain(
            '.setInteractive({ useHandCursor: true })'
        );
        expect(modal).toContain('Math.min(width - 30, 700)');
    });

    test('normalizes saves and resets the conversation for New Game Plus', () => {
        expect(gameState).toContain('companionEarthMemory: {');
        expect(gameState).toContain('knownEarthMemoryIds');
        expect(gameState).toContain('travelConsentRecorded: false');
        expect(victory).toContain('companionEarthMemory: {');
    });

    test('provides local non-saving desktop and mobile previews', () => {
        expect(game).toContain('testEarthMemory');
        expect(game).toContain('testEarthMemorySize');
        expect(game).toContain(
            'companionEarthMemoryPreview: testEarthMemory'
        );
        expect(scene).toContain('createCompanionEarthMemoryPreview()');
        expect(hatching).toContain("previewParams.has('testEarthMemory')");
    });
});

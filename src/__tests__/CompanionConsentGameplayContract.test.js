const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Companion consent gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const modal = read('ui/CompanionConsentModal.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('turns the crashed ship into the next readable objective when ready', () => {
        expect(scene).toContain('showCompanionBoundaryReview()');
        expect(scene).toContain(
            'Earth boundaries ${consent.reviewedCount}/${consent.totalTopics}'
        );
        expect(scene).toMatch(
            /if \(consent\.ready\)[\s\S]*showCompanionBoundaryReview\(\)[\s\S]*showShipMemories\(\)/
        );
    });

    test('lets the companion set route, evidence, and power boundaries', () => {
        expect(modal).toContain(
            'You explain the risks. Your companion decides'
        );
        expect(modal).toContain('RECORD THIS BOUNDARY');
        expect(modal).toContain(
            "TRAVEL REMAINS YOUR COMPANION'S FUTURE CHOICE"
        );
        expect(modal).toContain(
            'A safe seat is not an invitation.'
        );
    });

    test('uses scale-safe centered hit zones with mobile-sized navigation targets', () => {
        expect(modal).toContain('y + height / 2');
        expect(modal).toContain('.setInteractive({ useHandCursor: true })');
        expect(modal).toMatch(
            /width - 22,[\s\S]*top \+ 28,[\s\S]*44,[\s\S]*44/
        );
        expect(modal).toMatch(
            /top \+ bandHeight - 22,[\s\S]*Math\.max\(190, back\.width \+ 24\),[\s\S]*40/
        );
        expect(modal).not.toContain(
            'button.setInteractive(\n                new Phaser.Geom.Rectangle'
        );
    });

    test('guides every finale priority through common recovery and consent', () => {
        expect(story).toContain('EARTH BOUNDARIES //');
        expect(story).toContain(
            'Return to Wanderer-77 with your companion.'
        );
        expect(story).not.toContain(
            "priority === 'remain_and_defend' && !fendResidents.complete"
        );
    });

    test('carries per-companion boundaries into the sequel handoff', () => {
        expect(legacy).toContain('companionId: normalizeText');
        expect(legacy).toContain("'decision_deferred'");
        expect(legacy).toContain("'emergency_life_first'");
        expect(legacy).toContain('reviewedTopics: normalizeStringList');
    });

    test('provides local non-saving previews for menu, topics, and completion', () => {
        expect(game).toContain(
            "['menu', 'route', 'evidence', 'power', 'complete'].includes"
        );
        expect(game).toContain('companionConsentPreview: testConsent');
        expect(hatching).toContain("previewParams.has('testConsent')");
    });
});

const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Creature Profile living portrait continuity contract', () => {
    const profile = read('scenes/CreatureProfileScene.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('pairs the canonical pixel form with the persisted living form', () => {
        expect(profile).toContain("'PIXEL FORM'");
        expect(profile).toContain("'LIVING FORM'");
        expect(profile).toContain('getCreaturePortrait?.(stage)');
        expect(profile).toContain(
            'mediaService?.resolvePortrait?.(stage)'
        );
        expect(profile).toContain(
            'window.CompanionMediaService?.ensureTexture?.('
        );
        expect(profile).toContain(
            'this.waitForProfilePortrait(stage, record, creatureData)'
        );
        expect(profile).toContain('portraitService?.getActiveJob?.(stage)');
        expect(profile).toContain("'companion_profile'");
    });

    test('recovers a missing hatch portrait without duplicating an active job', () => {
        const activeJobIndex = profile.indexOf(
            'const activeJob = portraitService?.getActiveJob?.(stage);'
        );
        const generationIndex = profile.indexOf(
            'return portraitService.generate({'
        );

        expect(activeJobIndex).toBeGreaterThan(-1);
        expect(generationIndex).toBeGreaterThan(activeJobIndex);
        expect(profile).toContain(
            'portraitService?.getEligibility?.().eligible'
        );
        expect(profile).toContain("source: 'profile_recovery'");
        expect(profile).toContain('sprite: this.creatureSprite');
    });

    test('provides a local non-saving responsive visual preview', () => {
        expect(game).toContain("urlParams.has('testProfilePortrait')");
        expect(game).toContain('profilePortraitPreview: true');
        expect(profile).toContain("imageUrl: '/marketing/nova.webp'");
        expect(hatching).toContain(
            "previewParams.has('testProfilePortrait')"
        );
    });
});

const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Fend community gameplay contract', () => {
    test('the Sanctuary interaction builds ready projects before normal daily tending', () => {
        const source = read('scenes/GameScene.js');

        expect(source).toContain('getFendCommunitySnapshot(window.GameState)');
        expect(source).toContain('if (communityBefore.nextProject?.ready)');
        expect(source).toContain('advanceFendCommunityProject(window.GameState)');
        expect(source).toContain('refreshFendCommunity(');
        expect(source).toContain('showFendCommunityProjectMoment(contribution)');
    });

    test('community progress becomes visible around the Signal Garden', () => {
        const source = read('systems/world/WorldBuilder.js');

        expect(source).toContain('refreshFendCommunity(garden, requestedStage = 0)');
        expect(source).toContain('FEND SETTLEMENT');
        expect(source).toContain('FEND COMMONS');
        expect(source).toContain('communityPulseTween');
    });

    test('built projects return practical expedition support', () => {
        const source = read('scenes/PlatformerLevelScene.js');

        expect(source).toContain('this.fendCommunitySupport.maxHealthBonus +');
        expect(source).toContain('this.fendCommunitySupport.maxEnergyBonus +');
        expect(source).toContain('this.communityGuardCharges = this.fendCommunitySupport.guardCharges');
        expect(source).toContain("'FEND RELAY'");
        expect(source).toContain('Damage absorbed by the Fend Relay');
    });

    test('the local preview route exposes all four settlement stages', () => {
        const gameSource = read('game.js');
        const hatchingSource = read('scenes/HatchingScene.js');

        expect(gameSource).toContain("['0', '1', '2', '3', '4'].includes(testCommunity)");
        expect(gameSource).toContain('communityPreview: Number(testCommunity)');
        expect(gameSource).toContain('communityMomentPreview: Number(testCommunityMoment)');
        expect(hatchingSource).toContain("previewParams.has('testCommunity')");
        expect(hatchingSource).toContain("previewParams.has('testCommunityMoment')");
    });
});

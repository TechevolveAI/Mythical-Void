const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Sanctuary onboarding and creature continuity contract', () => {
    test('reveals one first objective before the wider settlement plan', () => {
        const village = read('systems/VillageSettlement.js');
        const world = read('systems/world/WorldBuilder.js');
        const panel = read('ui/VillageCommandPanel.js');
        const game = read('scenes/GameScene.js');

        expect(village).toContain("stage = 'meet_heart'");
        expect(village).toContain('visiblePlotCount = heartMet');
        expect(world).toContain('snapshot?.onboarding?.visiblePlotCount ?? 1');
        expect(world).toContain("snapshot?.onboarding?.stage === 'meet_heart'");
        expect(world).toContain(".setText('OPEN HEART')");
        expect(panel).toContain("onboarding.stage === 'meet_heart'");
        expect(panel).toContain('REVEAL THE FIRST SAFE FOUNDATION');
        expect(panel).toContain("action.addEventListener('touchend', activate, { passive: false });");
        expect(panel).toContain('this.snapshot = next;');
        expect(panel).toContain('The wider building plan stays hidden for now.');
        expect(game).toContain('onAcknowledge: () => {');
        expect(game).not.toContain('if (opened && !snapshot.state.guidanceSeen)');
    });

    test('hydrates the persisted portrait without delaying Sanctuary input', () => {
        const panel = read('ui/VillageCommandPanel.js');
        const game = read('scenes/GameScene.js');

        expect(game).toContain('if (opened) void this.hydrateVillageCommandPortrait');
        expect(game).toContain('await mediaService.resolvePortrait(stage).catch(() => null)');
        expect(panel).toContain('setCompanionPortrait(record)');
        expect(panel).toContain("avatar.classList.add('is-living-portrait')");
        expect(panel).toContain('createCommunityDirectory(snapshot, this.companionPortraitRecord)');
    });

    test('uses optional story media at rescues, trust scenes, and the ending', () => {
        const platformer = read('scenes/PlatformerLevelScene.js');
        const sanctuary = read('scenes/GameScene.js');
        const victory = read('scenes/VictoryScene.js');
        const media = read('systems/CompanionMediaService.js');

        expect(platformer).toContain('mediaService.createStoryMoment || mediaService.createCinematicStill');
        expect(sanctuary).toContain('mediaService?.createStoryMoment || mediaService?.createCinematicStill');
        expect(victory).toContain('mediaService?.createStoryMoment || mediaService?.createCinematicStill');
        expect(media).toContain('The portrait tableau is the immediate, deterministic fallback');
        expect(media).toContain('this.prepareGeneratedVideo({ momentId, stage, record }).catch(() => null)');
    });
});

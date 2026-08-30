const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('opening journey integration contract', () => {
    test('records every durable first-session boundary', () => {
        const hatching = read('scenes/HatchingScene.js');
        const reveal = read('scenes/SoulRevealScene.js');
        const onboarding = read('systems/OnboardingManager.js');
        const controls = read('ui/ControlsTutorialOverlay.js');
        const sanctuary = read('scenes/GameScene.js');

        expect(hatching).toContain("recordOpeningMilestone?.('hatch_started')");
        expect(hatching).toContain("recordOpeningMilestone?.('creature_hatched')");
        expect(reveal).toContain("recordOpeningMilestone?.('creature_named')");
        expect(reveal).toContain("recordOpeningMilestone?.('sanctuary_entered')");
        expect(onboarding).toContain("recordOpeningMilestone?.('story_completed')");
        expect(controls).toContain("recordOpeningMilestone?.('controls_completed')");
        expect(sanctuary).toContain("recordOpeningMilestone?.('first_objective_ready')");
    });

    test('keeps Sanctuary entry independent from portrait completion', () => {
        const reveal = read('scenes/SoulRevealScene.js');
        const journey = read('systems/GameState.js');

        expect(reveal).toContain("recordOpeningPortraitStatus?.('pending')");
        expect(reveal).toContain("recordOpeningPortraitStatus?.('ready')");
        expect(journey).toContain("return 'GameScene';");
        expect(journey).toContain("journey.milestone === 'creature_named'");
    });
});

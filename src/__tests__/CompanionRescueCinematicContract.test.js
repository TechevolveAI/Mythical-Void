const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Companion Guardian-outcome cinematic continuity', () => {
    const platformer = read('scenes/PlatformerLevelScene.js');
    const finalLevel = read('scenes/levels/FinalVoidLevel.js');

    test('shows the persisted companion during a newly resolved Guardian outcome', () => {
        expect(platformer).toContain(
            'showCompanionGuardianRescueTableau(guardian)'
        );
        expect(platformer).toContain('guardian?.changed');
        expect(platformer).toContain(
            "import { companionMediaService } from '../systems/CompanionMediaService.js'"
        );
        expect(platformer).toContain('createCinematicStill(this, {');
        expect(platformer).toContain('`guardian_rescue_${guardianId}`');
        expect(platformer).toContain('`FIRST ALLIANCE // ${companionName.toUpperCase()}`');
        expect(platformer).toContain('guardian.outcomeLine');
        expect(platformer).toContain('this.levelCompletionResult.guardianOutcome');
    });

    test('never starts generation or delays the reward flow', () => {
        const start = platformer.indexOf(
            'showCompanionGuardianRescueTableau(guardian)'
        );
        const end = platformer.indexOf(
            'completeLevelProgression({',
            start
        );
        const cinematic = platformer.slice(start, end);
        expect(cinematic).not.toContain('LivingPortraitService.generate');
        expect(cinematic).not.toContain('LivingPortraitService.prewarm');
        expect(platformer).toContain('return this.levelCompletionResult;');
    });

    test('covers the deterministic final guardian result preview', () => {
        expect(finalLevel).toContain('this.enterLevelCompletionState();');
        expect(finalLevel).toContain(
            'this.showCompanionGuardianRescueTableau('
        );
        expect(platformer).toContain("storage: 'preview'");
    });

    test('invalidates asynchronous media during reset and shutdown', () => {
        expect(
            platformer.match(/this\.companionMediaRequest \+= 1;/g)?.length
        ).toBeGreaterThanOrEqual(3);
        expect(platformer).toContain(
            'this.companionRescueTableau?.destroy?.()'
        );
    });
});

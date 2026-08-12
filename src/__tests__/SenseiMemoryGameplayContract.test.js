const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(__dirname, '..', relativePath),
        'utf8'
    );
}

describe('Sensei memory gameplay contract', () => {
    const scene = read('scenes/GameScene.js');
    const platformer = read('scenes/PlatformerLevelScene.js');
    const modal = read('ui/SenseiMemoryModal.js');
    const story = read('systems/ProjectBeaconStory.js');
    const legacy = read('systems/CampaignLegacy.js');
    const game = read('game.js');
    const hatching = read('scenes/HatchingScene.js');

    test('makes available memories the next Wanderer-77 interaction', () => {
        expect(scene).toContain('showSenseiMemory()');
        expect(scene).toContain(
            'Personal memory ${senseiMemory.recalledCount + 1}/${senseiMemory.totalMemories}'
        );
        expect(scene).toMatch(
            /if \(senseiMemory\.ready\)[\s\S]*showSenseiMemory\(\)[\s\S]*else if \(consent\.ready\)/
        );
    });

    test('presents an authored pre-mission relationship without making contact', () => {
        expect(modal).toContain(
            'WANDERER-77 // PERSONAL MEMORY'
        );
        expect(modal).toContain('WHY IT MATTERS NOW');
        expect(modal).toContain(
            'No contact has been attempted.'
        );
        expect(modal).toContain(
            'KEEP MEMORY + UNLOCK STANCE'
        );
        expect(modal).toContain('this.scene.cameras?.main');
    });

    test('turns stillness after a non-lethal hit into one expedition recovery', () => {
        expect(platformer).toContain('this.armCenteringStance();');
        expect(platformer).toContain('CENTERING_STANCE_DURATION_MS');
        expect(platformer).toContain(
            'CENTERING STANCE // RELEASE MOVEMENT'
        );
        expect(platformer).toContain(
            'CENTERING STANCE // SUIT RESEALED'
        );
        expect(platformer).toContain(
            'this.centeringStanceUsed = true'
        );
        expect(platformer).toContain(
            'this.health = Math.min(this.maxHealth, this.health + 1)'
        );
        expect(platformer).not.toContain('centeringStanceKey');
    });

    test('surfaces the archive in Project Beacon and the sequel handoff', () => {
        expect(story).toContain('PERSONAL ARCHIVE // MEMORY');
        expect(story).toContain('senseiMemory,');
        expect(legacy).toContain('memoriesRecalled: normalizeStringList');
        expect(legacy).toContain("id: 'centering_stance'");
        expect(legacy).toContain('practiceCount: Math.max');
    });

    test('provides local non-saving memory and stance previews', () => {
        expect(game).toContain("['footing', 'trust', 'restraint', 'confirmed'].includes");
        expect(game).toContain('senseiMemoryPreview: testSenseiMemory');
        expect(game).toContain('senseiMemoryPreviewSize:');
        expect(scene).toContain("this.senseiMemoryPreviewSize === 'mobile'");
        expect(game).toContain(
            "['mission', 'recovery', 'archive', 'memory'].includes"
        );
        expect(scene).toContain("this.beaconLogPreview === 'memory'");
        expect(game).toContain('beaconLogPreviewSize:');
        expect(game).toContain("['armed', 'complete'].includes(testStance)");
        expect(game).toContain('centeringStancePreview: testStance');
        expect(game).toContain('centeringStancePreviewSize:');
        expect(platformer).toContain(
            "this.centeringStancePreviewSize === 'mobile'"
        );
        expect(hatching).toContain("previewParams.has('testSenseiMemory')");
        expect(hatching).toContain("previewParams.has('testStance')");
    });
});

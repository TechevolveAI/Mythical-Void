const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('gameplay mode ownership contract', () => {
    const modes = read('config/GameplayModes.js');
    const sanctuary = read('scenes/GameScene.js');
    const platformer = read('scenes/PlatformerLevelScene.js');
    const architecture = read('../docs/mythical-void-architecture.md');

    test('defines distinct Sanctuary and realm contracts', () => {
        expect(modes).toContain("id: 'sanctuary-community'");
        expect(modes).toContain("primaryLoop: 'care-build-community'");
        expect(modes).toContain("movement: 'two-axis-ground'");
        expect(modes).toContain("id: 'realm-platformer'");
        expect(modes).toContain("primaryLoop: 'traverse-fight-discover'");
        expect(modes).toContain(
            "movement: 'horizontal-jump-with-authored-exceptions'"
        );
    });

    test('binds each scene family to its own mode', () => {
        expect(sanctuary).toContain(
            'this.gameplayMode = GAMEPLAY_MODES.SANCTUARY_COMMUNITY;'
        );
        expect(platformer).toContain(
            'this.gameplayMode = GAMEPLAY_MODES.REALM_PLATFORMER;'
        );
    });

    test('documents the player-facing and control boundary', () => {
        expect(architecture).toContain('## Gameplay Mode Boundary');
        expect(architecture).toContain('| Camera | Top-down exploration | Side-on platforming |');
        expect(architecture).toContain('four-direction mobile stick');
        expect(architecture).toContain('no Sanctuary-building controls');
    });
});

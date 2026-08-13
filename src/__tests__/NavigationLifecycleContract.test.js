const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Sanctuary navigation lifecycle', () => {
    test('hamburger overlays use GameScene lifecycle routes before falling back', () => {
        const menu = read('ui/HamburgerMenu.js');

        expect(menu).toContain("typeof this.scene.openCreatureProfile === 'function'");
        expect(menu).toContain("typeof this.scene.openInventory === 'function'");
        expect(menu).toContain("typeof this.scene.openHubWorld === 'function'");
        expect(menu).toContain('this.scene.openCreatureProfile();');
        expect(menu).toContain('this.scene.openInventory();');
        expect(menu).toContain('this.scene.openHubWorld();');
    });

    test('profile pauses and resumes the same Sanctuary scene rather than restarting it', () => {
        const gameScene = read('scenes/GameScene.js');
        const profile = read('scenes/CreatureProfileScene.js');

        expect(gameScene).toContain(
            "this.sceneRouter.pauseAndLaunchScene('CreatureProfileScene'"
        );
        expect(profile).toContain("this.scene.isPaused?.('GameScene') === true");
        expect(profile).toContain("SceneTransitionHelper.stopScene(this, 'CreatureProfileScene')");
        expect(profile).toContain("SceneTransitionHelper.resumeScene(this, 'GameScene')");
    });

    test('never runs movement during a player-body restart gap', () => {
        const gameScene = read('scenes/GameScene.js');

        expect(gameScene).toContain(
            'this._isShuttingDown || !this.player?.active || !this.player.body?.enable'
        );
        expect(gameScene).toMatch(
            /handleMovement\(\) \{[\s\S]*?!this\.player\?\.active[\s\S]*?!this\.player\.body\?\.enable[\s\S]*?return;/
        );
    });
});

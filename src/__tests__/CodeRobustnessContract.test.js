const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
);

describe('runtime cleanup contracts', () => {
    test('keeps natural evolution separate from the developer stage override', () => {
        const sceneSource = read('src/scenes/GameScene.js');
        const menuSource = read('src/ui/HamburgerMenu.js');

        expect(sceneSource.match(/^    regenerateCreatureTexture\(/gm)).toHaveLength(1);
        expect(sceneSource.match(/^    setCreatureLifecycleStageForDebug\(/gm)).toHaveLength(1);
        expect(sceneSource).toContain('this.regenerateCreatureTexture(toStage);');
        expect(menuSource).toContain(
            'this.scene.setCreatureLifecycleStageForDebug(newStage);'
        );
    });

    test('does not silently override duplicate class methods', () => {
        const profileSource = read('src/scenes/CreatureProfileScene.js');
        const graphicsSource = read('src/systems/GraphicsEngine.js');

        expect(profileSource.match(/^    getRarityColor\(/gm)).toHaveLength(1);
        expect(graphicsSource.match(/^    addPowerIndicators\(/gm)).toHaveLength(1);
    });

    test('uses explicit ESM config filenames', () => {
        expect(fs.existsSync(path.join(__dirname, '../../vite.config.mjs'))).toBe(true);
        expect(fs.existsSync(path.join(__dirname, '../../postcss.config.mjs'))).toBe(true);
        expect(fs.existsSync(path.join(__dirname, '../../vite.config.js'))).toBe(false);
        expect(fs.existsSync(path.join(__dirname, '../../postcss.config.js'))).toBe(false);
    });
});

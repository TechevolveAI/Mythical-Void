const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBreedingHatchScene() {
    const filePath = path.join(__dirname, '../scenes/BreedingHatchScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import .*$/gm, '')
        .replace(
            /export default BreedingHatchScene;/,
            'module.exports = BreedingHatchScene;'
        );

    class PhaserScene {}
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {
            Phaser: {
                Scene: PhaserScene
            }
        },
        Number,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Fusion hatch presentation', () => {
    test('fits cinematic headings inside a phone viewport', () => {
        const BreedingHatchScene = loadBreedingHatchScene();
        const scene = new BreedingHatchScene();
        const text = {
            width: 540,
            style: { fontSize: '28px' },
            setFontSize: jest.fn()
        };

        expect(scene.fitTextToWidth(text, 354, 15)).toBe(text);
        expect(text.setFontSize).toHaveBeenCalledWith(18);
        expect(scene.getSafeHeadingFontSize(
            'CURRENT SYNTHESIS // ACTIVE',
            354,
            28,
            15
        )).toBe(18);
    });

    test('removes the intro heading before presenting the new signature', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/BreedingHatchScene.js'),
            'utf8'
        );

        expect(source).toContain('this.phaseTitle.destroy()');
        expect(source).toContain(
            'this.fitTextToWidth(newLifeText, width - 36, 14)'
        );
    });
});

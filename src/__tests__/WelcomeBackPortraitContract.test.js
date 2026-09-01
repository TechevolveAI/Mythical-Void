const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
);

describe('Welcome Back living portrait continuity', () => {
    const sceneSource = read('scenes/WelcomeBackScene.js');
    const gameSource = read('game.js');

    test('reuses the protected portrait without starting new generation', () => {
        expect(sceneSource).toContain("getCreaturePortrait?.(stage)");
        expect(sceneSource).toContain('resolvePortrait?.(companion.stage)');
        expect(sceneSource).toContain('ensureTexture?.(this, resolved)');
        expect(sceneSource).toContain("'sanctuary_return'");
        expect(sceneSource).not.toContain('generatePortrait(');
        expect(sceneSource).not.toContain('prewarmPortrait(');
    });

    test('keeps the return report usable when no portrait is stored', () => {
        expect(sceneSource).toContain('window.FXLibrary?.ambientSparkles');
        expect(sceneSource).toContain("companion.record ? 'CREATURE\\nRETURNING' : 'PIXEL\\nIDENTITY'");
        expect(sceneSource).toContain('if (!companion.record) return;');
        expect(sceneSource).toContain("placeholder.setText('PORTRAIT\\nIN ARCHIVE')");
    });

    test('provides a deterministic local visual QA route', () => {
        expect(gameSource).toContain("urlParams.has('testWelcomeBackPortrait')");
        expect(gameSource).toContain('returnPortraitPreview: true');
    });
});

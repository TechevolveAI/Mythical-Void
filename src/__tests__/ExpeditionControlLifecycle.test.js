const fs = require('fs');
const path = require('path');

const LEVEL_FILES = [
    'CrystalCavesLevel.js',
    'ReefLevel.js',
    'MythicalForestLevel.js',
    'VoidPeaksLevel.js',
    'AuroraDepthsLevel.js',
    'FinalVoidLevel.js'
];

describe('expedition control lifecycle', () => {
    test.each(LEVEL_FILES)(
        '%s restores touch controls after its entry overlay',
        (fileName) => {
            const source = fs.readFileSync(
                path.join(__dirname, '../scenes/levels', fileName),
                'utf8'
            );

            expect(source).toContain('this.showPlatformerMobileControls()');
        }
    );

    test('local level-entry previews can force the real touch-control layout', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "urlParams.get('forceMobileControls') === '1'"
        );
        expect(gameSource).toContain('entryPreview: true');
        expect(gameSource).toContain('forceMobileControls');
    });

    test('hidden touch controls cannot consume modal overlay taps', () => {
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const hideControls = platformerSource.match(
            /hidePlatformerMobileControls\(\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';
        const showControls = platformerSource.match(
            /showPlatformerMobileControls\(\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';

        expect(hideControls).toContain('element.input.enabled = false');
        expect(showControls).toContain('element.input.enabled = true');
        expect(platformerSource).toMatch(
            /onPlayerDeath\(\)[\s\S]*this\.hidePlatformerMobileControls\(\)/
        );
        expect(platformerSource).toMatch(
            /retryFromCheckpoint\(\)[\s\S]*this\.showPlatformerMobileControls\(\)/
        );
        expect(platformerSource).toMatch(
            /showPauseMenu\(\)[\s\S]*this\.hidePlatformerMobileControls\(\)/
        );
        expect(platformerSource).toMatch(
            /hidePauseMenu\(\)[\s\S]*this\.showPlatformerMobileControls\(\)/
        );
    });
});

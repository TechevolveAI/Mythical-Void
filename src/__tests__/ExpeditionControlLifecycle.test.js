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

const readLevel = fileName => fs.readFileSync(
    path.join(__dirname, '../scenes/levels', fileName),
    'utf8'
);

describe('expedition control lifecycle', () => {
    test.each(LEVEL_FILES)(
        '%s restores touch controls after its entry overlay',
        (fileName) => {
            const source = readLevel(fileName);

            expect(source).toContain('this.showPlatformerMobileControls()');
        }
    );

    test.each(LEVEL_FILES)(
        '%s exposes touch controls in its direct boss QA route',
        (fileName) => {
            const source = readLevel(fileName);
            const methodStart = source.indexOf('startTestMode() {');
            const methodEnd = source.indexOf('\n    }', methodStart);
            const method = source.slice(methodStart, methodEnd);

            expect(methodStart).toBeGreaterThan(-1);
            expect(method).toContain('this.showPlatformerMobileControls()');
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

    test('release interaction smoke requires visible touch controls in every level', () => {
        const smokeSource = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smokeSource).toContain(
            'mobileControls: scene?.platformerControlsVisible === true'
        );
        expect(smokeSource).toContain(
            'entered gameplay without touch controls'
        );
    });
});

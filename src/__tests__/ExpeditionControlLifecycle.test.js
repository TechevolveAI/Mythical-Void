const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');

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
    });

    test.each([true, false])('the owned menu close restores only previously visible touch controls=%s', visible => {
        const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
        const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
        const method = name => {
            const node = cls.body.body.find(item => item.key?.name === name);
            return new Function('console', `return ({${source.slice(node.start, node.end)}}).${name};`)({ log() {} });
        };
        const pauseSource = fs.readFileSync(path.join(__dirname, '../scenes/controllers/PlatformerPauseSession.js'), 'utf8');
        const pauseClass = parse(pauseSource, { sourceType: 'module' }).program.body
            .map(node => node.declaration || node).find(node => node.type === 'ClassDeclaration');
        const PauseSession = new Function(`return (${pauseSource.slice(pauseClass.start, pauseClass.end)});`)();
        const world = Object.assign(new EventEmitter(), { isPaused: false });
        const control = { input: { enabled: visible }, setAlpha: jest.fn() };
        const scene = { events: new EventEmitter(), sys: { isActive: () => true }, scene: {},
            time: { paused: false }, tweens: { timeScale: 1, update() {} }, isMobile: true,
            mobileControlElements: [control], platformerControlsVisible: visible,
            clearPauseMenuElements: jest.fn(), releaseAllPlatformerActionButtons: jest.fn(), resetJoystick: jest.fn(),
            hidePlatformerMobileControls: method('hidePlatformerMobileControls'),
            showPlatformerMobileControls: method('showPlatformerMobileControls') };
        scene.physics = { world, pause() { world.isPaused = true; }, resume() { world.isPaused = false; } };
        try {
            PauseSession.open(scene);
            scene.hidePlatformerMobileControls(); scene.pauseMenuActive = true;
            expect(control.input.enabled).toBe(false);
            method('hidePauseMenu').call(scene);
            expect(control.input.enabled).toBe(visible);
            expect(scene.platformerControlsVisible).toBe(visible);
            expect(scene.clearPauseMenuElements).toHaveBeenCalledTimes(1);
            expect(scene.pauseMenuSession).toBeNull();
        } finally { scene.pauseMenuSession?.retire(); scene.events.removeAllListeners(); world.removeAllListeners(); }
    });

    test('release interaction smoke requires visible touch controls in every level', () => {
        const smokeSource = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smokeSource).toContain(
            'mobileControls: scene?.platformerControlsVisible === true'
        );
        expect(smokeSource).toContain('touchControlsExpected: Boolean(');
        expect(smokeSource).toContain(
            'if (state.touchControlsExpected && !state.mobileControls)'
        );
        expect(smokeSource).toContain(
            'entered gameplay without touch controls'
        );
    });
});

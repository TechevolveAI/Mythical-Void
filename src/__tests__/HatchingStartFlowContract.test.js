const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '../scenes/HatchingScene.js'),
    'utf8'
);
const smoke = fs.readFileSync(
    path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
    'utf8'
);
const releaseSmoke = fs.readFileSync(
    path.join(__dirname, '../../scripts/run-browser-smoke.js'),
    'utf8'
);

describe('Hatching home start flow', () => {
    test('restarts immediately after persisting the first-session state', () => {
        const startFlow = source.slice(
            source.indexOf('handleStartGame() {'),
            source.indexOf('\n}\n\nexport default HatchingScene')
        );

        expect(startFlow).toContain('GameState.save();');
        expect(startFlow).toContain('this.scene.restart();');
        expect(startFlow).not.toContain('this.time.delayedCall(100');
    });

    test('does not depend on a fade tween to commit the Start action', () => {
        const releaseFlow = source.slice(
            source.indexOf('onStartRelease(buttonContainer'),
            source.indexOf('createFeatureCards()', source.indexOf('onStartRelease(buttonContainer'))
        );

        expect(releaseFlow).toContain('this.handleStartGame();');
        expect(releaseFlow).not.toContain('onComplete: () =>');
        expect(source).toContain('.setDepth(10000)');
        expect(source).toContain('ensureHomeStartReady()');
    });

    test('blocks a release unless real touches reach the egg at both entry viewport classes', () => {
        expect(smoke).toContain('async function smokeHomeStart');
        expect(smoke).toContain("SMOKE_MODE === 'home-entry'");
        expect(smoke).toContain('scene?.egg?.active');
        expect(smoke).toContain('scene.egg.input?.enabled');
        expect(smoke).toContain('SMOKE_VIEWPORT_WIDTH');
        expect(smoke).toContain('SMOKE_VIEWPORT_HEIGHT');
        expect(smoke).toContain("SMOKE_CASE === 'wide-touch'");
        expect(smoke).toContain('invisible Start control recovery');
        expect(releaseSmoke).toContain("smokeCase: 'phone'");
        expect(releaseSmoke).toContain("smokeCase: 'wide-touch'");
        expect(releaseSmoke).toContain('width: 860, height: 768');
    });
});

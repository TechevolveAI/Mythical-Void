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
    test('restarts the active scene after persisting the first-session state', () => {
        const startFlow = source.slice(
            source.indexOf('handleStartGame() {'),
            source.indexOf('\n}\n\nexport default HatchingScene')
        );

        expect(startFlow).toContain('this.time.delayedCall(100');
        expect(startFlow).toContain('if (!this.sys?.isActive())');
        expect(startFlow).toContain('this.scene.restart();');
        expect(startFlow).not.toContain('this.scene?.sys?.isActive()');
    });

    test('blocks a release unless a real mobile Start touch reaches the egg', () => {
        expect(smoke).toContain('async function smokeHomeStart');
        expect(smoke).toContain("SMOKE_MODE === 'home-entry'");
        expect(smoke).toContain('scene?.egg?.active');
        expect(smoke).toContain('scene.egg.input?.enabled');
        expect(releaseSmoke).toContain("SMOKE_MODE: 'home-entry'");
    });
});

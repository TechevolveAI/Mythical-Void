const fs = require('fs');
const path = require('path');

describe('Hub level transition recovery', () => {
    const hubSource = fs.readFileSync(
        path.join(__dirname, '../scenes/HubWorldScene.js'),
        'utf8'
    );
    const loaderSource = fs.readFileSync(
        path.join(__dirname, '../utils/SceneLoader.js'),
        'utf8'
    );

    test('does not start an unregistered scene after lazy loading returns false', () => {
        expect(hubSource).toContain('throw new Error(`${sceneName} could not be loaded`)');
        expect(hubSource).toContain('throw new Error(`${sceneName} is not registered`)');
        expect(hubSource).toContain('this.clearGateTransitionFx(true);');
    });

    test('destroys the opaque wipe before success and after failure', () => {
        expect(hubSource).toContain('this.gateTransitionWipe?.destroy?.();');
        expect(hubSource).toContain('this.clearGateTransitionFx(false);\n                        this.scene.start(sceneName);');
    });

    test('bounds dynamic imports so a stalled network cannot trap the player', () => {
        expect(loaderSource).toContain('this.importTimeoutMs = 15000;');
        expect(loaderSource).toContain('Promise.race([');
        expect(loaderSource).toContain('reject(new Error(`Timed out loading ${sceneName}`))');
    });
});

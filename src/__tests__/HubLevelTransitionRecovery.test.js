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
    const controllerSource = fs.readFileSync(
        path.join(__dirname, '../scenes/controllers/HubGateTransitionController.js'),
        'utf8'
    );

    test('does not start an unregistered scene after lazy loading returns false', () => {
        expect(controllerSource).toContain('throw new Error(`${sceneName} could not be loaded`)');
        expect(controllerSource).toContain('throw new Error(`${sceneName} is not registered`)');
        expect(controllerSource).toContain('this.retire(attempt, true);');
        expect(controllerSource).toContain('scene.clearGateTransitionFx(true)');
    });

    test('destroys the opaque wipe before success and after failure', () => {
        expect(hubSource).toContain('this.gateTransitionWipe?.destroy?.();');
        const start = controllerSource.slice(controllerSource.indexOf('this.hideLoading(attempt);'),
            controllerSource.indexOf('return true;', controllerSource.indexOf('this.hideLoading(attempt);')));
        expect(start).toContain('scene.clearGateTransitionFx(false)');
        expect(start.indexOf('scene.clearGateTransitionFx(false)')).toBeLessThan(start.indexOf('scene.scene.start(sceneName)'));
        expect(controllerSource).toContain('attempt.objects.forEach(object => this.feedback(() => object.destroy?.()))');
    });

    test('bounds dynamic imports so a stalled network cannot trap the player', () => {
        expect(loaderSource).toContain('this.importTimeoutMs = 15000;');
        expect(loaderSource).toContain('Promise.race([');
        expect(loaderSource).toContain('reject(new Error(`Timed out loading ${sceneName}`))');
    });
});

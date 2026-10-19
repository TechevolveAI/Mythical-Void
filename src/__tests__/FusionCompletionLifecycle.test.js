const fs = require('node:fs');
const path = require('node:path');
const { loadModule } = require('../test-support/endingRigFixture.cjs');
const { createFusionOffspringDraft } = loadModule('../systems/FusionOffspringDraft.js', 'createFusionOffspringDraft');

function loadScene() {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/BreedingHatchScene.js'), 'utf8')
        .replace(/^import .*;$/gm, '')
        .replace('export default BreedingHatchScene;', '');
    return new Function('window', 'console', 'createFusionOffspringDraft', `${source}\nreturn BreedingHatchScene;`)(
        { Phaser: { Scene: class {} } }, { log: () => {} }, createFusionOffspringDraft
    );
}

describe('Fusion completion cannot act on a replacement scene or campaign', () => {
    test.each([
        ['single', 'cancelled'], ['single', 'shutdown'], ['single', 'replacement'],
        ['twins', 'cancelled'], ['twins', 'shutdown'], ['twins', 'replacement']
    ])('%s completion stops after %s', async (kind, interruption) => {
        const Scene = loadScene();
        const scene = new Scene();
        scene.fusionTransaction = { operationId: 'synthetic-old-operation' };
        scene.scale = { width: 390, height: 844 };
        scene.sanitizeCreatureName = value => value || 'Synthetic child';
        scene.clearNamingControls = jest.fn();
        const status = { setOrigin() { return this; }, setDepth() { return this; }, destroy: jest.fn() };
        scene.add = { text: jest.fn(() => status) };
        scene.time = { delayedCall: jest.fn() };
        scene.getCommitFailureMessage = jest.fn();
        scene.returnToGame = jest.fn();
        let reply;
        scene.commitFusionCreatures = jest.fn(() => new Promise(resolve => { reply = resolve; }));
        const pending = kind === 'single' ? scene.completeBreeding() : scene.completeTwinBreeding();
        if (interruption === 'shutdown') scene.cleanupComplete = true;
        if (interruption === 'replacement') scene.fusionTransaction = { operationId: 'synthetic-new-operation' };
        reply({ success: false, cancelled: interruption === 'cancelled', reason: 'campaign_changed' });
        await pending;
        expect(status.destroy).toHaveBeenCalledTimes(1);
        expect(scene.add.text).toHaveBeenCalledTimes(1);
        expect(scene.time.delayedCall).not.toHaveBeenCalled();
        expect(scene.getCommitFailureMessage).not.toHaveBeenCalled();
        expect(scene.returnToGame).not.toHaveBeenCalled();
    });
});

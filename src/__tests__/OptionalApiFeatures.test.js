const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApiConfig(enabled) {
    const filePath = path.join(__dirname, '../config/api-config.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const sandbox = {
        console,
        window: {
            envLoader: {
                loaded: true,
                getBool: jest.fn(() => enabled)
            }
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.window.APIConfig;
}

describe('optional API feature gate', () => {
    test('keeps optional services unavailable by default', async () => {
        const apiConfig = loadApiConfig(false);

        await apiConfig.initialize();

        expect(apiConfig.isEnabled()).toBe(false);
        expect(apiConfig.get('replicateConfigured')).toBe(false);
        expect(apiConfig.getPublicConfig().aiArtGeneration).toEqual(
            expect.objectContaining({
                available: false,
                status: 'disabled'
            })
        );
    });

    test('enables optional services only when explicitly configured', async () => {
        const apiConfig = loadApiConfig(true);

        await apiConfig.initialize();

        expect(apiConfig.isEnabled()).toBe(true);
        expect(apiConfig.get('replicateConfigured')).toBe(true);
        expect(apiConfig.getPublicConfig().aiArtGeneration).toEqual(
            expect.objectContaining({
                available: true,
                status: 'enabled'
            })
        );
    });

    test('keeps the game scene guarded against unavailable AI Art calls', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const openAIArtSource = source.slice(
            source.indexOf('    openAIArt() {'),
            source.indexOf('    petCreature() {')
        );

        expect(openAIArtSource).toContain('window.APIConfig?.isEnabled?.()');
        expect(openAIArtSource).toContain('return;');
        expect(openAIArtSource.indexOf('return;')).toBeLessThan(
            openAIArtSource.indexOf('new AIArtModal(this)')
        );
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApiConfig(enabled) {
    const flags = typeof enabled === 'object'
        ? enabled
        : {
            ENABLE_API_FEATURES: enabled,
            ENABLE_AI_PORTRAITS: enabled,
            ENABLE_AI_VIDEOS: enabled
        };
    const filePath = path.join(__dirname, '../config/api-config.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const sandbox = {
        console,
        window: {
            envLoader: {
                loaded: true,
                getBool: jest.fn((key, fallback) => flags[key] ?? fallback)
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
        expect(apiConfig.isVideoEnabled()).toBe(false);
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
        expect(apiConfig.isVideoEnabled()).toBe(true);
        expect(apiConfig.get('replicateConfigured')).toBe(true);
        expect(apiConfig.getPublicConfig().aiArtGeneration).toEqual(
            expect.objectContaining({
                available: true,
                status: 'enabled'
            })
        );
    });

    test('keeps portraits available while optional video is disabled', async () => {
        const apiConfig = loadApiConfig({
            ENABLE_API_FEATURES: true,
            ENABLE_AI_PORTRAITS: true,
            ENABLE_AI_VIDEOS: false
        });

        await apiConfig.initialize();

        expect(apiConfig.isEnabled()).toBe(true);
        expect(apiConfig.isVideoEnabled()).toBe(false);
        expect(apiConfig.getPublicConfig()).toEqual(expect.objectContaining({
            aiArtGeneration: expect.objectContaining({ available: true }),
            personalizedVideo: expect.objectContaining({
                available: false,
                fallback: 'Living portrait motion still'
            })
        }));
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

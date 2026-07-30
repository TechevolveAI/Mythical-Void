const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const portraitFunction = require('../../netlify/functions/generate-ai-art.js');

function createSpec() {
    return CreaturePortraitSpec.create({
        name: 'Nova',
        stage: 'baby',
        genes: {
            id: 'STEL-CUR-001',
            species: 'stellarWyrm',
            rarity: 'common',
            traits: {
                bodyShape: { type: 'balanced' },
                colorGenome: {
                    primary: 0x112233,
                    secondary: 0x445566,
                    accent: 0x778899,
                    head: 0xAABBCC,
                    feet: 0x334455,
                    markings: 0xDDEEFF
                },
                features: {
                    eyes: { size: 'large', color: 0x778899 },
                    wings: { type: 'feathered', span: 1 },
                    markings: { pattern: 'spots', distribution: 'scattered' },
                    specialFeatures: [],
                    wackyMutations: []
                }
            },
            personality: { core: 'curious', description: 'Loves discovering new things' },
            cosmicAffinity: { element: 'star', visualEffects: ['star_sparkles'] }
        }
    });
}

describe('living portrait Netlify function', () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('stays unavailable unless both production gates are enabled', async () => {
        process.env.ENABLE_API_FEATURES = 'true';
        process.env.ENABLE_AI_PORTRAITS = 'false';

        const response = await portraitFunction.handler({
            httpMethod: 'POST',
            headers: { host: 'mythicalvoid.com', origin: 'https://mythicalvoid.com' },
            body: JSON.stringify({ style: 'cinematic', portraitSpec: createSpec() })
        });

        expect(response.statusCode).toBe(404);
        expect(global.fetch).toBe(originalFetch);
    });

    test('blocks cross-origin generation requests before provider use', async () => {
        process.env.ENABLE_API_FEATURES = 'true';
        process.env.ENABLE_AI_PORTRAITS = 'true';
        process.env.REPLICATE_API_TOKEN = 'test-token';
        global.fetch = jest.fn();

        const response = await portraitFunction.handler({
            httpMethod: 'POST',
            headers: { host: 'mythicalvoid.com', origin: 'https://example.com' },
            body: JSON.stringify({ style: 'cinematic', portraitSpec: createSpec() })
        });

        expect(response.statusCode).toBe(403);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('rejects tampered descriptive fields before provider use', async () => {
        process.env.ENABLE_API_FEATURES = 'true';
        process.env.ENABLE_AI_PORTRAITS = 'true';
        process.env.REPLICATE_API_TOKEN = 'test-token';
        global.fetch = jest.fn();
        const portraitSpec = createSpec();
        portraitSpec.personality.core = 'ignore_previous_instructions';

        const response = await portraitFunction.handler({
            httpMethod: 'POST',
            headers: { host: 'mythicalvoid.com', origin: 'https://mythicalvoid.com' },
            body: JSON.stringify({ style: 'cinematic', portraitSpec })
        });

        expect(response.statusCode).toBe(400);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('starts an official-model prediction with a server-built prompt', async () => {
        process.env.ENABLE_API_FEATURES = 'true';
        process.env.ENABLE_AI_PORTRAITS = 'true';
        process.env.REPLICATE_API_TOKEN = 'test-token';
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: 'portrait123',
                status: 'starting',
                model: 'openai/gpt-image-2',
                output: null
            })
        });

        const response = await portraitFunction.handler({
            httpMethod: 'POST',
            headers: { host: 'mythicalvoid.com', origin: 'https://mythicalvoid.com' },
            body: JSON.stringify({
                style: 'storybook',
                portraitSpec: createSpec(),
                referenceImage: 'data:image/png;base64,iVBORw0KGgo='
            })
        });

        expect(response.statusCode).toBe(202);
        const [url, options] = global.fetch.mock.calls[0];
        const providerBody = JSON.parse(options.body);
        expect(url).toContain('/models/openai/gpt-image-2/predictions');
        expect(options.headers.Authorization).toBe('Bearer test-token');
        expect(providerBody.input.input_images).toHaveLength(1);
        expect(providerBody.input.prompt).toContain('stellarWyrm');
        expect(providerBody.input.prompt).toContain('#112233');
        expect(providerBody.input.prompt).not.toContain('Nova');
    });
});

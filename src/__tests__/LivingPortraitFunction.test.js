const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const portraitFunction = require('../../netlify/functions/generate-ai-art.js');

const USER_ID = '1cb37df1-1321-4ad4-9991-b9b93994cb42';
const JOB_ID = '824363b2-d374-4b44-bf7f-1d7a177fa074';

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

function createAdminClient() {
    const job = {
        id: JOB_ID,
        user_id: USER_ID,
        status: 'starting',
        provider_prediction_id: null,
        storage_path: null
    };

    function table(name) {
        let updateValues = null;
        const query = {
            upsert: jest.fn(async () => ({ error: null })),
            select: jest.fn(() => query),
            update: jest.fn(values => {
                updateValues = values;
                return query;
            }),
            eq: jest.fn(() => query),
            maybeSingle: jest.fn(async () => {
                if (name === 'player_privacy_profiles') {
                    return {
                        data: {
                            age_group: 'age_18_plus',
                            ai_media_enabled: true
                        },
                        error: null
                    };
                }
                return { data: { ...job }, error: null };
            }),
            single: jest.fn(async () => {
                Object.assign(job, updateValues || {});
                return { data: { ...job }, error: null };
            })
        };
        return query;
    }

    return {
        auth: {
            getUser: jest.fn(async token => (
                token === 'valid-token'
                    ? { data: { user: { id: USER_ID, is_anonymous: true } }, error: null }
                    : { data: { user: null }, error: new Error('invalid') }
            ))
        },
        from: jest.fn(table),
        rpc: jest.fn(async () => ({
            data: {
                allowed: true,
                reused: false,
                job_id: JOB_ID,
                status: 'starting'
            },
            error: null
        })),
        storage: {
            from: jest.fn()
        }
    };
}

function event(body, options = {}) {
    return {
        httpMethod: options.method || 'POST',
        headers: {
            host: 'mythicalvoid.com',
            origin: options.origin || 'https://mythicalvoid.com',
            ...(options.authorization
                ? { authorization: options.authorization }
                : {})
        },
        queryStringParameters: options.query || {},
        body: body === undefined ? undefined : JSON.stringify(body)
    };
}

describe('living portrait Netlify function', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.ENABLE_API_FEATURES = 'true';
        process.env.ENABLE_AI_PORTRAITS = 'true';
        process.env.REPLICATE_API_TOKEN = 'test-token';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        portraitFunction._internal.resetRuntime();
        jest.restoreAllMocks();
    });

    test('stays unavailable unless both production gates are enabled', async () => {
        process.env.ENABLE_AI_PORTRAITS = 'false';
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({ fetch: providerFetch });

        const response = await portraitFunction.handler(event({
            style: 'cinematic',
            portraitSpec: createSpec()
        }));

        expect(response.statusCode).toBe(404);
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('requires an authenticated player before any provider request', async () => {
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({
            createClient: () => createAdminClient(),
            fetch: providerFetch
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            portraitSpec: createSpec()
        }));

        expect(response.statusCode).toBe(401);
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('blocks cross-origin generation before authentication or provider use', async () => {
        const createClientMock = jest.fn();
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({
            createClient: createClientMock,
            fetch: providerFetch
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            portraitSpec: createSpec()
        }, {
            origin: 'https://example.com',
            authorization: 'Bearer valid-token'
        }));

        expect(response.statusCode).toBe(403);
        expect(createClientMock).not.toHaveBeenCalled();
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('rejects tampered identity fields after authentication', async () => {
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({
            createClient: () => createAdminClient(),
            fetch: providerFetch
        });
        const portraitSpec = createSpec();
        portraitSpec.personality.core = 'ignore_previous_instructions';

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            portraitSpec
        }, {
            authorization: 'Bearer valid-token'
        }));

        expect(response.statusCode).toBe(400);
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('returns only an application job ID when generation starts', async () => {
        const adminClient = createAdminClient();
        const providerFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: 'providerprediction123',
                status: 'starting',
                model: 'openai/gpt-image-2',
                output: null
            })
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            fetch: providerFetch
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'storybook',
            portraitSpec: createSpec(),
            referenceImage: 'data:image/png;base64,iVBORw0KGgo='
        }, {
            authorization: 'Bearer valid-token'
        }));

        expect(response.statusCode).toBe(202);
        const payload = JSON.parse(response.body);
        expect(payload.jobId).toBe(JOB_ID);
        expect(payload).not.toHaveProperty('predictionId');
        expect(payload).not.toHaveProperty('providerPredictionId');

        const [url, options] = providerFetch.mock.calls[0];
        const providerBody = JSON.parse(options.body);
        expect(url).toContain('/models/openai/gpt-image-2/predictions');
        expect(options.headers.Authorization).toBe('Bearer test-token');
        expect(providerBody.input.input_images).toHaveLength(1);
        expect(providerBody.input.prompt).toContain('stellarWyrm');
        expect(providerBody.input.prompt).not.toContain('Nova');
    });
});

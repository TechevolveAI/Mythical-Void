jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn()
}));

const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const portraitFunction = require('../../netlify/lib/generate-ai-art-core.cjs');

const USER_ID = '1cb37df1-1321-4ad4-9991-b9b93994cb42';
const JOB_ID = '824363b2-d374-4b44-bf7f-1d7a177fa074';

function createSpec() {
    return CreaturePortraitSpec.create({
        name: 'Nova',
        stage: 'baby',
        dna: {
            id: 'dna-stellar-23',
            bodyArchetype: 'winged',
            headArchetype: 'insectoid',
            hybridTag: 'dual-hybrid',
            elementalAura: 'storm'
        },
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
            cosmicAffinity: {
                element: 'star',
                visualEffects: ['star_sparkles'],
                specialAbilities: ['stellar_burst', 'constellation_sense']
            }
        }
    });
}

function createAdminClient(jobOverrides = {}, options = {}) {
    const job = {
        id: JOB_ID,
        user_id: USER_ID,
        status: 'starting',
        provider_prediction_id: null,
        storage_path: null,
        ...jobOverrides
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
        _job: job,
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
            from: jest.fn(() => ({
                upload: jest.fn(async () => ({ error: null })),
                createSignedUrl: jest.fn(async () => ({
                    data: options.storageError ? null : {
                        signedUrl:
                            'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/v1/object/sign/creature-portraits/private.webp'
                    },
                    error: options.storageError || null
                }))
            }))
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
        process.env.PORTRAIT_IMAGE_PROVIDER = 'replicate';
        process.env.GEMINI_API_KEY = 'managed-gateway-test-key';
        process.env.GOOGLE_GEMINI_BASE_URL = 'https://gateway.example.test';
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
        expect(payload.identityCacheHit).toBe(false);
        expect(payload.quotaConsumed).toBe(true);
        expect(payload).not.toHaveProperty('predictionId');
        expect(payload).not.toHaveProperty('providerPredictionId');

        const [url, options] = providerFetch.mock.calls[0];
        const providerBody = JSON.parse(options.body);
        expect(url).toContain('/models/openai/gpt-image-2/predictions');
        expect(options.headers.Authorization).toBe('Bearer test-token');
        expect(providerBody.input.input_images).toEqual([
            'data:image/png;base64,iVBORw0KGgo='
        ]);
        expect(providerBody.input.quality).toBe('high');
        expect(providerBody.input.output_compression).toBe(92);
        expect(providerBody.input.prompt).toContain(
            'IMAGE 1 IS THE AUTHORITATIVE IDENTITY REFERENCE'
        );
        expect(providerBody.input.prompt).toContain('stellar wyrm');
        expect(providerBody.input.prompt).toContain(
            'winged body, insectoid head, dual-hybrid hybrid structure, and storm aura'
        );
        expect(providerBody.input.prompt).toContain(
            'stellar burst, constellation sense'
        );
        expect(providerBody.input.prompt).toContain(
            'first-contact photograph from a premium live-action science-fantasy film'
        );
        expect(providerBody.input.prompt).toContain(
            'Do not merely upscale, smooth, repaint, or extrude the pixel sprite'
        );
        expect(providerBody.input.prompt).toContain(
            'STYLE SEPARATION // MANDATORY'
        );
        expect(providerBody.input.prompt).toContain(
            'CREATIVE BIOLOGICAL REALIZATION // THIS INDIVIDUAL'
        );
        expect(providerBody.input.prompt).toContain('Surface biology:');
        expect(providerBody.input.prompt).toContain('Body mechanics:');
        expect(providerBody.input.prompt).toContain(
            'Head biology: Keep the compact oval cranial carapace'
        );
        expect(providerBody.input.prompt).toContain(
            'one coherent insectoid cranial plan visibly fused with smaller, slightly offset aquatic traits'
        );
        expect(providerBody.input.prompt).toContain('Physical scale:');
        expect(providerBody.input.prompt).toContain('Ecological response:');
        expect(providerBody.input.prompt).toContain(
            'Push the realization beyond a polished sprite'
        );
        expect(providerBody.input.prompt).toContain(
            'there must be no visible pixel grid'
        );
        expect(providerBody.input.prompt).toContain(
            'OPTICAL REALISM GATE // MANDATORY'
        );
        expect(providerBody.input.prompt).toContain(
            'real corneal depth, wet tear lines, eyelid margins or nictitating membranes'
        );
        expect(providerBody.input.prompt).toContain(
            'no obvious CGI character render'
        );
        expect(providerBody.input.prompt).toContain(
            'SETTING // THE FEND, FIRST CONTACT'
        );
        expect(providerBody.input.prompt).toContain('Wanderer-77');
        expect(providerBody.input.prompt).not.toContain('Nova');
    });

    test('reuses a completed identity without calling the provider or consuming quota', async () => {
        const adminClient = createAdminClient({
            status: 'succeeded',
            storage_path: `${USER_ID}/${JOB_ID}.webp`,
            provider: 'Replicate',
            model: 'openai/gpt-image-2'
        });
        adminClient.rpc.mockResolvedValue({
            data: {
                allowed: true,
                reused: true,
                job_id: JOB_ID,
                status: 'succeeded',
                counts_toward_daily_limit: false
            },
            error: null
        });
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            fetch: providerFetch
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'cinematic',
            portraitSpec: createSpec()
        }, {
            authorization: 'Bearer valid-token'
        }));
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(payload).toEqual(expect.objectContaining({
            status: 'succeeded',
            identityCacheHit: true,
            quotaConsumed: false,
            storage: 'supabase-private'
        }));
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('retires a broken cached asset so its identity can regenerate without quota', async () => {
        const adminClient = createAdminClient({
            status: 'succeeded',
            storage_path: `${USER_ID}/${JOB_ID}.webp`
        }, {
            storageError: new Error('object missing')
        });
        adminClient.rpc.mockResolvedValue({
            data: {
                allowed: true,
                reused: true,
                job_id: JOB_ID,
                status: 'succeeded'
            },
            error: null
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            fetch: jest.fn()
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'cinematic',
            portraitSpec: createSpec()
        }, {
            authorization: 'Bearer valid-token'
        }));
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(503);
        expect(payload).toMatchObject({
            code: 'generation_failed',
            retryable: true
        });
        expect(adminClient._job).toMatchObject({
            status: 'failed',
            error_code: 'storage_unavailable',
            counts_toward_daily_limit: false
        });
    });

    test('returns precise retry status when new-identity capacity is exhausted', async () => {
        const now = Date.parse('2026-08-11T12:00:00.000Z');
        const retryAt = '2026-08-11T13:23:00.000Z';
        const adminClient = createAdminClient();
        adminClient.rpc.mockResolvedValue({
            data: {
                allowed: false,
                reason: 'rate_limited',
                retry_at: retryAt
            },
            error: null
        });
        const providerFetch = jest.fn();
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            fetch: providerFetch,
            now: () => now
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'cinematic',
            portraitSpec: createSpec()
        }, {
            authorization: 'Bearer valid-token'
        }));
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(429);
        expect(response.headers['Retry-After']).toBe('4980');
        expect(payload).toEqual(expect.objectContaining({
            status: 'deferred',
            code: 'new_identity_quota',
            retryable: true,
            retryAt,
            retryAfterSeconds: 4980
        }));
        expect(providerFetch).not.toHaveBeenCalled();
    });

    test('fails over from invalid Replicate auth to the managed image gateway', async () => {
        const adminClient = createAdminClient();
        const providerFetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'invalid token' })
        });
        const generateContent = jest.fn().mockResolvedValue({
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'iVBORw0KGgo='
                                }
                            }]
                        }
                    }]
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            createGeminiClient: () => ({
                models: { generateContent }
            }),
            fetch: providerFetch,
            now: () => 1786032300000
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'cinematic',
            portraitSpec: createSpec(),
            referenceImage: 'data:image/png;base64,iVBORw0KGgo='
        }, {
            authorization: 'Bearer valid-token'
        }));

        expect(response.statusCode).toBe(200);
        const payload = JSON.parse(response.body);
        expect(payload).toEqual(expect.objectContaining({
            success: true,
            status: 'succeeded',
            provider: 'Netlify AI Gateway',
            model: 'gemini-3.1-flash-image',
            storage: 'supabase-private'
        }));
        expect(providerFetch).toHaveBeenCalledTimes(1);

        expect(generateContent).toHaveBeenCalledTimes(1);
        const gatewayRequest = generateContent.mock.calls[0][0];
        expect(gatewayRequest.model).toBe('gemini-3.1-flash-image');
        expect(gatewayRequest.contents[0].text).toContain(
            'IMAGE 1 IS THE AUTHORITATIVE IDENTITY REFERENCE'
        );
        expect(gatewayRequest.contents[1]).toEqual({
            inlineData: {
                mimeType: 'image/png',
                data: 'iVBORw0KGgo='
            }
        });
        expect(gatewayRequest.config).toEqual({
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: '1:1',
                imageSize: '1K'
            }
        });
        expect(adminClient.storage.from).toHaveBeenCalledWith(
            'creature-portraits'
        );
    });

    test('uses the managed image gateway first in production-default mode', async () => {
        delete process.env.PORTRAIT_IMAGE_PROVIDER;
        const adminClient = createAdminClient();
        const providerFetch = jest.fn();
        const generateContent = jest.fn().mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        inlineData: {
                            mimeType: 'image/png',
                            data: 'iVBORw0KGgo='
                        }
                    }]
                }
            }]
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient,
            createGeminiClient: () => ({
                models: { generateContent }
            }),
            fetch: providerFetch
        });

        const response = await portraitFunction.handler(event({
            ageGroup: 'age_18_plus',
            style: 'cinematic',
            portraitSpec: createSpec(),
            referenceImage: 'data:image/png;base64,iVBORw0KGgo='
        }, {
            authorization: 'Bearer valid-token'
        }));

        expect(response.statusCode).toBe(200);
        expect(generateContent).toHaveBeenCalledTimes(1);
        expect(providerFetch).not.toHaveBeenCalled();
        expect(JSON.parse(response.body)).toEqual(expect.objectContaining({
            status: 'succeeded',
            provider: 'Netlify AI Gateway',
            model: 'gemini-3.1-flash-image'
        }));
    });

    test('does not claim an image reference when only genetics are supplied', () => {
        const prompt = portraitFunction._internal.buildCreaturePrompt(
            createSpec(),
            'cinematic',
            { hasReferenceImage: false }
        );

        expect(prompt).toContain('fixed character model sheet');
        expect(prompt).not.toContain('IMAGE 1');
    });

    test('keeps one creature biological realization stable across rerenders', () => {
        const spec = createSpec();

        expect(
            portraitFunction._internal.buildCreatureRealization(spec)
        ).toEqual(
            portraitFunction._internal.buildCreatureRealization(spec)
        );
    });

    test('changes biological realization with creature identity and anatomy', () => {
        const original = createSpec();
        const alternate = {
            ...createSpec(),
            identityKey: 'creature:crystalDrake:DNA-ALT-023:abcdef23',
            species: 'crystalDrake',
            stage: 'adult',
            morphology: {
                ...createSpec().morphology,
                bodyArchetype: 'quadruped'
            },
            affinity: {
                ...createSpec().affinity,
                element: 'crystal'
            }
        };

        const first = portraitFunction._internal.buildCreatureRealization(
            original
        );
        const second = portraitFunction._internal.buildCreatureRealization(
            alternate
        );

        expect(second).not.toEqual(first);
        expect(second.surfaceBiology).not.toBe(first.surfaceBiology);
        expect(second.bodyMechanics).not.toBe(first.bodyMechanics);
        expect(second.physicalScale).not.toBe(first.physicalScale);
        expect(second.ecologyResponse).not.toBe(first.ecologyResponse);
    });

    test('matches every renderer head archetype to its biological portrait plan', () => {
        const complements = {
            feline: 'avian',
            canine: 'reptile',
            avian: 'feline',
            reptile: 'canine',
            aquatic: 'insectoid',
            simian: 'rodent',
            insectoid: 'aquatic',
            rodent: 'cervine',
            cervine: 'simian'
        };
        const realizations = Object.entries(complements).map(([
            headArchetype,
            secondaryHeadArchetype
        ]) => {
            const spec = createSpec();
            spec.morphology = {
                ...spec.morphology,
                headArchetype,
                hybridType: 'dual-hybrid'
            };
            const realization = portraitFunction._internal
                .buildCreatureRealization(spec);

            expect(realization.secondaryHeadArchetype).toBe(
                secondaryHeadArchetype
            );
            expect(realization.headBiology).toContain('visible in the reference');
            expect(realization.hybridMechanics).toContain(
                `slightly offset ${secondaryHeadArchetype} traits`
            );
            return realization;
        });

        expect(new Set(
            realizations.map(realization => realization.headBiology)
        ).size).toBe(9);
    });

    test('realizes glitchy head DNA as physical biology rather than pixel effects', () => {
        const spec = createSpec();
        spec.morphology = {
            ...spec.morphology,
            hybridType: 'glitchy'
        };
        const prompt = portraitFunction._internal.buildCreaturePrompt(
            spec,
            'cinematic',
            { hasReferenceImage: true }
        );

        expect(prompt).toContain(
            'asymmetric iridescent sensory tissue and chromatic biological refraction'
        );
        expect(prompt).toContain('Do not depict pixels, a digital glitch');
    });

    test('personalizes all head and hybrid combinations without prompt collisions', () => {
        const heads = [
            'feline',
            'canine',
            'avian',
            'reptile',
            'aquatic',
            'simian',
            'insectoid',
            'rodent',
            'cervine'
        ];
        const hybrids = [
            'single-species',
            'dual-hybrid',
            'triple-hybrid',
            'glitchy'
        ];
        const prompts = [];

        heads.forEach(headArchetype => {
            hybrids.forEach(hybridType => {
                const spec = createSpec();
                spec.morphology = {
                    ...spec.morphology,
                    headArchetype,
                    hybridType
                };
                const prompt = portraitFunction._internal.buildCreaturePrompt(
                    spec,
                    'cinematic',
                    { hasReferenceImage: true }
                );

                expect(prompt).toContain(
                    `${headArchetype} head, ${hybridType} hybrid structure`
                );
                expect(prompt).toContain('Head biology:');
                expect(prompt).toContain('Hybrid anatomy:');
                prompts.push(prompt);
            });
        });

        expect(prompts).toHaveLength(36);
        expect(new Set(prompts).size).toBe(36);
    });

    test('re-signs a durable owned asset reference without exposing storage paths', async () => {
        const adminClient = createAdminClient({
            status: 'succeeded',
            storage_path: `${USER_ID}/${JOB_ID}.webp`,
            provider: 'Replicate',
            model: 'openai/gpt-image-2'
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient
        });
        const assetRef =
            portraitFunction._internal.createPortraitAssetRef(JOB_ID);

        const response = await portraitFunction.handler(event(undefined, {
            method: 'GET',
            authorization: 'Bearer valid-token',
            query: { assetRef }
        }));
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(payload).toEqual(expect.objectContaining({
            success: true,
            status: 'succeeded',
            jobId: JOB_ID,
            assetRef,
            storage: 'supabase-private',
            imageUrl: expect.stringContaining('/object/sign/')
        }));
        expect(JSON.stringify(payload)).not.toContain(`${USER_ID}/${JOB_ID}`);
        expect(adminClient.from).toHaveBeenCalledWith(
            'creature_portrait_jobs'
        );
    });

    test('rejects malformed durable asset references before loading a job', async () => {
        const adminClient = createAdminClient();
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient
        });

        const response = await portraitFunction.handler(event(undefined, {
            method: 'GET',
            authorization: 'Bearer valid-token',
            query: { assetRef: 'portrait-job-v1:not-a-job' }
        }));

        expect(response.statusCode).toBe(400);
        expect(adminClient.from).not.toHaveBeenCalledWith(
            'creature_portrait_jobs'
        );
    });

    test('marks a failed durable job as retryable without exposing storage data', async () => {
        const adminClient = createAdminClient({
            status: 'failed',
            storage_path: null,
            error_code: 'provider_failed'
        });
        portraitFunction._internal.setRuntime({
            createClient: () => adminClient
        });
        const assetRef =
            portraitFunction._internal.createPortraitAssetRef(JOB_ID);

        const response = await portraitFunction.handler(event(undefined, {
            method: 'GET',
            authorization: 'Bearer valid-token',
            query: { assetRef }
        }));
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(409);
        expect(payload).toEqual(expect.objectContaining({
            success: false,
            status: 'failed',
            code: 'generation_failed',
            retryable: true,
            assetRef
        }));
        expect(payload).not.toHaveProperty('storagePath');
        expect(payload).not.toHaveProperty('providerPredictionId');
    });
});

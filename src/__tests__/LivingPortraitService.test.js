const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadService({
    featureEnabled = true,
    ageEligible = true,
    existingPortrait = null,
    fetchImpl = null,
    authImpl = null,
    online = true,
    portraitSpecFactory = null,
    serviceOptions = {}
} = {}) {
    const filePath = path.join(
        __dirname,
        '../systems/LivingPortraitService.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            'export { LivingPortraitService };',
            'module.exports = { LivingPortraitService, livingPortraitService };'
        )
        .replace('export default livingPortraitService;', '');
    let portrait = existingPortrait;
    const gameState = {
        getCreaturePortrait: jest.fn(() => portrait),
        saveCreaturePortrait: jest.fn(record => {
            portrait = { ...record, status: 'ready', aiGenerated: true };
            return true;
        }),
        emit: jest.fn()
    };
    const fetchMock = fetchImpl || jest.fn(async () => ({
        ok: true,
        json: async () => ({
            success: true,
            status: 'succeeded',
            jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
            assetRef: 'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074',
            imageUrl: 'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/portrait',
            provider: 'replicate',
            model: 'openai/gpt-image-2',
            storage: 'supabase-private',
            expiresAt: Date.now() + 60000
        })
    }));
    const auth = {
        getSession: jest.fn(async () => ({
            data: {
                session: { access_token: 'private-session-token' }
            },
            error: null
        })),
        signInAnonymously: jest.fn(),
        ...(authImpl || {})
    };
    let onlineState = online;
    const eventListeners = new Map();
    const prepareGeneratedVideo = jest.fn(() => Promise.resolve(null));
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        fetch: fetchMock,
        setTimeout,
        clearTimeout,
        Date,
        Promise,
        Map,
        AbortController,
        window: {
            navigator: {
                get onLine() {
                    return onlineState;
                }
            },
            addEventListener: jest.fn((eventName, listener) => {
                const listeners = eventListeners.get(eventName) || new Set();
                listeners.add(listener);
                eventListeners.set(eventName, listeners);
            }),
            APIConfig: {
                isEnabled: jest.fn(() => featureEnabled)
            },
            CloudSaveManager: {
                isAgeGroupEligible: jest.fn(() => ageEligible)
            },
            CloudSave: {
                client: { auth }
            },
            localStorage: {
                getItem: jest.fn(() => 'age_18_plus')
            },
            CreaturePortraitSpec: {
                create: jest.fn(portraitSpecFactory || (() => ({
                    schemaVersion: 1,
                    promptVersion: 'living-portrait-v5-individual-biology',
                    identityKey: 'creature-1:baby:abc123',
                    creatureId: 'creature-1',
                    stage: 'baby',
                    rarity: 'rare',
                    species: 'stellarWyrm',
                    palette: { body: '#112233' }
                }))),
                isValid: jest.fn(() => true)
            },
            GameState: {
                ...gameState,
                get: jest.fn(() => false)
            },
            CompanionMediaService: { prepareGeneratedVideo }
        }
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    const service = new sandbox.module.exports.LivingPortraitService(serviceOptions);
    const setOnline = nextOnline => {
        onlineState = nextOnline;
        if (nextOnline) {
            (eventListeners.get('online') || []).forEach(listener => listener());
        }
    };
    return {
        service,
        fetchMock,
        gameState,
        auth,
        prepareGeneratedVideo,
        setOnline,
        getPortrait: () => portrait
    };
}

describe('background living portrait generation', () => {
    test('normalizes the exact sprite into a tightly cropped 512px identity reference', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../systems/LivingPortraitService.js'),
            'utf8'
        );

        expect(source).toContain('const size = 512;');
        expect(source).toContain('sourceContext.getImageData(');
        expect(source).toContain('if (maxX < minX || maxY < minY) return null;');
        expect(source).toContain('cropWidth');
        expect(source).toContain('cropHeight');
    });

    const creatureData = {
        name: 'Nova',
        stage: 'baby',
        genes: { id: 'creature-1' }
    };

    test('does not start automatic generation when the feature is disabled', () => {
        const { service, fetchMock } = loadService({ featureEnabled: false });

        expect(service.prewarm({ creatureData })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('does not start automatic generation for an under-16 profile', () => {
        const { service, fetchMock } = loadService({ ageEligible: false });

        expect(service.prewarm({ creatureData })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('deduplicates hatch and modal requests for the same creature stage', async () => {
        const {
            service,
            fetchMock,
            gameState,
            prepareGeneratedVideo
        } = loadService();
        const referenceImage = 'data:image/png;base64,iVBORw0KGgo=';

        const hatchJob = service.prewarm({
            creatureData,
            referenceImage,
            source: 'post_hatch'
        });
        const modalJob = service.generate({ creatureData, source: 'portrait_modal' });
        const [hatchPortrait, modalPortrait] = await Promise.all([
            hatchJob,
            modalJob
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(gameState.saveCreaturePortrait).toHaveBeenCalledTimes(2);
        expect(gameState.saveCreaturePortrait).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ status: 'processing', imageUrl: null })
        );
        expect(gameState.saveCreaturePortrait).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                imageUrl: 'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/portrait'
            })
        );
        expect(hatchPortrait.imageUrl).toBe(
            'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/portrait'
        );
        expect(modalPortrait).toEqual(hatchPortrait);
        expect(hatchPortrait.assetRef).toBe(
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
        );
        const request = fetchMock.mock.calls[0][1];
        expect(request.headers.Authorization).toBe(
            'Bearer private-session-token'
        );
        const requestBody = JSON.parse(request.body);
        expect(requestBody.ageGroup).toBe('age_18_plus');
        expect(requestBody.referenceImage).toBe(referenceImage);
        expect(gameState.emit).toHaveBeenCalledWith(
            'creaturePortraitGenerationStarted',
            expect.objectContaining({ referenceImageCaptured: true })
        );
        expect(gameState.emit).toHaveBeenCalledWith(
            'creaturePortraitGenerationSucceeded',
            expect.objectContaining({
                durationMs: expect.any(Number),
                initialResponseMs: expect.any(Number),
                pollCount: 0,
                referenceImageCaptured: true
            })
        );
        expect(service.getDiagnostics('baby')).toEqual(expect.objectContaining({
            status: 'succeeded',
            pollCount: 0,
            referenceImageCaptured: true
        }));
        expect(prepareGeneratedVideo).toHaveBeenCalledTimes(1);
        expect(prepareGeneratedVideo).toHaveBeenCalledWith({
            momentId: 'first_forest_arrival',
            stage: 'baby',
            record: expect.objectContaining({
                identityKey: 'creature-1:baby:abc123',
                assetRef: 'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
            })
        });
    });

    test('does not generate a post-hatch portrait without the pixel identity reference', async () => {
        const { service, fetchMock } = loadService();

        await expect(service.prewarm({
            creatureData,
            source: 'post_hatch'
        })).rejects.toThrow('Pixel creature reference could not be captured');

        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('bounds authentication and completes a fresh retry after reconnect', async () => {
        jest.useFakeTimers();
        try {
            const auth = {
                getSession: jest.fn()
                    .mockImplementationOnce(() => new Promise(() => {}))
                    .mockResolvedValue({
                        data: {
                            session: { access_token: 'reconnected-session-token' }
                        },
                        error: null
                    }),
                signInAnonymously: jest.fn()
            };
            const {
                service,
                fetchMock,
                gameState,
                setOnline
            } = loadService({
                authImpl: auth,
                online: false,
                serviceOptions: {
                    timeouts: { authMs: 20 }
                }
            });

            const firstAttempt = service.generate({ creatureData });
            const rejection = expect(firstAttempt).rejects.toMatchObject({
                code: 'portrait_auth_timeout',
                retryable: true
            });
            await jest.advanceTimersByTimeAsync(21);
            await rejection;

            expect(fetchMock).not.toHaveBeenCalled();
            expect(service.getActiveJob('baby')).toBeNull();
            expect(service.reconnectRetries.size).toBe(1);

            setOnline(true);
            await service.drainReconnectRetries();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(auth.getSession).toHaveBeenCalledTimes(2);
            expect(gameState.saveCreaturePortrait).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    imageUrl: expect.stringContaining('/storage/portrait')
                })
            );
        } finally {
            jest.useRealTimers();
        }
    });

    test('bounds an unresponsive initial portrait request without holding an active job', async () => {
        jest.useFakeTimers();
        try {
            const { service } = loadService({
                fetchImpl: jest.fn(() => new Promise(() => {})),
                online: false,
                serviceOptions: {
                    timeouts: { requestMs: 20 }
                }
            });

            const attempt = service.generate({ creatureData });
            const rejection = expect(attempt).rejects.toMatchObject({
                code: 'portrait_request_timeout',
                retryable: true
            });
            await jest.advanceTimersByTimeAsync(21);
            await rejection;

            expect(service.getActiveJob('baby')).toBeNull();
            expect(service.getDiagnostics('baby')).toEqual(
                expect.objectContaining({ status: 'failed' })
            );
            expect(service.reconnectRetries.size).toBe(1);
        } finally {
            jest.useRealTimers();
        }
    });

    test('reconnect recovery resolves the saved asset reference instead of posting twice', async () => {
        jest.useFakeTimers();
        try {
            const assetRef =
                'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
            const fetchImpl = jest.fn((url, options = {}) => {
                if (options.method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 202,
                        json: async () => ({
                            success: true,
                            status: 'processing',
                            jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
                            assetRef
                        })
                    });
                }
                if (String(url).includes('jobId=')) {
                    return new Promise(() => {});
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        success: true,
                        status: 'succeeded',
                        jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
                        assetRef,
                        imageUrl:
                            'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/recovered',
                        provider: 'replicate',
                        model: 'openai/gpt-image-2',
                        storage: 'supabase-private',
                        expiresAt: Date.now() + 60000
                    })
                });
            });
            const {
                service,
                fetchMock,
                gameState,
                setOnline
            } = loadService({
                fetchImpl,
                online: false,
                serviceOptions: {
                    timeouts: { statusRequestMs: 20 },
                    pollDelays: [1]
                }
            });

            const firstAttempt = service.generate({ creatureData });
            const rejection = expect(firstAttempt).rejects.toMatchObject({
                code: 'portrait_status_timeout',
                retryable: true
            });
            await jest.advanceTimersByTimeAsync(22);
            await rejection;

            expect(gameState.saveCreaturePortrait).toHaveBeenCalledWith(
                expect.objectContaining({ assetRef, status: 'processing' })
            );
            setOnline(true);
            await service.drainReconnectRetries();

            const postCalls = fetchMock.mock.calls.filter(([, options = {}]) => (
                options.method === 'POST'
            ));
            expect(postCalls).toHaveLength(1);
            expect(fetchMock.mock.calls.some(([url]) => (
                String(url).includes(`assetRef=${encodeURIComponent(assetRef)}`)
            ))).toBe(true);
            expect(gameState.saveCreaturePortrait).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    assetRef,
                    imageUrl: expect.stringContaining('/storage/recovered')
                })
            );
        } finally {
            jest.useRealTimers();
        }
    });

    test('never replaces a durable portrait after a temporary resolve failure', async () => {
        jest.useFakeTimers();
        try {
            const assetRef =
                'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
            const existingPortrait = {
                identityKey: 'creature-1:baby:abc123',
                stage: 'baby',
                status: 'ready',
                storage: 'supabase-private',
                assetRef,
                imageUrl: null,
                expiresAt: null
            };
            const fetchImpl = jest.fn(() => new Promise(() => {}));
            const { service, fetchMock } = loadService({
                existingPortrait,
                fetchImpl,
                online: false,
                serviceOptions: {
                    timeouts: { statusRequestMs: 20 }
                }
            });

            const attempt = service.generate({ creatureData });
            const rejection = expect(attempt).rejects.toMatchObject({
                code: 'portrait_status_timeout',
                retryable: true
            });
            await jest.advanceTimersByTimeAsync(21);
            await rejection;

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toContain(
                `assetRef=${encodeURIComponent(assetRef)}`
            );
            expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
            expect(service.reconnectRetries.size).toBe(1);
        } finally {
            jest.useRealTimers();
        }
    });

    test('active stage lookup never returns a completed promise from another identity', async () => {
        let identityNumber = 1;
        let releaseSecondRequest;
        const fetchImpl = jest.fn((url, options = {}) => {
            const request = JSON.parse(options.body);
            const identityKey = request.portraitSpec.identityKey;
            const response = {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    status: 'succeeded',
                    jobId: identityNumber === 1
                        ? '824363b2-d374-4b44-bf7f-1d7a177fa074'
                        : 'c606eb3e-e9ba-4758-a80e-c964b313a565',
                    assetRef: identityNumber === 1
                        ? 'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
                        : 'portrait-job-v1:c606eb3e-e9ba-4758-a80e-c964b313a565',
                    imageUrl: `https://example.com/${identityKey}.webp`,
                    expiresAt: Date.now() + 60000
                })
            };
            if (identityNumber === 1) return Promise.resolve(response);
            return new Promise(resolve => {
                releaseSecondRequest = () => resolve(response);
            });
        });
        const { service } = loadService({
            fetchImpl,
            portraitSpecFactory: () => ({
                schemaVersion: 1,
                promptVersion: 'living-portrait-v5-individual-biology',
                identityKey: `creature-${identityNumber}:baby:identity`,
                creatureId: `creature-${identityNumber}`,
                stage: 'baby',
                rarity: 'rare',
                species: 'stellarWyrm',
                palette: { body: '#112233' }
            })
        });

        const firstPromise = service.generate({ creatureData });
        await firstPromise;
        expect(service.getActiveJob('baby')).toBeNull();
        expect(service.getDiagnostics('baby')).toEqual(expect.objectContaining({
            identityKey: 'creature-1:baby:identity',
            status: 'succeeded'
        }));

        identityNumber = 2;
        const secondPromise = service.generate({ creatureData });
        expect(secondPromise).not.toBe(firstPromise);
        expect(service.getActiveJob('baby')).toEqual(expect.objectContaining({
            identityKey: 'creature-2:baby:identity',
            status: 'starting'
        }));

        for (let attempt = 0; attempt < 10 && !releaseSecondRequest; attempt += 1) {
            await Promise.resolve();
        }
        releaseSecondRequest();
        await secondPromise;
        expect(service.getActiveJob('baby')).toBeNull();
        expect(service.getDiagnostics('baby')).toEqual(expect.objectContaining({
            identityKey: 'creature-2:baby:identity',
            status: 'succeeded'
        }));
    });

    test('re-signs an expired protected portrait instead of generating again', async () => {
        const assetRef =
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
        const existingPortrait = {
            identityKey: 'creature-1:baby:abc123',
            stage: 'baby',
            style: 'cinematic',
            status: 'ready',
            storage: 'supabase-private',
            assetRef,
            imageUrl: null,
            expiresAt: null
        };
        const fetchImpl = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                status: 'succeeded',
                assetRef,
                imageUrl:
                    'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/fresh',
                provider: 'Replicate',
                model: 'openai/gpt-image-2',
                storage: 'supabase-private',
                expiresAt: Date.now() + 60000
            })
        }));
        const { service, fetchMock, gameState } = loadService({
            existingPortrait,
            fetchImpl
        });

        const [first, second] = await Promise.all([
            service.generate({ creatureData }),
            service.generate({ creatureData })
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toContain(
            `assetRef=${encodeURIComponent(assetRef)}`
        );
        expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
        expect(gameState.saveCreaturePortrait).toHaveBeenCalledTimes(1);
        expect(first.imageUrl).toContain('/storage/fresh');
        expect(second).toEqual(first);
    });

    test('retries a failed durable job and replaces it with the new identity result', async () => {
        const assetRef =
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
        const existingPortrait = {
            identityKey: 'creature-1:baby:abc123',
            stage: 'baby',
            style: 'cinematic',
            status: 'processing',
            storage: 'supabase-private',
            assetRef,
            imageUrl: null,
            expiresAt: null
        };
        const fetchImpl = jest.fn(async (url, options = {}) => {
            if (!options.method) {
                return {
                    ok: false,
                    status: 409,
                    json: async () => ({
                        success: false,
                        status: 'failed',
                        code: 'generation_failed',
                        retryable: true,
                        assetRef,
                        error: 'Portrait generation failed'
                    })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    status: 'succeeded',
                    jobId: 'c606eb3e-e9ba-4758-a80e-c964b313a565',
                    assetRef:
                        'portrait-job-v1:c606eb3e-e9ba-4758-a80e-c964b313a565',
                    imageUrl:
                        'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/retried',
                    provider: 'replicate',
                    model: 'openai/gpt-image-2',
                    storage: 'supabase-private',
                    expiresAt: Date.now() + 60000,
                    identityCacheHit: false,
                    quotaConsumed: false
                })
            };
        });
        const { service, fetchMock } = loadService({
            existingPortrait,
            fetchImpl
        });

        const portrait = await service.generate({ creatureData });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toContain(
            `assetRef=${encodeURIComponent(assetRef)}`
        );
        expect(fetchMock.mock.calls[1][1].method).toBe('POST');
        expect(portrait.imageUrl).toContain('/storage/retried');
    });

    test('preserves quota retry metadata for non-blocking UI status', async () => {
        const retryAt = new Date(Date.now() + (45 * 60 * 1000)).toISOString();
        const fetchImpl = jest.fn(async () => ({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                status: 'deferred',
                error: 'Daily Living Portrait limit reached',
                code: 'new_identity_quota',
                retryable: true,
                retryAt,
                retryAfterSeconds: 2700
            })
        }));
        const { service } = loadService({ fetchImpl });

        let failure;
        try {
            await service.generate({ creatureData });
        } catch (error) {
            failure = error;
        }

        expect(failure).toEqual(expect.objectContaining({
            code: 'new_identity_quota',
            retryable: true,
            retryAt,
            retryAfterSeconds: 2700
        }));
        expect(service.describeError(failure)).toContain(
            'capacity returns in about 45 minutes'
        );
        expect(service.describeError(failure)).toContain(
            'remains playable'
        );
    });

    test('does not turn a server privacy rejection into a retry request', async () => {
        const assetRef =
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
        const existingPortrait = {
            identityKey: 'creature-1:baby:abc123',
            stage: 'baby',
            style: 'cinematic',
            status: 'processing',
            storage: 'supabase-private',
            assetRef,
            imageUrl: null,
            expiresAt: null
        };
        const fetchImpl = jest.fn(async () => ({
            ok: false,
            status: 403,
            json: async () => ({
                success: false,
                status: 'failed',
                error: 'Living Portraits require the 16+ privacy setting',
                code: 'age_restricted',
                retryable: false
            })
        }));
        const { service, fetchMock } = loadService({
            existingPortrait,
            fetchImpl
        });

        await expect(service.generate({ creatureData })).rejects.toMatchObject({
            code: 'age_restricted',
            retryable: false
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    });

    test('the naming flow prewarms before submission and reveals without blocking play', () => {
        const hatchSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );
        const soulSource = fs.readFileSync(
            path.join(__dirname, '../scenes/SoulRevealScene.js'),
            'utf8'
        );
        const handoffSource = fs.readFileSync(
            path.join(__dirname, '../ui/LivingFormHandoff.js'),
            'utf8'
        );

        expect(soulSource.indexOf('this.beginLivingPortraitPrewarm();')).toBeLessThan(
            soulSource.indexOf('    finalizeName() {')
        );
        expect(soulSource).toContain('this.showLivingPortraitHandoff(finalName)');
        expect(soulSource).toContain('sprite: this.creature');
        expect(soulSource).not.toContain(
            'if (this.portraitPromise) {\n            this.showLivingPortraitHandoff'
        );
        expect(soulSource).toContain('this.portraitReferenceImage');
        expect(handoffSource).toContain('LIVING FORM DEVELOPING');
        expect(handoffSource).not.toContain(
            'this.setArtwork(this.pixelReferenceImage'
        );
        expect(handoffSource).not.toContain('/marketing/');
        expect(handoffSource).toContain('PROTECTED LIVING PORTRAIT');
        expect(handoffSource).toContain('No personal data was sent');
        expect(handoffSource).toContain('Temporary image links are not saved');
        expect(handoffSource).toContain('ENTER SANCTUARY');
        expect(soulSource).toContain('this.portraitPreviewFailure');
        expect(soulSource).toContain('Local portrait failure preview');
        expect(handoffSource).toContain('wait in the Companion Archive');
        expect(handoffSource).toContain('ready in the Companion Archive');
        const serviceSource = fs.readFileSync(
            path.join(__dirname, '../systems/LivingPortraitService.js'),
            'utf8'
        );
        expect(serviceSource).toContain(
            'const DEFAULT_POLL_DELAYS = Object.freeze([750, 1000, 1500, 2000, 2500]);'
        );
        expect(hatchSource).toContain('this.exportLocalPortraitQASpecimen();');
        expect(hatchSource).toContain("['localhost', '127.0.0.1'].includes");
        expect(hatchSource).toContain(".has('portraitQa')");
        expect(hatchSource).toContain("exportElement.type = 'application/json'");
    });
});

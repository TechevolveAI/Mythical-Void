const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCompanionMediaService(sceneWindow, ImageClass = class {}) {
    const filePath = path.join(
        __dirname,
        '../systems/CompanionMediaService.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export\s*\{[\s\S]*?\};\s*$/, '')
        .concat(`
            module.exports = {
                CompanionMediaService,
                COMPANION_MEDIA_SCHEMA_VERSION
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: sceneWindow,
        Image: ImageClass,
        console,
        Date,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Map,
        Set,
        Promise,
        Error,
        fetch: sceneWindow.fetch || jest.fn(),
        AbortController: sceneWindow.AbortController || global.AbortController,
        setTimeout,
        clearTimeout
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(portrait) {
    const state = {
        story: { companionMedia: null }
    };
    return {
        get: jest.fn(path => path.split('.').reduce(
            (value, key) => value?.[key],
            state
        )),
        set: jest.fn((path, value) => {
            if (path === 'story.companionMedia') {
                state.story.companionMedia = value;
            }
        }),
        save: jest.fn(),
        emit: jest.fn(),
        getCreaturePortrait: jest.fn(() => portrait),
        state
    };
}

describe('CompanionMediaService', () => {
    test('reuses a durable living portrait instead of generating new art', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: null,
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const resolved = {
            ...portrait,
            imageUrl: 'https://example.test/private-portrait.png'
        };
        const sceneWindow = {
            GameState: createGameState(portrait),
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => false),
                resolve: jest.fn(async () => resolved),
                generate: jest.fn()
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();

        const result = await service.resolvePortrait('baby');

        expect(result).toMatchObject(resolved);
        expect(sceneWindow.LivingPortraitService.resolve)
            .toHaveBeenCalledWith(portrait);
        expect(sceneWindow.LivingPortraitService.generate)
            .not.toHaveBeenCalled();
    });

    test('persists only continuity metadata and opaque asset references', () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/expiring-secret-url.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const gameState = createGameState(portrait);
        const sceneWindow = { GameState: gameState };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();

        const appearance = service.recordAppearance(
            'beacon_reflection',
            portrait
        );

        expect(appearance).toEqual(expect.objectContaining({
            renderMode: 'motion_still',
            assetRef: portrait.assetRef,
            viewCount: 1
        }));
        expect(JSON.stringify(gameState.state)).not.toContain(portrait.imageUrl);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'companionMediaAppearance',
            appearance
        );
        expect(service.hasAppearance('beacon_reflection', 'identity-23'))
            .toBe(true);
        expect(service.hasAppearance('first_living_form', 'identity-23'))
            .toBe(false);
    });

    test('keeps the same cinematic moment for more than one companion', () => {
        const firstPortrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const secondPortrait = {
            identityKey: 'identity-77',
            stage: 'juvenile',
            assetRef: 'portrait-job-v1:bd7e349c-a114-4452-ad8c-0779ea67dc04'
        };
        const gameState = createGameState(firstPortrait);
        const { CompanionMediaService } = loadCompanionMediaService({
            GameState: gameState
        });
        const service = new CompanionMediaService();

        service.recordAppearance('beacon_reflection', firstPortrait);
        service.recordAppearance('beacon_reflection', secondPortrait);

        const appearances = Object.values(
            gameState.state.story.companionMedia.appearances
        );
        expect(appearances).toHaveLength(2);
        expect(appearances.map(entry => entry.identityKey).sort()).toEqual([
            'identity-23',
            'identity-77'
        ]);
    });

    test('loads the portrait once as a scene texture and creates a moving tableau', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const sceneWindow = {
            GameState: createGameState(portrait),
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true)
            }
        };
        class MockImage {
            set src(value) {
                this.currentSrc = value;
                this.naturalWidth = 1024;
                this.naturalHeight = 1024;
                this.onload();
            }
        }
        const { CompanionMediaService } = loadCompanionMediaService(
            sceneWindow,
            MockImage
        );

        const images = new Map();
        const phaserImage = {
            setOrigin: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis(),
            setAlpha: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis(),
            setScrollFactor: jest.fn().mockReturnThis(),
            destroy: jest.fn()
        };
        const veil = {
            fillStyle: jest.fn().mockReturnThis(),
            fillRect: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis(),
            setScrollFactor: jest.fn().mockReturnThis(),
            destroy: jest.fn()
        };
        const scene = {
            scale: { width: 390, height: 844 },
            cameras: { main: { width: 390, height: 844 } },
            textures: {
                exists: jest.fn(key => images.has(key)),
                addImage: jest.fn((key, image) => images.set(key, image)),
                get: jest.fn(key => ({
                    getSourceImage: () => images.get(key)
                }))
            },
            add: {
                image: jest.fn(() => phaserImage),
                graphics: jest.fn(() => veil)
            },
            tweens: { add: jest.fn() }
        };
        const service = new CompanionMediaService();

        const tableau = await service.createCinematicStill(scene, {
            momentId: 'beacon_reflection',
            isCurrent: () => true
        });

        expect(tableau.renderMode).toBe('motion_still');
        expect(scene.textures.addImage).toHaveBeenCalledTimes(1);
        expect(scene.add.image).toHaveBeenCalled();
        expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({
            targets: phaserImage,
            duration: 8000
        }));
        expect(sceneWindow.GameState.save).toHaveBeenCalledTimes(1);
    });

    test('persists only an opaque video reference while prewarming the Forest clip', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const fetchMock = jest.fn(async () => ({
            ok: true,
            status: 202,
            json: async () => ({
                success: true,
                status: 'processing',
                jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
                assetRef: 'video-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
            })
        }));
        const gameState = createGameState(portrait);
        const sceneWindow = {
            GameState: gameState,
            fetch: fetchMock,
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true),
                getAccessToken: jest.fn(async () => 'private-access-token')
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();
        service.waitForGeneratedVideo = jest.fn(async () => null);

        await service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/.netlify/functions/generate-companion-video',
            expect.objectContaining({ method: 'POST' })
        );
        const stored = gameState.state.story.companionMedia.videos;
        expect(Object.values(stored)).toHaveLength(1);
        expect(Object.values(stored)[0]).toMatchObject({
            identityKey: 'identity-23',
            status: 'processing',
            assetRef: 'video-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
        });
        expect(JSON.stringify(stored)).not.toContain('private-access-token');
        expect(JSON.stringify(stored)).not.toContain('videoUrl');
    });

    test('backs off after video quota exhaustion and keeps portrait fallback available', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const fetchMock = jest.fn(async () => ({
            ok: false,
            status: 429,
            json: async () => ({ error: 'quota' })
        }));
        const sceneWindow = {
            GameState: createGameState(portrait),
            fetch: fetchMock,
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true),
                getAccessToken: jest.fn(async () => 'private-access-token')
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();

        await expect(service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        })).resolves.toBeNull();
        await expect(service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        })).resolves.toBeNull();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(service.videoUnavailableUntil).toBeGreaterThan(Date.now());
    });

    test('backs off silently when the optional video provider is unavailable', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const fetchMock = jest.fn(async () => ({
            ok: false,
            status: 502,
            json: async () => ({ error: 'provider unavailable' })
        }));
        const sceneWindow = {
            GameState: createGameState(portrait),
            fetch: fetchMock,
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true),
                getAccessToken: jest.fn(async () => 'private-access-token')
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();

        await expect(service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        })).resolves.toBeNull();
        await expect(service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        })).resolves.toBeNull();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(service.videoUnavailableUntil).toBeGreaterThan(Date.now());
    });

    test('does not repeat video requests after an authorization failure', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const fetchMock = jest.fn(async () => ({
            ok: false,
            status: 401,
            json: async () => ({ error: 'expired session' })
        }));
        const sceneWindow = {
            GameState: createGameState(portrait),
            fetch: fetchMock,
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true),
                getAccessToken: jest.fn(async () => 'expired-access-token')
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();

        await service.prepareGeneratedVideo({
            momentId: 'first_forest_arrival',
            record: portrait
        });
        await service.prepareGeneratedVideo({
            momentId: 'guardian_rescue',
            record: portrait
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(service.videoUnavailableUntil).toBeGreaterThan(Date.now());
    });

    test('abandons a stalled video request so optional media cannot block story flow', async () => {
        jest.useFakeTimers();
        try {
            const portrait = {
                identityKey: 'identity-23',
                stage: 'baby',
                imageUrl: 'https://example.test/private-portrait.png',
                assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
            };
            const fetchMock = jest.fn(() => new Promise(() => {}));
            const sceneWindow = {
                GameState: createGameState(portrait),
                fetch: fetchMock,
                LivingPortraitService: {
                    hasUsableDisplayUrl: jest.fn(() => true),
                    getAccessToken: jest.fn(async () => 'private-access-token')
                }
            };
            const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
            const service = new CompanionMediaService({
                timeouts: { requestMs: 50 }
            });

            const resultPromise = service.prepareGeneratedVideo({
                momentId: 'first_forest_arrival',
                record: portrait
            });
            await Promise.resolve();
            await jest.advanceTimersByTimeAsync(50);

            await expect(resultPromise).resolves.toBeNull();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
            expect(service.videoJobs.size).toBe(0);
            expect(service.videoUnavailableUntil).toBeGreaterThan(Date.now());
        } finally {
            jest.useRealTimers();
        }
    });

    test('abandons a stalled portrait texture without blocking the cinematic fallback', async () => {
        jest.useFakeTimers();
        try {
            const portrait = {
                identityKey: 'identity-23',
                stage: 'baby',
                imageUrl: 'https://example.test/stalled-portrait.png',
                assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
            };
            class StalledImage {
                set src(value) {
                    this.currentSrc = value;
                }
            }
            const sceneWindow = {
                GameState: createGameState(portrait),
                LivingPortraitService: {
                    hasUsableDisplayUrl: jest.fn(() => true)
                }
            };
            const { CompanionMediaService } = loadCompanionMediaService(
                sceneWindow,
                StalledImage
            );
            const service = new CompanionMediaService({
                timeouts: { textureMs: 50 }
            });
            const scene = {
                textures: {
                    exists: jest.fn(() => false),
                    addImage: jest.fn()
                }
            };

            const resultPromise = service.ensureTexture(scene, portrait);
            await jest.advanceTimersByTimeAsync(50);

            await expect(resultPromise).resolves.toBeNull();
            expect(scene.textures.addImage).not.toHaveBeenCalled();
            expect(service.textureLoads.size).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });

    test('uses a completed story video when available and keeps the portrait fallback', async () => {
        const portrait = {
            identityKey: 'identity-23',
            stage: 'baby',
            imageUrl: 'https://example.test/private-portrait.png',
            assetRef: 'portrait-job-v1:42e1e046-c676-4fb9-91c9-1575dcb094ee'
        };
        const gameState = createGameState(portrait);
        gameState.state.story.companionMedia = {
            schemaVersion: 2,
            appearances: {},
            videos: {
                'guardian_rescue_elder_treant:identity': {
                    momentId: 'guardian_rescue_elder_treant',
                    identityKey: portrait.identityKey,
                    stage: 'baby',
                    portraitAssetRef: portrait.assetRef,
                    assetRef: 'video-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074',
                    status: 'succeeded',
                    provider: 'Google Gemini',
                    model: 'veo-3.1-generate-preview',
                    shotVersion: 1,
                    generatedAt: Date.now()
                }
            }
        };
        const sceneWindow = {
            GameState: gameState,
            LivingPortraitService: {
                hasUsableDisplayUrl: jest.fn(() => true),
                getAccessToken: jest.fn(async () => 'private-access-token')
            }
        };
        const { CompanionMediaService } = loadCompanionMediaService(sceneWindow);
        const service = new CompanionMediaService();
        service.createCinematicVideo = jest.fn(async () => ({
            renderMode: 'generated_video'
        }));
        service.createCinematicStill = jest.fn(async () => ({
            renderMode: 'motion_still'
        }));

        const result = await service.createStoryMoment({}, {
            momentId: 'guardian_rescue_elder_treant',
            stage: 'baby'
        });

        expect(result.renderMode).toBe('generated_video');
        expect(service.createCinematicVideo).toHaveBeenCalled();
        expect(service.createCinematicStill).not.toHaveBeenCalled();
    });
});

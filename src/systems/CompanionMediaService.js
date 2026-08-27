const COMPANION_MEDIA_SCHEMA_VERSION = 2;
const MAX_APPEARANCES = 32;
const MOMENT_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const PORTRAIT_ASSET_REF_PATTERN = /^portrait-job-v1:[0-9a-f-]{36}$/i;
const VIDEO_ASSET_REF_PATTERN = /^video-job-v1:[0-9a-f-]{36}$/i;
const DEFAULT_MEDIA_TIMEOUTS = Object.freeze({
    requestMs: 8000,
    textureMs: 8000,
    pollWindowMs: 180000
});
const COMPANION_VIDEO_MOMENTS = Object.freeze({
    first_forest_arrival: 'The companion enters the Mythical Forest beside Wanderer-77.',
    beacon_reflection: 'The companion witnesses the Beacon choice and the cost of returning home.',
    guardian_rescue: 'The companion helps a rescued guardian leave its cage and choose the Sanctuary.',
    guardian_trust: 'The companion shares a quiet trust memory with a newly welcomed Sanctuary resident.',
    guardian_debrief: 'The companion and a Sanctuary resident review what their shared expedition changed.'
});

function isSupportedVideoMoment(momentId) {
    if (Object.prototype.hasOwnProperty.call(COMPANION_VIDEO_MOMENTS, momentId)) {
        return true;
    }
    return /^guardian_(?:rescue|trust|debrief)_[a-z0-9_-]{1,32}$/.test(
        String(momentId || '')
    );
}

function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeTimestamp(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

class CompanionMediaService {
    constructor(options = {}) {
        this.textureLoads = new Map();
        this.preparedMoments = new Map();
        this.videoJobs = new Map();
        this.videoResolutions = new Map();
        this.videoUnavailableUntil = 0;
        this.timeouts = {
            ...DEFAULT_MEDIA_TIMEOUTS,
            ...(options.timeouts || {})
        };
    }

    createEmptyState() {
        return {
            schemaVersion: COMPANION_MEDIA_SCHEMA_VERSION,
            activeIdentityKey: null,
            appearances: {},
            videos: {},
            lastMomentId: null,
            lastViewedAt: null
        };
    }

    getState() {
        const stored = window.GameState?.get?.('story.companionMedia');
        if (!stored || typeof stored !== 'object') {
            return this.createEmptyState();
        }

        const appearances = {};
        Object.entries(stored.appearances || {})
            .slice(-MAX_APPEARANCES)
            .forEach(([storedKey, entry]) => {
                if (!entry || typeof entry !== 'object') return;
                const momentId = MOMENT_ID_PATTERN.test(entry.momentId || '')
                    ? entry.momentId
                    : MOMENT_ID_PATTERN.test(storedKey)
                        ? storedKey
                        : null;
                const identityKey = typeof entry.identityKey === 'string'
                    ? entry.identityKey.slice(0, 180)
                    : null;
                if (!momentId || !identityKey) return;
                const appearanceKey = `${momentId}:${hashText(identityKey)}`;
                appearances[appearanceKey] = {
                    momentId,
                    identityKey,
                    stage: ['baby', 'juvenile', 'adult', 'elder'].includes(entry.stage)
                        ? entry.stage
                        : 'baby',
                    assetRef: PORTRAIT_ASSET_REF_PATTERN.test(
                        entry.assetRef || ''
                    ) ? entry.assetRef.toLowerCase() : null,
                    renderMode: entry.renderMode === 'generated_video'
                        ? 'generated_video'
                        : 'motion_still',
                    firstViewedAt: normalizeTimestamp(entry.firstViewedAt),
                    lastViewedAt: normalizeTimestamp(entry.lastViewedAt),
                    viewCount: Math.max(1, Number(entry.viewCount) || 1)
                };
            });

        const videos = {};
        Object.entries(stored.videos || {})
            .slice(-MAX_APPEARANCES)
            .forEach(([storedKey, entry]) => {
                if (!entry || typeof entry !== 'object') return;
                const momentId = MOMENT_ID_PATTERN.test(entry.momentId || '')
                    ? entry.momentId
                    : null;
                const identityKey = typeof entry.identityKey === 'string'
                    ? entry.identityKey.slice(0, 180)
                    : null;
                const portraitAssetRef = PORTRAIT_ASSET_REF_PATTERN.test(
                    entry.portraitAssetRef || ''
                ) ? entry.portraitAssetRef.toLowerCase() : null;
                const assetRef = VIDEO_ASSET_REF_PATTERN.test(entry.assetRef || '')
                    ? entry.assetRef.toLowerCase()
                    : null;
                if (!momentId || !identityKey || !portraitAssetRef || !assetRef) return;
                const key = `${momentId}:${hashText(identityKey)}`;
                videos[key] = {
                    momentId,
                    identityKey,
                    stage: ['baby', 'juvenile', 'adult', 'elder'].includes(entry.stage)
                        ? entry.stage
                        : 'baby',
                    portraitAssetRef,
                    assetRef,
                    status: entry.status === 'succeeded' ? 'succeeded' : 'processing',
                    provider: typeof entry.provider === 'string'
                        ? entry.provider.slice(0, 48)
                        : null,
                    model: typeof entry.model === 'string'
                        ? entry.model.slice(0, 96)
                        : null,
                    shotVersion: Math.max(1, Number(entry.shotVersion) || 1),
                    generatedAt: normalizeTimestamp(entry.generatedAt)
                };
            });

        return {
            schemaVersion: COMPANION_MEDIA_SCHEMA_VERSION,
            activeIdentityKey: typeof stored.activeIdentityKey === 'string'
                ? stored.activeIdentityKey.slice(0, 180)
                : null,
            appearances,
            videos,
            lastMomentId: MOMENT_ID_PATTERN.test(stored.lastMomentId || '')
                ? stored.lastMomentId
                : null,
            lastViewedAt: normalizeTimestamp(stored.lastViewedAt)
        };
    }

    hasAppearance(momentId, identityKey) {
        if (!MOMENT_ID_PATTERN.test(momentId || '') || !identityKey) {
            return false;
        }
        return Object.values(this.getState().appearances).some(appearance => (
            appearance.momentId === momentId &&
            appearance.identityKey === identityKey
        ));
    }

    async resolvePortrait(stage = null) {
        const record = window.GameState?.getCreaturePortrait?.(stage);
        if (!record) return null;
        if (window.LivingPortraitService?.hasUsableDisplayUrl?.(record)) {
            return record;
        }
        if (!record.assetRef || !window.LivingPortraitService?.resolve) {
            return null;
        }
        return window.LivingPortraitService.resolve(record);
    }

    getTextureKey(record) {
        const identity = `${record.identityKey}:${record.stage}:${record.assetRef}`;
        return `companion-media-${hashText(identity)}`;
    }

    async ensureTexture(scene, record) {
        if (!scene?.textures || !record?.imageUrl) return null;
        const textureKey = this.getTextureKey(record);
        if (scene.textures.exists(textureKey)) return textureKey;

        const existingLoad = this.textureLoads.get(textureKey);
        if (existingLoad) return existingLoad;

        const load = new Promise(resolve => {
            const image = new Image();
            let settled = false;
            let timeoutId = null;
            const finish = value => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) clearTimeout(timeoutId);
                image.onload = null;
                image.onerror = null;
                resolve(value);
            };
            image.crossOrigin = 'anonymous';
            image.referrerPolicy = 'no-referrer';
            image.decoding = 'async';
            image.onload = () => {
                try {
                    if (!scene.textures.exists(textureKey)) {
                        scene.textures.addImage(textureKey, image);
                    }
                    finish(textureKey);
                } catch (error) {
                    finish(null);
                }
            };
            image.onerror = () => finish(null);
            timeoutId = setTimeout(
                () => finish(null),
                this.timeouts.textureMs
            );
            image.src = record.imageUrl;
        }).finally(() => {
            this.textureLoads.delete(textureKey);
        });

        this.textureLoads.set(textureKey, load);
        return load;
    }

    async requestVideoJson(url, options = {}) {
        const controller = typeof AbortController !== 'undefined'
            ? new AbortController()
            : null;
        const requestOptions = controller
            ? { ...options, signal: controller.signal }
            : options;
        let timeoutId = null;
        const deadline = new Promise(resolve => {
            timeoutId = setTimeout(() => {
                controller?.abort?.();
                resolve(null);
            }, this.timeouts.requestMs);
        });

        try {
            const request = (async () => {
                try {
                    const response = await fetch(url, requestOptions);
                    const result = await response.json().catch(() => ({}));
                    return { response, result };
                } catch (error) {
                    if (error?.name === 'AbortError' || error instanceof TypeError) {
                        return null;
                    }
                    throw error;
                }
            })();
            return await Promise.race([request, deadline]);
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }
    }

    deferVideoRequests(durationMs = 60000) {
        this.videoUnavailableUntil = Math.max(
            this.videoUnavailableUntil || 0,
            Date.now() + durationMs
        );
    }

    isVideoGenerationEnabled() {
        return window.APIConfig?.isVideoEnabled?.() === true;
    }

    getPreparedMomentKey(momentId, stage = null, record = null) {
        const currentRecord = record || window.GameState?.getCreaturePortrait?.(stage);
        const identity = currentRecord?.identityKey || currentRecord?.assetRef || stage || 'current';
        return `${momentId}:${hashText(String(identity))}`;
    }

    prepareCinematic(scene, { momentId, stage = null, record = null } = {}) {
        if (!MOMENT_ID_PATTERN.test(momentId || '') || !scene?.textures) {
            return Promise.resolve(null);
        }
        const preparedKey = this.getPreparedMomentKey(momentId, stage, record);
        const existing = this.preparedMoments.get(preparedKey);
        if (existing) return existing;

        if (this.isVideoGenerationEnabled()) {
            this.prepareGeneratedVideo({ momentId, stage, record }).catch(() => null);
        }

        const preparation = Promise.resolve(record || this.resolvePortrait(stage))
            .then(async portraitRecord => {
                if (!portraitRecord?.imageUrl) return null;
                const textureKey = await this.ensureTexture(scene, portraitRecord);
                return textureKey ? { record: portraitRecord, textureKey } : null;
            })
            .catch(error => {
                console.warn(
                    `[CompanionMediaService] Could not prepare ${momentId}:`,
                    error
                );
                return null;
            });
        this.preparedMoments.set(preparedKey, preparation);
        return preparation;
    }

    recordAppearance(momentId, record, renderMode = 'motion_still') {
        if (!MOMENT_ID_PATTERN.test(momentId || '') || !record?.identityKey) {
            return false;
        }
        const state = this.getState();
        const now = Date.now();
        const identityKey = record.identityKey.slice(0, 180);
        const appearanceKey = `${momentId}:${hashText(identityKey)}`;
        const previous = state.appearances[appearanceKey];
        const appearance = {
            momentId,
            identityKey,
            stage: ['baby', 'juvenile', 'adult', 'elder'].includes(record.stage)
                ? record.stage
                : 'baby',
            assetRef: /^portrait-job-v1:[0-9a-f-]{36}$/i.test(
                record.assetRef || ''
            ) ? record.assetRef.toLowerCase() : null,
            renderMode: renderMode === 'generated_video'
                ? 'generated_video'
                : 'motion_still',
            firstViewedAt: previous?.firstViewedAt || now,
            lastViewedAt: now,
            viewCount: (previous?.viewCount || 0) + 1
        };
        const appearances = {
            ...state.appearances,
            [appearanceKey]: appearance
        };
        const momentIds = Object.keys(appearances);
        if (momentIds.length > MAX_APPEARANCES) {
            momentIds
                .sort((left, right) => (
                    appearances[left].lastViewedAt -
                    appearances[right].lastViewedAt
                ))
                .slice(0, momentIds.length - MAX_APPEARANCES)
                .forEach(id => delete appearances[id]);
        }

        window.GameState?.set?.('story.companionMedia', {
            schemaVersion: COMPANION_MEDIA_SCHEMA_VERSION,
            activeIdentityKey: appearance.identityKey,
            appearances,
            videos: state.videos,
            lastMomentId: momentId,
            lastViewedAt: now
        });
        window.GameState?.save?.();
        window.GameState?.emit?.('companionMediaAppearance', appearance);
        return appearance;
    }

    getVideoRecord(momentId, identityKey) {
        if (!MOMENT_ID_PATTERN.test(momentId || '') || !identityKey) return null;
        return this.getState().videos[`${momentId}:${hashText(String(identityKey))}`] || null;
    }

    saveVideoRecord(momentId, portraitRecord, result) {
        if (
            !MOMENT_ID_PATTERN.test(momentId || '') ||
            !portraitRecord?.identityKey ||
            !PORTRAIT_ASSET_REF_PATTERN.test(portraitRecord.assetRef || '') ||
            !VIDEO_ASSET_REF_PATTERN.test(result?.assetRef || '')
        ) {
            return null;
        }
        const state = this.getState();
        const identityKey = portraitRecord.identityKey.slice(0, 180);
        const key = `${momentId}:${hashText(identityKey)}`;
        const record = {
            momentId,
            identityKey,
            stage: ['baby', 'juvenile', 'adult', 'elder'].includes(portraitRecord.stage)
                ? portraitRecord.stage
                : 'baby',
            portraitAssetRef: portraitRecord.assetRef.toLowerCase(),
            assetRef: result.assetRef.toLowerCase(),
            status: result.status === 'succeeded' ? 'succeeded' : 'processing',
            provider: typeof result.provider === 'string'
                ? result.provider.slice(0, 48)
                : null,
            model: typeof result.model === 'string'
                ? result.model.slice(0, 96)
                : null,
            shotVersion: Math.max(1, Number(result.shotVersion) || 1),
            generatedAt: result.status === 'succeeded' ? Date.now() : null
        };
        window.GameState?.set?.('story.companionMedia', {
            schemaVersion: COMPANION_MEDIA_SCHEMA_VERSION,
            activeIdentityKey: identityKey,
            appearances: state.appearances,
            videos: {
                ...state.videos,
                [key]: record
            },
            lastMomentId: state.lastMomentId,
            lastViewedAt: state.lastViewedAt
        });
        window.GameState?.save?.();
        window.GameState?.emit?.('companionVideoStatus', record);
        return record;
    }

    async prepareGeneratedVideo({
        momentId,
        stage = null,
        record = null
    } = {}) {
        if (!this.isVideoGenerationEnabled()) return null;
        if (Date.now() < (this.videoUnavailableUntil || 0)) return null;
        if (!MOMENT_ID_PATTERN.test(momentId || '')) return null;
        if (!isSupportedVideoMoment(momentId)) return null;
        const portraitRecord = record || await this.resolvePortrait(stage);
        if (
            !portraitRecord?.identityKey ||
            !PORTRAIT_ASSET_REF_PATTERN.test(portraitRecord.assetRef || '')
        ) {
            return null;
        }
        const key = this.getPreparedMomentKey(momentId, stage, portraitRecord);
        const active = this.videoJobs.get(key);
        if (active) return active;

        const stored = this.getVideoRecord(momentId, portraitRecord.identityKey);
        const task = stored?.assetRef
            ? this.resolveGeneratedVideo({ momentId, portraitRecord, stored })
            : this.startGeneratedVideo({ momentId, portraitRecord });
        const guarded = Promise.resolve(task)
            .catch(error => {
                console.warn(
                    `[CompanionMediaService] Could not prepare video ${momentId}:`,
                    error
                );
                return null;
            })
            .finally(() => this.videoJobs.delete(key));
        this.videoJobs.set(key, guarded);
        return guarded;
    }

    async startGeneratedVideo({ momentId, portraitRecord }) {
        const accessToken = await window.LivingPortraitService?.getAccessToken?.();
        if (!accessToken) return null;
        const request = await this.requestVideoJson(
            '/.netlify/functions/generate-companion-video',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    momentId,
                    portraitAssetRef: portraitRecord.assetRef
                })
            }
        );
        if (!request) {
            this.deferVideoRequests();
            return null;
        }
        const { response, result } = request;
        if (!response.ok) {
            if (response.status === 429) {
                // A quota response is session-wide. Keep using the portrait
                // fallback instead of repeating a costly failed request at
                // every authored story beat.
                this.videoUnavailableUntil = Date.now() + (30 * 60 * 1000);
            } else if (response.status >= 500) {
                this.videoUnavailableUntil = Date.now() + (5 * 60 * 1000);
            } else if ([401, 403, 404, 409].includes(response.status)) {
                this.deferVideoRequests(5 * 60 * 1000);
            }
            if (
                [401, 403, 404, 409, 429].includes(response.status) ||
                response.status >= 500
            ) {
                return null;
            }
            throw new Error(result.error || `Video service error (${response.status})`);
        }
        if (result.assetRef) {
            this.saveVideoRecord(momentId, portraitRecord, result);
        }
        if (result.status === 'succeeded' && result.videoUrl) {
            return { ...result, portraitRecord };
        }
        if (!result.assetRef) return null;
        return this.waitForGeneratedVideo({
            momentId,
            portraitRecord,
            assetRef: result.assetRef,
            accessToken
        });
    }

    async resolveGeneratedVideo({ momentId, portraitRecord, stored = null }) {
        const record = stored || this.getVideoRecord(
            momentId,
            portraitRecord?.identityKey
        );
        if (!record?.assetRef) return null;
        const active = this.videoResolutions.get(record.assetRef);
        if (active) return active;
        const resolution = (async () => {
            const accessToken = await window.LivingPortraitService?.getAccessToken?.();
            if (!accessToken) return null;
            const request = await this.requestVideoJson(
                `/.netlify/functions/generate-companion-video?assetRef=${
                    encodeURIComponent(record.assetRef)
                }`,
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
            if (!request) {
                this.deferVideoRequests();
                return null;
            }
            const { response, result } = request;
            if (!response.ok || result.status !== 'succeeded' || !result.videoUrl) {
                return null;
            }
            this.saveVideoRecord(momentId, portraitRecord, result);
            return { ...result, portraitRecord };
        })().finally(() => this.videoResolutions.delete(record.assetRef));
        this.videoResolutions.set(record.assetRef, resolution);
        return resolution;
    }

    async waitForGeneratedVideo({
        momentId,
        portraitRecord,
        assetRef,
        accessToken
    }) {
        const startedAt = Date.now();
        let pollCount = 0;
        while (Date.now() - startedAt < this.timeouts.pollWindowMs) {
            const delay = Math.min(8000, 2500 + pollCount * 500);
            await new Promise(resolve => setTimeout(resolve, delay));
            pollCount += 1;
            const request = await this.requestVideoJson(
                `/.netlify/functions/generate-companion-video?assetRef=${
                    encodeURIComponent(assetRef)
                }`,
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
            if (!request) {
                this.deferVideoRequests();
                return null;
            }
            const { response, result } = request;
            if (!response.ok) return null;
            if (result.status === 'succeeded' && result.videoUrl) {
                this.saveVideoRecord(momentId, portraitRecord, result);
                return { ...result, portraitRecord };
            }
            if (['failed', 'canceled'].includes(result.status)) return null;
        }
        return null;
    }

    async createCinematicVideo(scene, {
        momentId,
        stage = null,
        record = null,
        depth = 8,
        alpha = 0.95,
        isCurrent = null
    } = {}) {
        if (!scene?.add?.video || !MOMENT_ID_PATTERN.test(momentId || '')) {
            return null;
        }
        const portraitRecord = record || await this.resolvePortrait(stage);
        if (!portraitRecord) return null;
        const videoRecord = await this.resolveGeneratedVideo({
            momentId,
            portraitRecord
        });
        if (!videoRecord?.videoUrl || (isCurrent && !isCurrent())) return null;

        const camera = scene.cameras?.main;
        const width = camera?.width || scene.scale?.width || 1280;
        const height = camera?.height || scene.scale?.height || 720;
        const displayWidth = Math.max(width, height * (16 / 9));
        const displayHeight = Math.max(height, width * (9 / 16));
        const video = scene.add.video(width / 2, height / 2)
            .setOrigin(0.5)
            .setDisplaySize(displayWidth, displayHeight)
            .setAlpha(alpha)
            .setDepth(depth)
            .setScrollFactor(0);
        video.loadURL(videoRecord.videoUrl, true, 'anonymous');
        // Generated clips are an ambient visual layer. Muting also permits
        // autoplay on iOS without taking over the player's audio settings.
        video.setMute?.(true);
        video.video?.setAttribute?.('playsinline', '');

        const started = await new Promise(resolve => {
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            video.once?.('playing', () => finish(true));
            video.once?.('error', () => finish(false));
            video.play?.(false);
            scene.time?.delayedCall?.(1800, () => finish(false));
        });
        if (!started || (isCurrent && !isCurrent())) {
            video.destroy?.();
            return null;
        }
        this.recordAppearance(momentId, portraitRecord, 'generated_video');
        return {
            record: portraitRecord,
            videoRecord,
            renderMode: 'generated_video',
            elements: [video],
            destroy() {
                video.stop?.();
                video.removeVideoElement?.();
                video.destroy?.();
            }
        };
    }

    /**
     * Resolve a story beat to its best available representation. A completed
     * clip is preferred, but the portrait tableau always wins the first-visit
     * latency budget and remains the fallback for mobile or restricted players.
     */
    async createStoryMoment(scene, options = {}) {
        const {
            momentId,
            stage = null,
            record = null,
            isCurrent = null
        } = options;
        const portraitRecord = record || await this.resolvePortrait(stage);
        if (!portraitRecord) return null;

        const storedVideo = this.getVideoRecord(
            momentId,
            portraitRecord.identityKey
        );
        if (
            this.isVideoGenerationEnabled() &&
            storedVideo?.status === 'succeeded'
        ) {
            const video = await this.createCinematicVideo(scene, {
                ...options,
                record: portraitRecord,
                isCurrent
            });
            if (video) return video;
        }

        return this.createCinematicStill(scene, {
            ...options,
            record: portraitRecord,
            isCurrent
        });
    }

    async createCinematicStill(scene, {
        momentId,
        stage = null,
        record = null,
        depth = 8,
        alpha = 0.5,
        veilAlpha = 0.54,
        duration = 8000,
        isCurrent = null
    } = {}) {
        if (!MOMENT_ID_PATTERN.test(momentId || '') || !scene?.add) {
            return null;
        }
        // Start optional video work without making the playable story wait for it.
        // The portrait tableau is the immediate, deterministic fallback on mobile,
        // reduced-motion devices, restricted accounts, and provider failure.
        if (
            this.isVideoGenerationEnabled() &&
            isSupportedVideoMoment(momentId)
        ) {
            this.prepareGeneratedVideo({ momentId, stage, record }).catch(() => null);
        }
        const preparedKey = this.getPreparedMomentKey(momentId, stage, record);
        const prepared = record
            ? null
            : await this.preparedMoments.get(preparedKey);
        const portraitRecord = record || prepared?.record ||
            await this.resolvePortrait(stage);
        if (!portraitRecord?.imageUrl) return null;
        const textureKey = prepared?.textureKey ||
            await this.ensureTexture(scene, portraitRecord);
        if (!textureKey || (isCurrent && !isCurrent())) return null;

        const camera = scene.cameras?.main;
        const width = camera?.width || scene.scale?.width || 1280;
        const height = camera?.height || scene.scale?.height || 720;
        const source = scene.textures.get(textureKey)?.getSourceImage?.();
        const sourceWidth = source?.naturalWidth || source?.width || 1024;
        const sourceHeight = source?.naturalHeight || source?.height || 1024;
        const coverScale = Math.max(width / sourceWidth, height / sourceHeight);

        const image = scene.add.image(width / 2, height / 2, textureKey)
            .setOrigin(0.5)
            .setScale(coverScale * 1.02)
            .setAlpha(0)
            .setDepth(depth)
            .setScrollFactor(0);
        const veil = scene.add.graphics()
            .fillStyle(
                0x03040A,
                Math.max(0, Math.min(0.9, Number(veilAlpha) || 0))
            )
            .fillRect(0, 0, width, height)
            .setDepth(depth + 1)
            .setScrollFactor(0);

        scene.tweens?.add?.({
            targets: image,
            alpha,
            duration: Math.min(700, Math.max(250, duration * 0.18)),
            ease: 'Sine.easeOut'
        });
        scene.tweens?.add?.({
            targets: image,
            scaleX: coverScale * 1.1,
            scaleY: coverScale * 1.1,
            x: width * 0.515,
            duration,
            ease: 'Sine.easeInOut'
        });
        if (portraitRecord.storage !== 'preview') {
            this.recordAppearance(momentId, portraitRecord, 'motion_still');
        }

        return {
            record: portraitRecord,
            textureKey,
            renderMode: 'motion_still',
            elements: [image, veil],
            destroy() {
                image.destroy?.();
                veil.destroy?.();
            }
        };
    }
}

const companionMediaService = new CompanionMediaService();

if (typeof window !== 'undefined') {
    window.CompanionMediaService = companionMediaService;
}

export {
    COMPANION_MEDIA_SCHEMA_VERSION,
    COMPANION_VIDEO_MOMENTS,
    CompanionMediaService,
    companionMediaService,
    isSupportedVideoMoment
};

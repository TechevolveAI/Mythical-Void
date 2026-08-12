/**
 * LivingPortraitService
 *
 * Owns deduplicated, background portrait jobs independently of any scene.
 * A hatch reveal can start a job, leave the scene, and consume the same result
 * later from the creature profile or Living Portrait modal.
 */

class LivingPortraitError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'LivingPortraitError';
        this.code = details.code || 'portrait_generation_failed';
        this.status = details.status || 'failed';
        this.retryable = details.retryable === true;
        this.retryAt = details.retryAt || null;
        this.retryAfterSeconds = Number(details.retryAfterSeconds) || null;
        this.httpStatus = Number(details.httpStatus) || null;
    }
}

class LivingPortraitService {
    constructor() {
        this.jobs = new Map();
        this.activeStageJobs = new Map();
        this.assetResolutions = new Map();
    }

    getEligibility() {
        if (!window.APIConfig?.isEnabled?.()) {
            return { eligible: false, reason: 'feature_disabled' };
        }

        const ageGroup = window.localStorage?.getItem?.(
            'mythical_void_age_group'
        );
        if (!window.CloudSaveManager?.isAgeGroupEligible?.(ageGroup)) {
            return { eligible: false, reason: 'age_restricted' };
        }

        return { eligible: true, reason: null };
    }

    getActiveJob(stage = 'baby') {
        const identityKey = this.activeStageJobs.get(stage);
        return identityKey ? this.jobs.get(identityKey) || null : null;
    }

    getDiagnostics(stage = 'baby') {
        const job = this.getActiveJob(stage);
        if (!job) return null;
        const finishedAt = job.completedAt || Date.now();
        return {
            stage: job.stage,
            source: job.source,
            status: job.status,
            elapsedMs: Math.max(0, finishedAt - job.startedAt),
            initialResponseMs: job.initialResponseMs || null,
            pollCount: job.pollCount || 0,
            referenceImageCaptured: job.referenceImageCaptured
        };
    }

    createServiceError(result, response, fallbackMessage) {
        return new LivingPortraitError(
            result?.error || fallbackMessage,
            {
                code: result?.code,
                status: result?.status,
                retryable: result?.retryable,
                retryAt: result?.retryAt,
                retryAfterSeconds: result?.retryAfterSeconds,
                httpStatus: response?.status
            }
        );
    }

    isRetryableError(error) {
        return error?.retryable === true || error?.code === 'generation_failed';
    }

    getRetryStatus(error) {
        const retryAt = error?.retryAt ? Date.parse(error.retryAt) : NaN;
        const retryAfterSeconds = Number.isFinite(retryAt)
            ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
            : Number(error?.retryAfterSeconds) || null;
        return {
            code: error?.code || 'portrait_generation_failed',
            retryable: error?.retryable === true,
            retryAt: Number.isFinite(retryAt)
                ? new Date(retryAt).toISOString()
                : null,
            retryAfterSeconds
        };
    }

    describeError(error) {
        const status = this.getRetryStatus(error);
        if (status.code === 'new_identity_quota') {
            const minutes = status.retryAfterSeconds === null
                ? null
                : Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
            const availability = minutes === null
                ? 'later'
                : minutes < 60
                    ? `in about ${minutes} minute${minutes === 1 ? '' : 's'}`
                    : `in about ${Math.ceil(minutes / 60)} hour${Math.ceil(minutes / 60) === 1 ? '' : 's'}`;
            return `New living portrait capacity returns ${availability}. ` +
                'This companion remains playable and can retry from the Companion Archive.';
        }
        if (status.retryable) {
            return 'The protected portrait can retry from the Companion Archive. ' +
                'The pixel identity remains secured.';
        }
        return error?.message || 'Living portrait unavailable. Pixel identity remains secured.';
    }

    prewarm(options = {}) {
        if (!this.getEligibility().eligible) {
            return null;
        }
        return this.generate({ ...options, source: options.source || 'hatch_prewarm' });
    }

    generate({
        creatureData,
        sprite = null,
        style = 'cinematic',
        referenceImage = null,
        source = 'manual'
    } = {}) {
        const eligibility = this.getEligibility();
        if (!eligibility.eligible) {
            const message = eligibility.reason === 'age_restricted'
                ? 'Living Portraits require the 16+ privacy setting'
                : 'Living Portraits are unavailable in this build';
            return Promise.reject(new Error(message));
        }

        const portraitSpec = window.CreaturePortraitSpec?.create?.(creatureData);
        if (!portraitSpec || !window.CreaturePortraitSpec?.isValid?.(portraitSpec)) {
            return Promise.reject(new Error('Creature identity is incomplete'));
        }

        const activeJob = this.jobs.get(portraitSpec.identityKey);
        if (activeJob) {
            return activeJob.promise;
        }

        const existing = window.GameState?.getCreaturePortrait?.(
            portraitSpec.stage
        );
        if (
            this.hasUsableDisplayUrl(existing) &&
            existing.identityKey === portraitSpec.identityKey
        ) {
            return Promise.resolve(existing);
        }
        if (
            existing?.assetRef &&
            existing.identityKey === portraitSpec.identityKey
        ) {
            return this.resolve(existing).catch(error => {
                if (!this.isRetryableError(error)) throw error;
                return this.startJob({
                    portraitSpec,
                    sprite,
                    style,
                    referenceImage,
                    source
                });
            });
        }

        return this.startJob({
            portraitSpec,
            sprite,
            style,
            referenceImage,
            source
        });
    }

    startJob({ portraitSpec, sprite, style, referenceImage, source }) {
        const activeJob = this.jobs.get(portraitSpec.identityKey);
        if (activeJob) return activeJob.promise;

        const capturedReference = referenceImage || this.captureReference(sprite);
        if (source === 'post_hatch' && !capturedReference) {
            return Promise.reject(
                new Error('Pixel creature reference could not be captured')
            );
        }
        const job = {
            identityKey: portraitSpec.identityKey,
            stage: portraitSpec.stage,
            style,
            source,
            status: 'starting',
            startedAt: Date.now(),
            initialResponseMs: null,
            pollCount: 0,
            referenceImageCaptured: Boolean(capturedReference),
            promise: null
        };

        job.promise = this.runJob({
            job,
            portraitSpec,
            referenceImage: capturedReference
        });
        this.jobs.set(job.identityKey, job);
        this.activeStageJobs.set(job.stage, job.identityKey);
        window.GameState?.emit?.('creaturePortraitGenerationStarted', {
            identityKey: job.identityKey,
            stage: job.stage,
            source,
            referenceImageCaptured: job.referenceImageCaptured
        });
        return job.promise;
    }

    async runJob({ job, portraitSpec, referenceImage }) {
        try {
            const accessToken = await this.getAccessToken();
            const ageGroup = window.localStorage?.getItem?.(
                'mythical_void_age_group'
            );
            const response = await fetch('/.netlify/functions/generate-ai-art', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    style: job.style,
                    portraitSpec,
                    referenceImage,
                    ageGroup
                })
            });

            const initialResult = await response.json().catch(() => ({}));
            job.initialResponseMs = Date.now() - job.startedAt;
            if (!response.ok) {
                throw this.createServiceError(
                    initialResult,
                    response,
                    `Portrait service error (${response.status})`
                );
            }

            job.status = initialResult.status || 'processing';
            if (initialResult.assetRef) {
                window.GameState?.saveCreaturePortrait?.({
                    identityKey: portraitSpec.identityKey,
                    stage: portraitSpec.stage,
                    style: job.style,
                    imageUrl: null,
                    assetRef: initialResult.assetRef,
                    provider: initialResult.provider || 'Replicate',
                    model: initialResult.model || 'processing',
                    promptVersion: portraitSpec.promptVersion,
                    generatedAt: job.startedAt,
                    expiresAt: null,
                    storage: 'supabase-private',
                    jobId: initialResult.jobId,
                    status: 'processing'
                });
            }
            const result = (
                initialResult.status !== 'succeeded' &&
                initialResult.jobId
            )
                ? await this.waitForPrediction(
                    initialResult.jobId,
                    job,
                    accessToken
                )
                : initialResult;

            if (!result.success || !result.imageUrl) {
                throw this.createServiceError(
                    result,
                    null,
                    'Portrait generation failed'
                );
            }

            const completedAt = Date.now();
            const generationDurationMs = Math.max(0, completedAt - job.startedAt);
            const saved = window.GameState?.saveCreaturePortrait?.({
                identityKey: portraitSpec.identityKey,
                stage: portraitSpec.stage,
                style: result.style || job.style,
                imageUrl: result.imageUrl,
                assetRef: result.assetRef,
                provider: result.provider,
                model: result.model,
                promptVersion: portraitSpec.promptVersion,
                generatedAt: completedAt,
                generationDurationMs,
                pollCount: job.pollCount,
                expiresAt: result.expiresAt,
                storage: result.storage,
                jobId: result.jobId
            });
            const record = (
                saved &&
                window.GameState?.getCreaturePortrait?.(portraitSpec.stage)
            ) || {
                identityKey: portraitSpec.identityKey,
                stage: portraitSpec.stage,
                style: job.style,
                imageUrl: result.imageUrl,
                assetRef: result.assetRef
            };

            job.status = 'succeeded';
            job.completedAt = completedAt;
            job.record = record;
            window.GameState?.emit?.('creaturePortraitGenerationSucceeded', {
                identityKey: job.identityKey,
                stage: job.stage,
                source: job.source,
                durationMs: generationDurationMs,
                initialResponseMs: job.initialResponseMs,
                pollCount: job.pollCount,
                referenceImageCaptured: job.referenceImageCaptured
            });
            this.prepareFirstForestVideo(record);
            return record;
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.completedAt = Date.now();
            this.jobs.delete(job.identityKey);
            if (this.activeStageJobs.get(job.stage) === job.identityKey) {
                this.activeStageJobs.delete(job.stage);
            }
            window.GameState?.emit?.('creaturePortraitGenerationFailed', {
                identityKey: job.identityKey,
                stage: job.stage,
                message: error.message,
                durationMs: Math.max(0, job.completedAt - job.startedAt),
                pollCount: job.pollCount
            });
            throw error;
        }
    }

    prepareFirstForestVideo(record) {
        if (
            !record?.assetRef ||
            window.GameState?.get?.('story.projectBeacon.firstForestCinematicSeen')
        ) {
            return null;
        }
        return window.CompanionMediaService?.prepareGeneratedVideo?.({
            momentId: 'first_forest_arrival',
            stage: record.stage || 'baby',
            record
        })?.catch?.(() => null) || null;
    }

    async getAccessToken() {
        const client = window.CloudSave?.client;
        if (!client?.auth) {
            throw new Error('Private portrait authentication is unavailable');
        }

        const { data: sessionData, error: sessionError } =
            await client.auth.getSession();
        if (sessionError) {
            throw new Error('Private portrait authentication failed');
        }

        let session = sessionData?.session || null;
        if (!session?.access_token) {
            const { data, error } = await client.auth.signInAnonymously();
            if (error || !data?.session?.access_token) {
                throw new Error('Private portrait authentication failed');
            }
            session = data.session;
        }
        return session.access_token;
    }

    hasUsableDisplayUrl(record, now = Date.now()) {
        return Boolean(
            typeof record?.imageUrl === 'string' &&
            /^https:\/\//i.test(record.imageUrl) &&
            (
                !record.expiresAt ||
                Number(record.expiresAt) > now + 15000
            )
        );
    }

    resolve(record) {
        if (this.hasUsableDisplayUrl(record)) {
            return Promise.resolve(record);
        }
        if (
            typeof record?.assetRef !== 'string' ||
            !/^portrait-job-v1:[0-9a-f-]{36}$/i.test(record.assetRef)
        ) {
            return Promise.reject(
                new Error('Durable portrait reference is unavailable')
            );
        }

        const activeResolution = this.assetResolutions.get(record.assetRef);
        if (activeResolution) return activeResolution;

        const resolution = this.resolveProtectedAsset(record)
            .finally(() => {
                this.assetResolutions.delete(record.assetRef);
            });
        this.assetResolutions.set(record.assetRef, resolution);
        return resolution;
    }

    async resolveProtectedAsset(record) {
        const eligibility = this.getEligibility();
        if (!eligibility.eligible) {
            throw new Error(
                eligibility.reason === 'age_restricted'
                    ? 'Living Portraits require the 16+ privacy setting'
                    : 'Living Portraits are unavailable in this build'
            );
        }

        const accessToken = await this.getAccessToken();
        const response = await fetch(
            `/.netlify/functions/generate-ai-art?assetRef=${
                encodeURIComponent(record.assetRef)
            }`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || result.assetRef !== record.assetRef) {
            throw this.createServiceError(
                result,
                response,
                `Portrait access error (${response.status})`
            );
        }

        let resolvedResult = result;
        if (result.status !== 'succeeded' || typeof result.imageUrl !== 'string') {
            const recoveryJob = {
                status: result.status || 'processing',
                pollCount: 0
            };
            resolvedResult = await this.waitForPrediction(
                result.jobId,
                recoveryJob,
                accessToken,
                { timeoutMs: 240000 }
            );
        }
        if (
            !resolvedResult?.success ||
            resolvedResult.assetRef !== record.assetRef ||
            typeof resolvedResult.imageUrl !== 'string'
        ) {
            throw new Error('Protected portrait is still forming');
        }

        const nextRecord = {
            ...record,
            imageUrl: resolvedResult.imageUrl,
            assetRef: resolvedResult.assetRef,
            provider: resolvedResult.provider || record.provider,
            model: resolvedResult.model || record.model,
            storage: 'supabase-private',
            expiresAt: resolvedResult.expiresAt,
            status: 'ready'
        };
        const saved = window.GameState?.saveCreaturePortrait?.(nextRecord);
        const resolvedRecord = (
            saved &&
            window.GameState?.getCreaturePortrait?.(record.stage)
        ) || {
            ...nextRecord,
            status: 'ready',
            aiGenerated: true
        };
        this.prepareFirstForestVideo(resolvedRecord);
        return resolvedRecord;
    }

    async waitForPrediction(jobId, job, accessToken, { timeoutMs = 120000 } = {}) {
        const startedAt = Date.now();
        const pollDelays = [750, 1000, 1500, 2000, 2500];

        while (Date.now() - startedAt < timeoutMs) {
            const delay = pollDelays[Math.min(job.pollCount, pollDelays.length - 1)];
            await new Promise(resolve => setTimeout(resolve, delay));
            job.pollCount += 1;
            const response = await fetch(
                `/.netlify/functions/generate-ai-art?jobId=${
                    encodeURIComponent(jobId)
                }`,
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw this.createServiceError(
                    result,
                    response,
                    `Portrait status error (${response.status})`
                );
            }
            job.status = result.status || 'processing';
            if (result.status === 'succeeded') {
                return result;
            }
            if (result.status === 'failed' || result.status === 'canceled') {
                throw this.createServiceError(
                    result,
                    response,
                    'Portrait generation failed'
                );
            }
        }

        throw new Error('Portrait generation is taking longer than expected');
    }

    captureReference(sprite) {
        const frame = sprite?.frame;
        const sourceImage = frame?.source?.image;
        if (!frame || !sourceImage || typeof document === 'undefined') {
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            const size = 512;
            const padding = 48;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = false;

            const sourceWidth = frame.cutWidth || frame.width;
            const sourceHeight = frame.cutHeight || frame.height;
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = sourceWidth;
            sourceCanvas.height = sourceHeight;
            const sourceContext = sourceCanvas.getContext('2d', {
                willReadFrequently: true
            });
            sourceContext.imageSmoothingEnabled = false;
            sourceContext.drawImage(
                sourceImage,
                frame.cutX,
                frame.cutY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                sourceWidth,
                sourceHeight
            );

            const pixels = sourceContext.getImageData(
                0,
                0,
                sourceWidth,
                sourceHeight
            ).data;
            let minX = sourceWidth;
            let minY = sourceHeight;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < sourceHeight; y++) {
                for (let x = 0; x < sourceWidth; x++) {
                    if (pixels[((y * sourceWidth + x) * 4) + 3] < 8) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            if (maxX < minX || maxY < minY) return null;

            const cropPadding = 2;
            const cropX = Math.max(0, minX - cropPadding);
            const cropY = Math.max(0, minY - cropPadding);
            const cropWidth = Math.min(
                sourceWidth - cropX,
                (maxX - minX + 1) + (cropPadding * 2)
            );
            const cropHeight = Math.min(
                sourceHeight - cropY,
                (maxY - minY + 1) + (cropPadding * 2)
            );
            const scale = Math.min(
                (size - padding * 2) / cropWidth,
                (size - padding * 2) / cropHeight
            );
            const drawWidth = Math.max(1, Math.round(cropWidth * scale));
            const drawHeight = Math.max(1, Math.round(cropHeight * scale));

            context.drawImage(
                sourceCanvas,
                cropX,
                cropY,
                cropWidth,
                cropHeight,
                Math.round((size - drawWidth) / 2),
                Math.round((size - drawHeight) / 2),
                drawWidth,
                drawHeight
            );

            const dataUrl = canvas.toDataURL('image/png');
            return dataUrl.length <= 350000 ? dataUrl : null;
        } catch (error) {
            console.warn(
                '[LivingPortraitService] Creature reference capture failed:',
                error.message
            );
            return null;
        }
    }
}

const livingPortraitService = new LivingPortraitService();

if (typeof window !== 'undefined') {
    window.LivingPortraitService = livingPortraitService;
}

export { LivingPortraitService };
export default livingPortraitService;

/**
 * LivingPortraitService
 *
 * Owns deduplicated, background portrait jobs independently of any scene.
 * A hatch reveal can start a job, leave the scene, and consume the same result
 * later from the creature profile or Living Portrait modal.
 */

class LivingPortraitService {
    constructor() {
        this.jobs = new Map();
        this.activeStageJobs = new Map();
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

        const existing = window.GameState?.getCreaturePortrait?.(
            portraitSpec.stage
        );
        if (
            existing?.imageUrl &&
            existing.identityKey === portraitSpec.identityKey
        ) {
            return Promise.resolve(existing);
        }

        const activeJob = this.jobs.get(portraitSpec.identityKey);
        if (activeJob) {
            return activeJob.promise;
        }

        const capturedReference = referenceImage || this.captureReference(sprite);
        const job = {
            identityKey: portraitSpec.identityKey,
            stage: portraitSpec.stage,
            style,
            source,
            status: 'starting',
            startedAt: Date.now(),
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
            source
        });
        return job.promise;
    }

    async runJob({ job, portraitSpec, referenceImage }) {
        try {
            const response = await fetch('/.netlify/functions/generate-ai-art', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    style: job.style,
                    portraitSpec,
                    referenceImage
                })
            });

            const initialResult = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    initialResult.error ||
                    `Portrait service error (${response.status})`
                );
            }

            job.status = initialResult.status || 'processing';
            const result = (
                initialResult.status !== 'succeeded' &&
                initialResult.predictionId
            )
                ? await this.waitForPrediction(initialResult.predictionId, job)
                : initialResult;

            if (!result.success || !result.imageUrl) {
                throw new Error(result.error || 'Portrait generation failed');
            }

            const saved = window.GameState?.saveCreaturePortrait?.({
                identityKey: portraitSpec.identityKey,
                stage: portraitSpec.stage,
                style: job.style,
                imageUrl: result.imageUrl,
                provider: result.provider,
                model: result.model,
                promptVersion: portraitSpec.promptVersion,
                generatedAt: Date.now(),
                expiresAt: result.expiresAt,
                storage: result.storage
            });
            const record = (
                saved &&
                window.GameState?.getCreaturePortrait?.(portraitSpec.stage)
            ) || {
                identityKey: portraitSpec.identityKey,
                stage: portraitSpec.stage,
                style: job.style,
                imageUrl: result.imageUrl
            };

            job.status = 'succeeded';
            job.completedAt = Date.now();
            job.record = record;
            return record;
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            this.jobs.delete(job.identityKey);
            if (this.activeStageJobs.get(job.stage) === job.identityKey) {
                this.activeStageJobs.delete(job.stage);
            }
            window.GameState?.emit?.('creaturePortraitGenerationFailed', {
                identityKey: job.identityKey,
                stage: job.stage,
                message: error.message
            });
            throw error;
        }
    }

    async waitForPrediction(predictionId, job) {
        const startedAt = Date.now();
        const timeoutMs = 120000;

        while (Date.now() - startedAt < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const response = await fetch(
                `/.netlify/functions/generate-ai-art?predictionId=${
                    encodeURIComponent(predictionId)
                }`,
                { headers: { Accept: 'application/json' } }
            );
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    result.error ||
                    `Portrait status error (${response.status})`
                );
            }
            job.status = result.status || 'processing';
            if (result.status === 'succeeded') {
                return result;
            }
            if (result.status === 'failed' || result.status === 'canceled') {
                throw new Error(result.error || 'Portrait generation failed');
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
            const size = 256;
            const padding = 24;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = false;

            const sourceWidth = frame.cutWidth || frame.width;
            const sourceHeight = frame.cutHeight || frame.height;
            const scale = Math.min(
                (size - padding * 2) / sourceWidth,
                (size - padding * 2) / sourceHeight
            );
            const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
            const drawHeight = Math.max(1, Math.round(sourceHeight * scale));

            context.drawImage(
                sourceImage,
                frame.cutX,
                frame.cutY,
                sourceWidth,
                sourceHeight,
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

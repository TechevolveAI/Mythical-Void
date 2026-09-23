import { PreparedFilm } from './PreparedFilm.js';

// Uses the existing player lifecycle, but resolves an already-owned generated
// film instead of the digest-verified shared-film manifest. Never starts a job.
export class GeneratedStoryFilm extends PreparedFilm {
    constructor(service, ready) {
        super(null, { prepareMs: 15000, startupMs: 6000 });
        this.service = service;
        this.ready = ready;
        this.receiptRecorded = false;
    }

    async load(signal) {
        const portrait = window.GameState?.getCreaturePortrait?.(this.ready.stage);
        if (portrait?.identityKey !== this.ready.identityKey) throw new Error('identity_changed');
        const result = await this.service.resolveGeneratedVideo({
            momentId: this.ready.momentId, portraitRecord: portrait, stored: this.ready
        });
        if (signal.aborted) throw new Error('aborted');
        if (!result?.videoUrl) throw new Error('unavailable');
        const url = new URL(result.videoUrl, window.location.origin);
        if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('invalid_url');
        this.portrait = portrait;
        const video = this.video = this.options.createVideo();
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.referrerPolicy = 'no-referrer';
        this.onWaiting = () => {
            if (this.state !== 'playing') return;
            clearTimeout(this.stallTimer);
            this.stallTimer = setTimeout(() => {
                this.pause(); this.setState('failed', 'playback_stalled');
            }, this.options.startupMs);
        };
        this.onProgress = () => clearTimeout(this.stallTimer);
        video.addEventListener('waiting', this.onWaiting);
        video.addEventListener('timeupdate', this.onProgress);
        await new Promise((resolve, reject) => {
            const finish = error => {
                video.removeEventListener('loadeddata', loaded);
                video.removeEventListener('error', failed);
                signal.removeEventListener('abort', aborted);
                error ? reject(new Error(error)) : resolve();
            };
            const loaded = () => finish(video.videoWidth > 0 && video.videoHeight > 0 &&
                Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 60 ? null : 'invalid_media');
            const failed = () => finish('decode_failed');
            const aborted = () => finish('aborted');
            video.addEventListener('loadeddata', loaded);
            video.addEventListener('error', failed);
            signal.addEventListener('abort', aborted, { once: true });
            video.src = url.href;
            video.load();
            if (signal.aborted) aborted();
        });
    }

    setState(state, error = null) {
        super.setState(state, error);
        // PreparedFilm only reports playing after actual video-frame progress.
        if (state === 'playing' && !this.receiptRecorded) {
            this.receiptRecorded = true;
            this.service.recordAppearance(this.ready.momentId, this.portrait, 'generated_video');
        }
    }
}

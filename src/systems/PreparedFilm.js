/** A single, bounded shared film. No accounts, saves or generation requests. */
export class PreparedFilm {
    constructor(asset, options = {}) {
        this.asset = asset;
        this.options = {
            maxBytes: 8 * 1024 * 1024,
            prepareMs: 20000,
            startupMs: 3000,
            origin: globalThis.location?.origin,
            fetch: (...args) => globalThis.fetch(...args),
            createVideo: () => document.createElement('video'),
            createURL: blob => URL.createObjectURL(blob),
            revokeURL: url => URL.revokeObjectURL(url),
            digest: bytes => globalThis.crypto.subtle.digest('SHA-256', bytes),
            ...options
        };
        this.state = 'absent';
        this.error = null;
        this.video = null;
        this.url = null;
        this.listeners = new Set();
        this.controller = null;
        this.pending = null;
        this.stopPlaybackWait = null;
        this.stallTimer = null;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    setState(state, error = null) {
        this.state = state;
        this.error = error;
        this.listeners.forEach(listener => listener(state));
    }

    validateAsset() {
        const { asset, options } = this;
        if (!asset || !/^\/game\/cinematics\/[a-z0-9/_.-]+\.mp4$/i.test(asset.url || '') ||
            asset.url.includes('..') || !/^[a-f0-9]{64}$/.test(asset.sha256 || '') ||
            !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > options.maxBytes ||
            !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0 ||
            asset.durationSeconds > 60) {
            throw new Error('invalid_asset');
        }
        return new URL(asset.url, options.origin).href;
    }

    prepare() {
        if (this.state === 'disposed') return Promise.resolve(false);
        if (this.pending) return this.pending;
        if (['prepared', 'playing', 'paused', 'ended'].includes(this.state)) return Promise.resolve(true);
        this.releaseMedia();
        const controller = new AbortController();
        this.controller = controller;
        this.setState('fetching');
        const deadline = setTimeout(() => controller.abort(), this.options.prepareMs);
        this.pending = this.load(controller.signal)
            .then(() => {
                if (controller.signal.aborted || this.state === 'disposed') return false;
                this.setState('prepared');
                return true;
            })
            .catch(error => {
                this.releaseMedia();
                if (this.state !== 'disposed') {
                    this.setState('failed', controller.signal.aborted ? 'prepare_timeout' : error.message);
                }
                return false;
            })
            .finally(() => {
                clearTimeout(deadline);
                this.pending = null;
                if (this.controller === controller) this.controller = null;
            });
        return this.pending;
    }

    async load(signal) {
        const response = await this.options.fetch(this.validateAsset(), {
            signal, credentials: 'omit', redirect: 'error', cache: 'default'
        });
        if (!response.ok || !/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '')) {
            throw new Error('invalid_response');
        }
        const length = response.headers.get('content-length');
        if (length && Number(length) !== this.asset.bytes) throw new Error('size_mismatch');
        // Count the stream, including chunked responses, before allocating a Blob.
        const reader = response.body?.getReader?.();
        if (!reader) throw new Error('unsupported_stream');
        const chunks = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (signal.aborted) throw new Error('aborted');
                if (done) break;
                size += value.byteLength;
                if (size > this.asset.bytes || size > this.options.maxBytes) throw new Error('too_large');
                chunks.push(value);
            }
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
        if (size !== this.asset.bytes) throw new Error('size_mismatch');
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const hash = Array.from(new Uint8Array(await this.options.digest(await blob.arrayBuffer())))
            .map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== this.asset.sha256) throw new Error('hash_mismatch');
        if (signal.aborted) throw new Error('aborted');
        const video = this.options.createVideo();
        this.video = video;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.loop = false;
        this.onWaiting = () => {
            if (this.state !== 'playing') return;
            clearTimeout(this.stallTimer);
            this.stallTimer = setTimeout(() => {
                this.pause();
                this.setState('failed', 'playback_stalled');
            }, this.options.startupMs);
        };
        this.onProgress = () => clearTimeout(this.stallTimer);
        video.addEventListener('waiting', this.onWaiting);
        video.addEventListener('timeupdate', this.onProgress);
        video.setAttribute('playsinline', '');
        this.url = this.options.createURL(blob);
        await new Promise((resolve, reject) => {
            const finish = error => {
                video.removeEventListener('loadeddata', ready);
                video.removeEventListener('error', failed);
                signal.removeEventListener('abort', aborted);
                if (error) reject(new Error(error));
                else resolve();
            };
            const ready = () => {
                if (!(video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) ||
                    !Number.isFinite(video.duration) ||
                    Math.abs(video.duration - this.asset.durationSeconds) > 0.75) {
                    finish('invalid_media');
                } else finish();
            };
            const failed = () => finish('decode_failed');
            const aborted = () => finish('aborted');
            video.addEventListener('loadeddata', ready);
            video.addEventListener('error', failed);
            signal.addEventListener('abort', aborted, { once: true });
            video.src = this.url;
            video.load();
            if (signal.aborted) aborted();
            // Preparation never calls play(), not even muted in a hidden element.
        });
    }

    play({ restart = false } = {}) {
        if (!this.video || !['prepared', 'paused', 'ended'].includes(this.state)) {
            return Promise.resolve(false);
        }
        const video = this.video;
        if (restart || this.state === 'ended') video.currentTime = 0;
        const startTime = video.currentTime;
        this.setState('starting');
        return new Promise(resolve => {
            let settled = false;
            let frameId;
            const finish = (ok, error = null) => {
                if (settled) return;
                settled = true;
                clearTimeout(deadline);
                if (frameId !== undefined) video.cancelVideoFrameCallback?.(frameId);
                video.removeEventListener('timeupdate', progressed);
                video.removeEventListener('error', failed);
                this.stopPlaybackWait = null;
                if (!ok) video.pause();
                if (!['disposed', 'paused'].includes(this.state)) this.setState(ok ? 'playing' : 'failed', error);
                resolve(ok);
            };
            const failed = () => finish(false, 'playback_failed');
            const progressed = () => {
                if (video.currentTime > startTime && !video.paused && video.readyState >= 2) finish(true);
            };
            const frame = (_, metadata) => {
                if (metadata.mediaTime > startTime && !video.paused) finish(true);
                else if (!settled) frameId = video.requestVideoFrameCallback(frame);
            };
            const deadline = setTimeout(() => finish(false, 'startup_timeout'), this.options.startupMs);
            this.stopPlaybackWait = () => finish(false, 'interrupted');
            video.addEventListener('error', failed);
            if (video.requestVideoFrameCallback) frameId = video.requestVideoFrameCallback(frame);
            else video.addEventListener('timeupdate', progressed);
            try {
                // Called directly from Watch: no network or await before the gesture-owned play.
                Promise.resolve(video.play()).catch(() => finish(false, 'play_rejected'));
            } catch {
                finish(false, 'play_rejected');
            }
        });
    }

    pause() {
        if (!['playing', 'starting'].includes(this.state)) return;
        clearTimeout(this.stallTimer);
        this.video?.pause();
        this.setState('paused');
        this.stopPlaybackWait?.();
    }

    finish() {
        clearTimeout(this.stallTimer);
        if (this.state === 'playing') this.setState('ended');
    }

    releaseMedia() {
        clearTimeout(this.stallTimer);
        this.stopPlaybackWait?.();
        if (this.video) {
            this.video.removeEventListener('waiting', this.onWaiting);
            this.video.removeEventListener('timeupdate', this.onProgress);
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
            this.video.remove();
            this.video = null;
        }
        if (this.url) this.options.revokeURL(this.url);
        this.url = null;
    }

    dispose() {
        if (this.state === 'disposed') return;
        this.setState('disposed');
        this.controller?.abort();
        this.releaseMedia();
        this.listeners.clear();
    }
}

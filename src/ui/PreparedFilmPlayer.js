import './prepared-film-player.css';

/** Owns only presentation and its pause lease. Never grants a reward or starts generation. */
export class PreparedFilmPlayer {
    constructor({ film, title, scene = null, onClose = () => {} }) {
        this.film = film;
        this.scene = scene;
        this.onClose = onClose;
        this.closed = false;
        this.sceneRetired = false;
        this.mounting = true;
        this.ownsPause = false;
        this.sceneSource = { systems: scene?.sys, plugin: scene?.scene,
            events: scene?.events, systemEvents: scene?.sys?.events };
        this.previousFocus = document.activeElement;
        this.root = document.createElement('section');
        this.root.className = 'prepared-film-player';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', title);
        const heading = document.createElement('h2');
        heading.textContent = title;
        this.viewport = document.createElement('div');
        this.viewport.className = 'prepared-film-player__viewport';
        this.status = document.createElement('p');
        this.status.setAttribute('role', 'status');
        this.action = document.createElement('button');
        this.action.type = 'button';
        this.closeButton = document.createElement('button');
        this.closeButton.type = 'button';
        this.closeButton.textContent = 'Continue';
        const controls = document.createElement('footer');
        controls.append(this.action, this.closeButton);
        this.root.append(heading, this.viewport, this.status, controls);
        this.action.addEventListener('click', () => this.act());
        this.closeButton.addEventListener('click', () => this.close());
        this.onEnded = () => film.finish();
        this.onMediaError = () => {
            if (film.state === 'playing') {
                film.pause();
                film.setState('failed', 'playback_failed');
            }
        };
        this.onHidden = () => {
            if (document.hidden) film.pause();
        };
        this.onShutdown = () => {
            this.sceneRetired = true;
            this.close({ resume: false, notify: !this.mounting });
        };
        this.onSceneResume = () => { if (!this.closed) this.ownsPause = false; };
        this.onKey = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            }
            if (event.key === 'Tab') {
                const buttons = [this.action, this.closeButton].filter(button => !button.disabled);
                const index = buttons.indexOf(document.activeElement);
                event.preventDefault();
                buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
            }
        };
        try {
            this.unsubscribe = film.subscribe(() => this.render());
            this.sceneSource.events?.once?.('shutdown', this.onShutdown);
            this.sceneSource.events?.once?.('destroy', this.onShutdown);
            this.sceneSource.events?.on?.('resume', this.onSceneResume);
            if (this.isSceneCurrent() && this.sceneSource.systems?.isActive?.() === true) {
                const reset = action => {
                    if (!this.closed && this.isSceneCurrent()) action();
                };
                reset(() => scene.input?.keyboard?.resetKeys?.());
                reset(() => scene.clearVirtualJumpInput?.());
                reset(() => scene.releaseAllPlatformerActionButtons?.());
                reset(() => { if ('virtualJoystickX' in scene) scene.virtualJoystickX = 0; });
                reset(() => { if ('virtualJoystickY' in scene) scene.virtualJoystickY = 0; });
                if (!this.closed && this.isSceneCurrent() && this.sceneSource.systems.isActive()) {
                    // ScenePlugin queues by key. The owned Systems pause must be
                    // synchronous so an early Continue cannot leave a late pause.
                    this.ownsPause = true;
                    this.sceneSource.systems.pause();
                }
            }
            if (this.closed || !this.isSceneCurrent()) {
                this.close({ resume: false, notify: false });
                return;
            }
            document.addEventListener('visibilitychange', this.onHidden);
            this.root.addEventListener('keydown', this.onKey);
            document.body.append(this.root);
            this.render();
            if (!this.closed) this.closeButton.focus();
            this.mounting = false;
        } catch (error) {
            try { this.close({ notify: false }); } catch { /* Preserve the required setup failure. */ }
            throw error;
        }
    }

    isSceneCurrent() {
        const source = this.sceneSource;
        return !this.scene || (this.scene.sys === source.systems && this.scene.scene === source.plugin &&
            this.scene.events === source.events && source.systems?.events === source.systemEvents);
    }

    render() {
        if (this.closed) return;
        if (!this.isSceneCurrent()) { this.close({ resume: false, notify: false }); return; }
        const film = this.film;
        if (film.video && this.attachedVideo !== film.video) {
            this.detachVideo();
            this.attachedVideo = film.video;
            film.video.addEventListener('ended', this.onEnded);
            film.video.addEventListener('error', this.onMediaError);
            film.video.setAttribute('aria-label', this.root.getAttribute('aria-label'));
            this.viewport.replaceChildren(film.video);
        }
        const states = {
            absent: ['Prepare film', ''],
            fetching: ['Preparing...', 'Preparing film...'],
            prepared: ['Watch', ''],
            starting: ['Opening...', 'Opening film...'],
            playing: ['Pause', ''],
            paused: ['Resume', 'Paused'],
            ended: ['Watch again', ''],
            failed: ['Retry', 'Video couldn\'t play. You can continue.'],
            disposed: ['Unavailable', 'You can continue.']
        };
        const [label, status] = states[film.state];
        this.action.textContent = label;
        this.status.textContent = status;
        this.action.disabled = ['fetching', 'starting', 'disposed'].includes(film.state);
    }

    act() {
        if (this.closed) return;
        if (!this.isSceneCurrent()) { this.close({ resume: false, notify: false }); return; }
        if (['absent', 'failed'].includes(this.film.state)) void this.film.prepare();
        else if (this.film.state === 'playing') this.film.pause();
        else void this.film.play();
    }

    detachVideo() {
        const video = this.attachedVideo;
        this.attachedVideo = null;
        try { video?.removeEventListener('ended', this.onEnded); } catch { /* Best-effort native cleanup. */ }
        try { video?.removeEventListener('error', this.onMediaError); } catch { /* Release the other listener too. */ }
    }

    close({ resume = true, notify = true } = {}) {
        if (this.closed) return;
        this.closed = true;
        const release = action => {
            try { action(); } catch { /* One optional cleanup failure cannot block Continue. */ }
        };
        release(() => this.unsubscribe());
        release(() => this.detachVideo());
        release(() => this.film.dispose());
        release(() => document.removeEventListener('visibilitychange', this.onHidden));
        release(() => this.sceneSource.events?.off?.('shutdown', this.onShutdown));
        release(() => this.sceneSource.events?.off?.('destroy', this.onShutdown));
        release(() => this.sceneSource.events?.off?.('resume', this.onSceneResume));
        release(() => this.root.removeEventListener('keydown', this.onKey));
        release(() => this.root.remove());
        release(() => {
            if (resume && !this.sceneRetired && this.ownsPause && this.isSceneCurrent() &&
                this.sceneSource.systems?.isPaused?.() === true) this.sceneSource.systems.resume();
        });
        release(() => { if (this.isSceneCurrent() && this.previousFocus?.isConnected) this.previousFocus.focus(); });
        if (notify && this.isSceneCurrent()) this.onClose();
    }
}

import './prepared-film-player.css';

/** Owns only presentation and its pause lease. Never grants a reward or starts generation. */
export class PreparedFilmPlayer {
    constructor({ film, title, scene = null, onClose = () => {} }) {
        this.film = film;
        this.scene = scene;
        this.onClose = onClose;
        this.closed = false;
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
        this.onShutdown = () => this.close({ resume: false });
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
        this.unsubscribe = film.subscribe(() => this.render());
        this.ownsPause = scene?.sys?.isActive?.() === true;
        if (this.ownsPause) {
            scene.input?.keyboard?.resetKeys?.();
            scene.clearVirtualJumpInput?.();
            scene.releaseAllPlatformerActionButtons?.();
            if ('virtualJoystickX' in scene) scene.virtualJoystickX = 0;
            if ('virtualJoystickY' in scene) scene.virtualJoystickY = 0;
            scene.scene.pause();
        }
        scene?.events?.once?.('shutdown', this.onShutdown);
        scene?.events?.once?.('destroy', this.onShutdown);
        document.addEventListener('visibilitychange', this.onHidden);
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root);
        this.render();
        this.closeButton.focus();
    }

    render() {
        if (this.closed) return;
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
        if (['absent', 'failed'].includes(this.film.state)) void this.film.prepare();
        else if (this.film.state === 'playing') this.film.pause();
        else void this.film.play();
    }

    detachVideo() {
        this.attachedVideo?.removeEventListener('ended', this.onEnded);
        this.attachedVideo?.removeEventListener('error', this.onMediaError);
        this.attachedVideo = null;
    }

    close({ resume = true } = {}) {
        if (this.closed) return;
        this.closed = true;
        this.unsubscribe();
        this.detachVideo();
        this.film.dispose();
        document.removeEventListener('visibilitychange', this.onHidden);
        this.scene?.events?.off?.('shutdown', this.onShutdown);
        this.scene?.events?.off?.('destroy', this.onShutdown);
        this.root.removeEventListener('keydown', this.onKey);
        this.root.remove();
        if (resume && this.ownsPause && this.scene?.sys?.isPaused?.() === true) this.scene.scene.resume();
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
        this.onClose();
    }
}

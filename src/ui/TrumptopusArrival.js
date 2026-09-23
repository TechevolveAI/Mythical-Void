import './trumptopus-result.css';

// Optional arrival film. The route owns progress; this cue never awards or advances it.
export class TrumptopusArrival {
    constructor(scene, { films, onContinue }) {
        this.scene = scene; this.films = films; this.onContinue = onContinue;
        this.closed = false; this.continuing = false; this.root = null;
        this.onShutdown = () => this.close();
        scene.events.once('shutdown', this.onShutdown);
        scene.events.once('destroy', this.onShutdown);
        if (films.getFilm('arrival')) this.prepare();
    }

    prepare() {
        void this.films.prepare('arrival').catch(() => this.render());
    }

    offer() {
        if (this.closed) return false;
        if (this.root) return true;
        this.film = this.films.getFilm('arrival');
        if (!this.film) return false;
        this.previousFocus = document.activeElement;
        this.scene.clearInput();
        this.scene.setPrototypePaused(true);
        this.scene.hidePlatformerMobileControls();
        // Pause the scene as well as physics: focus/menu events cannot resume combat behind the cue.
        this.scene.scene.pause();
        this.root = document.createElement('section');
        this.root.className = 'trumptopus-result trumptopus-arrival';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', 'Face Trumptopus');
        const body = document.createElement('div'); body.className = 'trumptopus-result__body';
        const heading = document.createElement('h2'); heading.textContent = 'Trumptopus';
        const story = document.createElement('p'); story.textContent = 'He is holding this world apart. Break his grip.';
        this.status = document.createElement('p'); this.status.className = 'trumptopus-result__detail';
        this.status.setAttribute('role', 'status');
        this.notice = document.createElement('p'); this.notice.className = 'trumptopus-result__notice';
        this.notice.setAttribute('role', 'status');
        body.append(heading, story, this.status, this.notice);
        this.watch = document.createElement('button'); this.watch.type = 'button';
        this.watch.onclick = () => {
            if (this.film.state === 'failed') { this.prepare(); return; }
            if (this.films.watch('arrival', { onClose: () => this.continue() })) this.root.hidden = true;
        };
        this.primary = document.createElement('button'); this.primary.type = 'button';
        this.primary.className = 'trumptopus-result__primary'; this.primary.textContent = 'Face Trumptopus';
        this.primary.onclick = () => this.continue();
        const footer = document.createElement('footer'); footer.append(this.watch, this.primary);
        this.root.append(body, footer);
        this.onKey = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); this.continue();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                const buttons = [this.watch, this.primary].filter(button => !button.disabled);
                if (!buttons.length) return;
                const index = buttons.indexOf(document.activeElement);
                buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
            }
        };
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root);
        this.unsubscribe = this.film.subscribe(() => this.render());
        this.render(); this.primary.focus();
        return true;
    }

    render() {
        if (this.closed || !this.root) return;
        const state = this.film.state;
        this.watch.disabled = !['prepared', 'failed'].includes(state);
        this.watch.textContent = state === 'failed' ? 'Retry film' : 'Watch';
        this.status.textContent = ['absent', 'fetching'].includes(state) ? 'Preparing the film. You can go ahead.'
            : ['failed', 'disposed'].includes(state) ? 'The film is unavailable. You can go ahead.' : '';
    }

    continue() {
        if (this.closed || this.continuing) return;
        this.continuing = true; this.primary.disabled = true;
        try { this.onContinue(); }
        catch (error) {
            this.continuing = false; this.primary.disabled = false; this.root.hidden = false;
            this.notice.textContent = 'The fight could not open. Please try again.';
            this.primary.focus();
        }
    }

    close() {
        if (this.closed) return;
        this.closed = true; this.unsubscribe?.();
        this.root?.removeEventListener('keydown', this.onKey); this.root?.remove();
        this.scene.events.off('shutdown', this.onShutdown);
        this.scene.events.off('destroy', this.onShutdown);
        // Scene transition owns the pause. Never resume a shutting-down approach.
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}

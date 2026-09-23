import './trumptopus-result.css';

// Presentation only: rewards have already been committed before this is created.
export class TrumptopusResult {
    constructor({ receipt, persisted, primaryLabel, onContinue, films }) {
        this.films = films;
        this.closed = false;
        this.continuing = false;
        this.previousFocus = document.activeElement;
        this.root = document.createElement('section');
        this.root.className = 'trumptopus-result';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', 'Trumptopus defeated');
        const body = document.createElement('div'); body.className = 'trumptopus-result__body';
        const heading = document.createElement('h2'); heading.textContent = 'His grip is broken.';
        const story = document.createElement('p'); story.textContent = 'Trumptopus is banished. Nova is safe.';
        const rewards = document.createElement('dl');
        for (const [label, value] of [
            ['Command Module', receipt.partAwarded ? 'Recovered for the ship' : 'Already recovered'],
            ['Coins', `+${receipt.coinsAwarded.toLocaleString('en')}`],
            [receipt.powerup.name, receipt.powerup.queued ? 'Kept safe until your inventory has room' : receipt.powerup.resultText]
        ]) {
            const term = document.createElement('dt'); term.textContent = label;
            const description = document.createElement('dd'); description.textContent = value;
            rewards.append(term, description);
        }
        const usage = document.createElement('p');
        usage.className = 'trumptopus-result__detail';
        usage.textContent = 'Use Super Blast from Power-ups in an expedition pause menu.';
        this.notice = document.createElement('p'); this.notice.setAttribute('role','status');
        this.notice.className = 'trumptopus-result__notice';
        this.notice.textContent = persisted === false ? 'Keep this tab open. Your progress is only saved for this visit.' : '';
        this.filmStatus = document.createElement('p'); this.filmStatus.setAttribute('role','status');
        this.filmStatus.className = 'trumptopus-result__detail';
        const footer = document.createElement('footer');
        this.watch = document.createElement('button'); this.watch.type = 'button'; this.watch.textContent = 'Watch';
        this.primary = document.createElement('button'); this.primary.type = 'button';
        this.primary.className = 'trumptopus-result__primary'; this.primary.textContent = primaryLabel;
        this.primary.onclick = () => {
            if (this.continuing || this.closed) return;
            this.continuing = true; this.primary.disabled = true;
            try { onContinue(); }
            catch (error) {
                this.continuing = false; this.primary.disabled = false;
                this.notice.textContent = 'The next step could not open. Please try again.';
            }
        };
        this.watch.onclick = () => {
            if (this.films?.getFilm('victory')?.state === 'failed') {
                this.prepareFilm();
                return;
            }
            if (this.films?.watch('victory', { onClose: () => {
                if (this.closed) return;
                this.root.hidden = false; this.primary.focus(); this.bindFilm();
            } })) this.root.hidden = true;
        };
        footer.append(this.watch, this.primary);
        body.append(heading, story, rewards, usage, this.notice, this.filmStatus);
        this.root.append(body, footer);
        this.onKey = event => {
            if (event.key !== 'Tab') return;
            const buttons = [this.watch, this.primary].filter(button => !button.hidden && !button.disabled);
            if (!buttons.length) return;
            event.preventDefault();
            const index = buttons.indexOf(document.activeElement);
            buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        };
        this.root.addEventListener('keydown', this.onKey);
        document.body.append(this.root); this.primary.focus(); this.bindFilm();
    }

    bindFilm() {
        this.unsubscribe?.();
        const film = this.films?.getFilm('victory');
        this.watch.hidden = !film;
        if (!film) { this.filmStatus.textContent = ''; return; }
        const render = () => {
            if (this.closed) return;
            this.watch.disabled = !['prepared','failed'].includes(film.state);
            this.watch.textContent = film.state === 'failed' ? 'Retry film' : 'Watch';
            this.filmStatus.textContent = ['failed','disposed'].includes(film.state)
                ? 'The film is unavailable. You can continue.'
                : ['absent','fetching'].includes(film.state) ? 'Preparing the film. You can continue now.' : '';
        };
        this.unsubscribe = film.subscribe(render); render();
        // Preparation has no generation side effects and never starts playback.
        if (film.state === 'absent') this.prepareFilm();
    }

    prepareFilm() {
        void this.films.prepare('victory').catch(() => {
            if (!this.closed) {
                this.watch.disabled = false; this.watch.textContent = 'Retry film';
                this.filmStatus.textContent = 'The film is unavailable. You can continue.';
            }
        });
    }

    close() {
        if (this.closed) return;
        this.closed = true; this.unsubscribe?.();
        this.root.removeEventListener('keydown', this.onKey);
        this.root.remove();
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}

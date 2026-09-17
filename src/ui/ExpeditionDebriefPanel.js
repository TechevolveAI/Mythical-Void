function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

// This blocking handoff uses browser layout and input, not camera coordinates.
// The story may scroll; the only action never scrolls out of reach.
export default class ExpeditionDebriefPanel {
    constructor({ onContinue }) {
        this.onContinue = onContinue;
        this.root = null;
        this.busy = false;
        this.updateViewport = () => {
            if (!this.root) return;
            const viewport = window.visualViewport;
            Object.assign(this.root.style, {
                width: `${viewport?.width || window.innerWidth}px`,
                height: `${viewport?.height || window.innerHeight}px`,
                left: `${viewport?.offsetLeft || 0}px`,
                top: `${viewport?.offsetTop || 0}px`
            });
        };
        this.onKeyDown = event => {
            if (!this.root) return;
            // Do not let Phaser's hub shortcuts select a gate behind the dialog.
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                this.continue();
            } else if (event.key === 'Tab') {
                const targets = [...this.root.querySelectorAll('summary, button:not(:disabled), [tabindex="0"]')];
                const current = targets.indexOf(document.activeElement);
                const next = event.shiftKey ? current - 1 : current + 1;
                event.preventDefault();
                targets[(next + targets.length) % targets.length]?.focus();
            }
        };
    }

    show({ title, context, finding, creatureMoment, fieldNote, nextStep, actionLabel, color }) {
        if (this.root) return false;
        this.previousFocus = document.activeElement;
        this.busy = false;
        const root = element('div', 'expedition-debrief');
        root.dataset.testid = 'expedition-debrief';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Expedition complete');
        if (/^#[0-9a-f]{6}$/i.test(color || '')) root.style.setProperty('--debrief-accent', color);

        const shell = element('section', 'expedition-debrief-shell');
        const header = element('header', 'expedition-debrief-header');
        header.append(
            element('p', 'expedition-debrief-eyebrow', 'EXPEDITION COMPLETE'),
            element('h2', 'expedition-debrief-title', title),
            element('p', 'expedition-debrief-context', context)
        );
        const story = element('div', 'expedition-debrief-story');
        story.tabIndex = 0;
        story.setAttribute('aria-label', 'Expedition discoveries');
        story.append(
            element('h3', 'expedition-debrief-eyebrow', 'WHAT CHANGED'),
            element('p', '', finding)
        );
        if (creatureMoment) story.append(element('p', 'expedition-debrief-creature', creatureMoment));
        if (fieldNote) {
            const details = element('details', 'expedition-debrief-details');
            details.append(element('summary', '', 'Field note'), element('p', '', fieldNote));
            story.append(details);
        }
        const footer = element('footer', 'expedition-debrief-footer');
        footer.append(element('p', 'expedition-debrief-next', nextStep));
        this.error = element('p', 'expedition-debrief-error');
        this.error.setAttribute('role', 'status');
        this.error.hidden = true;
        this.button = element('button', 'expedition-debrief-continue', actionLabel);
        this.button.type = 'button';
        this.button.dataset.testid = 'expedition-debrief-continue';
        this.button.addEventListener('click', () => this.continue());
        footer.append(this.error, this.button);
        shell.append(header, story, footer);
        root.append(shell);
        this.root = root;
        document.body.append(root);
        this.updateViewport();
        window.addEventListener('resize', this.updateViewport);
        window.visualViewport?.addEventListener('resize', this.updateViewport);
        window.visualViewport?.addEventListener('scroll', this.updateViewport);
        window.addEventListener('keydown', this.onKeyDown, true);
        this.button.focus({ preventScroll: true });
        return true;
    }

    continue() {
        if (!this.root || this.busy) return false;
        this.busy = true;
        this.button.disabled = true;
        try {
            if (this.onContinue?.() === false) {
                this.busy = false;
                this.button.disabled = false;
                return false;
            }
            this.destroy();
            return true;
        } catch (error) {
            console.error('[ExpeditionDebrief] Continue failed', error);
            if (this.root) {
                this.error.textContent = 'Could not continue yet. Please try again.';
                this.error.hidden = false;
                this.button.disabled = false;
                this.busy = false;
            }
            return false;
        }
    }

    destroy() {
        if (!this.root) return;
        window.removeEventListener('resize', this.updateViewport);
        window.visualViewport?.removeEventListener('resize', this.updateViewport);
        window.visualViewport?.removeEventListener('scroll', this.updateViewport);
        window.removeEventListener('keydown', this.onKeyDown, true);
        const ownedFocus = this.root.contains(document.activeElement);
        this.root.remove();
        this.root = null;
        if (ownedFocus && this.previousFocus?.isConnected) this.previousFocus.focus?.({ preventScroll: true });
    }
}

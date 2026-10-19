import './trumptopus-result.css';

export class TrumptopusSessionMenu {
    constructor({ defeated, onResume, onRetry, onPowerups, onExit }) {
        this.closed = false;
        this.acting = false;
        this.previousFocus = document.activeElement;
        this.root = document.createElement('section');
        this.root.className = 'trumptopus-result';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', defeated ? 'Try again' : 'Paused');
        const body = document.createElement('div');
        body.className = 'trumptopus-result__body';
        const title = document.createElement('h2');
        title.textContent = defeated ? 'Try again' : 'Paused';
        const message = document.createElement('p');
        message.textContent = 'Retry from your last checkpoint.';
        this.notice = document.createElement('p');
        this.notice.className = 'trumptopus-result__notice';
        this.notice.setAttribute('role', 'status');
        body.append(title, message, this.notice);
        const footer = document.createElement('footer');
        const choices = defeated
            ? [['Try again', onRetry], ['Return to the gates', onExit]]
            : [['Resume', onResume], ['Power-ups', onPowerups], ['Retry checkpoint', onRetry], ['Return to the gates', onExit]];
        this.buttons = choices.map(([label, action], index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = label;
            if (index === 0) button.className = 'trumptopus-result__primary';
            button.onclick = () => this.runAction(action, button);
            footer.append(button);
            return button;
        });
        this.onKey = event => {
            if (this.closed || this.acting) return;
            if (event.key === 'Escape' && !defeated) {
                event.preventDefault(); event.stopPropagation(); this.runAction(onResume, this.buttons[0]);
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                const index = this.buttons.indexOf(document.activeElement);
                this.buttons[(index + (event.shiftKey ? -1 : 1) + this.buttons.length) % this.buttons.length].focus();
            }
        };
        this.root.addEventListener('keydown', this.onKey);
        this.root.append(body, footer);
        document.body.append(this.root);
        this.buttons[0].focus();
    }

    runAction(action, button) {
        if (this.closed || this.acting || typeof action !== 'function') return false;
        this.acting = true;
        const disabled = this.buttons.map(button => button.disabled);
        this.buttons.forEach(button => { button.disabled = true; });
        this.notice.textContent = '';
        let accepted = false;
        try { accepted = action() !== false; } catch { /* Keep the existing retry/exit controls. */ }
        this.acting = false;
        if (!this.closed) {
            this.buttons.forEach((button, index) => { button.disabled = disabled[index]; });
            if (!accepted) {
                this.notice.textContent = 'That did not open. Try again.';
                button?.focus();
            }
        }
        return accepted;
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.buttons.forEach(button => { button.onclick = null; });
        this.root.removeEventListener('keydown', this.onKey);
        this.root.remove(); this.root = null;
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}

import './trumptopus-result.css';

export class TrumptopusSessionMenu {
    constructor({ defeated, onResume, onRetry, onPowerups, onExit }) {
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
        body.append(title, message);
        const footer = document.createElement('footer');
        const choices = defeated
            ? [['Try again', onRetry], ['Return to the gates', onExit]]
            : [['Resume', onResume], ['Power-ups', onPowerups], ['Retry checkpoint', onRetry], ['Return to the gates', onExit]];
        this.buttons = choices.map(([label, action], index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = label;
            if (index === 0) button.className = 'trumptopus-result__primary';
            button.onclick = action;
            footer.append(button);
            return button;
        });
        this.onKey = event => {
            if (event.key === 'Escape' && !defeated) {
                event.preventDefault(); event.stopPropagation(); onResume();
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

    close() {
        if (!this.root) return;
        this.root.removeEventListener('keydown', this.onKey);
        this.root.remove(); this.root = null;
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}

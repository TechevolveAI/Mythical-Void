/** One game writer per browser origin. The browser releases this lock on tab exit. */
export default class GameTabSession {
    constructor({ lockManager = navigator.locks, documentRef = document,
        windowRef = window, onRetired = () => {} } = {}) {
        this.lockManager = lockManager;
        this.document = documentRef;
        this.window = windowRef;
        this.onRetired = onRetired;
        this.owned = false;
        this.retired = false;
        this.checking = false;
        this.panel = null;
        this.button = null;
        this.releaseLock = null;
        this.ready = new Promise(resolve => { this.resolveReady = resolve; });
        this.onPageHide = () => this.retire();
        this.onPageShow = event => {
            // A restored page must reacquire ownership and reload the latest save.
            if (event.persisted) this.window.location.reload();
        };
    }

    waitUntilReady() {
        if (!this.started) {
            this.started = true;
            this.window.addEventListener('pagehide', this.onPageHide);
            this.window.addEventListener('pageshow', this.onPageShow);
            this.tryAcquire();
        }
        return this.ready;
    }

    tryAcquire() {
        if (this.retired || this.owned || this.checking) return;
        if (typeof this.lockManager?.request !== 'function') {
            this.showWaiting(false);
            return;
        }
        this.checking = true;
        if (this.button) this.button.disabled = true;
        const failed = () => {
            if (this.owned) this.retire();
            if (!this.retired) this.showWaiting(false);
        };
        try {
            this.request = Promise.resolve(this.lockManager.request(
                'mythical-void:game-tab', { mode: 'exclusive', ifAvailable: true }, lock => {
                    if (this.retired) return;
                    if (!lock) { this.showWaiting(true); return; }
                    this.owned = true;
                    this.panel?.remove();
                    this.panel = null;
                    this.button = null;
                    const held = new Promise(resolve => { this.releaseLock = resolve; });
                    this.resolveReady(true);
                    return held;
                }
            )).catch(failed).finally(() => {
                this.checking = false;
                if (this.button) this.button.disabled = false;
            });
        } catch {
            this.checking = false;
            failed();
        }
    }

    showWaiting(busy) {
        if (this.retired) return;
        this.panel?.remove();
        const overlay = this.document.createElement('div');
        overlay.className = 'game-tab-wait';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'game-tab-title');
        const panel = this.document.createElement('section');
        const title = this.document.createElement('h1');
        title.id = 'game-tab-title';
        title.textContent = busy ? 'Your game is open in another tab' : 'Your game is waiting';
        const text = this.document.createElement('p');
        text.textContent = busy
            ? 'Keep playing there, or close that tab and continue here. We will load your latest saved progress.'
            : 'We could not open your saved game safely in this browser. Try again, or use an up-to-date browser.';
        const button = this.document.createElement('button');
        button.type = 'button';
        button.textContent = busy ? 'Continue here' : 'Try again';
        button.addEventListener('click', () => this.tryAcquire());
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
        });
        panel.append(title, text, button);
        overlay.append(panel);
        this.document.body.append(overlay);
        this.panel = overlay;
        this.button = button;
        button.focus();
    }

    retire() {
        if (this.retired) return;
        this.retired = true;
        // Retire all gameplay writers before another document can acquire the lock.
        // If retirement fails, retain the lock until the browser closes this document.
        if (this.owned) this.onRetired();
        this.owned = false;
        this.panel?.remove();
        this.panel = null;
        this.resolveReady(false);
        this.releaseLock?.();
    }
}

import LocalAdventureStore from '../systems/LocalAdventureStore.js';

const OPEN_NEW_ONCE = 'mythical-adventure-open-once';

/** Choose a save before boot, or open a separate adventure through a full reload. */
export default class AdventureMenu {
    constructor(gameState, options = {}) {
        this.gameState = gameState;
        this.store = options.store || new LocalAdventureStore();
        this.document = options.document || document;
        this.reload = options.reload || (() => window.location.reload());
        this.isCurrent = options.isCurrent || (() => true);
        this.getGame = options.getGame || (() => window.mythicalGame);
        this.openAccount = options.openAccount || null;
        try { this.sessionStorage = options.sessionStorage || window.sessionStorage; } catch { this.sessionStorage = null; }
        this.pausedScenes = [];
    }

    async chooseAtStartup() {
        let notice = '';
        try {
            const key = this.store.activeKey();
            const adventures = this.store.list();
            const current = adventures.find(item => item.key === key);
            let justCreated = false;
            try {
                justCreated = this.sessionStorage?.getItem(OPEN_NEW_ONCE) === key;
                this.sessionStorage?.removeItem(OPEN_NEW_ONCE);
            } catch { /* The chooser remains usable if session storage is unavailable. */ }
            // Skip a second choice only for the just-created egg. A later refresh
            // must still offer older adventures, even before the new egg hatches.
            if (current && !current.started && (justCreated || adventures.length === 1) ||
                !current && key === 'mythical-creature-save' && adventures.length === 0) return key;
            if (!current) notice = 'We could not find your last adventure. Choose another one or start with a new egg.';
        } catch {
            notice = 'Your adventures could not be opened. Try again when this browser can save progress.';
        }
        return new Promise(resolve => {
            this.onChosen = resolve;
            this.render(notice);
        });
    }

    open({ onBackup = null } = {}) {
        if (!this.isCurrent() || this.element) return;
        this.onBackup = onBackup;
        this.returnFocus = this.document.activeElement;
        // Only resume scenes that this menu paused. Clear held movement on both sides.
        this.pausedScenes = (this.getGame()?.scene?.getScenes?.(true) || []).filter(scene => {
            if (scene.scene?.isPaused?.()) return false;
            scene.input?.keyboard?.resetKeys?.();
            scene.mobileControls?.suspend?.();
            window.errorHandler?.setIntentionalPause?.(scene.scene?.key, true);
            scene.scene?.pause?.();
            return true;
        });
        this.render();
    }

    finish(key) {
        if (this.onChosen) {
            const resolve = this.onChosen;
            this.onChosen = null;
            this.close();
            resolve(key);
        } else {
            // Never retarget a live GameState: retiring callbacks still belong to its old save.
            this.reload();
        }
    }

    startNew() {
        if (!this.isCurrent()) return;
        const key = this.store.create(this.gameState);
        if (!this.onChosen) {
            try { this.sessionStorage?.setItem(OPEN_NEW_ONCE, key); } catch { /* Fall back to the chooser. */ }
        }
        this.finish(key);
    }

    choose(key) {
        if (!this.isCurrent()) return;
        if (!this.onChosen && key === this.gameState.saveKey &&
            this.gameState.getSaveAdmission().status !== 'held') {
            this.close();
            return;
        }
        this.store.select(key);
        this.finish(key);
    }

    render(notice = '') {
        this.element?.remove();
        const doc = this.document;
        const overlay = doc.createElement('div');
        overlay.className = 'adventure-menu';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'adventure-title');
        const panel = doc.createElement('section');
        const egg = doc.createElement('div');
        egg.className = 'adventure-egg';
        egg.setAttribute('aria-hidden', 'true');
        const eyebrow = doc.createElement('p');
        eyebrow.className = 'adventure-eyebrow';
        eyebrow.textContent = 'MYTHICAL VOID';
        const title = doc.createElement('h1');
        title.id = 'adventure-title';
        title.textContent = this.onChosen ? 'Ready for an adventure?' : 'Your adventures';
        const description = doc.createElement('p');
        description.textContent = 'Pick up where you left off, or meet a new creature.';
        panel.append(egg, eyebrow, title, description);
        const action = (parent, label, callback, primary = false) => {
            const button = doc.createElement('button');
            button.type = 'button';
            button.textContent = label;
            if (primary) button.className = 'adventure-primary';
            button.onclick = () => {
                try { callback(); } catch {
                    this.render('We could not open that adventure. Your other adventures have been kept. Check that this browser has space to save, then try again.');
                }
            };
            parent.append(button);
            return button;
        };
        let adventures = [];
        try { adventures = this.store.list(); } catch {
            notice = notice || 'This browser could not read your adventures. Try again when storage is available.';
        }
        const current = adventures.find(item => item.current);
        if (current) action(panel, current.name === 'Your adventure' ? 'Continue adventure' : `Continue with ${current.name}`,
            () => this.choose(current.key), true);
        action(panel, 'Start a new adventure', () => this.startNew(), !current);
        if (this.openAccount) action(panel, 'Save across devices (18+)', () => this.openAccount(this.element));
        const keep = doc.createElement('p');
        keep.className = 'adventure-hint';
        keep.textContent = 'A new egg, a fresh start. Your other adventures stay here.';
        panel.append(keep);
        const others = adventures.filter(item => !item.current);
        if (others.length) {
            const details = doc.createElement('details');
            const summary = doc.createElement('summary');
            summary.textContent = 'Other adventures';
            details.append(summary);
            others.forEach(item => {
                const saved = item.savedAt ? ` · ${new Date(item.savedAt).toLocaleDateString('en-IE')}` : '';
                action(details, `${item.name}${saved}`, () => this.choose(item.key));
            });
            panel.append(details);
        }
        const help = doc.createElement('p');
        help.className = 'adventure-hint adventure-saving';
        help.textContent = this.gameState.storageMode === 'memory'
            ? 'This browser cannot save progress right now. Check that it has space and allows this site to save data.'
            : 'Progress saves as you play in this browser. No account needed. Return using the same browser and device.';
        const detail = doc.createElement('details');
        const summary = doc.createElement('summary');
        summary.textContent = 'About saving';
        const explanation = doc.createElement('p');
        explanation.textContent = this.openAccount
            ? 'Clearing this site’s data or using private browsing can remove local adventures. Adults aged 18 or over can optionally add adventures to an email account and continue on another device.'
            : 'Clearing this site’s data or using private browsing can remove your adventures. An optional online backup is available in the game menu. It currently belongs to this browser and cannot bring your creature to another device.';
        detail.append(summary, explanation);
        panel.append(help, detail);
        if (this.onBackup) action(panel, 'Online backup (optional)', () => {
            this.close();
            this.onBackup();
        });
        if (notice) {
            const message = doc.createElement('p');
            message.setAttribute('role', 'status');
            message.textContent = notice;
            panel.append(message);
            action(panel, 'Try again', () => this.render());
        }
        if (!this.onChosen && this.gameState.getSaveAdmission().status !== 'held') {
            action(panel, 'Back to game', () => this.close());
        }
        overlay.append(panel);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !this.onChosen && this.gameState.getSaveAdmission().status !== 'held') {
                event.preventDefault(); this.close();
            }
            if (event.key !== 'Tab') return;
            const controls = [...overlay.querySelectorAll('button, summary')].filter(control =>
                !control.closest('details:not([open])') || control.tagName === 'SUMMARY');
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        this.element = overlay;
        doc.body.append(overlay);
        panel.querySelector('button')?.focus();
    }

    close() {
        this.element?.remove();
        this.element = null;
        if (this.isCurrent() && this.gameState.getSaveAdmission().status !== 'held') {
            this.pausedScenes.forEach(scene => {
                scene.input?.keyboard?.resetKeys?.();
                scene.mobileControls?.resume?.();
                window.errorHandler?.setIntentionalPause?.(scene.scene?.key, false);
                if (scene.scene?.isPaused?.()) scene.scene.resume();
            });
        }
        this.pausedScenes = [];
        this.returnFocus?.focus?.();
    }
}

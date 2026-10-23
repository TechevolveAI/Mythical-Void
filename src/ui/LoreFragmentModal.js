import '../styles/lore-fragment.css';

// Lore is already saved by CollectibleManager. This owns presentation and input only.
export default class LoreFragmentModal {
    constructor(scene) {
        this.scene = scene;
        this.pending = [];
        this.root = null;
        this.destroyed = false;
        scene.events.on('postupdate', this.refresh, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    show(lore) {
        if (this.destroyed || this.current?.id === lore.id ||
            this.pending.some(item => item.id === lore.id)) return false;
        this.pending.push(lore);
        this.refresh();
        return true;
    }

    refresh() {
        const scene = this.scene;
        if (this.destroyed || this.root || !this.pending.length || scene._isShuttingDown ||
            scene.sys?.isActive?.() === false || scene.isSanctuaryCareBlocked?.() ||
            scene.carePanelManager?.panelVisible) return;
        this.current = this.pending.shift();
        scene.isLoreModalOpen = true;
        scene.sanctuaryNotices?.refresh();
        this.previousInputEnabled = scene.input?.enabled;
        if (scene.input) scene.input.enabled = false;
        this.restoreMobileControls = scene.mobileControls?.suspend?.() === true;
        this.resumePhysics = Boolean(scene.physics?.world && !scene.physics.world.isPaused);
        if (this.resumePhysics) scene.physics.pause();
        this.resetMovement();
        this.previousFocus = document.activeElement;

        const root = document.createElement('div');
        root.className = 'lore-fragment-overlay';
        const panel = document.createElement('section');
        panel.className = 'lore-fragment-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'lore-fragment-title');
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'lore-fragment-close';
        close.setAttribute('aria-label', 'Close story fragment');
        close.textContent = '×';
        const eyebrow = document.createElement('p');
        eyebrow.className = 'lore-fragment-eyebrow';
        eyebrow.textContent = 'A page from the ship log';
        const title = document.createElement('h2');
        title.id = 'lore-fragment-title';
        title.textContent = this.current.loreTitle || 'Story fragment';
        const story = document.createElement('p');
        story.className = 'lore-fragment-story';
        story.textContent = this.current.loreText || 'A mysterious fragment…';
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'lore-fragment-continue';
        next.textContent = 'Continue exploring';
        const dismiss = event => { event.stopPropagation(); this.close(); };
        close.addEventListener('click', dismiss);
        next.addEventListener('click', dismiss);
        panel.append(close, eyebrow, title, story, next);
        root.append(panel);
        document.body.append(root);
        this.root = root;
        this.keyHandler = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); this.close();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                (document.activeElement === next ? close : next).focus();
            }
        };
        document.addEventListener('keydown', this.keyHandler, true);
        next.focus({ preventScroll: true });
    }

    resetMovement() {
        const scene = this.scene;
        scene.joystickX = 0;
        scene.joystickY = 0;
        scene.input?.keyboard?.resetKeys?.();
        scene.player?.body?.setVelocity?.(0, 0);
    }

    close() {
        if (!this.root) return;
        this.root.remove();
        this.root = null;
        this.current = null;
        document.removeEventListener('keydown', this.keyHandler, true);
        this.keyHandler = null;
        const scene = this.scene;
        scene.isLoreModalOpen = false;
        this.resetMovement();
        if (!this.destroyed && !scene._isShuttingDown && scene.sys?.isActive?.() !== false) {
            if (scene.input) scene.input.enabled = this.previousInputEnabled;
            if (this.resumePhysics) scene.physics.resume();
            if (this.restoreMobileControls) scene.mobileControls?.resume?.();
            if (this.previousFocus?.isConnected) this.previousFocus.focus?.({ preventScroll: true });
        }
        // Queued lore and achievements resume on a later frame, after this tap ends.
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.pending.length = 0;
        this.close();
        this.scene.events.off('postupdate', this.refresh, this);
        this.scene.events.off('shutdown', this.destroy, this);
    }
}

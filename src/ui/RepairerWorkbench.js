import { getRepairerWorkshopSnapshot, REPAIRER_PORTRAIT } from '../systems/RepairerWorkshop.js';
import { getKatanaArtifactPresentation } from './KatanaArtifactModal.js';
import RepairerPractice from './RepairerPractice.js';

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export default class RepairerWorkbench {
    constructor(scene, { loadActor = () => import('../systems/ExpeditionAstronaut.js').then(module => module.ExpeditionAstronaut) } = {}) {
        this.scene = scene;
        this.loadActor = loadActor;
    }

    show({ onSupplies, onClose } = {}) {
        if (this.root) return false;
        this.onClose = onClose;
        this.onSupplies = onSupplies;
        this.snapshot = getRepairerWorkshopSnapshot(window.GameState);
        this.loadingPractice = false;
        this.previousFocus = document.activeElement;
        this.inputWasEnabled = this.scene.input.enabled;
        this.scene.input.enabled = false;
        this.root = element('div', 'repairer-workbench');
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', 'The repairer workbench');
        this.render();
        this.keyboard = event => {
            if (this.practice) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.destroy(); }
            if (event.key !== 'Tab') return;
            const focusable = [...this.root.querySelectorAll('button:not(:disabled), summary')];
            const index = focusable.indexOf(document.activeElement);
            if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
            else if (!event.shiftKey && (index === focusable.length - 1 || index < 0)) { event.preventDefault(); focusable[0]?.focus(); }
        };
        window.addEventListener('keydown', this.keyboard, true);
        document.body.append(this.root);
        this.closeButton.focus();
        return true;
    }

    button(label, className, action) {
        const button = element('button', className, label);
        button.type = 'button';
        button.addEventListener('click', action);
        return button;
    }

    render() {
        const snapshot = this.snapshot;
        const shell = element('section', 'repairer-shell');
        const header = element('header', 'repairer-header');
        const heading = element('div', '');
        heading.append(element('p', 'repairer-eyebrow', 'SANCTUARY WORKSHOP'), element('h1', '', 'The repairer'));
        this.closeButton = this.button('Close', 'repairer-close', () => this.destroy());
        this.closeButton.setAttribute('aria-label', 'Back to shop');
        header.append(heading, this.closeButton);
        const content = element('div', 'repairer-content');
        const introduction = element('aside', 'repairer-introduction');
        const portrait = element('img', 'repairer-portrait');
        portrait.src = REPAIRER_PORTRAIT;
        portrait.alt = 'The alien repairer, with his purple work-cowl and mechanical arm';
        portrait.width = 768; portrait.height = 768;
        portrait.addEventListener('error', () => { portrait.hidden = true; }, { once: true });
        introduction.append(portrait, element('p', 'repairer-greeting', snapshot.greeting));
        const equipment = element('div', 'repairer-equipment');
        const title = element('div', 'repairer-section-heading');
        title.append(element('h2', '', 'Your katana'), element('p', '', snapshot.summary));
        equipment.append(title);
        if (snapshot.recovered) {
            const image = element('img', 'repairer-katana');
            image.src = getKatanaArtifactPresentation(snapshot.combat.upgradeIds).imageUrl;
            image.alt = 'Your current katana configuration';
            image.addEventListener('error', () => { image.hidden = true; }, { once: true });
            equipment.append(image);
        }
        for (const upgrade of snapshot.upgrades) {
            const row = element('article', `repairer-upgrade${upgrade.installed ? ' is-fitted' : ''}`);
            row.dataset.upgrade = upgrade.id;
            row.dataset.installed = String(upgrade.installed);
            const name = element('div', 'repairer-upgrade-heading');
            name.append(element('h3', '', upgrade.name), element('span', 'repairer-state', upgrade.installed ? 'FITTED' : 'NOT FOUND'));
            row.append(name, element('p', '', upgrade.effect), element('small', '',
                upgrade.installed ? 'Permanent. Already working in your levels.' : `Reward from ${upgrade.source}.`));
            equipment.append(row);
        }
        const actions = element('div', 'repairer-actions');
        this.tryButton = this.button('Try a strike', 'repairer-primary', () => this.startPractice());
        this.tryButton.disabled = !snapshot.recovered;
        actions.append(this.tryButton, this.button('Browse supplies', 'repairer-secondary', () => {
            const action = this.onSupplies;
            this.destroy(); action?.();
        }));
        equipment.append(actions);
        this.practiceStatus = element('p', 'repairer-practice-status');
        this.practiceStatus.setAttribute('role', 'status');
        equipment.append(this.practiceStatus);
        const supplies = element('details', 'repairer-supplies');
        supplies.append(element('summary', '', 'Power-ups in your bag'));
        const owned = snapshot.supplies.filter(item => item.quantity || item.pending);
        if (!owned.length) supplies.append(element('p', '', 'Your bag has no power-ups yet. Boss rewards and shop supplies appear here.'));
        for (const item of owned) {
            const row = element('div', 'repairer-supply');
            row.append(element('strong', '', `${item.name} - ${item.quantity} in bag`), element('p', '', item.effect),
                element('small', '', item.pending ? `${item.pending} saved for when your bag has room.` : 'One use. Expedition menu > Power-ups.'));
            supplies.append(row);
        }
        equipment.append(supplies);
        content.append(introduction, equipment);
        shell.append(header, content);
        this.root.append(shell);
    }

    async startPractice() {
        if (!this.root || this.practice || this.loadingPractice || !this.snapshot.recovered) return;
        const root = this.root;
        this.loadingPractice = true;
        this.tryButton.disabled = true;
        this.practiceStatus.textContent = 'Getting the target ready...';
        try {
            // The gameplay renderer stays lazy and does not form a static
            // gameplay -> UI -> gameplay dependency during first load.
            const Astronaut = await this.loadActor();
            if (this.root !== root) return;
            this.practiceStatus.textContent = '';
            this.practice = new RepairerPractice(this.scene, this.snapshot, () => {
                this.practice = null;
                if (!this.root) return;
                this.scene.input.enabled = false;
                this.root.hidden = false;
                this.tryButton.focus();
            }, Astronaut);
            this.root.hidden = true;
            this.scene.input.enabled = true;
        } catch {
            if (this.root === root) this.practiceStatus.textContent = 'The target is unavailable. Your fitted upgrades still work in the levels.';
        } finally {
            if (this.root === root) {
                this.loadingPractice = false;
                this.tryButton.disabled = false;
            }
        }
    }

    destroy() {
        if (!this.root) return;
        this.practice?.destroy();
        this.practice = null;
        window.removeEventListener('keydown', this.keyboard, true);
        this.root.remove(); this.root = null;
        if (this.scene.input) this.scene.input.enabled = this.inputWasEnabled;
        if (this.previousFocus?.isConnected) this.previousFocus.focus?.();
        this.onClose?.();
    }
}

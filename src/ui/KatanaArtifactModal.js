const KATANA_ARTIFACT_STAGES = Object.freeze({
    earth: Object.freeze({
        id: 'earth',
        stageIndex: 0,
        imageUrl: '/game/artifacts/earth-field-katana.webp',
        eyebrow: 'PROJECT BEACON // EARTH ARTIFACT',
        state: 'ORIGINAL CONFIGURATION',
        title: 'EARTH-FORGED FIELD KATANA',
        description: 'Built on Earth for a mission that expected no one to answer back.',
        effect: 'TITANIUM-CERAMIC // 0 OF 2 INTERFACES',
        accent: '#F2C14E',
        buttonLabel: 'CONTINUE // KATANA EQUIPPED'
    }),
    crystal: Object.freeze({
        id: 'crystal',
        stageIndex: 1,
        imageUrl: '/game/artifacts/earth-field-katana-resonant.webp',
        eyebrow: 'CRYSTAL GUARDIAN // CREATURE-TECH I',
        state: 'FIRST ADAPTATION',
        title: 'RESONANT EDGE',
        description: 'Creature-grown crystal aligns with the human-made blade without replacing it.',
        effect: 'MELEE +1 // REACH +15',
        accent: '#8FE3CF',
        buttonLabel: 'ACCEPT GIFT // VIEW REWARDS'
    }),
    aurora: Object.freeze({
        id: 'aurora',
        stageIndex: 2,
        imageUrl: '/game/artifacts/earth-field-katana-aurora.webp',
        eyebrow: 'AURORA PHOENIX // CREATURE-TECH II',
        state: 'SECOND ADAPTATION',
        title: 'AURORA GUARD',
        description: 'Living aurora light completes a protective circuit around the Earth-forged hilt.',
        effect: 'PROTECTIVE CHARGE +1 // 2 OF 2 INTERFACES',
        accent: '#7FE6C4',
        buttonLabel: 'ACCEPT GIFT // VIEW REWARDS'
    })
});

const KATANA_STAGE_ORDER = Object.freeze(['earth', 'crystal', 'aurora']);
let artworkPrefetched = false;

function normalizeUpgradeId(upgrade) {
    return typeof upgrade === 'string' ? upgrade : upgrade?.id;
}

export function getKatanaArtifactPresentation(upgrades = []) {
    const upgradeIds = new Set(
        (Array.isArray(upgrades) ? upgrades : [])
            .map(normalizeUpgradeId)
            .filter(Boolean)
    );

    if (upgradeIds.has('aurora_guard')) {
        return KATANA_ARTIFACT_STAGES.aurora;
    }
    if (upgradeIds.has('crystal_edge')) {
        return KATANA_ARTIFACT_STAGES.crystal;
    }
    return KATANA_ARTIFACT_STAGES.earth;
}

export function prefetchKatanaArtifactArtwork() {
    if (
        artworkPrefetched ||
        typeof window === 'undefined' ||
        typeof window.Image !== 'function'
    ) {
        return;
    }

    artworkPrefetched = true;
    Object.values(KATANA_ARTIFACT_STAGES).forEach(stage => {
        const image = new window.Image();
        image.decoding = 'async';
        image.src = stage.imageUrl;
    });
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
}

export default class KatanaArtifactModal {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.closeHandler = null;
        this.keyboardHandler = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
    }

    show({
        fieldKit = {},
        upgrades = null,
        creatureName = null,
        context = 'recovery',
        onClose = null
    } = {}) {
        if (this.domElement || typeof document === 'undefined') {
            return false;
        }

        prefetchKatanaArtifactArtwork();
        const installedUpgrades = upgrades || fieldKit.katana?.installedUpgrades || [];
        const presentation = getKatanaArtifactPresentation(installedUpgrades);
        const { width, height } = this.scene.scale;
        const root = document.createElement('div');
        root.className = 'katana-artifact-modal';
        root.style.width = `${width}px`;
        root.style.height = `${height}px`;
        root.style.setProperty('--artifact-accent', presentation.accent);
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', presentation.title);

        const shell = document.createElement('section');
        shell.className = 'katana-artifact-shell';
        const contextLabel = {
            recovery: 'FIELD KIT RECOVERED',
            upgrade: 'NEW CONFIGURATION',
            inventory: 'CURRENT CONFIGURATION'
        }[context] || 'ARTIFACT RECORD';
        const buttonLabel = context === 'inventory'
            ? 'RETURN TO KIT'
            : presentation.buttonLabel;

        const header = document.createElement('header');
        header.className = 'katana-artifact-header';
        header.append(
            createTextElement('p', 'katana-artifact-eyebrow', presentation.eyebrow),
            createTextElement(
                'p',
                'katana-artifact-context',
                contextLabel
            )
        );

        const media = document.createElement('div');
        media.className = 'katana-artifact-media';
        const image = document.createElement('img');
        image.src = presentation.imageUrl;
        image.alt = `${presentation.title}, AI-assisted concept artwork`;
        image.decoding = 'async';
        image.draggable = false;
        media.append(image);

        const generatedLabel = createTextElement(
            'span',
            'katana-artifact-generated',
            'AI-ASSISTED ARTISTIC INTERPRETATION'
        );
        media.append(generatedLabel);

        const content = document.createElement('div');
        content.className = 'katana-artifact-content';
        content.append(
            createTextElement('p', 'katana-artifact-state', presentation.state),
            createTextElement('h2', 'katana-artifact-title', presentation.title),
            createTextElement('p', 'katana-artifact-description', presentation.description),
            createTextElement('p', 'katana-artifact-effect', presentation.effect)
        );

        const timeline = document.createElement('ol');
        timeline.className = 'katana-artifact-timeline';
        timeline.setAttribute('aria-label', 'Katana adaptation progress');
        const labels = ['EARTH', 'EDGE', 'GUARD'];
        KATANA_STAGE_ORDER.forEach((stageId, index) => {
            const item = document.createElement('li');
            const status = index < presentation.stageIndex
                ? 'complete'
                : index === presentation.stageIndex
                    ? 'active'
                    : 'locked';
            item.className = `katana-artifact-step is-${status}`;
            item.append(
                createTextElement('span', 'katana-artifact-node', `${index + 1}`),
                createTextElement('span', 'katana-artifact-step-label', labels[index])
            );
            timeline.append(item);
        });
        content.append(timeline);

        const companionLine = context === 'upgrade'
            ? `${creatureName || 'Your companion'} watches the two worlds become one instrument.`
            : `${creatureName || 'Your companion'} studies the sealed scabbard, then looks back to you.`;
        content.append(createTextElement('p', 'katana-artifact-companion', companionLine));

        const button = createTextElement(
            'button',
            'katana-artifact-continue',
            buttonLabel
        );
        button.type = 'button';
        content.append(button);

        shell.append(header, media, content);
        root.append(shell);

        this.root = root;
        this.closeHandler = () => {
            this.destroy();
            onClose?.();
        };
        button.addEventListener('click', this.closeHandler);
        root.addEventListener('click', event => event.stopPropagation());

        this.keyboardHandler = event => {
            if (!['Enter', ' ', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            this.closeHandler?.();
        };
        window.addEventListener('keydown', this.keyboardHandler);

        this.physicsWasPaused = Boolean(this.scene.physics?.world?.isPaused);
        if (!this.physicsWasPaused) {
            this.scene.physics?.pause?.();
        }
        this.restoreMobileControls = this.scene.mobileControls?.suspend?.() === true;

        this.domElement = this.scene.add.dom(width / 2, height / 2, root)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(15000);
        root.style.display = 'flex';
        this.domContainer = this.domElement.node?.parentElement || null;
        if (this.domContainer) {
            this.previousDomContainerZIndex = this.domContainer.style.zIndex;
            this.domContainer.style.zIndex = '15000';
        }
        requestAnimationFrame(() => root.classList.add('is-visible'));
        button.focus({ preventScroll: true });
        return true;
    }

    destroy() {
        if (this.keyboardHandler) {
            window.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        if (this.restoreMobileControls) {
            this.scene.mobileControls?.resume?.();
        }
        this.restoreMobileControls = false;
        if (!this.physicsWasPaused) {
            this.scene.physics?.resume?.();
        }
        if (this.domContainer) {
            this.domContainer.style.zIndex = this.previousDomContainerZIndex;
        }
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
        this.domElement?.destroy?.();
        this.domElement = null;
        this.root = null;
        this.closeHandler = null;
    }
}

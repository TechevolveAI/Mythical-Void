function createElement(tagName, className, text = null) {
    const element = document.createElement(tagName);
    element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

function normalizeDisplayText(value, fallback, maxLength = 32) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function formatIdentifier(value, fallback) {
    return normalizeDisplayText(value, fallback, 48)
        .replace(/[_-]+/g, ' ')
        .toUpperCase();
}

export default class LivingFormHandoff {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.image = null;
        this.mediaFallback = null;
        this.loadingDetail = null;
        this.sourceLabel = null;
        this.status = null;
        this.title = null;
        this.keyboardHandler = null;
        this.continueHandler = null;
        this.continueButton = null;
        this.continueActivated = false;
        this.renderToken = 0;
        this.pixelReferenceImage = null;
        this.displaySource = 'pixel_form';
        this.isVisible = false;
        this.portraitPending = false;
        this.statusTimers = [];
        this.resizeHandler = null;
        this.onPortraitShown = null;
        this.portraitShownIdentity = null;
    }

    show({
        name,
        species,
        stage = 'baby',
        affinity = 'star',
        portraitPromise = null,
        referenceImage = null,
        onContinue = null,
        onPortraitShown = null,
        mode = 'arrival'
    } = {}) {
        if (this.domElement || typeof document === 'undefined') {
            return false;
        }

        const safeName = normalizeDisplayText(name, 'Companion', 20);
        const safeSpecies = formatIdentifier(species, 'UNKNOWN SPECIES');
        const safeStage = formatIdentifier(stage, 'BABY');
        const safeAffinity = formatIdentifier(affinity, 'STAR');
        const isLateReveal = mode === 'late_reveal';
        const { width, height } = this.scene.scale;

        const root = createElement('div', 'living-form-handoff');
        root.classList.toggle('is-portrait-pending', Boolean(portraitPromise));
        root.dataset.portraitState = portraitPromise ? 'developing' : 'offline';
        this.updateViewportSize = () => {
            const viewport = window.visualViewport;
            const nextWidth = Math.max(1, Math.floor(
                viewport?.width || this.scene.scale.width || width
            ));
            const nextHeight = Math.max(1, Math.floor(
                viewport?.height || this.scene.scale.height || height
            ));
            root.style.width = `${nextWidth}px`;
            root.style.height = `${nextHeight}px`;
            this.domElement?.setPosition?.(nextWidth / 2, nextHeight / 2);
            const cameraZoom = Math.max(
                0.1,
                Number(this.scene.cameras?.main?.zoom) || 1
            );
            // Phaser applies world-camera zoom to DOM Elements. Cancel it so
            // this modal remains true screen-space UI inside the Sanctuary.
            this.domElement?.setScale?.(1 / cameraZoom);
        };
        this.updateViewportSize();
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', `${safeName} living form reveal`);
        root.setAttribute('data-testid', 'living-form-handoff');

        const shell = createElement('section', 'living-form-shell');
        const header = createElement('header', 'living-form-header');
        header.append(
            createElement(
                'p',
                'living-form-eyebrow',
                isLateReveal
                    ? 'PROJECT BEACON // LIVING IDENTITY RECEIVED'
                    : 'PROJECT BEACON // FIELD IDENTITY'
            ),
            createElement(
                'p',
                'living-form-channel',
                'IDENTITY CHANNEL 23'
            )
        );

        const media = createElement('figure', 'living-form-media');
        this.image = document.createElement('img');
        this.image.className = 'living-form-image';
        this.image.referrerPolicy = 'no-referrer';
        this.image.decoding = 'async';
        this.image.draggable = false;
        this.image.alt = '';
        media.append(this.image);

        this.mediaFallback = createElement('div', 'living-form-media-fallback');
        if (portraitPromise) {
            const spinner = createElement('span', 'living-form-spinner');
            spinner.setAttribute('aria-hidden', 'true');
            const progress = createElement('span', 'living-form-progress');
            progress.setAttribute('role', 'progressbar');
            progress.setAttribute('aria-label', `${safeName} living portrait developing`);
            progress.setAttribute('aria-valuetext', 'Portrait generation in progress');
            progress.append(
                createElement('span', 'living-form-progress-step is-complete'),
                createElement('span', 'living-form-progress-step is-active'),
                createElement('span', 'living-form-progress-step')
            );
            this.loadingDetail = createElement(
                'span',
                'living-form-loading-detail',
                `Building ${safeName}'s anatomy, markings, and cosmic traits.`
            );
            this.mediaFallback.append(
                spinner,
                createElement(
                    'strong',
                    'living-form-loading-title',
                    'LIVING FORM DEVELOPING'
                ),
                progress,
                this.loadingDetail
            );
        } else {
            this.mediaFallback.append(
                createElement(
                    'strong',
                    'living-form-loading-title',
                    'LIVING FORM OFFLINE'
                )
            );
        }
        this.mediaFallback.setAttribute('role', 'status');
        this.mediaFallback.setAttribute('aria-live', 'polite');
        media.append(this.mediaFallback);

        const scanner = createElement('span', 'living-form-scanner');
        scanner.setAttribute('aria-hidden', 'true');
        media.append(scanner);

        this.sourceLabel = createElement(
            'figcaption',
            'living-form-source',
            'FIELD STUDY'
        );
        media.append(this.sourceLabel);

        const content = createElement('section', 'living-form-content');
        content.append(
            createElement(
                'p',
                'living-form-state',
                isLateReveal
                    ? 'PROTECTED PORTRAIT RECOVERED'
                    : 'FIRST CONTACT RECORD LOCKED'
            )
        );
        this.title = createElement(
            'h1',
            'living-form-title',
            `${safeName} // LIVING FORM`
        );
        content.append(this.title);
        content.append(
            createElement(
                'p',
                'living-form-description',
                isLateReveal
                    ? 'The field scan has finished. This is the same companion you hatched, interpreted beyond the pixel suit display.'
                    : 'The pixel form remains the companion you play beside. This field study imagines the same life beyond the suit display.'
            )
        );

        const facts = createElement('dl', 'living-form-facts');
        [
            ['SIGNATURE', safeSpecies],
            ['LIFE STAGE', safeStage],
            ['CURRENT', safeAffinity]
        ].forEach(([label, value]) => {
            const fact = createElement('div', 'living-form-fact');
            fact.append(
                createElement('dt', 'living-form-fact-label', label),
                createElement('dd', 'living-form-fact-value', value)
            );
            facts.append(fact);
        });
        content.append(facts);

        const actions = createElement('footer', 'living-form-actions');
        actions.setAttribute('data-testid', 'living-form-actions');

        actions.append(createElement(
            'p',
            'living-form-action-kicker',
            isLateReveal
                ? 'PORTRAIT RECEIVED'
                : portraitPromise
                    ? 'CONTINUE NOW OR WAIT FOR THE REVEAL'
                    : 'FIELD ROUTE READY'
        ));

        this.status = createElement(
            'p',
            'living-form-status',
                portraitPromise
                    ? isLateReveal
                        ? 'Opening the completed protected living portrait.'
                        : `${safeName}'s protected portrait is forming now. You do not need to wait.`
                    : 'No personal data was sent. Pixel identity remains the canonical record.'
        );
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        actions.append(this.status);

        const continueButton = createElement(
            'button',
            'living-form-continue',
            isLateReveal
                ? 'CONTINUE EXPLORING'
                : portraitPromise
                    ? 'ENTER SANCTUARY NOW'
                    : 'ENTER SANCTUARY'
        );
        continueButton.type = 'button';
        continueButton.setAttribute('data-testid', 'living-form-continue');
        continueButton.style.touchAction = 'manipulation';
        continueButton.style.webkitTapHighlightColor = 'transparent';
        actions.append(continueButton);

        if (portraitPromise && !isLateReveal) {
            actions.append(createElement(
                'p',
                'living-form-continue-note',
                'If you enter now, the finished portrait will open over the Sanctuary when it arrives.'
            ));
        }

        shell.append(header, media, content, actions);
        root.append(shell);
        this.root = root;
        this.isVisible = true;
        this.continueActivated = false;
        this.continueButton = continueButton;
        this.onPortraitShown = typeof onPortraitShown === 'function'
            ? onPortraitShown
            : null;
        this.continueHandler = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            if (this.continueActivated || !this.isVisible) return;
            this.continueActivated = true;
            const continueAction = onContinue;
            this.destroy();
            continueAction?.();
        };
        continueButton.addEventListener('pointerup', this.continueHandler);
        continueButton.addEventListener('touchend', this.continueHandler, {
            passive: false
        });
        continueButton.addEventListener('click', this.continueHandler);
        this.keyboardHandler = event => {
            if (!this.isVisible || !['Enter', ' ', 'Escape'].includes(event.key)) {
                return;
            }
            event.preventDefault();
            this.continueHandler?.();
        };
        window.addEventListener('keydown', this.keyboardHandler);
        this.resizeHandler = () => this.updateViewportSize?.();
        window.addEventListener('resize', this.resizeHandler);
        window.visualViewport?.addEventListener?.('resize', this.resizeHandler);

        this.domElement = this.scene.add.dom(width / 2, height / 2, root)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(18000);
        this.updateViewportSize();
        root.style.display = 'grid';

        this.pixelReferenceImage = (
            typeof referenceImage === 'string'
            && /^data:image\/png;base64,/.test(referenceImage)
        ) ? referenceImage : null;
        if (!portraitPromise) {
            this.status.textContent =
                'No personal data was sent. The living portrait can be retried from the Companion Archive.';
        }

        if (portraitPromise) {
            this.portraitPending = true;
            this.startPortraitStatusSequence();
            Promise.resolve(portraitPromise)
                .then(record => {
                    this.portraitPending = false;
                    this.clearStatusTimers();
                    if (!record?.imageUrl) {
                        throw new Error('Protected portrait did not include artwork');
                    }
                    if (!this.isVisible) {
                        window.GameState?.emit?.('notification', {
                            type: 'portraitReady',
                            message: `${safeName}'s full living-form reveal is ready in the Sanctuary`
                        });
                        return;
                    }
                    this.setArtwork(record.imageUrl, {
                        source: 'protected_living_portrait',
                        alt: `AI-generated living portrait of ${safeName}`,
                        record
                    });
                })
                .catch(error => {
                    this.portraitPending = false;
                    this.clearStatusTimers();
                    if (!this.isVisible) return;
                    const serviceMessage =
                        window.LivingPortraitService?.describeError?.(error) ||
                        'Living portrait unavailable. A retry has been scheduled.';
                    this.status.textContent = `${serviceMessage} ` +
                        'Enter the Sanctuary whenever you are ready.';
                    this.status.classList.add('is-fallback');
                    this.root.dataset.portraitState = 'retry';
                    this.sourceLabel.textContent =
                        error?.code === 'new_identity_quota'
                            ? 'LIVING PORTRAIT // RETRY SCHEDULED'
                            : 'LIVING PORTRAIT // RETRY AVAILABLE';
                    this.root?.classList.add('has-portrait-failure');
                });
        }

        requestAnimationFrame(() => root.classList.add('is-visible'));
        continueButton.focus({ preventScroll: true });
        return true;
    }

    startPortraitStatusSequence() {
        this.clearStatusTimers();
        this.statusTimers.push(window.setTimeout(() => {
            if (!this.isVisible || !this.portraitPending || !this.status) return;
            this.status.textContent =
                'Matching anatomy, color, and mutations to the exact pixel identity.';
            if (this.loadingDetail) {
                this.loadingDetail.textContent =
                    'Translating the exact pixel identity into a living field portrait.';
            }
        }, 2500));
        this.statusTimers.push(window.setTimeout(() => {
            if (!this.isVisible || !this.portraitPending || !this.status) return;
            this.status.textContent =
                'You can enter the Sanctuary now. The finished portrait will open there when it arrives.';
            if (this.loadingDetail) {
                this.loadingDetail.textContent =
                    'Still developing. You can continue without losing the reveal.';
            }
        }, 7500));
    }

    clearStatusTimers() {
        this.statusTimers.forEach(timer => window.clearTimeout(timer));
        this.statusTimers = [];
    }

    setArtwork(imageUrl, { source, alt, record = null }) {
        if (!this.image || typeof imageUrl !== 'string') return;
        const token = ++this.renderToken;
        const isGenerated = source === 'protected_living_portrait';
        this.image.classList.remove(
            'is-ready',
            'is-generated-portrait',
            'is-pixel-reference'
        );
        this.image.classList.add('is-generated-portrait');
        this.root?.classList.remove('shows-pixel-reference');
        this.image.onload = () => {
            if (!this.isVisible || token !== this.renderToken) return;
            this.image.alt = alt;
            this.image.classList.add('is-ready');
            this.mediaFallback?.classList.add('is-hidden');
            this.displaySource = source;
            if (isGenerated) {
                this.root.dataset.portraitState = 'ready';
                this.root?.classList.remove('is-portrait-pending');
                if (this.continueButton?.textContent === 'ENTER SANCTUARY NOW') {
                    this.continueButton.textContent = 'ENTER SANCTUARY';
                    this.root?.querySelector?.('.living-form-continue-note')?.remove?.();
                }
                window.CompanionMediaService?.recordAppearance?.(
                    'first_living_form',
                    record
                );
                const identity = record?.identityKey || imageUrl;
                if (this.portraitShownIdentity !== identity) {
                    this.portraitShownIdentity = identity;
                    this.onPortraitShown?.(record);
                }
                if (!window.GameState?.get?.(
                    'story.projectBeacon.firstForestCinematicSeen'
                )) {
                    window.CompanionMediaService?.prepareGeneratedVideo?.({
                        momentId: 'first_forest_arrival',
                        stage: record?.stage || 'baby',
                        record
                    }).catch?.(() => null);
                }
                this.root?.classList.remove(
                    'shows-pixel-reference',
                    'has-portrait-failure'
                );
                this.sourceLabel.textContent = 'PROTECTED LIVING PORTRAIT';
                this.status.textContent =
                    'Exact interpretation secured to this companion record. Temporary image links are not saved.';
                this.status.classList.remove('is-fallback');
                window.AudioManager?.playLevelUp?.();
            }
        };
        this.image.onerror = () => {
            if (!this.isVisible || token !== this.renderToken) return;
            this.mediaFallback?.classList.remove('is-hidden');
            this.status.textContent =
                'Visual study offline. The living portrait can retry from the Companion Archive.';
            this.status.classList.add('is-fallback');
            this.root.dataset.portraitState = 'retry';
            this.sourceLabel.textContent = 'LIVING PORTRAIT RETRY AVAILABLE';
            this.root?.classList.add('has-portrait-failure');
        };
        this.image.src = imageUrl;
    }

    destroy() {
        this.isVisible = false;
        this.portraitPending = false;
        this.clearStatusTimers();
        this.renderToken++;
        if (this.keyboardHandler) {
            window.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            window.visualViewport?.removeEventListener?.(
                'resize',
                this.resizeHandler
            );
            this.resizeHandler = null;
        }
        this.updateViewportSize = null;
        this.image?.removeAttribute?.('src');
        this.domElement?.destroy?.();
        this.domElement = null;
        this.root = null;
        this.image = null;
        this.mediaFallback = null;
        this.loadingDetail = null;
        this.sourceLabel = null;
        this.status = null;
        this.title = null;
        this.pixelReferenceImage = null;
        this.continueButton = null;
        this.continueHandler = null;
        this.onPortraitShown = null;
        this.portraitShownIdentity = null;
    }
}

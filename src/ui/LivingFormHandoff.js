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
    }

    show({
        name,
        species,
        stage = 'baby',
        affinity = 'star',
        portraitPromise = null,
        referenceImage = null,
        onContinue = null,
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

        this.mediaFallback = createElement(
            'div',
            'living-form-media-fallback',
            'PIXEL IDENTITY PRESERVED'
        );
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

        this.status = createElement(
            'p',
            'living-form-status',
                portraitPromise
                    ? isLateReveal
                        ? 'Opening the completed protected living portrait.'
                        : 'Protected living portrait forming in the background.'
                    : 'No personal data was sent. Pixel identity remains the canonical record.'
        );
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        content.append(this.status);

        const continueButton = createElement(
            'button',
            'living-form-continue',
            isLateReveal ? 'CONTINUE EXPLORING' : 'ENTER SANCTUARY'
        );
        continueButton.type = 'button';
        continueButton.setAttribute('data-testid', 'living-form-continue');
        continueButton.style.touchAction = 'manipulation';
        continueButton.style.webkitTapHighlightColor = 'transparent';
        content.append(continueButton);

        shell.append(header, media, content);
        root.append(shell);
        this.root = root;
        this.isVisible = true;
        this.continueActivated = false;
        this.continueButton = continueButton;
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
        root.style.display = 'grid';

        this.pixelReferenceImage = (
            typeof referenceImage === 'string'
            && /^data:image\/png;base64,/.test(referenceImage)
        ) ? referenceImage : null;
        if (this.pixelReferenceImage) {
            this.setArtwork(this.pixelReferenceImage, {
                source: 'pixel_reference',
                alt: `Exact pixel identity of ${safeName}`
            });
        } else if (!portraitPromise) {
            this.status.textContent =
                'No personal data was sent. Pixel identity remains the canonical record.';
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
                            message: `${safeName}'s living portrait is ready in the Companion Archive`
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
                        'Living portrait unavailable. The pixel identity remains secured.';
                    this.status.textContent = `${serviceMessage} ` +
                        'Enter the Sanctuary whenever you are ready.';
                    this.status.classList.add('is-fallback');
                    this.sourceLabel.textContent =
                        error?.code === 'new_identity_quota'
                            ? 'PIXEL IDENTITY SECURED // PORTRAIT RETRY SCHEDULED'
                            : 'PIXEL IDENTITY REFERENCE // PORTRAIT UNAVAILABLE';
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
        }, 2500));
        this.statusTimers.push(window.setTimeout(() => {
            if (!this.isVisible || !this.portraitPending || !this.status) return;
            this.status.textContent =
                'You can enter the Sanctuary now. The finished portrait will wait in the Companion Archive.';
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
        const isPixelReference = source === 'pixel_reference';
        this.image.classList.remove(
            'is-ready',
            'is-generated-portrait',
            'is-pixel-reference'
        );
        this.image.classList.add(
            isGenerated ? 'is-generated-portrait' : 'is-pixel-reference'
        );
        this.root?.classList.toggle('shows-pixel-reference', isPixelReference);
        this.image.onload = () => {
            if (!this.isVisible || token !== this.renderToken) return;
            this.image.alt = alt;
            this.image.classList.add('is-ready');
            this.mediaFallback?.classList.add('is-hidden');
            this.displaySource = source;
            if (isGenerated) {
                window.CompanionMediaService?.recordAppearance?.(
                    'first_living_form',
                    record
                );
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
            } else if (source === 'pixel_reference') {
                this.sourceLabel.textContent =
                    'EXACT PIXEL IDENTITY // LIVING PORTRAIT FORMING';
            }
        };
        this.image.onerror = () => {
            if (!this.isVisible || token !== this.renderToken) return;
            if (isGenerated && this.pixelReferenceImage) {
                this.setArtwork(this.pixelReferenceImage, {
                    source: 'pixel_reference',
                    alt: 'Exact pixel identity of this companion'
                });
                this.status.textContent =
                    'The protected portrait can retry from the companion archive. Pixel identity remains secured.';
                this.status.classList.add('is-fallback');
                this.sourceLabel.textContent =
                    'PIXEL IDENTITY REFERENCE // PORTRAIT UNAVAILABLE';
                this.root?.classList.add('has-portrait-failure');
                return;
            }
            this.mediaFallback?.classList.remove('is-hidden');
            this.status.textContent =
                'Visual study offline. Pixel identity remains secured.';
            this.status.classList.add('is-fallback');
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
        this.sourceLabel = null;
        this.status = null;
        this.title = null;
        this.pixelReferenceImage = null;
        this.continueButton = null;
        this.continueHandler = null;
    }
}

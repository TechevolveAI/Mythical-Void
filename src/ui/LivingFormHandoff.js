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

const HATCH_SHARE_DATA = Object.freeze({
    title: 'The Mythical Void Hatch Challenge',
    text: 'I just hatched an alien creature. Hatch yours from the same signal, then compare what the creature engine made.',
    url: 'https://mythicalvoid.com/hatch-challenge/'
});

export default class LivingFormHandoff {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.image = null;
        this.mediaFallback = null;
        this.loadingDetail = null;
        this.loadingTitle = null;
        this.sourceLabel = null;
        this.status = null;
        this.title = null;
        this.actionKicker = null;
        this.keyboardHandler = null;
        this.continueHandler = null;
        this.continueButton = null;
        this.continueButtons = [];
        this.continueReadyLabel = 'ENTER SANCTUARY';
        this.mobileDock = null;
        this.mobileDockStatus = null;
        this.mobileContinueButton = null;
        this.shareButton = null;
        this.shareHandler = null;
        this.shareInProgress = false;
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
        this.keepVisibleOnContinue = false;
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
        keepVisibleOnContinue = false,
        mode = 'arrival'
    } = {}) {
        if (this.domElement || typeof document === 'undefined') {
            return false;
        }

        const safeName = normalizeDisplayText(name, 'Creature', 20);
        const safeSpecies = formatIdentifier(species, 'UNKNOWN SPECIES');
        const safeStage = formatIdentifier(stage, 'BABY');
        const safeAffinity = formatIdentifier(affinity, 'STAR');
        const isLateReveal = mode === 'late_reveal';
        const isHatchChallengeEntry = window.location?.hash === '#hatch-challenge';
        const { width, height } = this.scene.scale;

        const root = createElement('div', 'living-form-handoff');
        root.classList.toggle('is-portrait-pending', Boolean(portraitPromise));
        root.dataset.portraitState = portraitPromise ? 'developing' : 'offline';
        root.dataset.hatchChallenge = isHatchChallengeEntry ? 'active' : 'none';
        this.updateViewportSize = () => {
            const viewport = window.visualViewport;
            const nextWidth = Math.max(1, Math.floor(
                viewport?.width || this.scene.scale.width || width
            ));
            const nextHeight = Math.max(1, Math.floor(
                viewport?.height || this.scene.scale.height || height
            ));
            const offsetLeft = Math.max(0, Math.floor(viewport?.offsetLeft || 0));
            const offsetTop = Math.max(0, Math.floor(viewport?.offsetTop || 0));
            root.style.width = `${nextWidth}px`;
            root.style.height = `${nextHeight}px`;
            this.domElement?.setPosition?.(
                offsetLeft + (nextWidth / 2),
                offsetTop + (nextHeight / 2)
            );
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
                this.createProgressStep('SCAN LOCKED', 'is-complete'),
                this.createProgressStep('FORMING', 'is-active'),
                this.createProgressStep('REVEAL NEXT')
            );
            this.loadingDetail = createElement(
                'span',
                'living-form-loading-detail',
                `Building ${safeName}'s anatomy, markings, and cosmic traits.`
            );
            this.loadingTitle = createElement(
                'strong',
                'living-form-loading-title',
                'LIVING FORM DEVELOPING'
            );
            this.mediaFallback.append(
                spinner,
                this.loadingTitle,
                progress,
                this.loadingDetail
            );
        } else {
            this.loadingTitle = createElement(
                'strong',
                'living-form-loading-title',
                'LOCAL CREATURE SIGNAL'
            );
            this.loadingDetail = createElement(
                'span',
                'living-form-loading-detail',
                'The exact creature you hatched remains available without a network connection.'
            );
            this.mediaFallback.append(this.loadingTitle, this.loadingDetail);
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
                    ? 'The field scan has finished. This is the same creature you hatched, interpreted beyond the pixel suit display.'
                    : 'The pixel form remains the creature you play beside. This field study imagines the same life beyond the suit display.'
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

        if (isHatchChallengeEntry) {
            const challenge = createElement('aside', 'living-form-challenge');
            challenge.setAttribute('data-testid', 'living-form-challenge');
            challenge.append(
                createElement('strong', 'living-form-challenge-title', 'HATCH CHALLENGE // RESULT READY'),
                createElement(
                    'p',
                    'living-form-challenge-copy',
                    'Compare form, colour, markings, nature, affinity and rare changes with the person who invited you. Matching is possible.'
                )
            );
            content.append(challenge);
        }

        const actions = createElement('footer', 'living-form-actions');
        actions.setAttribute('data-testid', 'living-form-actions');

        this.actionKicker = createElement(
            'p',
            'living-form-action-kicker',
            isLateReveal
                ? 'PORTRAIT RECEIVED'
                : portraitPromise
                    ? 'SANCTUARY READY // PORTRAIT IN PROGRESS'
                    : 'FIELD ROUTE READY'
        );
        actions.append(this.actionKicker);

        this.status = createElement(
            'p',
            'living-form-status',
                portraitPromise
                    ? isLateReveal
                        ? 'Opening the completed protected living portrait.'
                        : `${safeName}'s protected portrait is forming now. Enter whenever you are ready; the reveal will follow you.`
                    : 'No personal data was sent. Pixel identity remains the canonical record.'
        );
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        actions.append(this.status);

        const buttonRow = createElement('div', 'living-form-button-row');
        const shareButton = createElement(
            'button',
            'living-form-share',
            'INVITE SOMEONE'
        );
        shareButton.type = 'button';
        shareButton.setAttribute('data-testid', 'living-form-share');
        shareButton.setAttribute(
            'aria-label',
            'Invite someone to the Mythical Void Hatch Challenge'
        );
        shareButton.style.touchAction = 'manipulation';
        shareButton.style.webkitTapHighlightColor = 'transparent';

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
        buttonRow.append(shareButton, continueButton);
        actions.append(buttonRow);

        const mobileDock = createElement('aside', 'living-form-mobile-dock');
        mobileDock.setAttribute('aria-label', 'Sanctuary route');
        mobileDock.setAttribute('data-testid', 'living-form-mobile-dock');
        this.mobileDockStatus = createElement(
            'p',
            'living-form-mobile-status',
            portraitPromise
                ? 'PORTRAIT DEVELOPING // SANCTUARY READY'
                : 'SANCTUARY ROUTE READY'
        );
        const mobileContinueButton = createElement(
            'button',
            'living-form-mobile-continue',
            continueButton.textContent
        );
        mobileContinueButton.type = 'button';
        mobileContinueButton.setAttribute(
            'data-testid',
            'living-form-mobile-continue'
        );
        mobileContinueButton.style.touchAction = 'manipulation';
        mobileContinueButton.style.webkitTapHighlightColor = 'transparent';
        mobileDock.append(this.mobileDockStatus, mobileContinueButton);

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
        this.mobileDock = mobileDock;
        this.mobileContinueButton = mobileContinueButton;
        this.continueButtons = [continueButton, mobileContinueButton];
        this.continueReadyLabel = isLateReveal
            ? 'CONTINUE EXPLORING'
            : 'ENTER SANCTUARY';
        this.shareButton = shareButton;
        this.shareInProgress = false;
        this.keepVisibleOnContinue = Boolean(keepVisibleOnContinue);
        this.onPortraitShown = typeof onPortraitShown === 'function'
            ? onPortraitShown
            : null;
        this.continueHandler = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            if (this.continueActivated || !this.isVisible) return;
            this.continueActivated = true;
            const continueAction = onContinue;
            this.beginTransition();
            if (!this.keepVisibleOnContinue) this.destroy();
            continueAction?.();
        };
        this.continueButtons.forEach(button => {
            button.addEventListener('pointerup', this.continueHandler);
            button.addEventListener('touchend', this.continueHandler, {
                passive: false
            });
            button.addEventListener('click', this.continueHandler);
        });
        this.shareHandler = event => this.shareGame(event);
        shareButton.addEventListener('click', this.shareHandler);
        this.keyboardHandler = event => {
            if (!this.isVisible || !['Enter', ' ', 'Escape'].includes(event.key)) {
                return;
            }
            if (
                event.key !== 'Escape'
                && !this.continueButtons.includes(event.target?.closest?.('button'))
            ) {
                return;
            }
            event.preventDefault();
            this.continueHandler?.();
        };
        window.addEventListener('keydown', this.keyboardHandler);
        this.resizeHandler = () => this.updateViewportSize?.();
        window.addEventListener('resize', this.resizeHandler);
        window.visualViewport?.addEventListener?.('resize', this.resizeHandler);

        // Keep the mobile route control outside Phaser's transformed DOM tree.
        // iOS Safari can otherwise clip the action below the visible viewport.
        document.body.append(mobileDock);

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
        if (this.pixelReferenceImage) {
            this.setArtwork(this.pixelReferenceImage, {
                source: 'local_creature_reference',
                alt: `Local creature signal for ${safeName}`
            });
        }
        if (!portraitPromise) {
            this.status.textContent =
                'No personal data was sent. This exact local creature remains playable; the full living portrait can retry from the Creature Archive.';
            this.actionKicker.textContent = 'LOCAL SIGNAL READY // SANCTUARY OPEN';
            if (this.mobileDockStatus) {
                this.mobileDockStatus.textContent =
                    'LOCAL SIGNAL READY // SANCTUARY OPEN';
            }
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
                    this.markPortraitUnavailable(error);
                });
        }

        requestAnimationFrame(() => root.classList.add('is-visible'));
        continueButton.focus({ preventScroll: true });
        return true;
    }

    beginTransition() {
        if (!this.isVisible || !this.root || !this.continueButton) return;
        this.clearStatusTimers();
        this.root.classList.add('is-transitioning');
        this.root.dataset.portraitState = 'entering';
        this.continueButtons.forEach(button => {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.textContent = 'ENTERING SANCTUARY...';
        });
        this.mobileDock?.classList.add('is-transitioning');
        if (this.mobileDockStatus) {
            this.mobileDockStatus.textContent = 'ROUTE CONFIRMED';
        }
        if (this.shareButton) this.shareButton.disabled = true;
        if (this.actionKicker) {
            this.actionKicker.textContent = 'ROUTE CONFIRMED // SANCTUARY OPENING';
        }
        if (this.status) {
            this.status.textContent = this.portraitPending
                ? 'Opening the Sanctuary now. The living portrait will keep developing and follow you.'
                : 'Opening the Sanctuary now.';
        }
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
                'Enter the Sanctuary now. The finished portrait will open there automatically when it arrives.';
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

    setContinueLabel(label) {
        this.continueButtons.forEach(button => {
            if (!button.disabled) button.textContent = label;
        });
    }

    markPortraitUnavailable(error = null) {
        this.portraitPending = false;
        this.clearStatusTimers();
        if (!this.isVisible || !this.root) return;
        const serviceMessage =
            window.LivingPortraitService?.describeError?.(error) ||
            'Living portrait unavailable. A retry has been scheduled.';
        this.root.classList.remove('is-portrait-pending');
        this.root.classList.add('has-portrait-failure');
        this.root.dataset.portraitState = 'retry';
        this.mediaFallback?.classList.add('is-retry');
        this.mediaFallback?.querySelector?.('.living-form-spinner')?.remove?.();
        this.mediaFallback?.querySelector?.('.living-form-progress')?.remove?.();
        if (this.loadingTitle) this.loadingTitle.textContent = 'FULL PORTRAIT WILL RETRY';
        if (this.loadingDetail) {
            this.loadingDetail.textContent =
                'The exact local creature remains visible. Continue now; nothing is lost.';
        }
        this.status.textContent = `${serviceMessage} ` +
            'Enter the Sanctuary whenever you are ready.';
        this.status.classList.add('is-fallback');
        this.sourceLabel.textContent =
            error?.code === 'new_identity_quota'
                ? 'LIVING PORTRAIT // RETRY SCHEDULED'
                : 'LIVING PORTRAIT // RETRY AVAILABLE';
        this.actionKicker.textContent = 'SANCTUARY READY // PORTRAIT WILL RETRY';
        if (this.mobileDockStatus) {
            this.mobileDockStatus.textContent =
                'PORTRAIT RETRIES LATER // SANCTUARY READY';
        }
        this.setContinueLabel(this.continueReadyLabel);
        this.root.querySelector?.('.living-form-continue-note')?.remove?.();
    }

    createProgressStep(label, stateClass = '') {
        const step = createElement(
            'span',
            `living-form-progress-step ${stateClass}`.trim()
        );
        step.append(
            createElement('span', 'living-form-progress-bar'),
            createElement('span', 'living-form-progress-label', label)
        );
        return step;
    }

    setArtwork(imageUrl, { source, alt, record = null }) {
        if (!this.image || typeof imageUrl !== 'string') return;
        const token = ++this.renderToken;
        const isGenerated = source === 'protected_living_portrait';
        const isLocalReference = source === 'local_creature_reference';
        this.image.classList.remove(
            'is-ready',
            'is-generated-portrait',
            'is-pixel-reference'
        );
        this.image.classList.add(
            isGenerated ? 'is-generated-portrait' : 'is-pixel-reference'
        );
        this.root?.classList.toggle('shows-pixel-reference', isLocalReference);
        let artworkRevealed = false;
        const revealArtwork = () => {
            if (artworkRevealed) return;
            if (!this.isVisible || token !== this.renderToken) return;
            artworkRevealed = true;
            this.image.alt = alt;
            this.image.classList.add('is-ready');
            this.mediaFallback?.classList.add('is-hidden');
            this.displaySource = source;
            if (isGenerated) {
                this.root.dataset.portraitState = 'ready';
                this.root?.classList.remove('is-portrait-pending');
                this.setContinueLabel(this.continueReadyLabel);
                this.root?.querySelector?.('.living-form-continue-note')?.remove?.();
                if (this.actionKicker) {
                    this.actionKicker.textContent = 'LIVING FORM READY // SANCTUARY OPEN';
                }
                if (this.mobileDockStatus) {
                    this.mobileDockStatus.textContent =
                        'LIVING FORM READY // SANCTUARY OPEN';
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
                    'Exact interpretation secured to this creature record. Temporary image links are not saved.';
                this.status.classList.remove('is-fallback');
                window.AudioManager?.playLevelUp?.();
            } else if (isLocalReference) {
                if (
                    !this.portraitPending
                    && !this.root.classList.contains('has-portrait-failure')
                ) {
                    this.root.dataset.portraitState = 'local';
                }
                this.sourceLabel.textContent = this.portraitPending
                    ? 'LOCAL CREATURE SIGNAL // FULL PORTRAIT FORMING'
                    : 'LOCAL CREATURE SIGNAL';
            }
        };
        this.image.onload = revealArtwork;
        this.image.onerror = () => {
            if (!this.isVisible || token !== this.renderToken) return;
            if (isGenerated && this.pixelReferenceImage) {
                this.setArtwork(this.pixelReferenceImage, {
                    source: 'local_creature_reference',
                    alt: 'Local creature signal'
                });
                this.markPortraitUnavailable(
                    new Error('Visual study offline. The living portrait can retry from the Creature Archive.')
                );
                return;
            }
            this.mediaFallback?.classList.remove('is-hidden');
            if (this.loadingTitle) {
                this.loadingTitle.textContent = 'CREATURE SIGNAL SECURED';
            }
            if (this.loadingDetail) {
                this.loadingDetail.textContent =
                    'Enter the Sanctuary. Your playable creature remains safe in the game.';
            }
            this.markPortraitUnavailable(
                new Error('Visual study offline. The living portrait can retry from the Creature Archive.')
            );
        };
        this.image.src = imageUrl;
        // Cached data URLs can be decoded before some WebKit/Chromium paths
        // dispatch `load`. Decode provides a second, idempotent readiness path.
        this.image.decode?.().then(revealArtwork).catch(() => {});
    }

    /**
     * Offer a voluntary word-of-mouth moment without exposing the creature,
     * player, save, portrait, or genetics. The device chooses the destination.
     */
    async shareGame(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!this.isVisible || !this.shareButton || this.shareInProgress) {
            return 'unavailable';
        }

        this.shareInProgress = true;
        this.shareButton.disabled = true;
        this.shareButton.setAttribute('aria-busy', 'true');

        let result = 'shown';
        try {
            if (typeof window.navigator?.share === 'function') {
                await window.navigator.share(HATCH_SHARE_DATA);
                result = 'shared';
            } else if (
                typeof window.navigator?.clipboard?.writeText === 'function'
            ) {
                await window.navigator.clipboard.writeText(HATCH_SHARE_DATA.url);
                result = 'copied';
            }
        } catch (error) {
            if (error?.name === 'AbortError') result = 'cancelled';
        }

        if (this.isVisible && this.shareButton) {
            this.shareButton.textContent = {
                shared: 'SHARED ✓',
                copied: 'LINK COPIED ✓',
                cancelled: 'INVITE SOMEONE',
                shown: 'MYTHICALVOID.COM'
            }[result];
            this.shareButton.disabled = false;
            this.shareButton.removeAttribute('aria-busy');
        }
        this.shareInProgress = false;
        return result;
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
        this.continueButtons.forEach(button => {
            button.removeEventListener('pointerup', this.continueHandler);
            button.removeEventListener('touchend', this.continueHandler);
            button.removeEventListener('click', this.continueHandler);
        });
        this.mobileDock?.remove?.();
        this.image?.removeAttribute?.('src');
        this.domElement?.destroy?.();
        this.domElement = null;
        this.root = null;
        this.image = null;
        this.mediaFallback = null;
        this.loadingDetail = null;
        this.loadingTitle = null;
        this.sourceLabel = null;
        this.status = null;
        this.title = null;
        this.actionKicker = null;
        this.pixelReferenceImage = null;
        this.continueButton = null;
        this.continueButtons = [];
        this.continueReadyLabel = 'ENTER SANCTUARY';
        this.mobileDock = null;
        this.mobileDockStatus = null;
        this.mobileContinueButton = null;
        this.continueHandler = null;
        if (this.shareButton && this.shareHandler) {
            this.shareButton.removeEventListener('click', this.shareHandler);
        }
        this.shareButton = null;
        this.shareHandler = null;
        this.shareInProgress = false;
        this.onPortraitShown = null;
        this.portraitShownIdentity = null;
        this.keepVisibleOnContinue = false;
    }
}

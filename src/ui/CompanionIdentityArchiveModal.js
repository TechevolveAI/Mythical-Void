function createElement(tagName, className, text = null) {
    const element = document.createElement(tagName);
    element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

export default class CompanionIdentityArchiveModal {
    constructor(scene, {
        snapshotProvider,
        onReview,
        onReplay = null,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onReview = onReview;
        this.onReplay = onReplay;
        this.onClose = onClose;
        this.domElement = null;
        this.root = null;
        this.activeChapterId = null;
        this.isVisible = false;
        this.keyboardHandler = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
    }

    show(chapterId = null) {
        if (this.isVisible || typeof document === 'undefined') return false;
        const snapshot = this.snapshotProvider?.();
        if (!snapshot?.available) return false;

        this.activeChapterId = snapshot.chapters.some(
            chapter => chapter.id === chapterId
        )
            ? chapterId
            : snapshot.nextChapter?.id || 'identity';
        this.physicsWasPaused = Boolean(
            this.scene.physics?.world?.isPaused
        );
        if (!this.physicsWasPaused) this.scene.physics?.pause?.();
        this.restoreMobileControls =
            this.scene.mobileControls?.suspend?.() === true;
        this.isVisible = true;
        this.render();
        return true;
    }

    render() {
        const snapshot = this.snapshotProvider?.();
        if (!snapshot?.available) {
            this.destroy();
            return;
        }
        const chapter = snapshot.chapters.find(
            entry => entry.id === this.activeChapterId
        ) || snapshot.nextChapter || snapshot.chapters[0];
        this.activeChapterId = chapter.id;
        const camera = this.scene.cameras?.main;
        const width = camera?.width || this.scene.scale.width;
        const height = camera?.height || this.scene.scale.height;

        if (!this.root) {
            this.root = createElement('div', 'companion-archive-modal');
            this.root.style.width = `${width}px`;
            this.root.style.height = `${height}px`;
            this.root.setAttribute('role', 'dialog');
            this.root.setAttribute('aria-modal', 'true');
            this.root.addEventListener(
                'click',
                event => event.stopPropagation()
            );
            this.domElement = this.scene.add.dom(
                width / 2,
                height / 2,
                this.root
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(17500);
            this.domContainer =
                this.domElement.node?.parentElement || null;
            if (this.domContainer) {
                this.previousDomContainerZIndex =
                    this.domContainer.style.zIndex;
                this.domContainer.style.zIndex = '17500';
            }
            this.keyboardHandler = event => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                this.destroy();
            };
            window.addEventListener('keydown', this.keyboardHandler);
        }

        this.root.style.width = `${width}px`;
        this.root.style.height = `${height}px`;
        this.root.replaceChildren();
        this.root.setAttribute(
            'aria-label',
            `${snapshot.portableRecord.creature.name} shared record`
        );

        const shell = createElement('section', 'companion-archive-shell');
        const livery = createElement('div', 'companion-archive-livery');
        const header = createElement('header', 'companion-archive-header');
        const headingGroup = createElement(
            'div',
            'companion-archive-heading'
        );
        headingGroup.append(
            createElement(
                'p',
                'companion-archive-eyebrow',
                'FEND CURRENT ARCHIVE // COMPANION RECORD'
            ),
            createElement(
                'h2',
                'companion-archive-title',
                snapshot.portableRecord.creature.name
            )
        );
        const privacy = createElement(
            'p',
            'companion-archive-privacy',
            'PRIVATE // NO ACCOUNT IDENTITY'
        );
        const close = createElement(
            'button',
            'companion-archive-close',
            'X'
        );
        close.type = 'button';
        close.setAttribute('aria-label', 'Close companion record');
        close.addEventListener('click', () => this.destroy());
        header.append(headingGroup, privacy, close);

        const tabs = createElement('nav', 'companion-archive-tabs');
        tabs.setAttribute('aria-label', 'Companion record chapters');
        snapshot.chapters.forEach(entry => {
            const tab = createElement(
                'button',
                [
                    'companion-archive-tab',
                    entry.id === chapter.id ? 'is-active' : '',
                    entry.reviewed ? 'is-reviewed' : ''
                ].filter(Boolean).join(' '),
                `${entry.reviewed ? 'OK ' : ''}${entry.label}`
            );
            tab.type = 'button';
            tab.addEventListener('click', () => {
                this.activeChapterId = entry.id;
                this.render();
            });
            tabs.append(tab);
        });

        const body = createElement('div', 'companion-archive-body');
        const media = createElement('figure', 'companion-archive-media');
        if (snapshot.displayPortrait.imageUrl) {
            media.append(this.createPortraitImage(
                snapshot.displayPortrait.imageUrl,
                snapshot.displayPortrait.alt,
                media
            ));
        } else {
            media.append(
                createElement(
                    'div',
                    'companion-archive-image-fallback',
                    'PIXEL IDENTITY REMAINS CANONICAL'
                )
            );
        }
        this.resolveProtectedPortrait(snapshot.displayPortrait, media);
        media.append(
            createElement(
                'figcaption',
                'companion-archive-media-label',
                snapshot.displayPortrait.source
                    .replace(/_/g, ' ')
                    .toUpperCase()
            )
        );

        const content = createElement('div', 'companion-archive-content');
        content.append(
            createElement(
                'p',
                'companion-archive-chapter-index',
                `CHAPTER ${chapter.order}/${snapshot.totalChapters}`
            ),
            createElement(
                'h3',
                'companion-archive-chapter-title',
                chapter.title
            ),
            createElement(
                'p',
                'companion-archive-summary',
                chapter.summary
            )
        );
        const rows = createElement('dl', 'companion-archive-rows');
        chapter.rows.forEach(row => {
            const rowElement = createElement(
                'div',
                'companion-archive-row'
            );
            rowElement.append(
                createElement(
                    'dt',
                    'companion-archive-row-label',
                    row.label
                ),
                createElement(
                    'dd',
                    'companion-archive-row-value',
                    row.value
                ),
                createElement(
                    'dd',
                    'companion-archive-row-detail',
                    row.detail
                )
            );
            rows.append(rowElement);
        });
        content.append(rows);
        if (
            chapter.id === 'shared_journey' &&
            snapshot.fieldMemories?.memories?.length > 0 &&
            this.onReplay
        ) {
            const latestMemory = snapshot.fieldMemories.memories[0];
            const replay = createElement(
                'button',
                'companion-archive-memory-action',
                `REPLAY LATEST // ${latestMemory.label}`
            );
            replay.type = 'button';
            replay.addEventListener('click', () => {
                this.onReplay?.(latestMemory);
            });
            content.append(replay);
        }
        body.append(media, content);

        const footer = createElement('footer', 'companion-archive-footer');
        footer.append(
            createElement(
                'p',
                'companion-archive-progress',
                `ARCHIVE ${snapshot.reviewedCount}/${snapshot.totalChapters} // ` +
                    'NAME IS THE ONLY PLAYER-AUTHORED FIELD'
            )
        );
        const nextChapter = snapshot.nextChapter;
        const canRecord =
            !chapter.reviewed &&
            nextChapter?.id === chapter.id;
        const actionLabel = snapshot.complete
            ? 'CLOSE SHARED RECORD'
            : canRecord
                ? `RECORD ${chapter.label}`
                : `GO TO ${nextChapter?.label || 'NEXT CHAPTER'}`;
        const action = createElement(
            'button',
            'companion-archive-action',
            actionLabel
        );
        action.type = 'button';
        action.addEventListener('click', () => {
            if (snapshot.complete) {
                this.destroy();
                return;
            }
            if (!canRecord) {
                this.activeChapterId =
                    nextChapter?.id || 'identity';
                this.render();
                return;
            }
            const result = this.onReview?.(chapter.id);
            if (!result?.changed) return;
            this.activeChapterId =
                result.snapshot.nextChapter?.id || chapter.id;
            this.render();
        });
        footer.append(action);

        shell.append(livery, header, tabs, body, footer);
        this.root.append(shell);
        requestAnimationFrame(
            () => this.root?.classList.add('is-visible')
        );
        action.focus({ preventScroll: true });
    }

    createPortraitImage(imageUrl, alt, media) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = alt;
        image.referrerPolicy = 'no-referrer';
        image.decoding = 'async';
        image.draggable = false;
        image.addEventListener('error', () => {
            image.remove();
            if (!media.querySelector('.companion-archive-image-fallback')) {
                media.prepend(
                    createElement(
                        'div',
                        'companion-archive-image-fallback',
                        'PIXEL IDENTITY REMAINS CANONICAL'
                    )
                );
            }
        });
        return image;
    }

    resolveProtectedPortrait(portrait, media) {
        if (
            !portrait?.assetRef ||
            !window.LivingPortraitService?.resolve
        ) {
            return;
        }

        window.LivingPortraitService.resolve({
            assetRef: portrait.assetRef,
            identityKey: portrait.identityKey,
            stage: portrait.stage,
            storage: 'supabase-private',
            imageUrl: portrait.source === 'living_portrait'
                ? portrait.imageUrl
                : null
        }).then(record => {
            if (
                !this.isVisible ||
                !media.isConnected ||
                !record?.imageUrl
            ) {
                return;
            }
            media.querySelector('img')?.remove();
            media.querySelector(
                '.companion-archive-image-fallback'
            )?.remove();
            media.prepend(this.createPortraitImage(
                record.imageUrl,
                portrait.alt,
                media
            ));
        }).catch(error => {
            console.warn(
                '[CompanionIdentityArchive] Protected portrait unavailable:',
                error.message
            );
        });
    }

    destroy() {
        if (this.keyboardHandler) {
            window.removeEventListener(
                'keydown',
                this.keyboardHandler
            );
            this.keyboardHandler = null;
        }
        if (this.domContainer) {
            this.domContainer.style.zIndex =
                this.previousDomContainerZIndex;
            this.domContainer = null;
        }
        this.root?.remove();
        this.domElement?.destroy?.();
        this.root = null;
        this.domElement = null;
        const wasVisible = this.isVisible;
        this.isVisible = false;
        if (wasVisible && !this.physicsWasPaused) {
            this.scene.physics?.resume?.();
        }
        if (wasVisible && this.restoreMobileControls) {
            this.scene.mobileControls?.resume?.();
        }
        if (wasVisible) this.onClose?.();
    }
}

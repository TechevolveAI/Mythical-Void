function createElement(tagName, className, text = null) {
    const element = document.createElement(tagName);
    element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

export default class FusionConsentModal {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
        this.keyboardHandler = null;
    }

    show({
        parents = [],
        readiness,
        onConfirm,
        onCancel
    } = {}) {
        if (this.domElement || typeof document === 'undefined') return false;
        const { width, height } = this.scene.scale;
        const root = createElement('div', 'fusion-consent-modal');
        root.style.width = `${width}px`;
        root.style.height = `${height}px`;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Fusion lineage consent review');

        const shell = createElement('section', 'fusion-consent-shell');
        const livery = createElement('div', 'fusion-consent-livery');
        const header = createElement('header', 'fusion-consent-header');
        header.append(
            createElement(
                'p',
                'fusion-consent-eyebrow',
                'KINSHIP BEACON // LINEAGE CONSENT'
            ),
            createElement(
                'h2',
                'fusion-consent-title',
                'A SHARED BEGINNING'
            ),
            createElement(
                'p',
                'fusion-consent-summary',
                'Both companions remain themselves. The Pod may stabilize one or two new Current signatures.'
            )
        );

        const parentList = createElement(
            'div',
            'fusion-consent-parents'
        );
        parents.slice(0, 2).forEach((parent, index) => {
            const status = readiness?.parents?.[index];
            const card = createElement(
                'article',
                'fusion-consent-parent'
            );
            card.append(
                createElement(
                    'p',
                    'fusion-consent-parent-label',
                    `LINEAGE ${index === 0 ? 'A' : 'B'}`
                ),
                createElement(
                    'h3',
                    'fusion-consent-parent-name',
                    parent?.name || 'Companion'
                ),
                createElement(
                    'p',
                    status?.willing
                        ? 'fusion-consent-status is-ready'
                        : 'fusion-consent-status is-blocked',
                    status?.willing
                        ? 'APPROACHES WILLINGLY'
                        : 'NEEDS CARE OR SPACE'
                )
            );
            parentList.append(card);
        });

        const boundary = createElement(
            'section',
            'fusion-consent-boundary'
        );
        boundary.append(
            createElement(
                'h3',
                'fusion-consent-boundary-title',
                'LOCAL SANCTUARY ONLY'
            ),
            createElement(
                'p',
                'fusion-consent-boundary-copy',
                'No companion is traded or consumed. Shared Fusion stays sealed until both keepers, both companions, and a protected server invitation agree.'
            )
        );

        const actions = createElement('footer', 'fusion-consent-actions');
        const cancel = createElement(
            'button',
            'fusion-consent-cancel',
            'NOT NOW'
        );
        const confirm = createElement(
            'button',
            'fusion-consent-confirm',
            readiness?.ready ? 'RECORD CONSENT' : 'CARE FIRST'
        );
        cancel.type = 'button';
        confirm.type = 'button';
        confirm.disabled = !readiness?.ready;
        actions.append(cancel, confirm);

        shell.append(livery, header, parentList, boundary, actions);
        root.append(shell);
        root.addEventListener('click', event => event.stopPropagation());

        const close = confirmed => {
            this.destroy();
            if (confirmed) onConfirm?.();
            else onCancel?.();
        };
        cancel.addEventListener('click', () => close(false));
        confirm.addEventListener('click', () => {
            if (!readiness?.ready) return;
            close(true);
        });
        this.keyboardHandler = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            close(false);
        };
        window.addEventListener('keydown', this.keyboardHandler);

        this.root = root;
        this.domElement = this.scene.add.dom(
            width / 2,
            height / 2,
            root
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(17600);
        this.domContainer = this.domElement.node?.parentElement || null;
        if (this.domContainer) {
            this.previousDomContainerZIndex =
                this.domContainer.style.zIndex;
            this.domContainer.style.zIndex = '17600';
        }
        requestAnimationFrame(() => root.classList.add('is-visible'));
        (readiness?.ready ? confirm : cancel).focus({
            preventScroll: true
        });
        return true;
    }

    destroy() {
        if (this.keyboardHandler) {
            window.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        if (this.domContainer) {
            this.domContainer.style.zIndex =
                this.previousDomContainerZIndex;
        }
        this.domContainer = null;
        this.root?.remove();
        this.domElement?.destroy?.();
        this.root = null;
        this.domElement = null;
    }
}

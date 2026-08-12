function element(tagName, className, text = null) {
    const node = document.createElement(tagName);
    node.className = className;
    if (text !== null) node.textContent = text;
    return node;
}

function button(className, text, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
}

export default class SharedFusionModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.gameState = options.gameState || window.GameState;
        this.cloudSave = options.cloudSave || window.CloudSave;
        this.service = options.service ||
            new window.SharedFusionInvitationService({
                cloudSave: this.cloudSave,
                gameState: this.gameState
            });
        this.root = null;
        this.body = null;
        this.domElement = null;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
        this.keyboardHandler = null;
        this.pollTimer = null;
        this.parents = [];
        this.selectedParentId = null;
        this.mode = 'create';
        this.invitation = null;
        this.execution = null;
        this.busy = false;
        this.destroyed = false;
        this.onClose = null;
        this.onComplete = null;
    }

    show({ parents = [], onClose, onComplete } = {}) {
        if (this.root || typeof document === 'undefined') return false;
        this.parents = parents.filter(parent => (
            window.FusionConsent
                ?.getFusionCompanionReadiness?.(parent)?.willing
        ));
        this.selectedParentId = this.parents[0]?.id || null;
        this.onClose = onClose;
        this.onComplete = onComplete;

        const { width, height } = this.scene.scale;
        this.root = element('div', 'shared-fusion-modal');
        this.root.style.width = `${width}px`;
        this.root.style.height = `${height}px`;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute(
            'aria-label',
            'Protected Shared Fusion link'
        );

        const shell = element('section', 'shared-fusion-shell');
        const header = element('header', 'shared-fusion-header');
        const heading = element(
            'div',
            'shared-fusion-heading'
        );
        heading.append(
            element(
                'p',
                'shared-fusion-eyebrow',
                'KINSHIP BEACON // PROTECTED LINK'
            ),
            element('h2', 'shared-fusion-title', 'SHARED FUSION')
        );
        const close = button(
            'shared-fusion-close',
            'CLOSE',
            () => this.close()
        );
        close.setAttribute('aria-label', 'Close Shared Fusion');
        header.append(heading, close);
        this.body = element('div', 'shared-fusion-body');
        shell.append(header, this.body);
        this.root.append(shell);
        this.root.addEventListener('pointerdown', event => {
            event.stopPropagation();
        });

        this.keyboardHandler = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            this.close();
        };
        window.addEventListener('keydown', this.keyboardHandler);

        this.domElement = this.scene.add.dom(
            width / 2,
            height / 2,
            this.root
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(17800);
        this.domContainer = this.domElement.node?.parentElement || null;
        if (this.domContainer) {
            this.previousDomContainerZIndex =
                this.domContainer.style.zIndex;
            this.domContainer.style.zIndex = '17800';
        }

        requestAnimationFrame(() => {
            this.root?.classList.add('is-visible');
            close.focus({ preventScroll: true });
        });
        this.resumeOrStart();
        return true;
    }

    async resumeOrStart() {
        const saved = this.gameState?.get?.(
            'breedingShrine.sharedFusion.activeInvitation'
        );
        if (!saved?.invitationId) {
            this.renderHome();
            return;
        }
        this.renderBusy('RESTORING PROTECTED LINK');
        try {
            this.invitation = await this.service.get(
                saved.invitationId,
                { force: true }
            );
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error, true);
        }
    }

    clearBody() {
        if (!this.body) return;
        this.body.replaceChildren();
    }

    renderHome() {
        this.stopPolling();
        this.invitation = null;
        this.execution = null;
        this.clearBody();

        const tabs = element('div', 'shared-fusion-tabs');
        tabs.setAttribute('role', 'tablist');
        const createTab = button(
            `shared-fusion-tab${this.mode === 'create' ? ' is-active' : ''}`,
            'CREATE LINK',
            () => {
                this.mode = 'create';
                this.renderHome();
            }
        );
        const joinTab = button(
            `shared-fusion-tab${this.mode === 'join' ? ' is-active' : ''}`,
            'JOIN LINK',
            () => {
                this.mode = 'join';
                this.renderHome();
            }
        );
        createTab.setAttribute('role', 'tab');
        joinTab.setAttribute('role', 'tab');
        createTab.setAttribute(
            'aria-selected',
            String(this.mode === 'create')
        );
        joinTab.setAttribute(
            'aria-selected',
            String(this.mode === 'join')
        );
        tabs.append(createTab, joinTab);

        const signalLabel = element(
            'p',
            'shared-fusion-section-label',
            'YOUR WILLING SIGNAL'
        );
        const parentList = element(
            'div',
            'shared-fusion-parent-list'
        );
        this.parents.forEach(parent => {
            const selected = parent.id === this.selectedParentId;
            const rarity = parent.rarity ||
                parent.genes?.rarity ||
                'common';
            const stage = parent.lifecycle?.stage || 'adult';
            const choice = button(
                `shared-fusion-parent${selected ? ' is-selected' : ''}`,
                '',
                () => {
                    this.selectedParentId = parent.id;
                    this.renderHome();
                }
            );
            choice.setAttribute(
                'aria-pressed',
                String(selected)
            );
            choice.append(
                element(
                    'span',
                    'shared-fusion-parent-name',
                    parent.name || 'Companion'
                ),
                element(
                    'span',
                    'shared-fusion-parent-meta',
                    `${rarity.toUpperCase()} // ${stage.toUpperCase()}`
                )
            );
            parentList.append(choice);
        });

        const actionArea = element(
            'div',
            'shared-fusion-start'
        );
        if (this.mode === 'join') {
            const code = element(
                'input',
                'shared-fusion-code-input'
            );
            code.type = 'text';
            code.inputMode = 'text';
            code.autocomplete = 'off';
            code.spellcheck = false;
            code.maxLength = 14;
            code.placeholder = 'XXXX-XXXX-XXXX';
            code.setAttribute(
                'aria-label',
                'Shared Fusion code'
            );
            code.addEventListener('input', () => {
                const normalized = window.SharedFusionInvitation
                    ?.normalizeSharedFusionCode?.(code.value);
                if (normalized) code.value = normalized;
            });
            const join = button(
                'shared-fusion-primary',
                'PAIR SIGNAL',
                () => this.join(code.value)
            );
            actionArea.append(code, join);
        } else {
            actionArea.append(button(
                'shared-fusion-primary',
                'CREATE PRIVATE CODE',
                () => this.create()
            ));
        }

        const boundary = element(
            'p',
            'shared-fusion-boundary',
            'NO CHAT // NO SEARCH // NO CREATURE TRANSFER'
        );
        this.body.append(
            tabs,
            signalLabel,
            parentList,
            actionArea,
            boundary
        );
    }

    getSelectedParent() {
        return this.parents.find(
            parent => parent.id === this.selectedParentId
        ) || null;
    }

    async create() {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('CREATING PROTECTED LINK');
        try {
            this.invitation = await this.service.create(
                this.getSelectedParent()
            );
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error, true);
        } finally {
            this.busy = false;
        }
    }

    async join(code) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('PAIRING CURRENT SIGNALS');
        try {
            this.invitation = await this.service.join(
                code,
                this.getSelectedParent()
            );
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error, true);
        } finally {
            this.busy = false;
        }
    }

    renderBusy(label) {
        this.clearBody();
        const panel = element('div', 'shared-fusion-busy');
        const pulse = element('span', 'shared-fusion-pulse');
        pulse.setAttribute('aria-hidden', 'true');
        panel.append(
            pulse,
            element('p', 'shared-fusion-busy-label', label)
        );
        this.body.append(panel);
    }

    renderPeerSignal() {
        const peer = this.invitation?.peerSignal;
        if (!peer) return null;
        const card = element('article', 'shared-fusion-peer');
        card.append(
            element(
                'p',
                'shared-fusion-section-label',
                'PAIRED SIGNAL'
            ),
            element(
                'strong',
                'shared-fusion-peer-affinity',
                `${peer.affinity.toUpperCase()} CURRENT`
            ),
            element(
                'span',
                'shared-fusion-peer-meta',
                `${peer.rarity.toUpperCase()} // GEN ${peer.generation} // ${peer.stage.toUpperCase()}`
            )
        );
        return card;
    }

    ownConfirmed() {
        return this.invitation?.role === 'host'
            ? this.invitation.hostConfirmed
            : this.invitation.guestConfirmed;
    }

    async renderInvitation() {
        if (!this.invitation || this.destroyed) return;
        this.stopPolling();
        this.clearBody();
        const status = this.invitation.status;

        if (status === 'waiting') {
            const code = element(
                'output',
                'shared-fusion-code',
                this.invitation.code || 'LINK ACTIVE'
            );
            const copy = button(
                'shared-fusion-secondary',
                'COPY CODE',
                () => this.copyCode()
            );
            const waiting = element(
                'div',
                'shared-fusion-waiting'
            );
            waiting.append(
                element(
                    'p',
                    'shared-fusion-status',
                    'AWAITING SECOND SIGNAL'
                ),
                code
            );
            if (this.invitation.code) waiting.append(copy);
            else waiting.append(element(
                'p',
                'shared-fusion-copy-status',
                'CODE SHOWN ONCE // LINK REMAINS ACTIVE'
            ));
            this.body.append(waiting, this.cancelButton());
            this.startPolling();
            return;
        }

        if (['cancelled', 'expired'].includes(status)) {
            this.body.append(
                element(
                    'p',
                    'shared-fusion-terminal',
                    status === 'expired'
                        ? 'THIS LINK HAS EXPIRED'
                        : 'THIS LINK WAS CLOSED'
                ),
                button(
                    'shared-fusion-primary',
                    'NEW LINK',
                    () => this.renderHome()
                )
            );
            return;
        }

        const peer = this.renderPeerSignal();
        if (peer) this.body.append(peer);

        if (status === 'paired') {
            const grants = element(
                'div',
                'shared-fusion-grants'
            );
            grants.append(
                this.grantRow(
                    'KEEPER A',
                    this.invitation.hostConfirmed
                ),
                this.grantRow(
                    'KEEPER B',
                    this.invitation.guestConfirmed
                )
            );
            this.body.append(grants);
            if (!this.ownConfirmed()) {
                this.body.append(button(
                    'shared-fusion-primary',
                    'CONFIRM THIS PAIRING',
                    () => this.confirm()
                ));
            } else {
                this.body.append(element(
                    'p',
                    'shared-fusion-status',
                    'YOUR CONSENT IS RECORDED'
                ));
            }
            this.body.append(this.cancelButton());
            this.startPolling();
            return;
        }

        if (['ready', 'executing'].includes(status)) {
            this.renderBusy('STABILIZING LINKED SIBLINGS');
            this.execute();
            return;
        }

        if (status === 'staged') {
            if (!this.execution) {
                this.renderBusy('RESTORING YOUR SIBLING SIGNAL');
                this.execute();
                return;
            }
            this.renderNaming();
            return;
        }

        if (status === 'committed') {
            await this.renderReveal();
        }
    }

    grantRow(label, granted) {
        const row = element(
            'div',
            `shared-fusion-grant${granted ? ' is-granted' : ''}`
        );
        const state = element(
            'span',
            'shared-fusion-grant-state',
            granted ? 'CONFIRMED' : 'AWAITING'
        );
        row.replaceChildren(
            element('span', 'shared-fusion-grant-label', label),
            state
        );
        return row;
    }

    async confirm() {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('RECORDING CONSENT');
        try {
            this.invitation = await this.service.confirm(
                this.invitation.invitationId
            );
            this.busy = false;
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error);
        } finally {
            this.busy = false;
        }
    }

    async execute() {
        if (this.busy || !this.invitation?.invitationId) return;
        this.busy = true;
        try {
            this.execution = await this.service.execute(
                this.invitation.invitationId
            );
            this.invitation = await this.service.get(
                this.invitation.invitationId,
                { force: true }
            );
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error);
        } finally {
            this.busy = false;
        }
    }

    renderNaming() {
        this.clearBody();
        const data = this.execution.offspring.offspringData;
        const genes = this.execution.offspring.offspringGenes;
        const affinity = genes.cosmicAffinity?.element ||
            data.dualAffinity?.primary ||
            'unclassified';
        const card = element('article', 'shared-fusion-result');
        card.append(
            element(
                'p',
                'shared-fusion-section-label',
                'YOUR LINKED SIBLING'
            ),
            element(
                'strong',
                'shared-fusion-result-affinity',
                `${String(affinity).toUpperCase()} CURRENT`
            ),
            element(
                'span',
                'shared-fusion-result-meta',
                `${String(data.rarity || 'common').toUpperCase()} // GEN ${Number(data.generation) || 2} // SIGNAL ${this.execution.compatibilityScore}%`
            )
        );
        if (this.invitation.ownNameSubmitted) {
            this.body.append(
                card,
                element(
                    'p',
                    'shared-fusion-status',
                    'NAME SECURED // AWAITING OTHER KEEPER'
                )
            );
            this.startPolling();
            return;
        }
        const input = element(
            'input',
            'shared-fusion-name-input'
        );
        input.type = 'text';
        input.maxLength = 20;
        input.autocomplete = 'off';
        input.placeholder = 'Name this sibling';
        input.setAttribute(
            'aria-label',
            'Name your linked sibling'
        );
        const submit = button(
            'shared-fusion-primary',
            'SECURE NAME',
            () => this.submitName(input.value)
        );
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') this.submitName(input.value);
        });
        this.body.append(card, input, submit);
        requestAnimationFrame(() => input.focus({
            preventScroll: true
        }));
    }

    async submitName(name) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('SECURING BOTH LINEAGES');
        try {
            const result = await this.service.submitName(
                this.invitation.invitationId,
                name
            );
            this.invitation = result.invitation;
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error);
        } finally {
            this.busy = false;
        }
    }

    async renderReveal() {
        this.renderBusy('RESTORING SANCTUARY RECORD');
        await this.cloudSave?.synchronize?.();
        const pending = this.gameState
            ?.getPendingSharedFusionReveal?.();
        if (!pending?.creature) {
            this.clearBody();
            this.body.append(
                element(
                    'p',
                    'shared-fusion-status',
                    'LINEAGE COMMITTED // REVEAL SYNC PENDING'
                ),
                button(
                    'shared-fusion-primary',
                    'RETRY SYNC',
                    () => this.renderInvitation()
                )
            );
            return;
        }
        this.stopPolling();
        this.clearBody();
        const creature = pending.creature;
        const affinity = creature.cosmicAffinity?.element ||
            creature.genes?.cosmicAffinity?.element ||
            'unclassified';
        const reveal = element(
            'article',
            'shared-fusion-reveal'
        );
        reveal.append(
            element(
                'p',
                'shared-fusion-eyebrow',
                'TWO SANCTUARIES // ONE CURRENT'
            ),
            element(
                'h3',
                'shared-fusion-reveal-name',
                creature.name || 'Linked Sibling'
            ),
            element(
                'p',
                'shared-fusion-reveal-meta',
                `${String(creature.rarity || 'common').toUpperCase()} // ${String(affinity).toUpperCase()} // GEN ${Number(creature.generation) || 2}`
            ),
            element(
                'p',
                'shared-fusion-reveal-copy',
                'A linked sibling signal is now safe in another sanctuary.'
            )
        );
        this.body.append(
            reveal,
            button(
                'shared-fusion-primary',
                'MEET IN SANCTUARY',
                () => {
                    this.gameState
                        ?.acknowledgeSharedFusionReveal?.(
                            pending.invitationId
                        );
                    this.destroy();
                    this.onComplete?.(pending);
                }
            )
        );
    }

    cancelButton() {
        return button(
            'shared-fusion-cancel',
            'CANCEL LINK',
            () => this.cancel()
        );
    }

    async cancel() {
        if (this.busy || !this.invitation?.invitationId) return;
        this.busy = true;
        try {
            this.invitation = await this.service.cancel(
                this.invitation.invitationId
            );
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error);
        } finally {
            this.busy = false;
        }
    }

    async copyCode() {
        const code = this.invitation?.code;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            const status = element(
                'p',
                'shared-fusion-copy-status',
                'CODE COPIED'
            );
            this.body.append(status);
            setTimeout(() => status.remove(), 1600);
        } catch {
            const range = document.createRange();
            const output = this.body.querySelector(
                '.shared-fusion-code'
            );
            if (!output) return;
            range.selectNodeContents(output);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
        }
    }

    renderError(error, returnHome = false) {
        this.stopPolling();
        this.clearBody();
        this.body.append(
            element(
                'p',
                'shared-fusion-error',
                error?.message ||
                    'The protected link could not continue.'
            ),
            button(
                'shared-fusion-primary',
                returnHome ? 'RETURN' : 'RETRY',
                () => {
                    if (returnHome) this.renderHome();
                    else this.resumeOrStart();
                }
            )
        );
    }

    startPolling() {
        this.stopPolling();
        if (
            !this.invitation?.invitationId ||
            this.invitation.terminal
        ) {
            return;
        }
        this.pollTimer = window.setTimeout(
            () => this.poll(),
            2500
        );
    }

    async poll() {
        this.pollTimer = null;
        if (this.destroyed || document.hidden) {
            this.startPolling();
            return;
        }
        try {
            const visibleCode = this.invitation?.code || null;
            this.invitation = await this.service.get(
                this.invitation.invitationId,
                { force: true }
            );
            if (
                visibleCode &&
                this.invitation.status === 'waiting'
            ) {
                this.invitation.code = visibleCode;
            }
            if (this.invitation.status === 'committed') {
                await this.cloudSave?.synchronize?.();
            }
            await this.renderInvitation();
        } catch (error) {
            this.renderError(error);
        }
    }

    stopPolling() {
        if (!this.pollTimer) return;
        window.clearTimeout(this.pollTimer);
        this.pollTimer = null;
    }

    close() {
        this.destroy();
        this.onClose?.();
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stopPolling();
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
        }
        this.domContainer = null;
        this.root?.remove();
        this.domElement?.destroy?.();
        this.service?.destroy?.();
        this.root = null;
        this.body = null;
        this.domElement = null;
    }
}

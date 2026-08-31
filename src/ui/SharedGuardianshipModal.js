function element(tagName, className, text = null) {
    const node = document.createElement(tagName);
    node.className = className;
    if (text !== null) node.textContent = text;
    if (className === 'shared-guardianship-notice') {
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
    }
    return node;
}

function focusableElements(root) {
    return [...root.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
}

function button(className, text, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
}

export default class SharedGuardianshipModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.gameState = options.gameState || window.GameState;
        this.cloudSave = options.cloudSave || window.CloudSave;
        this.account = options.account || new window.DurableAccountService({
            client: this.cloudSave?.client,
            cloudSave: this.cloudSave
        });
        this.service = options.service || new window.SharedGuardianshipService({
            cloudSave: this.cloudSave,
            gameState: this.gameState,
            account: this.account
        });
        this.root = null;
        this.body = null;
        this.domElement = null;
        this.parents = [];
        this.selectedParentId = null;
        this.mode = 'create';
        this.accountMode = 'create';
        this.accountStep = 'email';
        this.pendingEmail = '';
        this.invitation = null;
        this.busy = false;
        this.pollTimer = null;
        this.keyboardHandler = null;
        this.previousFocus = null;
        this.consentChecked = false;
        this.policyChecked = false;
        this.onClose = null;
        this.onComplete = null;
    }

    show({ parents = [], onClose, onComplete } = {}) {
        if (this.root || typeof document === 'undefined') return false;
        this.parents = parents.filter(parent => (
            window.FusionConsent?.getFusionCompanionReadiness?.(parent)?.willing
        ));
        this.selectedParentId = this.parents[0]?.id || null;
        this.onClose = onClose;
        this.onComplete = onComplete;
        this.previousFocus = document.activeElement;
        const { width, height } = this.scene.scale;
        this.root = element('div', 'shared-guardianship-modal');
        this.root.style.width = `${width}px`;
        this.root.style.height = `${height}px`;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', 'Shared Guardianship');
        const shell = element('section', 'shared-guardianship-shell');
        const header = element('header', 'shared-guardianship-header');
        const heading = element('div', 'shared-guardianship-heading');
        heading.append(
            element('p', 'shared-guardianship-eyebrow', 'FUSION POD // PRIVATE CONNECTION'),
            element('h2', 'shared-guardianship-title', 'SHARED GUARDIANSHIP')
        );
        const close = button('shared-guardianship-close', 'CLOSE', () => this.close());
        close.setAttribute('aria-label', 'Close Shared Guardianship');
        header.append(heading, close);
        this.body = element('div', 'shared-guardianship-body');
        shell.append(header, this.body);
        this.root.append(shell);
        this.root.addEventListener('pointerdown', event => event.stopPropagation());
        this.keyboardHandler = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                return;
            }
            if (event.key !== 'Tab' || !this.root) return;
            const focusable = focusableElements(this.root);
            event.preventDefault();
            event.stopImmediatePropagation();
            if (focusable.length === 0) {
                this.root.focus();
                return;
            }
            const activeIndex = focusable.indexOf(document.activeElement);
            const nextIndex = event.shiftKey
                ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
                : (activeIndex < 0 || activeIndex === focusable.length - 1 ? 0 : activeIndex + 1);
            focusable[nextIndex].focus();
        };
        this.root.addEventListener('keydown', this.keyboardHandler, true);
        this.domElement = this.scene.add.dom(width / 2, height / 2, this.root)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(17900);
        const container = this.domElement.node?.parentElement;
        if (container) container.style.zIndex = '17900';
        requestAnimationFrame(() => {
            this.root?.classList.add('is-visible');
            focusableElements(this.root)[0]?.focus({ preventScroll: true });
        });
        this.start();
        return true;
    }

    clear() {
        this.body?.replaceChildren();
    }

    async start() {
        this.renderBusy('CHECKING YOUR SANCTUARY');
        try {
            const status = await this.account.getStatus({ refresh: true });
            if (!status.permanent) this.renderAccountGate();
            else this.renderHome();
        } catch (error) {
            this.renderError(error);
        }
    }

    renderBusy(label) {
        this.clear();
        const busy = element('div', 'shared-guardianship-busy');
        busy.setAttribute('role', 'status');
        busy.setAttribute('aria-live', 'polite');
        const pulse = element('span', 'shared-guardianship-pulse');
        pulse.setAttribute('aria-hidden', 'true');
        busy.append(pulse, element('p', '', label));
        this.body.append(busy);
    }

    renderAccountGate(notice = '') {
        this.stopPolling();
        this.clear();
        const intro = element('section', 'shared-guardianship-intro');
        intro.append(
            element('h3', '', 'Keep one shared creature safe on both devices'),
            element('p', '', 'Shared Guardianship needs a verified account so your creature can return to the same two people after a device is changed or lost.'),
            element('p', 'shared-guardianship-boundary', '16+ ONLY // NO CHAT // NO PLAYER SEARCH')
        );
        const tabs = element('div', 'shared-guardianship-tabs');
        tabs.append(
            button(`shared-guardianship-tab${this.accountMode === 'create' ? ' is-active' : ''}`, 'CREATE ACCOUNT', () => {
                this.accountMode = 'create';
                this.accountStep = 'email';
                this.renderAccountGate();
            }),
            button(`shared-guardianship-tab${this.accountMode === 'signin' ? ' is-active' : ''}`, 'SIGN IN', () => {
                this.accountMode = 'signin';
                this.renderAccountGate();
            })
        );
        const form = element('div', 'shared-guardianship-form');
        if (this.accountMode === 'signin') {
            const email = this.input('email', 'Email', 'email');
            const password = this.input('password', 'Password', 'current-password');
            form.append(
                email,
                password,
                button('shared-guardianship-primary', 'SIGN IN', () => this.signIn(email.value, password.value)),
                button('shared-guardianship-text-button', 'Forgot password', () => this.resetPassword(email.value))
            );
        } else if (this.accountStep === 'email') {
            const email = this.input('email', 'Email', 'email');
            form.append(
                element('p', 'shared-guardianship-helper', 'Your email is used only for account access. The other guardian never sees it.'),
                email,
                button('shared-guardianship-primary', 'SEND VERIFICATION', () => this.beginUpgrade(email.value))
            );
        } else if (this.accountStep === 'verify') {
            const code = this.input('text', 'Email code (if shown)', 'one-time-code');
            code.inputMode = 'numeric';
            form.append(
                element('p', 'shared-guardianship-helper', 'Open the verification email. Return here after using its link, or enter the code shown in the message.'),
                code,
                button('shared-guardianship-primary', 'VERIFY CODE', () => this.verifyCode(code.value)),
                button('shared-guardianship-secondary', 'I USED THE EMAIL LINK', () => this.checkVerified())
            );
        } else {
            const password = this.input('password', 'Choose a password', 'new-password');
            form.append(
                element('p', 'shared-guardianship-helper', 'Use at least 10 characters. Your current save stays attached to this same account.'),
                password,
                button('shared-guardianship-primary', 'FINISH ACCOUNT', () => this.finishUpgrade(password.value))
            );
        }
        if (notice) form.append(element('p', 'shared-guardianship-notice', notice));
        this.body.append(intro, tabs, form);
        form.querySelector('input')?.focus({ preventScroll: true });
    }

    input(type, placeholder, autocomplete) {
        const input = element('input', 'shared-guardianship-input');
        input.type = type;
        input.placeholder = placeholder;
        input.autocomplete = autocomplete;
        input.setAttribute('aria-label', placeholder);
        return input;
    }

    async beginUpgrade(email) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('SENDING VERIFICATION');
        try {
            await this.account.beginUpgrade(email);
            this.pendingEmail = String(email).trim().toLowerCase();
            this.accountStep = 'verify';
            this.renderAccountGate('Verification sent. Your game remains playable while you check it.');
        } catch (error) {
            this.accountStep = 'email';
            this.renderAccountGate(error.message);
        } finally {
            this.busy = false;
        }
    }

    async verifyCode(code) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('VERIFYING ACCOUNT');
        try {
            await this.account.verifyEmailCode(this.pendingEmail, code);
            this.accountStep = 'password';
            this.renderAccountGate('Email verified. Choose a password to finish.');
        } catch (error) {
            this.accountStep = 'verify';
            this.renderAccountGate(error.message);
        } finally {
            this.busy = false;
        }
    }

    async checkVerified() {
        try {
            const status = await this.account.getStatus({ refresh: true });
            if (!status.permanent) {
                this.renderAccountGate('The verification has not reached this browser yet. Try the email link again.');
                return;
            }
            this.accountStep = 'password';
            this.renderAccountGate('Email verified. Choose a password to finish.');
        } catch (error) {
            this.renderAccountGate(error.message);
        }
    }

    async finishUpgrade(password) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('SECURING YOUR ACCOUNT');
        try {
            await this.account.finishUpgrade(password);
            this.renderHome('Account ready. Your progress can now return on another device.');
        } catch (error) {
            this.accountStep = 'password';
            this.renderAccountGate(error.message);
        } finally {
            this.busy = false;
        }
    }

    async signIn(email, password) {
        if (this.busy) return;
        this.busy = true;
        this.renderBusy('OPENING YOUR ACCOUNT');
        try {
            await this.account.signIn(email, password);
            this.renderHome('Signed in. Your shared creature will use this account.');
        } catch (error) {
            this.renderAccountGate(error.message);
        } finally {
            this.busy = false;
        }
    }

    async resetPassword(email) {
        try {
            await this.account.requestPasswordReset(email);
            this.renderAccountGate('Password reset sent if that account exists.');
        } catch (error) {
            this.renderAccountGate(error.message);
        }
    }

    renderHome(notice = '') {
        this.stopPolling();
        this.clear();
        this.invitation = null;
        const intro = element('section', 'shared-guardianship-intro');
        intro.append(
            element('h3', '', 'One creature. Two Sanctuaries.'),
            element('p', '', 'Each person contributes one willing adult creature. The Fusion Pod creates one child that remains visible and cared for on both devices.'),
            element('p', 'shared-guardianship-boundary', 'PRIVATE CODE // NO CHAT // EITHER PERSON CAN PLAY ALONE')
        );
        const tabs = element('div', 'shared-guardianship-tabs');
        tabs.append(
            button(`shared-guardianship-tab${this.mode === 'create' ? ' is-active' : ''}`, 'CREATE PRIVATE CODE', () => { this.mode = 'create'; this.renderHome(); }),
            button(`shared-guardianship-tab${this.mode === 'join' ? ' is-active' : ''}`, 'ENTER PRIVATE CODE', () => { this.mode = 'join'; this.renderHome(); })
        );
        const parentList = element('div', 'shared-guardianship-parent-list');
        if (this.parents.length === 0) {
            parentList.append(
                element(
                    'p',
                    'shared-guardianship-empty',
                    'Raise one creature to adulthood and confirm that it is willing to contribute to Fusion. Then return here.'
                )
            );
        }
        this.parents.forEach(parent => {
            const choice = button(`shared-guardianship-parent${parent.id === this.selectedParentId ? ' is-selected' : ''}`, '', () => {
                this.selectedParentId = parent.id;
                this.renderHome();
            });
            choice.append(
                element('strong', '', parent.name || 'Companion'),
                element('span', '', `${String(parent.rarity || parent.genes?.rarity || 'common').toUpperCase()} // ${String(parent.lifecycle?.stage || 'adult').toUpperCase()}`)
            );
            parentList.append(choice);
        });
        const action = element('div', 'shared-guardianship-form');
        const policy = element('label', 'shared-guardianship-consent');
        const policyCheckbox = document.createElement('input');
        policyCheckbox.type = 'checkbox';
        policyCheckbox.checked = this.policyChecked;
        const policyText = element('span', '', 'I am 16 or older and have reviewed how this private shared feature uses account and creature data.');
        const policyLinks = element('span', 'shared-guardianship-policy-links');
        const privacyLink = document.createElement('a');
        privacyLink.href = '/privacy/';
        privacyLink.target = '_blank';
        privacyLink.rel = 'noopener';
        privacyLink.textContent = 'Privacy';
        const termsLink = document.createElement('a');
        termsLink.href = '/terms/';
        termsLink.target = '_blank';
        termsLink.rel = 'noopener';
        termsLink.textContent = 'Terms';
        policyLinks.append(privacyLink, document.createTextNode(' · '), termsLink);
        policyText.append(document.createElement('br'), policyLinks);
        policy.append(policyCheckbox, policyText);
        let primaryAction;
        if (this.mode === 'join') {
            const code = this.input('text', 'XXXX-XXXX-XXXX', 'off');
            code.maxLength = 14;
            code.addEventListener('input', () => {
                const normalized = window.SharedGuardianship?.normalizeCode?.(code.value);
                if (normalized) code.value = normalized;
            });
            primaryAction = button('shared-guardianship-primary', 'JOIN PRIVATE LINK', () => this.join(code.value));
            action.append(code, primaryAction);
        } else {
            primaryAction = button('shared-guardianship-primary', 'CREATE PRIVATE LINK', () => this.create());
            action.append(primaryAction);
        }
        primaryAction.disabled = !this.policyChecked || !this.selectedParent();
        policyCheckbox.addEventListener('change', () => {
            this.policyChecked = policyCheckbox.checked;
            primaryAction.disabled = !this.policyChecked || !this.selectedParent();
        });
        if (notice) action.append(element('p', 'shared-guardianship-notice', notice));
        this.body.append(intro, tabs, element('p', 'shared-guardianship-label', 'CHOOSE YOUR CONTRIBUTING CREATURE'), parentList, policy, action);
    }

    selectedParent() {
        return this.parents.find(parent => parent.id === this.selectedParentId) || null;
    }

    async create() {
        await this.run('CREATING PRIVATE LINK', async () => {
            this.invitation = await this.service.create(this.selectedParent());
            this.renderInvitation();
        }, () => this.renderHome());
    }

    async join(code) {
        await this.run('JOINING PRIVATE LINK', async () => {
            this.invitation = await this.service.join(code, this.selectedParent());
            this.renderInvitation();
        }, () => this.renderHome());
    }

    renderInvitation(notice = '') {
        this.clear();
        const invitation = this.invitation;
        if (!invitation) return this.renderHome();
        if (invitation.status === 'committed') return this.renderCommitted();
        const header = element('section', 'shared-guardianship-intro');
        header.append(
            element('h3', '', invitation.peerSignal ? 'Both creatures are here' : 'Waiting for someone you know'),
            element('p', '', invitation.peerSignal
                ? 'Review the pairing. Nothing is created until both people agree.'
                : 'Share this one-time code privately. It expires automatically.'),
        );
        if (invitation.code) header.append(element('strong', 'shared-guardianship-code', invitation.code));
        if (invitation.peerSignal) {
            header.append(element('p', 'shared-guardianship-peer', `${invitation.peerSignal.affinity.toUpperCase()} // ${invitation.peerSignal.rarity.toUpperCase()} // GEN ${invitation.peerSignal.generation}`));
        }
        this.body.append(header);
        if (['staged','executing','ready'].includes(invitation.status) && invitation.hostConfirmed && invitation.guestConfirmed) {
            if (invitation.status === 'staged') this.renderNaming(notice);
            else this.renderFormation();
            return;
        }
        if (invitation.peerSignal) {
            const consent = element('label', 'shared-guardianship-consent');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.consentChecked;
            checkbox.addEventListener('change', () => {
                this.consentChecked = checkbox.checked;
                confirm.disabled = !this.consentChecked;
            });
            consent.append(checkbox, element('span', '', 'I understand this creates one shared creature. Both guardians can always see and care for it, and either guardian may leave without deleting it.'));
            const confirm = button('shared-guardianship-primary', this.ownConfirmed() ? 'WAITING FOR OTHER GUARDIAN' : 'I AGREE TO CREATE ONE SHARED CREATURE', () => this.confirm());
            confirm.disabled = this.ownConfirmed() || !this.consentChecked;
            this.body.append(consent, confirm);
        }
        if (notice) this.body.append(element('p', 'shared-guardianship-notice', notice));
        this.body.append(button('shared-guardianship-text-button', 'Cancel private link', () => this.cancel()));
        this.startPolling();
    }

    ownConfirmed() {
        return this.invitation?.role === 'host' ? this.invitation.hostConfirmed : this.invitation?.guestConfirmed;
    }

    async confirm() {
        await this.run('RECORDING YOUR AGREEMENT', async () => {
            this.invitation = await this.service.confirm(this.invitation.invitationId);
            this.consentChecked = false;
            if (this.invitation.status === 'ready') await this.formCreature();
            else this.renderInvitation();
        }, () => this.renderInvitation());
    }

    renderFormation() {
        this.stopPolling();
        const panel = element('div', 'shared-guardianship-busy');
        panel.append(element('span', 'shared-guardianship-pulse'), element('p', '', 'ONE LIVING SIGNAL IS FORMING'));
        this.body.append(panel);
        this.formCreature();
    }

    async formCreature() {
        try {
            await this.service.execute(this.invitation.invitationId);
            this.invitation = await this.service.get(this.invitation.invitationId);
            this.renderInvitation();
        } catch (error) {
            this.renderInvitation(error.message);
        }
    }

    renderNaming(notice = '') {
        this.stopPolling();
        const section = element('section', 'shared-guardianship-naming');
        section.append(
            element('h3', '', 'Choose one name together'),
            element('p', '', 'Select from the protected list. The name is set when both guardians choose the same one.')
        );
        const names = element('div', 'shared-guardianship-name-grid');
        window.SharedGuardianship.contract.safeNames.forEach(name => {
            names.append(button(`shared-guardianship-name${this.invitation.ownNameChoice === name ? ' is-selected' : ''}`, name, () => this.chooseName(name)));
        });
        section.append(names);
        if (this.invitation.peerNameChoice && !this.invitation.nameAgreed) {
            section.append(element('p', 'shared-guardianship-notice', `The other guardian chose ${this.invitation.peerNameChoice}. Choose the same name or wait for them to change it.`));
        }
        if (notice) section.append(element('p', 'shared-guardianship-notice', notice));
        this.body.append(section);
        this.startPolling();
    }

    async chooseName(name) {
        await this.run('SHARING YOUR NAME CHOICE', async () => {
            this.invitation = await this.service.chooseName(this.invitation.invitationId, name);
            this.renderInvitation();
        }, () => this.renderNaming());
    }

    async renderCommitted() {
        this.stopPolling();
        this.clear();
        let projection = null;
        try {
            projection = await this.service.getProjection(this.invitation.sharedCreatureId);
        } catch (_) {
            // The committed receipt remains resumable if projection refresh pauses.
        }
        const panel = element('section', 'shared-guardianship-complete');
        panel.append(
            element('p', 'shared-guardianship-eyebrow', 'ONE LIFE // TWO SANCTUARIES'),
            element('h3', '', projection?.name || 'Shared creature formed'),
            element('p', '', 'This is one creature, not a copy. It will remain visible in both Sanctuaries, and either guardian can care for it while the other is away.'),
            button('shared-guardianship-primary', 'RETURN TO SANCTUARY', () => this.complete())
        );
        this.body.append(panel);
    }

    startPolling() {
        this.stopPolling();
        this.pollTimer = window.setInterval(async () => {
            if (!this.invitation || this.busy) return;
            try {
                const previous = this.invitation;
                const current = await this.service.get(previous.invitationId);
                current.code = previous.code;
                if (JSON.stringify(current) !== JSON.stringify(previous)) {
                    this.invitation = current;
                    this.renderInvitation();
                }
            } catch (_) {
                // Keep the safe local view and retry; solo gameplay is never blocked.
            }
        }, 2500);
    }

    stopPolling() {
        if (this.pollTimer) window.clearInterval(this.pollTimer);
        this.pollTimer = null;
    }

    async cancel() {
        await this.run('CANCELLING PRIVATE LINK', async () => {
            await this.service.cancel(this.invitation.invitationId);
            this.renderHome('Private link cancelled. No creature was created.');
        }, () => this.renderInvitation());
    }

    async run(label, action, fallback) {
        if (this.busy) return;
        this.busy = true;
        this.stopPolling();
        this.renderBusy(label);
        try {
            await action();
        } catch (error) {
            fallback?.();
            this.body.append(element('p', 'shared-guardianship-notice', error.message));
        } finally {
            this.busy = false;
        }
    }

    renderError(error) {
        this.clear();
        const panel = element('section', 'shared-guardianship-complete');
        panel.append(
            element('h3', '', 'Connection paused'),
            element('p', '', error?.message || 'Shared Guardianship is temporarily unavailable. Your solo game and creatures are safe.'),
            button('shared-guardianship-primary', 'TRY AGAIN', () => this.start()),
            button('shared-guardianship-secondary', 'CLOSE', () => this.close())
        );
        this.body.append(panel);
    }

    complete() {
        this.onComplete?.(this.invitation);
        this.close(false);
    }

    close(notify = true) {
        if (!this.root) return;
        this.stopPolling();
        this.service?.destroy?.();
        this.root.removeEventListener('keydown', this.keyboardHandler, true);
        this.domElement?.destroy?.();
        if (this.previousFocus?.isConnected) {
            this.previousFocus.focus({ preventScroll: true });
        }
        this.previousFocus = null;
        this.root = null;
        this.body = null;
        if (notify) this.onClose?.();
    }

    destroy() {
        this.close(false);
    }
}

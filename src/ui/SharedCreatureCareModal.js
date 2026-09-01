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

export default class SharedCreatureCareModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.service = options.service;
        this.projection = options.projection;
        this.onClose = options.onClose;
        this.onUpdate = options.onUpdate;
        this.onAccessRevoked = options.onAccessRevoked;
        this.root = null;
        this.domElement = null;
        this.stopWatching = null;
        this.busy = false;
        this.confirmLeave = false;
        this.manageAccess = false;
        this.confirmDeleteAccount = false;
        this.deletePassword = '';
        this.deleteConfirmation = '';
        this.keyboardHandler = null;
        this.previousFocus = null;
    }

    show() {
        if (this.root || !this.projection) return false;
        const { width, height } = this.scene.scale;
        this.previousFocus = document.activeElement;
        this.root = element('div', 'shared-guardianship-modal');
        this.root.style.width = `${width}px`;
        this.root.style.height = `${height}px`;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', `${this.projection.name} shared habitat`);
        this.domElement = this.scene.add.dom(width / 2, height / 2, this.root)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(17920);
        const container = this.domElement.node?.parentElement;
        if (container) container.style.zIndex = '17920';
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
        requestAnimationFrame(() => {
            this.root?.classList.add('is-visible');
            focusableElements(this.root)[0]?.focus({ preventScroll: true });
        });
        this.render();
        this.stopWatching = this.service.watch(
            this.projection.sharedCreatureId,
            (projection) => {
                if (!projection || this.busy) return;
                this.projection = projection;
                this.onUpdate?.(projection);
                this.render('Together');
            }
        );
        return true;
    }

    render(status = '') {
        if (!this.root) return;
        this.root.replaceChildren();
        const shell = element('section', 'shared-guardianship-shell');
        const header = element('header', 'shared-guardianship-header');
        const heading = element('div', 'shared-guardianship-heading');
        const sharedState = this.projection.guardianCount > 1
            ? 'TOGETHER'
            : 'ONE GUARDIAN';
        heading.append(
            element('p', 'shared-guardianship-eyebrow', `SHARED HABITAT // ${sharedState}`),
            element('h2', 'shared-guardianship-title', this.projection.name)
        );
        const close = button('shared-guardianship-close', 'CLOSE', () => this.close());
        close.setAttribute('aria-label', 'Close shared creature habitat');
        header.append(heading, close);
        const body = element('div', 'shared-guardianship-body');
        body.append(
            element('p', 'shared-guardianship-helper', 'This is the same creature in both Sanctuaries. Care from either guardian changes this one shared life.'),
            this.careSummary()
        );
        const actions = element('div', 'shared-guardianship-care-grid');
        actions.append(
            button('shared-guardianship-care', 'TEND\nComfort +8', () => this.care('tend')),
            button('shared-guardianship-care', 'PLAY\nCuriosity +8', () => this.care('play')),
            button('shared-guardianship-care', 'REST\nEnergy +10', () => this.care('rest'))
        );
        body.append(actions);
        if (status) body.append(element('p', 'shared-guardianship-notice', status));
        const history = element('section', 'shared-guardianship-history');
        history.append(element('h3', '', 'Recent moments'));
        (this.projection.history || []).slice(0, 6).forEach(entry => {
            history.append(element('p', '', entry.summary));
        });
        body.append(history);
        const notificationSetting = element('label', 'shared-guardianship-notification-setting');
        const notificationToggle = document.createElement('input');
        notificationToggle.type = 'checkbox';
        notificationToggle.checked = this.projection.notificationsMuted === true;
        notificationToggle.addEventListener('change', () => {
            this.setNotificationsMuted(notificationToggle.checked);
        });
        notificationSetting.append(
            notificationToggle,
            element('span', '', 'Mute optional shared activity notices')
        );
        body.append(notificationSetting);
        if (this.manageAccess) {
            const access = element('section', 'shared-guardianship-access');
            access.append(element('h3', '', 'Account access'));
            if (this.confirmDeleteAccount) {
                const password = document.createElement('input');
                password.className = 'shared-guardianship-input';
                password.type = 'password';
                password.autocomplete = 'current-password';
                password.placeholder = 'Account password';
                password.setAttribute('aria-label', 'Account password');
                password.value = this.deletePassword;
                password.addEventListener('input', () => {
                    this.deletePassword = password.value;
                });
                const confirmation = document.createElement('input');
                confirmation.className = 'shared-guardianship-input';
                confirmation.type = 'text';
                confirmation.autocomplete = 'off';
                confirmation.placeholder = 'Type DELETE';
                confirmation.setAttribute('aria-label', 'Type DELETE to confirm');
                confirmation.value = this.deleteConfirmation;
                confirmation.addEventListener('input', () => {
                    this.deleteConfirmation = confirmation.value;
                });
                access.append(
                    element('p', '', 'Delete this account permanently? Shared access ends immediately. Your solo game stays on this device. A surviving guardian keeps the shared creature; with no guardian it rests in the archive.'),
                    password,
                    confirmation,
                    button('shared-guardianship-secondary', 'DELETE ACCOUNT PERMANENTLY', () => this.deleteAccount()),
                    button('shared-guardianship-text-button', 'Cancel account deletion', () => {
                        this.confirmDeleteAccount = false;
                        this.deletePassword = '';
                        this.deleteConfirmation = '';
                        this.render();
                    })
                );
            } else {
                access.append(
                    element('p', '', 'Signing out removes this shared creature from this device. Your solo local game remains here, and the shared creature returns after you sign in again.'),
                    button('shared-guardianship-secondary', 'SIGN OUT OF THIS DEVICE', () => this.signOut()),
                    button('shared-guardianship-text-button', 'Delete account and shared access', () => {
                        this.confirmDeleteAccount = true;
                        this.render();
                    }),
                    button('shared-guardianship-text-button', 'Back', () => {
                        this.manageAccess = false;
                        this.render();
                    })
                );
            }
            body.append(access);
        } else {
            body.append(button('shared-guardianship-text-button', 'Account & privacy', () => {
                this.manageAccess = true;
                this.confirmLeave = false;
                this.render();
            }));
        }
        if (this.confirmLeave) {
            const leave = element('section', 'shared-guardianship-consent');
            leave.append(
                element('span', '', ''),
                element('span', '', this.projection.guardianCount > 1
                    ? 'Leave Shared Guardianship? The other guardian keeps the creature. You immediately lose access, but the creature and its history remain safe.'
                    : 'Leave Shared Guardianship? You immediately lose access. With no guardian remaining, the creature rests safely in the archive; it is not sold, transferred or erased.')
            );
            body.append(
                leave,
                button('shared-guardianship-secondary', 'CONFIRM LEAVE', () => this.leave()),
                button('shared-guardianship-text-button', 'Keep caring together', () => {
                    this.confirmLeave = false;
                    this.render();
                })
            );
        } else {
            body.append(button('shared-guardianship-text-button', 'Leave Shared Guardianship', () => {
                this.confirmLeave = true;
                this.render();
            }));
        }
        shell.append(header, body);
        this.root.append(shell);
    }

    careSummary() {
        const summary = element('div', 'shared-guardianship-care-summary');
        const care = this.projection.care || {};
        [['COMFORT', care.comfort], ['CURIOSITY', care.curiosity], ['ENERGY', care.energy]].forEach(([label, value]) => {
            const stat = element('div', 'shared-guardianship-stat');
            stat.append(element('span', '', label), element('strong', '', `${Math.max(0, Math.min(100, Number(value) || 0))}`));
            summary.append(stat);
        });
        return summary;
    }

    async care(action) {
        if (this.busy) return;
        this.busy = true;
        this.render('Saving this moment...');
        try {
            const projection = await this.service.care(
                this.projection.sharedCreatureId,
                action,
                this.projection.revision
            );
            this.projection = projection;
            this.onUpdate?.(projection);
            this.render('The same change is now visible in both Sanctuaries.');
        } catch (error) {
            if (error.code === 'shared_guardianship_revision_conflict') {
                this.projection = error.latestProjection ||
                    await this.service.getProjection(this.projection.sharedCreatureId);
                this.onUpdate?.(this.projection);
            }
            this.render(error.message || 'Connection paused. The last safe view remains here.');
        } finally {
            this.busy = false;
        }
    }

    async leave() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.service.leave(
                this.projection.sharedCreatureId,
                this.projection.revision
            );
            this.close();
        } catch (error) {
            this.confirmLeave = false;
            if (error.code === 'shared_guardianship_revision_conflict') {
                this.projection = error.latestProjection || this.projection;
                this.onUpdate?.(this.projection);
            }
            this.render(error.message || 'Leaving is unavailable right now.');
        } finally {
            this.busy = false;
        }
    }

    async setNotificationsMuted(muted) {
        if (this.busy) return;
        this.busy = true;
        this.render('Saving notice preference...');
        try {
            const projection = await this.service.setNotificationsMuted(
                this.projection.sharedCreatureId,
                muted,
                this.projection.revision
            );
            this.projection = projection;
            this.onUpdate?.(projection);
            this.render(muted ? 'Optional notices muted.' : 'Optional notices enabled.');
        } catch (error) {
            if (error.code === 'shared_guardianship_revision_conflict') {
                this.projection = error.latestProjection || this.projection;
                this.onUpdate?.(this.projection);
            }
            this.render(error.message || 'Notice preference could not be changed.');
        } finally {
            this.busy = false;
        }
    }

    async signOut() {
        if (this.busy) return;
        this.busy = true;
        this.render('Signing out of this device...');
        try {
            await this.service.account.signOut();
            this.onAccessRevoked?.();
            this.close();
        } catch (error) {
            this.render(error.message || 'This device could not sign out.');
        } finally {
            this.busy = false;
        }
    }

    async deleteAccount() {
        if (this.busy) return;
        this.busy = true;
        this.render('Deleting this account and ending shared access...');
        try {
            await this.service.account.deleteAccount(
                this.deletePassword,
                this.deleteConfirmation
            );
            this.onAccessRevoked?.();
            this.close();
        } catch (error) {
            this.confirmDeleteAccount = true;
            this.render(error.message || 'The account could not be deleted.');
        } finally {
            this.busy = false;
        }
    }

    close() {
        this.stopWatching?.();
        this.stopWatching = null;
        if (this.keyboardHandler) this.root.removeEventListener('keydown', this.keyboardHandler, true);
        this.keyboardHandler = null;
        this.domElement?.destroy?.();
        if (this.previousFocus?.isConnected) {
            this.previousFocus.focus({ preventScroll: true });
        }
        this.previousFocus = null;
        this.root = null;
        this.onClose?.();
    }

    destroy() {
        this.close();
    }
}

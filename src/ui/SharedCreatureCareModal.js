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

export default class SharedCreatureCareModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.service = options.service;
        this.projection = options.projection;
        this.onClose = options.onClose;
        this.onUpdate = options.onUpdate;
        this.root = null;
        this.domElement = null;
        this.stopWatching = null;
        this.busy = false;
        this.confirmLeave = false;
    }

    show() {
        if (this.root || !this.projection) return false;
        const { width, height } = this.scene.scale;
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
        requestAnimationFrame(() => this.root?.classList.add('is-visible'));
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
        heading.append(
            element('p', 'shared-guardianship-eyebrow', 'SHARED HABITAT // TOGETHER'),
            element('h2', 'shared-guardianship-title', this.projection.name)
        );
        header.append(heading, button('shared-guardianship-close', 'CLOSE', () => this.close()));
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
        if (this.confirmLeave) {
            const leave = element('section', 'shared-guardianship-consent');
            leave.append(
                element('span', '', ''),
                element('span', '', 'Leave Shared Guardianship? The other guardian keeps the creature. You will immediately lose access, and this cannot be used to delete or transfer it.')
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
                this.projection = await this.service.getProjection(this.projection.sharedCreatureId);
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
            await this.service.leave(this.projection.sharedCreatureId);
            this.close();
        } catch (error) {
            this.confirmLeave = false;
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
                muted
            );
            this.projection = projection;
            this.onUpdate?.(projection);
            this.render(muted ? 'Optional notices muted.' : 'Optional notices enabled.');
        } catch (error) {
            this.render(error.message || 'Notice preference could not be changed.');
        } finally {
            this.busy = false;
        }
    }

    close() {
        this.stopWatching?.();
        this.stopWatching = null;
        this.domElement?.destroy?.();
        this.root = null;
        this.onClose?.();
    }

    destroy() {
        this.close();
    }
}

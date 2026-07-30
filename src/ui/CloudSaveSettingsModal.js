/**
 * Player-facing controls for optional, browser-linked cloud saves.
 */
class CloudSaveSettingsModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.getManager = options.getManager || (() => window.CloudSave || null);
        this.openPrivacyPolicy = options.openPrivacyPolicy || null;
        this.elements = [];
        this.isVisible = false;
        this.busy = false;
        this.consentChecked = false;
        this.confirmingDelete = false;
        this.notice = '';
        this.uiCamera = null;
    }

    show() {
        this.isVisible = true;
        this.consentChecked = false;
        this.confirmingDelete = false;
        this.notice = '';
        this.render();
    }

    render() {
        this.clearElements();
        if (!this.isVisible) return;

        const manager = this.getManager();
        const status = manager?.getStatus?.() || {
            configured: false,
            enabled: false,
            ageEligible: false,
            ageGroup: null,
            status: 'unavailable',
            lastSyncedAt: null,
            lastSyncDirection: null,
            hasError: false
        };
        const { width, height } = this.scene.cameras.main;
        this.ensureUICamera(width, height);
        const centerX = width / 2;
        const centerY = height / 2;
        const panelWidth = Math.min(520, width - 24);
        const panelHeight = Math.min(570, height - 24);
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;
        const contentWidth = panelWidth - 48;

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.88);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(17500);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        overlay.on('pointerdown', () => {
            if (!this.busy) this.hide();
        });
        this.elements.push(overlay);

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x101525, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x62C4A6, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(17501);
        this.elements.push(panel);

        this.addText(centerX, panelY + 30, 'Cloud Save', {
            fontSize: '22px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const close = this.addText(panelX + panelWidth - 24, panelY + 28, 'X', {
            fontSize: '18px',
            color: '#AEB8C5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => {
            if (!this.busy) this.hide();
        });

        const statusInfo = this.getStatusInfo(status);
        const statusY = panelY + 72;
        const statusBar = this.scene.add.graphics();
        statusBar.fillStyle(statusInfo.background, 1);
        statusBar.fillRoundedRect(panelX + 24, statusY - 19, contentWidth, 38, 6);
        statusBar.setScrollFactor(0).setDepth(17502);
        this.elements.push(statusBar);
        this.addText(panelX + 38, statusY, statusInfo.label, {
            fontSize: '14px',
            color: statusInfo.color,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        let y = panelY + 116;
        const summary = this.getSummary(status);
        const summaryText = this.addText(panelX + 24, y, summary, {
            fontSize: '14px',
            color: '#D7DEE8',
            wordWrap: { width: contentWidth },
            lineSpacing: 4
        });
        y += summaryText.height + 20;

        const limitation = this.addText(
            panelX + 24,
            y,
            'This version is tied to this browser and does not yet move progress to another device.',
            {
                fontSize: '12px',
                color: '#94A2B3',
                wordWrap: { width: contentWidth },
                lineSpacing: 3
            }
        );
        y += limitation.height + 24;

        if (!status.configured) {
            this.renderUnavailable(panelX, panelY, panelWidth, panelHeight, y);
        } else if (!status.ageEligible) {
            this.renderAgeRestricted(panelX, panelWidth, y, status.ageGroup);
        } else if (this.confirmingDelete) {
            this.renderDeleteConfirmation(panelX, panelY, panelWidth, panelHeight, y);
        } else if (status.enabled) {
            this.renderEnabled(status, panelX, panelY, panelWidth, panelHeight, y);
        } else {
            this.renderDisabled(panelX, panelY, panelWidth, panelHeight, y);
        }

        if (this.notice) {
            this.addText(centerX, panelY + panelHeight - 68, this.notice, {
                fontSize: '12px',
                color: status.hasError ? '#FF9C9C' : '#8FE3C4',
                align: 'center',
                wordWrap: { width: contentWidth }
            }).setOrigin(0.5);
        }

        const privacy = this.addText(centerX, panelY + panelHeight - 28, 'Read Privacy Policy', {
            fontSize: '13px',
            color: '#8FD9FF'
        }).setOrigin(0.5);
        privacy.setInteractive({ useHandCursor: true });
        privacy.on('pointerover', () => privacy.setColor('#C7EEFF'));
        privacy.on('pointerout', () => privacy.setColor('#8FD9FF'));
        privacy.on('pointerdown', () => {
            if (this.busy) return;
            this.hide();
            this.openPrivacyPolicy?.();
        });

        // Fixed controls must not inherit the gameplay camera's world zoom.
        this.scene.cameras.main.ignore(this.elements);
    }

    renderDisabled(panelX, panelY, panelWidth, panelHeight, y) {
        const consentLabel = 'I understand what is stored and choose to enable Cloud Save.';
        const label = this.addText(panelX + 64, y + 12, consentLabel, {
            fontSize: '13px',
            color: '#FFFFFF',
            wordWrap: { width: panelWidth - 104 },
            lineSpacing: 3
        }).setOrigin(0, 0.5);

        const boxSize = 26;
        const boxX = panelX + 38;
        const boxY = y + Math.max(12, label.height / 2);
        const box = this.scene.add.graphics();
        box.lineStyle(2, this.consentChecked ? 0x62C4A6 : 0x8290A2, 1);
        box.strokeRoundedRect(boxX - boxSize / 2, boxY - boxSize / 2, boxSize, boxSize, 4);
        if (this.consentChecked) {
            box.fillStyle(0x62C4A6, 1);
            box.fillRoundedRect(boxX - boxSize / 2, boxY - boxSize / 2, boxSize, boxSize, 4);
        }
        box.setScrollFactor(0).setDepth(17502);
        this.elements.push(box);
        if (this.consentChecked) {
            this.addText(boxX, boxY, '✓', {
                fontSize: '18px',
                color: '#07120F',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        const consentZone = this.scene.add.zone(
            panelX + panelWidth / 2,
            boxY,
            panelWidth - 48,
            Math.max(48, label.height + 16)
        );
        consentZone.setScrollFactor(0).setDepth(17504);
        consentZone.setInteractive({ useHandCursor: true });
        consentZone.on('pointerdown', () => {
            if (this.busy) return;
            this.consentChecked = !this.consentChecked;
            this.render();
        });
        this.elements.push(consentZone);

        const buttonY = Math.min(panelY + panelHeight - 118, boxY + 72);
        this.createButton(
            panelX + panelWidth / 2,
            buttonY,
            this.busy ? 'Connecting...' : 'Enable Cloud Save',
            () => this.enableCloudSave(),
            {
                disabled: this.busy || !this.consentChecked,
                width: Math.min(280, panelWidth - 64),
                color: 0x287A63
            }
        );
    }

    renderEnabled(status, panelX, panelY, panelWidth, panelHeight, y) {
        const lastSynced = status.lastSyncedAt
            ? new Date(status.lastSyncedAt).toLocaleString()
            : 'Waiting for first sync';
        const syncLabel = status.lastSyncDirection === 'restored'
            ? 'Restored from cloud'
            : status.lastSyncDirection === 'uploaded'
                ? 'Backed up to cloud'
                : 'Last checked';
        this.addText(panelX + 24, y, `${syncLabel}: ${lastSynced}`, {
            fontSize: '13px',
            color: '#AEB8C5',
            wordWrap: { width: panelWidth - 48 }
        });

        const buttonWidth = Math.min(300, panelWidth - 64);
        const centerX = panelX + panelWidth / 2;
        let buttonY = y + 62;
        this.createButton(
            centerX,
            buttonY,
            this.busy ? 'Syncing...' : 'Sync Now',
            () => this.syncNow(),
            { disabled: this.busy, width: buttonWidth, color: 0x287A63 }
        );
        buttonY += 54;
        this.createButton(
            centerX,
            buttonY,
            'Turn Off Sync',
            () => this.disableCloudSave(),
            { disabled: this.busy, width: buttonWidth, color: 0x33485C }
        );
        buttonY += 54;
        this.createButton(
            centerX,
            buttonY,
            'Delete Cloud Data',
            () => {
                this.confirmingDelete = true;
                this.notice = '';
                this.render();
            },
            { disabled: this.busy, width: buttonWidth, color: 0x733B48 }
        );
    }

    renderDeleteConfirmation(panelX, panelY, panelWidth, panelHeight, y) {
        const warning = this.addText(
            panelX + 24,
            y,
            'Delete the remote save and anonymous cloud identity? Your current local progress will stay on this device, and Cloud Save will be turned off.',
            {
                fontSize: '14px',
                color: '#FFD1D1',
                wordWrap: { width: panelWidth - 48 },
                align: 'center',
                lineSpacing: 4
            }
        ).setOrigin(0, 0);

        const centerX = panelX + panelWidth / 2;
        const buttonWidth = Math.min(300, panelWidth - 64);
        const firstY = Math.min(panelY + panelHeight - 170, y + warning.height + 46);
        this.createButton(
            centerX,
            firstY,
            this.busy ? 'Deleting...' : 'Delete Cloud Data',
            () => this.deleteCloudCopy(),
            { disabled: this.busy, width: buttonWidth, color: 0x8A3548 }
        );
        this.createButton(
            centerX,
            firstY + 54,
            'Cancel',
            () => {
                this.confirmingDelete = false;
                this.render();
            },
            { disabled: this.busy, width: buttonWidth, color: 0x33485C }
        );
    }

    renderUnavailable(panelX, panelY, panelWidth, panelHeight, y) {
        this.addText(panelX + 24, y, 'Cloud Save is unavailable in this build. Local saving is still active.', {
            fontSize: '14px',
            color: '#FFD39C',
            wordWrap: { width: panelWidth - 48 },
            align: 'center'
        });
    }

    renderAgeRestricted(panelX, panelWidth, y, ageGroup) {
        const message = ['age_under_13', 'age_13_15'].includes(ageGroup)
            ? 'Cloud Save is unavailable for under-16 profiles in this release. Progress continues to save locally on this device.'
            : 'Complete the age confirmation before using Cloud Save. Local saving remains active.';
        this.addText(panelX + 24, y, message, {
            fontSize: '14px',
            color: '#FFD39C',
            wordWrap: { width: panelWidth - 48 },
            align: 'center',
            lineSpacing: 4
        });
    }

    async enableCloudSave() {
        if (!this.consentChecked || this.busy) return;
        await this.runAction(
            () => this.getManager().enable({ consentConfirmed: true }),
            'Cloud Save is on.',
            'Cloud Save could not connect. Your local save is safe.'
        );
    }

    async syncNow() {
        if (this.busy) return;
        await this.runAction(
            () => this.getManager().synchronize(),
            'Progress synced.',
            'Sync could not finish. Your local save is safe.'
        );
    }

    disableCloudSave() {
        if (this.busy) return;
        this.getManager()?.disable();
        this.consentChecked = false;
        this.notice = 'Cloud syncing is off. The existing cloud copy has not been deleted.';
        this.render();
    }

    async deleteCloudCopy() {
        if (this.busy) return;
        await this.runAction(
            async () => {
                await this.getManager().deleteCloudSave();
                this.getManager().disable();
                this.consentChecked = false;
                this.confirmingDelete = false;
            },
            'Cloud data deleted. Local progress remains on this device.',
            'Cloud data could not be deleted. No local progress was changed.'
        );
    }

    async runAction(action, successMessage, failureMessage) {
        this.busy = true;
        this.notice = '';
        this.render();
        try {
            const result = await action();
            if (result?.status === 'error') {
                this.notice = failureMessage;
            } else {
                this.notice = successMessage;
            }
        } catch (error) {
            console.warn('[CloudSaveSettings] Action failed:', error);
            this.notice = failureMessage;
        } finally {
            this.busy = false;
            this.render();
        }
    }

    getStatusInfo(status) {
        if (!status.configured) {
            return { label: 'Unavailable - local save active', color: '#FFD39C', background: 0x3C3022 };
        }
        if (this.busy || status.status === 'syncing' || status.status === 'connecting') {
            return { label: 'Connecting securely...', color: '#BFEAFF', background: 0x203846 };
        }
        if (status.status === 'error') {
            return { label: 'Needs attention - local save active', color: '#FFB3B3', background: 0x47272D };
        }
        if (!status.ageEligible || status.status === 'restricted') {
            return { label: 'Local save only', color: '#FFD39C', background: 0x3C3022 };
        }
        if (status.enabled) {
            return { label: 'On - progress synced', color: '#A9F1D5', background: 0x1F4137 };
        }
        return { label: 'Off - saving on this device', color: '#CFD7E2', background: 0x293442 };
    }

    getSummary(status) {
        if (!status.enabled) {
            return 'Cloud Save is optional. The game continues to save locally when it is off or the network is unavailable.';
        }
        if (status.lastSyncDirection === 'restored') {
            return 'Cloud progress was restored to this browser. Your local save is now the primary working copy.';
        }
        if (status.lastSyncDirection === 'uploaded') {
            return 'Your latest local progress is backed up privately in Cloud Save.';
        }
        return 'A private copy of your progress is linked to this browser. Your local save remains the primary copy.';
    }

    createButton(x, y, label, onClick, options = {}) {
        const width = options.width || 280;
        const height = 42;
        const disabled = Boolean(options.disabled);
        const color = options.color || 0x33485C;
        const bg = this.scene.add.graphics();
        bg.fillStyle(disabled ? 0x2B313A : color, 1);
        bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 6);
        bg.lineStyle(1, disabled ? 0x515A66 : 0x8FE3C4, disabled ? 0.5 : 0.85);
        bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 6);
        bg.setScrollFactor(0).setDepth(17502);
        this.elements.push(bg);

        const text = this.addText(x, y, label, {
            fontSize: '15px',
            color: disabled ? '#7D8794' : '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (!disabled) {
            const zone = this.scene.add.zone(x, y, width, height);
            zone.setScrollFactor(0).setDepth(17504);
            zone.setInteractive({ useHandCursor: true });
            zone.on('pointerdown', onClick);
            zone.on('pointerover', () => text.setColor('#BFF5E2'));
            zone.on('pointerout', () => text.setColor('#FFFFFF'));
            this.elements.push(zone);
        }
    }

    addText(x, y, text, style) {
        const element = this.scene.add.text(x, y, text, {
            fontFamily: 'Arial, sans-serif',
            ...style
        });
        element.setScrollFactor(0).setDepth(17503);
        this.elements.push(element);
        return element;
    }

    ensureUICamera(width, height) {
        if (this.uiCamera) {
            this.uiCamera.setViewport(0, 0, width, height);
            return;
        }

        const existingObjects = [...(this.scene.children?.list || [])];
        this.uiCamera = this.scene.cameras.add(0, 0, width, height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1);
        this.uiCamera.setRoundPixels(true);
        this.uiCamera.ignore(existingObjects);
    }

    destroyUICamera() {
        if (!this.uiCamera) return;
        this.scene.cameras.remove(this.uiCamera);
        this.uiCamera = null;
    }

    hide() {
        this.isVisible = false;
        this.clearElements();
        this.destroyUICamera();
    }

    clearElements() {
        this.elements.forEach((element) => element?.destroy?.());
        this.elements = [];
    }

    destroy() {
        this.hide();
    }
}

export default CloudSaveSettingsModal;

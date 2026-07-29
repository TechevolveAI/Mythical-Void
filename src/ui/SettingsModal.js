/**
 * Player-facing audio and feedback preferences.
 */
class SettingsModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.getAudioManager = options.getAudioManager
            || (() => window.AudioManager || null);
        this.getFeedbackManager = options.getFeedbackManager
            || (() => window.FeedbackManager || null);
        this.elements = [];
        this.isVisible = false;
        this.escapeHandler = null;
        this.pausedPhysics = false;
    }

    show() {
        this.isVisible = true;
        const world = this.scene.physics?.world;
        if (world && !world.isPaused) {
            this.scene.physics.pause();
            this.pausedPhysics = true;
        }
        this.render();
    }

    render() {
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
            this.escapeHandler = null;
        }
        this.clearElements();
        if (!this.isVisible) return;

        const audio = this.getAudioManager();
        const feedback = this.getFeedbackManager();
        const volumes = audio?.getVolumes?.() || {
            master: 1,
            music: 0.7,
            sfx: 0.8
        };
        const feedbackSettings = feedback?.getSettings?.() || {
            hapticEnabled: true,
            hapticSupported: false,
            screenShakeEnabled: true
        };
        const { width, height } = this.scene.cameras.main;
        const compact = width < 600;
        const panelWidth = Math.min(560, width - 24);
        const panelHeight = Math.min(650, height - 24);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const contentLeft = panelX + (compact ? 20 : 28);
        const contentWidth = panelWidth - (compact ? 40 : 56);

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x02070D, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(17700);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        overlay.on('pointerdown', () => this.hide());
        this.elements.push(overlay);

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0B141C, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x66C7D4, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(17701);
        this.elements.push(panel);

        const panelBlocker = this.scene.add.zone(
            panelX + panelWidth / 2,
            panelY + panelHeight / 2,
            panelWidth,
            panelHeight
        );
        panelBlocker.setScrollFactor(0).setDepth(17702);
        panelBlocker.setInteractive();
        this.elements.push(panelBlocker);

        this.addText(contentLeft, panelY + 24, 'SETTINGS', {
            fontSize: compact ? '18px' : '22px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        this.addText(contentLeft, panelY + 52, 'Changes save immediately on this device.', {
            fontSize: compact ? '11px' : '12px',
            color: '#93A6B2'
        });

        const close = this.addText(panelX + panelWidth - 24, panelY + 28, 'X', {
            fontSize: '17px',
            color: '#B8C7D1',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.hide());

        let y = panelY + 92;
        this.addSectionLabel(contentLeft, y, 'AUDIO');
        y += 31;
        this.createToggleRow(
            contentLeft,
            y,
            contentWidth,
            'Sound',
            !(audio?.isMuted?.() ?? audio?.muted ?? false),
            () => audio?.toggleMute?.()
        );
        y += 58;
        this.createVolumeRow(
            contentLeft,
            y,
            contentWidth,
            'Master',
            volumes.master,
            value => audio?.setMasterVolume?.(value)
        );
        y += 58;
        this.createVolumeRow(
            contentLeft,
            y,
            contentWidth,
            'Music',
            volumes.music,
            value => audio?.setMusicVolume?.(value)
        );
        y += 58;
        this.createVolumeRow(
            contentLeft,
            y,
            contentWidth,
            'Effects',
            volumes.sfx,
            value => audio?.setSFXVolume?.(value)
        );

        y += 72;
        this.addSectionLabel(contentLeft, y, 'FEEDBACK');
        y += 31;
        this.createToggleRow(
            contentLeft,
            y,
            contentWidth,
            'Screen shake',
            feedbackSettings.screenShakeEnabled,
            () => feedback?.toggleScreenShake?.()
        );
        y += 58;
        this.createToggleRow(
            contentLeft,
            y,
            contentWidth,
            feedbackSettings.hapticSupported ? 'Haptics' : 'Haptics unavailable',
            feedbackSettings.hapticEnabled && feedbackSettings.hapticSupported,
            () => feedback?.toggleHaptic?.(),
            { disabled: !feedbackSettings.hapticSupported }
        );

        this.addText(contentLeft, panelY + panelHeight - 46,
            'Local preferences are included when optional Cloud Save is enabled.', {
                fontSize: compact ? '10px' : '11px',
                color: '#71838E',
                wordWrap: { width: contentWidth },
                lineSpacing: 3
            });

        this.escapeHandler = () => this.hide();
        this.scene.input.keyboard?.once('keydown-ESC', this.escapeHandler);
    }

    createVolumeRow(x, y, width, label, rawValue, setValue) {
        const value = Math.max(0, Math.min(1, Number(rawValue) || 0));
        const percent = Math.round(value * 100);
        const buttonSize = 34;
        const plusX = x + width - buttonSize / 2;
        const minusX = plusX - 44;
        const barX = x + 92;
        const barWidth = Math.max(68, width - 198);

        this.addText(x, y + 5, label, {
            fontSize: '13px',
            color: '#DCE7EC',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.addText(x + 72, y + 5, `${percent}%`, {
            fontSize: '11px',
            color: '#8FE3CF'
        }).setOrigin(1, 0.5);

        const segments = 5;
        const gap = 4;
        const segmentWidth = (barWidth - gap * (segments - 1)) / segments;
        const activeSegments = Math.round(value * segments);
        const bar = this.scene.add.graphics();
        for (let index = 0; index < segments; index++) {
            bar.fillStyle(index < activeSegments ? 0x66C7D4 : 0x25343E, 1);
            bar.fillRoundedRect(
                barX + index * (segmentWidth + gap),
                y - 2,
                segmentWidth,
                14,
                2
            );
        }
        bar.setScrollFactor(0).setDepth(17702);
        this.elements.push(bar);

        this.createIconButton(minusX, y + 5, '-', () => {
            setValue(Math.max(0, Math.round((value - 0.1) * 10) / 10));
            this.render();
        }, value <= 0);
        this.createIconButton(plusX, y + 5, '+', () => {
            setValue(Math.min(1, Math.round((value + 0.1) * 10) / 10));
            this.render();
        }, value >= 1);
    }

    createToggleRow(x, y, width, label, enabled, onToggle, options = {}) {
        const disabled = Boolean(options.disabled);
        this.addText(x, y, label, {
            fontSize: '13px',
            color: disabled ? '#687984' : '#DCE7EC',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        const toggleWidth = 58;
        const toggleHeight = 30;
        const toggleX = x + width - toggleWidth;
        const toggle = this.scene.add.graphics();
        toggle.fillStyle(
            disabled ? 0x252E35 : enabled ? 0x287A72 : 0x33434E,
            1
        );
        toggle.fillRoundedRect(toggleX, y - toggleHeight / 2, toggleWidth, toggleHeight, 15);
        toggle.fillStyle(disabled ? 0x66727A : 0xF1F7F8, 1);
        toggle.fillCircle(
            enabled ? toggleX + toggleWidth - 15 : toggleX + 15,
            y,
            11
        );
        toggle.setScrollFactor(0).setDepth(17702);
        this.elements.push(toggle);

        this.addText(toggleX - 10, y, enabled ? 'ON' : 'OFF', {
            fontSize: '10px',
            color: disabled ? '#687984' : enabled ? '#8FE3CF' : '#82939E',
            fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        if (!disabled) {
            const zone = this.scene.add.zone(toggleX + toggleWidth / 2, y, toggleWidth + 12, 44);
            zone.setScrollFactor(0).setDepth(17704);
            zone.setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                onToggle();
                this.render();
            });
            this.elements.push(zone);
        }
    }

    createIconButton(x, y, label, onClick, disabled) {
        const size = 34;
        const bg = this.scene.add.graphics();
        bg.fillStyle(disabled ? 0x222B31 : 0x213E48, 1);
        bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 4);
        bg.lineStyle(1, disabled ? 0x414D55 : 0x66C7D4, 1);
        bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 4);
        bg.setScrollFactor(0).setDepth(17702);
        this.elements.push(bg);

        this.addText(x, y, label, {
            fontSize: '20px',
            color: disabled ? '#58656D' : '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (!disabled) {
            const zone = this.scene.add.zone(x, y, 44, 44);
            zone.setScrollFactor(0).setDepth(17704);
            zone.setInteractive({ useHandCursor: true });
            zone.on('pointerdown', onClick);
            this.elements.push(zone);
        }
    }

    addSectionLabel(x, y, text) {
        return this.addText(x, y, text, {
            fontSize: '10px',
            color: '#66C7D4',
            fontStyle: 'bold'
        });
    }

    addText(x, y, text, style = {}) {
        const element = this.scene.add.text(x, y, text, {
            fontFamily: 'Arial, sans-serif',
            letterSpacing: 0,
            ...style
        });
        element.setScrollFactor(0).setDepth(17703);
        this.elements.push(element);
        return element;
    }

    hide() {
        this.isVisible = false;
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
            this.escapeHandler = null;
        }
        this.clearElements();
        if (this.pausedPhysics) {
            this.scene.physics?.resume?.();
            this.pausedPhysics = false;
        }
    }

    clearElements() {
        this.elements.forEach(element => element?.destroy?.());
        this.elements = [];
    }

    destroy() {
        this.hide();
    }
}

export default SettingsModal;

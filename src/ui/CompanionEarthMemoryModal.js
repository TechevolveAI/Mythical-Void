export default class CompanionEarthMemoryModal {
    constructor(scene, {
        snapshotProvider,
        onShare,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onShare = onShare;
        this.onClose = onClose;
        this.elements = [];
        this.isVisible = false;
        this.mode = 'menu';
        this.lastResult = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.escapeHandler = null;
    }

    show(mode = 'menu') {
        const snapshot = this.snapshotProvider?.();
        if (!snapshot?.unlocked && mode !== 'shared') return false;
        if (!this.isVisible) {
            this.physicsWasPaused = Boolean(
                this.scene.physics?.world?.isPaused
            );
            if (!this.physicsWasPaused) this.scene.physics?.pause?.();
            this.restoreMobileControls =
                this.scene.mobileControls?.suspend?.() === true;
        }
        this.isVisible = true;
        this.mode = snapshot?.complete ? 'shared' : mode;
        this.render();
        return true;
    }

    render() {
        this.clearElements();
        if (!this.isVisible) return;

        const snapshot = this.snapshotProvider?.();
        if (!snapshot) {
            this.hide();
            return;
        }
        const camera = this.scene.cameras?.main;
        const width = camera?.width || this.scene.scale.width;
        const height = camera?.height || this.scene.scale.height;
        const compact = width < 620 || height < 690;
        const centerX = width / 2;
        const bandHeight = Math.min(compact ? 590 : 620, height - 16);
        const top = (height - bandHeight) / 2;
        const depth = 16950;
        const textWidth = Math.min(width - 36, 720);

        const overlay = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x02070D, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x0B1417, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, 0x66C7D4, 0.9);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        this.elements.push(overlay);

        const colorBar = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);
        [0xD94B4B, 0x101616, 0xF4F4F4, 0x3FAE62].forEach(
            (color, index) => {
                colorBar.fillStyle(color, 1);
                colorBar.fillRect(index * width / 4, top, width / 4, 5);
            }
        );
        this.elements.push(colorBar);

        const shield = this.scene.add.zone(
            centerX,
            top + bandHeight / 2,
            width,
            bandHeight
        ).setScrollFactor(0).setDepth(depth + 1).setInteractive();
        this.elements.push(shield);

        const addText = (y, value, style = {}) => {
            const text = this.scene.add.text(centerX, y, value, {
                fontFamily: 'Arial, sans-serif',
                align: 'center',
                wordWrap: { width: textWidth },
                color: '#EAF7F4',
                letterSpacing: 0,
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
            this.elements.push(text);
            return text;
        };

        addText(top + 28, 'WANDERER-77 // TWO WORLDS', {
            fontSize: compact ? '10px' : '12px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });

        if (snapshot.complete || this.mode === 'shared') {
            this.renderShared({
                snapshot,
                compact,
                width,
                top,
                bandHeight,
                depth,
                addText
            });
        } else {
            this.renderMenu({
                snapshot,
                compact,
                width,
                top,
                bandHeight,
                depth,
                addText
            });
        }

        const close = addText(top + 28, 'X', {
            fontSize: '16px',
            color: '#AFC3CF',
            fontStyle: 'bold'
        });
        close.setPosition(width - 22, top + 28);
        const closeZone = this.scene.add.zone(
            width - 22,
            top + 28,
            44,
            44
        ).setScrollFactor(0).setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        closeZone.on('pointerup', () => this.hide());
        this.elements.push(closeZone);

        this.escapeHandler = () => this.hide();
        this.scene.input.keyboard?.once('keydown-ESC', this.escapeHandler);
    }

    renderMenu({
        snapshot, compact, width, top, bandHeight, depth, addText
    }) {
        addText(top + 65, 'YOUR COMPANION ASKS ABOUT EARTH', {
            fontSize: compact ? '17px' : '23px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(
            top + (compact ? 104 : 110),
            '"You have shown me what threatens your world. Show me why it is worth saving."',
            {
                fontSize: compact ? '12px' : '15px',
                color: '#F4F4F4',
                fontStyle: 'italic',
                lineSpacing: 3
            }
        );

        const buttonWidth = Math.min(width - 30, 700);
        const listTop = top + (compact ? 139 : 151);
        const availableHeight = top + bandHeight - 36 - listTop;
        const rowGap = compact ? 6 : 8;
        const rowHeight = Math.min(
            compact ? 112 : 118,
            Math.max(82, Math.floor(
                (availableHeight - rowGap * 2) / 3
            ))
        );
        snapshot.memories.forEach((memory, index) => {
            const y = listTop + index * (rowHeight + rowGap);
            const button = this.createButton({
                x: width / 2,
                y,
                width: buttonWidth,
                height: rowHeight,
                depth: depth + 2,
                onPress: () => this.confirmMemory(memory.id)
            });
            const left = width / 2 - buttonWidth / 2 + 14;
            const title = this.scene.add.text(
                left,
                y + 11,
                `${memory.order}. ${memory.title}`,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '12px' : '14px',
                    color: '#F2C14E',
                    fontStyle: 'bold'
                }
            ).setScrollFactor(0).setDepth(depth + 4);
            const signal = this.scene.add.text(
                compact
                    ? left
                    : width / 2 + buttonWidth / 2 - 14,
                y + (compact ? 31 : 12),
                memory.signal,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '8px' : '10px',
                    color: '#8FE3CF',
                    fontStyle: 'bold'
                }
            ).setOrigin(compact ? 0 : 1, 0)
                .setScrollFactor(0)
                .setDepth(depth + 4);
            const invitation = this.scene.add.text(
                left,
                y + (compact ? 48 : 39),
                memory.invitation,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '10px' : '12px',
                    color: '#D8E4E0',
                    lineSpacing: 2,
                    wordWrap: { width: buttonWidth - 28 }
                }
            ).setScrollFactor(0).setDepth(depth + 4);
            this.elements.push(button, title, signal, invitation);
        });

        addText(top + bandHeight - 18, 'LOCAL MEMORY // NO INVITATION // NO TRANSMISSION', {
            fontSize: '9px',
            color: '#AFC3CF',
            fontStyle: 'bold'
        });
    }

    renderShared({
        snapshot, compact, width, top, bandHeight, depth, addText
    }) {
        const memory = snapshot.selectedMemory || this.lastResult?.memory;
        if (!memory) return;
        addText(top + 70, memory.title, {
            fontSize: compact ? '19px' : '25px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(top + 101, memory.signal, {
            fontSize: compact ? '9px' : '11px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 174 : 184), memory.memory, {
            fontSize: compact ? '12px' : '15px',
            color: '#EAF7F4',
            lineSpacing: 5
        });
        addText(top + (compact ? 286 : 310), 'YOUR COMPANION', {
            fontSize: compact ? '9px' : '11px',
            color: '#D94B4B',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 345 : 376), `"${memory.response}"`, {
            fontSize: compact ? '14px' : '18px',
            color: '#F4F4F4',
            fontStyle: 'italic',
            lineSpacing: 5
        });
        addText(
            top + bandHeight - 123,
            'CURIOSITY RECORDED // TRAVEL REMAINS UNDISCUSSED',
            {
                fontSize: compact ? '9px' : '10px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        this.createActionButton({
            y: top + bandHeight - 88,
            label: 'RETURN TO THE FEND',
            width,
            depth,
            onPress: () => this.hide()
        });
    }

    confirmMemory(memoryId) {
        const result = this.onShare?.(memoryId);
        if (!result?.changed) return;
        this.lastResult = result;
        this.show('shared');
    }

    createActionButton({ y, label, width, depth, onPress }) {
        const buttonWidth = Math.min(width - 36, 430);
        const button = this.createButton({
            x: width / 2,
            y,
            width: buttonWidth,
            height: 54,
            depth: depth + 2,
            fill: 0x1C6A47,
            accent: 0x3FAE62,
            onPress
        });
        const text = this.scene.add.text(width / 2, y + 27, label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4);
        this.elements.push(button, text);
    }

    createButton({
        x, y, width, height, depth, onPress,
        fill = 0x0E2020,
        accent = 0x66C7D4
    }) {
        const button = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth);
        button.fillStyle(fill, 1);
        button.fillRoundedRect(x - width / 2, y, width, height, 6);
        button.lineStyle(2, accent, 0.95);
        button.strokeRoundedRect(x - width / 2, y, width, height, 6);
        const hitZone = this.scene.add.zone(
            x,
            y + height / 2,
            width,
            height
        ).setScrollFactor(0).setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        hitZone.on('pointerover', () => button.setAlpha(0.82));
        hitZone.on('pointerout', () => button.setAlpha(1));
        hitZone.on('pointerup', onPress);
        this.elements.push(hitZone);
        return button;
    }

    clearElements() {
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off(
                'keydown-ESC',
                this.escapeHandler
            );
            this.escapeHandler = null;
        }
        this.elements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.elements = [];
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;
        this.clearElements();
        if (!this.physicsWasPaused) this.scene.physics?.resume?.();
        if (this.restoreMobileControls) this.scene.mobileControls?.resume?.();
        this.onClose?.();
    }

    destroy() {
        this.hide();
        this.onClose = null;
        this.onShare = null;
        this.snapshotProvider = null;
    }
}

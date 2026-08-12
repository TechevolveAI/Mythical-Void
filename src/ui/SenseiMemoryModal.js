export default class SenseiMemoryModal {
    constructor(scene, {
        snapshotProvider,
        onRecall,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onRecall = onRecall;
        this.onClose = onClose;
        this.elements = [];
        this.isVisible = false;
        this.mode = 'memory';
        this.activeMemory = null;
        this.lastResult = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.escapeHandler = null;
    }

    show(memoryId = null, mode = 'memory') {
        const snapshot = this.snapshotProvider?.();
        const memory = memoryId
            ? snapshot?.memories?.find(entry => entry.id === memoryId)
            : snapshot?.nextMemory;
        if (!memory && mode !== 'confirmed') return false;
        if (!this.isVisible) {
            this.physicsWasPaused = Boolean(
                this.scene.physics?.world?.isPaused
            );
            if (!this.physicsWasPaused) this.scene.physics?.pause?.();
            this.restoreMobileControls =
                this.scene.mobileControls?.suspend?.() === true;
        }
        this.isVisible = true;
        this.mode = mode;
        this.activeMemory = memory || this.lastResult?.memory || null;
        this.render();
        return true;
    }

    render() {
        this.clearElements();
        if (!this.isVisible || !this.activeMemory) return;

        const camera = this.scene.cameras?.main;
        const width = camera?.width || this.scene.scale.width;
        const height = camera?.height || this.scene.scale.height;
        const compact = width < 620 || height < 690;
        const centerX = width / 2;
        const bandHeight = Math.min(compact ? 590 : 570, height - 24);
        const top = (height - bandHeight) / 2;
        const depth = 16900;
        const textWidth = Math.min(width - 38, 700);

        const overlay = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x030609, 0.96);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x0B1112, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, 0xF4F4F4, 0.65);
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
                ...style
            }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
            this.elements.push(text);
            return text;
        };

        const snapshot = this.snapshotProvider?.();
        addText(top + 28, 'WANDERER-77 // PERSONAL MEMORY', {
            fontSize: compact ? '10px' : '12px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });

        if (this.mode === 'confirmed') {
            this.renderConfirmed({
                snapshot,
                compact,
                width,
                top,
                bandHeight,
                depth,
                addText
            });
        } else {
            this.renderMemory({
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

    renderMemory({
        snapshot, compact, width, top, bandHeight, depth, addText
    }) {
        const memory = this.activeMemory;
        addText(
            top + 64,
            `MEMORY ${memory.order} OF ${snapshot.totalMemories}`,
            {
                fontSize: compact ? '10px' : '11px',
                color: '#AFC3CF',
                fontStyle: 'bold'
            }
        );
        addText(top + 98, memory.title, {
            fontSize: compact ? '20px' : '26px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(top + 129, memory.setting, {
            fontSize: compact ? '9px' : '11px',
            color: '#D94B4B',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 185 : 192), memory.memory, {
            fontSize: compact ? '12px' : '14px',
            color: '#DCE8ED',
            lineSpacing: 5
        });
        addText(top + (compact ? 260 : 270), memory.quote, {
            fontSize: compact ? '15px' : '18px',
            color: '#F4F4F4',
            fontStyle: 'italic',
            lineSpacing: 5
        });
        addText(top + (compact ? 328 : 346), 'WHY IT MATTERS NOW', {
            fontSize: compact ? '10px' : '11px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 374 : 392), memory.relevance, {
            fontSize: compact ? '12px' : '14px',
            color: '#BFD8D2',
            lineSpacing: 4
        });
        if (memory.lessonId === 'centering_stance') {
            addText(
                top + (compact ? 442 : 458),
                'FIELD PRACTICE // AFTER A HIT, RELEASE MOVEMENT ON SOLID GROUND',
                {
                    fontSize: compact ? '9px' : '10px',
                    color: '#F2C14E',
                    fontStyle: 'bold'
                }
            );
        }

        this.createActionButton({
            y: top + bandHeight - 76,
            label: memory.lessonId
                ? 'KEEP MEMORY + UNLOCK STANCE'
                : 'KEEP THIS MEMORY',
            width,
            depth,
            onPress: () => this.confirmMemory()
        });
    }

    renderConfirmed({
        snapshot, compact, width, top, bandHeight, depth, addText
    }) {
        const memory = this.activeMemory;
        addText(top + 92, 'MEMORY HELD', {
            fontSize: compact ? '21px' : '27px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(top + 148, memory.title, {
            fontSize: compact ? '17px' : '21px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 225 : 238), memory.quote, {
            fontSize: compact ? '15px' : '18px',
            color: '#F4F4F4',
            fontStyle: 'italic',
            lineSpacing: 6
        });

        const consequence = memory.lessonId === 'centering_stance'
            ? 'CENTERING STANCE AVAILABLE\nOnce per expedition, becoming still after a non-lethal hit reseals one integrity heart.'
            : snapshot.complete
                ? 'PERSONAL ARCHIVE COMPLETE\nThese memories can authenticate the future DOJO-23-77 channel. No contact has been attempted.'
                : `PERSONAL ARCHIVE ${snapshot.recalledCount}/${snapshot.totalMemories}\nFurther memories return through field experience.`;
        addText(top + (compact ? 344 : 360), consequence, {
            fontSize: compact ? '12px' : '14px',
            color: '#BFD8D2',
            fontStyle: 'bold',
            lineSpacing: 6
        });

        this.createActionButton({
            y: top + bandHeight - 76,
            label: 'RETURN TO THE FEND',
            width,
            depth,
            onPress: () => this.hide()
        });
    }

    confirmMemory() {
        const result = this.onRecall?.(this.activeMemory.id);
        if (!result?.changed) return;
        this.lastResult = result;
        this.activeMemory = result.memory;
        this.mode = 'confirmed';
        this.render();
    }

    createActionButton({ y, label, width, depth, onPress }) {
        const buttonWidth = Math.min(width - 36, 440);
        const buttonHeight = 54;
        const left = width / 2 - buttonWidth / 2;
        const button = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 2);
        button.fillStyle(0x1C6A47, 1);
        button.fillRoundedRect(left, y, buttonWidth, buttonHeight, 6);
        button.lineStyle(2, 0x3FAE62, 1);
        button.strokeRoundedRect(left, y, buttonWidth, buttonHeight, 6);
        const labelText = this.scene.add.text(
            width / 2,
            y + buttonHeight / 2,
            label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: width < 620 ? '11px' : '13px',
                color: '#FFFFFF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4);
        const zone = this.scene.add.zone(
            width / 2,
            y + buttonHeight / 2,
            buttonWidth,
            buttonHeight
        ).setScrollFactor(0).setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => button.setAlpha(0.82));
        zone.on('pointerout', () => button.setAlpha(1));
        zone.on('pointerup', onPress);
        this.elements.push(button, labelText, zone);
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
        this.onRecall = null;
        this.snapshotProvider = null;
    }
}

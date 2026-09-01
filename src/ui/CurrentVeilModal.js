const STATUS_COLORS = Object.freeze({
    stabilized: '#71E6B1',
    ready: '#F2C14E',
    locked: '#82939C'
});

export default class CurrentVeilModal {
    constructor(scene, {
        snapshotProvider,
        onStart = null,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onStart = onStart;
        this.onClose = onClose;
        this.elements = [];
        this.isVisible = false;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.escapeHandler = null;
    }

    show() {
        const snapshot = this.snapshotProvider?.();
        if (!snapshot?.prerequisitesMet) return false;
        if (!this.isVisible) {
            this.physicsWasPaused = Boolean(
                this.scene.physics?.world?.isPaused
            );
            if (!this.physicsWasPaused) this.scene.physics?.pause?.();
            this.restoreMobileControls =
                this.scene.mobileControls?.suspend?.() === true;
        }
        this.isVisible = true;
        this.render();
        return true;
    }

    render() {
        this.clearElements();
        if (!this.isVisible) return;
        const snapshot = this.snapshotProvider?.();
        if (!snapshot?.prerequisitesMet) return;

        const camera = this.scene.cameras?.main;
        const width = camera?.width || this.scene.scale.width;
        const height = camera?.height || this.scene.scale.height;
        const compact = width < 620 || height < 700;
        const centerX = width / 2;
        const bandHeight = Math.min(
            compact ? 680 : 650,
            height - 16
        );
        const top = (height - bandHeight) / 2;
        const depth = 17100;
        const contentLeft = compact ? 18 : Math.max(40, width * 0.14);
        const contentRight = width - contentLeft;
        const contentWidth = contentRight - contentLeft;

        const overlay = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020607, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x0C1416, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, 0x8FE3CF, 0.65);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        this.elements.push(overlay);

        const livery = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);
        [0xD94B4B, 0x101616, 0xF4F4F4, 0x3FAE62].forEach(
            (color, index) => {
                livery.fillStyle(color, 1);
                livery.fillRect(index * width / 4, top, width / 4, 5);
            }
        );
        this.elements.push(livery);

        const shield = this.scene.add.zone(
            centerX,
            top + bandHeight / 2,
            width,
            bandHeight
        ).setScrollFactor(0).setDepth(depth + 1).setInteractive();
        this.elements.push(shield);

        const addText = (x, y, value, style = {}) => {
            const text = this.scene.add.text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                color: '#EAF7F4',
                ...style
            }).setScrollFactor(0).setDepth(depth + 3);
            this.elements.push(text);
            return text;
        };

        addText(
            contentLeft,
            top + 24,
            'FEND CONSEQUENCE // QUIET CURRENT',
            {
                fontSize: compact ? '10px' : '12px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        addText(
            contentRight - 30,
            top + 24,
            'NOTHING SENT TO EARTH',
            {
                fontSize: compact ? '9px' : '11px',
                color: '#EF767A',
                fontStyle: 'bold'
            }
        ).setOrigin(1, 0);

        const title = snapshot.complete
            ? 'ROUTE INFERENCE BLOCKED'
            : snapshot.verificationReady
                ? 'THE LIVING MASK IS READY'
                : snapshot.active
                    ? 'BUILD THE LIVING MASK'
                    : 'A ROUTE WITHOUT COORDINATES';
        const summary = snapshot.complete
            ? 'Wanderer-77 can still prove the crash and survival. The packet can no longer be used to rebuild a path into the Fend.'
            : snapshot.verificationReady
                ? 'All three anchors answer as one network. Return to Wanderer-77 to test the packet against the living mask.'
                : snapshot.active
                    ? 'Your companion can hear where the ship timing still matches the Current. Stabilize each echo without silencing the Fend.'
                    : 'Ilyra found a risk inside the sealed packet: black-box timing contains a Current rhythm. A skilled receiver could infer a route even without coordinates.';
        addText(contentLeft, top + 70, title, {
            fontSize: compact ? '19px' : '25px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(contentLeft, top + 108, summary, {
            fontSize: compact ? '11px' : '14px',
            color: '#C7DBD7',
            wordWrap: { width: contentWidth },
            lineSpacing: 4
        });

        const rowsStart = top + (compact ? 204 : 198);
        const rowHeight = compact ? 104 : 106;
        snapshot.anchors.forEach((anchor, index) => {
            const y = rowsStart + index * rowHeight;
            const divider = this.scene.add.graphics()
                .setScrollFactor(0)
                .setDepth(depth + 2);
            divider.lineStyle(1, 0x314247, 0.9);
            divider.lineBetween(
                contentLeft,
                y - 10,
                contentRight,
                y - 10
            );
            this.elements.push(divider);
            addText(
                contentLeft,
                y,
                `${anchor.order}. ${anchor.title}`,
                {
                    fontSize: compact ? '10px' : '12px',
                    color: '#EAF7F4',
                    fontStyle: 'bold'
                }
            );
            addText(
                contentRight,
                y,
                anchor.status.toUpperCase(),
                {
                    fontSize: compact ? '8px' : '10px',
                    color:
                        STATUS_COLORS[anchor.status] ||
                        STATUS_COLORS.locked,
                    fontStyle: 'bold'
                }
            ).setOrigin(1, 0);
            addText(
                contentLeft,
                y + 23,
                anchor.stabilized
                    ? anchor.stabilizedSummary
                    : anchor.summary,
                {
                    fontSize: compact ? '9px' : '11px',
                    color: '#AFC3CF',
                    wordWrap: { width: contentWidth },
                    lineSpacing: 2
                }
            );
        });

        addText(
            contentLeft,
            top + bandHeight - 91,
            `ANCHORS ${snapshot.stabilizedCount}/${snapshot.totalAnchors}  //  ` +
                `${snapshot.packet.survivalProofStatus.toUpperCase()} PROOF  //  ` +
                'NO TRANSMISSION',
            {
                fontSize: compact ? '9px' : '11px',
                color: '#AFC3CF',
                fontStyle: 'bold'
            }
        );

        const buttonLabel = snapshot.available
            ? 'BEGIN QUIET CURRENT'
            : snapshot.verificationReady
                ? 'RETURN TO WANDERER-77'
                : snapshot.complete
                    ? 'RETURN TO THE FEND'
                    : 'CONTINUE FIELD WORK';
        this.createActionButton({
            y: top + bandHeight - 64,
            label: buttonLabel,
            width,
            depth,
            onPress: () => {
                if (snapshot.available) {
                    const result = this.onStart?.();
                    if (result?.changed) {
                        this.render();
                    }
                    return;
                }
                this.hide();
            }
        });

        const close = addText(width - 22, top + 20, 'X', {
            fontSize: '16px',
            color: '#AFC3CF',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        const closeZone = this.scene.add.zone(
            width - 22,
            top + 28,
            44,
            44
        ).setScrollFactor(0).setDepth(depth + 6)
            .setInteractive({ useHandCursor: true });
        closeZone.on('pointerup', () => this.hide());
        this.elements.push(closeZone);

        this.escapeHandler = () => this.hide();
        this.scene.input.keyboard?.once(
            'keydown-ESC',
            this.escapeHandler
        );
    }

    createActionButton({ y, label, width, depth, onPress }) {
        const buttonWidth = Math.min(width - 36, 440);
        const buttonHeight = 50;
        const left = width / 2 - buttonWidth / 2;
        const button = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 2);
        button.fillStyle(0x1C6A47, 1);
        button.fillRoundedRect(
            left,
            y,
            buttonWidth,
            buttonHeight,
            6
        );
        button.lineStyle(2, 0x71E6B1, 1);
        button.strokeRoundedRect(
            left,
            y,
            buttonWidth,
            buttonHeight,
            6
        );
        const labelText = this.scene.add.text(
            width / 2,
            y + buttonHeight / 2,
            label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: width < 620 ? '10px' : '12px',
                color: '#FFFFFF',
                fontStyle: 'bold'
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
        if (this.restoreMobileControls) {
            this.scene.mobileControls?.resume?.();
        }
        this.onClose?.();
    }

    destroy() {
        this.hide();
        this.snapshotProvider = null;
        this.onStart = null;
        this.onClose = null;
    }
}

export default class CompanionConsentModal {
    constructor(scene, {
        snapshotProvider,
        onReview,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onReview = onReview;
        this.onClose = onClose;
        this.elements = [];
        this.isVisible = false;
        this.mode = 'menu';
        this.activeTopic = null;
        this.lastResult = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.escapeHandler = null;
    }

    show(mode = 'menu', topicId = null) {
        if (this.isVisible && mode === this.mode && topicId === this.activeTopic?.id) {
            return false;
        }
        if (!this.isVisible) {
            this.physicsWasPaused = Boolean(this.scene.physics?.world?.isPaused);
            if (!this.physicsWasPaused) this.scene.physics?.pause?.();
            this.restoreMobileControls =
                this.scene.mobileControls?.suspend?.() === true;
        }
        this.isVisible = true;
        this.mode = mode;
        const snapshot = this.snapshotProvider?.();
        this.activeTopic = topicId
            ? snapshot?.topics?.find(topic => topic.id === topicId) || null
            : null;
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
        const { width, height } = this.scene.scale;
        const compact = width < 620 || height < 690;
        const centerX = width / 2;
        const centerY = height / 2;
        const bandHeight = Math.min(
            this.mode === 'menu' ? (compact ? 590 : 610) : (compact ? 500 : 530),
            height - 24
        );
        const top = centerY - bandHeight / 2;
        const depth = 16800;

        const overlay = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x02070D, 0.96);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x0A151B, 1);
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
            centerY,
            width,
            bandHeight
        ).setScrollFactor(0).setDepth(depth + 1).setInteractive();
        this.elements.push(shield);

        const textWidth = Math.min(width - 36, 720);
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

        addText(top + 29, 'WANDERER-77 // EARTH BOUNDARY REVIEW', {
            fontSize: compact ? '11px' : '13px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });

        if (this.mode === 'topic' && this.activeTopic) {
            this.renderTopic({
                snapshot,
                topic: this.activeTopic,
                compact,
                width,
                top,
                bandHeight,
                depth,
                addText
            });
        } else if (
            this.mode === 'recorded' &&
            this.lastResult?.topic
        ) {
            this.renderRecorded({
                snapshot,
                topic: this.lastResult.topic,
                compact,
                width,
                top,
                bandHeight,
                depth,
                addText
            });
        } else if (snapshot.complete || this.mode === 'complete') {
            this.renderComplete({
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
        addText(top + 66, 'BEFORE EARTH, SET THE BOUNDARIES', {
            fontSize: compact ? '18px' : '23px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(
            top + 110,
            'You explain the risks. Your companion decides what may be revealed and when power may be used.',
            {
                fontSize: compact ? '12px' : '14px',
                color: '#BFD8D2',
                lineSpacing: 4
            }
        );

        const buttonWidth = Math.min(width - 32, 690);
        const rowHeight = compact ? 92 : 98;
        const startY = top + (compact ? 160 : 170);
        snapshot.topics.forEach((topic, index) => {
            const y = startY + index * (rowHeight + 8);
            const status = topic.reviewed ? 'BOUNDARY SET' : 'EXPLAIN RISK';
            const button = this.createButton({
                x: width / 2,
                y,
                width: buttonWidth,
                height: rowHeight,
                depth: depth + 2,
                accent: topic.reviewed ? 0x3FAE62 : 0x66C7D4,
                onPress: () => this.show('topic', topic.id)
            });
            const title = this.scene.add.text(
                width / 2 - buttonWidth / 2 + 16,
                y + 13,
                `${topic.label} // ${status}`,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '13px' : '15px',
                    color: topic.reviewed ? '#8FE3CF' : '#F2C14E',
                    fontStyle: 'bold'
                }
            ).setScrollFactor(0).setDepth(depth + 4);
            const risk = this.scene.add.text(
                width / 2 - buttonWidth / 2 + 16,
                y + 39,
                topic.risk,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '10px' : '12px',
                    color: '#D8E4E0',
                    lineSpacing: 2,
                    wordWrap: { width: buttonWidth - 32 }
                }
            ).setScrollFactor(0).setDepth(depth + 4);
            this.elements.push(button, title, risk);
        });

        addText(
            top + bandHeight - 24,
            'TRAVEL IS NOT BEING DECIDED HERE',
            {
                fontSize: '10px',
                color: '#AFC3CF',
                fontStyle: 'bold'
            }
        );
    }

    renderTopic({
        topic, compact, width, top, bandHeight, depth, addText
    }) {
        addText(top + 70, topic.label, {
            fontSize: compact ? '20px' : '25px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 128 : 138), topic.risk, {
            fontSize: compact ? '13px' : '16px',
            color: '#F4F4F4',
            lineSpacing: 5
        });
        addText(top + (compact ? 205 : 224), topic.question, {
            fontSize: compact ? '12px' : '14px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            lineSpacing: 4
        });
        addText(top + (compact ? 278 : 304), `"${topic.boundary}"`, {
            fontSize: compact ? '15px' : '18px',
            color: '#EAF7F4',
            fontStyle: 'italic',
            lineSpacing: 5
        });

        const reviewed = this.snapshotProvider?.()?.record
            ?.reviewedTopicIds?.includes(topic.id);
        this.createActionButton({
            y: top + bandHeight - 94,
            label: reviewed ? 'BOUNDARY ALREADY RECORDED' : 'RECORD THIS BOUNDARY',
            width,
            depth,
            enabled: !reviewed,
            onPress: () => this.confirmTopic(topic.id)
        });
        const back = addText(top + bandHeight - 24, 'BACK TO ALL BOUNDARIES', {
            fontSize: '10px',
            color: '#AFC3CF'
        });
        const backZone = this.scene.add.zone(
            width / 2,
            top + bandHeight - 22,
            Math.max(190, back.width + 24),
            40
        ).setScrollFactor(0).setDepth(depth + 5)
            .setInteractive({ useHandCursor: true });
        backZone.on('pointerup', () => this.show('menu'));
        this.elements.push(backZone);
    }

    renderRecorded({
        snapshot, topic, compact, width, top, bandHeight, depth, addText
    }) {
        addText(top + 72, `${topic.shortLabel} // BOUNDARY SET`, {
            fontSize: compact ? '18px' : '23px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(top + (compact ? 150 : 166), `"${topic.boundary}"`, {
            fontSize: compact ? '15px' : '19px',
            color: '#F4F4F4',
            fontStyle: 'italic',
            lineSpacing: 6
        });
        addText(
            top + (compact ? 250 : 278),
            topic.id === 'evidence'
                ? 'Wanderer-77 may prove the astronaut survived. The companion and Fend remain undisclosed.'
                : topic.id === 'route'
                    ? 'The return vector stays sealed. No Fend coordinates enter an Earth record.'
                    : "Restraint protects secrecy. Saving a life remains the companion's choice.",
            {
                fontSize: compact ? '12px' : '14px',
                color: '#BFD8D2',
                lineSpacing: 4
            }
        );

        this.createActionButton({
            y: top + bandHeight - 94,
            label: snapshot.complete
                ? 'COMPLETE THE REVIEW'
                : 'REVIEW NEXT BOUNDARY',
            width,
            depth,
            onPress: () => this.show(
                snapshot.complete ? 'complete' : 'menu'
            )
        });
    }

    renderComplete({
        compact, width, top, bandHeight, depth, addText
    }) {
        addText(top + 75, 'BOUNDARIES RECORDED', {
            fontSize: compact ? '20px' : '26px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(
            top + (compact ? 145 : 160),
            "Earth may learn that the astronaut survived. The Fend's coordinates and the companion's existence remain protected.",
            {
                fontSize: compact ? '13px' : '16px',
                color: '#F4F4F4',
                lineSpacing: 5
            }
        );
        addText(
            top + (compact ? 250 : 278),
            '"A safe seat is not an invitation. When the ship can protect a willing passenger, then you may ask."',
            {
                fontSize: compact ? '15px' : '18px',
                color: '#F2C14E',
                fontStyle: 'italic',
                lineSpacing: 6
            }
        );
        addText(
            top + (compact ? 350 : 388),
            "TRAVEL REMAINS YOUR COMPANION'S FUTURE CHOICE",
            {
                fontSize: compact ? '10px' : '12px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );
        this.createActionButton({
            y: top + bandHeight - 94,
            label: 'RETURN TO THE FEND',
            width,
            depth,
            onPress: () => this.hide()
        });
    }

    confirmTopic(topicId) {
        const result = this.onReview?.(topicId);
        if (!result?.topic) return;
        this.lastResult = result;
        this.show('recorded', topicId);
    }

    createActionButton({
        y, label, width, depth, onPress, enabled = true
    }) {
        const buttonWidth = Math.min(width - 36, 430);
        const button = this.createButton({
            x: width / 2,
            y,
            width: buttonWidth,
            height: 54,
            depth: depth + 2,
            accent: enabled ? 0x3FAE62 : 0x526A66,
            fill: enabled ? 0x1C6A47 : 0x23302E,
            onPress: enabled ? onPress : null
        });
        const text = this.scene.add.text(width / 2, y + 27, label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: enabled ? '#FFFFFF' : '#AFC3CF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4);
        this.elements.push(button, text);
    }

    createButton({
        x, y, width, height, depth, accent, fill = 0x0E2020, onPress
    }) {
        const button = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth);
        button.fillStyle(fill, 1);
        button.fillRoundedRect(x - width / 2, y, width, height, 6);
        button.lineStyle(2, accent, 0.95);
        button.strokeRoundedRect(x - width / 2, y, width, height, 6);
        if (onPress) {
            const hitZone = this.scene.add.zone(
                x,
                y + height / 2,
                width,
                height
            ).setScrollFactor(0).setDepth(depth + 1)
                .setInteractive({ useHandCursor: true });
            hitZone.on('pointerover', () => button.setAlpha(0.82));
            hitZone.on('pointerout', () => button.setAlpha(1));
            hitZone.on('pointerup', onPress);
            this.elements.push(hitZone);
        }
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
        this.elements.forEach(element => element?.destroy?.());
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
        this.onReview = null;
        this.snapshotProvider = null;
    }
}

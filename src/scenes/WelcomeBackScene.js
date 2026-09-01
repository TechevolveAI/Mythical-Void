/**
 * WelcomeBackScene - Shows summary of creature activities while player was offline
 *
 * Displays:
 * - How long the player was away
 * - Notable events and discoveries
 * - Creature interactions and relationships formed
 * - Resource collections
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

class WelcomeBackScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WelcomeBackScene' });

        this.events = [];
        this.offlineMinutes = 0;
        this.elements = [];
        this.currentEventIndex = 0;
        this.returnPortraitPreview = false;
        this.returnPortraitRequest = 0;
    }

    init(data) {
        this.events = data?.events || [];
        this.offlineMinutes = data?.offlineMinutes || 0;
        this.returnScene = data?.returnScene || 'GameScene';
        this.returnPortraitPreview = data?.returnPortraitPreview === true;
    }

    create() {
        console.log('[WelcomeBackScene] Creating welcome back screen...');
        console.log(`[WelcomeBackScene] ${this.events.length} events to display`);

        const { width, height } = this.scale;

        // Background with stars
        this.createBackground(width, height);

        // Main panel
        this.createPanel(width, height);

        // Title
        this.createTitle(width, height);

        // Re-establish the returning player's bond before listing system events.
        this.createCompanionReturnIdentity(width);

        // Events list
        this.createEventsList(width, height);

        // Continue button
        this.createContinueButton(width, height);

        // Play ambient sound
        window.AudioManager?.playAchievement?.();

        // Animate stars
        this.animateStars();

        console.log('[WelcomeBackScene] Scene created');
    }

    createBackground(width, height) {
        // Dark cosmic background
        const bg = this.add.graphics();
        bg.fillStyle(0x050214, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Gradient overlay
        const gradient = this.add.graphics();
        gradient.fillGradientStyle(0x1A0A3E, 0x1A0A3E, 0x050214, 0x050214, 0.8);
        gradient.fillRect(0, 0, width, height / 2);
        gradient.setDepth(1);
        this.elements.push(gradient);

        // Twinkling stars
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.8);

            const star = this.add.graphics();
            star.fillStyle(0xFFFFFF, alpha);
            star.fillCircle(x, y, size);
            star.setDepth(2);

            star.baseAlpha = alpha;
            this.stars.push(star);
            this.elements.push(star);
        }

        // Floating particle effect
        if (window.FXLibrary?.ambientSparkles) {
            window.FXLibrary.ambientSparkles(this, width / 2, height / 2, {
                count: 10,
                area: { width: width * 0.8, height: height * 0.6 },
                duration: 5000
            });
        }
    }

    animateStars() {
        this.stars.forEach((star, idx) => {
            this.tweens.add({
                targets: star,
                alpha: { from: star.baseAlpha * 0.3, to: star.baseAlpha },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                delay: idx * 50,
                ease: 'Sine.easeInOut'
            });
        });
    }

    createPanel(width, height) {
        const panelWidth = Math.min(380, width - 40);
        const panelHeight = Math.min(500, height - 80);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

        // Border glow
        panel.lineStyle(3, 0x9370DB, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

        // Inner accent
        panel.lineStyle(1, 0xFFD700, 0.3);
        panel.strokeRoundedRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 18);

        panel.setDepth(100);
        this.elements.push(panel);

        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
    }

    createTitle(width, height) {
        const centerX = width / 2;
        const titleY = this.panelBounds.y + 35;

        const title = this.add.text(centerX, titleY, 'SANCTUARY FIELD REPORT', {
            fontSize: '23px',
            color: '#8FE3CF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(101);

        // Animate title
        this.tweens.add({
            targets: title,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut'
        });

        this.elements.push(title);

        // Time away display
        const timeAway = this.formatTimeAway(this.offlineMinutes);
        const subtitle = this.add.text(centerX, titleY + 35, `${timeAway} since last field check`, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(101);

        this.tweens.add({
            targets: subtitle,
            alpha: { from: 0, to: 1 },
            duration: 500,
            delay: 200
        });

        this.elements.push(subtitle);

    }

    createEventsList(width, height) {
        const startY = this.panelBounds.y + 172;
        const listHeight = this.panelBounds.height - 242;
        const eventHeight = 60;
        const maxVisible = Math.floor(listHeight / eventHeight);

        // Events to display
        const displayEvents = this.events.slice(0, maxVisible);

        if (displayEvents.length === 0) {
            // No events message
            const noEvents = this.add.text(width / 2, startY + listHeight / 2, 'No urgent changes were recorded.', {
                fontSize: '14px',
                color: '#888888',
                fontStyle: 'italic'
            }).setOrigin(0.5).setDepth(101);
            this.elements.push(noEvents);
            return;
        }

        displayEvents.forEach((event, idx) => {
            const y = startY + (idx * eventHeight);
            this.createEventCard(event, this.panelBounds.x + 15, y, this.panelBounds.width - 30, eventHeight - 5, idx);
        });

        // Show count if more events
        if (this.events.length > maxVisible) {
            const moreText = this.add.text(
                width / 2,
                startY + listHeight - 10,
                `+ ${this.events.length - maxVisible} more activities`,
                {
                    fontSize: '11px',
                    color: '#666666'
                }
            ).setOrigin(0.5).setDepth(101);
            this.elements.push(moreText);
        }
    }

    getReturnCompanion() {
        if (this.returnPortraitPreview) {
            return {
                name: 'Nova',
                stage: 'baby',
                record: {
                    identityKey: 'preview_companion_23:baby:portrait',
                    stage: 'baby',
                    imageUrl: '/marketing/nova.webp',
                    assetRef: null,
                    storage: 'preview'
                }
            };
        }

        const stage = window.GameState?.get('creature.lifecycle.stage') || 'baby';
        const name = window.GameState?.get('creature.name') ||
            this.events.find(event => event?.creatureName)?.creatureName ||
            'Your companion';

        return {
            name,
            stage,
            record: window.GameState?.getCreaturePortrait?.(stage) || null
        };
    }

    createCompanionReturnIdentity(width) {
        const companion = this.getReturnCompanion();
        const left = this.panelBounds.x + 18;
        const top = this.panelBounds.y + 92;
        const portraitSize = 58;
        const portraitX = left + portraitSize / 2;
        const portraitY = top + portraitSize / 2;
        const copyX = left + portraitSize + 14;
        const copyWidth = this.panelBounds.width - portraitSize - 68;

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x8FE3CF, 0.35);
        divider.lineBetween(left, top + 66, left + this.panelBounds.width - 36, top + 66);
        divider.setDepth(101);
        this.elements.push(divider);

        const name = this.add.text(copyX, top + 5, companion.name.toUpperCase(), {
            fontSize: '15px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setDepth(102);
        const signal = this.add.text(copyX, top + 27, 'LIVING FORM // RETURNING FRIEND', {
            fontSize: '10px',
            color: '#F2C14E',
            fontStyle: 'bold'
        }).setDepth(102);
        const status = this.add.text(copyX, top + 44, 'Sanctuary watch maintained.', {
            fontSize: '10px',
            color: '#B9DAD7',
            wordWrap: { width: copyWidth }
        }).setDepth(102);
        this.elements.push(name, signal, status);

        const frame = this.add.graphics();
        frame.fillStyle(0x07100F, 0.98);
        frame.fillRoundedRect(left, top, portraitSize, portraitSize, 5);
        frame.lineStyle(2, companion.record ? 0x8FE3CF : 0x516466, 0.95);
        frame.strokeRoundedRect(left, top, portraitSize, portraitSize, 5);
        frame.setDepth(101);
        this.elements.push(frame);

        const placeholder = this.add.text(
            portraitX,
            portraitY,
            companion.record ? 'CREATURE\nRETURNING' : 'PIXEL\nIDENTITY',
            {
                fontSize: '8px',
                color: companion.record ? '#8FE3CF' : '#7F9695',
                align: 'center',
                fontStyle: 'bold',
                lineSpacing: 2
            }
        ).setOrigin(0.5).setDepth(102);
        this.elements.push(placeholder);

        if (!companion.record) return;

        const requestId = ++this.returnPortraitRequest;
        const recordPromise = this.returnPortraitPreview
            ? Promise.resolve(companion.record)
            : window.CompanionMediaService?.resolvePortrait?.(companion.stage);

        Promise.resolve(recordPromise)
            .then(resolved => {
                if (!resolved?.imageUrl) return null;
                return Promise.resolve(
                    window.CompanionMediaService?.ensureTexture?.(this, resolved)
                ).then(textureKey => ({ resolved, textureKey }));
            })
            .then(result => {
                if (
                    !result?.textureKey ||
                    requestId !== this.returnPortraitRequest ||
                    !this.scene.isActive()
                ) {
                    return;
                }

                const portrait = this.add.image(
                    portraitX,
                    portraitY,
                    result.textureKey
                ).setDisplaySize(portraitSize - 6, portraitSize - 6).setDepth(102);
                placeholder.destroy();
                this.elements.push(portrait);

                if (!this.returnPortraitPreview) {
                    window.CompanionMediaService?.recordAppearance?.(
                        'sanctuary_return',
                        result.resolved,
                        'motion_still'
                    );
                }
            })
            .catch(error => {
                if (
                    requestId !== this.returnPortraitRequest ||
                    !placeholder.active
                ) {
                    return;
                }
                placeholder.setText('PORTRAIT\nIN ARCHIVE');
                console.warn(
                    '[WelcomeBackScene] Living portrait unavailable:',
                    error.message
                );
            });
    }

    createEventCard(event, x, y, cardWidth, cardHeight, index) {
        // Card background
        const card = this.add.graphics();
        card.fillStyle(0x2A1A4E, 0.8);
        card.fillRoundedRect(x, y, cardWidth, cardHeight, 8);
        card.setDepth(101);

        // Animate card entry
        card.setAlpha(0);
        this.tweens.add({
            targets: card,
            alpha: 1,
            duration: 300,
            delay: 500 + (index * 100),
            ease: 'Power2'
        });

        this.elements.push(card);

        // Event icon
        const icon = this.add.text(x + 25, y + cardHeight / 2, event.icon || '✨', {
            fontSize: '24px'
        }).setOrigin(0.5).setDepth(102);

        icon.setAlpha(0);
        this.tweens.add({
            targets: icon,
            alpha: 1,
            scale: { from: 0.5, to: 1 },
            duration: 300,
            delay: 600 + (index * 100),
            ease: 'Back.easeOut'
        });

        this.elements.push(icon);

        // Creature name
        const name = this.add.text(x + 50, y + 12, event.creatureName || 'Creature', {
            fontSize: '13px',
            color: '#88CCFF',
            fontStyle: 'bold'
        }).setDepth(102);

        name.setAlpha(0);
        this.tweens.add({
            targets: name,
            alpha: 1,
            duration: 300,
            delay: 600 + (index * 100)
        });

        this.elements.push(name);

        // Event description
        const description = this.add.text(x + 50, y + 30, event.result || event.action || 'Did something', {
            fontSize: '11px',
            color: '#FFFFFF',
            wordWrap: { width: cardWidth - 70 }
        }).setDepth(102);

        description.setAlpha(0);
        this.tweens.add({
            targets: description,
            alpha: 1,
            duration: 300,
            delay: 700 + (index * 100)
        });

        this.elements.push(description);
    }

    createContinueButton(width, height) {
        const btnY = this.panelBounds.y + this.panelBounds.height - 45;
        const btnWidth = 220;
        const btnHeight = 40;
        const btnX = width / 2 - btnWidth / 2;

        // Button background
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x6FE7DD, 1);
        btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        btnBg.lineStyle(2, 0xFFD700, 1);
        btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        btnBg.setDepth(101);

        // Animate button
        btnBg.setAlpha(0);
        this.tweens.add({
            targets: btnBg,
            alpha: 1,
            duration: 500,
            delay: 1000
        });

        this.elements.push(btnBg);

        // Button text
        const btnText = this.add.text(width / 2, btnY + btnHeight / 2, 'RETURN TO SANCTUARY', {
            fontSize: '14px',
            color: '#061116',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);

        btnText.setAlpha(0);
        this.tweens.add({
            targets: btnText,
            alpha: 1,
            duration: 500,
            delay: 1000
        });

        this.elements.push(btnText);

        // Interactive zone
        const hitZone = this.add.zone(btnX, btnY, btnWidth, btnHeight).setOrigin(0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setDepth(103);

        hitZone.on('pointerup', () => this.onContinue());

        hitZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x8AF5EC, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
            btnBg.lineStyle(2, 0xFFD700, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        });

        hitZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x6FE7DD, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
            btnBg.lineStyle(2, 0xFFD700, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnWidth, btnHeight, 10);
        });

        this.elements.push(hitZone);

        if (width >= 600) {
            const skipText = this.add.text(width / 2, btnY + btnHeight + 15, 'Press any key to continue', {
                fontSize: '10px',
                color: '#666666'
            }).setOrigin(0.5).setDepth(101);

            skipText.setAlpha(0);
            this.tweens.add({
                targets: skipText,
                alpha: 1,
                duration: 500,
                delay: 1500
            });

            this.elements.push(skipText);
        }

        // Keyboard shortcut to skip
        this.input.keyboard.once('keydown', () => this.onContinue());
    }

    onContinue() {
        console.log('[WelcomeBackScene] Continuing to game...');

        window.AudioManager?.playButtonClick?.();

        // Fade out
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.time.delayedCall(500, () => {
            this.scene.stop('WelcomeBackScene');
            this.scene.start(this.returnScene);
        });
    }

    formatTimeAway(minutes) {
        if (minutes < 1) return 'a moment';
        if (minutes < 60) return `${Math.round(minutes)} minutes`;
        if (minutes < 120) return '1 hour';
        if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
        if (minutes < 2880) return '1 day';
        return `${Math.round(minutes / 1440)} days`;
    }

    shutdown() {
        console.log('[WelcomeBackScene] Shutting down...');

        this.returnPortraitRequest += 1;

        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];
        this.stars = [];

        if (this.time) {
            this.time.removeAllEvents();
        }

        if (this.tweens) {
            this.tweens.killAll();
        }

        if (this.input?.keyboard) {
            this.input.keyboard.removeAllListeners();
        }

        console.log('[WelcomeBackScene] Cleanup complete');
    }
}

export default WelcomeBackScene;

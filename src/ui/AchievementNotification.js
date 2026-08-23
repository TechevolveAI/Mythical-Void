/**
 * AchievementNotification - Beautiful achievement unlock notification UI
 *
 * Displays when an achievement is unlocked with:
 * - Tier badge and achievement name
 * - Description and rewards preview
 * - CLAIM button for satisfying micro-interaction
 * - Celebration effects based on tier
 */

import { devLog } from '../utils/devLogger.js';

class AchievementNotification {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.isVisible = false;
        this.queue = [];
        this.currentNotification = null;
        this.autoDismissTimer = null;
        this.destroyed = false;
        this.scene?.events?.once?.('shutdown', this.destroy, this);

        // Styling
        this.colors = {
            background: 0x1A1A3E,
            border: {
                BRONZE: 0xCD7F32,
                SILVER: 0xC0C0C0,
                GOLD: 0xFFD700,
                PLATINUM: 0xE5E4E2
            },
            text: '#FFFFFF',
            subtext: '#B8B8D0',
            reward: '#FFD700'
        };
    }

    /**
     * Show achievement notification
     * @param {object} achievement - Achievement unlock data
     */
    show(achievement) {
        if (this.destroyed || !this.isSceneOperational()) return;

        // Add to queue if already showing
        if (this.isVisible) {
            this.queue.push(achievement);
            devLog('[AchievementNotification] Queued:', achievement.name);
            return;
        }

        this.currentNotification = achievement;
        this.isVisible = true;
        this.createNotification(achievement);
    }

    /**
     * Create the notification UI
     */
    createNotification(achievement) {
        const { width, height } = this.scene.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        const screenSpace = this.getScreenSpaceTransform();
        const uiScale = screenSpace.scale;

        // Modal dimensions
        const modalWidth = Math.min(380, width - 40);
        const modalHeight = 280;
        const modalX = centerX - modalWidth / 2;
        const modalY = centerY - modalHeight / 2;

        // Create container
        this.container = this.scene.add.container(screenSpace.x, screenSpace.y);
        this.container.setDepth(10000);
        this.container.setScrollFactor(0);
        this.container.setScale(uiScale);
        this.contentContainer = this.scene.add.container(0, 0);
        this.contentContainer.setAlpha(0);
        this.contentContainer.setScale(0.8);
        this.container.add(this.contentContainer);

        // Achievements are non-blocking world notifications; exploration remains visible.
        this.overlay = this.scene.add.graphics()
            .setPosition(screenSpace.x, screenSpace.y)
            .setScrollFactor(0)
            .setDepth(9999)
            .setVisible(false)
            .setAlpha(0)
            .setData('achievementBackdropMode', 'non_blocking');
        this.scene.events.off('update', this.syncCameraZoom, this);
        this.scene.events.on('update', this.syncCameraZoom, this);

        // Get tier color
        const tierColor = this.colors.border[achievement.tier] || this.colors.border.BRONZE;

        // Main panel with gradient effect
        const panel = this.scene.add.graphics();
        panel.fillStyle(this.colors.background, 0.98);
        panel.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);

        // Tier-colored border (thicker for higher tiers)
        const borderWidth = achievement.tier === 'PLATINUM' ? 4 : achievement.tier === 'GOLD' ? 3 : 2;
        panel.lineStyle(borderWidth, tierColor, 1);
        panel.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);

        // Inner glow for Gold/Platinum
        if (achievement.tier === 'GOLD' || achievement.tier === 'PLATINUM') {
            panel.lineStyle(1, tierColor, 0.3);
            panel.strokeRoundedRect(-modalWidth / 2 + 4, -modalHeight / 2 + 4, modalWidth - 8, modalHeight - 8, 12);
        }

        this.contentContainer.add(panel);

        // Trophy icon and header
        const headerY = -modalHeight / 2 + 35;
        const trophyText = this.scene.add.text(0, headerY, '🏆 ACHIEVEMENT UNLOCKED!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.contentContainer.add(trophyText);

        // Divider line
        const divider = this.scene.add.graphics();
        divider.lineStyle(1, tierColor, 0.5);
        divider.lineBetween(-modalWidth / 2 + 20, headerY + 20, modalWidth / 2 - 20, headerY + 20);
        this.contentContainer.add(divider);

        // Tier badge and achievement name
        const tierIcon = achievement.tierInfo?.icon || '🥉';
        const nameY = headerY + 55;
        const nameText = this.scene.add.text(0, nameY, `${tierIcon} ${achievement.name}`, {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.contentContainer.add(nameText);

        // Tier name (Bronze, Silver, etc.)
        const tierNameY = nameY + 28;
        const tierName = achievement.tierInfo?.name || 'Bronze';
        const tierNameText = this.scene.add.text(0, tierNameY, `(${tierName})`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.subtext
        }).setOrigin(0.5);
        this.contentContainer.add(tierNameText);

        // Description
        const descY = tierNameY + 30;
        const descText = this.scene.add.text(0, descY, `"${achievement.description}"`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.subtext,
            fontStyle: 'italic',
            wordWrap: { width: modalWidth - 60 },
            align: 'center'
        }).setOrigin(0.5);
        this.contentContainer.add(descText);

        // Rewards section
        const rewardsY = descY + 40;
        const rewardsLabel = this.scene.add.text(0, rewardsY, 'Rewards:', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.subtext
        }).setOrigin(0.5);
        this.contentContainer.add(rewardsLabel);

        // Format rewards
        const rewardParts = [];
        if (achievement.rewards.coins) {
            rewardParts.push(`🪙 +${achievement.rewards.coins}`);
        }
        if (achievement.rewards.stardust) {
            rewardParts.push(`✨ +${achievement.rewards.stardust}`);
        }
        if (achievement.rewards.egg) {
            const eggRarity = achievement.rewards.egg.charAt(0).toUpperCase() + achievement.rewards.egg.slice(1);
            rewardParts.push(`🥚 ${eggRarity} Egg`);
        }

        const rewardsText = this.scene.add.text(0, rewardsY + 22, rewardParts.join('    '), {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.reward,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.contentContainer.add(rewardsText);

        // CLAIM button
        const buttonY = modalHeight / 2 - 45;
        const buttonWidth = 140;
        const buttonHeight = 44;

        const buttonBg = this.scene.add.graphics();
        buttonBg.fillStyle(tierColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
        this.contentContainer.add(buttonBg);

        const buttonText = this.scene.add.text(0, buttonY, 'CLAIM!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.contentContainer.add(buttonText);

        // Button zone
        const buttonZone = this.scene.add.zone(0, buttonY, buttonWidth, buttonHeight)
            .setInteractive({ useHandCursor: true });
        this.contentContainer.add(buttonZone);

        // Hover effects
        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0xFFFFFF, 1);
            buttonBg.fillRoundedRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
            this.scene.tweens.add({
                targets: buttonBg,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100
            });
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(tierColor, 1);
            buttonBg.fillRoundedRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
            this.scene.tweens.add({
                targets: buttonBg,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });

        // Claim action
        buttonZone.on('pointerdown', () => {
            this.claimAndClose(achievement);
        });

        // Animate in
        this.scene.tweens.add({
            targets: this.contentContainer,
            alpha: 1,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // Play celebration effects
        this.playCelebrationEffects(achievement.tier, centerX, centerY);

        // Auto-dismiss after 15 seconds
        this.autoDismissTimer = this.scene.time.delayedCall(15000, () => {
            this.claimAndClose(achievement);
        });

        devLog('[AchievementNotification] Showing:', achievement.name, achievement.tier);
    }

    /**
     * Claim the reward and close notification
     */
    claimAndClose(achievement) {
        // Cancel auto-dismiss
        if (this.autoDismissTimer) {
            this.autoDismissTimer.destroy();
            this.autoDismissTimer = null;
        }

        if (this.destroyed || !this.isSceneOperational()) {
            this.destroy();
            return;
        }

        // Claim the reward
        if (window.AchievementSystem) {
            window.AchievementSystem.claimReward(achievement.id, achievement.tier);
        }

        // Play claim sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        // Animate out
        this.scene.tweens.add({
            targets: this.contentContainer,
            alpha: 0,
            scale: 0.8,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.clearNotification();
                this.showNext();
            }
        });

        // Fade overlay
        this.scene.tweens.add({
            targets: this.overlay,
            alpha: 0,
            duration: 200
        });
    }

    syncCameraZoom() {
        if (!this.overlay) return false;
        const screenSpace = this.getScreenSpaceTransform();
        this.container
            ?.setPosition(screenSpace.x, screenSpace.y)
            .setScale(screenSpace.scale)
            .setScrollFactor(0);
        this.overlay
            .setPosition(screenSpace.x, screenSpace.y)
            .setScrollFactor(0)
            .setVisible(false)
            .setAlpha(0);
        return true;
    }

    getScreenSpaceTransform() {
        const cameraZoom = this.scene.cameras?.main?.zoom || 1;
        const { width, height } = this.scene.scale;
        return {
            x: width / (2 * cameraZoom),
            y: height / (2 * cameraZoom),
            scale: 1 / cameraZoom,
            cameraZoom,
            width,
            height
        };
    }

    drawScreenSpaceRect(graphics, color, alpha) {
        const screenSpace = this.getScreenSpaceTransform();
        const changed = graphics.getData?.('screenSpaceZoom') !== screenSpace.cameraZoom ||
            graphics.getData?.('screenSpaceWidth') !== screenSpace.width ||
            graphics.getData?.('screenSpaceHeight') !== screenSpace.height;
        if (changed) {
            graphics.clear();
            graphics.fillStyle(color, alpha);
            graphics.fillRect(
                -screenSpace.width / (2 * screenSpace.cameraZoom),
                -screenSpace.height / (2 * screenSpace.cameraZoom),
                screenSpace.width / screenSpace.cameraZoom,
                screenSpace.height / screenSpace.cameraZoom
            );
        }
        return graphics
            .setPosition(screenSpace.x, screenSpace.y)
            .setScale(1)
            .setScrollFactor(0)
            .setData('screenSpaceCoverage', 'viewport')
            .setData('screenSpaceZoom', screenSpace.cameraZoom)
            .setData('screenSpaceWidth', screenSpace.width)
            .setData('screenSpaceHeight', screenSpace.height);
    }

    /**
     * Play celebration effects based on tier
     */
    playCelebrationEffects(tier, x, y) {
        // Play sound
        if (window.AudioManager) {
            if (tier === 'PLATINUM') {
                window.AudioManager.playLevelUp();
            } else if (tier === 'GOLD') {
                window.AudioManager.playAchievement();
            } else {
                window.AudioManager.playCoinCollect();
            }
        }

        // Screen flash for Gold/Platinum
        if (tier === 'GOLD' || tier === 'PLATINUM') {
            const flash = this.scene.add.graphics();
            this.drawScreenSpaceRect(
                flash,
                tier === 'PLATINUM' ? 0xE5E4E2 : 0xFFD700,
                0.3
            ).setDepth(9998);

            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 500,
                onComplete: () => flash.destroy()
            });
        }

        // Particle effects
        if (window.FXLibrary && this.scene) {
            const particleCount = tier === 'PLATINUM' ? 30 : tier === 'GOLD' ? 20 : tier === 'SILVER' ? 15 : 10;
            const colors = {
                BRONZE: [0xCD7F32, 0xB87333, 0xDAA520],
                SILVER: [0xC0C0C0, 0xA9A9A9, 0xD3D3D3],
                GOLD: [0xFFD700, 0xFFA500, 0xFFFF00],
                PLATINUM: [0xE5E4E2, 0xFFFFFF, 0xB8B8D0, 0xFFD700]
            };

            // Create sparkle particles
            try {
                window.FXLibrary.stardustBurst(this.scene, x, y, {
                    count: particleCount,
                    colors: colors[tier] || colors.BRONZE,
                    duration: 2000
                });
            } catch (e) {
                devLog('[AchievementNotification] Particle effect failed:', e.message);
            }
        }
    }

    /**
     * Show next queued notification
     */
    showNext() {
        if (this.destroyed || !this.isSceneOperational()) return;
        this.isVisible = false;
        this.currentNotification = null;

        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.scene.time.delayedCall(300, () => {
                if (!this.destroyed && this.isSceneOperational()) {
                    this.show(next);
                }
            });
        }
    }

    isSceneOperational() {
        return Boolean(
            this.scene &&
            this.scene.sys?.isActive?.() !== false &&
            this.scene.tweens?.add
        );
    }

    /**
     * Clean up notification
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.autoDismissTimer) {
            this.autoDismissTimer.destroy();
            this.autoDismissTimer = null;
        }
        this.queue.length = 0;
        this.isVisible = false;
        this.currentNotification = null;
        this.scene?.events?.off?.('shutdown', this.destroy, this);
        this.clearNotification();
    }

    clearNotification() {
        this.scene?.events?.off?.('update', this.syncCameraZoom, this);
        if (this.container) {
            this.container.destroy(true);
            this.container = null;
            this.contentContainer = null;
        }
        if (this.overlay) {
            this.overlay.destroy();
            this.overlay = null;
        }
    }

    /**
     * Check if currently showing a notification
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Get queue length
     */
    getQueueLength() {
        return this.queue.length;
    }
}

export default AchievementNotification;

/**
 * AchievementNotification - Beautiful achievement unlock notification UI
 *
 * Displays when an achievement is unlocked with:
 * - Tier badge and achievement name
 * - Automatically granted rewards
 * - Compact, dismissible progress toast
 * - Celebration effects reserved for rare tiers
 */

import { devLog } from '../utils/devLogger.js';

const ACHIEVEMENT_TOAST_DEPTH = 18000;

class AchievementNotification {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.isVisible = false;
        this.queue = [];
        this.currentNotification = null;
        this.autoDismissTimer = null;
        this.dismissZone = null;
        this.toastScreenY = 0;
        this.destroyed = false;
        this.closing = false;
        this.blocksStory = false;
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

        const notificationKey = `${achievement?.id || 'unknown'}:${achievement?.tier || 'BRONZE'}`;
        const rewardResult = achievement.rewardClaimed
            ? achievement.rewardResult || null
            : window.AchievementSystem?.claimReward?.(
                achievement.id,
                achievement.tier
            ) || null;
        const notification = {
            ...achievement,
            notificationKey,
            rewardResult,
            rewardClaimed: true
        };

        if (
            this.currentNotification?.notificationKey === notificationKey ||
            this.queue.some(entry => entry.notificationKey === notificationKey)
        ) {
            return;
        }

        // Add to queue if already showing
        if (this.isVisible) {
            // Rewards are already granted above. Keep the visual queue short so
            // multiple milestones never take over the Sanctuary.
            if (this.queue.length < 2) this.queue.push(notification);
            devLog('[AchievementNotification] Queued:', achievement.name);
            return;
        }

        this.currentNotification = notification;
        this.isVisible = true;
        this.createNotification(notification);
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

        // Compact, non-blocking toast. Achievement details remain available in
        // the achievement menu, while exploration stays readable underneath.
        const compact = width < 620;
        const modalWidth = Math.min(compact ? 330 : 360, width - 24);
        const modalHeight = compact ? 98 : 104;
        const toastY = (-height / 2) + (compact ? 70 : 66);

        // Create container
        this.container = this.scene.add.container(screenSpace.x, screenSpace.y);
        this.container.setDepth(ACHIEVEMENT_TOAST_DEPTH);
        this.container.setScrollFactor(0);
        this.container.setScale(uiScale);
        this.contentContainer = this.scene.add.container(0, 0);
        this.contentContainer.setPosition(0, toastY);
        this.contentContainer.setAlpha(0);
        this.contentContainer.setScale(0.94);
        this.container.add(this.contentContainer);

        // Achievements are non-blocking world notifications; exploration remains visible.
        this.overlay = this.scene.add.graphics()
            .setPosition(screenSpace.x, screenSpace.y)
            .setScrollFactor(0)
            .setDepth(ACHIEVEMENT_TOAST_DEPTH - 1)
            .setVisible(false)
            .setAlpha(0)
            .setData('achievementBackdropMode', 'non_blocking');
        this.scene.events.off('update', this.syncCameraZoom, this);
        this.scene.events.on('update', this.syncCameraZoom, this);

        // Get tier color
        const tierColor = this.colors.border[achievement.tier] || this.colors.border.BRONZE;

        // Main panel
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x081312, 0.97);
        panel.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 8);

        const borderWidth = achievement.tier === 'PLATINUM' ? 3 : 2;
        panel.lineStyle(borderWidth, tierColor, 1);
        panel.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 8);

        this.contentContainer.add(panel);

        const tierName = achievement.tierInfo?.name || 'Bronze';
        const headerY = -modalHeight / 2 + 18;
        const trophyText = this.scene.add.text(
            -modalWidth / 2 + 16,
            headerY,
            `ACHIEVEMENT · ${tierName.toUpperCase()}`,
            {
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'Arial, sans-serif',
            color: achievement.tier === 'BRONZE' ? '#F2C14E' : this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.contentContainer.add(trophyText);

        const nameY = headerY + 25;
        const nameText = this.scene.add.text(
            -modalWidth / 2 + 16,
            nameY,
            achievement.name,
            {
            fontSize: compact ? '17px' : '18px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.contentContainer.add(nameText);

        const rewards = achievement.rewards || {};
        const rewardParts = [];
        if (rewards.coins) {
            rewardParts.push(`+${rewards.coins} COINS`);
        }
        if (rewards.stardust) {
            rewardParts.push(`+${rewards.stardust} STARDUST`);
        }
        if (rewards.egg) {
            const eggRarity = rewards.egg.charAt(0).toUpperCase() + rewards.egg.slice(1);
            rewardParts.push(`${eggRarity.toUpperCase()} EGG`);
        }

        const rewardsText = this.scene.add.text(
            -modalWidth / 2 + 16,
            nameY + 27,
            `REWARD ADDED · ${rewardParts.join(' · ') || 'MILESTONE RECORDED'}`,
            {
            fontSize: compact ? '10px' : '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#8FE3CF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.contentContainer.add(rewardsText);

        const closeText = this.scene.add.text(modalWidth / 2 - 18, headerY, '×', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#F4F4F4'
        }).setOrigin(0.5);
        this.contentContainer.add(closeText);

        // The full toast is a generous mobile-safe dismiss target.
        this.toastScreenY = compact ? 70 : 66;
        const inputCenter = this.getInputSpacePoint(centerX, this.toastScreenY);
        const dismissZone = this.scene.add.zone(
            inputCenter.x,
            inputCenter.y,
            modalWidth,
            modalHeight
        )
            .setScrollFactor(0)
            .setScale(uiScale)
            .setDepth(ACHIEVEMENT_TOAST_DEPTH + 1)
            .setInteractive({ useHandCursor: true })
            .setData('achievementDismissTarget', true)
            .setData('ariaLabel', `Dismiss ${achievement.name} achievement`);
        this.dismissZone = dismissZone;
        dismissZone.on('pointerup', () => {
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

        // Large effects are reserved for genuinely rare milestones.
        if (achievement.tier === 'GOLD' || achievement.tier === 'PLATINUM') {
            this.playCelebrationEffects(achievement.tier, centerX, centerY);
        }

        // Short enough to acknowledge without interrupting play.
        this.autoDismissTimer = this.scene.time.delayedCall(4200, () => {
            this.claimAndClose(achievement);
        });

        devLog('[AchievementNotification] Showing:', achievement.name, achievement.tier);
    }

    /**
     * Claim the reward and close notification
     */
    claimAndClose(achievement) {
        if (this.closing) return false;
        this.closing = true;
        // Cancel auto-dismiss
        if (this.autoDismissTimer) {
            this.autoDismissTimer.destroy();
            this.autoDismissTimer = null;
        }

        if (this.destroyed || !this.isSceneOperational()) {
            this.destroy();
            return;
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
        return true;
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
        const inputCenter = this.getInputSpacePoint(
            screenSpace.width / 2,
            this.toastScreenY
        );
        this.dismissZone
            ?.setPosition(inputCenter.x, inputCenter.y)
            .setScale(screenSpace.scale)
            .setScrollFactor(0);
        return true;
    }

    getInputSpacePoint(screenX, screenY) {
        const camera = this.scene.cameras?.main;
        if (typeof camera?.getWorldPoint !== 'function') {
            return { x: screenX, y: screenY };
        }
        const worldPoint = camera.getWorldPoint(screenX, screenY);
        return {
            x: worldPoint.x - (camera.scrollX || 0),
            y: worldPoint.y - (camera.scrollY || 0)
        };
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
        this.closing = false;

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
        if (this.dismissZone) {
            this.dismissZone.destroy();
            this.dismissZone = null;
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

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

        // Modal dimensions
        const modalWidth = Math.min(380, width - 40);
        const modalHeight = 280;
        const modalX = centerX - modalWidth / 2;
        const modalY = centerY - modalHeight / 2;

        // Create container
        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(10000);
        this.container.setAlpha(0);
        this.container.setScale(0.8);

        // Dark overlay
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.6);
        this.overlay.fillRect(-width / 2, -height / 2, width, height);
        this.overlay.setDepth(9999);

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

        this.container.add(panel);

        // Trophy icon and header
        const headerY = -modalHeight / 2 + 35;
        const trophyText = this.scene.add.text(0, headerY, '🏆 ACHIEVEMENT UNLOCKED!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(trophyText);

        // Divider line
        const divider = this.scene.add.graphics();
        divider.lineStyle(1, tierColor, 0.5);
        divider.lineBetween(-modalWidth / 2 + 20, headerY + 20, modalWidth / 2 - 20, headerY + 20);
        this.container.add(divider);

        // Tier badge and achievement name
        const tierIcon = achievement.tierInfo?.icon || '🥉';
        const nameY = headerY + 55;
        const nameText = this.scene.add.text(0, nameY, `${tierIcon} ${achievement.name}`, {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.text,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(nameText);

        // Tier name (Bronze, Silver, etc.)
        const tierNameY = nameY + 28;
        const tierName = achievement.tierInfo?.name || 'Bronze';
        const tierNameText = this.scene.add.text(0, tierNameY, `(${tierName})`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.subtext
        }).setOrigin(0.5);
        this.container.add(tierNameText);

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
        this.container.add(descText);

        // Rewards section
        const rewardsY = descY + 40;
        const rewardsLabel = this.scene.add.text(0, rewardsY, 'Rewards:', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: this.colors.subtext
        }).setOrigin(0.5);
        this.container.add(rewardsLabel);

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
        this.container.add(rewardsText);

        // CLAIM button
        const buttonY = modalHeight / 2 - 45;
        const buttonWidth = 140;
        const buttonHeight = 44;

        const buttonBg = this.scene.add.graphics();
        buttonBg.fillStyle(tierColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 10);
        this.container.add(buttonBg);

        const buttonText = this.scene.add.text(0, buttonY, 'CLAIM!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(buttonText);

        // Button zone
        const buttonZone = this.scene.add.zone(0, buttonY, buttonWidth, buttonHeight)
            .setInteractive({ useHandCursor: true });
        this.container.add(buttonZone);

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
            targets: this.container,
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
            targets: this.container,
            alpha: 0,
            scale: 0.8,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.destroy();
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
            flash.fillStyle(tier === 'PLATINUM' ? 0xE5E4E2 : 0xFFD700, 0.3);
            flash.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
            flash.setDepth(9998);

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
        this.isVisible = false;
        this.currentNotification = null;

        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.scene.time.delayedCall(300, () => {
                this.show(next);
            });
        }
    }

    /**
     * Clean up notification
     */
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
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

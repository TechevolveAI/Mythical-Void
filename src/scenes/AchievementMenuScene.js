/**
 * AchievementMenuScene - Full-screen achievement browser
 *
 * Features:
 * - Category-organized achievement list
 * - Progress bars for each achievement
 * - Tier badges showing completion status
 * - Claim buttons for unclaimed achievements
 * - Statistics summary
 */

import { devLog } from '../utils/devLogger.js';

export default class AchievementMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AchievementMenuScene' });
        this.scrollY = 0;
        this.maxScrollY = 0;
        this.contentHeight = 0;
        this.elements = [];
        this.returnScene = 'GameScene';
    }

    init(data = {}) {
        this.returnScene = data.returnScene || 'GameScene';
    }

    create() {
        devLog('[AchievementMenuScene] Creating achievement menu');
        window.AchievementSystem?.checkAchievements?.();

        const { width, height } = this.scale;

        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x0D0D1A);

        // Header
        this.createHeader(width, height);

        // Scrollable content area
        this.contentStartY = 100;
        this.contentEndY = height - 80;
        this.visibleHeight = this.contentEndY - this.contentStartY;

        // Create scroll mask
        const maskGraphics = this.make.graphics();
        maskGraphics.fillRect(0, this.contentStartY, width, this.visibleHeight);
        this.contentMask = maskGraphics.createGeometryMask();

        // Content container
        this.contentContainer = this.add.container(0, this.contentStartY);
        this.contentContainer.setMask(this.contentMask);

        // Build achievement list
        this.buildAchievementList(width);

        // Footer with stats
        this.createFooter(width, height);

        // Input handling
        this.setupInput(width, height);

        // ESC to close
        this.input.keyboard.on('keydown-ESC', () => {
            this.closeMenu();
        });
    }

    createHeader(width, height) {
        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A1A3E, 1);
        headerBg.fillRect(0, 0, width, 90);
        headerBg.lineStyle(2, 0x7B68EE, 0.5);
        headerBg.lineBetween(0, 90, width, 90);

        // Title
        this.add.text(width / 2, 35, '🏆 ACHIEVEMENTS', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Progress summary
        const stats = window.AchievementSystem?.getStats() || { claimedTiers: 0, totalTiers: 0, percentage: 0 };
        const progressText = `${stats.claimedTiers}/${stats.totalTiers} (${stats.percentage}%)`;

        this.progressLabel = this.add.text(width / 2, 65, progressText, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#B8B8D0'
        }).setOrigin(0.5);

        // Close button
        const closeBtn = this.add.text(width - 25, 20, '✕', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerover', () => closeBtn.setColor('#FF6B6B'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#FFFFFF'));
        closeBtn.on('pointerdown', () => this.closeMenu());
    }

    buildAchievementList(width) {
        if (!window.AchievementSystem) {
            devLog('[AchievementMenuScene] AchievementSystem not available');
            return;
        }

        const categories = window.AchievementSystem.getAchievementsByCategory();
        let yOffset = 10;
        const padding = 15;
        const itemHeight = 90;
        const categorySpacing = 20;

        Object.entries(categories).forEach(([catKey, category]) => {
            if (category.achievements.length === 0) return;

            // Category header
            const catHeader = this.add.text(padding, yOffset, `═══ ${category.icon} ${category.name} ═══`, {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#7B68EE',
                fontStyle: 'bold'
            });
            this.contentContainer.add(catHeader);
            this.elements.push(catHeader);
            yOffset += 35;

            // Achievement items
            category.achievements.forEach(achievement => {
                const itemContainer = this.createAchievementItem(achievement, padding, yOffset, width - padding * 2);
                this.contentContainer.add(itemContainer);
                this.elements.push(itemContainer);
                yOffset += itemHeight + 10;
            });

            yOffset += categorySpacing;
        });

        this.contentHeight = yOffset;
        this.maxScrollY = Math.max(0, this.contentHeight - this.visibleHeight);
    }

    createAchievementItem(achievement, x, y, width) {
        const container = this.add.container(x, y);

        // Get progress
        const progress = window.AchievementSystem.getAchievementProgress(achievement.id);
        if (!progress) return container;

        const itemHeight = 85;

        // Background panel
        const bg = this.add.graphics();
        const bgColor = progress.allComplete ? 0x2A4A2A : 0x1A1A3E;
        bg.fillStyle(bgColor, 0.9);
        bg.fillRoundedRect(0, 0, width, itemHeight, 10);

        // Border based on current tier
        const tierColors = {
            BRONZE: 0xCD7F32,
            SILVER: 0xC0C0C0,
            GOLD: 0xFFD700,
            PLATINUM: 0xE5E4E2
        };
        const borderColor = progress.unlocked ? 0x4CAF50 :
            tierColors[progress.currentTier] || 0x555555;
        bg.lineStyle(2, borderColor, 0.8);
        bg.strokeRoundedRect(0, 0, width, itemHeight, 10);
        container.add(bg);

        // Tier badge
        const tierBadges = progress.completedTiers.map(t => {
            const icons = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎' };
            return icons[t] || '';
        }).join('');

        const currentTierIcon = progress.allComplete ? '✅' :
            (progress.hidden && !progress.unlocked ? '❓' :
                { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎' }[progress.currentTier] || '🔒');

        const badgeText = this.add.text(15, 15, tierBadges + currentTierIcon, {
            fontSize: '20px'
        });
        container.add(badgeText);

        // Achievement name
        const displayName = (progress.hidden && !progress.completedTiers.length && !progress.unlocked)
            ? '???' : progress.name;
        const nameText = this.add.text(60, 12, displayName, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        container.add(nameText);

        // Description
        const displayDesc = (progress.hidden && !progress.completedTiers.length && !progress.unlocked)
            ? 'Hidden achievement - discover it!' : (progress.description || '');
        const descText = this.add.text(60, 32, displayDesc, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#B8B8D0',
            wordWrap: { width: width - 180 }
        });
        container.add(descText);

        // Progress bar (if not all complete)
        if (!progress.allComplete && !progress.hidden) {
            const barX = 60;
            const barY = 55;
            const barWidth = width - 180;
            const barHeight = 12;

            // Background
            const barBg = this.add.graphics();
            barBg.fillStyle(0x333355, 1);
            barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
            container.add(barBg);

            // Fill
            const fillWidth = Math.max(2, (progress.percentage / 100) * barWidth);
            const barFill = this.add.graphics();
            barFill.fillStyle(borderColor, 1);
            barFill.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
            container.add(barFill);

            // Progress text
            const progressStr = `${progress.currentValue}/${progress.requirement}`;
            const progressText = this.add.text(barX + barWidth + 10, barY + barHeight / 2, progressStr, {
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#B8B8D0'
            }).setOrigin(0, 0.5);
            container.add(progressText);
        }

        // Claim button or reward preview
        if (progress.unlocked && !progress.allComplete) {
            // CLAIM button
            const btnX = width - 75;
            const btnY = itemHeight / 2;
            const btnWidth = 60;
            const btnHeight = 30;

            const btnBg = this.add.graphics();
            btnBg.fillStyle(0x4CAF50, 1);
            btnBg.fillRoundedRect(btnX - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 6);
            container.add(btnBg);

            const btnText = this.add.text(btnX, btnY, 'CLAIM', {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(btnText);

            const btnZone = this.add.zone(btnX, btnY, btnWidth, btnHeight)
                .setInteractive({ useHandCursor: true });
            container.add(btnZone);

            btnZone.on('pointerdown', () => {
                this.claimAchievement(achievement.id, progress.currentTier);
            });

            btnZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x66BB6A, 1);
                btnBg.fillRoundedRect(btnX - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 6);
            });

            btnZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x4CAF50, 1);
                btnBg.fillRoundedRect(btnX - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 6);
            });
        } else if (!progress.allComplete && progress.rewards) {
            // Show next reward
            const rewardParts = [];
            if (progress.rewards.coins) rewardParts.push(`🪙${progress.rewards.coins}`);
            if (progress.rewards.stardust) rewardParts.push(`✨${progress.rewards.stardust}`);
            if (progress.rewards.egg) rewardParts.push(`🥚`);

            const rewardText = this.add.text(width - 15, itemHeight / 2, rewardParts.join(' '), {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD700'
            }).setOrigin(1, 0.5);
            container.add(rewardText);
        } else if (progress.allComplete) {
            // Completed indicator
            const completeText = this.add.text(width - 15, itemHeight / 2, '✓ MAX', {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#4CAF50',
                fontStyle: 'bold'
            }).setOrigin(1, 0.5);
            container.add(completeText);
        }

        return container;
    }

    claimAchievement(achievementId, tier) {
        if (window.AchievementSystem) {
            const rewards = window.AchievementSystem.claimReward(achievementId, tier);
            if (rewards) {
                // Play sound
                if (window.AudioManager) {
                    window.AudioManager.playAchievement();
                }

                // Refresh the list
                this.refreshList();
            }
        }
    }

    refreshList() {
        // Clear existing content
        this.elements.forEach(el => el.destroy());
        this.elements = [];
        this.scrollY = 0;
        this.contentContainer.y = this.contentStartY;

        // Rebuild
        this.buildAchievementList(this.scale.width);

        // Update header
        const stats = window.AchievementSystem?.getStats() || { claimedTiers: 0, totalTiers: 0, percentage: 0 };
        const progressText = `${stats.claimedTiers}/${stats.totalTiers} (${stats.percentage}%)`;
        this.progressLabel.setText(progressText);

        // Update footer
        this.updateFooterStats();
    }

    createFooter(width, height) {
        const footerY = height - 70;

        // Footer background
        const footerBg = this.add.graphics();
        footerBg.fillStyle(0x1A1A3E, 1);
        footerBg.fillRect(0, footerY, width, 70);
        footerBg.lineStyle(2, 0x7B68EE, 0.5);
        footerBg.lineBetween(0, footerY, width, footerY);

        // Stats
        const stats = window.AchievementSystem?.getStats() || {};

        this.footerCoins = this.add.text(width / 4, footerY + 25, `🪙 ${stats.totalCoinsEarned || 0}`, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700'
        }).setOrigin(0.5);

        this.footerStardust = this.add.text(width / 2, footerY + 25, `✨ ${stats.totalStardustEarned || 0}`, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#E5E4E2'
        }).setOrigin(0.5);

        this.footerEggs = this.add.text(3 * width / 4, footerY + 25, `🥚 ${stats.eggsEarned || 0}`, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        this.add.text(width / 2, footerY + 50, 'Total Rewards Earned', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#B8B8D0'
        }).setOrigin(0.5);
    }

    updateFooterStats() {
        const stats = window.AchievementSystem?.getStats() || {};
        this.footerCoins?.setText(`🪙 ${stats.totalCoinsEarned || 0}`);
        this.footerStardust?.setText(`✨ ${stats.totalStardustEarned || 0}`);
        this.footerEggs?.setText(`🥚 ${stats.eggsEarned || 0}`);
    }

    setupInput(width, height) {
        // Mouse wheel scrolling
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this.scroll(deltaY * 0.5);
        });

        // Touch/drag scrolling
        let dragStartY = 0;
        let lastY = 0;

        this.input.on('pointerdown', (pointer) => {
            if (pointer.y > this.contentStartY && pointer.y < this.contentEndY) {
                dragStartY = pointer.y;
                lastY = pointer.y;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown && dragStartY > 0) {
                const deltaY = lastY - pointer.y;
                this.scroll(deltaY);
                lastY = pointer.y;
            }
        });

        this.input.on('pointerup', () => {
            dragStartY = 0;
        });
    }

    scroll(deltaY) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY, 0, this.maxScrollY);
        this.contentContainer.y = this.contentStartY - this.scrollY;
    }

    closeMenu() {
        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        this.scene.stop();
        if (this.scene.isPaused?.(this.returnScene)) {
            this.scene.resume(this.returnScene);
        }
    }

    shutdown() {
        devLog('[AchievementMenuScene] Shutting down');
        this.elements = [];

        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ESC');
        }
    }
}

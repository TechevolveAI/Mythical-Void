/**
 * MobileHUD - Optimized mobile-first heads-up display
 *
 * Features:
 * - Compact top navigation bar with level, XP, and coins
 * - Minimized stat indicators with tap-to-expand
 * - Redesigned stat bars positioned above bottom controls
 * - Clean visual hierarchy for maximum game view visibility
 */

export default class MobileHUD {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.isVisible = false;

        // Top bar elements
        this.topBarBg = null;
        this.levelText = null;
        this.xpBarBg = null;
        this.xpBarFill = null;
        this.coinIcon = null;
        this.coinText = null;
        this.statIndicators = [];

        // Bottom stat bars
        this.statBarContainer = null;
        this.statBars = {};

        // State
        this.lastStats = { health: 100, happiness: 100, energy: 100 };
        this.lastLevel = 1;
        this.lastXP = 0;
        this.lastCoins = 0;

        // Personality mood indicator
        this.moodIndicator = null;
        this.moodBg = null;
        this.lastMoodEmoji = null;

        // Lifecycle stage indicator
        this.stageIndicator = null;
        this.stageBg = null;
        this.lastStage = null;

        // Streak display
        this.streakIcon = null;
        this.streakText = null;
        this.streakGlow = null;
        this.lastStreak = 0;

        // Daily surprise box
        this.giftBox = null;
        this.giftGlow = null;
        this.giftBadge = null;
        this.dailyRewardElements = [];

        // Layout constants - optimized for mobile
        this.layout = {
            topBarHeight: 44,
            topBarPadding: 8,
            statBarHeight: 6,
            statBarWidth: 60,
            statBarGap: 4,
            bottomPadding: 180, // Space for action buttons
            cornerRadius: 8
        };
    }

    /**
     * Detect if device is mobile
     * More inclusive: shows HUD on any touch device OR small screen
     * This ensures tablet users and mobile emulation work correctly
     */
    isMobile() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 1024; // Increased threshold for tablets
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Show mobile HUD if: touch device with small-ish screen, OR mobile user agent
        return (isTouchDevice && isSmallScreen) || isMobileUserAgent;
    }

    /**
     * Initialize and show the mobile HUD
     */
    init() {
        if (!this.isMobile()) {
            console.log('[MobileHUD] Not a mobile device, skipping mobile HUD');
            return;
        }

        console.log('[MobileHUD] Initializing mobile-optimized HUD');

        this.createTopBar();
        // Note: Bottom stat bars removed for cleaner mobile view
        // Mini stat indicators in top bar provide sufficient stat visibility
        this.setupEventListeners();

        this.isVisible = true;
        this.update();
    }

    /**
     * Create the compact top navigation bar
     */
    createTopBar() {
        const { width } = this.scene.scale;
        const { topBarHeight, topBarPadding, cornerRadius } = this.layout;

        // Create semi-transparent top bar background
        // Use high depth (2000+) to ensure it's above ALL background effects (aurora, particles, etc.)
        this.topBarBg = this.scene.add.graphics();
        this.topBarBg.setScrollFactor(0);
        this.topBarBg.setDepth(2000);

        // Draw gradient background
        this.topBarBg.fillStyle(0x0D0D1A, 0.85);
        this.topBarBg.fillRoundedRect(
            topBarPadding,
            topBarPadding,
            width - topBarPadding * 2,
            topBarHeight,
            cornerRadius
        );

        // Add subtle border
        this.topBarBg.lineStyle(1, 0x4A90D9, 0.5);
        this.topBarBg.strokeRoundedRect(
            topBarPadding,
            topBarPadding,
            width - topBarPadding * 2,
            topBarHeight,
            cornerRadius
        );

        this.elements.push(this.topBarBg);

        // Create level indicator (left side)
        this.createLevelIndicator();

        // Create stage indicator (after level/XP)
        this.createStageIndicator();

        // Create coin display (center-right)
        this.createCoinDisplay();

        // Create streak display (after coins)
        this.createStreakDisplay();

        // Create daily surprise box (far right)
        this.createDailySurpriseBox();

        // Create mini stat indicators (right side)
        this.createMiniStatIndicators();
    }

    /**
     * Create lifecycle stage indicator
     */
    createStageIndicator() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Stage icons mapping
        const stageIcons = {
            baby: '🐣',
            juvenile: '🌱',
            adult: '✨',
            elder: '👑'
        };

        // Position after XP label - responsive to screen width
        // On small screens (< 400px), use compact positioning
        const stageX = width < 400 ? topBarPadding + 125 : topBarPadding + 150;

        // Stage badge background
        this.stageBg = this.scene.add.graphics();
        this.stageBg.setScrollFactor(0);
        this.stageBg.setDepth(2001);

        // Draw pill-shaped badge
        this.stageBg.fillStyle(0x3A3A6E, 0.9);
        this.stageBg.fillRoundedRect(stageX, centerY - 10, 50, 20, 10);
        this.stageBg.lineStyle(1, 0x7B68EE, 0.6);
        this.stageBg.strokeRoundedRect(stageX, centerY - 10, 50, 20, 10);
        this.elements.push(this.stageBg);

        // Get current stage
        const currentStage = window.GameState?.get('creature.lifecycle.stage') || 'baby';
        const stageIcon = stageIcons[currentStage] || '🐣';

        // Stage indicator text
        this.stageIndicator = this.scene.add.text(
            stageX + 25,
            centerY,
            stageIcon,
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif'
            }
        );
        this.stageIndicator.setOrigin(0.5);
        this.stageIndicator.setScrollFactor(0);
        this.stageIndicator.setDepth(2002);
        this.elements.push(this.stageIndicator);

        this.lastStage = currentStage;

        // DEV ONLY: Make stage indicator clickable to cycle through stages for testing
        if (import.meta.env.DEV) {
            console.log('[MobileHUD] DEV mode detected - creating clickable stage indicator at:', stageX + 25, centerY);
            const hitZone = this.scene.add.zone(stageX + 25, centerY, 50, 20);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setScrollFactor(0);
            hitZone.setDepth(2003);

            hitZone.on('pointerdown', () => {
                const stages = ['baby', 'juvenile', 'adult', 'elder'];
                const currentStageIndex = stages.indexOf(window.GameState?.get('creature.lifecycle.stage') || 'baby');
                const nextStageIndex = (currentStageIndex + 1) % stages.length;
                const nextStage = stages[nextStageIndex];

                console.log(`[MobileHUD] DEV: Cycling stage from ${stages[currentStageIndex]} to ${nextStage}`);

                // Update GameState - active creature slot
                window.GameState?.set('creature.lifecycle.stage', nextStage);

                // Update visual days for testing (approximate)
                const stageDays = { baby: 1, juvenile: 4, adult: 10, elder: 35 };
                const stageDaysBirth = { baby: 0, juvenile: 1, adult: 3, elder: 10 };
                window.GameState?.set('creature.lifecycle.daysAlive', stageDays[nextStage]);

                // Set birthDate for proper eligibility checks
                const newBirthDate = Date.now() - (stageDaysBirth[nextStage] * 24 * 60 * 60 * 1000);
                window.GameState?.set('creature.lifecycle.birthDate', newBirthDate);

                // ALSO update the creature in the collection (critical for FusionPod eligibility)
                const creatures = window.GameState?.get('creatures') || [];
                const activeIndex = window.GameState?.get('activeCreatureIndex') || 0;
                if (creatures[activeIndex]) {
                    if (!creatures[activeIndex].lifecycle) {
                        creatures[activeIndex].lifecycle = { evolutionHistory: [] };
                    }
                    creatures[activeIndex].lifecycle.stage = nextStage;
                    creatures[activeIndex].lifecycle.daysAlive = stageDays[nextStage];
                    creatures[activeIndex].lifecycle.birthDate = newBirthDate;
                    creatures[activeIndex].lifecycle.lastStageChange = Date.now();
                    window.GameState?.set('creatures', creatures);
                    console.log(`[MobileHUD] DEV: Also updated creature in collection at index ${activeIndex}`);
                }

                // Trigger creature re-render in GameScene
                if (this.scene.scene.isActive('GameScene')) {
                    this.scene.scene.get('GameScene').events.emit('forceCreatureRefresh');
                }

                // Play click sound
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }
            });

            // Hover effect
            hitZone.on('pointerover', () => {
                this.stageBg.clear();
                this.stageBg.fillStyle(0x5A5A8E, 0.9);
                this.stageBg.fillRoundedRect(stageX, centerY - 10, 50, 20, 10);
                this.stageBg.lineStyle(1, 0xFFD700, 0.8);
                this.stageBg.strokeRoundedRect(stageX, centerY - 10, 50, 20, 10);
            });

            hitZone.on('pointerout', () => {
                this.stageBg.clear();
                this.stageBg.fillStyle(0x3A3A6E, 0.9);
                this.stageBg.fillRoundedRect(stageX, centerY - 10, 50, 20, 10);
                this.stageBg.lineStyle(1, 0x7B68EE, 0.6);
                this.stageBg.strokeRoundedRect(stageX, centerY - 10, 50, 20, 10);
            });

            this.elements.push(hitZone);
        }
    }

    /**
     * Create level and XP indicator
     */
    createLevelIndicator() {
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Level badge background
        const badgeSize = 28;
        this.levelBadge = this.scene.add.graphics();
        this.levelBadge.setScrollFactor(0);
        this.levelBadge.setDepth(2001);

        // Draw circular badge
        this.levelBadge.fillStyle(0x7B68EE, 0.9);
        this.levelBadge.fillCircle(topBarPadding + 20, centerY, badgeSize / 2);
        this.levelBadge.lineStyle(2, 0xFFD700, 0.8);
        this.levelBadge.strokeCircle(topBarPadding + 20, centerY, badgeSize / 2);

        this.elements.push(this.levelBadge);

        // Level number
        this.levelText = this.scene.add.text(
            topBarPadding + 20,
            centerY,
            '1',
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        );
        this.levelText.setOrigin(0.5);
        this.levelText.setScrollFactor(0);
        this.levelText.setDepth(2002);
        this.elements.push(this.levelText);

        // XP bar (horizontal progress bar next to level)
        const xpBarX = topBarPadding + 42;
        const xpBarWidth = 70;
        const xpBarHeight = 8;

        // XP bar background
        this.xpBarBg = this.scene.add.graphics();
        this.xpBarBg.setScrollFactor(0);
        this.xpBarBg.setDepth(2001);
        this.xpBarBg.fillStyle(0x1A1A2E, 0.9);
        this.xpBarBg.fillRoundedRect(xpBarX, centerY - xpBarHeight / 2, xpBarWidth, xpBarHeight, 4);
        this.elements.push(this.xpBarBg);

        // XP bar fill
        this.xpBarFill = this.scene.add.graphics();
        this.xpBarFill.setScrollFactor(0);
        this.xpBarFill.setDepth(2002);
        this.xpBarX = xpBarX;
        this.xpBarY = centerY - xpBarHeight / 2;
        this.xpBarWidth = xpBarWidth;
        this.xpBarHeight = xpBarHeight;
        this.elements.push(this.xpBarFill);

        // XP text (small label)
        this.xpLabel = this.scene.add.text(
            xpBarX + xpBarWidth + 5,
            centerY,
            'XP',
            {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                color: '#88CCFF',
                fontStyle: 'bold'
            }
        );
        this.xpLabel.setOrigin(0, 0.5);
        this.xpLabel.setScrollFactor(0);
        this.xpLabel.setDepth(2001);
        this.elements.push(this.xpLabel);
    }

    /**
     * Create coin display
     */
    createCoinDisplay() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position coins in center-right area - responsive to screen width
        // On small screens, shift coins slightly right to avoid stage/mood overlap
        const coinX = width < 400 ? width / 2 + 10 : width / 2 + 20;

        // Coin icon (use existing texture or create simple one)
        if (this.scene.textures.exists('cosmicCoin')) {
            this.coinIcon = this.scene.add.image(coinX, centerY, 'cosmicCoin');
            this.coinIcon.setScale(0.5);
        } else {
            // Create simple coin circle
            this.coinIcon = this.scene.add.graphics();
            this.coinIcon.fillStyle(0xFFD700, 1);
            this.coinIcon.fillCircle(coinX, centerY, 10);
            this.coinIcon.lineStyle(2, 0xFFA500, 1);
            this.coinIcon.strokeCircle(coinX, centerY, 10);
        }

        if (this.coinIcon.setScrollFactor) {
            this.coinIcon.setScrollFactor(0);
            this.coinIcon.setDepth(2001);
        }
        this.elements.push(this.coinIcon);

        // Coin amount text
        this.coinText = this.scene.add.text(
            coinX + 16,
            centerY,
            '0',
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        this.coinText.setOrigin(0, 0.5);
        this.coinText.setScrollFactor(0);
        this.coinText.setDepth(2001);
        this.elements.push(this.coinText);
    }

    /**
     * Create streak display with flame icon
     */
    createStreakDisplay() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position after coins - adaptive based on screen width
        const streakX = width < 400 ? width / 2 + 55 : width / 2 + 70;

        const streak = window.GameState?.get('dailyBonus.streak') || 0;
        const colors = this.getStreakColors(streak);

        // Draw flame icon
        this.streakIcon = this.scene.add.graphics();
        this.streakIcon.setScrollFactor(0);
        this.streakIcon.setDepth(2001);
        this.drawFlameIcon(this.streakIcon, streakX, centerY, colors.flame);
        this.elements.push(this.streakIcon);

        // Streak number
        this.streakText = this.scene.add.text(
            streakX + 14,
            centerY,
            streak > 0 ? `${streak}` : '-',
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: colors.text,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        this.streakText.setOrigin(0, 0.5);
        this.streakText.setScrollFactor(0);
        this.streakText.setDepth(2001);
        this.elements.push(this.streakText);

        this.lastStreak = streak;
        this.streakX = streakX;

        // Add pulsing animation for active streaks (3+ days)
        if (streak >= 3) {
            this.scene.tweens.add({
                targets: [this.streakIcon, this.streakText],
                scale: { from: 1, to: 1.1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    /**
     * Get streak display colors based on streak count
     */
    getStreakColors(streak) {
        if (streak >= 30) return { flame: 0xFFD700, text: '#FFD700' }; // Gold
        if (streak >= 14) return { flame: 0xFF6B35, text: '#FF6B35' }; // Orange
        if (streak >= 7) return { flame: 0xFF4444, text: '#FF4444' };  // Red
        if (streak >= 3) return { flame: 0xFFAA00, text: '#FFAA00' };  // Yellow
        return { flame: 0x888888, text: '#AAAAAA' };  // Gray (no streak)
    }

    /**
     * Draw flame icon for streak display
     */
    drawFlameIcon(graphics, x, y, color) {
        graphics.clear();
        graphics.fillStyle(color, 1);

        // Simple flame shape
        graphics.beginPath();
        graphics.moveTo(x, y + 8);       // Bottom center
        graphics.lineTo(x - 5, y + 2);   // Bottom left
        graphics.lineTo(x - 3, y - 2);   // Mid left
        graphics.lineTo(x - 4, y - 6);   // Upper left
        graphics.lineTo(x, y - 4);       // Top inner
        graphics.lineTo(x + 4, y - 6);   // Upper right
        graphics.lineTo(x + 3, y - 2);   // Mid right
        graphics.lineTo(x + 5, y + 2);   // Bottom right
        graphics.closePath();
        graphics.fillPath();

        // Inner brighter flame
        graphics.fillStyle(this.lightenColor(color), 0.8);
        graphics.beginPath();
        graphics.moveTo(x, y + 4);
        graphics.lineTo(x - 2, y);
        graphics.lineTo(x, y - 3);
        graphics.lineTo(x + 2, y);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Lighten a color for inner flame effect
     */
    lightenColor(color) {
        const r = Math.min(255, ((color >> 16) & 0xFF) + 60);
        const g = Math.min(255, ((color >> 8) & 0xFF) + 60);
        const b = Math.min(255, (color & 0xFF) + 60);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Update streak display
     */
    updateStreak() {
        if (!this.isVisible || !this.streakText) return;

        const streak = window.GameState?.get('dailyBonus.streak') || 0;

        if (streak !== this.lastStreak) {
            const colors = this.getStreakColors(streak);
            const { topBarPadding, topBarHeight } = this.layout;
            const centerY = topBarPadding + topBarHeight / 2;

            // Update flame icon
            if (this.streakIcon) {
                this.drawFlameIcon(this.streakIcon, this.streakX, centerY, colors.flame);
            }

            // Update text
            this.streakText.setText(streak > 0 ? `${streak}` : '-');
            this.streakText.setColor(colors.text);

            // Animation on increase
            if (streak > this.lastStreak) {
                this.scene.tweens.add({
                    targets: [this.streakIcon, this.streakText],
                    scale: { from: 1.5, to: 1 },
                    duration: 400,
                    ease: 'Back.easeOut'
                });

                // Check for milestone
                if ([7, 14, 30].includes(streak)) {
                    this.celebrateStreakMilestone(streak);
                }
            }

            this.lastStreak = streak;
        }
    }

    /**
     * Celebrate streak milestones with effects
     */
    celebrateStreakMilestone(streak) {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Particle burst at streak location
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, this.streakX, centerY, {
                count: 15,
                color: [0xFFD700, 0xFF6B35, 0xFFFFFF],
                duration: 1500
            });
        }

        // Haptic feedback
        if (window.FeedbackManager) {
            window.FeedbackManager.onStreakMilestone(this.scene);
        }

        // Sound effect
        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        // Show milestone message
        const milestoneMessages = {
            7: '1 Week Streak!',
            14: '2 Week Streak!',
            30: '1 Month Streak!'
        };

        const message = this.scene.add.text(
            width / 2,
            centerY + 50,
            milestoneMessages[streak] || `${streak} Day Streak!`,
            {
                fontSize: '20px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        message.setOrigin(0.5);
        message.setScrollFactor(0);
        message.setDepth(2000);

        // Animate and fade out
        this.scene.tweens.add({
            targets: message,
            y: centerY + 30,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.3 },
            duration: 2000,
            ease: 'Sine.easeOut',
            onComplete: () => message.destroy()
        });
    }

    /**
     * Create daily surprise box
     */
    createDailySurpriseBox() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position on far right side of top bar
        const boxX = width - topBarPadding - 25;

        const dailyBonus = window.GameState?.get('dailyBonus') || {};
        const today = new Date().toDateString();
        const canClaim = dailyBonus.lastClaim !== today;

        // Create gift box graphics
        this.giftBox = this.scene.add.graphics();
        this.giftBox.setScrollFactor(0);
        this.giftBox.setDepth(2001);
        this.drawGiftBox(this.giftBox, boxX, centerY, canClaim);
        this.elements.push(this.giftBox);

        if (canClaim) {
            // Pulsing glow for unclaimed
            this.giftGlow = this.scene.add.graphics();
            this.giftGlow.fillStyle(0xFFD700, 0.3);
            this.giftGlow.fillCircle(boxX, centerY, 20);
            this.giftGlow.setScrollFactor(0);
            this.giftGlow.setDepth(2000);
            this.elements.push(this.giftGlow);

            this.scene.tweens.add({
                targets: this.giftGlow,
                alpha: { from: 0.6, to: 0.2 },
                scale: { from: 1, to: 1.2 },
                duration: 1000,
                yoyo: true,
                repeat: -1
            });

            // Notification badge
            this.giftBadge = this.scene.add.circle(boxX + 8, centerY - 8, 5, 0xFF4444);
            this.giftBadge.setScrollFactor(0);
            this.giftBadge.setDepth(2002);
            this.elements.push(this.giftBadge);
        }

        // Create dedicated hit zone for reliable touch handling (like hamburger menu)
        const hitZoneSize = 50; // Larger touch target
        this.giftHitZone = this.scene.add.zone(boxX, centerY, hitZoneSize, hitZoneSize);
        this.giftHitZone.setScrollFactor(0);
        this.giftHitZone.setDepth(2010); // Above gift box graphics
        this.giftHitZone.setInteractive({ useHandCursor: true });
        this.elements.push(this.giftHitZone);

        // Click handler on zone
        this.giftHitZone.on('pointerdown', () => {
            console.log('[MobileHUD] Gift box tapped');
            this.openDailySurprise();
        });

        // Hover effects
        this.giftHitZone.on('pointerover', () => {
            this.scene.tweens.add({
                targets: this.giftBox,
                scale: 1.15,
                duration: 100
            });
        });

        this.giftHitZone.on('pointerout', () => {
            this.scene.tweens.add({
                targets: this.giftBox,
                scale: 1,
                duration: 100
            });
        });

        this.giftBoxX = boxX;
    }

    /**
     * Draw gift box icon
     */
    drawGiftBox(graphics, x, y, isAvailable) {
        graphics.clear();

        const boxColor = isAvailable ? 0x9C27B0 : 0x666666;
        const ribbonColor = isAvailable ? 0xFFD700 : 0x888888;

        // Box base
        graphics.fillStyle(boxColor, 1);
        graphics.fillRoundedRect(x - 10, y - 6, 20, 16, 3);

        // Box lid
        graphics.fillStyle(this.darkenColor(boxColor), 1);
        graphics.fillRoundedRect(x - 11, y - 10, 22, 6, 2);

        // Ribbon horizontal
        graphics.fillStyle(ribbonColor, 1);
        graphics.fillRect(x - 10, y - 1, 20, 3);

        // Ribbon vertical
        graphics.fillRect(x - 1.5, y - 10, 3, 20);

        // Bow loops
        graphics.fillStyle(ribbonColor, 1);
        graphics.fillCircle(x - 4, y - 12, 3);
        graphics.fillCircle(x + 4, y - 12, 3);
        graphics.fillCircle(x, y - 12, 2);
    }

    /**
     * Darken a color for shadows
     */
    darkenColor(color) {
        const r = Math.max(0, ((color >> 16) & 0xFF) - 30);
        const g = Math.max(0, ((color >> 8) & 0xFF) - 30);
        const b = Math.max(0, (color & 0xFF) - 30);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Open daily surprise box
     */
    openDailySurprise() {
        const dailyBonus = window.GameState?.get('dailyBonus') || {};
        const today = new Date().toDateString();

        if (dailyBonus.lastClaim === today) {
            this.showAlreadyClaimedMessage();
            return;
        }

        // Calculate reward based on streak
        const streak = dailyBonus.streak || 0;
        const reward = this.calculateDailyReward(streak);

        // Update state
        window.GameState?.set('dailyBonus.lastClaim', today);
        window.GameState?.set('dailyBonus.streak', streak + 1);
        window.GameState?.save();

        // Grant rewards
        if (window.EconomyManager && reward.coins) {
            window.EconomyManager.addCoins(reward.coins, 'daily_reward');
        }

        if (window.InventoryManager && reward.item) {
            window.InventoryManager.addItem(reward.item.type, 1, { rarity: reward.item.rarity });
        }

        // Show celebration
        this.showRewardCelebration(reward);

        // Refresh gift box visuals
        this.refreshDailyBox();

        // Update streak display
        this.updateStreak();
    }

    /**
     * Calculate daily reward based on streak
     */
    calculateDailyReward(streak) {
        const baseCoins = 50;
        const streakMultiplier = 1 + (Math.min(streak, 30) * 0.1); // Up to 4x at 30 days
        const coins = Math.floor(baseCoins * streakMultiplier);

        const reward = { coins };

        // Milestone bonus items
        if (streak === 6) reward.item = { type: 'egg', rarity: 'uncommon' };  // Day 7
        if (streak === 13) reward.item = { type: 'egg', rarity: 'rare' };     // Day 14
        if (streak === 29) reward.item = { type: 'egg', rarity: 'epic' };     // Day 30

        // Random bonus (15% chance)
        if (Math.random() < 0.15) {
            reward.bonus = { type: 'crystals', amount: 5 };
        }

        return reward;
    }

    /**
     * Show reward celebration overlay
     */
    showRewardCelebration(reward) {
        const { width, height } = this.scene.scale;

        // Dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2000);
        this.dailyRewardElements.push(overlay);

        // Reward panel
        const panelWidth = 240;
        const panelHeight = reward.item ? 220 : 180;
        const panelX = width / 2 - panelWidth / 2;
        const panelY = height / 2 - panelHeight / 2;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0xFFD700);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(2001);
        this.dailyRewardElements.push(panel);

        // Title
        const title = this.scene.add.text(width / 2, panelY + 30, 'Daily Reward!', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        title.setScrollFactor(0);
        title.setDepth(2002);
        this.dailyRewardElements.push(title);

        // Coin reward
        const coinText = this.scene.add.text(width / 2, panelY + 70, `+${reward.coins} Coins`, {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        coinText.setOrigin(0.5);
        coinText.setScrollFactor(0);
        coinText.setDepth(2002);
        this.dailyRewardElements.push(coinText);

        // Bonus item if present
        if (reward.item) {
            const itemText = this.scene.add.text(width / 2, panelY + 110, `+ ${reward.item.rarity.toUpperCase()} Egg!`, {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#9C27B0',
                fontStyle: 'bold'
            });
            itemText.setOrigin(0.5);
            itemText.setScrollFactor(0);
            itemText.setDepth(2002);
            this.dailyRewardElements.push(itemText);
        }

        // Bonus crystals if present
        if (reward.bonus) {
            const bonusText = this.scene.add.text(width / 2, panelY + (reward.item ? 140 : 110), `+ ${reward.bonus.amount} Bonus Crystals!`, {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#00BCD4'
            });
            bonusText.setOrigin(0.5);
            bonusText.setScrollFactor(0);
            bonusText.setDepth(2002);
            this.dailyRewardElements.push(bonusText);
        }

        // Celebration effects
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, width / 2, height / 2, {
                count: 30,
                color: [0xFFD700, 0xFF6B35, 0xFFFFFF],
                duration: 2000
            });
        }

        // Haptic feedback
        if (window.FeedbackManager) {
            window.FeedbackManager.vibrate('success');
        }

        // Sound effect
        if (window.AudioManager) {
            window.AudioManager.playAchievement();
        }

        // Collect button
        const btnY = panelY + panelHeight - 40;
        const collectBtn = this.scene.add.graphics();
        collectBtn.fillStyle(0x4CAF50, 1);
        collectBtn.fillRoundedRect(width / 2 - 50, btnY - 15, 100, 30, 8);
        collectBtn.setScrollFactor(0);
        collectBtn.setDepth(2002);
        this.dailyRewardElements.push(collectBtn);

        const collectText = this.scene.add.text(width / 2, btnY, 'Collect!', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        collectText.setOrigin(0.5);
        collectText.setScrollFactor(0);
        collectText.setDepth(2003);
        this.dailyRewardElements.push(collectText);

        // Make button interactive
        const btnHitArea = this.scene.add.zone(width / 2, btnY, 100, 30);
        btnHitArea.setInteractive();
        btnHitArea.setScrollFactor(0);
        btnHitArea.setDepth(2004);
        this.dailyRewardElements.push(btnHitArea);

        btnHitArea.on('pointerdown', () => {
            this.closeDailyRewardOverlay();
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
        });
    }

    /**
     * Close daily reward overlay
     */
    closeDailyRewardOverlay() {
        this.dailyRewardElements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        this.dailyRewardElements = [];
    }

    /**
     * Show already claimed message
     */
    showAlreadyClaimedMessage() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;

        const message = this.scene.add.text(
            width / 2,
            topBarPadding + topBarHeight + 20,
            'Come back tomorrow!',
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAAAAA',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 5 }
            }
        );
        message.setOrigin(0.5);
        message.setScrollFactor(0);
        message.setDepth(2000);

        // Fade out
        this.scene.tweens.add({
            targets: message,
            alpha: 0,
            y: message.y - 20,
            duration: 1500,
            delay: 1000,
            onComplete: () => message.destroy()
        });
    }

    /**
     * Refresh daily box visuals after claiming
     */
    refreshDailyBox() {
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Remove glow and badge
        if (this.giftGlow) {
            this.giftGlow.destroy();
            this.giftGlow = null;
        }
        if (this.giftBadge) {
            this.giftBadge.destroy();
            this.giftBadge = null;
        }

        // Redraw gift box as claimed
        if (this.giftBox) {
            this.drawGiftBox(this.giftBox, this.giftBoxX, centerY, false);
        }
    }

    /**
     * Create mini stat indicators (colored dots with values)
     */
    createMiniStatIndicators() {
        const { width, height } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;

        // Position compact stats below top bar
        const statsY = topBarPadding + topBarHeight + 8;
        const barWidth = 40;
        const barHeight = 6;
        const spacing = 55; // Space for icon + bar
        const startX = topBarPadding + 10;

        // Compact stat bar config - color-coded per plan
        const stats = [
            { key: 'happiness', icon: '💕', color: 0xFF69B4, name: 'Happiness' }, // Pink
            { key: 'energy', icon: '✨', color: 0xFFD700, name: 'Energy' },       // Gold
            { key: 'health', icon: '❤️', color: 0xFF4444, name: 'Health' }        // Red
        ];

        stats.forEach((stat, index) => {
            const x = startX + index * spacing;

            // Create stat indicator with bar
            const indicator = {
                key: stat.key,
                color: stat.color,
                name: stat.name,
                x: x,
                y: statsY,
                barWidth: barWidth,
                barHeight: barHeight,
                visible: false, // Start hidden, show based on threshold
                isCritical: false,
                criticalTween: null
            };

            // Container background (semi-transparent pill)
            indicator.container = this.scene.add.graphics();
            indicator.container.setScrollFactor(0);
            indicator.container.setDepth(2001);
            indicator.container.setVisible(false);

            // Icon text
            indicator.icon = this.scene.add.text(x, statsY, stat.icon, {
                fontSize: '12px'
            });
            indicator.icon.setOrigin(0, 0.5);
            indicator.icon.setScrollFactor(0);
            indicator.icon.setDepth(2002);
            indicator.icon.setVisible(false);

            // Progress bar background
            indicator.barBg = this.scene.add.graphics();
            indicator.barBg.setScrollFactor(0);
            indicator.barBg.setDepth(2001);
            indicator.barBg.setVisible(false);

            // Progress bar fill
            indicator.barFill = this.scene.add.graphics();
            indicator.barFill.setScrollFactor(0);
            indicator.barFill.setDepth(2002);
            indicator.barFill.setVisible(false);

            this.statIndicators.push(indicator);
            this.elements.push(indicator.container);
            this.elements.push(indicator.icon);
            this.elements.push(indicator.barBg);
            this.elements.push(indicator.barFill);
        });

        // Create "Happy!" indicator for when all stats are good
        this.createHappyIndicator(startX, statsY);

        // Create mood indicator after stats
        this.createMoodIndicator();
    }

    /**
     * Create the "Happy!" indicator shown when all stats are above threshold
     */
    createHappyIndicator(x, y) {
        // Container for happy indicator
        this.happyContainer = this.scene.add.graphics();
        this.happyContainer.setScrollFactor(0);
        this.happyContainer.setDepth(2001);

        // Draw pill background
        this.happyContainer.fillStyle(0x2A2A4E, 0.9);
        this.happyContainer.fillRoundedRect(x - 5, y - 10, 75, 20, 10);
        this.happyContainer.lineStyle(2, 0x4CAF50, 0.8);
        this.happyContainer.strokeRoundedRect(x - 5, y - 10, 75, 20, 10);

        this.elements.push(this.happyContainer);

        // Happy text with sparkle
        this.happyText = this.scene.add.text(x + 32, y, '✨ Happy!', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#4CAF50',
            fontStyle: 'bold'
        });
        this.happyText.setOrigin(0.5, 0.5);
        this.happyText.setScrollFactor(0);
        this.happyText.setDepth(2002);

        this.elements.push(this.happyText);

        // Initially visible (will be hidden when stats drop)
        this.happyIndicatorVisible = true;
    }

    /**
     * Create personality mood indicator (tappable to show personality panel)
     */
    createMoodIndicator() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position mood indicator to the left of coin display - responsive
        // On small screens, position closer to center to avoid overlap with stage indicator
        const moodX = width < 400 ? width / 2 - 20 : width / 2 - 30;

        // Background circle with glow effect
        this.moodBg = this.scene.add.graphics();
        this.moodBg.setScrollFactor(0);
        this.moodBg.setDepth(2001);

        // Draw background
        this.moodBg.fillStyle(0x1A1A2E, 0.8);
        this.moodBg.fillCircle(moodX, centerY, 14);
        this.moodBg.lineStyle(2, 0x9370DB, 0.8);
        this.moodBg.strokeCircle(moodX, centerY, 14);

        this.elements.push(this.moodBg);

        // Mood emoji
        this.moodIndicator = this.scene.add.text(moodX, centerY, '😊', {
            fontSize: '18px'
        });
        this.moodIndicator.setOrigin(0.5);
        this.moodIndicator.setScrollFactor(0);
        this.moodIndicator.setDepth(2002);

        // Make tappable to show personality panel
        this.moodIndicator.setInteractive();
        this.moodIndicator.on('pointerdown', () => this.onMoodTapped());

        this.elements.push(this.moodIndicator);

        // Initial update
        this.updateMood();
    }

    /**
     * Handle mood indicator tap - show personality panel
     */
    onMoodTapped() {
        // Emit event for GameScene to handle
        if (this.scene?.events) {
            this.scene.events.emit('showPersonalityPanel');
        }

        // Play button sound
        window.AudioManager?.playButtonClick?.();

        // Visual feedback
        this.scene.tweens.add({
            targets: this.moodIndicator,
            scale: { from: 1, to: 1.3 },
            duration: 100,
            yoyo: true,
            ease: 'Power2'
        });
    }

    /**
     * Update mood indicator based on personality state
     */
    updateMood() {
        if (!this.isVisible || !this.moodIndicator) return;

        const personalityState = window.GameState?.get('creature.personalityState');
        if (!personalityState) return;

        // Get current traits from PersonalitySystem
        let traits = null;
        if (window.PersonalitySystem?.getCurrentTraits) {
            traits = window.PersonalitySystem.getCurrentTraits(personalityState);
        }

        // Determine mood emoji based on personality traits
        const moodEmoji = this.getMoodEmoji(traits, personalityState);

        if (moodEmoji !== this.lastMoodEmoji) {
            this.moodIndicator.setText(moodEmoji);
            this.lastMoodEmoji = moodEmoji;

            // Subtle animation on mood change
            this.scene.tweens.add({
                targets: this.moodIndicator,
                scale: { from: 1.2, to: 1 },
                duration: 300,
                ease: 'Back.easeOut'
            });
        }
    }

    /**
     * Get mood emoji based on personality traits and state
     */
    getMoodEmoji(traits, personalityState) {
        if (!traits) return '😊';

        // Priority order: attachment, temperament, energy
        const temperament = traits.temperament?.label || 'playful';
        const energy = traits.energyLevel?.label || 'balanced';
        const attachment = traits.attachment?.label || 'balanced';

        // Map personality combinations to emojis
        if (attachment === 'clingy') {
            return '🥹'; // Pleading face - wants attention
        }
        if (attachment === 'independent') {
            return '😎'; // Cool - doesn't need you
        }

        // Temperament-based
        const temperamentEmojis = {
            'shy': '🥺',
            'gentle': '🥰',
            'playful': '😄',
            'mischievous': '😏',
            'bold': '😤'
        };

        if (temperamentEmojis[temperament]) {
            return temperamentEmojis[temperament];
        }

        // Energy-based fallback
        if (energy === 'hyper') {
            return '⚡';
        }
        if (energy === 'chill') {
            return '😌';
        }

        return '😊'; // Default happy
    }

    /**
     * Create compact stat bars positioned above bottom controls
     */
    createCompactStatBars() {
        const { width, height } = this.scene.scale;
        const { bottomPadding, statBarHeight, statBarGap } = this.layout;

        // Position stat bars above the action buttons
        const barY = height - bottomPadding - 20;
        const barWidth = width - 200; // Leave space for joystick and buttons
        const barX = 100; // After joystick area

        // Container for stat bars
        this.statBarContainer = this.scene.add.graphics();
        this.statBarContainer.setScrollFactor(0);
        this.statBarContainer.setDepth(2000);

        // Semi-transparent background
        this.statBarContainer.fillStyle(0x0D0D1A, 0.7);
        this.statBarContainer.fillRoundedRect(
            barX - 8,
            barY - 8,
            barWidth + 16,
            (statBarHeight + statBarGap) * 3 + 12,
            6
        );

        this.elements.push(this.statBarContainer);

        // Create individual stat bars
        const stats = [
            { key: 'health', label: '❤️', color: 0xFF6B6B },
            { key: 'happiness', label: '😊', color: 0xFFD166 },
            { key: 'energy', label: '⚡', color: 0x4ECDC4 }
        ];

        stats.forEach((stat, index) => {
            const y = barY + index * (statBarHeight + statBarGap);

            // Label icon
            const label = this.scene.add.text(barX - 2, y + statBarHeight / 2, stat.label, {
                fontSize: '10px'
            });
            label.setOrigin(1, 0.5);
            label.setScrollFactor(0);
            label.setDepth(2001);
            this.elements.push(label);

            // Bar background
            const barBg = this.scene.add.graphics();
            barBg.setScrollFactor(0);
            barBg.setDepth(2001);
            barBg.fillStyle(0x1A1A2E, 0.9);
            barBg.fillRoundedRect(barX + 4, y, barWidth - 8, statBarHeight, 3);
            this.elements.push(barBg);

            // Bar fill
            const barFill = this.scene.add.graphics();
            barFill.setScrollFactor(0);
            barFill.setDepth(2002);

            this.statBars[stat.key] = {
                x: barX + 4,
                y: y,
                width: barWidth - 8,
                height: statBarHeight,
                color: stat.color,
                fill: barFill,
                label: label
            };

            this.elements.push(barFill);
        });
    }

    /**
     * Setup event listeners for state changes
     */
    setupEventListeners() {
        // Store bound handlers for proper cleanup
        this.boundHandlers = {
            updateStats: () => this.updateStats(),
            updateLevel: () => this.updateLevel(),
            updateXP: () => this.updateXP(),
            updateStage: () => this.updateStage(),
            updateCoins: () => this.updateCoins(),
            updateMood: () => this.updateMood()
        };

        if (window.GameState) {
            window.GameState.on('changed:creature.stats', this.boundHandlers.updateStats);
            window.GameState.on('changed:creature.level', this.boundHandlers.updateLevel);
            window.GameState.on('changed:creature.experience', this.boundHandlers.updateXP);
            window.GameState.on('changed:creature.lifecycle.stage', this.boundHandlers.updateStage);
            window.GameState.on('creature:evolved', this.boundHandlers.updateStage);
            window.GameState.on('changed:creature.personalityState', this.boundHandlers.updateMood);
        }

        if (window.EconomyManager) {
            window.EconomyManager.on('coins:added', this.boundHandlers.updateCoins);
            window.EconomyManager.on('coins:spent', this.boundHandlers.updateCoins);
        }
    }

    /**
     * Update all HUD elements
     */
    update() {
        if (!this.isVisible) return;

        this.updateStats();
        this.updateLevel();
        this.updateXP();
        this.updateCoins();
        this.updateMood();
        this.updateStage();
        this.updateStreak();
    }

    /**
     * Update stage indicator based on lifecycle state
     */
    updateStage() {
        if (!this.isVisible || !this.stageIndicator) return;

        const currentStage = window.GameState?.get('creature.lifecycle.stage') || 'baby';

        if (currentStage !== this.lastStage) {
            // Stage icons mapping
            const stageIcons = {
                baby: '🐣',
                juvenile: '🌱',
                adult: '✨',
                elder: '👑'
            };

            const stageIcon = stageIcons[currentStage] || '🐣';
            this.stageIndicator.setText(stageIcon);
            this.lastStage = currentStage;

            // Evolution animation
            this.scene.tweens.add({
                targets: this.stageIndicator,
                scale: { from: 1.5, to: 1 },
                duration: 500,
                ease: 'Back.easeOut'
            });

            // Flash the stage background
            if (this.stageBg) {
                const { width } = this.scene.scale;
                const { topBarPadding, topBarHeight } = this.layout;
                const centerY = topBarPadding + topBarHeight / 2;
                // Use responsive positioning matching createStageIndicator
                const stageX = width < 400 ? topBarPadding + 125 : topBarPadding + 150;

                this.stageBg.clear();
                this.stageBg.fillStyle(0xFFD700, 0.9);
                this.stageBg.fillRoundedRect(stageX, centerY - 10, 50, 20, 10);

                // Fade back to normal
                this.scene.time.delayedCall(500, () => {
                    if (this.stageBg) {
                        this.stageBg.clear();
                        this.stageBg.fillStyle(0x3A3A6E, 0.9);
                        this.stageBg.fillRoundedRect(stageX, centerY - 10, 50, 20, 10);
                        this.stageBg.lineStyle(1, 0x7B68EE, 0.6);
                        this.stageBg.strokeRoundedRect(stageX, centerY - 10, 50, 20, 10);
                    }
                });
            }
        }
    }

    /**
     * Update stat displays - compact view with threshold-based visibility
     */
    updateStats() {
        if (!this.isVisible) return;

        const stats = window.GameState?.get('creature.stats') || { health: 100, happiness: 100, energy: 100 };
        const SHOW_THRESHOLD = 50;  // Show stat if below 50%
        const CRITICAL_THRESHOLD = 25; // Pulse animation if below 25%

        let anyStatLow = false;

        // Update compact stat indicators - only show below threshold
        this.statIndicators.forEach((indicator) => {
            const value = stats[indicator.key] || 0;
            const percentage = value; // Stats are 0-100
            const shouldShow = percentage < SHOW_THRESHOLD;
            const isCritical = percentage < CRITICAL_THRESHOLD;

            if (shouldShow) {
                anyStatLow = true;
            }

            // Show/hide based on threshold
            if (shouldShow !== indicator.visible) {
                indicator.visible = shouldShow;
                indicator.container?.setVisible(shouldShow);
                indicator.icon?.setVisible(shouldShow);
                indicator.barBg?.setVisible(shouldShow);
                indicator.barFill?.setVisible(shouldShow);
            }

            // Update visuals if visible
            if (shouldShow) {
                const barX = indicator.x + 16; // After icon
                const barY = indicator.y;

                // Clear and redraw container background
                indicator.container.clear();
                indicator.container.fillStyle(0x1A1A2E, 0.9);
                indicator.container.fillRoundedRect(
                    indicator.x - 4, barY - 8,
                    indicator.barWidth + 24, 16,
                    8
                );

                // Draw bar background
                indicator.barBg.clear();
                indicator.barBg.fillStyle(0x333333, 0.8);
                indicator.barBg.fillRoundedRect(
                    barX, barY - indicator.barHeight / 2,
                    indicator.barWidth, indicator.barHeight,
                    3
                );

                // Draw bar fill
                const fillWidth = (percentage / 100) * indicator.barWidth;
                indicator.barFill.clear();

                if (fillWidth > 0) {
                    // Color intensifies as stat drops
                    const fillColor = isCritical ? 0xFF0000 : indicator.color;
                    indicator.barFill.fillStyle(fillColor, 0.9);
                    indicator.barFill.fillRoundedRect(
                        barX, barY - indicator.barHeight / 2,
                        Math.max(2, fillWidth), indicator.barHeight,
                        3
                    );
                }

                // Add border with warning color
                const borderColor = isCritical ? 0xFF0000 : (percentage < 35 ? 0xFFAA00 : indicator.color);
                indicator.container.lineStyle(1, borderColor, 0.8);
                indicator.container.strokeRoundedRect(
                    indicator.x - 4, barY - 8,
                    indicator.barWidth + 24, 16,
                    8
                );

                // Handle critical pulsing animation
                if (isCritical && !indicator.isCritical) {
                    // Start pulsing
                    indicator.isCritical = true;
                    indicator.criticalTween = this.scene.tweens.add({
                        targets: indicator.icon,
                        scale: { from: 1, to: 1.3 },
                        alpha: { from: 1, to: 0.6 },
                        duration: 400,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else if (!isCritical && indicator.isCritical) {
                    // Stop pulsing
                    indicator.isCritical = false;
                    if (indicator.criticalTween) {
                        indicator.criticalTween.stop();
                        indicator.criticalTween = null;
                    }
                    indicator.icon?.setScale(1);
                    indicator.icon?.setAlpha(1);
                }
            } else {
                // Stop any pulsing when hidden
                if (indicator.isCritical) {
                    indicator.isCritical = false;
                    if (indicator.criticalTween) {
                        indicator.criticalTween.stop();
                        indicator.criticalTween = null;
                    }
                }
            }
        });

        // Show/hide "Happy!" indicator based on whether all stats are good
        if (this.happyContainer && this.happyText) {
            const shouldShowHappy = !anyStatLow;
            if (shouldShowHappy !== this.happyIndicatorVisible) {
                this.happyIndicatorVisible = shouldShowHappy;
                this.happyContainer.setVisible(shouldShowHappy);
                this.happyText.setVisible(shouldShowHappy);

                // Animate in/out
                if (shouldShowHappy) {
                    this.scene.tweens.add({
                        targets: [this.happyContainer, this.happyText],
                        alpha: { from: 0, to: 1 },
                        scale: { from: 0.8, to: 1 },
                        duration: 300,
                        ease: 'Back.easeOut'
                    });
                }
            }
        }

        // Update bottom stat bars (legacy support)
        Object.keys(this.statBars).forEach((key) => {
            const bar = this.statBars[key];
            const value = stats[key] || 0;
            const fillWidth = (value / 100) * bar.width;

            bar.fill.clear();

            // Draw filled portion with gradient effect
            if (fillWidth > 0) {
                bar.fill.fillStyle(bar.color, 0.9);
                bar.fill.fillRoundedRect(
                    bar.x + 1,
                    bar.y + 1,
                    Math.max(0, fillWidth - 2),
                    bar.height - 2,
                    2
                );
            }
        });

        this.lastStats = { ...stats };
    }

    /**
     * Update level display
     */
    updateLevel() {
        if (!this.isVisible || !this.levelText) return;

        const level = window.GameState?.get('creature.level') || 1;
        this.levelText.setText(String(level));
        this.lastLevel = level;
    }

    /**
     * Update XP bar
     */
    updateXP() {
        if (!this.isVisible || !this.xpBarFill) return;

        const xp = window.GameState?.get('creature.experience') || 0;
        const fillWidth = (xp / 100) * this.xpBarWidth;

        this.xpBarFill.clear();

        // Draw XP fill with purple gradient
        if (fillWidth > 1) {
            this.xpBarFill.fillStyle(0x9370DB, 0.9);
            this.xpBarFill.fillRoundedRect(
                this.xpBarX + 1,
                this.xpBarY + 1,
                Math.max(0, fillWidth - 2),
                this.xpBarHeight - 2,
                3
            );
        }

        this.lastXP = xp;
    }

    /**
     * Update coin display
     */
    updateCoins() {
        if (!this.isVisible || !this.coinText) return;

        const coins = window.EconomyManager?.getBalance() || 0;

        // Format with K/M for large amounts
        let displayText;
        if (coins >= 1000000) {
            displayText = (coins / 1000000).toFixed(1) + 'M';
        } else if (coins >= 1000) {
            displayText = (coins / 1000).toFixed(1) + 'K';
        } else {
            displayText = String(coins);
        }

        this.coinText.setText(displayText);
        this.lastCoins = coins;
    }

    /**
     * Show critical stat warning animation
     */
    showCriticalWarning(statKey) {
        const indicator = this.statIndicators.find(i => i.key === statKey);
        if (!indicator) return;

        // Pulse animation
        this.scene.tweens.add({
            targets: indicator.icon,
            scale: { from: 1, to: 1.3 },
            alpha: { from: 1, to: 0.5 },
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Hide the mobile HUD
     */
    hide() {
        this.elements.forEach((el) => {
            if (el && el.setVisible) {
                el.setVisible(false);
            }
        });
        this.isVisible = false;
    }

    /**
     * Show the mobile HUD
     */
    show() {
        this.elements.forEach((el) => {
            if (el && el.setVisible) {
                el.setVisible(true);
            }
        });
        this.isVisible = true;
        this.update();
    }

    /**
     * Clean up all resources
     */
    destroy() {
        console.log('[MobileHUD] Destroying mobile HUD');

        // Remove ALL event listeners using bound handlers
        if (this.boundHandlers && window.GameState) {
            window.GameState.off('changed:creature.stats', this.boundHandlers.updateStats);
            window.GameState.off('changed:creature.level', this.boundHandlers.updateLevel);
            window.GameState.off('changed:creature.experience', this.boundHandlers.updateXP);
            window.GameState.off('changed:creature.lifecycle.stage', this.boundHandlers.updateStage);
            window.GameState.off('creature:evolved', this.boundHandlers.updateStage);
            window.GameState.off('changed:creature.personalityState', this.boundHandlers.updateMood);
        }

        if (this.boundHandlers && window.EconomyManager) {
            window.EconomyManager.off('coins:added', this.boundHandlers.updateCoins);
            window.EconomyManager.off('coins:spent', this.boundHandlers.updateCoins);
        }

        // Clear bound handlers
        this.boundHandlers = null;

        // Stop any critical stat tweens
        this.statIndicators.forEach((indicator) => {
            if (indicator.criticalTween) {
                indicator.criticalTween.stop();
                indicator.criticalTween = null;
            }
        });

        // Destroy all elements
        this.elements.forEach((el) => {
            if (el && el.destroy) {
                el.destroy();
            }
        });

        // Clear happy indicator references
        this.happyContainer = null;
        this.happyText = null;
        this.happyIndicatorVisible = false;

        this.elements = [];
        this.statIndicators = [];
        this.statBars = {};
        this.isVisible = false;
    }
}

// Export for use in game
if (typeof window !== 'undefined') {
    window.MobileHUD = MobileHUD;
}

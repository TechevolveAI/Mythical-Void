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
     */
    isMobile() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 768;
        return isTouchDevice && isSmallScreen;
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
        this.topBarBg = this.scene.add.graphics();
        this.topBarBg.setScrollFactor(0);
        this.topBarBg.setDepth(1500);

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

        // Create coin display (center-right)
        this.createCoinDisplay();

        // Create mini stat indicators (right side)
        this.createMiniStatIndicators();
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
        this.levelBadge.setDepth(1501);

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
        this.levelText.setDepth(1502);
        this.elements.push(this.levelText);

        // XP bar (horizontal progress bar next to level)
        const xpBarX = topBarPadding + 42;
        const xpBarWidth = 70;
        const xpBarHeight = 8;

        // XP bar background
        this.xpBarBg = this.scene.add.graphics();
        this.xpBarBg.setScrollFactor(0);
        this.xpBarBg.setDepth(1501);
        this.xpBarBg.fillStyle(0x1A1A2E, 0.9);
        this.xpBarBg.fillRoundedRect(xpBarX, centerY - xpBarHeight / 2, xpBarWidth, xpBarHeight, 4);
        this.elements.push(this.xpBarBg);

        // XP bar fill
        this.xpBarFill = this.scene.add.graphics();
        this.xpBarFill.setScrollFactor(0);
        this.xpBarFill.setDepth(1502);
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
        this.xpLabel.setDepth(1501);
        this.elements.push(this.xpLabel);
    }

    /**
     * Create coin display
     */
    createCoinDisplay() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position coins in center-right area
        const coinX = width / 2 + 20;

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
            this.coinIcon.setDepth(1501);
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
        this.coinText.setDepth(1501);
        this.elements.push(this.coinText);
    }

    /**
     * Create mini stat indicators (colored dots with values)
     */
    createMiniStatIndicators() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position mini stats on right side
        const startX = width - topBarPadding - 90;
        const spacing = 28;

        const stats = [
            { key: 'health', icon: '❤️', color: 0xFF6B6B },
            { key: 'happiness', icon: '😊', color: 0xFFD166 },
            { key: 'energy', icon: '⚡', color: 0x4ECDC4 }
        ];

        stats.forEach((stat, index) => {
            const x = startX + index * spacing;

            // Create stat indicator
            const indicator = {
                key: stat.key,
                color: stat.color,
                x: x,
                y: centerY
            };

            // Background circle
            indicator.bg = this.scene.add.graphics();
            indicator.bg.setScrollFactor(0);
            indicator.bg.setDepth(1501);

            // Icon text
            indicator.icon = this.scene.add.text(x, centerY, stat.icon, {
                fontSize: '14px'
            });
            indicator.icon.setOrigin(0.5);
            indicator.icon.setScrollFactor(0);
            indicator.icon.setDepth(1502);

            this.statIndicators.push(indicator);
            this.elements.push(indicator.bg);
            this.elements.push(indicator.icon);
        });

        // Create mood indicator after stats
        this.createMoodIndicator();
    }

    /**
     * Create personality mood indicator (tappable to show personality panel)
     */
    createMoodIndicator() {
        const { width } = this.scene.scale;
        const { topBarPadding, topBarHeight } = this.layout;
        const centerY = topBarPadding + topBarHeight / 2;

        // Position mood indicator to the left of coin display
        const moodX = width / 2 - 30;

        // Background circle with glow effect
        this.moodBg = this.scene.add.graphics();
        this.moodBg.setScrollFactor(0);
        this.moodBg.setDepth(1501);

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
        this.moodIndicator.setDepth(1502);

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
        this.statBarContainer.setDepth(1500);

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
            label.setDepth(1501);
            this.elements.push(label);

            // Bar background
            const barBg = this.scene.add.graphics();
            barBg.setScrollFactor(0);
            barBg.setDepth(1501);
            barBg.fillStyle(0x1A1A2E, 0.9);
            barBg.fillRoundedRect(barX + 4, y, barWidth - 8, statBarHeight, 3);
            this.elements.push(barBg);

            // Bar fill
            const barFill = this.scene.add.graphics();
            barFill.setScrollFactor(0);
            barFill.setDepth(1502);

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
        if (window.GameState) {
            window.GameState.on('changed:creature.stats', () => this.updateStats());
            window.GameState.on('changed:creature.level', () => this.updateLevel());
            window.GameState.on('changed:creature.experience', () => this.updateXP());
        }

        if (window.EconomyManager) {
            window.EconomyManager.on('coins:added', () => this.updateCoins());
            window.EconomyManager.on('coins:spent', () => this.updateCoins());
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
    }

    /**
     * Update stat displays
     */
    updateStats() {
        if (!this.isVisible) return;

        const stats = window.GameState?.get('creature.stats') || { health: 100, happiness: 100, energy: 100 };

        // Update mini stat indicators in top bar
        this.statIndicators.forEach((indicator) => {
            const value = stats[indicator.key] || 0;
            const percentage = value / 100;

            // Determine color based on level
            let bgAlpha = 0.3;
            let ringColor = indicator.color;

            if (percentage <= 0.2) {
                bgAlpha = 0.8;
                ringColor = 0xFF0000; // Critical - red
            } else if (percentage <= 0.4) {
                bgAlpha = 0.5;
                ringColor = 0xFFAA00; // Warning - orange
            }

            // Redraw background circle
            indicator.bg.clear();
            indicator.bg.fillStyle(0x1A1A2E, bgAlpha);
            indicator.bg.fillCircle(indicator.x, indicator.y, 11);
            indicator.bg.lineStyle(2, ringColor, percentage);
            indicator.bg.strokeCircle(indicator.x, indicator.y, 11);
        });

        // Update bottom stat bars
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

        // Remove event listeners
        if (window.GameState) {
            window.GameState.off('changed:creature.stats');
            window.GameState.off('changed:creature.level');
            window.GameState.off('changed:creature.experience');
        }

        if (window.EconomyManager) {
            window.EconomyManager.off('coins:added');
            window.EconomyManager.off('coins:spent');
        }

        // Destroy all elements
        this.elements.forEach((el) => {
            if (el && el.destroy) {
                el.destroy();
            }
        });

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

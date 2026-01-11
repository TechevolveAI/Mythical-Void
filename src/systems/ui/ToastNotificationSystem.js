/**
 * ToastNotificationSystem - Displays pickup notifications and discovery toasts
 * Shows item name, sprite, rarity indicator, rewards, and auto-dismisses
 */

class ToastNotificationSystem {
    constructor() {
        this.initialized = false;
        this.activeToasts = [];
        this.toastQueue = [];
        this.maxVisibleToasts = 3;
        this.toastDuration = 2500; // 2.5 seconds
        this.toastSpacing = 90; // Vertical spacing between toasts
        this.baseY = 100; // Starting Y position from top

        // Rarity color scheme (standard: white/green/blue/purple/gold)
        this.rarityColors = {
            common: { primary: 0x9E9E9E, glow: 0xBDBDBD, name: 'Common' },
            uncommon: { primary: 0x4CAF50, glow: 0x81C784, name: 'Uncommon' },
            rare: { primary: 0x2196F3, glow: 0x64B5F6, name: 'Rare' },
            epic: { primary: 0x9C27B0, glow: 0xBA68C8, name: 'Epic' },
            biome: { primary: 0x9C27B0, glow: 0xBA68C8, name: 'Biome' },
            legendary: { primary: 0xFFD700, glow: 0xFFE082, name: 'Legendary' },
            lore: { primary: 0x00BCD4, glow: 0x4DD0E1, name: 'Lore' }
        };
    }

    /**
     * Initialize the toast system
     */
    init() {
        if (this.initialized) return;
        console.log('[ToastNotificationSystem] Initializing...');
        this.initialized = true;
    }

    /**
     * Show a collectible pickup toast
     * @param {Phaser.Scene} scene - The active scene
     * @param {Object} options - Toast options
     */
    showPickupToast(scene, options = {}) {
        const {
            itemName = 'Unknown Item',
            itemId = null,
            rarity = 'common',
            rewards = {},
            description = '',
            isFirstDiscovery = false,
            textureName = null // Programmatic sprite texture
        } = options;

        // Queue if at max visible toasts
        if (this.activeToasts.length >= this.maxVisibleToasts) {
            this.toastQueue.push({ scene, options });
            return;
        }

        this.createToast(scene, {
            itemName,
            itemId,
            rarity,
            rewards,
            description,
            isFirstDiscovery,
            textureName
        });
    }

    /**
     * Create the toast visual
     */
    createToast(scene, data) {
        const { width } = scene.scale;
        const rarityInfo = this.rarityColors[data.rarity] || this.rarityColors.common;

        // Calculate Y position based on active toasts
        const toastIndex = this.activeToasts.length;
        const yPos = this.baseY + (toastIndex * this.toastSpacing);

        // Create container
        const container = scene.add.container(width + 300, yPos);
        container.setScrollFactor(0);
        container.setDepth(5000);

        const toastWidth = 280;
        const toastHeight = 75;

        // Background panel with rarity-colored border
        const bg = scene.add.graphics();
        bg.fillStyle(0x1A1A3E, 0.95);
        bg.fillRoundedRect(0, 0, toastWidth, toastHeight, 12);
        bg.lineStyle(3, rarityInfo.primary, 1);
        bg.strokeRoundedRect(0, 0, toastWidth, toastHeight, 12);
        container.add(bg);

        // Rarity glow effect on left edge
        const glowBar = scene.add.graphics();
        glowBar.fillStyle(rarityInfo.glow, 0.6);
        glowBar.fillRoundedRect(0, 0, 6, toastHeight, { tl: 12, bl: 12, tr: 0, br: 0 });
        container.add(glowBar);

        // Item sprite or fallback icon
        const spriteX = 40;
        const spriteY = toastHeight / 2;

        if (data.textureName && scene.textures.exists(data.textureName)) {
            const itemSprite = scene.add.image(spriteX, spriteY, data.textureName);
            itemSprite.setScale(0.6);
            container.add(itemSprite);
        } else {
            // Fallback: draw a simple gem shape based on rarity
            const fallbackIcon = scene.add.graphics();
            fallbackIcon.fillStyle(rarityInfo.primary, 1);
            fallbackIcon.fillCircle(spriteX, spriteY, 18);
            fallbackIcon.lineStyle(2, 0xFFFFFF, 0.5);
            fallbackIcon.strokeCircle(spriteX, spriteY, 18);
            container.add(fallbackIcon);
        }

        // Item name
        const nameText = scene.add.text(70, 12, data.itemName, {
            fontSize: '16px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        container.add(nameText);

        // Rarity badge
        const rarityBadge = scene.add.text(70, 32, rarityInfo.name.toUpperCase(), {
            fontSize: '10px',
            color: Phaser.Display.Color.IntegerToColor(rarityInfo.primary).rgba,
            fontStyle: 'bold'
        });
        container.add(rarityBadge);

        // Rewards text
        let rewardParts = [];
        if (data.rewards.coins) rewardParts.push(`+${data.rewards.coins} coins`);
        if (data.rewards.xp) rewardParts.push(`+${data.rewards.xp} XP`);
        if (data.rewards.discoveryBonus) rewardParts.push(`+${data.rewards.discoveryBonus} bonus`);

        if (rewardParts.length > 0) {
            const rewardText = scene.add.text(70, 50, rewardParts.join('  '), {
                fontSize: '12px',
                color: '#FFD700'
            });
            container.add(rewardText);
        }

        // First discovery indicator
        if (data.isFirstDiscovery) {
            const newBadge = scene.add.graphics();
            newBadge.fillStyle(0x00FF88, 1);
            newBadge.fillRoundedRect(toastWidth - 50, 8, 42, 18, 4);
            container.add(newBadge);

            const newText = scene.add.text(toastWidth - 29, 17, 'NEW!', {
                fontSize: '11px',
                color: '#000000',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(newText);

            // Sparkle effect for new discoveries
            this.addSparkles(scene, container, toastWidth, toastHeight);
        }

        // Track this toast
        const toastData = {
            container,
            startTime: Date.now(),
            yPos
        };
        this.activeToasts.push(toastData);

        // Slide in animation
        scene.tweens.add({
            targets: container,
            x: width - toastWidth - 20,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // Auto-dismiss after duration
        scene.time.delayedCall(this.toastDuration, () => {
            this.dismissToast(scene, toastData);
        });

        // Play pickup sound
        if (window.AudioManager) {
            if (data.rarity === 'legendary' || data.rarity === 'epic') {
                window.AudioManager.playAchievement?.();
            } else if (data.isFirstDiscovery) {
                window.AudioManager.playLevelUp?.();
            } else {
                window.AudioManager.playCoinCollect?.();
            }
        }
    }

    /**
     * Add sparkle effects to toast
     */
    addSparkles(scene, container, toastWidth, toastHeight) {
        const sparklePositions = [
            { x: 15, y: 15 },
            { x: toastWidth - 15, y: toastHeight - 15 },
            { x: toastWidth / 2, y: 10 }
        ];

        sparklePositions.forEach((pos, i) => {
            const sparkle = scene.add.graphics();
            sparkle.fillStyle(0xFFFFFF, 0.8);

            // Draw a small star shape
            const cx = pos.x;
            const cy = pos.y;
            const size = 4;
            sparkle.beginPath();
            for (let j = 0; j < 4; j++) {
                const angle = (j * Math.PI / 2) - Math.PI / 4;
                const x = cx + Math.cos(angle) * size;
                const y = cy + Math.sin(angle) * size;
                if (j === 0) sparkle.moveTo(x, y);
                else sparkle.lineTo(x, y);

                const innerAngle = angle + Math.PI / 4;
                const innerX = cx + Math.cos(innerAngle) * (size / 2);
                const innerY = cy + Math.sin(innerAngle) * (size / 2);
                sparkle.lineTo(innerX, innerY);
            }
            sparkle.closePath();
            sparkle.fill();
            container.add(sparkle);

            // Twinkle animation
            scene.tweens.add({
                targets: sparkle,
                alpha: { from: 0.3, to: 1 },
                scale: { from: 0.8, to: 1.2 },
                duration: 400,
                yoyo: true,
                repeat: -1,
                delay: i * 150
            });
        });
    }

    /**
     * Dismiss a toast with animation
     */
    dismissToast(scene, toastData) {
        const { container } = toastData;
        const { width } = scene.scale;

        // Slide out animation
        scene.tweens.add({
            targets: container,
            x: width + 300,
            duration: 250,
            ease: 'Back.easeIn',
            onComplete: () => {
                container.destroy();

                // Remove from active toasts
                const index = this.activeToasts.indexOf(toastData);
                if (index > -1) {
                    this.activeToasts.splice(index, 1);
                }

                // Reposition remaining toasts
                this.repositionToasts(scene);

                // Process queue
                this.processQueue();
            }
        });
    }

    /**
     * Reposition remaining toasts after one is dismissed
     */
    repositionToasts(scene) {
        this.activeToasts.forEach((toast, index) => {
            const targetY = this.baseY + (index * this.toastSpacing);
            if (toast.container.y !== targetY) {
                scene.tweens.add({
                    targets: toast.container,
                    y: targetY,
                    duration: 200,
                    ease: 'Sine.easeOut'
                });
            }
        });
    }

    /**
     * Process queued toasts
     */
    processQueue() {
        if (this.toastQueue.length > 0 && this.activeToasts.length < this.maxVisibleToasts) {
            const next = this.toastQueue.shift();
            this.showPickupToast(next.scene, next.options);
        }
    }

    /**
     * Show a simple text notification toast
     */
    showSimpleToast(scene, message, options = {}) {
        const {
            color = 0x7B68EE,
            duration = 2000,
            icon = ''
        } = options;

        const { width } = scene.scale;
        const container = scene.add.container(width / 2, -50);
        container.setScrollFactor(0);
        container.setDepth(5000);

        const text = icon ? `${icon} ${message}` : message;
        const textObj = scene.add.text(0, 0, text, {
            fontSize: '18px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            padding: { x: 20, y: 12 },
            backgroundColor: `#${color.toString(16).padStart(6, '0')}`
        }).setOrigin(0.5);

        // Add rounded background manually
        const bg = scene.add.graphics();
        const bgWidth = textObj.width + 10;
        const bgHeight = textObj.height + 10;
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 8);

        container.add(bg);
        container.add(textObj);

        // Slide down
        scene.tweens.add({
            targets: container,
            y: 60,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                scene.time.delayedCall(duration, () => {
                    scene.tweens.add({
                        targets: container,
                        y: -50,
                        alpha: 0,
                        duration: 250,
                        onComplete: () => container.destroy()
                    });
                });
            }
        });
    }

    /**
     * Show a milestone/achievement toast (larger, more celebratory)
     */
    showMilestoneToast(scene, options = {}) {
        const {
            title = 'Milestone Reached!',
            subtitle = '',
            icon = '',
            color = 0xFFD700,
            rewards = null
        } = options;

        const { width, height } = scene.scale;

        // Full-width banner
        const container = scene.add.container(width / 2, -80);
        container.setScrollFactor(0);
        container.setDepth(5500);

        const bannerWidth = Math.min(400, width - 40);
        const bannerHeight = 100;

        // Background
        const bg = scene.add.graphics();
        bg.fillStyle(0x1A1A3E, 0.95);
        bg.fillRoundedRect(-bannerWidth / 2, -bannerHeight / 2, bannerWidth, bannerHeight, 15);
        bg.lineStyle(4, color, 1);
        bg.strokeRoundedRect(-bannerWidth / 2, -bannerHeight / 2, bannerWidth, bannerHeight, 15);
        container.add(bg);

        // Glow effect
        const glow = scene.add.graphics();
        glow.fillStyle(color, 0.15);
        glow.fillRoundedRect(-bannerWidth / 2 - 10, -bannerHeight / 2 - 10, bannerWidth + 20, bannerHeight + 20, 20);
        container.addAt(glow, 0);

        // Title
        const titleText = scene.add.text(0, -25, title, {
            fontSize: '22px',
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(titleText);

        // Subtitle
        if (subtitle) {
            const subText = scene.add.text(0, 5, subtitle, {
                fontSize: '14px',
                color: '#FFFFFF'
            }).setOrigin(0.5);
            container.add(subText);
        }

        // Rewards
        if (rewards) {
            let rewardStr = [];
            if (rewards.coins) rewardStr.push(`+${rewards.coins} coins`);
            if (rewards.xp) rewardStr.push(`+${rewards.xp} XP`);
            if (rewards.item) rewardStr.push(`+${rewards.item}`);

            const rewardText = scene.add.text(0, 30, rewardStr.join('  |  '), {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(rewardText);
        }

        // Animate glow pulse
        scene.tweens.add({
            targets: glow,
            alpha: { from: 0.15, to: 0.3 },
            scaleX: { from: 1, to: 1.05 },
            scaleY: { from: 1, to: 1.05 },
            duration: 800,
            yoyo: true,
            repeat: 3
        });

        // Slide down with bounce
        scene.tweens.add({
            targets: container,
            y: 100,
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                scene.time.delayedCall(3000, () => {
                    scene.tweens.add({
                        targets: container,
                        y: -100,
                        alpha: 0,
                        duration: 400,
                        ease: 'Back.easeIn',
                        onComplete: () => container.destroy()
                    });
                });
            }
        });

        // Play celebration sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement?.();
        }

        // Particle burst
        if (window.FXLibrary) {
            scene.time.delayedCall(500, () => {
                window.FXLibrary.stardustBurst?.(scene, width / 2, 100, {
                    count: 20,
                    color: [color, 0xFFFFFF, 0xFFA500],
                    duration: 1500
                });
            });
        }
    }

    /**
     * Clear all active toasts
     */
    clearAll(scene) {
        this.activeToasts.forEach(toast => {
            if (toast.container) {
                toast.container.destroy();
            }
        });
        this.activeToasts = [];
        this.toastQueue = [];
    }
}

// Create singleton and export
const toastNotificationSystem = new ToastNotificationSystem();

if (typeof window !== 'undefined') {
    window.ToastNotificationSystem = toastNotificationSystem;
}

export default toastNotificationSystem;

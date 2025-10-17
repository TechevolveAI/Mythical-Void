/**
 * Mobile Helper Utilities
 * Provides responsive sizing and touch-optimized controls for mobile devices
 */

export class MobileHelpers {
    /**
     * Check if device is mobile/touch
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    /**
     * Get responsive button size based on screen dimensions
     * @param {Phaser.Scale.ScaleManager} scaleManager
     * @param {Object} baseSize - {width: 340, height: 95}
     * @returns {Object} - {width, height}
     */
    static getButtonSize(scaleManager, baseSize = { width: 340, height: 95 }) {
        const screenWidth = scaleManager.width;
        const screenHeight = scaleManager.height;
        const isMobile = this.isMobile();

        if (isMobile) {
            // Mobile: Scale up for touch, but cap at screen width
            const scale = Math.min(screenWidth / 800, 1.2);
            return {
                width: Math.min(baseSize.width * scale * 1.15, screenWidth * 0.85),
                height: Math.max(baseSize.height * scale * 1.15, 70) // Minimum 70px for touch
            };
        } else {
            // Desktop: Use base size
            return baseSize;
        }
    }

    /**
     * Get responsive font size
     * @param {Phaser.Scale.ScaleManager} scaleManager
     * @param {number} baseSize - Base font size in pixels
     * @returns {string} - Font size with 'px' suffix
     */
    static getFontSize(scaleManager, baseSize = 28) {
        const screenWidth = scaleManager.width;
        const isMobile = this.isMobile();

        if (isMobile) {
            // Scale font based on screen width
            const scale = screenWidth / 800;
            return `${Math.max(Math.round(baseSize * scale), 18)}px`;
        }
        return `${baseSize}px`;
    }

    /**
     * Create touch-optimized hit area (invisible padding around button)
     * @param {Phaser.GameObjects.Container} button
     * @param {number} width
     * @param {number} height
     * @param {number} padding - Extra touch area in pixels
     */
    static setTouchHitArea(button, width, height, padding = 20) {
        const isMobile = this.isMobile();
        const hitPadding = isMobile ? padding : 0;

        button.setSize(width + hitPadding * 2, height + hitPadding * 2);
        button.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(
                -hitPadding,
                -hitPadding,
                width + hitPadding * 2,
                height + hitPadding * 2
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            cursor: 'pointer',
            useHandCursor: !isMobile // No hand cursor on mobile
        });
    }

    /**
     * Get responsive padding/spacing
     * @param {Phaser.Scale.ScaleManager} scaleManager
     * @param {number} basePadding
     * @returns {number}
     */
    static getPadding(scaleManager, basePadding = 20) {
        const isMobile = this.isMobile();
        if (isMobile) {
            return Math.max(basePadding * 0.7, 10);
        }
        return basePadding;
    }

    /**
     * Get responsive text scale for small text (descriptions, labels)
     * @param {Phaser.Scale.ScaleManager} scaleManager
     * @param {number} baseSize
     * @returns {string}
     */
    static getSmallFontSize(scaleManager, baseSize = 16) {
        const screenWidth = scaleManager.width;
        const isMobile = this.isMobile();

        if (isMobile) {
            const scale = screenWidth / 800;
            return `${Math.max(Math.round(baseSize * scale), 14)}px`;
        }
        return `${baseSize}px`;
    }

    /**
     * Add mobile-friendly touch feedback (visual press effect)
     * @param {Phaser.Scene} scene
     * @param {Phaser.GameObjects.Container} button
     */
    static addTouchFeedback(scene, button) {
        button.on('pointerdown', () => {
            scene.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: 'Power2'
            });
        });

        button.on('pointerover', () => {
            if (!this.isMobile()) {
                scene.tweens.add({
                    targets: button,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }
        });

        button.on('pointerout', () => {
            if (!this.isMobile()) {
                scene.tweens.add({
                    targets: button,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 200,
                    ease: 'Back.easeIn'
                });
            }
        });
    }

    /**
     * Get responsive position based on screen size
     * @param {Phaser.Scale.ScaleManager} scaleManager
     * @param {Object} basePosition - {x: 400, y: 300}
     * @returns {Object} - {x, y}
     */
    static getResponsivePosition(scaleManager, basePosition) {
        const { width, height } = scaleManager;

        // Scale positions proportionally
        return {
            x: (basePosition.x / 800) * width,
            y: (basePosition.y / 600) * height
        };
    }

    /**
     * Enable haptic feedback on mobile (if supported)
     */
    static vibrate(duration = 50) {
        if (this.isMobile() && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
}

// Export as default and named export
export default MobileHelpers;

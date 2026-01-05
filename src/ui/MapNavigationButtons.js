/**
 * MapNavigationButtons - Quick navigation buttons for mobile/touch interfaces
 * Positioned on the game map for easy access to key features
 */

import { devLog } from '../utils/devLogger.js';

export default class MapNavigationButtons {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.buttons = {};
        this.isVisible = true;

        // Quick access buttons configuration
        this.buttonConfigs = [
            { key: 'profile', icon: '🐾', tooltip: 'Profile', action: () => this.navigateToProfile() },
            { key: 'inventory', icon: '🎒', tooltip: 'Inventory', action: () => this.navigateToInventory() },
            { key: 'shop', icon: '🛒', tooltip: 'Shop', action: () => this.navigateToShop() },
            { key: 'hub', icon: '🌌', tooltip: 'Hub', action: () => this.navigateToHub() }
        ];
    }

    /**
     * Create navigation buttons
     */
    create() {
        const { width, height } = this.scene.scale;
        const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

        // Only show on mobile/touch devices by default
        // Can be toggled for desktop testing
        if (!isMobile && !this.forceShow) {
            devLog('[MapNavigationButtons] Skipping creation (desktop mode)');
            return;
        }

        const buttonSize = 44;
        const buttonSpacing = 8;
        const margin = 16;

        // Position at bottom-right corner
        const startX = width - margin - buttonSize;
        const startY = height - margin - buttonSize;

        // Create buttons vertically stacked
        this.buttonConfigs.forEach((config, index) => {
            const buttonY = startY - (index * (buttonSize + buttonSpacing));
            this.createButton(config, startX, buttonY, buttonSize);
        });

        devLog('[MapNavigationButtons] Created', this.buttonConfigs.length, 'buttons');
    }

    /**
     * Create a single navigation button
     */
    createButton(config, x, y, size) {
        // Button background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1A1A3E, 0.85);
        bg.fillCircle(x, y, size/2);
        bg.lineStyle(2, 0x7B68EE, 0.8);
        bg.strokeCircle(x, y, size/2);
        bg.setScrollFactor(0);
        bg.setDepth(3500);
        this.elements.push(bg);

        // Icon
        const icon = this.scene.add.text(x, y, config.icon, {
            fontSize: '20px'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3501);
        this.elements.push(icon);

        // Interactive zone
        const zone = this.scene.add.zone(x, y, size, size);
        zone.setScrollFactor(0);
        zone.setDepth(3502);
        zone.setInteractive({ useHandCursor: true });

        // Hover effects
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x2A2A5E, 0.95);
            bg.fillCircle(x, y, size/2 + 2);
            bg.lineStyle(2, 0x9370DB, 1);
            bg.strokeCircle(x, y, size/2 + 2);

            // Show tooltip
            this.showTooltip(config.tooltip, x, y - size/2 - 20);
        });

        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x1A1A3E, 0.85);
            bg.fillCircle(x, y, size/2);
            bg.lineStyle(2, 0x7B68EE, 0.8);
            bg.strokeCircle(x, y, size/2);

            this.hideTooltip();
        });

        zone.on('pointerdown', () => {
            // Visual feedback
            bg.clear();
            bg.fillStyle(0x4A4A8E, 1);
            bg.fillCircle(x, y, size/2 - 2);
            bg.lineStyle(2, 0xFFD700, 1);
            bg.strokeCircle(x, y, size/2 - 2);

            // Play sound
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }

            // Execute action
            config.action();
        });

        this.elements.push(zone);

        // Store button reference
        this.buttons[config.key] = { bg, icon, zone, x, y, size };
    }

    /**
     * Show tooltip above button
     */
    showTooltip(text, x, y) {
        this.hideTooltip();

        const { width } = this.scene.scale;

        // Adjust position if too close to edge
        const tooltipX = Math.min(x, width - 60);

        this.tooltip = this.scene.add.text(tooltipX, y, text, {
            fontSize: '12px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(26, 26, 62, 0.95)',
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(3600);

        this.elements.push(this.tooltip);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.elements = this.elements.filter(el => el !== this.tooltip);
            this.tooltip = null;
        }
    }

    /**
     * Navigation actions
     */
    navigateToProfile() {
        devLog('[MapNavigationButtons] Navigate to Profile');
        this.scene.scene.start('CreatureProfileScene');
    }

    navigateToInventory() {
        devLog('[MapNavigationButtons] Navigate to Inventory');
        this.scene.scene.start('InventoryScene');
    }

    navigateToShop() {
        devLog('[MapNavigationButtons] Navigate to Shop');
        this.scene.scene.start('ShopScene');
    }

    navigateToHub() {
        devLog('[MapNavigationButtons] Navigate to Hub');
        this.scene.scene.start('HubWorldScene');
    }

    /**
     * Toggle visibility
     */
    setVisible(visible) {
        this.isVisible = visible;
        this.elements.forEach(el => {
            if (el && el.setVisible) {
                el.setVisible(visible);
            }
        });
    }

    /**
     * Update button positions (for screen resize)
     */
    updatePositions() {
        const { width, height } = this.scene.scale;
        const buttonSize = 44;
        const buttonSpacing = 8;
        const margin = 16;

        const startX = width - margin - buttonSize;
        const startY = height - margin - buttonSize;

        this.buttonConfigs.forEach((config, index) => {
            const button = this.buttons[config.key];
            if (button) {
                const newY = startY - (index * (buttonSize + buttonSpacing));

                // Update background position
                button.bg.clear();
                button.bg.fillStyle(0x1A1A3E, 0.85);
                button.bg.fillCircle(startX, newY, buttonSize/2);
                button.bg.lineStyle(2, 0x7B68EE, 0.8);
                button.bg.strokeCircle(startX, newY, buttonSize/2);

                // Update icon position
                button.icon.setPosition(startX, newY);

                // Update zone position
                button.zone.setPosition(startX, newY);

                // Update stored positions
                button.x = startX;
                button.y = newY;
            }
        });
    }

    /**
     * Force show on desktop (for testing)
     */
    enableForDesktop() {
        this.forceShow = true;
    }

    /**
     * Destroy all buttons and clean up
     */
    destroy() {
        this.hideTooltip();

        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });

        this.elements = [];
        this.buttons = {};

        devLog('[MapNavigationButtons] Destroyed');
    }
}

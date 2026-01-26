/**
 * HamburgerMenu - Navigation menu component
 * Provides quick access to game scenes and features
 */

import { devLog } from '../utils/devLogger.js';
import LegalDocumentsModal from './LegalDocumentsModal.js';

export default class HamburgerMenu {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
        this.isOpen = false;
        this.menuButton = null;
        this.menuPanel = null;
        this.escHandler = null;

        // Menu items configuration
        this.menuItems = [
            { key: 'profile', label: 'Creature Profile', icon: '🐾', shortcut: 'P', action: () => this.navigateToProfile() },
            { key: 'achievements', label: 'Achievements', icon: '🏆', shortcut: 'A', action: () => this.navigateToAchievements() },
            { key: 'inventory', label: 'Inventory', icon: '🎒', shortcut: 'I', action: () => this.navigateToInventory() },
            { key: 'shop', label: 'Shop', icon: '🛒', shortcut: 'S', action: () => this.navigateToShop() },
            { key: 'hub', label: 'Hub World', icon: '🌌', shortcut: 'H', action: () => this.navigateToHub() },
            { key: 'fusion', label: 'Fusion Pod', icon: '🧬', shortcut: 'F', action: () => this.navigateToFusion() },
            { key: 'collection', label: 'Switch Creature', icon: '🔄', shortcut: 'C', action: () => this.showCreatureSwitcher() },
            { key: 'spacenews', label: 'Space News', icon: '🚀', shortcut: 'N', action: () => this.showSpaceNews() },
            { key: 'legal', label: 'Legal & About', icon: '📜', shortcut: 'L', action: () => this.showLegalDocuments() }
        ];

        // Legal documents modal
        this.legalModal = null;
    }

    /**
     * Create and position the hamburger menu button
     */
    create() {
        const { width, height } = this.scene.scale;

        // More aggressive mobile detection
        const isMobile = 'ontouchstart' in window ||
                         navigator.maxTouchPoints > 0 ||
                         window.innerWidth < 768;

        // Hamburger button size and position
        // On mobile, position BELOW the MobileHUD top bar (which ends at ~56px)
        const buttonSize = isMobile ? 48 : 44;
        const marginX = isMobile ? 8 : 16;
        const marginY = isMobile ? 60 : 16; // Below MobileHUD on mobile
        const buttonX = marginX + buttonSize / 2;
        const buttonY = marginY + buttonSize / 2;

        devLog('[HamburgerMenu] Creating at position:', buttonX, buttonY, 'isMobile:', isMobile);

        // Create hamburger button background - high depth to be above most UI
        const buttonBg = this.scene.add.graphics();
        buttonBg.fillStyle(0x1A1A3E, 0.95);
        buttonBg.fillRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
        buttonBg.lineStyle(2, 0x7B68EE, 0.8);
        buttonBg.strokeRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
        buttonBg.setScrollFactor(0);
        buttonBg.setDepth(14998); // Just below hitZone
        this.elements.push(buttonBg);

        // Create hamburger icon (three lines)
        const iconGraphics = this.scene.add.graphics();
        iconGraphics.fillStyle(0xFFFFFF, 1);
        const lineWidth = 20;
        const lineHeight = 3;
        const lineSpacing = 6;
        const startY = buttonY - lineSpacing;

        for (let i = 0; i < 3; i++) {
            iconGraphics.fillRoundedRect(
                buttonX - lineWidth/2,
                startY + i * lineSpacing - lineHeight/2,
                lineWidth,
                lineHeight,
                1
            );
        }
        iconGraphics.setScrollFactor(0);
        iconGraphics.setDepth(14999); // Just below hitZone, above background
        this.elements.push(iconGraphics);

        // Create interactive zone - LARGER for easier touch targeting
        // Using very high depth to ensure it's above ALL other UI elements (MobileHUD, MobileControls, etc.)
        const touchPadding = isMobile ? 30 : 20; // Extra padding on mobile for easier tapping
        const hitZone = this.scene.add.zone(buttonX, buttonY, buttonSize + touchPadding, buttonSize + touchPadding);
        hitZone.setScrollFactor(0);
        hitZone.setDepth(15000); // Higher than MobileControls (10000) to ensure it's touchable
        hitZone.setInteractive({ useHandCursor: false }); // No cursor for mobile

        // Handle both pointerdown and pointerup for better mobile compatibility
        hitZone.on('pointerdown', () => {
            devLog('[HamburgerMenu] Button tapped! (pointerdown)');
        });

        hitZone.on('pointerup', () => {
            devLog('[HamburgerMenu] Button released! (pointerup) - toggling menu');
            this.toggle();
        });

        hitZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x2A2A5E, 0.95);
            buttonBg.fillRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
            buttonBg.lineStyle(2, 0x9370DB, 1);
            buttonBg.strokeRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
        });

        hitZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x1A1A3E, 0.9);
            buttonBg.fillRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
            buttonBg.lineStyle(2, 0x7B68EE, 0.8);
            buttonBg.strokeRoundedRect(buttonX - buttonSize/2, buttonY - buttonSize/2, buttonSize, buttonSize, 8);
        });

        this.elements.push(hitZone);
        this.menuButton = { bg: buttonBg, icon: iconGraphics, zone: hitZone, x: buttonX, y: buttonY, size: buttonSize };

        devLog('[HamburgerMenu] Created');
    }

    /**
     * Toggle menu open/closed
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open the menu panel
     */
    open() {
        if (this.isOpen) return;
        this.isOpen = true;

        devLog('[HamburgerMenu] Opening menu panel');

        const { width, height } = this.scene.scale;
        const isMobile = 'ontouchstart' in window ||
                         navigator.maxTouchPoints > 0 ||
                         window.innerWidth < 768;

        // Panel dimensions - position below the hamburger button
        const panelWidth = isMobile ? Math.min(280, width - 40) : 260;
        const itemHeight = isMobile ? 52 : 48;
        const panelHeight = this.menuItems.length * itemHeight + 30;
        const panelX = 8;
        // Panel appears below the button (button Y + button size + small gap)
        const buttonBottomY = this.menuButton?.y + (this.menuButton?.size || 44) / 2 || 100;
        const panelY = buttonBottomY + 10;

        // Create dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.3);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3998);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => this.close());
        this.elements.push(overlay);
        this.menuOverlay = overlay;

        // Create panel background
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.lineStyle(2, 0x7B68EE, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.setScrollFactor(0);
        panel.setDepth(3999);
        this.elements.push(panel);
        this.menuPanel = panel;

        // Create menu items
        this.menuItems.forEach((item, index) => {
            const itemY = panelY + 15 + index * itemHeight;
            this.createMenuItem(item, panelX, itemY, panelWidth, itemHeight, isMobile);
        });

        // ESC to close
        this.escHandler = (event) => {
            if (event.key === 'Escape') this.close();
        };
        this.scene.input.keyboard?.on('keydown', this.escHandler);

        // Play open sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        devLog('[HamburgerMenu] Opened');
    }

    /**
     * Create a single menu item
     */
    createMenuItem(item, panelX, itemY, panelWidth, itemHeight, isMobile) {
        const padding = 12;

        // Item background (for hover effect)
        const itemBg = this.scene.add.graphics();
        itemBg.setScrollFactor(0);
        itemBg.setDepth(4000);
        this.elements.push(itemBg);

        // Icon
        const icon = this.scene.add.text(panelX + padding + 14, itemY + itemHeight/2, item.icon, {
            fontSize: isMobile ? '22px' : '20px'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4001);
        this.elements.push(icon);

        // Label
        const label = this.scene.add.text(panelX + padding + 38, itemY + itemHeight/2, item.label, {
            fontSize: isMobile ? '16px' : '15px',
            color: '#FFFFFF'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(4001);
        this.elements.push(label);

        // Shortcut (only show on desktop - keyboard shortcuts not relevant on mobile)
        if (!isMobile) {
            const shortcut = this.scene.add.text(panelX + panelWidth - padding - 10, itemY + itemHeight/2, item.shortcut, {
                fontSize: '12px',
                color: '#888888',
                backgroundColor: '#333355',
                padding: { x: 6, y: 3 }
            }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(4001);
            this.elements.push(shortcut);
        }

        // Interactive zone
        const zone = this.scene.add.zone(panelX + panelWidth/2, itemY + itemHeight/2, panelWidth - 8, itemHeight - 4);
        zone.setScrollFactor(0);
        zone.setDepth(4002);
        zone.setInteractive({ useHandCursor: true });

        zone.on('pointerover', () => {
            itemBg.clear();
            itemBg.fillStyle(0x3A3A6E, 0.8);
            itemBg.fillRoundedRect(panelX + 4, itemY + 2, panelWidth - 8, itemHeight - 4, 6);
            label.setColor('#FFD700');
        });

        zone.on('pointerout', () => {
            itemBg.clear();
            label.setColor('#FFFFFF');
        });

        zone.on('pointerdown', () => {
            this.close();
            item.action();
        });

        this.elements.push(zone);
    }

    /**
     * Close the menu panel
     */
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        // Remove ESC handler
        if (this.escHandler) {
            this.scene.input.keyboard?.off('keydown', this.escHandler);
            this.escHandler = null;
        }

        // Remove menu elements (keep button elements)
        const buttonElements = [this.menuButton?.bg, this.menuButton?.icon, this.menuButton?.zone].filter(Boolean);

        this.elements = this.elements.filter(el => {
            if (buttonElements.includes(el)) {
                return true;
            }
            el.destroy();
            return false;
        });

        this.menuPanel = null;
        this.menuOverlay = null;

        devLog('[HamburgerMenu] Closed');
    }

    /**
     * Navigation actions
     */
    navigateToProfile() {
        devLog('[HamburgerMenu] Navigate to Profile');
        this.scene.scene.start('CreatureProfileScene');
    }

    navigateToAchievements() {
        devLog('[HamburgerMenu] Navigate to Achievements');
        this.scene.scene.launch('AchievementMenuScene');
    }

    navigateToInventory() {
        devLog('[HamburgerMenu] Navigate to Inventory');
        this.scene.scene.start('InventoryScene');
    }

    navigateToShop() {
        devLog('[HamburgerMenu] Navigate to Shop');
        this.scene.scene.start('ShopScene');
    }

    navigateToHub() {
        devLog('[HamburgerMenu] Navigate to Hub');
        this.scene.scene.start('HubWorldScene');
    }

    navigateToFusion() {
        devLog('[HamburgerMenu] Navigate to Fusion Pod');
        this.scene.scene.start('FusionPodScene');
    }

    showCreatureSwitcher() {
        devLog('[HamburgerMenu] Show Creature Switcher');
        if (this.scene.showCreatureSwitcher) {
            this.scene.showCreatureSwitcher();
        } else if (this.scene.creatureSwitcher) {
            this.scene.creatureSwitcher.show();
        }
    }

    /**
     * Show NASA Space News content
     * Forces display regardless of daily limit for testing
     */
    async showSpaceNews() {
        devLog('[HamburgerMenu] Show Space News');

        if (!window.NASAContentSystem) {
            console.warn('[HamburgerMenu] NASAContentSystem not available');
            return;
        }

        try {
            // Initialize if needed
            if (!window.NASAContentSystem.isInitialized) {
                await window.NASAContentSystem.initialize();
            }

            // Force fetch fresh content (bypass daily check)
            const apod = await window.NASAContentSystem.fetchAPOD();
            const queue = [];

            if (apod) {
                queue.push({
                    type: 'apod',
                    title: 'Astronomy Picture of the Day',
                    subtitle: apod.title,
                    imageUrl: window.NASAContentSystem.ensureHttps(apod.url),
                    hdUrl: window.NASAContentSystem.ensureHttps(apod.hdurl),
                    description: window.NASAContentSystem.simplifyDescription(apod.explanation),
                    date: apod.date,
                    creatureComment: window.NASAContentSystem.getCreatureAPODComment(apod.title)
                });
            }

            // Try to get Mars photo too
            const mars = await window.NASAContentSystem.fetchMarsPhoto();
            if (mars) {
                queue.push({
                    type: 'mars',
                    title: 'Postcard from Mars',
                    subtitle: `${mars.rover.name} Rover - ${mars.camera.full_name}`,
                    imageUrl: window.NASAContentSystem.ensureHttps(mars.img_src),
                    description: `This photo was taken on Mars by the ${mars.rover.name} rover on Sol ${mars.sol}.`,
                    date: mars.earth_date,
                    creatureComment: window.NASAContentSystem.getCreatureMarsComment()
                });
            }

            if (queue.length > 0 && this.scene.nasaModal) {
                // Use existing modal from scene
                this.scene.nasaModal.show(queue);
            } else if (queue.length > 0) {
                // Import and create modal
                const NASAContentModal = (await import('./NASAContentModal.js')).default;
                const modal = new NASAContentModal(this.scene);
                modal.show(queue);
            } else {
                devLog('[HamburgerMenu] No NASA content available');
                // Show a brief message
                this.showToast('🌌 NASA content loading... try again in a moment!');
            }
        } catch (error) {
            console.warn('[HamburgerMenu] Failed to load space news:', error.message);
            this.showToast('🚀 Space news unavailable right now');
        }
    }

    /**
     * Show Legal Documents modal (Privacy Policy, Terms of Service)
     */
    showLegalDocuments() {
        devLog('[HamburgerMenu] Show Legal Documents');

        if (!this.legalModal) {
            this.legalModal = new LegalDocumentsModal(this.scene);
        }
        this.legalModal.show();
    }

    /**
     * Show a brief toast message
     */
    showToast(message) {
        const { width, height } = this.scene.scale;
        const toast = this.scene.add.text(width / 2, height - 100, message, {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#1A1A3E',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

        this.scene.tweens.add({
            targets: toast,
            alpha: 1,
            y: height - 120,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.scene.time.delayedCall(2500, () => {
                    this.scene.tweens.add({
                        targets: toast,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => toast.destroy()
                    });
                });
            }
        });
    }

    /**
     * Destroy the menu and clean up
     */
    destroy() {
        this.close();

        // Destroy all remaining elements
        this.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });

        this.elements = [];
        this.menuButton = null;

        devLog('[HamburgerMenu] Destroyed');
    }
}

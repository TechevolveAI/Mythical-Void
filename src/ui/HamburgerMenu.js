/**
 * HamburgerMenu - Navigation menu component
 * Provides quick access to game scenes and features
 */

import { devLog } from '../utils/devLogger.js';
import LegalDocumentsModal from './LegalDocumentsModal.js';
import CloudSaveSettingsModal from './CloudSaveSettingsModal.js';
import ProjectBeaconLogModal from './ProjectBeaconLogModal.js';
import SettingsModal from './SettingsModal.js';

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
            { key: 'beaconlog', label: 'Beacon Log', icon: '📡', shortcut: null, action: () => this.showBeaconLog() },
            { key: 'shop', label: 'Shop', icon: '🛒', shortcut: 'S', action: () => this.navigateToShop() },
            { key: 'hub', label: 'Hub World', icon: '🌌', shortcut: 'H', action: () => this.navigateToHub() },
            { key: 'fusion', label: 'Fusion Pod', icon: '🧬', shortcut: 'B', action: () => this.navigateToFusion() },
            { key: 'collection', label: 'Switch Creature', icon: '🔄', shortcut: 'C', action: () => this.showCreatureSwitcher() },
            { key: 'spacenews', label: 'Space News', icon: '🚀', shortcut: 'N', action: () => this.showSpaceNews() },
            { key: 'settings', label: 'Settings', icon: '⚙️', shortcut: 'O', action: () => this.showSettings() },
            { key: 'cloudsave', label: 'Cloud Save', icon: '☁️', shortcut: 'V', action: () => this.showCloudSaveSettings() },
            { key: 'legal', label: 'Legal & About', icon: '📜', shortcut: 'L', action: () => this.showLegalDocuments() }
        ];
        if (import.meta.env.DEV) {
            this.menuItems.push({
                key: 'devhacks',
                label: 'Developer Hacks',
                icon: '🔮',
                shortcut: 'D',
                action: () => this.showDeveloperHacks()
            });
        }

        // Developer hacks submenu state
        this.devHacksMenu = null;

        // Legal documents modal
        this.legalModal = null;
        this.cloudSaveModal = null;
        this.beaconLogModal = null;
        this.settingsModal = null;
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
        const panelX = 8;
        // Panel appears below the button (button Y + button size + small gap)
        const buttonBottomY = this.menuButton?.y + (this.menuButton?.size || 44) / 2 || 100;
        const panelY = buttonBottomY + 10;
        const preferredItemHeight = isMobile ? 52 : 48;
        const availableHeight = Math.max(360, height - panelY - 8);
        const itemHeight = Math.max(
            36,
            Math.min(preferredItemHeight, Math.floor((availableHeight - 30) / this.menuItems.length))
        );
        const panelHeight = this.menuItems.length * itemHeight + 30;

        // Create dark overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.3);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(14900);
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
        panel.setDepth(14901);
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
        itemBg.setDepth(14902);
        this.elements.push(itemBg);

        // Icon
        const icon = this.scene.add.text(panelX + padding + 14, itemY + itemHeight/2, item.icon, {
            fontSize: isMobile ? '22px' : '20px'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(14903);
        this.elements.push(icon);

        // Label
        const label = this.scene.add.text(panelX + padding + 38, itemY + itemHeight/2, item.label, {
            fontSize: isMobile ? '16px' : '15px',
            color: '#FFFFFF'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(14903);
        this.elements.push(label);

        // Interactive zone
        const zone = this.scene.add.zone(panelX + panelWidth/2, itemY + itemHeight/2, panelWidth - 8, itemHeight - 4);
        zone.setScrollFactor(0);
        zone.setDepth(14904);
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
    async ensureScene(sceneKey) {
        if (!window.SceneLoader?.loadScene) {
            return true;
        }
        return window.SceneLoader.loadScene(this.scene.game, sceneKey);
    }

    async navigateToProfile() {
        devLog('[HamburgerMenu] Navigate to Profile');
        if (typeof this.scene.openCreatureProfile === 'function') {
            this.scene.openCreatureProfile();
            return;
        }
        if (await this.ensureScene('CreatureProfileScene')) {
            this.scene.scene.start('CreatureProfileScene');
        }
    }

    async navigateToAchievements() {
        devLog('[HamburgerMenu] Navigate to Achievements');
        const returnScene = this.scene.sys?.settings?.key || 'GameScene';
        if (await this.ensureScene('AchievementMenuScene')) {
            this.scene.scene.pause(returnScene);
            this.scene.scene.launch('AchievementMenuScene', { returnScene });
        }
    }

    async navigateToInventory() {
        devLog('[HamburgerMenu] Navigate to Inventory');
        if (typeof this.scene.openInventory === 'function') {
            this.scene.openInventory();
            return;
        }
        if (await this.ensureScene('InventoryScene')) {
            this.scene.scene.start('InventoryScene');
        }
    }

    async navigateToShop() {
        devLog('[HamburgerMenu] Navigate to Shop');
        if (typeof this.scene.openShop === 'function') {
            this.scene.openShop();
            return;
        }
        if (await this.ensureScene('ShopScene')) {
            this.scene.scene.start('ShopScene');
        }
    }

    navigateToHub() {
        devLog('[HamburgerMenu] Navigate to Hub');
        if (typeof this.scene.openHubWorld === 'function') {
            this.scene.openHubWorld();
            return;
        }
        this.scene.scene.start('HubWorldScene');
    }

    navigateToFusion() {
        devLog('[HamburgerMenu] Navigate to Fusion Pod');
        if (typeof this.scene.openFusionPod === 'function') {
            this.close();
            this.scene.openFusionPod();
            return;
        }

        const gameScene = this.scene.scene.get?.('GameScene');
        if (typeof gameScene?.openFusionPod === 'function') {
            this.close();
            gameScene.openFusionPod();
        }
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
        devLog('[HamburgerMenu] Show Space News - starting');

        // Show loading indicator immediately
        this.showToast('🚀 Loading space news...');

        if (!window.NASAContentSystem) {
            console.warn('[HamburgerMenu] NASAContentSystem not available - check global-init.js');
            this.showToast('⚠️ NASA system not loaded');
            return;
        }

        try {
            // Initialize if needed
            if (!window.NASAContentSystem.isInitialized) {
                devLog('[HamburgerMenu] Initializing NASA system...');
                await window.NASAContentSystem.initialize();
            }

            devLog('[HamburgerMenu] Fetching APOD...');
            // Force fetch fresh content (bypass daily check)
            const apod = await window.NASAContentSystem.fetchAPOD();
            devLog('[HamburgerMenu] APOD result:', apod ? 'success' : 'failed/null');

            const queue = [];

            if (apod) {
                queue.push(window.NASAContentSystem.createAPODDiscovery(apod));
            }

            devLog('[HamburgerMenu] Fetching Mars photo...');
            // Try to get Mars photo too
            const mars = await window.NASAContentSystem.fetchMarsPhoto();
            devLog('[HamburgerMenu] Mars result:', mars ? 'success' : 'failed/null');

            if (mars) {
                queue.push(window.NASAContentSystem.createMarsDiscovery(mars));
            }

            devLog('[HamburgerMenu] Content queue length:', queue.length);

            if (queue.length > 0) {
                // Import and create modal
                try {
                    const NASAContentModal = (await import('./NASAContentModal.js')).default;
                    const modal = new NASAContentModal(this.scene);
                    modal.show(queue);
                    devLog('[HamburgerMenu] NASA modal displayed');
                } catch (modalError) {
                    console.error('[HamburgerMenu] Failed to create NASA modal:', modalError);
                    this.showToast('⚠️ Could not display content');
                }
            } else {
                devLog('[HamburgerMenu] No NASA content available - API may be rate limited');
                // Show a more helpful message
                this.showToast('🌌 NASA API rate limited - try again later');
            }
        } catch (error) {
            console.error('[HamburgerMenu] Failed to load space news:', error);
            this.showToast('⚠️ Space news unavailable: ' + (error.message || 'Network error'));
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
     * Show optional cloud-save controls and consent.
     */
    showCloudSaveSettings() {
        devLog('[HamburgerMenu] Show Cloud Save settings');

        if (!this.cloudSaveModal) {
            this.cloudSaveModal = new CloudSaveSettingsModal(this.scene, {
                openPrivacyPolicy: () => {
                    if (!this.legalModal) {
                        this.legalModal = new LegalDocumentsModal(this.scene);
                    }
                    this.legalModal.showDocument('privacy');
                }
            });
        }
        this.cloudSaveModal.show();
    }

    /**
     * Show the live Project Beacon campaign record.
     */
    showBeaconLog() {
        devLog('[HamburgerMenu] Show Project Beacon log');

        if (!this.beaconLogModal) {
            this.beaconLogModal = new ProjectBeaconLogModal(this.scene);
        }
        this.beaconLogModal.show();
    }

    /**
     * Show audio and feedback preferences.
     */
    showSettings() {
        devLog('[HamburgerMenu] Show settings');

        if (!this.settingsModal) {
            this.settingsModal = new SettingsModal(this.scene);
        }
        this.settingsModal.show();
    }

    /**
     * Show Developer Hacks menu
     */
    showDeveloperHacks() {
        devLog('[HamburgerMenu] Show Developer Hacks');

        // Close existing menu if any
        if (this.devHacksMenu) {
            this.closeDevHacksMenu();
            return;
        }

        const { width, height } = this.scene.scale;

        // Create menu container
        this.devHacksMenu = this.scene.add.container(width / 2, height / 2)
            .setScrollFactor(0)
            .setDepth(10000);

        // Dark backdrop
        const backdrop = this.scene.add.graphics();
        backdrop.fillStyle(0x000000, 0.85);
        backdrop.fillRoundedRect(-160, -160, 320, 320, 20);
        backdrop.lineStyle(3, 0xFFD700, 0.8);
        backdrop.strokeRoundedRect(-160, -160, 320, 320, 20);
        this.devHacksMenu.add(backdrop);

        // Title
        const title = this.scene.add.text(0, -130, '🔮 Developer Hacks 🔮', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.devHacksMenu.add(title);

        // Hack buttons (excluding slow-mo as requested)
        const hacks = [
            { label: '💰 +500 Coins', action: () => this.hackAddCoins() },
            { label: '💖 Max Stats', action: () => this.hackMaxStats() },
            { label: '🐣 Cycle Stage', action: () => this.hackCycleStage() },
            { label: '⬆️ Level Up', action: () => this.hackLevelUp() },
            { label: '❌ Close', action: () => this.closeDevHacksMenu() }
        ];

        hacks.forEach((hack, index) => {
            const y = -70 + index * 55;

            // Button background
            const btnBg = this.scene.add.graphics();
            btnBg.fillStyle(index === 4 ? 0x8B0000 : 0x4B0082, 0.9);
            btnBg.fillRoundedRect(-130, y - 20, 260, 45, 10);
            btnBg.lineStyle(2, 0xFFD700, 0.6);
            btnBg.strokeRoundedRect(-130, y - 20, 260, 45, 10);
            this.devHacksMenu.add(btnBg);

            // Button text
            const btnText = this.scene.add.text(0, y, hack.label, {
                fontSize: '18px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.devHacksMenu.add(btnText);

            // Interactive zone
            const btnZone = this.scene.add.zone(0, y, 260, 45)
                .setScrollFactor(0)
                .setInteractive({ cursor: 'pointer' });

            btnZone.on('pointerdown', () => {
                hack.action();
                window.AudioManager?.playButtonClick?.();
            });

            btnZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(index === 4 ? 0xB22222 : 0x6B238E, 0.95);
                btnBg.fillRoundedRect(-130, y - 20, 260, 45, 10);
                btnBg.lineStyle(2, 0xFFD700, 1);
                btnBg.strokeRoundedRect(-130, y - 20, 260, 45, 10);
            });

            btnZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(index === 4 ? 0x8B0000 : 0x4B0082, 0.9);
                btnBg.fillRoundedRect(-130, y - 20, 260, 45, 10);
                btnBg.lineStyle(2, 0xFFD700, 0.6);
                btnBg.strokeRoundedRect(-130, y - 20, 260, 45, 10);
            });

            this.devHacksMenu.add(btnZone);
        });

        // Entrance animation
        this.devHacksMenu.setScale(0.5).setAlpha(0);
        this.scene.tweens.add({
            targets: this.devHacksMenu,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });
    }

    /**
     * Close the Developer Hacks menu
     */
    closeDevHacksMenu() {
        if (!this.devHacksMenu) return;

        this.scene.tweens.add({
            targets: this.devHacksMenu,
            scale: 0.5,
            alpha: 0,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                this.devHacksMenu?.destroy();
                this.devHacksMenu = null;
            }
        });
    }

    /**
     * Developer hack: Add 500 coins
     */
    hackAddCoins() {
        if (window.EconomyManager) {
            window.EconomyManager.addCoins(500, 'developer_hack');
            this.showHackFeedback('💰 +500', '#FFD700');
        }
    }

    /**
     * Developer hack: Max all stats
     */
    hackMaxStats() {
        if (window.GameState) {
            window.GameState.set('creature.stats.happiness', 100);
            window.GameState.set('creature.stats.energy', 100);
            window.GameState.set('creature.stats.health', 100);
            this.showHackFeedback('💖 MAX STATS', '#FF69B4');
        }
    }

    /**
     * Developer hack: Cycle through lifecycle stages
     */
    hackCycleStage() {
        if (!window.GameState) return;

        const stages = ['baby', 'juvenile', 'adult', 'elder'];
        const stageIcons = { baby: '🐣', juvenile: '🌱', adult: '✨', elder: '👑' };
        const currentStage = window.GameState.get('creature.lifecycle.stage') || 'baby';
        const currentIndex = stages.indexOf(currentStage);
        const nextIndex = (currentIndex + 1) % stages.length;
        const newStage = stages[nextIndex];

        window.GameState.set('creature.lifecycle.stage', newStage);

        // Trigger creature texture regeneration if in GameScene
        if (this.scene.setCreatureLifecycleStageForDebug) {
            this.scene.setCreatureLifecycleStageForDebug(newStage);
        }

        this.showHackFeedback(`${stageIcons[newStage]} ${newStage}`, '#E040FB');
    }

    /**
     * Developer hack: Level up
     */
    hackLevelUp() {
        if (!window.GameState) return;

        const currentLevel = window.GameState.get('creature.level') || 1;
        window.GameState.set('creature.level', currentLevel + 1);
        window.GameState.set('creature.experience', 0);

        this.showHackFeedback(`⬆️ LVL ${currentLevel + 1}`, '#00FF00');
    }

    /**
     * Show visual feedback for developer hack
     */
    showHackFeedback(text, color) {
        const { width, height } = this.scene.scale;

        const feedback = this.scene.add.text(width / 2, height / 2 - 80, text, {
            fontSize: '28px',
            color: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

        this.scene.tweens.add({
            targets: feedback,
            y: height / 2 - 150,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.5 },
            duration: 1500,
            ease: 'Power2',
            onComplete: () => feedback.destroy()
        });
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
        this.cloudSaveModal?.destroy();
        this.cloudSaveModal = null;
        this.beaconLogModal?.destroy();
        this.beaconLogModal = null;
        this.settingsModal?.destroy();
        this.settingsModal = null;
        this.legalModal?.hide();
        this.legalModal = null;

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

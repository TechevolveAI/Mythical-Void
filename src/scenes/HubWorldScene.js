/**
 * HubWorldScene - Central hub with gates to different biomes
 * Crash Bandicoot-style circular gate layout
 * Features: Gate navigation, creature display, biome selection
 */

import Phaser from 'phaser';

export default class HubWorldScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HubWorldScene' });

        this.graphicsEngine = null;
        this.gates = [];
        this.selectedGateIndex = 0;
        this.creatureSprite = null;
        this.gateElements = [];
        this.isTransitioning = false;
        this._isShuttingDown = false;
    }

    /**
     * Reset state on scene start - called before create()
     */
    init() {
        // CRITICAL: Reset all state flags on scene start
        this.isTransitioning = false;
        this._isShuttingDown = false;
        this.selectedGateIndex = 0;
        this.gates = [];
        this.gateElements = [];
        this.creatureSprite = null;
        this.graphicsEngine = null;
        console.log('[HubWorldScene] State reset in init()');
    }

    create() {
        console.log('[HubWorldScene] Initializing Hub World');

        this._isShuttingDown = false;
        this.isTransitioning = false; // CRITICAL: Reset transition flag on scene start

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        // Calculate dimensions
        this.calculateDimensions();

        // Create visuals
        this.createBackground();
        this.createCentralPlatform();
        this.createGates();
        this.createCreatureDisplay();
        this.createUI();
        this.createCollectionButton();

        // Set up input
        this.setupInput();

        // Select main gate by default
        this.selectGate(0);

        // Hide loading
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        // Register shutdown
        if (this.events) {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        }

        console.log('[HubWorldScene] Hub World ready');
    }

    calculateDimensions() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const isMobile = width < 600;

        this.dims = {
            width,
            height,
            isMobile,
            centerX: width / 2,
            centerY: height / 2,
            platformRadius: isMobile ? 80 : 120,
            gateRadius: isMobile ? Math.min(width, height) * 0.35 : Math.min(width, height) * 0.38,
            gateSize: isMobile ? 70 : 100
        };
    }

    createBackground() {
        const { width, height } = this.dims;

        // Deep cosmic background
        const bg = this.add.graphics();

        // Gradient from dark purple to deep blue
        for (let y = 0; y < height; y += 2) {
            const t = y / height;
            const r = Math.floor(15 + t * 10);
            const g = Math.floor(5 + t * 15);
            const b = Math.floor(40 + t * 30);
            const color = (r << 16) | (g << 8) | b;
            bg.fillStyle(color, 1);
            bg.fillRect(0, y, width, 2);
        }
        bg.setDepth(0);

        // Stars
        const starCount = Math.min(300, Math.floor((width * height) / 2000));
        for (let i = 0; i < starCount; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(0.5, 2.5);
            const alpha = Phaser.Math.FloatBetween(0.3, 1);

            bg.fillStyle(0xFFFFFF, alpha);
            bg.fillCircle(x, y, size);
        }

        // Twinkling stars animation
        this.tweens.add({
            targets: bg,
            alpha: { from: 0.85, to: 1 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Floating cosmic particles
        this.createFloatingParticles();
    }

    createFloatingParticles() {
        const { width, height } = this.dims;

        for (let i = 0; i < 20; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.Between(2, 6);
            const color = Phaser.Utils.Array.GetRandom([0x7B68EE, 0x00CED1, 0xFF69B4, 0xFFD700]);

            particle.fillStyle(color, 0.6);
            particle.fillCircle(0, 0, size);
            particle.setPosition(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height)
            );
            particle.setDepth(1);

            // Float animation
            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(50, 150),
                x: particle.x + Phaser.Math.Between(-30, 30),
                alpha: { from: 0.6, to: 0 },
                duration: Phaser.Math.Between(4000, 8000),
                repeat: -1,
                onRepeat: () => {
                    particle.setPosition(
                        Phaser.Math.Between(0, width),
                        height + 20
                    );
                    particle.setAlpha(0.6);
                }
            });
        }
    }

    createCentralPlatform() {
        const { centerX, centerY, platformRadius } = this.dims;

        // Platform glow
        const glow = this.add.graphics();
        glow.fillStyle(0x6B00B3, 0.3);
        glow.fillCircle(centerX, centerY, platformRadius + 30);
        glow.setDepth(5);

        // Pulse glow
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.3, to: 0.6 },
            scaleX: { from: 1, to: 1.1 },
            scaleY: { from: 1, to: 1.1 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Main platform
        const platform = this.add.graphics();
        platform.fillStyle(0x1A0A2E, 1);
        platform.fillCircle(centerX, centerY, platformRadius);
        platform.lineStyle(4, 0x7B68EE);
        platform.strokeCircle(centerX, centerY, platformRadius);
        platform.setDepth(6);

        // Inner ring decoration
        platform.lineStyle(2, 0x4B0082);
        platform.strokeCircle(centerX, centerY, platformRadius - 15);

        // Cosmic runes
        const runeCount = 8;
        for (let i = 0; i < runeCount; i++) {
            const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (platformRadius - 30);
            const y = centerY + Math.sin(angle) * (platformRadius - 30);

            platform.fillStyle(0x9370DB, 0.5);
            platform.fillCircle(x, y, 5);
        }
    }

    createGates() {
        const { centerX, centerY, gateRadius, gateSize, isMobile } = this.dims;

        // Get gates from GameState
        const allGates = window.GameState?.getAllGates() || {};
        const gateIds = Object.keys(allGates);

        // Gate colors and icons
        const gateConfigs = {
            main: { color: 0x7B68EE, icon: '🏠', label: 'Main World' },
            stellar_reef: { color: 0x00CED1, icon: '🐠', label: 'Stellar Reef' },
            crystal_caves: { color: 0xE040FB, icon: '💎', label: 'Crystal Caves' },
            void_peaks: { color: 0x37474F, icon: '⛰️', label: 'Void Peaks' },
            aurora_depths: { color: 0x00E676, icon: '🌌', label: 'Aurora Depths' }
        };

        this.gates = [];
        this.gateElements = [];

        gateIds.forEach((gateId, index) => {
            const gateData = allGates[gateId];
            const config = gateConfigs[gateId] || { color: 0x666666, icon: '❓', label: gateId };

            // Position gates in a circle
            const angle = (index / gateIds.length) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * gateRadius;
            const y = centerY + Math.sin(angle) * gateRadius;

            // Gate container
            const gateContainer = this.add.container(x, y);
            gateContainer.setDepth(10);

            // Gate glow (for unlocked gates)
            const glow = this.add.graphics();
            if (gateData.unlocked) {
                glow.fillStyle(config.color, 0.3);
                glow.fillCircle(0, 0, gateSize + 15);

                this.tweens.add({
                    targets: glow,
                    alpha: { from: 0.3, to: 0.5 },
                    duration: 1500,
                    yoyo: true,
                    repeat: -1
                });
            }
            gateContainer.add(glow);

            // Gate background
            const gateBg = this.add.graphics();
            if (gateData.unlocked) {
                gateBg.fillStyle(config.color, 0.9);
            } else {
                gateBg.fillStyle(0x333333, 0.8);
            }
            gateBg.fillCircle(0, 0, gateSize);
            gateBg.lineStyle(4, gateData.unlocked ? 0xFFD700 : 0x555555);
            gateBg.strokeCircle(0, 0, gateSize);
            gateContainer.add(gateBg);

            // Lock icon for locked gates
            if (!gateData.unlocked) {
                const lockIcon = this.add.text(0, -10, '🔒', {
                    fontSize: isMobile ? '28px' : '36px'
                }).setOrigin(0.5);
                gateContainer.add(lockIcon);

                // Cost label
                const costLabel = this.add.text(0, 25, `${gateData.unlockCost}🪙`, {
                    fontSize: isMobile ? '14px' : '18px',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                gateContainer.add(costLabel);
            } else {
                // Gate icon
                const icon = this.add.text(0, 0, config.icon, {
                    fontSize: isMobile ? '36px' : '48px'
                }).setOrigin(0.5);
                gateContainer.add(icon);
            }

            // Gate label (below gate)
            const label = this.add.text(0, gateSize + 20, config.label, {
                fontSize: isMobile ? '12px' : '16px',
                color: gateData.unlocked ? '#FFFFFF' : '#888888',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            }).setOrigin(0.5);
            gateContainer.add(label);

            // Interactive zone
            const zone = this.add.zone(0, 0, gateSize * 2, gateSize * 2);
            zone.setInteractive({ useHandCursor: true });
            gateContainer.add(zone);

            // Store gate data
            const gateInfo = {
                id: gateId,
                data: gateData,
                config,
                container: gateContainer,
                glow,
                bg: gateBg,
                zone,
                x,
                y,
                angle
            };

            this.gates.push(gateInfo);
            this.gateElements.push(gateContainer);

            // Click handler
            zone.on('pointerdown', () => {
                this.onGateClicked(gateInfo, index);
            });

            // Hover effects
            zone.on('pointerover', () => {
                if (!this.isTransitioning) {
                    this.selectGate(index);
                }
            });
        });
    }

    selectGate(index) {
        this.selectedGateIndex = index;

        // Update visual selection
        this.gates.forEach((gate, i) => {
            const scale = i === index ? 1.15 : 1;
            const alpha = i === index ? 1 : 0.7;

            this.tweens.add({
                targets: gate.container,
                scaleX: scale,
                scaleY: scale,
                alpha: alpha,
                duration: 200,
                ease: 'Back.easeOut'
            });
        });

        // Update info panel
        this.updateInfoPanel(this.gates[index]);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    updateInfoPanel(gate) {
        if (!gate) return;

        // Update info text
        if (this.infoText) {
            let info = `${gate.config.icon} ${gate.data.name}`;
            if (gate.data.unlocked) {
                info += `\nVisits: ${gate.data.visits || 0}`;
            } else {
                info += `\n🔒 Unlock: ${gate.data.unlockCost} coins`;
            }
            this.infoText.setText(info);
        }

        // Update action button
        if (this.actionButton && this.actionLabel) {
            if (gate.data.unlocked) {
                this.actionLabel.setText('ENTER');
                this.actionButton.clear();
                this.actionButton.fillStyle(0x00AA00, 1);
                this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10);
                this.actionButton.lineStyle(3, 0x00FF00);
                this.actionButton.strokeRoundedRect(-60, -25, 120, 50, 10);
            } else {
                this.actionLabel.setText('UNLOCK');
                this.actionButton.clear();
                this.actionButton.fillStyle(0xFFAA00, 1);
                this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10);
                this.actionButton.lineStyle(3, 0xFFD700);
                this.actionButton.strokeRoundedRect(-60, -25, 120, 50, 10);
            }
        }
    }

    onGateClicked(gate, index) {
        if (this.isTransitioning) return;

        this.selectGate(index);

        if (gate.data.unlocked) {
            this.enterGate(gate);
        } else {
            this.showUnlockConfirmation(gate);
        }
    }

    showUnlockConfirmation(gate) {
        const { width, height, isMobile } = this.dims;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Modal panel
        const modalWidth = isMobile ? width - 40 : 400;
        const modalHeight = 250;
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.lineStyle(3, gate.config.color);
        panel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, modalY + 40, `Unlock ${gate.data.name}?`, {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Cost info
        const currentCoins = window.GameState?.get('player.cosmicCoins') || 0;
        const canAfford = currentCoins >= gate.data.unlockCost;

        const costText = this.add.text(width / 2, modalY + 100,
            `Cost: ${gate.data.unlockCost} 🪙\nYou have: ${currentCoins} 🪙`, {
            fontSize: isMobile ? '16px' : '20px',
            color: canAfford ? '#00FF00' : '#FF6666',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Buttons
        const btnWidth = 100;
        const btnHeight = 45;
        const btnY = modalY + modalHeight - btnHeight - 25;

        const dialogElements = [overlay, panel, title, costText];

        if (canAfford) {
            // Confirm button
            const confirmBtnX = modalX + modalWidth / 2 - btnWidth - 20;
            const confirmBtn = this.add.graphics();
            confirmBtn.fillStyle(0x00AA00, 1);
            confirmBtn.fillRoundedRect(confirmBtnX, btnY, btnWidth, btnHeight, 8);
            confirmBtn.setDepth(202);

            const confirmLabel = this.add.text(confirmBtnX + btnWidth / 2, btnY + btnHeight / 2, 'UNLOCK', {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(202);

            const confirmZone = this.add.zone(confirmBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            confirmZone.setInteractive({ useHandCursor: true });
            confirmZone.setDepth(203);

            confirmZone.on('pointerdown', () => {
                const result = window.GameState.unlockGate(gate.id, true);
                if (result.success) {
                    dialogElements.forEach(el => el.destroy());
                    confirmBtn.destroy();
                    confirmLabel.destroy();
                    confirmZone.destroy();
                    cancelBtn.destroy();
                    cancelLabel.destroy();
                    cancelZone.destroy();

                    this.showUnlockSuccess(gate);
                    this.refreshGates();
                }
            });

            dialogElements.push(confirmBtn, confirmLabel, confirmZone);

            // Cancel button
            const cancelBtnX = modalX + modalWidth / 2 + 20;
            const cancelBtn = this.add.graphics();
            cancelBtn.fillStyle(0xAA0000, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 8);
            cancelBtn.setDepth(202);

            const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'CANCEL', {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(202);

            const cancelZone = this.add.zone(cancelBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            cancelZone.setInteractive({ useHandCursor: true });
            cancelZone.setDepth(203);

            cancelZone.on('pointerdown', () => {
                dialogElements.forEach(el => el.destroy());
                confirmBtn.destroy();
                confirmLabel.destroy();
                confirmZone.destroy();
                cancelBtn.destroy();
                cancelLabel.destroy();
                cancelZone.destroy();
            });

            dialogElements.push(cancelBtn, cancelLabel, cancelZone);
        } else {
            // Close button only
            const closeBtnX = (width - btnWidth) / 2;
            const closeBtn = this.add.graphics();
            closeBtn.fillStyle(0x666666, 1);
            closeBtn.fillRoundedRect(closeBtnX, btnY, btnWidth, btnHeight, 8);
            closeBtn.setDepth(202);

            const closeLabel = this.add.text(closeBtnX + btnWidth / 2, btnY + btnHeight / 2, 'CLOSE', {
                fontSize: '16px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(202);

            const closeZone = this.add.zone(closeBtnX, btnY, btnWidth, btnHeight).setOrigin(0);
            closeZone.setInteractive({ useHandCursor: true });
            closeZone.setDepth(203);

            closeZone.on('pointerdown', () => {
                dialogElements.forEach(el => el.destroy());
                closeBtn.destroy();
                closeLabel.destroy();
                closeZone.destroy();
            });

            dialogElements.push(closeBtn, closeLabel, closeZone);
        }
    }

    showUnlockSuccess(gate) {
        const { width, height, isMobile } = this.dims;

        // Success message
        const successText = this.add.text(width / 2, height / 2, `🎉 ${gate.data.name} Unlocked!`, {
            fontSize: isMobile ? '24px' : '32px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(250).setAlpha(0);

        // Animate in
        this.tweens.add({
            targets: successText,
            alpha: 1,
            scale: { from: 0.5, to: 1.2 },
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Particle burst
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 30,
                color: [gate.config.color, 0xFFD700, 0xFFFFFF],
                duration: 2000
            });
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playLevelUp();
        }

        // Fade out
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: successText,
                alpha: 0,
                duration: 500,
                onComplete: () => successText.destroy()
            });
        });
    }

    refreshGates() {
        // Remove old gate elements
        this.gateElements.forEach(container => container.destroy());
        this.gates = [];
        this.gateElements = [];

        // Recreate gates
        this.createGates();
        this.selectGate(this.selectedGateIndex);
    }

    enterGate(gate) {
        if (this.isTransitioning) return;

        // Check if level is "Coming Soon" (in development)
        const comingSoonLevels = ['void_peaks', 'aurora_depths'];
        if (comingSoonLevels.includes(gate.id)) {
            this.showComingSoonModal(gate);
            return;
        }

        this.isTransitioning = true;

        console.log(`[HubWorldScene] Entering gate: ${gate.id}`);

        // Update GameState
        window.GameState?.enterGate(gate.id);

        // Show loading
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading(`Traveling to ${gate.data.name}...`);
        }

        // Transition effect
        const { width, height } = this.dims;

        const flash = this.add.graphics();
        flash.fillStyle(gate.config.color, 0);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(300);

        // Flash and transition
        this.tweens.add({
            targets: flash,
            alpha: 1,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                // Start appropriate scene based on gate
                if (gate.id === 'main') {
                    // Main sanctuary - top-down exploration
                    this.scene.start('GameScene', { biome: 'nebula' });
                } else if (gate.id === 'crystal_caves') {
                    // Crystal Caves - side-scrolling platformer level
                    this.scene.start('CrystalCavesLevel');
                } else if (gate.id === 'stellar_reef') {
                    // Stellar Reef - underwater swimming platformer level
                    this.scene.start('ReefLevel');
                } else {
                    // Other biomes - top-down for now (will become platformer levels)
                    this.scene.start('GameScene', { biome: gate.data.biome });
                }
            }
        });

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playPurchase();
        }
    }

    showComingSoonModal(gate) {
        const { width, height, isMobile } = this.dims;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Modal panel
        const modalWidth = isMobile ? width - 40 : 380;
        const modalHeight = 220;
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.lineStyle(3, gate.config.color);
        panel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        panel.setDepth(201);

        // Construction icon
        const constructionIcon = this.add.text(width / 2, modalY + 45, '🚧', {
            fontSize: '48px'
        }).setOrigin(0.5).setDepth(202);

        // Title
        const title = this.add.text(width / 2, modalY + 100, 'Coming Soon!', {
            fontSize: isMobile ? '24px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Description
        const desc = this.add.text(width / 2, modalY + 135,
            `${gate.data.name} is currently\nin development.`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#AAAAAA',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        const elements = [overlay, panel, constructionIcon, title, desc];

        // Close button
        const closeBtn = this.add.text(width / 2, modalY + modalHeight - 35, 'OK', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#666666',
            padding: { x: 30, y: 10 }
        }).setOrigin(0.5).setDepth(202);
        closeBtn.setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
            closeBtn.destroy();
        });

        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#888888' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#666666' }));

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    createCreatureDisplay() {
        const { centerX, centerY, platformRadius, isMobile } = this.dims;

        // Get active creature
        const creature = window.GameState?.getActiveCreature();

        if (creature && creature.textureName && this.textures.exists(creature.textureName)) {
            // Use existing texture
            this.creatureSprite = this.add.sprite(centerX, centerY - 10, creature.textureName);
            this.creatureSprite.setScale(isMobile ? 0.8 : 1);
            this.creatureSprite.setDepth(8);
        } else if (creature && creature.genes && this.graphicsEngine) {
            // Generate creature texture
            const { textureName } = this.graphicsEngine.createRandomizedSpaceMythicCreature(creature.genes, 0);
            this.creatureSprite = this.add.sprite(centerX, centerY - 10, textureName);
            this.creatureSprite.setScale(isMobile ? 0.8 : 1);
            this.creatureSprite.setDepth(8);
        } else {
            // Placeholder
            const placeholder = this.add.text(centerX, centerY, '🐾', {
                fontSize: isMobile ? '48px' : '64px'
            }).setOrigin(0.5).setDepth(8);

            this.creatureSprite = placeholder;
        }

        // Idle animation
        this.tweens.add({
            targets: this.creatureSprite,
            y: this.creatureSprite.y - 5,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Creature name below platform
        const creatureName = creature?.name || 'No Creature';
        this.creatureNameText = this.add.text(centerX, centerY + platformRadius + 10, creatureName, {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(8);
    }

    createUI() {
        const { width, height, isMobile } = this.dims;

        // Title
        const title = this.add.text(width / 2, 30, 'COSMIC HUB', {
            fontSize: isMobile ? '28px' : '42px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#4A0080',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(50);

        // Coins display
        const coins = window.GameState?.get('player.cosmicCoins') || 0;
        this.coinsText = this.add.text(width - 20, 20, `🪙 ${coins}`, {
            fontSize: isMobile ? '18px' : '24px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0).setDepth(50);

        // Info panel at bottom
        const infoPanelY = height - (isMobile ? 140 : 160);
        const infoPanelHeight = isMobile ? 130 : 150;

        const infoPanel = this.add.graphics();
        infoPanel.fillStyle(0x1A0A2E, 0.9);
        infoPanel.fillRoundedRect(20, infoPanelY, width - 40, infoPanelHeight, 15);
        infoPanel.lineStyle(3, 0x6B00B3);
        infoPanel.strokeRoundedRect(20, infoPanelY, width - 40, infoPanelHeight, 15);
        infoPanel.setDepth(40);

        // Info text
        this.infoText = this.add.text(width / 2, infoPanelY + 30, 'Select a gate', {
            fontSize: isMobile ? '18px' : '24px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(41);

        // Action button
        const actionBtnY = infoPanelY + infoPanelHeight - 60;

        this.actionButton = this.add.graphics();
        this.actionButton.fillStyle(0x00AA00, 1);
        this.actionButton.fillRoundedRect(width / 2 - 60, actionBtnY - 25, 120, 50, 10);
        this.actionButton.setDepth(41);

        this.actionLabel = this.add.text(width / 2, actionBtnY, 'ENTER', {
            fontSize: isMobile ? '18px' : '22px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(42);

        const actionZone = this.add.zone(width / 2 - 60, actionBtnY - 25, 120, 50).setOrigin(0);
        actionZone.setInteractive({ useHandCursor: true });
        actionZone.setDepth(42);

        actionZone.on('pointerdown', () => {
            const selectedGate = this.gates[this.selectedGateIndex];
            if (selectedGate) {
                this.onGateClicked(selectedGate, this.selectedGateIndex);
            }
        });

        // Back button (to return to GameScene if coming from there)
        const backBtn = this.add.text(20, 20, '← Back', {
            fontSize: isMobile ? '16px' : '20px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0, 0).setDepth(50);
        backBtn.setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        backBtn.on('pointerover', () => backBtn.setAlpha(0.8));
        backBtn.on('pointerout', () => backBtn.setAlpha(1));
    }

    createCollectionButton() {
        const { width, height, isMobile } = this.dims;

        // Collection button to view/switch creatures
        const collectionStatus = window.GameState?.getCollectionStatus() || { count: 0, max: 8 };

        const btnX = isMobile ? width - 60 : width - 80;
        const btnY = isMobile ? 70 : 80;

        const collectionBtn = this.add.graphics();
        collectionBtn.fillStyle(0x4A0080, 0.9);
        collectionBtn.fillRoundedRect(btnX - 50, btnY - 25, 100, 50, 10);
        collectionBtn.lineStyle(2, 0x9370DB);
        collectionBtn.strokeRoundedRect(btnX - 50, btnY - 25, 100, 50, 10);
        collectionBtn.setDepth(50);

        const collectionLabel = this.add.text(btnX, btnY, `🐾 ${collectionStatus.count}/${collectionStatus.max}`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(51);

        const collectionZone = this.add.zone(btnX - 50, btnY - 25, 100, 50).setOrigin(0);
        collectionZone.setInteractive({ useHandCursor: true });
        collectionZone.setDepth(51);

        collectionZone.on('pointerdown', () => {
            this.showCreatureCollection();
        });

        this.collectionButton = { btn: collectionBtn, label: collectionLabel, zone: collectionZone };
    }

    showCreatureCollection() {
        const { width, height, isMobile } = this.dims;

        // Get creatures
        const creatures = window.GameState?.getCreatureCollection() || [];
        const activeIndex = window.GameState?.get('activeCreatureIndex') || 0;

        if (creatures.length === 0) {
            // Show message
            const msg = this.add.text(width / 2, height / 2, 'No creatures in collection yet!', {
                fontSize: '20px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(250);

            this.time.delayedCall(2000, () => msg.destroy());
            return;
        }

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Panel
        const panelWidth = isMobile ? width - 40 : 500;
        const panelHeight = Math.min(height - 100, creatures.length * 80 + 120);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, 0x9370DB);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, panelY + 30, '🐾 Creature Collection', {
            fontSize: isMobile ? '22px' : '28px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        const elements = [overlay, panel, title];

        // List creatures
        creatures.forEach((creature, index) => {
            const itemY = panelY + 80 + index * 70;

            // Item background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(index === activeIndex ? 0x4A0080 : 0x2A0040, 0.8);
            itemBg.fillRoundedRect(panelX + 20, itemY, panelWidth - 40, 60, 8);
            if (index === activeIndex) {
                itemBg.lineStyle(2, 0xFFD700);
                itemBg.strokeRoundedRect(panelX + 20, itemY, panelWidth - 40, 60, 8);
            }
            itemBg.setDepth(202);
            elements.push(itemBg);

            // Creature name and info
            const nameText = this.add.text(panelX + 40, itemY + 15,
                `${creature.name}${index === activeIndex ? ' (Active)' : ''}`, {
                fontSize: '18px',
                color: index === activeIndex ? '#FFD700' : '#FFFFFF',
                fontStyle: 'bold'
            }).setDepth(203);
            elements.push(nameText);

            const infoText = this.add.text(panelX + 40, itemY + 38,
                `Lv.${creature.level || 1} • ${creature.rarity || 'common'}`, {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setDepth(203);
            elements.push(infoText);

            // Select button
            if (index !== activeIndex) {
                const selectBtn = this.add.text(panelX + panelWidth - 80, itemY + 30, 'SELECT', {
                    fontSize: '14px',
                    color: '#FFFFFF',
                    backgroundColor: '#00AA00',
                    padding: { x: 10, y: 5 }
                }).setOrigin(0.5).setDepth(203);
                selectBtn.setInteractive({ useHandCursor: true });

                selectBtn.on('pointerdown', () => {
                    window.GameState?.switchActiveCreature(index);

                    // Close modal and refresh
                    elements.forEach(el => el.destroy());
                    this.refreshCreatureDisplay();
                });

                elements.push(selectBtn);
            }
        });

        // Close button
        const closeBtn = this.add.text(width / 2, panelY + panelHeight - 30, 'CLOSE', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#666666',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(202);
        closeBtn.setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
            closeBtn.destroy();
        });
    }

    refreshCreatureDisplay() {
        // Refresh creature on platform
        if (this.creatureSprite) {
            this.creatureSprite.destroy();
        }
        if (this.creatureNameText) {
            this.creatureNameText.destroy();
        }

        this.createCreatureDisplay();

        // Update collection button
        const collectionStatus = window.GameState?.getCollectionStatus() || { count: 0, max: 8 };
        if (this.collectionButton?.label) {
            this.collectionButton.label.setText(`🐾 ${collectionStatus.count}/${collectionStatus.max}`);
        }
    }

    setupInput() {
        // Keyboard navigation
        this.input.keyboard.on('keydown-LEFT', () => {
            const newIndex = (this.selectedGateIndex - 1 + this.gates.length) % this.gates.length;
            this.selectGate(newIndex);
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            const newIndex = (this.selectedGateIndex + 1) % this.gates.length;
            this.selectGate(newIndex);
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            const selectedGate = this.gates[this.selectedGateIndex];
            if (selectedGate) {
                this.onGateClicked(selectedGate, this.selectedGateIndex);
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('GameScene');
        });

        // H key to return here from GameScene
        console.log('[HubWorldScene] Input setup complete (Arrow keys, Enter, ESC)');
    }

    shutdown() {
        if (this._isShuttingDown) return;
        this._isShuttingDown = true;

        console.log('[HubWorldScene] Shutting down');

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-LEFT');
            this.input.keyboard.off('keydown-RIGHT');
            this.input.keyboard.off('keydown-ENTER');
            this.input.keyboard.off('keydown-ESC');
        }

        // Remove gate zone listeners
        this.gates.forEach(gate => {
            if (gate.zone && gate.zone.removeAllListeners) {
                gate.zone.removeAllListeners();
            }
        });

        // Clear timers and tweens
        if (this.time) this.time.removeAllEvents();
        if (this.tweens) this.tweens.killAll();

        // Clear references
        this.graphicsEngine = null;
        this.gates = [];
        this.gateElements = [];
        this.creatureSprite = null;

        console.log('[HubWorldScene] Cleanup complete');
    }
}

// Register globally
if (typeof window !== 'undefined') {
    window.HubWorldScene = HubWorldScene;
}

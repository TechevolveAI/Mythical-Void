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
        this.shipAssemblyElements = [];
        this.portalVortexElements = [];
        this.vortexTimers = [];
        this.parallaxLayers = [];
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
        this.createShipAssemblyView(); // Ship visualization above creature
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
        const { width, height, isMobile } = this.dims;

        // Deep cosmic background gradient
        const bg = this.add.graphics();
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

        // Create parallax star layers
        this.createParallaxStars();

        // Floating cosmic particles
        this.createFloatingParticles();

        // Track pointer for parallax effect
        this.lastPointerX = width / 2;
        this.lastPointerY = height / 2;

        this.input.on('pointermove', (pointer) => {
            this.lastPointerX = pointer.x;
            this.lastPointerY = pointer.y;
        });

        // Timer-based parallax update (50ms = 20fps)
        this.parallaxTimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updateParallaxStars(),
            loop: true
        });
    }

    /**
     * Create parallax star layers for depth effect
     */
    createParallaxStars() {
        const { width, height, isMobile } = this.dims;

        // Star layer definitions (reduced on mobile for performance)
        const layers = [
            { count: isMobile ? 60 : 100, parallaxFactor: 0.02, sizeMin: 0.5, sizeMax: 1.5, alpha: 0.3, depth: 1 }, // Far
            { count: isMobile ? 35 : 60, parallaxFactor: 0.05, sizeMin: 1, sizeMax: 2.5, alpha: 0.5, depth: 2 },   // Mid
            { count: isMobile ? 15 : 30, parallaxFactor: 0.1, sizeMin: 2, sizeMax: 4, alpha: 0.8, depth: 3 }       // Near
        ];

        this.parallaxLayers = [];

        layers.forEach(layer => {
            const stars = [];

            for (let i = 0; i < layer.count; i++) {
                const originalX = Phaser.Math.Between(0, width);
                const originalY = Phaser.Math.Between(0, height);
                const size = Phaser.Math.FloatBetween(layer.sizeMin, layer.sizeMax);

                const star = this.add.graphics();
                star.fillStyle(0xFFFFFF, layer.alpha);
                star.fillCircle(0, 0, size);
                star.setPosition(originalX, originalY);
                star.setDepth(layer.depth);

                stars.push({
                    graphics: star,
                    originalX: originalX,
                    originalY: originalY
                });
            }

            this.parallaxLayers.push({
                factor: layer.parallaxFactor,
                stars: stars
            });
        });

        // Add twinkling effect to near stars
        const nearLayer = this.parallaxLayers[2];
        if (nearLayer) {
            nearLayer.stars.forEach((star, i) => {
                // Stagger twinkling
                this.time.delayedCall(i * 100, () => {
                    this.tweens.add({
                        targets: star.graphics,
                        alpha: { from: 0.8, to: 0.4 },
                        duration: Phaser.Math.Between(2000, 4000),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                });
            });
        }
    }

    /**
     * Update parallax star positions based on pointer
     */
    updateParallaxStars() {
        if (this._isShuttingDown || !this.parallaxLayers) return;

        const { width, height } = this.dims;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate offset from center (-1 to 1)
        const offsetX = (this.lastPointerX - centerX) / centerX;
        const offsetY = (this.lastPointerY - centerY) / centerY;

        this.parallaxLayers.forEach(layer => {
            layer.stars.forEach(star => {
                // Apply parallax offset
                const newX = star.originalX - (offsetX * 30 * layer.factor);
                const newY = star.originalY - (offsetY * 20 * layer.factor);
                star.graphics.setPosition(newX, newY);
            });
        });
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
            main: { color: 0x7B68EE, icon: '🏠', label: 'Sanctuary' },
            stellar_reef: { color: 0x00CED1, icon: '🐠', label: 'Stellar Reef', shipPart: '⚙️' },
            crystal_caves: { color: 0xE040FB, icon: '💎', label: 'Crystal Caves', shipPart: '🔮' },
            void_peaks: { color: 0x37474F, icon: '⛰️', label: 'Void Peaks', shipPart: '🌀' },
            aurora_depths: { color: 0x00E676, icon: '🌌', label: 'Aurora Depths', shipPart: '✨' }
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

            // Check if gate is in development
            const isInDevelopment = gateData.inDevelopment === true;

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
            if (isInDevelopment) {
                // In Development: Blueprint/wireframe style with construction stripes
                gateBg.fillStyle(0x1A1A2E, 0.9);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0xFF9800); // Orange construction border
                gateBg.strokeCircle(0, 0, gateSize);

                // Construction stripes pattern (diagonal lines)
                gateBg.lineStyle(3, 0xFF9800, 0.3);
                for (let i = -gateSize; i < gateSize; i += 15) {
                    gateBg.beginPath();
                    gateBg.moveTo(i, -gateSize);
                    gateBg.lineTo(i + gateSize, gateSize);
                    gateBg.strokePath();
                }
            } else if (gateData.unlocked) {
                gateBg.fillStyle(config.color, 0.9);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0xFFD700);
                gateBg.strokeCircle(0, 0, gateSize);
            } else {
                gateBg.fillStyle(0x333333, 0.8);
                gateBg.fillCircle(0, 0, gateSize);
                gateBg.lineStyle(4, 0x555555);
                gateBg.strokeCircle(0, 0, gateSize);
            }
            gateContainer.add(gateBg);

            // Gate content based on state
            if (isInDevelopment) {
                // In Development: Construction icon and label
                const constructionIcon = this.add.text(0, -15, '🚧', {
                    fontSize: isMobile ? '28px' : '36px'
                }).setOrigin(0.5);
                gateContainer.add(constructionIcon);

                const devLabel = this.add.text(0, 20, 'IN DEV', {
                    fontSize: isMobile ? '10px' : '12px',
                    color: '#FF9800',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                gateContainer.add(devLabel);

                // Pulsing animation for construction icon
                this.tweens.add({
                    targets: constructionIcon,
                    alpha: { from: 1, to: 0.5 },
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
            } else if (!gateData.unlocked) {
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
            const labelColor = isInDevelopment ? '#FF9800' : (gateData.unlocked ? '#FFFFFF' : '#888888');
            const label = this.add.text(0, gateSize + 20, config.label, {
                fontSize: isMobile ? '12px' : '16px',
                color: labelColor,
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            }).setOrigin(0.5);
            gateContainer.add(label);

            // Add completion badge for unlocked, non-development gates
            if (gateData.unlocked && !isInDevelopment && gateId !== 'main') {
                this.createCompletionBadge(gateId, gateContainer, gateSize, isMobile);
            }

            // Add portal vortex effect for unlocked, non-development gates
            if (gateData.unlocked && !isInDevelopment) {
                this.createPortalVortex(gateContainer, gateId, gateSize, config.color, isMobile);
            }

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

    /**
     * Create completion badge for a gate showing star rating
     * @param {string} gateId - Gate identifier
     * @param {Phaser.GameObjects.Container} container - Gate container
     * @param {number} gateSize - Gate circle radius
     * @param {boolean} isMobile - Mobile flag
     */
    createCompletionBadge(gateId, container, gateSize, isMobile) {
        // Map gate IDs to level data paths
        const levelIdMap = {
            crystal_caves: 'crystalCaves',
            stellar_reef: 'cosmicReef',
            void_peaks: 'voidPeaks',
            aurora_depths: 'auroraDepths'
        };

        const levelId = levelIdMap[gateId];
        if (!levelId) return;

        // Get level completion data
        const levelData = window.GameState?.get(`levels.${levelId}`) || {};
        const { completed, noDamageRun, speedrun, visited } = levelData;

        // Calculate star count
        let stars = 0;
        if (completed) stars = 1;
        if (completed && noDamageRun) stars = 2;
        if (completed && noDamageRun && speedrun) stars = 3;

        // Position badge at top-right of gate
        const badgeX = gateSize * 0.7;
        const badgeY = -gateSize * 0.7;
        const badgeRadius = isMobile ? 14 : 18;

        // Only show badge if level has been visited or completed
        if (!visited && !completed) return;

        // Badge background
        const badgeBg = this.add.graphics();

        if (stars > 0) {
            // Star badge with gold border
            badgeBg.fillStyle(0x1A0A2E, 1);
            badgeBg.fillCircle(badgeX, badgeY, badgeRadius);
            badgeBg.lineStyle(2, 0xFFD700);
            badgeBg.strokeCircle(badgeX, badgeY, badgeRadius);
        } else {
            // In-progress badge (visited but not completed)
            badgeBg.fillStyle(0x1A0A2E, 1);
            badgeBg.fillCircle(badgeX, badgeY, badgeRadius);
            badgeBg.lineStyle(2, 0x4CAF50);
            badgeBg.strokeCircle(badgeX, badgeY, badgeRadius);
        }
        container.add(badgeBg);

        // Badge content
        if (stars > 0) {
            // Show stars
            const starText = '⭐'.repeat(stars);
            const starDisplay = this.add.text(badgeX, badgeY, starText, {
                fontSize: stars === 3 ? (isMobile ? '8px' : '10px') : (isMobile ? '10px' : '12px')
            }).setOrigin(0.5);
            container.add(starDisplay);

            // Subtle pulse for 3-star completion
            if (stars === 3) {
                this.tweens.add({
                    targets: [badgeBg, starDisplay],
                    alpha: { from: 1, to: 0.7 },
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        } else {
            // Checkmark for in-progress
            const checkmark = this.add.text(badgeX, badgeY, '✓', {
                fontSize: isMobile ? '12px' : '16px',
                color: '#4CAF50',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(checkmark);
        }
    }

    /**
     * Create portal vortex effect with swirling particles
     * @param {Phaser.GameObjects.Container} container - Gate container
     * @param {string} gateId - Gate identifier
     * @param {number} gateSize - Gate radius
     * @param {number} color - Gate theme color
     * @param {boolean} isMobile - Mobile flag
     */
    createPortalVortex(container, gateId, gateSize, color, isMobile) {
        // Reduce particle count on mobile for performance
        const particleCount = isMobile ? 10 : 15;
        const vortexRadius = gateSize * 0.8;

        // Create depth glow layers (behind particles)
        const glowGraphics = this.add.graphics();

        // Outer glow
        glowGraphics.fillStyle(color, 0.1);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.9);

        // Middle glow
        glowGraphics.fillStyle(color, 0.2);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.6);

        // Inner glow (brightest)
        glowGraphics.fillStyle(color, 0.4);
        glowGraphics.fillCircle(0, 0, vortexRadius * 0.3);

        container.addAt(glowGraphics, 1); // Behind gate icon but above background

        // Create particles
        const particles = [];
        for (let i = 0; i < particleCount; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.FloatBetween(isMobile ? 2 : 3, isMobile ? 4 : 6);
            const alpha = Phaser.Math.FloatBetween(0.5, 0.8);

            // Particle color (mix of gate color, gold, and white for variety)
            const particleColors = [color, 0xFFD700, 0xFFFFFF];
            const particleColor = Phaser.Utils.Array.GetRandom(particleColors);

            particle.fillStyle(particleColor, alpha);
            particle.fillCircle(0, 0, size);

            // Initial position in spiral
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = Phaser.Math.FloatBetween(vortexRadius * 0.2, vortexRadius * 0.85);

            particle.setPosition(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );

            container.addAt(particle, 2); // Layer above glow

            particles.push({
                graphics: particle,
                angle: angle,
                radius: radius,
                speed: Phaser.Math.FloatBetween(0.015, 0.03), // Variable rotation speed
                radiusOscillation: Phaser.Math.FloatBetween(0, Math.PI * 2) // Phase offset for radius breathing
            });
        }

        // Store for cleanup
        if (!this.portalVortexElements) this.portalVortexElements = [];
        this.portalVortexElements.push({
            glow: glowGraphics,
            particles: particles,
            container: container
        });

        // Timer-based animation (50ms = 20fps)
        const vortexTimer = this.time.addEvent({
            delay: 50,
            callback: () => this.updatePortalVortex(particles, vortexRadius),
            loop: true
        });

        // Store timer reference for cleanup
        if (!this.vortexTimers) this.vortexTimers = [];
        this.vortexTimers.push(vortexTimer);
    }

    /**
     * Update portal vortex particles (called by timer)
     */
    updatePortalVortex(particles, vortexRadius) {
        if (this._isShuttingDown) return;

        particles.forEach(p => {
            // Update angle (rotation)
            p.angle += p.speed;

            // Subtle radius breathing effect
            p.radiusOscillation += 0.02;
            const breathingOffset = Math.sin(p.radiusOscillation) * 5;
            const effectiveRadius = Math.max(vortexRadius * 0.15, Math.min(vortexRadius * 0.85, p.radius + breathingOffset));

            // Update position
            p.graphics.setPosition(
                Math.cos(p.angle) * effectiveRadius,
                Math.sin(p.angle) * effectiveRadius
            );
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

        // Show details panel for selected gate
        this.showDetailsPanel(this.gates[index]);

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }
    }

    /**
     * Gate details data for hover panel
     */
    getGateDetails() {
        return {
            main: { difficulty: '⭐', boss: 'None', reward: 'Rest & Recovery', desc: 'Safe sanctuary for your creature' },
            stellar_reef: { difficulty: '⭐⭐⭐', boss: "Nyx'voral", reward: 'Dimensional Drive', desc: 'Cosmic underwater realm' },
            crystal_caves: { difficulty: '⭐⭐', boss: 'Crystal Golem', reward: 'Crystal Core', desc: 'Crystalline underground maze' },
            void_peaks: { difficulty: '⭐⭐⭐⭐', boss: 'Void Titan', reward: 'Void Stabilizer', desc: 'Treacherous mountain peaks' },
            aurora_depths: { difficulty: '⭐⭐⭐⭐⭐', boss: 'Aurora Dragon', reward: 'Aurora Reactor', desc: 'Deepest cosmic abyss' }
        };
    }

    /**
     * Show detailed info panel for selected gate
     */
    showDetailsPanel(gate) {
        if (!gate) return;

        // Hide existing panel
        this.hideDetailsPanel();

        const { width, height, isMobile } = this.dims;
        const gateDetails = this.getGateDetails();
        const details = gateDetails[gate.id] || {};

        // Get level completion data
        const levelIdMap = {
            crystal_caves: 'crystalCaves',
            stellar_reef: 'cosmicReef',
            void_peaks: 'voidPeaks',
            aurora_depths: 'auroraDepths'
        };
        const levelId = levelIdMap[gate.id];
        const levelData = levelId ? (window.GameState?.get(`levels.${levelId}`) || {}) : {};

        // Panel dimensions and position
        const panelWidth = isMobile ? width - 40 : 280;
        const panelHeight = isMobile ? 100 : 150;
        const panelX = isMobile ? 20 : width - panelWidth - 20;
        const panelY = isMobile ? height - 280 : 120;

        // Create panel elements
        this.detailsPanelElements = [];

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(0x1A0A2E, 0.95);
        panel.fillRoundedRect(panelX, panelY + 20, panelWidth, panelHeight, 12);
        panel.lineStyle(2, gate.config.color, 0.8);
        panel.strokeRoundedRect(panelX, panelY + 20, panelWidth, panelHeight, 12);
        panel.setDepth(100);
        panel.setAlpha(0);
        this.detailsPanelElements.push(panel);

        // Gate icon and name header
        const header = this.add.text(panelX + 15, panelY + 35, `${gate.config.icon} ${gate.data.name}`, {
            fontSize: isMobile ? '16px' : '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setDepth(101).setAlpha(0);
        this.detailsPanelElements.push(header);

        // Difficulty
        const difficulty = this.add.text(panelX + 15, panelY + 60, `Difficulty: ${details.difficulty || '?'}`, {
            fontSize: isMobile ? '12px' : '14px',
            color: '#FFFFFF'
        }).setDepth(101).setAlpha(0);
        this.detailsPanelElements.push(difficulty);

        // Boss info (only show if not main and not in development)
        if (gate.id !== 'main' && !gate.data.inDevelopment) {
            const boss = this.add.text(panelX + 15, panelY + 82, `Boss: ${details.boss || 'Unknown'}`, {
                fontSize: isMobile ? '12px' : '14px',
                color: '#FF6B6B'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(boss);

            // Reward
            const reward = this.add.text(panelX + 15, panelY + 104, `Reward: ${gate.config.shipPart || '🎁'} ${details.reward || '???'}`, {
                fontSize: isMobile ? '12px' : '14px',
                color: '#00CED1'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(reward);

            // Best time / visits (if visited)
            if (levelData.visited || levelData.completed) {
                const bestTime = levelData.bestTime ? this.formatTime(levelData.bestTime) : 'N/A';
                const stats = this.add.text(panelX + 15, panelY + 126, `Best Time: ${bestTime}  •  Visits: ${gate.data.visits || 0}`, {
                    fontSize: isMobile ? '10px' : '12px',
                    color: '#AAAAAA'
                }).setDepth(101).setAlpha(0);
                this.detailsPanelElements.push(stats);
            }
        } else if (gate.data.inDevelopment) {
            const devNote = this.add.text(panelX + 15, panelY + 82, '🚧 Coming in future update!', {
                fontSize: isMobile ? '12px' : '14px',
                color: '#FF9800'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(devNote);

            const teaser = this.add.text(panelX + 15, panelY + 104, details.desc || 'New adventures await...', {
                fontSize: isMobile ? '11px' : '13px',
                color: '#888888',
                fontStyle: 'italic'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(teaser);
        } else {
            // Main sanctuary
            const desc = this.add.text(panelX + 15, panelY + 82, details.desc || 'Your creature\'s home', {
                fontSize: isMobile ? '12px' : '14px',
                color: '#9370DB'
            }).setDepth(101).setAlpha(0);
            this.detailsPanelElements.push(desc);
        }

        // Animate in (slide up + fade in)
        this.detailsPanelElements.forEach((el, i) => {
            this.tweens.add({
                targets: el,
                alpha: 1,
                y: el.y - 20,
                duration: 200,
                delay: i * 30,
                ease: 'Power2'
            });
        });
    }

    /**
     * Hide details panel
     */
    hideDetailsPanel() {
        if (!this.detailsPanelElements) return;

        // Animate out and destroy
        this.detailsPanelElements.forEach(el => {
            this.tweens.add({
                targets: el,
                alpha: 0,
                y: el.y + 10,
                duration: 150,
                ease: 'Power2',
                onComplete: () => {
                    if (el && el.destroy) el.destroy();
                }
            });
        });

        this.detailsPanelElements = [];
    }

    /**
     * Format time in mm:ss
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateInfoPanel(gate) {
        if (!gate) return;

        const isInDevelopment = gate.data.inDevelopment === true;

        // Update info text
        if (this.infoText) {
            let info = `${gate.config.icon} ${gate.data.name}`;
            if (isInDevelopment) {
                info += `\n🚧 In Development`;
                if (gate.data.shipPart) {
                    info += `\nReward: ${gate.config.shipPart || '⚙️'} ${gate.data.shipPart}`;
                }
            } else if (gate.data.unlocked) {
                info += `\nVisits: ${gate.data.visits || 0}`;
                if (gate.data.shipPart) {
                    info += `  •  Reward: ${gate.config.shipPart || '⚙️'}`;
                }
            } else {
                info += `\n🔒 Unlock: ${gate.data.unlockCost} coins`;
                if (gate.data.shipPart) {
                    info += `\nReward: ${gate.config.shipPart || '⚙️'} ${gate.data.shipPart}`;
                }
            }
            this.infoText.setText(info);
        }

        // Update action button
        if (this.actionButton && this.actionLabel) {
            if (isInDevelopment) {
                // In Development - show disabled state
                this.actionLabel.setText('COMING SOON');
                this.actionButton.clear();
                this.actionButton.fillStyle(0x555555, 1);
                this.actionButton.fillRoundedRect(-70, -25, 140, 50, 10);
                this.actionButton.lineStyle(3, 0xFF9800);
                this.actionButton.strokeRoundedRect(-70, -25, 140, 50, 10);
            } else if (gate.data.unlocked) {
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

        // Check if gate is in development - show coming soon modal instead
        if (gate.data.inDevelopment) {
            this.showComingSoonModal(gate);
            return;
        }

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

        // Double-check for in-development gates (should be caught earlier)
        if (gate.data.inDevelopment) {
            this.showComingSoonModal(gate);
            return;
        }

        this.isTransitioning = true;

        console.log(`[HubWorldScene] Entering gate: ${gate.id}`);

        // Update GameState
        window.GameState?.enterGate(gate.id);

        // Show loading (will appear after transition)
        if (window.UXEnhancements) {
            this.time.delayedCall(800, () => {
                window.UXEnhancements.showLoading(`Traveling to ${gate.data.name}...`);
            });
        }

        // Cinematic transition
        this.playCinematicGateEntry(gate);
    }

    /**
     * Play cinematic gate entry sequence
     * Timeline: zoom → particles → radial wipe → transition
     */
    playCinematicGateEntry(gate) {
        const { width, height, isMobile } = this.dims;
        const gateX = gate.x;
        const gateY = gate.y;

        // 0ms: Camera zoom toward gate (400ms)
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 1.5,
            scrollX: gateX - width / 2,
            scrollY: gateY - height / 2,
            duration: 400,
            ease: 'Power2'
        });

        // 300ms: Particle burst from gate
        this.time.delayedCall(300, () => {
            this.createGateEntryBurst(gateX, gateY, gate.config.color);

            // Play whoosh/portal sound
            if (window.AudioManager) {
                window.AudioManager.playPurchase();
            }
        });

        // 500ms: Expanding radial wipe from gate center
        this.time.delayedCall(500, () => {
            this.createRadialWipe(gateX, gateY, gate.config.color, () => {
                // 900ms: Scene transition
                this.transitionToGateScene(gate);
            });
        });
    }

    /**
     * Create particle burst effect at gate position
     */
    createGateEntryBurst(x, y, color) {
        // Particle count based on device
        const particleCount = this.dims.isMobile ? 20 : 40;
        const colors = [color, 0xFFD700, 0xFFFFFF];

        for (let i = 0; i < particleCount; i++) {
            const particle = this.add.graphics();
            const size = Phaser.Math.FloatBetween(2, 6);
            const particleColor = Phaser.Utils.Array.GetRandom(colors);

            particle.fillStyle(particleColor, Phaser.Math.FloatBetween(0.6, 1));
            particle.fillCircle(0, 0, size);
            particle.setPosition(x, y);
            particle.setDepth(250);

            // Random direction burst
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.FloatBetween(100, 300);
            const targetX = x + Math.cos(angle) * speed;
            const targetY = y + Math.sin(angle) * speed;

            this.tweens.add({
                targets: particle,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: { from: 1, to: 0.2 },
                duration: Phaser.Math.Between(400, 800),
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }

        // Add FXLibrary burst if available
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, x, y, {
                count: 20,
                color: [color, 0xFFD700],
                duration: 1000
            });
        }
    }

    /**
     * Create expanding radial wipe effect
     */
    createRadialWipe(centerX, centerY, color, onComplete) {
        const { width, height } = this.dims;
        const maxRadius = Math.max(width, height) * 1.5;

        // Create circular mask/wipe
        const wipe = this.add.graphics();
        wipe.setDepth(300);

        // Animate expanding circle
        let currentRadius = 0;

        const wipeTimer = this.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                currentRadius += 30; // Expansion speed

                wipe.clear();
                wipe.fillStyle(color, 1);
                wipe.fillCircle(centerX, centerY, currentRadius);

                // Add inner glow ring
                if (currentRadius > 50) {
                    wipe.lineStyle(4, 0xFFFFFF, 0.5);
                    wipe.strokeCircle(centerX, centerY, currentRadius - 20);
                }

                if (currentRadius >= maxRadius) {
                    wipeTimer.destroy();
                    if (onComplete) onComplete();
                }
            },
            loop: true
        });
    }

    /**
     * Transition to appropriate scene based on gate
     */
    transitionToGateScene(gate) {
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

    /**
     * Create Ship Assembly View - visual ship being built with collected parts
     * Positioned above creature display showing ship hull outline with part positions
     */
    createShipAssemblyView() {
        const { centerX, centerY, isMobile } = this.dims;

        // Get ship parts status
        const shipParts = window.GameState?.get('hubWorld.shipParts') || {
            collected: [],
            totalRequired: 4,
            finalBossUnlocked: false
        };
        const collectedParts = shipParts.collected || [];
        const allCollected = collectedParts.length === 4;

        // Position above creature display
        const shipY = centerY - (isMobile ? 150 : 200);
        const shipScale = isMobile ? 0.7 : 1.0;

        // Part definitions with positions relative to ship center
        const partDefs = {
            dimensional_drive: { x: 0, y: 35 * shipScale, icon: '⚙️', label: 'Engine' },
            crystal_core: { x: -30 * shipScale, y: 0, icon: '🔮', label: 'Core' },
            void_stabilizer: { x: 30 * shipScale, y: 0, icon: '🌀', label: 'Stabilizer' },
            aurora_reactor: { x: 0, y: -35 * shipScale, icon: '✨', label: 'Reactor' }
        };

        // Store elements for cleanup
        this.shipAssemblyElements = [];

        // Create ship container
        const shipContainer = this.add.container(centerX, shipY);
        shipContainer.setDepth(15);
        this.shipAssemblyElements.push(shipContainer);

        // Draw ship hull outline (dashed purple lines connecting part positions)
        const hull = this.add.graphics();
        hull.lineStyle(2, 0x7B68EE, 0.5);

        // Draw hull shape as connected lines (diamond shape)
        const points = [
            { x: partDefs.aurora_reactor.x, y: partDefs.aurora_reactor.y }, // Top
            { x: partDefs.void_stabilizer.x + 15, y: partDefs.void_stabilizer.y }, // Right
            { x: partDefs.dimensional_drive.x, y: partDefs.dimensional_drive.y + 10 }, // Bottom
            { x: partDefs.crystal_core.x - 15, y: partDefs.crystal_core.y } // Left
        ];

        // Draw dashed hull outline
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];
            this.drawDashedLine(hull, start.x, start.y, end.x, end.y, 5, 5);
        }

        shipContainer.add(hull);

        // Glow effect for completed ship
        if (allCollected) {
            const glow = this.add.graphics();
            glow.fillStyle(0xFFD700, 0.2);
            glow.fillCircle(0, 0, 60 * shipScale);
            shipContainer.add(glow);

            // Pulse glow animation
            this.tweens.add({
                targets: glow,
                alpha: { from: 0.2, to: 0.5 },
                scaleX: { from: 1, to: 1.2 },
                scaleY: { from: 1, to: 1.2 },
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Draw connection lines between collected parts
        const connectionGraphics = this.add.graphics();
        connectionGraphics.lineStyle(2, 0xFFD700, 0.6);
        shipContainer.add(connectionGraphics);

        // Track collected part positions for connection lines
        const collectedPositions = [];

        // Create part slots
        Object.entries(partDefs).forEach(([partId, def]) => {
            const isCollected = collectedParts.includes(partId);
            const slotSize = isMobile ? 18 : 24;

            // Part background circle
            const slotBg = this.add.graphics();
            if (isCollected) {
                // Collected: Gold glow with full opacity
                slotBg.fillStyle(0xFFD700, 0.3);
                slotBg.fillCircle(def.x, def.y, slotSize + 5);
                slotBg.fillStyle(0x1A0A2E, 1);
                slotBg.fillCircle(def.x, def.y, slotSize);
                slotBg.lineStyle(2, 0xFFD700);
                slotBg.strokeCircle(def.x, def.y, slotSize);

                collectedPositions.push({ x: def.x, y: def.y });
            } else {
                // Missing: Gray, low opacity
                slotBg.fillStyle(0x333333, 0.5);
                slotBg.fillCircle(def.x, def.y, slotSize);
                slotBg.lineStyle(1, 0x555555, 0.5);
                slotBg.strokeCircle(def.x, def.y, slotSize);
            }
            shipContainer.add(slotBg);

            // Part icon
            const icon = this.add.text(def.x, def.y, def.icon, {
                fontSize: isMobile ? '16px' : '22px'
            }).setOrigin(0.5);

            if (!isCollected) {
                icon.setAlpha(0.3);
            }
            shipContainer.add(icon);

            // Pulsing animation for collected parts
            if (isCollected) {
                this.tweens.add({
                    targets: [icon],
                    alpha: { from: 1, to: 0.6 },
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        // Draw connection lines between adjacent collected parts
        if (collectedPositions.length >= 2) {
            for (let i = 0; i < collectedPositions.length; i++) {
                for (let j = i + 1; j < collectedPositions.length; j++) {
                    connectionGraphics.beginPath();
                    connectionGraphics.moveTo(collectedPositions[i].x, collectedPositions[i].y);
                    connectionGraphics.lineTo(collectedPositions[j].x, collectedPositions[j].y);
                    connectionGraphics.strokePath();
                }
            }
        }

        // Progress counter
        const progressText = this.add.text(0, 55 * shipScale, `${collectedParts.length}/4 Parts`, {
            fontSize: isMobile ? '12px' : '14px',
            color: allCollected ? '#FFD700' : '#AAAAAA',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        shipContainer.add(progressText);

        // "READY!" text when all parts collected
        if (allCollected) {
            const readyText = this.add.text(0, 75 * shipScale, '⚔️ READY! ⚔️', {
                fontSize: isMobile ? '14px' : '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#004400',
                strokeThickness: 2
            }).setOrigin(0.5);
            shipContainer.add(readyText);

            // Pulsing animation for ready text
            this.tweens.add({
                targets: readyText,
                scale: { from: 1, to: 1.1 },
                duration: 600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    /**
     * Draw a dashed line on graphics object
     */
    drawDashedLine(graphics, x1, y1, x2, y2, dashLength = 5, gapLength = 5) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dashCount = Math.floor(distance / (dashLength + gapLength));
        const nx = dx / distance;
        const ny = dy / distance;

        for (let i = 0; i < dashCount; i++) {
            const startX = x1 + (dashLength + gapLength) * i * nx;
            const startY = y1 + (dashLength + gapLength) * i * ny;
            const endX = startX + dashLength * nx;
            const endY = startY + dashLength * ny;

            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
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

        // Ship Parts Progress Display
        this.createShipPartsDisplay();

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

    /**
     * Create ship parts progress display showing progress toward final boss
     */
    createShipPartsDisplay() {
        const { width, height, isMobile } = this.dims;

        // Get ship parts status from GameState
        const shipParts = window.GameState?.get('hubWorld.shipParts') || {
            collected: [],
            totalRequired: 4,
            finalBossUnlocked: false
        };

        const collected = shipParts.collected?.length || 0;
        const total = shipParts.totalRequired || 4;

        // Position below title
        const displayY = isMobile ? 70 : 85;

        // Ship parts container
        const containerWidth = isMobile ? 200 : 280;
        const containerHeight = isMobile ? 50 : 60;
        const containerX = (width - containerWidth) / 2;

        // Background panel
        const shipPanel = this.add.graphics();
        shipPanel.fillStyle(0x1A0A2E, 0.85);
        shipPanel.fillRoundedRect(containerX, displayY, containerWidth, containerHeight, 10);
        shipPanel.lineStyle(2, collected === total ? 0xFFD700 : 0x6B00B3);
        shipPanel.strokeRoundedRect(containerX, displayY, containerWidth, containerHeight, 10);
        shipPanel.setDepth(50);

        // Ship icon
        const shipIcon = this.add.text(containerX + 15, displayY + containerHeight / 2, '🚀', {
            fontSize: isMobile ? '24px' : '32px'
        }).setOrigin(0, 0.5).setDepth(51);

        // Title text
        const titleText = this.add.text(containerX + (isMobile ? 45 : 55), displayY + 12, 'SHIP PARTS', {
            fontSize: isMobile ? '10px' : '12px',
            color: '#AAAAAA',
            fontStyle: 'bold'
        }).setDepth(51);

        // Progress text
        const progressColor = collected === total ? '#00FF00' : '#FFFFFF';
        const progressText = this.add.text(containerX + (isMobile ? 45 : 55), displayY + (isMobile ? 30 : 35),
            `${collected}/${total} Collected`, {
            fontSize: isMobile ? '14px' : '18px',
            color: progressColor,
            fontStyle: 'bold'
        }).setDepth(51);

        // Part indicators (small circles showing collected/not collected)
        const partIcons = ['⚙️', '🔮', '🌀', '✨'];
        const partNames = ['Dimensional Drive', 'Crystal Core', 'Void Stabilizer', 'Aurora Reactor'];
        const partIds = ['dimensional_drive', 'crystal_core', 'void_stabilizer', 'aurora_reactor'];

        const startX = containerX + containerWidth - (isMobile ? 60 : 80);
        partIcons.forEach((icon, idx) => {
            const isCollected = shipParts.collected?.includes(partIds[idx]);
            const partX = startX + idx * (isMobile ? 14 : 18);

            const partIndicator = this.add.text(partX, displayY + containerHeight / 2, icon, {
                fontSize: isMobile ? '12px' : '16px'
            }).setOrigin(0.5).setDepth(51);

            // Gray out if not collected
            if (!isCollected) {
                partIndicator.setAlpha(0.3);
            }
        });

        // If all parts collected, show "FINAL BOSS READY!" with animation
        if (collected === total) {
            const readyText = this.add.text(width / 2, displayY + containerHeight + 15, '⚔️ FINAL BOSS UNLOCKED! ⚔️', {
                fontSize: isMobile ? '14px' : '18px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(51);

            // Pulsing animation
            this.tweens.add({
                targets: readyText,
                alpha: { from: 1, to: 0.6 },
                scale: { from: 1, to: 1.05 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
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

        // Clear ship assembly elements
        if (this.shipAssemblyElements) {
            this.shipAssemblyElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.shipAssemblyElements = [];
        }

        // Clear portal vortex timers
        if (this.vortexTimers) {
            this.vortexTimers.forEach(timer => {
                if (timer && timer.destroy) timer.destroy();
            });
            this.vortexTimers = [];
        }

        // Clear portal vortex elements
        if (this.portalVortexElements) {
            this.portalVortexElements.forEach(vortex => {
                if (vortex.glow && vortex.glow.destroy) vortex.glow.destroy();
                if (vortex.particles) {
                    vortex.particles.forEach(p => {
                        if (p.graphics && p.graphics.destroy) p.graphics.destroy();
                    });
                }
            });
            this.portalVortexElements = [];
        }

        // Clear parallax timer
        if (this.parallaxTimer && this.parallaxTimer.destroy) {
            this.parallaxTimer.destroy();
            this.parallaxTimer = null;
        }

        // Clear parallax layers
        if (this.parallaxLayers) {
            this.parallaxLayers.forEach(layer => {
                layer.stars.forEach(star => {
                    if (star.graphics && star.graphics.destroy) star.graphics.destroy();
                });
            });
            this.parallaxLayers = [];
        }

        // Remove pointer move listener
        if (this.input) {
            this.input.off('pointermove');
        }

        // Clear details panel
        if (this.detailsPanelElements) {
            this.detailsPanelElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.detailsPanelElements = [];
        }

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

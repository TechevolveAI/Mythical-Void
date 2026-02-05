import Phaser from 'phaser';
import biomeConfigs from '../../config/biomes.json';
import SanctuaryZones from './SanctuaryZones.js';

/**
 * WorldBuilder - Creates biome-specific game world environments
 * Generates backgrounds, environment objects, and world features based on current biome
 */
class WorldBuilder {
    constructor(scene, graphicsEngine, options = {}) {
        this.scene = scene;
        this.graphicsEngine = graphicsEngine;
        this.worldWidth = options.worldWidth || 1600;
        this.worldHeight = options.worldHeight || 1200;
        this.currentBiome = options.biome || scene?.currentBiome || 'nebula';
        this.biomeConfig = this.loadBiomeConfig(this.currentBiome);
        this.debugGraphics = null;
        this.backgroundImage = null;

        // Initialize Sanctuary zones for the main world
        this.sanctuaryZones = new SanctuaryZones(this.worldWidth, this.worldHeight);
    }

    /**
     * Load biome configuration
     */
    loadBiomeConfig(biomeId) {
        const config = biomeConfigs[biomeId];
        if (!config) {
            console.warn(`[WorldBuilder] Unknown biome "${biomeId}", using nebula`);
            return biomeConfigs['nebula'] || this.getDefaultPalette();
        }
        return config;
    }

    /**
     * Get default palette for fallback
     */
    getDefaultPalette() {
        return {
            palette: {
                skyTop: '#B39DDB',
                skyBottom: '#80CBC4',
                nebula: '#F48FB1',
                accent: '#FFD54F',
                flora: '#64B5F6',
                rocks: '#90A4AE'
            }
        };
    }

    /**
     * Convert hex string to number
     */
    hexToInt(hex) {
        if (typeof hex === 'number') return hex;
        if (typeof hex === 'string') {
            return parseInt(hex.replace('#', ''), 16);
        }
        return 0xFFFFFF;
    }

    build() {
        const background = this.createBackgroundImage();

        // Cave biomes use constrained tunnel navigation
        const isCaveBiome = this.currentBiome === 'crystal_caves';

        let environment;
        let caveTunnels = null;
        let caveElements = null;

        if (isCaveBiome) {
            // Cave-specific environment (no shop, tunnels, special elements)
            environment = this.createCaveEnvironment();
            caveTunnels = this.createCaveTunnels();
            caveElements = this.createCaveElements();
        } else {
            environment = this.createEnvironmentObjects();
        }

        // Add Sanctuary-specific landmarks if in main/nebula biome
        let sanctuaryLandmarks = {};
        if (this.currentBiome === 'nebula') {
            sanctuaryLandmarks = this.createSanctuaryLandmarks();
        }

        // Add return portal for non-sanctuary biomes
        let returnPortal = null;
        if (this.currentBiome !== 'nebula') {
            returnPortal = this.createReturnPortal();
        }

        return {
            background,
            ...environment,
            ...sanctuaryLandmarks,
            returnPortal,
            caveTunnels,
            caveElements,
            sanctuaryZones: this.sanctuaryZones
        };
    }

    /**
     * Create Sanctuary-specific landmarks (crash site, hub portal, campfire)
     */
    createSanctuaryLandmarks() {
        const physics = this.scene.physics;
        const landmarks = this.sanctuaryZones.landmarks;

        // Create crashed ship (futuristic spacecraft, 220x160 texture - horizontal layout)
        this.graphicsEngine.createCrashedShip();
        const crashedShip = physics.add.staticSprite(
            landmarks.crashedShip.position.x,
            landmarks.crashedShip.position.y,
            'crashedShip'
        );
        crashedShip.setScale(1.0);
        crashedShip.setDepth(landmarks.crashedShip.position.y);
        // Collision body sized for fuselage (220x160 texture, horizontal orientation)
        crashedShip.body.setSize(180, 80);
        crashedShip.body.setOffset(20, 40);
        crashedShip.landmarkId = 'crashedShip';
        crashedShip.landmarkData = landmarks.crashedShip;

        // Create hub portal (mystical gate to other worlds) at the bottom
        this.graphicsEngine.createHubPortal();
        const hubPortal = physics.add.staticSprite(
            landmarks.hubPortal.position.x,
            landmarks.hubPortal.position.y,
            'hubPortal'
        );
        hubPortal.setScale(1.0);
        hubPortal.setDepth(landmarks.hubPortal.position.y);
        hubPortal.body.setSize(120, 160);
        hubPortal.body.setOffset(20, 10);
        hubPortal.landmarkId = 'hubPortal';
        hubPortal.landmarkData = landmarks.hubPortal;
        hubPortal.setInteractive();

        // Add gentle pulsing animation for the mystical gate
        this.scene.tweens.add({
            targets: hubPortal,
            alpha: { from: 0.95, to: 1 },
            scaleX: { from: 0.98, to: 1.02 },
            scaleY: { from: 0.98, to: 1.02 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create void portal (black hole for void mini-game) directly under the spaceship
        // This replaces the visual shadow/crater under the ship
        this.graphicsEngine.createVoidPortal();
        const voidPortal = physics.add.staticSprite(
            landmarks.voidPortal.position.x,
            landmarks.voidPortal.position.y,
            'voidPortal'
        );
        voidPortal.setScale(0.5); // Slightly smaller to fit under ship
        voidPortal.setDepth(landmarks.crashedShip.position.y - 10); // Just below ship
        voidPortal.body.setSize(70, 70);
        voidPortal.body.setOffset(65, 65); // Adjusted for scale
        voidPortal.landmarkId = 'voidPortal';
        voidPortal.landmarkData = landmarks.voidPortal;
        voidPortal.setInteractive();

        // Add ominous pulsing animation for the black hole
        this.scene.tweens.add({
            targets: voidPortal,
            alpha: { from: 0.85, to: 1 },
            scaleX: { from: 0.45, to: 0.55 },
            scaleY: { from: 0.45, to: 0.55 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add slow rotation to give swirling black hole effect
        this.scene.tweens.add({
            targets: voidPortal,
            angle: 360,
            duration: 25000,
            repeat: -1,
            ease: 'Linear'
        });

        // Create warning signs around the void portal
        const warningSigns = this.createVoidWarningSigns(
            landmarks.voidPortal.position.x,
            landmarks.voidPortal.position.y,
            voidPortal.depth - 5
        );

        // Create campfire
        this.graphicsEngine.createCampfire();
        const campfire = physics.add.staticSprite(
            landmarks.campfire.position.x,
            landmarks.campfire.position.y,
            'campfire'
        );
        campfire.setScale(1.0);
        campfire.setDepth(landmarks.campfire.position.y);
        campfire.body.setSize(40, 30);
        campfire.body.setOffset(10, 35);
        campfire.landmarkId = 'campfire';

        // Add campfire flicker animation
        this.scene.tweens.add({
            targets: campfire,
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create Target Practice Range
        const targetRange = this.createTargetRange(landmarks.targetRange);

        console.log('[WorldBuilder] Created Sanctuary landmarks: crashedShip, hubPortal, voidPortal, campfire, targetRange');

        return {
            crashedShip,
            hubPortal,
            voidPortal,
            campfire,
            targetRange
        };
    }

    /**
     * Create the Target Practice Range area with various targets
     * @param {object} landmarkData - Landmark position and data from SanctuaryZones
     * @returns {object} - Object containing all target range elements
     */
    createTargetRange(landmarkData) {
        const physics = this.scene.physics;
        const centerX = landmarkData.position.x;
        const centerY = landmarkData.position.y;

        // Create range sign
        this.graphicsEngine.createTargetRangeSign();
        const rangeSign = this.scene.add.sprite(centerX - 120, centerY - 80, 'targetRangeSign');
        rangeSign.setScale(1.0);
        rangeSign.setDepth(centerY - 100);

        // Create static bullseye targets (3 at different heights)
        this.graphicsEngine.createTargetBullseye();
        const targets = [];

        const targetPositions = [
            { x: centerX - 80, y: centerY - 20, points: 10 },
            { x: centerX, y: centerY - 40, points: 25 },
            { x: centerX + 80, y: centerY - 10, points: 10 }
        ];

        targetPositions.forEach((pos, index) => {
            const target = physics.add.staticSprite(pos.x, pos.y, 'targetBullseye');
            target.setScale(0.9);
            target.setDepth(pos.y);
            target.body.setSize(40, 40);
            target.body.setOffset(12, 15);
            target.setData('type', 'bullseye');
            target.setData('points', pos.points);
            target.setData('targetIndex', index);
            targets.push(target);
        });

        // Create practice dummies (2)
        this.graphicsEngine.createTargetDummy();
        const dummies = [];

        const dummyPositions = [
            { x: centerX - 40, y: centerY + 40, points: 15 },
            { x: centerX + 50, y: centerY + 50, points: 15 }
        ];

        dummyPositions.forEach((pos, index) => {
            const dummy = physics.add.staticSprite(pos.x, pos.y, 'targetDummy');
            dummy.setScale(1.0);
            dummy.setDepth(pos.y);
            dummy.body.setSize(36, 60);
            dummy.body.setOffset(6, 15);
            dummy.setData('type', 'dummy');
            dummy.setData('points', pos.points);
            dummy.setData('targetIndex', index);
            dummies.push(dummy);
        });

        // Create exploding barrels (2)
        this.graphicsEngine.createTargetBarrel();
        const barrels = [];

        const barrelPositions = [
            { x: centerX - 100, y: centerY + 60, points: 50, explodes: true },
            { x: centerX + 100, y: centerY + 30, points: 50, explodes: true }
        ];

        barrelPositions.forEach((pos, index) => {
            const barrel = physics.add.staticSprite(pos.x, pos.y, 'targetBarrel');
            barrel.setScale(1.0);
            barrel.setDepth(pos.y);
            barrel.body.setSize(32, 40);
            barrel.body.setOffset(4, 8);
            barrel.setData('type', 'barrel');
            barrel.setData('points', pos.points);
            barrel.setData('explodes', pos.explodes);
            barrel.setData('targetIndex', index);
            barrels.push(barrel);
        });

        // Create moving target (swinging)
        this.graphicsEngine.createMovingTarget();
        const movingTarget = physics.add.staticSprite(centerX + 30, centerY - 60, 'movingTarget');
        movingTarget.setScale(0.8);
        movingTarget.setDepth(centerY - 80);
        movingTarget.body.setSize(35, 35);
        movingTarget.body.setOffset(8, 18);
        movingTarget.setData('type', 'moving');
        movingTarget.setData('points', 100);
        movingTarget.setData('isMoving', true);

        // Add swinging animation to moving target
        this.scene.tweens.add({
            targets: movingTarget,
            x: { from: centerX - 40, to: centerX + 100 },
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create range boundary markers (decorative)
        const boundaryGraphics = this.scene.add.graphics();
        boundaryGraphics.lineStyle(2, 0xFF6B6B, 0.4);
        boundaryGraphics.strokeRect(centerX - 140, centerY - 100, 280, 200);
        boundaryGraphics.setDepth(1);

        // Add "DANGER ZONE" corner markers
        const markerPositions = [
            { x: centerX - 140, y: centerY - 100 },
            { x: centerX + 140, y: centerY - 100 },
            { x: centerX - 140, y: centerY + 100 },
            { x: centerX + 140, y: centerY + 100 }
        ];

        markerPositions.forEach(pos => {
            const marker = this.scene.add.graphics();
            marker.fillStyle(0xFF6B6B, 0.6);
            marker.fillTriangle(pos.x, pos.y, pos.x + 15, pos.y, pos.x, pos.y + 15);
            marker.setDepth(2);
        });

        // Store reference for interaction handling
        const allTargets = [...targets, ...dummies, ...barrels, movingTarget];

        // Add interactive glow effect on hover for all targets
        allTargets.forEach(target => {
            target.setInteractive();
            target.on('pointerover', () => {
                target.setTint(0xFFFF00);
            });
            target.on('pointerout', () => {
                target.clearTint();
            });
        });

        console.log('[WorldBuilder] Created Target Range with', allTargets.length, 'targets');

        return {
            sign: rangeSign,
            targets,
            dummies,
            barrels,
            movingTarget,
            allTargets,
            boundary: boundaryGraphics
        };
    }

    /**
     * Create return portal for non-sanctuary biomes
     * Allows player to return to the Sanctuary
     */
    createReturnPortal() {
        const physics = this.scene.physics;

        // Position near the spawn point but slightly offset
        const spawnX = this.worldWidth / 2;
        const spawnY = this.worldHeight / 2;
        const portalX = spawnX - 200;
        const portalY = spawnY + 100;

        // Create return portal texture
        this.graphicsEngine.createReturnPortal();
        const returnPortal = physics.add.staticSprite(portalX, portalY, 'returnPortal');
        returnPortal.setScale(1.0);
        returnPortal.setDepth(portalY);
        // Increased collision body to match texture size better for reliable interaction
        returnPortal.body.setSize(140, 160);
        returnPortal.body.setOffset(0, 0);
        returnPortal.landmarkId = 'returnPortal';
        returnPortal.landmarkData = {
            name: 'Return Portal',
            description: 'Return to your Sanctuary',
            interactable: true,
            interactRadius: 100,
            onInteract: 'returnToSanctuary'
        };

        // Add swirling animation
        this.scene.tweens.add({
            targets: returnPortal,
            angle: { from: -3, to: 3 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add glow pulse
        this.scene.tweens.add({
            targets: returnPortal,
            alpha: { from: 0.85, to: 1 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        console.log('[WorldBuilder] Created return portal for biome:', this.currentBiome);

        return returnPortal;
    }

    createBackgroundImage() {
        if (this.backgroundImage) {
            return this.backgroundImage;
        }

        const textureKey = this.generateBackgroundTexture();
        this.backgroundImage = this.scene.add.image(0, 0, textureKey);
        this.backgroundImage.setOrigin(0, 0);
        this.backgroundImage.setDepth(-1000);
        return this.backgroundImage;
    }

    generateBackgroundTexture() {
        const biomeId = this.currentBiome;
        const textureKey = `worldBackground_${biomeId}_${this.worldWidth}x${this.worldHeight}`;

        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.scene.make.graphics({ add: false });
        const palette = this.biomeConfig.palette || {};

        // Get biome-specific colors
        const skyTop = this.hexToInt(palette.skyTop) || 0x0a0a2e;
        const skyBottom = this.hexToInt(palette.skyBottom) || 0x1a1a4e;
        const nebulaColor = this.hexToInt(palette.nebula) || 0x9370DB;
        const accentColor = this.hexToInt(palette.accent) || 0xFFD54F;
        const floraColor = this.hexToInt(palette.flora) || 0x64B5F6;
        const rockColor = this.hexToInt(palette.rocks) || 0x90A4AE;

        // Base gradient using biome colors
        graphics.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1);
        graphics.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Stars with biome-appropriate brightness
        const starCount = this.getStarCount();
        for (let i = 0; i < starCount; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const brightness = Math.random();
            const color = this.getStarColor(brightness);
            const size = brightness > 0.8 ? 2 : 1;
            graphics.fillStyle(color, brightness * 0.8 + 0.2);
            graphics.fillCircle(x, y, size);
        }

        // Nebula clouds with biome colors
        const nebulaColors = this.getNebulaColors();
        for (let i = 0; i < 30; i++) {
            const nebula = Phaser.Math.RND.pick(nebulaColors);
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(80, 200);
            graphics.fillStyle(nebula.color, nebula.alpha);
            graphics.fillCircle(x, y, size);
        }

        // Biome-specific features
        this.addBiomeFeatures(graphics, palette);

        // Floating platforms with biome-specific colors
        const platformColor = this.blendColors(skyBottom, rockColor, 0.5);
        graphics.fillStyle(platformColor, 0.4);
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const width = Phaser.Math.Between(100, 300);
            const height = Phaser.Math.Between(20, 40);
            graphics.fillRoundedRect(x, y, width, height, 10);
            graphics.fillStyle(accentColor, 0.3);
            graphics.fillRoundedRect(x, y, width, height * 0.3, 5);
            graphics.fillStyle(platformColor, 0.4);
        }

        graphics.generateTexture(textureKey, this.worldWidth, this.worldHeight);
        graphics.destroy();
        return textureKey;
    }

    /**
     * Get star count based on biome
     */
    getStarCount() {
        const counts = {
            nebula: 200,
            stellar_reef: 150,
            crystal_caves: 80,
            void_peaks: 120,
            aurora_depths: 180
        };
        return counts[this.currentBiome] || 200;
    }

    /**
     * Get star colors based on biome
     */
    getStarColor(brightness) {
        const palette = this.biomeConfig.palette || {};
        const accent = this.hexToInt(palette.accent) || 0xFFFFFF;

        switch (this.currentBiome) {
            case 'stellar_reef':
                return brightness > 0.7 ? 0xE0F7FA : (brightness > 0.4 ? 0xB2EBF2 : 0x80DEEA);
            case 'crystal_caves':
                return brightness > 0.7 ? 0xE1BEE7 : (brightness > 0.4 ? 0xCE93D8 : 0xBA68C8);
            case 'void_peaks':
                return brightness > 0.7 ? 0xFF4500 : (brightness > 0.4 ? 0xDC143C : 0x8B0000);
            case 'aurora_depths':
                return brightness > 0.7 ? 0x7FFFD4 : (brightness > 0.4 ? 0x00FA9A : 0x00FF7F);
            default:
                return brightness > 0.7 ? 0xFFFFFF : (brightness > 0.4 ? 0xCCCCFF : 0x8888FF);
        }
    }

    /**
     * Get nebula colors based on biome
     */
    getNebulaColors() {
        const palette = this.biomeConfig.palette || {};
        const nebula = this.hexToInt(palette.nebula) || 0x9370DB;
        const accent = this.hexToInt(palette.accent) || 0xFFD54F;
        const flora = this.hexToInt(palette.flora) || 0x64B5F6;

        switch (this.currentBiome) {
            case 'stellar_reef':
                return [
                    { color: 0x00BCD4, alpha: 0.15 },
                    { color: 0x26A69A, alpha: 0.12 },
                    { color: 0x00838F, alpha: 0.10 },
                    { color: accent, alpha: 0.08 }
                ];
            case 'crystal_caves':
                return [
                    { color: 0x7B68EE, alpha: 0.18 },
                    { color: 0x9370DB, alpha: 0.15 },
                    { color: 0x00FFFF, alpha: 0.12 },
                    { color: 0xE040FB, alpha: 0.08 }
                ];
            case 'void_peaks':
                return [
                    { color: 0x4B0082, alpha: 0.20 },
                    { color: 0x8B008B, alpha: 0.15 },
                    { color: 0xFF4500, alpha: 0.10 },
                    { color: 0x000000, alpha: 0.25 }
                ];
            case 'aurora_depths':
                return [
                    { color: 0x00FF7F, alpha: 0.15 },
                    { color: 0x7FFFD4, alpha: 0.12 },
                    { color: 0xFFD700, alpha: 0.10 },
                    { color: 0x40E0D0, alpha: 0.08 }
                ];
            default:
                return [
                    { color: nebula, alpha: 0.15 },
                    { color: 0x4169E1, alpha: 0.12 },
                    { color: flora, alpha: 0.08 },
                    { color: accent, alpha: 0.10 }
                ];
        }
    }

    /**
     * Add biome-specific visual features
     */
    addBiomeFeatures(graphics, palette) {
        switch (this.currentBiome) {
            case 'stellar_reef':
                this.addCoralFormations(graphics);
                this.addBubbles(graphics);
                break;
            case 'crystal_caves':
                this.addCrystalFormations(graphics);
                this.addStalactites(graphics);
                break;
            case 'void_peaks':
                this.addVoidCracks(graphics);
                this.addDarkMountains(graphics);
                break;
            case 'aurora_depths':
                this.addAuroraWaves(graphics);
                this.addLightOrbs(graphics);
                break;
        }
    }

    addCoralFormations(graphics) {
        const colors = [0xFF6B6B, 0xFF8E8E, 0xE57373, 0xFFB3B3];
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(this.worldHeight * 0.4, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            graphics.fillStyle(color, 0.6);
            // Branch-like coral shape
            for (let j = 0; j < 3; j++) {
                const angle = (j - 1) * 0.3;
                const length = Phaser.Math.Between(20, 60);
                graphics.fillTriangle(
                    x, y,
                    x + Math.cos(angle - Math.PI/2) * length * 0.3, y - length,
                    x + Math.cos(angle + 0.2 - Math.PI/2) * length * 0.3, y - length * 0.8
                );
            }
        }
    }

    addBubbles(graphics) {
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(3, 12);
            graphics.fillStyle(0xE0F7FA, 0.3);
            graphics.fillCircle(x, y, size);
            graphics.lineStyle(1, 0xFFFFFF, 0.5);
            graphics.strokeCircle(x, y, size);
        }
    }

    addCrystalFormations(graphics) {
        const colors = [0x00FFFF, 0x00CED1, 0x7B68EE, 0x9370DB];
        for (let i = 0; i < 25; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            const height = Phaser.Math.Between(30, 80);
            const width = Phaser.Math.Between(15, 30);

            graphics.fillStyle(color, 0.7);
            graphics.fillTriangle(x, y, x - width/2, y + height, x + width/2, y + height);

            // Glow effect
            graphics.fillStyle(color, 0.2);
            graphics.fillCircle(x, y + height/2, width * 1.5);
        }
    }

    addStalactites(graphics) {
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, 100);
            const length = Phaser.Math.Between(40, 120);
            const width = Phaser.Math.Between(10, 25);

            graphics.fillStyle(0x2C3E50, 0.8);
            graphics.fillTriangle(x - width/2, y, x + width/2, y, x, y + length);
        }
    }

    addVoidCracks(graphics) {
        const colors = [0x4B0082, 0x8B008B, 0x9400D3];
        for (let i = 0; i < 15; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);

            graphics.lineStyle(3, color, 0.8);
            graphics.beginPath();
            graphics.moveTo(x, y);

            let px = x, py = y;
            for (let j = 0; j < 5; j++) {
                px += Phaser.Math.Between(-50, 50);
                py += Phaser.Math.Between(20, 60);
                graphics.lineTo(px, py);
            }
            graphics.strokePath();

            // Glow
            graphics.fillStyle(color, 0.15);
            graphics.fillCircle(x, y, 30);
        }
    }

    addDarkMountains(graphics) {
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(-100, this.worldWidth + 100);
            const baseY = this.worldHeight + 50;
            const peakY = Phaser.Math.Between(this.worldHeight * 0.3, this.worldHeight * 0.7);
            const width = Phaser.Math.Between(200, 400);

            graphics.fillStyle(0x1A1A2E, 0.9);
            graphics.fillTriangle(x - width/2, baseY, x + width/2, baseY, x, peakY);
        }
    }

    addAuroraWaves(graphics) {
        const colors = [0x00FF7F, 0x7FFFD4, 0x40E0D0, 0x00CED1];
        for (let wave = 0; wave < 4; wave++) {
            const color = colors[wave];
            const y = 100 + wave * 80;

            graphics.beginPath();
            graphics.moveTo(0, y);

            for (let x = 0; x <= this.worldWidth; x += 50) {
                const waveY = y + Math.sin(x / 200 + wave) * 30;
                graphics.lineTo(x, waveY);
            }

            graphics.lineTo(this.worldWidth, this.worldHeight);
            graphics.lineTo(0, this.worldHeight);
            graphics.closePath();
            graphics.fillStyle(color, 0.08);
            graphics.fillPath();
        }
    }

    addLightOrbs(graphics) {
        const colors = [0xFFD700, 0xFFA500, 0xFF8C00, 0xFFFFFF];
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const color = Phaser.Math.RND.pick(colors);
            const size = Phaser.Math.Between(5, 15);

            // Outer glow
            graphics.fillStyle(color, 0.15);
            graphics.fillCircle(x, y, size * 2);
            // Inner orb
            graphics.fillStyle(color, 0.6);
            graphics.fillCircle(x, y, size);
        }
    }

    /**
     * Blend two colors
     */
    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;

        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        return (r << 16) | (g << 8) | b;
    }

    createEnvironmentObjects() {
        const physics = this.scene.physics;
        const trees = physics.add.staticGroup();
        const rocks = physics.add.staticGroup();
        const flowers = physics.add.staticGroup();

        // Get biome-specific tints
        const floraTint = this.hexToInt(this.biomeConfig.palette?.flora) || 0xFFFFFF;
        const rockTint = this.hexToInt(this.biomeConfig.palette?.rocks) || 0x90A4AE;

        // Trees (reduced for some biomes)
        const treeCount = this.getObjectCount('trees');
        const treeVariants = ['enhancedTree_summer', 'enhancedTree_spring', 'enhancedTree_autumn'];
        const validTreeVariants = treeVariants.filter(tex => this.scene.textures.exists(tex));

        if (validTreeVariants.length > 0 && treeCount > 0) {
            for (let i = 0; i < treeCount; i++) {
                const x = Phaser.Math.Between(150, this.worldWidth - 150);
                const y = Phaser.Math.Between(150, this.worldHeight - 150);
                const treeType = Phaser.Math.RND.pick(validTreeVariants);
                const tree = trees.create(x, y, treeType);
                tree.setScale(Phaser.Math.FloatBetween(1.0, 1.8));
                tree.body.setSize(30, 40);
                tree.setDepth(y);
                // Apply biome tint
                if (this.currentBiome !== 'nebula') {
                    tree.setTint(this.getBiomeTreeTint());
                }
            }
        }

        // Rocks
        const rockCount = this.getObjectCount('rocks');
        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (!this.scene.textures.exists(textureName)) continue;
            for (let j = 0; j < Math.ceil(rockCount / 3); j++) {
                const x = Phaser.Math.Between(100, this.worldWidth - 100);
                const y = Phaser.Math.Between(100, this.worldHeight - 100);
                const rock = rocks.create(x, y, textureName);
                rock.setScale(Phaser.Math.FloatBetween(1.2, 2.0));
                rock.body.setSize(25, 20);
                rock.setDepth(y);
                rock.setTint(rockTint);
            }
        }

        // Flowers
        const flowerCount = this.getObjectCount('flowers');
        if (this.scene.textures.exists('enhancedFlower') && flowerCount > 0) {
            const flowerTints = this.getFlowerTints();
            for (let i = 0; i < flowerCount; i++) {
                const x = Phaser.Math.Between(80, this.worldWidth - 80);
                const y = Phaser.Math.Between(80, this.worldHeight - 80);
                const flower = flowers.create(x, y, 'enhancedFlower');
                flower.setScale(Phaser.Math.FloatBetween(1.0, 1.5));
                flower.body.setSize(15, 20);
                flower.setDepth(y);
                flower.setTint(Phaser.Math.RND.pick(flowerTints));
            }
        }

        // Cosmic shop
        this.graphicsEngine.createCosmicShop();
        const shopX = this.worldWidth - 220;
        const shopY = this.worldHeight / 2;
        const shop = physics.add.staticSprite(shopX, shopY, 'cosmicShop');
        shop.setScale(1.3);
        shop.setDepth(shopY);
        shop.body.setSize(220, 220);
        shop.body.setOffset(-60, -60);

        return { trees, rocks, flowers, shop };
    }

    /**
     * Get object count based on biome
     */
    getObjectCount(objectType) {
        const counts = {
            nebula: { trees: 15, rocks: 30, flowers: 25 },
            stellar_reef: { trees: 0, rocks: 20, flowers: 30 },
            crystal_caves: { trees: 5, rocks: 40, flowers: 15 },
            void_peaks: { trees: 8, rocks: 35, flowers: 10 },
            aurora_depths: { trees: 12, rocks: 25, flowers: 35 }
        };

        const biome = counts[this.currentBiome] || counts.nebula;
        return biome[objectType] || 0;
    }

    /**
     * Get tree tint based on biome
     */
    getBiomeTreeTint() {
        const tints = {
            stellar_reef: 0x4DB6AC,
            crystal_caves: 0x9370DB,
            void_peaks: 0x483D8B,
            aurora_depths: 0x40916C
        };
        return tints[this.currentBiome] || 0xFFFFFF;
    }

    /**
     * Get flower tints based on biome
     */
    getFlowerTints() {
        const tints = {
            nebula: [0xFFFFFF, 0xFFB6FF, 0xB6FFFF, 0xFFFFB6, 0xFFB6B6],
            stellar_reef: [0xE0F7FA, 0xB2EBF2, 0x80DEEA, 0x4DD0E1],
            crystal_caves: [0xE1BEE7, 0xCE93D8, 0xBA68C8, 0xAB47BC],
            void_peaks: [0x7986CB, 0x5C6BC0, 0x3F51B5, 0x3949AB],
            aurora_depths: [0xA5D6A7, 0x81C784, 0x66BB6A, 0x4CAF50]
        };
        return tints[this.currentBiome] || tints.nebula;
    }

    // ==========================================
    // CAVE-SPECIFIC METHODS (Crystal Caves biome)
    // ==========================================

    /**
     * Create cave tunnel collision walls for constrained navigation
     * Player can only move within the tunnel paths
     */
    createCaveTunnels() {
        const physics = this.scene.physics;
        const tunnelWalls = physics.add.staticGroup();

        // Cave dimensions
        const caveWidth = this.worldWidth;
        const caveHeight = this.worldHeight;

        // Tunnel configuration - defines walkable paths
        // Main horizontal tunnel through center
        const tunnelHeight = 180;  // Width of walkable tunnel
        const tunnelY = caveHeight / 2;

        // Create top wall (above main tunnel)
        this.createCaveWall(tunnelWalls, 0, 0, caveWidth, tunnelY - tunnelHeight / 2);

        // Create bottom wall (below main tunnel)
        this.createCaveWall(tunnelWalls, 0, tunnelY + tunnelHeight / 2, caveWidth, caveHeight - (tunnelY + tunnelHeight / 2));

        // Add branching tunnel to the left (vertical passage)
        const leftBranchX = caveWidth * 0.25;
        const leftBranchWidth = 160;

        // Gap in top wall for left branch
        this.createCaveWall(tunnelWalls, 0, 0, leftBranchX - leftBranchWidth / 2, tunnelY - tunnelHeight / 2);
        this.createCaveWall(tunnelWalls, leftBranchX + leftBranchWidth / 2, 0, caveWidth - (leftBranchX + leftBranchWidth / 2), tunnelY - tunnelHeight / 2);

        // Add branching tunnel to the right (goes down)
        const rightBranchX = caveWidth * 0.75;
        const rightBranchWidth = 160;

        // Add small chamber at the end of left branch
        const leftChamberY = 150;
        const chamberRadius = 120;
        this.createChamberWalls(tunnelWalls, leftBranchX, leftChamberY, chamberRadius, leftBranchWidth);

        // Add small chamber at the end of right branch
        const rightChamberY = caveHeight - 150;
        this.createChamberWalls(tunnelWalls, rightBranchX, rightChamberY, chamberRadius, rightBranchWidth);

        // Gap in bottom wall for right branch
        this.createCaveWall(tunnelWalls, 0, tunnelY + tunnelHeight / 2, rightBranchX - rightBranchWidth / 2, caveHeight - (tunnelY + tunnelHeight / 2));
        this.createCaveWall(tunnelWalls, rightBranchX + rightBranchWidth / 2, tunnelY + tunnelHeight / 2, caveWidth - (rightBranchX + rightBranchWidth / 2), caveHeight - (tunnelY + tunnelHeight / 2));

        console.log('[WorldBuilder] Created cave tunnel system with collision walls');

        return {
            walls: tunnelWalls,
            spawnPoint: { x: caveWidth / 2, y: tunnelY },  // Spawn in center of main tunnel
            tunnelConfig: {
                mainTunnelY: tunnelY,
                tunnelHeight: tunnelHeight,
                leftBranch: { x: leftBranchX, chamberY: leftChamberY },
                rightBranch: { x: rightBranchX, chamberY: rightChamberY }
            }
        };
    }

    /**
     * Create a single cave wall section
     */
    createCaveWall(group, x, y, width, height) {
        if (width <= 0 || height <= 0) return null;

        // Create wall texture
        const textureKey = `caveWall_${x}_${y}_${width}_${height}`;

        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.make.graphics({ add: false });

            // Dark rocky texture with variations
            graphics.fillStyle(0x1A0A20, 1);
            graphics.fillRect(0, 0, width, height);

            // Add rock texture variations
            for (let i = 0; i < Math.floor(width * height / 2000); i++) {
                const rx = Phaser.Math.Between(0, width);
                const ry = Phaser.Math.Between(0, height);
                const rw = Phaser.Math.Between(20, 60);
                const rh = Phaser.Math.Between(15, 40);
                const darkness = Phaser.Math.Between(0, 30);
                graphics.fillStyle(Phaser.Display.Color.GetColor(26 - darkness, 10 - darkness / 3, 32 - darkness), 0.8);
                graphics.fillRoundedRect(rx, ry, rw, rh, 5);
            }

            // Add some purple crystal veins
            for (let i = 0; i < Math.floor(width * height / 8000); i++) {
                const vx = Phaser.Math.Between(0, width);
                const vy = Phaser.Math.Between(0, height);
                graphics.lineStyle(2, 0x7B68EE, 0.4);
                graphics.beginPath();
                graphics.moveTo(vx, vy);
                for (let j = 0; j < 4; j++) {
                    graphics.lineTo(
                        vx + Phaser.Math.Between(-30, 30),
                        vy + Phaser.Math.Between(-30, 30)
                    );
                }
                graphics.strokePath();
            }

            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        const wall = group.create(x + width / 2, y + height / 2, textureKey);
        wall.setDepth(50);  // Above background, below characters
        wall.body.setSize(width, height);
        wall.body.setOffset(-width / 2, -height / 2);

        return wall;
    }

    /**
     * Create circular chamber walls (with opening to connect to tunnel)
     */
    createChamberWalls(group, centerX, centerY, radius, openingWidth) {
        // Create walls around chamber except for opening
        // This creates a roughly circular area to explore

        const segments = 8;
        const angleStep = (Math.PI * 2) / segments;

        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            const nextAngle = (i + 1) * angleStep;

            // Skip segments that would block the tunnel connection
            const midAngle = (angle + nextAngle) / 2;
            if (Math.abs(Math.sin(midAngle)) > 0.7) continue;  // Skip top/bottom openings

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(nextAngle) * radius;
            const y2 = centerY + Math.sin(nextAngle) * radius;

            const width = Math.abs(x2 - x1) + 30;
            const height = Math.abs(y2 - y1) + 30;
            const wx = Math.min(x1, x2) - 15;
            const wy = Math.min(y1, y2) - 15;

            this.createCaveWall(group, wx, wy, width, height);
        }
    }

    /**
     * Create cave environment (simplified - no shop)
     */
    createCaveEnvironment() {
        const physics = this.scene.physics;
        const rocks = physics.add.staticGroup();

        // Cave has lots of rocks, no trees, minimal flowers
        const rockCount = 50;
        const rockTint = 0x4A3B5C;  // Dark purple rocks

        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (!this.scene.textures.exists(textureName)) continue;

            for (let j = 0; j < Math.ceil(rockCount / 3); j++) {
                const x = Phaser.Math.Between(100, this.worldWidth - 100);
                const y = Phaser.Math.Between(100, this.worldHeight - 100);
                const rock = rocks.create(x, y, textureName);
                rock.setScale(Phaser.Math.FloatBetween(0.8, 1.5));
                rock.body.setSize(25, 20);
                rock.setDepth(y);
                rock.setTint(rockTint);
            }
        }

        // Note: No shop in cave biomes - player must return to sanctuary

        console.log('[WorldBuilder] Created cave environment (no shop)');

        return {
            trees: physics.add.staticGroup(),  // Empty - no trees in caves
            rocks,
            flowers: physics.add.staticGroup(),  // Empty - minimal flora
            shop: null  // No shop in caves
        };
    }

    /**
     * Create cave-specific visual elements
     * Glowing crystals, flames, and bat creatures
     */
    createCaveElements() {
        const elements = {
            glowingCrystals: [],
            flames: [],
            batCreatures: []
        };

        // Create glowing crystals scattered around the cave
        const crystalCount = 25;
        for (let i = 0; i < crystalCount; i++) {
            const crystal = this.createGlowingCrystal(
                Phaser.Math.Between(100, this.worldWidth - 100),
                Phaser.Math.Between(100, this.worldHeight - 100)
            );
            elements.glowingCrystals.push(crystal);
        }

        // Create flame light sources on walls
        const flameCount = 12;
        for (let i = 0; i < flameCount; i++) {
            // Place flames along the tunnel walls
            const x = Phaser.Math.Between(150, this.worldWidth - 150);
            const y = this.worldHeight / 2 + (i % 2 === 0 ? -80 : 80);  // Top or bottom of tunnel
            const flame = this.createCaveFlame(x, y);
            elements.flames.push(flame);
        }

        // Create bat-like creatures that flutter around
        const batCount = 8;
        for (let i = 0; i < batCount; i++) {
            const bat = this.createBatCreature(
                Phaser.Math.Between(200, this.worldWidth - 200),
                Phaser.Math.Between(150, this.worldHeight - 150)
            );
            elements.batCreatures.push(bat);
        }

        console.log('[WorldBuilder] Created cave elements: crystals, flames, bat creatures');

        return elements;
    }

    /**
     * Create a glowing crystal with pulsing light effect
     */
    createGlowingCrystal(x, y) {
        const graphics = this.scene.add.graphics();

        // Crystal colors
        const colors = [0x00FFFF, 0x7B68EE, 0xE040FB, 0x9370DB];
        const color = Phaser.Math.RND.pick(colors);

        const height = Phaser.Math.Between(30, 70);
        const width = Phaser.Math.Between(10, 25);

        // Outer glow (larger, more transparent)
        graphics.fillStyle(color, 0.2);
        graphics.fillCircle(0, 0, width * 2.5);

        // Middle glow
        graphics.fillStyle(color, 0.4);
        graphics.fillCircle(0, 0, width * 1.5);

        // Crystal shape (pointing up or down randomly)
        const pointUp = Math.random() > 0.5;
        graphics.fillStyle(color, 0.9);
        if (pointUp) {
            graphics.fillTriangle(-width / 2, height / 2, width / 2, height / 2, 0, -height / 2);
        } else {
            graphics.fillTriangle(-width / 2, -height / 2, width / 2, -height / 2, 0, height / 2);
        }

        // Inner highlight
        graphics.fillStyle(0xFFFFFF, 0.5);
        if (pointUp) {
            graphics.fillTriangle(-width / 4, height / 4, width / 6, height / 4, 0, -height / 4);
        } else {
            graphics.fillTriangle(-width / 4, -height / 4, width / 6, -height / 4, 0, height / 4);
        }

        graphics.setPosition(x, y);
        graphics.setDepth(y - 1);

        // Pulsing glow animation
        this.scene.tweens.add({
            targets: graphics,
            alpha: { from: 0.6, to: 1.0 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: Phaser.Math.Between(1500, 3000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return graphics;
    }

    /**
     * Create a flame light source on cave wall
     */
    createCaveFlame(x, y) {
        const container = this.scene.add.container(x, y);

        // Flame glow circle
        const glow = this.scene.add.graphics();
        glow.fillStyle(0xFF6600, 0.3);
        glow.fillCircle(0, 0, 60);
        glow.fillStyle(0xFFAA00, 0.2);
        glow.fillCircle(0, 0, 40);
        container.add(glow);

        // Flame shape
        const flame = this.scene.add.graphics();
        flame.fillStyle(0xFF4500, 0.9);
        flame.fillTriangle(-12, 10, 12, 10, 0, -25);
        flame.fillStyle(0xFFA500, 0.9);
        flame.fillTriangle(-8, 8, 8, 8, 0, -18);
        flame.fillStyle(0xFFD700, 0.9);
        flame.fillTriangle(-4, 5, 4, 5, 0, -10);
        container.add(flame);

        container.setDepth(y);

        // Flicker animation
        this.scene.tweens.add({
            targets: flame,
            scaleX: { from: 0.9, to: 1.1 },
            scaleY: { from: 0.85, to: 1.15 },
            alpha: { from: 0.8, to: 1.0 },
            duration: 150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Glow pulse
        this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0.7, to: 1.0 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return container;
    }

    /**
     * Create a bat-like cave creature that flutters around
     */
    createBatCreature(x, y) {
        const graphics = this.scene.add.graphics();

        // Bat body (dark purple)
        graphics.fillStyle(0x2D1B3D, 1);
        graphics.fillEllipse(0, 0, 20, 15);

        // Wings (spread)
        graphics.fillStyle(0x3D2B4D, 0.9);
        // Left wing
        graphics.fillTriangle(-8, 0, -35, -10, -25, 10);
        // Right wing
        graphics.fillTriangle(8, 0, 35, -10, 25, 10);

        // Eyes (glowing purple)
        graphics.fillStyle(0xE040FB, 1);
        graphics.fillCircle(-5, -3, 3);
        graphics.fillCircle(5, -3, 3);

        // Eye glow
        graphics.fillStyle(0xE040FB, 0.3);
        graphics.fillCircle(-5, -3, 5);
        graphics.fillCircle(5, -3, 5);

        graphics.setPosition(x, y);
        graphics.setDepth(900);  // Above most things

        // Store original position for patrol
        graphics.originX = x;
        graphics.originY = y;

        // Wing flap animation
        this.scene.tweens.add({
            targets: graphics,
            scaleY: { from: 0.9, to: 1.1 },
            duration: 100,
            yoyo: true,
            repeat: -1
        });

        // Patrol movement - flutter around in area
        this.createBatPatrol(graphics);

        return graphics;
    }

    /**
     * Create patrol behavior for bat creature
     */
    createBatPatrol(bat) {
        const patrolRange = 150;

        const moveToNewPosition = () => {
            const newX = bat.originX + Phaser.Math.Between(-patrolRange, patrolRange);
            const newY = bat.originY + Phaser.Math.Between(-patrolRange / 2, patrolRange / 2);

            this.scene.tweens.add({
                targets: bat,
                x: newX,
                y: newY,
                duration: Phaser.Math.Between(2000, 4000),
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this.scene.time.delayedCall(Phaser.Math.Between(500, 1500), moveToNewPosition);
                }
            });
        };

        // Start patrol after random delay
        this.scene.time.delayedCall(Phaser.Math.Between(0, 2000), moveToNewPosition);
    }

    /**
     * Create warning signs around the void portal
     * Caution triangles and danger text to warn players
     */
    createVoidWarningSigns(centerX, centerY, depth) {
        const signs = [];

        // Create warning triangle texture if it doesn't exist
        if (!this.scene.textures.exists('warningTriangle')) {
            const graphics = this.scene.make.graphics({ add: false });

            // Yellow warning triangle with black border
            const size = 32;

            // Outer black border
            graphics.fillStyle(0x000000, 1);
            graphics.fillTriangle(size/2, 2, 2, size - 2, size - 2, size - 2);

            // Yellow fill
            graphics.fillStyle(0xFFD700, 1);
            graphics.fillTriangle(size/2, 6, 6, size - 5, size - 6, size - 5);

            // Exclamation mark
            graphics.fillStyle(0x000000, 1);
            graphics.fillRect(size/2 - 2, 12, 4, 10);
            graphics.fillCircle(size/2, 26, 2);

            graphics.generateTexture('warningTriangle', size, size);
            graphics.destroy();
        }

        // Create caution tape texture if it doesn't exist
        if (!this.scene.textures.exists('cautionStripe')) {
            const graphics = this.scene.make.graphics({ add: false });
            const stripeWidth = 60;
            const stripeHeight = 8;

            // Yellow and black diagonal stripes
            graphics.fillStyle(0xFFD700, 1);
            graphics.fillRect(0, 0, stripeWidth, stripeHeight);

            graphics.fillStyle(0x000000, 1);
            for (let i = -stripeHeight; i < stripeWidth; i += 12) {
                graphics.beginPath();
                graphics.moveTo(i, 0);
                graphics.lineTo(i + stripeHeight, stripeHeight);
                graphics.lineTo(i + stripeHeight + 6, stripeHeight);
                graphics.lineTo(i + 6, 0);
                graphics.closePath();
                graphics.fillPath();
            }

            graphics.generateTexture('cautionStripe', stripeWidth, stripeHeight);
            graphics.destroy();
        }

        // Place warning triangles around the portal
        const radius = 65;
        const angles = [
            Math.PI * 0.75,   // Top-left
            Math.PI * 0.25,   // Top-right
            Math.PI * 1.25,   // Bottom-left
            Math.PI * 1.75    // Bottom-right
        ];

        angles.forEach((angle, i) => {
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const triangle = this.scene.add.sprite(x, y, 'warningTriangle');
            triangle.setDepth(depth);
            triangle.setScale(0.8);

            // Pulsing animation for urgency
            this.scene.tweens.add({
                targets: triangle,
                alpha: { from: 0.7, to: 1 },
                scaleX: { from: 0.75, to: 0.85 },
                scaleY: { from: 0.75, to: 0.85 },
                duration: 800 + i * 100, // Staggered timing
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            signs.push(triangle);
        });

        // Add "DANGER" text above the portal
        const dangerText = this.scene.add.text(centerX, centerY - 55, '⚠️ DANGER', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(depth + 1);

        // Flashing danger text
        this.scene.tweens.add({
            targets: dangerText,
            alpha: { from: 0.6, to: 1 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        signs.push(dangerText);

        // Add small caution stripes on sides
        const leftStripe = this.scene.add.sprite(centerX - 55, centerY, 'cautionStripe');
        leftStripe.setDepth(depth);
        leftStripe.setAngle(90);
        leftStripe.setScale(0.8);
        signs.push(leftStripe);

        const rightStripe = this.scene.add.sprite(centerX + 55, centerY, 'cautionStripe');
        rightStripe.setDepth(depth);
        rightStripe.setAngle(90);
        rightStripe.setScale(0.8);
        signs.push(rightStripe);

        console.log('[WorldBuilder] Created warning signs around void portal');

        return signs;
    }

    destroy() {
        this.backgroundImage?.destroy();
        this.backgroundImage = null;
        this.debugGraphics?.destroy();
        this.debugGraphics = null;
    }
}

export default WorldBuilder;

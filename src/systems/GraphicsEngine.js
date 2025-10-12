const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * GraphicsEngine - Advanced programmatic sprite generation system
 * Creates professional-quality sprites with gradients, depth, lighting, and effects
 * Enhanced with Space-Mythic theme support for kid-friendly cosmic visuals
 */

class GraphicsEngine {
    constructor(scene) {
        this.scene = scene;
        this.lightDirection = { x: -0.3, y: -0.7 }; // Top-left lighting
        this.ambientLight = 0.4; // Base lighting level
        
        // Space-Mythic theme colors
        this.spaceMythicPalette = {
            starGold: 0xFFD54F,
            auroraTeal: 0x80CBC4,
            crystalLilac: 0xB39DDB,
            deepInk: 0x37474F,
            cosmicGreen: 0x81C784,
            asteroidOrange: 0xFFB74D,
            nebulaRed: 0xF48FB1,
            cometBlue: 0x64B5F6,
            nebulaPink: 0xF48FB1,
            stellarWhite: 0xF5F5F5,
            voidDark: 0x263238
        };
        
        this.isSpaceMythicMode = false;
    }

    /**
     * Calculate canvas metrics for creature rendering with generous padding
     */
    getCreatureCanvasMetrics(geneticTraits = null, baseSize = { width: 60, height: 80 }) {
        const scaleX = Math.max(1, geneticTraits?.bodyMods?.scaleX ?? geneticTraits?.scaleX ?? 1);
        const scaleY = Math.max(1, geneticTraits?.bodyMods?.scaleY ?? geneticTraits?.scaleY ?? 1);

        const basePadding = {
            x: 80,
            y: 90
        };

        const width = Math.ceil(baseSize.width * scaleX + basePadding.x * 2);
        const height = Math.ceil(baseSize.height * scaleY + basePadding.y * 2);

        const padding = {
            x: Math.ceil((width - baseSize.width) / 2),
            y: Math.ceil((height - baseSize.height) / 2)
        };

        return {
            width,
            height,
            padding,
            baseSize,
            baseCenter: {
                x: baseSize.width / 2,
                y: baseSize.height / 2
            },
            center: {
                x: padding.x + baseSize.width / 2,
                y: padding.y + baseSize.height / 2
            }
        };
    }

    resolveScale(bodyScale) {
        if (typeof bodyScale === 'number') {
            return { x: bodyScale, y: bodyScale };
        }

        if (!bodyScale || typeof bodyScale !== 'object') {
            return { x: 1, y: 1 };
        }

        return {
            x: bodyScale.x ?? bodyScale.scaleX ?? 1,
            y: bodyScale.y ?? bodyScale.scaleY ?? 1
        };
    }

    /**
     * Create enhanced creature sprites with realistic depth and lighting
     */
    createEnhancedCreature(bodyColor = 0x9370DB, headColor = 0xDDA0DD, wingColor = 0x8A2BE2, frame = 0, geneticTraits = null) {
        const baseSize = { width: 60, height: 80 };
        const baseCenter = { x: baseSize.width / 2, y: baseSize.height / 2 };
        const metrics = this.getCreatureCanvasMetrics(geneticTraits, baseSize);

        const graphics = this.scene.add.graphics();
        graphics.save();
        graphics.translateCanvas(metrics.padding.x, metrics.padding.y);

        const center = { ...baseCenter };

        // Calculate lighting values
        const shadowColor = this.darkenColor(bodyColor, 0.4);
        const highlightColor = this.lightenColor(bodyColor, 0.3);

        // Apply genetic trait modifications
        let modifiedBodyColor = bodyColor;
        let modifiedHeadColor = headColor;
        let eyeColor = 0x4169E1; // Default blue eyes
        let bodyScale = 1.0;
        let bodyOffset = { x: 0, y: 0 };

        if (geneticTraits) {
            // Apply eye color from genetics
            if (geneticTraits.eyeColor) {
                eyeColor = geneticTraits.eyeColor;
            }

            // Apply body shape modifications
            if (geneticTraits.bodyMods) {
                const bodyMods = geneticTraits.bodyMods;
                bodyScale = bodyMods.scaleY || bodyScale;
                bodyOffset.x = bodyMods.offsetX || 0;
                bodyOffset.y = bodyMods.offsetY || 0;
                
                // Store special features for later rendering
                this.currentBodyType = bodyMods.shape;
                this.currentSpecialFeatures = bodyMods.specialFeatures || [];
            }

            // Apply pattern modifications
            if (geneticTraits.pattern) {
                modifiedBodyColor = this.applyPatternColor(bodyColor, geneticTraits.pattern);
            }
        }

        // === BODY WITH DEPTH AND GRADIENTS ===
        
        // Render body based on body type
        this.renderBodyByType(graphics, center, bodyOffset, bodyScale, modifiedBodyColor, this.currentBodyType || 'balanced');

        // === HEAD WITH REALISTIC SHADING ===

        const headShadow = this.darkenColor(headColor, 0.4);
        const headHighlight = this.lightenColor(headColor, 0.3);

        // Head base (shadow side)
        graphics.fillStyle(headShadow);
        graphics.fillCircle(center.x + 1, center.y - 8, 16);

        // Head main color
        graphics.fillStyle(headColor);
        graphics.fillCircle(center.x - 1, center.y - 10, 15);

        // Head highlight (lit side)
        graphics.fillStyle(headHighlight, 0.9);
        graphics.fillCircle(center.x - 4, center.y - 12, 10);

        // Head shine
        graphics.fillStyle(0xFFFFFF, 0.4);
        graphics.fillCircle(center.x - 6, center.y - 15, 5);

        // === REALISTIC EYES WITH REFLECTIONS ===
        if (this.currentBodyType === 'cyclops') {
            this.createCyclopsEye(graphics, center.x, center.y - 10, eyeColor);
        } else {
            this.createRealisticEyes(graphics, center.x - 6, center.y - 12, center.x + 6, center.y - 12, eyeColor);
        }
        // === GENETIC HEAD MODIFICATIONS ===
        this.applyGeneticHeadMods(graphics, center, modifiedHeadColor, geneticTraits);

        // === DYNAMIC WINGS (ANIMATION FRAMES) ===

        // === DYNAMIC WINGS (ANIMATION FRAMES) ===
        this.createAnimatedWings(graphics, center, wingColor, frame);

        // === SUBTLE BODY DETAILS ===
        
        // Belly marking (adds character)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.2), 0.6);
        graphics.fillEllipse(center.x, center.y + 8, 15, 20);

        // Chest highlight
        graphics.fillStyle(0xFFFFFF, 0.2);
        graphics.fillEllipse(center.x - 2, center.y - 2, 8, 12);

        graphics.restore();

        return this.finalizeTexture(graphics, `enhancedCreature${frame}`, metrics.width, metrics.height);
    }

    /**
     * Render creature directly onto a graphics context (for genetic composition)
     */
    renderCreatureOnGraphics(graphics, center, size, bodyColor = 0x9370DB, headColor = 0xDDA0DD, wingColor = 0x8A2BE2, frame = 0, geneticTraits = null) {
        const eyeColor = 0x4169E1;
        let modifiedBodyColor = bodyColor;
        let modifiedHeadColor = headColor;
        
        // Body scaling and positioning modifiers
        let bodyScale = { x: 1.0, y: 1.0 };
        let bodyOffset = { x: 0, y: 0 };

        // Apply genetic modifications if provided
        if (geneticTraits) {
            // Apply body modifications from genetics
            if (geneticTraits.bodyMods) {
                const bodyMods = geneticTraits.bodyMods;
                bodyScale.x = bodyMods.scaleX || 1.0;
                bodyScale.y = bodyMods.scaleY || 1.0;
                bodyOffset.x = bodyMods.offsetX || 0;
                bodyOffset.y = bodyMods.offsetY || 0;
                
                this.currentBodyType = bodyMods.shape;
                this.currentSpecialFeatures = bodyMods.specialFeatures || [];
            }

            // Apply pattern modifications
            if (geneticTraits.pattern) {
                modifiedBodyColor = this.applyPatternColor(bodyColor, geneticTraits.pattern);
            }
        }

        // Render body based on body type
        this.renderBodyByType(graphics, center, bodyOffset, bodyScale, modifiedBodyColor, this.currentBodyType || 'balanced');

        // Head with realistic shading
        const headShadow = this.darkenColor(headColor, 0.4);
        const headHighlight = this.lightenColor(headColor, 0.3);

        // Head base (shadow side)
        graphics.fillStyle(headShadow);
        graphics.fillCircle(center.x + 1, center.y - 8, 16);

        // Head main color
        graphics.fillStyle(headColor);
        graphics.fillCircle(center.x - 1, center.y - 10, 15);

        // Head highlight (lit side)
        graphics.fillStyle(headHighlight, 0.9);
        graphics.fillCircle(center.x - 4, center.y - 12, 10);

        // Head shine
        graphics.fillStyle(0xFFFFFF, 0.4);
        graphics.fillCircle(center.x - 6, center.y - 15, 5);

        // Eyes based on body type
        if (this.currentBodyType === 'cyclops') {
            this.createCyclopsEye(graphics, center.x, center.y - 10, eyeColor);
        } else {
            this.createRealisticEyes(graphics, center.x - 6, center.y - 12, center.x + 6, center.y - 12, eyeColor);
        }

        // Genetic head modifications
        this.applyGeneticHeadMods(graphics, center, modifiedHeadColor, geneticTraits);

        // Dynamic wings (animated frames)
        this.createAnimatedWings(graphics, center, wingColor, frame);

        // Chest highlight
        graphics.fillStyle(0xFFFFFF, 0.2);
        graphics.fillEllipse(center.x - 2, center.y - 2, 8, 12);
    }

    /**
     * Create realistic eyes with proper depth and reflections
     */
    createRealisticEyes(graphics, leftX, leftY, rightX, rightY, eyeColor = 0x4169E1) {
        // Eye sockets (shadow)
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(leftX, leftY + 1, 6);
        graphics.fillCircle(rightX, rightY + 1, 6);

        // Eye whites
        graphics.fillStyle(0xFFFAF0);
        graphics.fillCircle(leftX, leftY, 5);
        graphics.fillCircle(rightX, rightY, 5);

        // Iris with color variation
        graphics.fillStyle(eyeColor);
        graphics.fillCircle(leftX, leftY, 3.5);
        graphics.fillCircle(rightX, rightY, 3.5);

        // Iris inner ring (adds depth)
        graphics.fillStyle(this.lightenColor(eyeColor, 0.2), 0.7);
        graphics.fillCircle(leftX, leftY, 2.5);
        graphics.fillCircle(rightX, rightY, 2.5);

        // Pupils
        graphics.fillStyle(0x000000);
        graphics.fillCircle(leftX, leftY, 1.5);
        graphics.fillCircle(rightX, rightY, 1.5);

        // Eye reflections (brings them to life!)
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(leftX - 1, leftY - 1, 1);
        graphics.fillCircle(rightX - 1, rightY - 1, 1);

        // Secondary reflection
        graphics.fillStyle(0xFFFFFF, 0.5);
        graphics.fillCircle(leftX + 1, leftY + 0.5, 0.5);
        graphics.fillCircle(rightX + 1, rightY + 0.5, 0.5);

        // Subtle eyelids for realism
        graphics.lineStyle(1, 0x000000, 0.3);
        graphics.strokeCircle(leftX, leftY - 0.5, 5);
        graphics.strokeCircle(rightX, rightY - 0.5, 5);
    }

    /**
     * Create single large cyclops eye with enhanced detail
     */
    createCyclopsEye(graphics, centerX, centerY, eyeColor = 0x4169E1) {
        // Eye socket (larger shadow for single eye)
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillCircle(centerX, centerY + 1, 10);

        // Prominent brow ridge (cyclops characteristic)
        graphics.fillStyle(0x8B4513, 0.8);
        graphics.fillEllipse(centerX, centerY - 6, 20, 6);

        // Eye white (larger than normal eyes)
        graphics.fillStyle(0xFFFAF0);
        graphics.fillCircle(centerX, centerY, 8);

        // Iris (proportionally larger)
        graphics.fillStyle(eyeColor);
        graphics.fillCircle(centerX, centerY, 6);

        // Iris inner ring with depth
        graphics.fillStyle(this.lightenColor(eyeColor, 0.2), 0.8);
        graphics.fillCircle(centerX, centerY, 4.5);

        // Iris texture lines for realism
        graphics.lineStyle(0.5, this.darkenColor(eyeColor, 0.3), 0.6);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const startX = centerX + Math.cos(angle) * 2;
            const startY = centerY + Math.sin(angle) * 2;
            const endX = centerX + Math.cos(angle) * 4;
            const endY = centerY + Math.sin(angle) * 4;
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }

        // Large pupil
        graphics.fillStyle(0x000000);
        graphics.fillCircle(centerX, centerY, 2.5);

        // Primary reflection (more prominent on single eye)
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(centerX - 2, centerY - 2, 1.5);

        // Secondary reflection
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(centerX + 1.5, centerY + 1, 0.8);

        // Eyelid with more defined edge
        graphics.lineStyle(1.5, 0x000000, 0.4);
        graphics.strokeCircle(centerX, centerY - 1, 8);

        // Lower eyelid shadow
        graphics.fillStyle(0x000000, 0.2);
        graphics.fillEllipse(centerX, centerY + 6, 16, 3);
    }

    /**
     * Create animated wings with proper depth and feather details
     */
    createAnimatedWings(graphics, center, wingColor, frame) {
        const wingShadow = this.darkenColor(wingColor, 0.5);
        const wingHighlight = this.lightenColor(wingColor, 0.3);

        // Wing animation offsets
        let leftWingY = center.y + 3;
        let rightWingY = center.y + 3;
        let wingSpread = 22;

        if (frame % 2 === 1) {
            leftWingY = center.y + 8;   // Wings down
            rightWingY = center.y + 8;
            wingSpread = 18;
        }

        // === LEFT WING ===
        
        // Wing shadow
        graphics.fillStyle(wingShadow);
        graphics.fillEllipse(center.x - wingSpread - 1, leftWingY + 1, 15, 25);

        // Wing base
        graphics.fillStyle(wingColor);
        graphics.fillEllipse(center.x - wingSpread, leftWingY, 15, 25);

        // Wing feather details (multiple layers)
        for (let feather = 0; feather < 3; feather++) {
            const featherAlpha = 0.8 - (feather * 0.2);
            const featherOffset = feather * 2;
            graphics.fillStyle(this.lightenColor(wingColor, 0.1 + feather * 0.1), featherAlpha);
            graphics.fillEllipse(center.x - wingSpread + featherOffset, leftWingY - featherOffset, 12 - feather, 20 - feather);
        }

        // Wing highlight
        graphics.fillStyle(wingHighlight, 0.7);
        graphics.fillEllipse(center.x - wingSpread + 2, leftWingY - 3, 8, 15);

        // === RIGHT WING (mirrored) ===
        
        // Wing shadow
        graphics.fillStyle(wingShadow);
        graphics.fillEllipse(center.x + wingSpread + 1, rightWingY + 1, 15, 25);

        // Wing base
        graphics.fillStyle(wingColor);
        graphics.fillEllipse(center.x + wingSpread, rightWingY, 15, 25);

        // Wing feather details
        for (let feather = 0; feather < 3; feather++) {
            const featherAlpha = 0.8 - (feather * 0.2);
            const featherOffset = feather * 2;
            graphics.fillStyle(this.lightenColor(wingColor, 0.1 + feather * 0.1), featherAlpha);
            graphics.fillEllipse(center.x + wingSpread - featherOffset, rightWingY - featherOffset, 12 - feather, 20 - feather);
        }

        // Wing highlight
        graphics.fillStyle(wingHighlight, 0.7);
        graphics.fillEllipse(center.x + wingSpread - 2, rightWingY - 3, 8, 15);

        // Wing membrane details (adds realism)
        graphics.lineStyle(1, wingShadow, 0.5);
        graphics.beginPath();
        graphics.moveTo(center.x - 5, center.y);
        graphics.lineTo(center.x - wingSpread + 5, leftWingY + 8);
        graphics.strokePath();

        graphics.beginPath();
        graphics.moveTo(center.x + 5, center.y);
        graphics.lineTo(center.x + wingSpread - 5, rightWingY + 8);
        graphics.strokePath();
    }

    /**
     * Create enhanced tree with bark texture and layered foliage
     */
    createEnhancedTree(scale = 1.0, season = 'summer') {
        const graphics = this.scene.add.graphics();
        const center = { x: 30, y: 50 };
        
        // === TRUNK WITH REALISTIC BARK ===
        
        // Trunk shadow
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillRect(center.x - 8 + 2, center.y - 20 + 2, 16 * scale, 45 * scale);

        // Trunk base (darkest brown)
        graphics.fillStyle(0x4A4A4A);
        graphics.fillRect(center.x - 8, center.y - 20, 16 * scale, 45 * scale);

        // Trunk main color
        graphics.fillStyle(0x8B4513);
        graphics.fillRect(center.x - 7, center.y - 19, 14 * scale, 43 * scale);

        // Trunk highlight (sun-lit side)
        graphics.fillStyle(0xCD853F);
        graphics.fillRect(center.x - 6, center.y - 18, 8 * scale, 41 * scale);

        // Bark texture lines (vertical)
        graphics.lineStyle(1, 0x654321, 0.8);
        for (let i = 0; i < 6; i++) {
            const x = center.x - 5 + (i * 2);
            graphics.beginPath();
            graphics.moveTo(x, center.y - 18);
            graphics.lineTo(x + (Math.random() - 0.5) * 2, center.y + 20);
            graphics.strokePath();
        }

        // Bark texture (horizontal rings)
        graphics.lineStyle(1, 0x654321, 0.6);
        for (let i = 0; i < 8; i++) {
            const y = center.y - 15 + (i * 5);
            const curve = Math.sin(i * 0.5) * 2;
            graphics.beginPath();
            graphics.moveTo(center.x - 7, y);
            graphics.lineTo(center.x + 7, y + curve);
            graphics.strokePath();
        }

        // === SEASONAL FOLIAGE WITH DEPTH ===
        
        const foliageColors = this.getSeasonalColors(season);
        
        // Foliage shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(center.x + 3, center.y - 32, 28 * scale);

        // Background foliage layer (darkest)
        graphics.fillStyle(foliageColors.dark);
        graphics.fillCircle(center.x, center.y - 35, 30 * scale);

        // Mid foliage layer
        graphics.fillStyle(foliageColors.mid);
        graphics.fillCircle(center.x - 3, center.y - 37, 25 * scale);

        // Front foliage layer (brightest)
        graphics.fillStyle(foliageColors.light);
        graphics.fillCircle(center.x - 5, center.y - 39, 20 * scale);

        // Individual leaf clusters for detail
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 15 + Math.random() * 8;
            const leafX = center.x + Math.cos(angle) * radius;
            const leafY = center.y - 35 + Math.sin(angle) * radius * 0.6;
            
            graphics.fillStyle(foliageColors.accent, 0.7);
            graphics.fillEllipse(leafX, leafY, 4 + Math.random() * 3, 6 + Math.random() * 3);
        }

        // Trunk-foliage connection (realistic growth)
        graphics.fillStyle(this.darkenColor(foliageColors.mid, 0.3));
        graphics.fillEllipse(center.x, center.y - 20, 18 * scale, 12 * scale);

        return this.finalizeTexture(graphics, `enhancedTree_${season}`, 60, 80);
    }

    /**
     * Create realistic rock with cracks, moss, and proper shading
     */
    createEnhancedRock(scale = 1.0, mossiness = 0.3) {
        const graphics = this.scene.add.graphics();
        const center = { x: 25, y: 25 };

        // === GROUND SHADOW ===
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillEllipse(center.x + 2, center.y + 18, 35 * scale, 20 * scale);

        // === ROCK BASE LAYERS (MULTIPLE FOR REALISM) ===
        
        // Darkest base
        graphics.fillStyle(0x2F4F4F);
        graphics.fillEllipse(center.x, center.y + 8, 32 * scale, 25 * scale);

        // Dark gray layer
        graphics.fillStyle(0x696969);
        graphics.fillEllipse(center.x - 2, center.y + 5, 30 * scale, 23 * scale);

        // Medium gray layer
        graphics.fillStyle(0x808080);
        graphics.fillEllipse(center.x - 4, center.y + 2, 26 * scale, 20 * scale);

        // Light gray highlight
        graphics.fillStyle(0xA9A9A9);
        graphics.fillEllipse(center.x - 6, center.y - 2, 20 * scale, 16 * scale);

        // Brightest highlight (sun reflection)
        graphics.fillStyle(0xD3D3D3, 0.8);
        graphics.fillEllipse(center.x - 8, center.y - 5, 14 * scale, 12 * scale);

        // === REALISTIC CRACK SYSTEM ===
        
        graphics.lineStyle(2, 0x2F4F4F, 0.8);
        
        // Main crack
        graphics.beginPath();
        graphics.moveTo(center.x - 12, center.y - 8);
        graphics.lineTo(center.x - 2 + Math.random() * 2, center.y + 2);
        graphics.lineTo(center.x + 8, center.y + 15);
        graphics.strokePath();

        // Secondary cracks
        graphics.lineStyle(1, 0x2F4F4F, 0.6);
        for (let i = 0; i < 3; i++) {
            const startX = center.x - 10 + Math.random() * 20;
            const startY = center.y - 5 + Math.random() * 10;
            const endX = startX + (Math.random() - 0.5) * 15;
            const endY = startY + Math.random() * 12;
            
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }

        // === MOSS AND LICHEN (ENVIRONMENTAL DETAIL) ===
        
        if (mossiness > 0) {
            const mossCount = Math.floor(mossiness * 10);
            for (let i = 0; i < mossCount; i++) {
                const mossX = center.x - 8 + Math.random() * 16;
                const mossY = center.y - 2 + Math.random() * 12;
                const mossSize = 1 + Math.random() * 3;
                
                // Different moss colors for variety
                const mossColors = [0x556B2F, 0x6B8E23, 0x228B22, 0x32CD32];
                const mossColor = mossColors[Math.floor(Math.random() * mossColors.length)];
                
                graphics.fillStyle(mossColor, 0.6 + Math.random() * 0.3);
                graphics.fillCircle(mossX, mossY, mossSize);
                
                // Moss highlight
                graphics.fillStyle(this.lightenColor(mossColor, 0.3), 0.4);
                graphics.fillCircle(mossX - 0.5, mossY - 0.5, mossSize * 0.6);
            }
        }

        // === SURFACE TEXTURE DETAILS ===
        
        // Small surface bumps
        for (let i = 0; i < 5; i++) {
            const bumpX = center.x - 6 + Math.random() * 12;
            const bumpY = center.y - 3 + Math.random() * 8;
            const bumpSize = 0.5 + Math.random() * 1.5;
            
            graphics.fillStyle(0xBCBCBC, 0.7);
            graphics.fillCircle(bumpX, bumpY, bumpSize);
        }

        return this.finalizeTexture(graphics, `enhancedRock_${Math.floor(mossiness * 10)}`, 50, 50);
    }

    /**
     * Create beautiful flower with realistic petals and details
     */
    createEnhancedFlower(petalColor = 0xFF69B4, centerColor = 0xFFD700, scale = 1.0) {
        const graphics = this.scene.add.graphics();
        const center = { x: 20, y: 25 };

        // === STEM WITH GRADIENT ===
        
        // Stem shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRect(center.x - 1, center.y + 8, 3, 20 * scale);

        // Stem base (dark green)
        graphics.fillStyle(0x228B22);
        graphics.fillRect(center.x - 1.5, center.y + 7, 3, 20 * scale);

        // Stem highlight
        graphics.fillStyle(0x32CD32);
        graphics.fillRect(center.x - 1, center.y + 7, 1.5, 19 * scale);

        // === REALISTIC LEAVES ===
        
        const leafPositions = [
            { x: center.x - 8, y: center.y + 15, angle: -0.3 },
            { x: center.x + 8, y: center.y + 18, angle: 0.3 }
        ];

        leafPositions.forEach(leaf => {
            // Calculate rotated ellipse points manually
            const cos = Math.cos(leaf.angle);
            const sin = Math.sin(leaf.angle);
            
            // Leaf shadow
            graphics.fillStyle(0x000000, 0.3);
            const shadowX = leaf.x + 1;
            const shadowY = leaf.y + 1;
            graphics.fillEllipse(shadowX, shadowY, 6, 10);

            // Leaf base
            graphics.fillStyle(0x228B22);
            graphics.fillEllipse(leaf.x, leaf.y, 6, 10);

            // Leaf highlight
            graphics.fillStyle(0x32CD32);
            graphics.fillEllipse(leaf.x - 1, leaf.y - 1, 4, 7);

            // Leaf vein
            graphics.lineStyle(1, 0x006400, 0.7);
            graphics.beginPath();
            graphics.moveTo(leaf.x, leaf.y - 3);
            graphics.lineTo(leaf.x + Math.cos(leaf.angle) * 2, leaf.y + Math.sin(leaf.angle) * 4);
            graphics.strokePath();
        });

        // === LAYERED PETALS WITH REALISTIC DEPTH ===
        
        const petalCount = 6;
        const petalShadow = this.darkenColor(petalColor, 0.4);
        const petalHighlight = this.lightenColor(petalColor, 0.3);

        for (let layer = 0; layer < 2; layer++) {
            const layerOffset = layer * 0.5;
            const layerScale = 1 - (layer * 0.2);
            
            for (let i = 0; i < petalCount; i++) {
                const angle = (i / petalCount) * Math.PI * 2 + (layer * 0.2);
                const petalDistance = 8 + layerOffset;
                const petalX = center.x + Math.cos(angle) * petalDistance;
                const petalY = center.y + Math.sin(angle) * petalDistance;
                
                // Petal shadow
                graphics.fillStyle(petalShadow, 0.4);
                graphics.fillEllipse(petalX + 1, petalY + 1, 6 * layerScale, 10 * layerScale);

                // Main petal
                graphics.fillStyle(petalColor, 0.9);
                graphics.fillEllipse(petalX, petalY, 6 * layerScale, 10 * layerScale);

                // Petal highlight
                graphics.fillStyle(petalHighlight, 0.7);
                graphics.fillEllipse(petalX - Math.cos(angle) * 2, petalY - Math.sin(angle) * 2, 3 * layerScale, 6 * layerScale);

                // Petal vein
                graphics.lineStyle(1, petalShadow, 0.5);
                graphics.beginPath();
                graphics.moveTo(center.x, center.y);
                graphics.lineTo(petalX, petalY);
                graphics.strokePath();
            }
        }

        // === DETAILED FLOWER CENTER ===
        
        // Center shadow
        graphics.fillStyle(this.darkenColor(centerColor, 0.5));
        graphics.fillCircle(center.x, center.y + 1, 4 * scale);

        // Center base
        graphics.fillStyle(centerColor);
        graphics.fillCircle(center.x, center.y, 4 * scale);

        // Center highlight
        graphics.fillStyle(this.lightenColor(centerColor, 0.3));
        graphics.fillCircle(center.x - 1, center.y - 1, 2.5 * scale);

        // Stamen details
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const stamenX = center.x + Math.cos(angle) * 2;
            const stamenY = center.y + Math.sin(angle) * 2;
            
            graphics.fillStyle(0xFFFFE0, 0.9);
            graphics.fillCircle(stamenX, stamenY, 0.8);
            
            // Tiny stamen tips
            graphics.fillStyle(0xFF4500, 0.8);
            graphics.fillCircle(stamenX, stamenY, 0.4);
        }

        return this.finalizeTexture(graphics, `enhancedFlower`, 40, 50);
    }

    /**
     * Create advanced magical sparkle effects
     */
    createMagicalSparkle(color = 0xFFD700, size = 1.0) {
        const graphics = this.scene.add.graphics();
        const center = { x: 15, y: 15 };

        // Glow effect (multiple layers)
        for (let i = 0; i < 5; i++) {
            const glowSize = (8 + i * 3) * size;
            const alpha = 0.8 - (i * 0.15);
            graphics.fillStyle(color, alpha);
            graphics.fillCircle(center.x, center.y, glowSize);
        }

        // Core sparkle (create custom star shape)
        graphics.fillStyle(color);
        this.drawStar(graphics, center.x, center.y, 4, 3 * size, 6 * size);

        // Bright center
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(center.x, center.y, 2 * size);

        // Cross rays
        graphics.lineStyle(2 * size, 0xFFFFFF, 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x - 10 * size, center.y);
        graphics.lineTo(center.x + 10 * size, center.y);
        graphics.moveTo(center.x, center.y - 10 * size);
        graphics.lineTo(center.x, center.y + 10 * size);
        graphics.strokePath();

        return this.finalizeTexture(graphics, `magicalSparkle`, 30, 30);
    }

    // === UTILITY METHODS ===

    /**
     * Get seasonal foliage colors
     */
    getSeasonalColors(season) {
        const colorSets = {
            spring: { dark: 0x228B22, mid: 0x32CD32, light: 0x90EE90, accent: 0x98FB98 },
            summer: { dark: 0x006400, mid: 0x228B22, light: 0x32CD32, accent: 0x7CFC00 },
            autumn: { dark: 0x8B4513, mid: 0xFF8C00, light: 0xFFA500, accent: 0xFFD700 },
            winter: { dark: 0x2F4F4F, mid: 0x696969, light: 0x808080, accent: 0xA9A9A9 }
        };
        
        return colorSets[season] || colorSets.summer;
    }

    /**
     * Lighten a color by a percentage
     */
    lightenColor(color, percent) {
        const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * (1 + percent)));
        const g = Math.min(255, Math.floor(((color >> 8) & 0xFF) * (1 + percent)));
        const b = Math.min(255, Math.floor((color & 0xFF) * (1 + percent)));
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Darken a color by a percentage
     */
    darkenColor(color, percent) {
        const r = Math.floor(((color >> 16) & 0xFF) * (1 - percent));
        const g = Math.floor(((color >> 8) & 0xFF) * (1 - percent));
        const b = Math.floor((color & 0xFF) * (1 - percent));
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Draw a custom star shape since Phaser doesn't have fillStar
     */
    drawStar(graphics, x, y, points, innerRadius, outerRadius) {
        const step = Math.PI / points;
        const halfStep = step / 2;
        
        graphics.beginPath();
        graphics.moveTo(x + outerRadius * Math.cos(0), y + outerRadius * Math.sin(0));
        
        for (let i = 0; i < points; i++) {
            const angle = i * step * 2;
            
            // Outer point
            graphics.lineTo(
                x + outerRadius * Math.cos(angle),
                y + outerRadius * Math.sin(angle)
            );
            
            // Inner point
            graphics.lineTo(
                x + innerRadius * Math.cos(angle + halfStep),
                y + innerRadius * Math.sin(angle + halfStep)
            );
        }
        
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Apply genetic head modifications based on creature traits
     */
    applyGeneticHeadMods(graphics, center, headColor, geneticTraits) {
        if (!geneticTraits) return;
        
        // Apply horn modifications
        if (geneticTraits.horns) {
            const hornColor = this.darkenColor(headColor, 0.3);
            
            // Left horn
            graphics.fillStyle(hornColor);
            graphics.fillTriangle(
                center.x - 8, center.y - 20,
                center.x - 12, center.y - 30,
                center.x - 4, center.y - 25
            );
            
            // Right horn
            graphics.fillTriangle(
                center.x + 8, center.y - 20,
                center.x + 12, center.y - 30,
                center.x + 4, center.y - 25
            );
        }
        
        // Apply crest modifications
        if (geneticTraits.crest) {
            const crestColor = this.lightenColor(headColor, 0.2);
            graphics.fillStyle(crestColor);
            graphics.fillEllipse(center.x, center.y - 18, 8, 12);
        }
    }

    /**
     * Apply pattern color modifications
     */
    applyPatternColor(baseColor, pattern) {
        switch (pattern) {
            case 'striped':
                return this.lightenColor(baseColor, 0.2);
            case 'spotted':
                return this.darkenColor(baseColor, 0.1);
            case 'gradient':
                return this.lightenColor(baseColor, 0.15);
            default:
                return baseColor;
        }
    }

    /**
     * Finalize texture creation and cleanup
     */
    finalizeTexture(graphics, name, width, height) {
        graphics.generateTexture(name, width, height);
        graphics.destroy();
        return name;
    }

    /**
     * Enable Space-Mythic theme mode
     */
    enableSpaceMythicMode() {
        this.isSpaceMythicMode = true;
        console.log('graphics:info [GraphicsEngine] Space-Mythic theme enabled');
        
        // Emit theme change event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('graphics/theme_changed', { 
                theme: 'spaceMythic',
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Disable Space-Mythic theme mode
     */
    disableSpaceMythicMode() {
        this.isSpaceMythicMode = false;
        console.log('graphics:info [GraphicsEngine] Space-Mythic theme disabled');
    }

    /**
     * Apply Space-Mythic tint to a sprite with cosmic shimmer effect
     * @param {Phaser.GameObjects.Sprite} sprite - Target sprite
     * @param {string} tintType - Type of tint (stellar, cosmic, ethereal)
     * @param {Object} options - Tinting options
     */
    applySpaceMythicTint(sprite, tintType = 'stellar', options = {}) {
        if (!this.isSpaceMythicMode || !sprite || !sprite.setTint) {
            return; // Non-breaking: do nothing if not in Space-Mythic mode
        }

        const tints = {
            stellar: {
                base: this.spaceMythicPalette.starGold,
                shimmer: this.spaceMythicPalette.stellarWhite,
                intensity: 0.7
            },
            cosmic: {
                base: this.spaceMythicPalette.crystalLilac,
                shimmer: this.spaceMythicPalette.auroraTeal,
                intensity: 0.6
            },
            ethereal: {
                base: this.spaceMythicPalette.cometBlue,
                shimmer: this.spaceMythicPalette.nebulaPink,
                intensity: 0.5
            },
            biolume: {
                base: this.spaceMythicPalette.cosmicGreen,
                shimmer: this.spaceMythicPalette.starGold,
                intensity: 0.8
            }
        };

        const tintConfig = tints[tintType] || tints.stellar;
        const { enableShimmer = true, duration = 3000 } = options;

        // Apply base tint
        sprite.setTint(tintConfig.base);

        // Add shimmer effect if enabled
        if (enableShimmer && this.scene.tweens) {
            this.scene.tweens.add({
                targets: sprite,
                tint: tintConfig.shimmer,
                duration: duration / 2,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                alpha: tintConfig.intensity
            });
        }
    }

    /**
     * Create Space-Mythic enhanced creature with cosmic theme
     * @param {Object} config - Creature configuration
     * @returns {string} Texture name
     */
    createSpaceMythicCreature(config = {}) {
        const {
            bodyColor = this.spaceMythicPalette.crystalLilac,
            headColor = this.spaceMythicPalette.stellarWhite,
            wingColor = this.spaceMythicPalette.auroraTeal,
            eyeColor = this.spaceMythicPalette.starGold,
            frame = 0,
            geneticTraits = null,
            cosmicAura = true
        } = config;

        const baseSize = { width: 60, height: 80 };
        const metrics = this.getCreatureCanvasMetrics(geneticTraits, baseSize);

        const graphics = this.scene.add.graphics();
        graphics.save();
        graphics.translateCanvas(metrics.padding.x, metrics.padding.y);

        const center = { ...metrics.baseCenter };

        this.renderCreatureOnGraphics(
            graphics,
            center,
            baseSize,
            bodyColor,
            headColor,
            wingColor,
            frame,
            geneticTraits
        );

        if (cosmicAura) {
            this.addCosmicAura(graphics, center, {
                innerColor: this.spaceMythicPalette.starGold,
                outerColor: this.spaceMythicPalette.crystalLilac,
                intensity: 0.3
            });
        }

        this.addStellarSparkles(graphics, { width: metrics.width, height: metrics.height }, {
            count: 5,
            colors: [
                this.spaceMythicPalette.stellarWhite,
                this.spaceMythicPalette.starGold,
                this.spaceMythicPalette.auroraTeal
            ]
        });

        graphics.restore();

        const textureName = `space_creature_${frame}_${Date.now()}`;
        return this.finalizeTexture(graphics, textureName, metrics.width, metrics.height);
    }

    /**
     * Create randomized creature from genetic profile
     * @param {Object} genetics - Genetic profile from CreatureGenetics
     * @param {number} frame - Animation frame
     * @returns {Object} Texture info and metadata
     */
    createRandomizedSpaceMythicCreature(genetics, frame = 0) {
        if (!genetics || !genetics.traits) {
            console.warn('graphics:warn [GraphicsEngine] Invalid genetics provided, using defaults');
            return this.createSpaceMythicCreature({ frame });
        }

        const startTime = Date.now();

        // Convert genetic data to visual parameters
        const visualConfig = this.geneticsToVisualConfig(genetics);

        // Apply body shape modifications
        const bodyModifications = this.calculateBodyModifications(genetics.traits.bodyShape);

        // Create enhanced creature with genetic modifications
        const enhancedTraits = {
            ...genetics.traits.features,
            bodyMods: bodyModifications
        };

        // Create base creature
        const baseSize = { width: 60, height: 80 };
        const metrics = this.getCreatureCanvasMetrics(enhancedTraits, baseSize);

        const graphics = this.scene.add.graphics();
        graphics.save();
        graphics.translateCanvas(metrics.padding.x, metrics.padding.y);

        const center = { ...metrics.baseCenter };

        // Create creature directly on the graphics context
        this.renderCreatureOnGraphics(
            graphics,
            center,
            baseSize,
            visualConfig.colors.body,
            visualConfig.colors.head, 
            visualConfig.colors.wings,
            frame,
            enhancedTraits
        );

        // Add enhanced markings based on genetics
        this.addEnhancedMarkings(graphics, center, baseSize, genetics.traits.features.markings, genetics.traits.colorGenome);

        // Add rarity-based special effects
        this.addRarityEffects(graphics, genetics, center, {
            width: metrics.width,
            height: metrics.height
        });
        
        // Add cosmic affinity effects
        this.addCosmicAffinityEffects(graphics, genetics.cosmicAffinity, center);
        
        // Add personality-based visual traits
        this.addPersonalityEffects(graphics, genetics.personality, center, baseSize);

        graphics.restore();

        const textureName = `creature_${genetics.id}_${frame}`;
        const textureResult = this.finalizeTexture(graphics, textureName, metrics.width, metrics.height);
        
        const generationTime = Date.now() - startTime;
        
        console.log(`graphics:debug [GraphicsEngine] Created ${genetics.rarity} ${genetics.species} in ${generationTime}ms`, {
            textureId: textureName,
            genetics: genetics.id
        });

        return {
            textureName,
            genetics,
            visualConfig,
            metadata: {
                generationTime,
                frame,
                createdAt: Date.now()
            }
        };
    }

    /**
     * Convert genetics to visual configuration with enhanced color genome support
     */
    geneticsToVisualConfig(genetics) {
        const colorGenome = genetics.traits.colorGenome;
        const features = genetics.traits.features;
        
        // Enhanced color processing
        const processedColors = this.processEnhancedColorGenome(colorGenome);
        
        return {
            colors: {
                body: processedColors.body,
                head: processedColors.head,
                wings: processedColors.wings,
                eyes: features.eyes.color,
                accent: colorGenome.accent,
                
                // Advanced color properties
                gradient: colorGenome.gradient,
                harmonicResonance: colorGenome.harmonicResonance,
                dominantHue: colorGenome.dominantHue
            },
            effects: {
                shimmerIntensity: colorGenome.shimmerIntensity,
                glowIntensity: features.eyes.glow,
                wingSpan: features.wings.span,
                wingShimmer: features.wings.shimmer,
                
                // Enhanced effects from color genome
                colorComplexity: colorGenome.colorComplexity,
                mixingPattern: colorGenome.mixingPattern,
                saturationLevel: colorGenome.saturationLevel,
                mutationEffects: colorGenome.mutationFlags || []
            },
            features: {
                eyeSize: features.eyes.size,
                wingType: features.wings.type,
                markings: features.markings,
                specialFeatures: features.specialFeatures || []
            },
            
            // Advanced visual metadata
            rarity: genetics.rarity,
            species: genetics.species,
            cosmicAffinity: genetics.cosmicAffinity.element,
            personalityCore: genetics.personality.core
        };
    }

    /**
     * Process enhanced color genome for visual application
     */
    processEnhancedColorGenome(colorGenome) {
        let bodyColor = colorGenome.primary;
        let wingsColor = colorGenome.secondary;
        
        // Apply gradient effects if present
        if (colorGenome.gradient && colorGenome.gradient.type !== 'linear') {
            switch (colorGenome.gradient.type) {
                case 'radial':
                    bodyColor = this.applyRadialGradientEffect(bodyColor, colorGenome.gradient);
                    break;
                case 'spiral':
                    bodyColor = this.applySpiralGradientEffect(bodyColor, colorGenome.gradient);
                    break;
            }
        }
        
        // Apply mutation effects
        if (colorGenome.mutationFlags) {
            colorGenome.mutationFlags.forEach(flag => {
                switch (flag) {
                    case 'chromatic_shift':
                        bodyColor = this.applyColorShift(bodyColor, 0.1);
                        break;
                    case 'luminance_boost':
                        bodyColor = this.lightenColor(bodyColor, 0.15);
                        wingsColor = this.lightenColor(wingsColor, 0.1);
                        break;
                    case 'prismatic_effect':
                        bodyColor = this.applyPrismaticEffect(bodyColor);
                        break;
                }
            });
        }
        
        // Calculate head color based on mixing pattern
        let headColor;
        switch (colorGenome.mixingPattern) {
            case 'gradient':
            case 'color_shift':
                headColor = this.blendColors(bodyColor, wingsColor, 0.4);
                break;
            case 'harmonic_blend':
                headColor = this.createHarmonicBlend(bodyColor, wingsColor, colorGenome.harmonicResonance);
                break;
            case 'aurora_flow':
            case 'cosmic_weave':
                headColor = this.createCosmicBlend(bodyColor, wingsColor, 0.3);
                break;
            default:
                headColor = this.blendColors(bodyColor, wingsColor, 0.3);
        }
        
        return {
            body: bodyColor,
            head: headColor,
            wings: wingsColor
        };
    }

    /**
     * Enhanced color blending methods
     */
    
    applyRadialGradientEffect(baseColor, gradient) {
        const intensity = gradient.intensity || 0.5;
        return this.blendColors(baseColor, gradient.endColor, intensity * 0.3);
    }
    
    applySpiralGradientEffect(baseColor, gradient) {
        const intensity = gradient.intensity || 0.5;
        // Apply a subtle spiral-like color shift
        return this.applyColorShift(baseColor, intensity * 0.2);
    }
    
    applyColorShift(color, intensity) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        // Apply a chromatic shift by rotating through color wheel
        const shift = intensity * 30; // Hue shift amount
        
        const newR = Math.min(255, r + shift);
        const newG = Math.min(255, g + shift * 0.5);
        const newB = Math.min(255, b + shift * 0.7);
        
        return (Math.round(newR) << 16) | (Math.round(newG) << 8) | Math.round(newB);
    }
    
    applyPrismaticEffect(baseColor) {
        // Add rainbow-like iridescence to the color
        const r = (baseColor >> 16) & 0xFF;
        const g = (baseColor >> 8) & 0xFF;
        const b = baseColor & 0xFF;
        
        const enhanced = {
            r: Math.min(255, r + 20),
            g: Math.min(255, g + 15),
            b: Math.min(255, b + 25)
        };
        
        return (enhanced.r << 16) | (enhanced.g << 8) | enhanced.b;
    }
    
    createHarmonicBlend(color1, color2, harmonicScore) {
        // Use harmonic score to determine blend ratio
        const ratio = 0.3 + (harmonicScore * 0.2); // 0.3-0.5 range
        return this.blendColors(color1, color2, ratio);
    }
    
    createCosmicBlend(color1, color2, ratio) {
        // Create a cosmic-themed blend with slight luminescence boost
        const blended = this.blendColors(color1, color2, ratio);
        return this.lightenColor(blended, 0.1);
    }

    /**
     * Render body based on genetic body type
     */
    renderBodyByType(graphics, center, bodyOffset, bodyScale, bodyColor, bodyType) {
        switch (bodyType) {
            case 'fish':
                this.renderFishBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'cyclops':
                this.renderCyclopsBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'serpentine':
                this.renderSerpentineBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            default:
                this.renderStandardBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
        }
    }

    /**
     * Render standard creature body
     */
    renderStandardBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);
        // Body shadow (ground shadow)
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 32, 42);

        // Body base layer (darkest)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 15 + bodyOffset.y, 35 * scale.x, 45 * scale.y);

        // Body mid layer
        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 2 + bodyOffset.x, center.y + 12 + bodyOffset.y, 30 * scale.x, 40 * scale.y);

        // Body highlight layer (creates 3D roundness)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.8);
        graphics.fillEllipse(center.x - 6 + bodyOffset.x, center.y + 8 + bodyOffset.y, 20 * scale.x, 30 * scale.y);

        // Body shine/reflection (adds realism)
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillEllipse(center.x - 8, center.y + 5, 12, 18);
    }

    /**
     * Render fish-like body
     */
    renderFishBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);
        // Fish body shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 2, center.y + 20, 28 * scale.x, 50 * scale.y);

        // Fish body - more elongated and streamlined
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 10 + bodyOffset.y, 32 * scale.x, 55 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 1 + bodyOffset.x, center.y + 8 + bodyOffset.y, 28 * scale.x, 50 * scale.y);

        // Streamlined highlight
        graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.8);
        graphics.fillEllipse(center.x - 4 + bodyOffset.x, center.y + 5 + bodyOffset.y, 18 * scale.x, 35 * scale.y);

        // Fish tail
        graphics.fillStyle(bodyColor);
        graphics.beginPath();
        graphics.moveTo(center.x + bodyOffset.x, center.y + 35 + bodyOffset.y);
        graphics.lineTo(center.x - 8 + bodyOffset.x, center.y + 45 + bodyOffset.y);
        graphics.lineTo(center.x + 8 + bodyOffset.x, center.y + 45 + bodyOffset.y);
        graphics.closePath();
        graphics.fillPath();

        // Side fins
        graphics.fillStyle(this.lightenColor(bodyColor, 0.2), 0.7);
        graphics.fillEllipse(center.x - 12 + bodyOffset.x, center.y + 15 + bodyOffset.y, 8 * scale.x, 15 * scale.y);
        graphics.fillEllipse(center.x + 12 + bodyOffset.x, center.y + 15 + bodyOffset.y, 8 * scale.x, 15 * scale.y);
    }

    /**
     * Render cyclops body with single large eye
     */
    renderCyclopsBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);
        // Cyclops body - slightly larger and rounder
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 36 * scale.x, 46 * scale.y);

        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 15 + bodyOffset.y, 38 * scale.x, 48 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 2 + bodyOffset.x, center.y + 12 + bodyOffset.y, 34 * scale.x, 44 * scale.y);

        graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.8);
        graphics.fillEllipse(center.x - 6 + bodyOffset.x, center.y + 8 + bodyOffset.y, 24 * scale.x, 34 * scale.y);

        // Cyclops will have its special eye rendered in head section
    }

    /**
     * Render serpentine body - long and sinuous
     */
    renderSerpentineBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);
        // Serpentine body - long and curved
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 2, center.y + 30, 24 * scale.x, 65 * scale.y);

        // Main body segments
        for (let i = 0; i < 3; i++) {
            const segmentY = center.y + 10 + (i * 15) + bodyOffset.y;
            const segmentX = center.x + bodyOffset.x + (Math.sin(i * 0.5) * 3);

            graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
            graphics.fillEllipse(segmentX + 1, segmentY + 2, 26 * scale.x, 18 * scale.y);

            graphics.fillStyle(bodyColor);
            graphics.fillEllipse(segmentX, segmentY, 24 * scale.x, 16 * scale.y);

            graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.7);
            graphics.fillEllipse(segmentX - 2, segmentY - 1, 16 * scale.x, 12 * scale.y);
        }

        // Tapered tail
        graphics.fillStyle(bodyColor);
        graphics.beginPath();
        graphics.moveTo(center.x + bodyOffset.x, center.y + 55 + bodyOffset.y);
        graphics.lineTo(center.x - 4 + bodyOffset.x, center.y + 65 + bodyOffset.y);
        graphics.lineTo(center.x + 4 + bodyOffset.x, center.y + 65 + bodyOffset.y);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Calculate body modifications from genetic body shape
     */
    calculateBodyModifications(bodyShape) {
        const modifications = {
            shape: bodyShape.type,
            scaleX: 1.0,
            scaleY: 1.0,
            offsetX: 0,
            offsetY: 0,
            specialFeatures: []
        };

        switch (bodyShape.type) {
            case 'slender':
                modifications.scaleX = 0.85 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.1 + (bodyShape.intensity * 0.1);
                modifications.offsetY = -2;
                break;
                
            case 'sturdy':
                modifications.scaleX = 1.1 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 0.9 + (bodyShape.intensity * 0.1);
                modifications.offsetY = 2;
                break;
                
            case 'fish':
                modifications.scaleX = 0.9 + (bodyShape.intensity * 0.2);
                modifications.scaleY = 1.3 + (bodyShape.intensity * 0.2);
                modifications.offsetY = 0;
                modifications.specialFeatures.push('fish_tail', 'fins', 'streamlined_body');
                break;
                
            case 'cyclops':
                modifications.scaleX = 1.0 + (bodyShape.intensity * 0.15);
                modifications.scaleY = 1.0 + (bodyShape.intensity * 0.15);
                modifications.offsetY = 0;
                modifications.specialFeatures.push('single_eye', 'prominent_brow', 'wide_mouth');
                break;
                
            case 'serpentine':
                modifications.scaleX = 0.7 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.4 + (bodyShape.intensity * 0.3);
                modifications.offsetY = -5;
                modifications.specialFeatures.push('elongated_body', 'no_legs', 'undulating_movement');
                break;

            case 'aurora':
                modifications.scaleX = 1.0 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.35 + (bodyShape.intensity * 0.25);
                modifications.offsetY = -4;
                modifications.specialFeatures.push('aurora_trail', 'luminous_ridge');
                break;

            case 'crystal':
                modifications.scaleX = 1.15 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.0 + (bodyShape.intensity * 0.05);
                modifications.offsetY = -2;
                modifications.specialFeatures.push('crystal_facets', 'angular_plating');
                break;

            case 'guardian':
                modifications.scaleX = 1.25 + (bodyShape.intensity * 0.15);
                modifications.scaleY = 1.05 + (bodyShape.intensity * 0.1);
                modifications.offsetY = 1;
                modifications.specialFeatures.push('armored_plating', 'broad_shoulders');
                break;

            case 'balanced':
            default:
                modifications.scaleX = 0.95 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 0.95 + (bodyShape.intensity * 0.1);
                break;
        }

        return modifications;
    }

    /**
     * Add rarity-based special effects
     */
    addRarityEffects(graphics, genetics, center, size) {
        const rarity = genetics.rarity;
        const specialFeatures = genetics.traits.features.specialFeatures || [];

        // Common creatures get basic effects
        if (rarity === 'common') {
            return;
        }

        // Uncommon and above get enhanced aura
        if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'legendary') {
            const auraIntensity = {
                uncommon: 0.2,
                rare: 0.4,
                legendary: 0.6
            }[rarity];

            this.addCosmicAura(graphics, center, {
                innerColor: genetics.traits.colorGenome.accent,
                outerColor: genetics.traits.colorGenome.secondary,
                intensity: auraIntensity
            });
        }

        // Special feature effects
        specialFeatures.forEach(feature => {
            this.addSpecialFeatureEffect(graphics, feature, center, genetics);
        });

        // Legendary creatures get extra sparkles
        if (rarity === 'legendary') {
            this.addLegendaryEffects(graphics, genetics, center, size);
        }
    }

    /**
     * Add special feature visual effects with enhanced complexity
     */
    addSpecialFeatureEffect(graphics, feature, center, genetics) {
        const colors = genetics.traits.colorGenome;
        
        // Handle both old string format and new object format
        const featureType = typeof feature === 'string' ? feature : feature.type;
        const featureIntensity = typeof feature === 'object' ? feature.intensity : 0.5;
        const featureVariant = typeof feature === 'object' ? feature.variant : 'standard';
        const featureAnimation = typeof feature === 'object' ? feature.animation : null;
        
        switch (featureType) {
            // Original features
            case 'crystal_growth':
                this.addCrystalGrowths(graphics, center, colors.accent, featureVariant, featureIntensity);
                break;
            case 'bioluminescent_spots':
                this.addBioluminescentSpots(graphics, center, colors.primary, featureVariant, featureIntensity);
                break;
            case 'shimmer_wings':
                // This would be handled in wing rendering with enhanced parameters
                break;
            case 'aurora_aura':
                this.addAuroraAura(graphics, center, [colors.primary, colors.secondary], featureVariant, featureIntensity);
                break;
            case 'constellation_markings':
                this.addConstellationMarkings(graphics, center, colors.accent, featureVariant, featureIntensity);
                break;
            case 'nebula_trail':
                this.addNebulaTrail(graphics, center, colors, featureVariant, featureIntensity);
                break;
            case 'star_dust_emanation':
                this.addStardustEmanation(graphics, center, colors.accent, featureVariant, featureIntensity);
                break;
                
            // New enhanced features
            case 'soft_glow':
                this.addSoftGlow(graphics, center, colors.primary, featureIntensity);
                break;
            case 'gentle_shimmer':
                this.addGentleShimmer(graphics, center, colors.secondary, featureIntensity);
                break;
            case 'color_shift_wings':
                // Handle in wing rendering
                break;
            case 'twinkling_eyes':
                // Handle in eye rendering
                break;
            case 'aurora_wing_tips':
                this.addAuroraWingTips(graphics, center, colors, featureIntensity);
                break;
            case 'constellation_eyes':
                // Handle in eye rendering
                break;
            case 'prismatic_scales':
                this.addPrismaticScales(graphics, center, colors, featureVariant, featureIntensity);
                break;
            case 'reality_distortion':
                this.addRealityDistortion(graphics, center, colors, featureIntensity);
                break;
            case 'cosmic_resonance':
                this.addCosmicResonance(graphics, center, colors, featureIntensity);
                break;
            case 'stellar_core':
                this.addStellarCore(graphics, center, colors.accent, featureVariant, featureIntensity);
                break;
            case 'void_wings':
                // Handle in wing rendering
                break;
            case 'time_ripples':
                this.addTimeRipples(graphics, center, colors, featureIntensity);
                break;
            case 'dimensional_shadows':
                this.addDimensionalShadows(graphics, center, featureIntensity);
                break;
        }
        
        // Store animation data for potential future use
        if (featureAnimation) {
            // Animation would be handled by Phaser tweens in the scene
            console.log(`graphics:debug [GraphicsEngine] Animation data available for ${featureType}:`, featureAnimation);
        }
    }

    /**
     * Add enhanced markings to creature based on genetic pattern
     */
    addEnhancedMarkings(graphics, center, size, markings, colorGenome) {
        if (!markings || markings.pattern === 'none' || markings.intensity === 0) {
            return;
        }
        
        const baseColor = this.calculateMarkingColor(colorGenome, markings.colorVariant);
        const alpha = markings.opacity || 0.6;
        const scale = markings.scale || 0.5;
        const intensity = markings.intensity;
        
        graphics.fillStyle(baseColor, alpha);
        
        switch (markings.pattern) {
            case 'spots':
            case 'simple_sparkles':
                this.addSimpleSpots(graphics, center, scale, intensity, markings.distribution);
                break;
            case 'stripes':
                this.addStripes(graphics, center, size, scale, intensity, markings.distribution);
                break;
            case 'sparkles':
                this.addSparkles(graphics, center, baseColor, scale, intensity);
                break;
            case 'swirls':
            case 'crescents':
                this.addSwirls(graphics, center, scale, intensity, markings.pattern);
                break;
            case 'complex_spots':
                this.addComplexSpots(graphics, center, baseColor, scale, intensity, markings.distribution);
                break;
            case 'galaxy_swirls':
                this.addGalaxySwirls(graphics, center, baseColor, scale, intensity);
                break;
            case 'constellation_dots':
                this.addConstellationDots(graphics, center, baseColor, scale, intensity);
                break;
            case 'aurora_stripes':
                this.addAuroraStripes(graphics, center, size, [colorGenome.primary, colorGenome.secondary], scale, intensity);
                break;
            case 'crystal_facets':
                this.addCrystalFacets(graphics, center, baseColor, scale, intensity);
                break;
            case 'stellar_mandala':
                this.addStellarMandala(graphics, center, baseColor, scale, intensity);
                break;
            case 'cosmic_fractals':
                this.addCosmicFractals(graphics, center, [colorGenome.primary, colorGenome.secondary], scale, intensity);
                break;
            case 'reality_rifts':
                this.addRealityRifts(graphics, center, baseColor, scale, intensity);
                break;
            case 'time_spirals':
                this.addTimeSpirals(graphics, center, baseColor, scale, intensity);
                break;
            case 'void_portals':
                this.addVoidPortals(graphics, center, baseColor, scale, intensity);
                break;
        }
        
        // Add animation hints for complex patterns
        if (markings.animation) {
            console.log(`graphics:debug [GraphicsEngine] Marking animation data for ${markings.pattern}:`, markings.animation);
        }
    }

    /**
     * Calculate marking color based on base color and variant
     */
    calculateMarkingColor(colorGenome, colorVariant) {
        const baseColor = colorGenome.primary;
        
        switch (colorVariant) {
            case 'darker':
                return this.darkenColor(baseColor, 0.3);
            case 'lighter':
                return this.lightenColor(baseColor, 0.3);
            case 'complementary':
                return this.getComplementaryColor(baseColor);
            case 'cosmic':
                // Use accent color with slight enhancement
                return this.lightenColor(colorGenome.accent, 0.1);
            default:
                return this.darkenColor(baseColor, 0.2);
        }
    }

    /**
     * Get complementary color
     */
    getComplementaryColor(color) {
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        // Simple complementary: invert the color
        const compR = 255 - r;
        const compG = 255 - g;
        const compB = 255 - b;
        
        return (compR << 16) | (compG << 8) | compB;
    }

    /**
     * Basic marking patterns
     */
    addSimpleSpots(graphics, center, scale, intensity, distribution) {
        const numSpots = Math.floor(3 + intensity * 5); // 3-8 spots
        const spreadFactor = distribution === 'clustered' ? 0.5 : 1.0;
        
        for (let i = 0; i < numSpots; i++) {
            const angle = (i / numSpots) * Math.PI * 2;
            const distance = (10 + Math.random() * 15) * scale * spreadFactor;
            const spotX = center.x + Math.cos(angle) * distance;
            const spotY = center.y + Math.sin(angle) * distance;
            const spotSize = (2 + Math.random() * 4) * scale;
            
            graphics.fillCircle(spotX, spotY, spotSize);
        }
    }

    addStripes(graphics, center, size, scale, intensity, distribution) {
        const numStripes = Math.floor(2 + intensity * 4); // 2-6 stripes
        const stripeWidth = 2 * scale;
        const spacing = (size.height / numStripes) * (distribution === 'clustered' ? 0.7 : 1.0);
        
        for (let i = 0; i < numStripes; i++) {
            const y = center.y - (size.height * 0.3) + (i * spacing);
            graphics.fillRect(center.x - (size.width * 0.3), y, size.width * 0.6, stripeWidth);
        }
    }

    addSparkles(graphics, center, baseColor, scale, intensity) {
        const numSparkles = Math.floor(5 + intensity * 10); // 5-15 sparkles
        
        for (let i = 0; i < numSparkles; i++) {
            const sparkleX = center.x + (Math.random() - 0.5) * 40 * scale;
            const sparkleY = center.y + (Math.random() - 0.5) * 50 * scale;
            const sparkleSize = (1 + Math.random() * 2) * scale;
            
            // Add star-like sparkle
            graphics.fillStyle(baseColor, 0.8);
            this.addStarShape(graphics, sparkleX, sparkleY, sparkleSize);
        }
    }

    addSwirls(graphics, center, scale, intensity, pattern) {
        const numSwirls = pattern === 'crescents' ? 2 : 3;
        
        for (let i = 0; i < numSwirls; i++) {
            const angle = (i / numSwirls) * Math.PI * 2;
            const distance = 8 * scale;
            const swirlX = center.x + Math.cos(angle) * distance;
            const swirlY = center.y + Math.sin(angle) * distance;
            
            // Create curved path for swirl
            const path = new Phaser.Curves.Path(swirlX, swirlY);
            path.splineTo([
                swirlX + 5 * scale, swirlY - 8 * scale,
                swirlX + 10 * scale, swirlY - 4 * scale,
                swirlX + 8 * scale, swirlY + 2 * scale
            ]);
            
            graphics.strokePath();
        }
    }

    /**
     * Helper method to add star shapes
     */
    addStarShape(graphics, x, y, size) {
        graphics.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const outerRadius = size;
            const innerRadius = size * 0.4;
            
            if (i === 0) {
                graphics.moveTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
            } else {
                graphics.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
            }
            
            const innerAngle = angle + Math.PI / 5;
            graphics.lineTo(x + Math.cos(innerAngle) * innerRadius, y + Math.sin(innerAngle) * innerRadius);
        }
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Add cosmic affinity-based effects
     */
    addCosmicAffinityEffects(graphics, cosmicAffinity, center) {
        const element = cosmicAffinity.element;
        const powerLevel = cosmicAffinity.powerLevel;
        
        const elementColors = {
            star: this.spaceMythicPalette.starGold,
            moon: this.spaceMythicPalette.stellarWhite,
            nebula: this.spaceMythicPalette.nebulaPink,
            crystal: this.spaceMythicPalette.crystalLilac,
            void: this.spaceMythicPalette.voidDark
        };

        const elementColor = elementColors[element] || this.spaceMythicPalette.starGold;
        
        // Add element-specific visual effects
        this.addElementalAura(graphics, center, elementColor, powerLevel);
        
        // Add power level indicators (subtle)
        if (powerLevel > 0.7) {
            this.addPowerIndicators(graphics, center, elementColor, powerLevel);
        }
    }

    /**
     * Add personality-based visual effects
     */
    addPersonalityEffects(graphics, personality, center, size) {
        const personalityEffects = {
            curious: () => this.addCuriositySparkles(graphics, center),
            playful: () => this.addPlayfulBounce(graphics, center),
            gentle: () => this.addGentleGlow(graphics, center),
            wise: () => this.addWisdomRunes(graphics, center),
            energetic: () => this.addEnergeticPulse(graphics, center)
        };

        const effect = personalityEffects[personality.core];
        if (effect) {
            effect();
        }
    }

    /**
     * Helper methods for special effects (simplified versions)
     */
    addCrystalGrowths(graphics, center, color) {
        graphics.fillStyle(color, 0.7);
        // Add small crystal-like triangular shapes
        for (let i = 0; i < 3; i++) {
            const angle = (i * 120) * Math.PI / 180;
            const x = center.x + Math.cos(angle) * 25;
            const y = center.y + Math.sin(angle) * 25;
            graphics.fillTriangle(x, y-3, x-2, y+3, x+2, y+3);
        }
    }

    addBioluminescentSpots(graphics, center, color) {
        graphics.fillStyle(color, 0.6);
        for (let i = 0; i < 5; i++) {
            const x = center.x + (Math.random() - 0.5) * 40;
            const y = center.y + (Math.random() - 0.5) * 50;
            graphics.fillCircle(x, y, 2);
        }
    }

    addAuroraAura(graphics, center, colors) {
        // Create flowing aurora-like effect
        graphics.fillGradientStyle(
            colors[0], colors[1], colors[0], colors[1],
            0.3, 0.1, 0.3, 0.1
        );
        graphics.fillEllipse(center.x, center.y, 80, 60);
    }

    addConstellationMarkings(graphics, center, color) {
        graphics.fillStyle(color, 0.8);
        // Create constellation pattern
        const stars = [
            {x: -10, y: -15}, {x: -5, y: -8}, {x: 5, y: -12},
            {x: 12, y: -5}, {x: 8, y: 8}, {x: -8, y: 12}
        ];
        
        stars.forEach(star => {
            const x = center.x + star.x;
            const y = center.y + star.y;
            this.drawStar(graphics, x, y, 4, 1, 3);
        });
    }

    addElementalAura(graphics, center, color, powerLevel) {
        const intensity = powerLevel * 0.4;
        const radius = 40 + (powerLevel * 20);
        
        graphics.fillStyle(color, intensity);
        graphics.fillCircle(center.x, center.y, radius);
    }

    addLegendaryEffects(graphics, genetics, center, size) {
        // Extra sparkles for legendary creatures
        this.addStellarSparkles(graphics, size, {
            count: 8,
            colors: [
                genetics.traits.colorGenome.primary,
                genetics.traits.colorGenome.secondary,
                genetics.traits.colorGenome.accent
            ]
        });
    }

    // Personality effect methods (simplified)
    addCuriositySparkles(graphics, center) {
        graphics.fillStyle(this.spaceMythicPalette.starGold, 0.6);
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const x = center.x + Math.cos(angle) * 20;
            const y = center.y + Math.sin(angle) * 20;
            this.drawStar(graphics, x, y, 4, 1, 2);
        }
    }

    addGentleGlow(graphics, center) {
        graphics.fillStyle(this.spaceMythicPalette.crystalLilac, 0.2);
        graphics.fillCircle(center.x, center.y, 50);
    }

    addWisdomRunes(graphics, center) {
        graphics.lineStyle(1, this.spaceMythicPalette.stellarWhite, 0.5);
        graphics.strokeCircle(center.x, center.y - 10, 8);
        graphics.strokeCircle(center.x - 8, center.y + 5, 6);
        graphics.strokeCircle(center.x + 8, center.y + 5, 6);
    }

    addEnergeticPulse(graphics, center) {
        for (let i = 0; i < 3; i++) {
            const radius = 15 + (i * 10);
            graphics.lineStyle(2, this.spaceMythicPalette.starGold, 0.3 - (i * 0.1));
            graphics.strokeCircle(center.x, center.y, radius);
        }
    }

    // Additional utility methods
    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.floor(r1 * (1 - ratio) + r2 * ratio);
        const g = Math.floor(g1 * (1 - ratio) + g2 * ratio);
        const b = Math.floor(b1 * (1 - ratio) + b2 * ratio);
        
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Add cosmic aura effect around a creature
     */
    addCosmicAura(graphics, center, options = {}) {
        const {
            innerColor = this.spaceMythicPalette.starGold,
            outerColor = this.spaceMythicPalette.crystalLilac,
            intensity = 0.3
        } = options;

        // Create gradient aura effect
        graphics.fillGradientStyle(
            innerColor, innerColor, outerColor, outerColor,
            intensity, intensity * 0.7, intensity * 0.3, intensity * 0.1
        );
        graphics.fillCircle(center.x, center.y, 45); // Outer aura
        
        graphics.fillGradientStyle(
            innerColor, innerColor, innerColor, innerColor,
            intensity * 0.6, intensity * 0.6, intensity * 0.2, intensity * 0.2
        );
        graphics.fillCircle(center.x, center.y, 35); // Inner aura
    }

    /**
     * Add stellar sparkles around creature
     */
    addStellarSparkles(graphics, size, options = {}) {
        const {
            count = 5,
            colors = [this.spaceMythicPalette.stellarWhite]
        } = options;

        for (let i = 0; i < count; i++) {
            const angle = (360 / count) * i;
            const radius = 25 + Math.random() * 15;
            const x = size.width / 2 + Math.cos(Phaser.Math.DegToRad(angle)) * radius;
            const y = size.height / 2 + Math.sin(Phaser.Math.DegToRad(angle)) * radius;
            const sparkleSize = 1 + Math.random() * 2;
            const color = colors[Math.floor(Math.random() * colors.length)];

            graphics.fillStyle(color, 0.8);
            this.drawStar(graphics, x, y, 4, sparkleSize, sparkleSize * 2);
        }
    }

    /**
     * Apply Space-Mythic environmental tinting based on biome
     * @param {Phaser.GameObjects.Sprite} sprite - Target sprite  
     * @param {string} biome - Biome type (spaceCrashSite, etc.)
     * @param {Object} options - Tinting options
     */
    applyBiomeTint(sprite, biome = 'spaceCrashSite', options = {}) {
        if (!this.isSpaceMythicMode || !sprite || !sprite.setTint) {
            return; // Non-breaking: do nothing if not supported
        }

        const biomeTints = {
            spaceCrashSite: {
                ambient: this.spaceMythicPalette.crystalLilac,
                accent: this.spaceMythicPalette.auroraTeal,
                intensity: 0.4
            },
            crystalForest: {
                ambient: this.spaceMythicPalette.cosmicGreen,
                accent: this.spaceMythicPalette.stellarWhite,
                intensity: 0.5
            },
            nebulaField: {
                ambient: this.spaceMythicPalette.nebulaPink,
                accent: this.spaceMythicPalette.cometBlue,
                intensity: 0.3
            }
        };

        const tintConfig = biomeTints[biome] || biomeTints.spaceCrashSite;
        const { subtle = true, duration = 8000 } = options;

        if (subtle && this.scene.tweens) {
            // Subtle breathing effect
            this.scene.tweens.add({
                targets: sprite,
                tint: tintConfig.accent,
                duration: duration,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                alpha: tintConfig.intensity
            });
        } else {
            sprite.setTint(tintConfig.ambient);
        }
    }

    /**
     * Get Space-Mythic color palette
     * @returns {Object} Color palette for external use
     */
    getSpaceMythicPalette() {
        return { ...this.spaceMythicPalette }; // Return copy to prevent mutation
    }
}

// Export for use in scenes
window.GraphicsEngine = GraphicsEngine;

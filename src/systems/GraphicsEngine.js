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
     * Create a scratch graphics instance that never flashes on screen while generating textures.
     */
    createScratchGraphics() {
        if (this.scene && this.scene.make && typeof this.scene.make.graphics === 'function') {
            return this.scene.make.graphics({ x: 0, y: 0, add: false });
        }

        const graphics = this.scene.add.graphics({ x: -1000, y: -1000 });
        graphics.setVisible(false);
        return graphics;
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
     * Safely translate the drawing context, falling back when Phaser-specific helpers are unavailable.
     * Returns an object with the center shift that should be applied manually when translation is not supported.
     */
    safeGraphicsTranslate(graphics, padding = { x: 0, y: 0 }) {
        const safePadding = {
            x: padding?.x || 0,
            y: padding?.y || 0
        };

        const result = {
            centerShift: { x: 0, y: 0 },
            restore: () => {}
        };

        if (!graphics) {
            return result;
        }

        let saved = false;
        if (typeof graphics.save === 'function') {
            graphics.save();
            saved = true;
        }

        if (typeof graphics.translateCanvas === 'function') {
            graphics.translateCanvas(safePadding.x, safePadding.y);
        } else {
            result.centerShift.x = safePadding.x;
            result.centerShift.y = safePadding.y;
        }

        result.restore = () => {
            if (saved && typeof graphics.restore === 'function') {
                graphics.restore();
            }
        };

        return result;
    }

    /**
     * Create enhanced creature sprites with realistic depth and lighting
     */
    createEnhancedCreature(bodyColor = 0x9370DB, headColor = 0xDDA0DD, wingColor = 0x8A2BE2, frame = 0, geneticTraits = null) {
        const baseSize = { width: 60, height: 80 };
        const baseCenter = { x: baseSize.width / 2, y: baseSize.height / 2 };
        const metrics = this.getCreatureCanvasMetrics(geneticTraits, baseSize);

        const graphics = this.createScratchGraphics();
        const translation = this.safeGraphicsTranslate(graphics, metrics.padding);

        const center = {
            x: baseCenter.x + translation.centerShift.x,
            y: baseCenter.y + translation.centerShift.y
        };

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

        translation.restore();

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
        const bodyType = this.currentBodyType || 'balanced';
        console.log(`graphics:debug [GraphicsEngine] Rendering body type: ${bodyType}`, { bodyScale, bodyOffset });
        this.renderBodyByType(graphics, center, bodyOffset, bodyScale, modifiedBodyColor, bodyType);

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
        const graphics = this.createScratchGraphics();
        const center = { x: 30, y: 50 };

        // === COSMIC CRYSTAL TREE ===
        // Replace earth trees with crystalline cosmic structures

        // Shadow at base
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillEllipse(center.x + 2, center.y + 22, 30 * scale, 15 * scale);

        // Crystal trunk - multifaceted
        const trunkColors = {
            summer: { base: 0x4A148C, mid: 0x7B1FA2, light: 0x9C27B0 },  // Purple crystal
            spring: { base: 0x1976D2, mid: 0x2196F3, light: 0x64B5F6 },  // Blue crystal
            autumn: { base: 0xE65100, mid: 0xFF6F00, light: 0xFF9800 }   // Orange crystal
        };

        const colors = trunkColors[season] || trunkColors.summer;

        // Trunk base (dark facet)
        graphics.fillStyle(colors.base);
        graphics.beginPath();
        graphics.moveTo(center.x - 8, center.y + 20);
        graphics.lineTo(center.x + 8, center.y + 20);
        graphics.lineTo(center.x + 6, center.y - 20);
        graphics.lineTo(center.x - 6, center.y - 20);
        graphics.closePath();
        graphics.fillPath();

        // Mid facet
        graphics.fillStyle(colors.mid);
        graphics.beginPath();
        graphics.moveTo(center.x - 6, center.y + 20);
        graphics.lineTo(center.x, center.y + 20);
        graphics.lineTo(center.x, center.y - 20);
        graphics.lineTo(center.x - 6, center.y - 20);
        graphics.closePath();
        graphics.fillPath();

        // Light facet (reflection)
        graphics.fillStyle(colors.light);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y + 20);
        graphics.lineTo(center.x + 6, center.y + 20);
        graphics.lineTo(center.x + 4, center.y - 20);
        graphics.lineTo(center.x, center.y - 20);
        graphics.closePath();
        graphics.fillPath();

        // === CRYSTAL CROWN (instead of leaves) ===
        // Multiple floating crystals orbiting the top
        const crystalCount = 8;
        for (let i = 0; i < crystalCount; i++) {
            const angle = (i / crystalCount) * Math.PI * 2;
            const orbitRadius = 18 + Math.sin(i * 0.5) * 5;
            const crystalX = center.x + Math.cos(angle) * orbitRadius;
            const crystalY = center.y - 32 + Math.sin(angle) * orbitRadius * 0.5;

            // Crystal shard
            graphics.fillStyle(this.lightenColor(colors.mid, 0.3), 0.8);
            graphics.beginPath();
            graphics.moveTo(crystalX, crystalY - 6);
            graphics.lineTo(crystalX - 3, crystalY + 3);
            graphics.lineTo(crystalX + 3, crystalY + 3);
            graphics.closePath();
            graphics.fillPath();

            // Crystal glow
            graphics.fillStyle(this.lightenColor(colors.light, 0.5), 0.4);
            graphics.fillCircle(crystalX, crystalY, 5);
        }

        // Central crystal cluster
        graphics.fillStyle(colors.light, 0.9);
        graphics.fillCircle(center.x, center.y - 35, 12 * scale);
        graphics.fillStyle(this.lightenColor(colors.light, 0.6), 0.6);
        graphics.fillCircle(center.x - 2, center.y - 37, 8 * scale);

        // Energy particles rising
        for (let i = 0; i < 5; i++) {
            const px = center.x + (Math.random() - 0.5) * 20;
            const py = center.y - 15 - Math.random() * 30;
            graphics.fillStyle(colors.light, 0.6);
            graphics.fillCircle(px, py, 1.5);
        }

        return this.finalizeTexture(graphics, `enhancedTree_${season}`, 60, 80);
    }

    /**
     * Create cosmic asteroid/space rock with crystal veins and energy
     */
    createEnhancedRock(scale = 1.0, mossiness = 0.3) {
        const graphics = this.createScratchGraphics();
        const center = { x: 25, y: 25 };

        // === COSMIC ASTEROID ===

        // Floating shadow (lighter since it's floating)
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 2, center.y + 18, 35 * scale, 18 * scale);

        // Asteroid type based on mossiness parameter (now represents crystal density)
        const crystalDensity = mossiness; // 0-1 range
        const asteroidTypes = [
            { base: 0x4A4A4A, mid: 0x696969, light: 0x8A8A8A, crystal: 0x64B5F6 },  // Gray with blue crystals
            { base: 0x5D4E37, mid: 0x8B7355, light: 0xA0826D, crystal: 0xE91E63 },  // Brown with pink crystals
            { base: 0x2F2F4F, mid: 0x4A4A6A, light: 0x6A6A8A, crystal: 0x9C27B0 }   // Dark blue with purple crystals
        ];
        const type = asteroidTypes[Math.floor(mossiness * asteroidTypes.length)] || asteroidTypes[0];

        // Irregular asteroid shape with facets
        const facets = 6 + Math.floor(Math.random() * 3);
        const points = [];
        for (let i = 0; i < facets; i++) {
            const angle = (i / facets) * Math.PI * 2;
            const radiusVariation = 0.7 + Math.random() * 0.5;
            const radius = 18 * scale * radiusVariation;
            points.push({
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius * 0.8  // Slightly flattened
            });
        }

        // Draw asteroid body layers
        graphics.fillStyle(type.base);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.fillPath();

        // Mid-tone facets
        graphics.fillStyle(type.mid);
        for (let i = 0; i < points.length; i += 2) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];
            graphics.beginPath();
            graphics.moveTo(center.x, center.y);
            graphics.lineTo(p1.x, p1.y);
            graphics.lineTo(p2.x, p2.y);
            graphics.closePath();
            graphics.fillPath();
        }

        // Highlight facets (catching starlight)
        graphics.fillStyle(type.light);
        for (let i = 0; i < 3; i++) {
            const p = points[i * 2];
            graphics.fillCircle(p.x - 2, p.y - 2, 4 + Math.random() * 3);
        }

        // === CRYSTAL VEINS (BASED ON DENSITY) ===

        if (crystalDensity > 0) {
            const veinCount = Math.floor(crystalDensity * 8);

            for (let i = 0; i < veinCount; i++) {
                const startAngle = Math.random() * Math.PI * 2;
                const startRadius = Math.random() * 12;
                const veinLength = 5 + Math.random() * 10;

                const startX = center.x + Math.cos(startAngle) * startRadius;
                const startY = center.y + Math.sin(startAngle) * startRadius * 0.8;
                const endX = startX + (Math.random() - 0.5) * veinLength;
                const endY = startY + (Math.random() - 0.5) * veinLength;

                // Crystal vein glow
                graphics.lineStyle(2, type.crystal, 0.6);
                graphics.beginPath();
                graphics.moveTo(startX, startY);
                graphics.lineTo(endX, endY);
                graphics.strokePath();

                // Brighter core
                graphics.lineStyle(1, this.lightenColor(type.crystal, 0.4), 0.8);
                graphics.beginPath();
                graphics.moveTo(startX, startY);
                graphics.lineTo(endX, endY);
                graphics.strokePath();
            }

            // Embedded crystals at high density
            if (crystalDensity > 0.5) {
                for (let i = 0; i < 3; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 10;
                    const cx = center.x + Math.cos(angle) * radius;
                    const cy = center.y + Math.sin(angle) * radius * 0.8;

                    // Crystal shard
                    graphics.fillStyle(type.crystal, 0.7);
                    graphics.beginPath();
                    graphics.moveTo(cx, cy - 4);
                    graphics.lineTo(cx - 2, cy + 2);
                    graphics.lineTo(cx + 2, cy + 2);
                    graphics.closePath();
                    graphics.fillPath();

                    // Crystal glow
                    graphics.fillStyle(this.lightenColor(type.crystal, 0.5), 0.3);
                    graphics.fillCircle(cx, cy, 5);
                }
            }
        }

        // === IMPACT CRATERS ===

        for (let i = 0; i < 2; i++) {
            const craterX = center.x - 8 + Math.random() * 16;
            const craterY = center.y - 6 + Math.random() * 12;
            const craterSize = 2 + Math.random() * 4;

            graphics.fillStyle(this.darkenColor(type.base, 0.3), 0.7);
            graphics.fillCircle(craterX, craterY, craterSize);

            // Crater rim highlight
            graphics.lineStyle(1, type.light, 0.5);
            graphics.strokeCircle(craterX - 0.5, craterY - 0.5, craterSize);
        }

        // === ENERGY PARTICLES (for high crystal density) ===

        if (crystalDensity > 0.7) {
            for (let i = 0; i < 3; i++) {
                const px = center.x + (Math.random() - 0.5) * 25;
                const py = center.y - 10 - Math.random() * 15;
                graphics.fillStyle(type.crystal, 0.6);
                graphics.fillCircle(px, py, 1.5);
            }
        }

        return this.finalizeTexture(graphics, `enhancedRock_${Math.floor(mossiness * 10)}`, 50, 50);
    }

    /**
     * Create cosmic star flower with glowing energy petals
     */
    createEnhancedFlower(petalColor = 0xFF69B4, centerColor = 0xFFD700, scale = 1.0) {
        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 25 };

        // === COSMIC STAR FLOWER ===

        // Energy stem (glowing tendril)
        const stemSegments = 8;
        for (let i = 0; i < stemSegments; i++) {
            const y = center.y + 8 + (i * 2);
            const wobble = Math.sin(i * 0.5) * 1.5;
            const x = center.x + wobble;
            const segmentAlpha = 0.7 - (i / stemSegments) * 0.3;

            // Stem glow
            graphics.fillStyle(petalColor, segmentAlpha * 0.3);
            graphics.fillCircle(x, y, 3);

            // Stem core
            graphics.fillStyle(this.lightenColor(petalColor, 0.5), segmentAlpha);
            graphics.fillCircle(x, y, 1.5);
        }

        // Floating energy leaves
        const leafPositions = [
            { x: center.x - 10, y: center.y + 12, angle: -0.4 },
            { x: center.x + 10, y: center.y + 15, angle: 0.4 }
        ];

        leafPositions.forEach(leaf => {
            // Leaf glow aura
            graphics.fillStyle(centerColor, 0.2);
            graphics.fillCircle(leaf.x, leaf.y, 8);

            // Leaf diamond shape (energy crystal)
            graphics.fillStyle(centerColor, 0.7);
            graphics.beginPath();
            graphics.moveTo(leaf.x, leaf.y - 5);
            graphics.lineTo(leaf.x + 3, leaf.y);
            graphics.lineTo(leaf.x, leaf.y + 5);
            graphics.lineTo(leaf.x - 3, leaf.y);
            graphics.closePath();
            graphics.fillPath();

            // Leaf highlight
            graphics.fillStyle(this.lightenColor(centerColor, 0.5), 0.8);
            graphics.beginPath();
            graphics.moveTo(leaf.x, leaf.y - 3);
            graphics.lineTo(leaf.x + 2, leaf.y);
            graphics.lineTo(leaf.x, leaf.y + 1);
            graphics.lineTo(leaf.x - 1, leaf.y);
            graphics.closePath();
            graphics.fillPath();
        });

        // === STAR-SHAPED ENERGY PETALS ===

        const petalCount = 5; // 5-pointed star
        const petalHighlight = this.lightenColor(petalColor, 0.4);

        // Outer glow
        graphics.fillStyle(petalColor, 0.15);
        graphics.fillCircle(center.x, center.y, 16 * scale);

        // Star points (outer layer)
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
            const pointDistance = 12;
            const pointX = center.x + Math.cos(angle) * pointDistance;
            const pointY = center.y + Math.sin(angle) * pointDistance;

            const nextAngle = ((i + 1) / petalCount) * Math.PI * 2 - Math.PI / 2;
            const innerAngle = angle + (Math.PI / petalCount);
            const innerDistance = 5;
            const innerX = center.x + Math.cos(innerAngle) * innerDistance;
            const innerY = center.y + Math.sin(innerAngle) * innerDistance;

            // Petal glow trail
            graphics.fillStyle(petalColor, 0.4);
            graphics.beginPath();
            graphics.moveTo(center.x, center.y);
            graphics.lineTo(pointX + 1, pointY + 1);
            graphics.lineTo(innerX, innerY);
            graphics.closePath();
            graphics.fillPath();

            // Main petal triangle
            graphics.fillStyle(petalColor, 0.85);
            graphics.beginPath();
            graphics.moveTo(center.x, center.y);
            graphics.lineTo(pointX, pointY);
            graphics.lineTo(innerX, innerY);
            graphics.closePath();
            graphics.fillPath();

            // Petal highlight edge
            graphics.lineStyle(1.5, petalHighlight, 0.9);
            graphics.beginPath();
            graphics.moveTo(center.x, center.y);
            graphics.lineTo(pointX, pointY);
            graphics.strokePath();

            // Energy sparkle at tip
            graphics.fillStyle(0xFFFFFF, 0.9);
            graphics.fillCircle(pointX, pointY, 1.5);

            graphics.fillStyle(petalHighlight, 0.6);
            graphics.fillCircle(pointX, pointY, 3);
        }

        // === RADIANT CORE ===

        // Core shadow (depth)
        graphics.fillStyle(this.darkenColor(centerColor, 0.5), 0.6);
        graphics.fillCircle(center.x + 0.5, center.y + 0.5, 5 * scale);

        // Core base
        graphics.fillStyle(centerColor, 0.95);
        graphics.fillCircle(center.x, center.y, 5 * scale);

        // Core mid-glow
        graphics.fillStyle(this.lightenColor(centerColor, 0.3), 0.85);
        graphics.fillCircle(center.x, center.y, 3.5 * scale);

        // Core bright center
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(center.x - 0.5, center.y - 0.5, 2 * scale);

        // Orbiting energy particles
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const orbitRadius = 6;
            const px = center.x + Math.cos(angle) * orbitRadius;
            const py = center.y + Math.sin(angle) * orbitRadius;

            graphics.fillStyle(this.lightenColor(petalColor, 0.5), 0.7);
            graphics.fillCircle(px, py, 1);

            graphics.fillStyle(0xFFFFFF, 0.5);
            graphics.fillCircle(px, py, 0.5);
        }

        // Rising energy motes
        for (let i = 0; i < 3; i++) {
            const mx = center.x + (Math.random() - 0.5) * 10;
            const my = center.y - 8 - Math.random() * 8;
            graphics.fillStyle(petalHighlight, 0.6);
            graphics.fillCircle(mx, my, 1);
        }

        return this.finalizeTexture(graphics, `enhancedFlower`, 40, 50);
    }

    /**
     * Create advanced magical sparkle effects
     */
    createMagicalSparkle(color = 0xFFD700, size = 1.0) {
        const graphics = this.createScratchGraphics();
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

        const graphics = this.createScratchGraphics();
        const translation = this.safeGraphicsTranslate(graphics, metrics.padding);

        const center = {
            x: metrics.baseCenter.x + translation.centerShift.x,
            y: metrics.baseCenter.y + translation.centerShift.y
        };

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

        translation.restore();

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

        const graphics = this.createScratchGraphics();
        const translation = this.safeGraphicsTranslate(graphics, metrics.padding);

        const center = {
            x: metrics.baseCenter.x + translation.centerShift.x,
            y: metrics.baseCenter.y + translation.centerShift.y
        };

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

        translation.restore();

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
            case 'avian':
                this.renderAvianBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'quadruped':
                this.renderQuadrupedBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'blob':
                this.renderBlobBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'reptilian':
                this.renderReptilianBody(graphics, center, bodyOffset, bodyScale, bodyColor);
                break;
            case 'insectoid':
                this.renderInsectoidBody(graphics, center, bodyOffset, bodyScale, bodyColor);
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
     * Render avian (bird-like) body with chest and feathered details
     */
    renderAvianBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 25, 30, 38);

        // Prominent chest (birds have pronounced chests)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 8 + bodyOffset.y, 36 * scale.x, 38 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 2 + bodyOffset.x, center.y + 5 + bodyOffset.y, 32 * scale.x, 35 * scale.y);

        // Chest highlight (bright plumage)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.4), 0.85);
        graphics.fillEllipse(center.x - 5 + bodyOffset.x, center.y + 2 + bodyOffset.y, 22 * scale.x, 25 * scale.y);

        // Breast shine (soft feathers)
        graphics.fillStyle(0xFFFFFF, 0.35);
        graphics.fillEllipse(center.x - 7 + bodyOffset.x, center.y + 0 + bodyOffset.y, 14 * scale.x, 18 * scale.y);

        // Tapered lower body (slim waist to legs)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.3));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 22 + bodyOffset.y, 22 * scale.x, 26 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 1 + bodyOffset.x, center.y + 20 + bodyOffset.y, 18 * scale.x, 24 * scale.y);

        // Tail feathers (fan shape)
        const tailBaseX = center.x + bodyOffset.x;
        const tailBaseY = center.y + 38 + bodyOffset.y;

        // Three tail feathers for depth
        for (let i = -1; i <= 1; i++) {
            graphics.fillStyle(this.darkenColor(bodyColor, 0.2 + Math.abs(i) * 0.1), 0.8);
            graphics.beginPath();
            graphics.moveTo(tailBaseX, tailBaseY);
            graphics.lineTo(tailBaseX + (i * 6) - 4, tailBaseY + 12);
            graphics.lineTo(tailBaseX + (i * 6) + 4, tailBaseY + 12);
            graphics.closePath();
            graphics.fillPath();
        }

        // Wing indication (folded wings on sides)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.2), 0.7);
        // Left wing fold
        graphics.fillEllipse(center.x - 14 + bodyOffset.x, center.y + 12 + bodyOffset.y, 8 * scale.x, 20 * scale.y);
        // Right wing fold
        graphics.fillEllipse(center.x + 14 + bodyOffset.x, center.y + 12 + bodyOffset.y, 8 * scale.x, 20 * scale.y);

        // Wing details (feather lines)
        graphics.lineStyle(1, this.darkenColor(bodyColor, 0.3), 0.4);
        // Left wing feathers
        for (let i = 0; i < 3; i++) {
            graphics.beginPath();
            graphics.moveTo(center.x - 14 + bodyOffset.x, center.y + 8 + (i * 6) + bodyOffset.y);
            graphics.lineTo(center.x - 18 + bodyOffset.x, center.y + 10 + (i * 6) + bodyOffset.y);
            graphics.strokePath();
        }
        // Right wing feathers
        for (let i = 0; i < 3; i++) {
            graphics.beginPath();
            graphics.moveTo(center.x + 14 + bodyOffset.x, center.y + 8 + (i * 6) + bodyOffset.y);
            graphics.lineTo(center.x + 18 + bodyOffset.x, center.y + 10 + (i * 6) + bodyOffset.y);
            graphics.strokePath();
        }
    }

    /**
     * Render quadruped (four-legged) body - feline/canine style
     */
    renderQuadrupedBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 30, 40, 20);

        // Main body (horizontal orientation)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 10 + bodyOffset.y, 42 * scale.x, 28 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 2 + bodyOffset.x, center.y + 8 + bodyOffset.y, 38 * scale.x, 25 * scale.y);

        // Body highlight
        graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.8);
        graphics.fillEllipse(center.x - 6 + bodyOffset.x, center.y + 5 + bodyOffset.y, 28 * scale.x, 18 * scale.y);

        // Spine shine
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillEllipse(center.x - 8 + bodyOffset.x, center.y + 3 + bodyOffset.y, 20 * scale.x, 12 * scale.y);

        // Four legs (simple pillars)
        const legColor = this.darkenColor(bodyColor, 0.2);
        const legWidth = 6 * scale.x;
        const legHeight = 18 * scale.y;

        // Front left leg
        graphics.fillStyle(legColor);
        graphics.fillRect(center.x - 12 + bodyOffset.x, center.y + 20 + bodyOffset.y, legWidth, legHeight);
        // Front right leg
        graphics.fillRect(center.x + 6 + bodyOffset.x, center.y + 20 + bodyOffset.y, legWidth, legHeight);
        // Back left leg
        graphics.fillRect(center.x - 16 + bodyOffset.x, center.y + 18 + bodyOffset.y, legWidth, legHeight);
        // Back right leg
        graphics.fillRect(center.x + 10 + bodyOffset.x, center.y + 18 + bodyOffset.y, legWidth, legHeight);

        // Paws (small circles at leg ends)
        const pawColor = this.darkenColor(bodyColor, 0.3);
        graphics.fillStyle(pawColor);
        graphics.fillCircle(center.x - 9 + bodyOffset.x, center.y + 38 + bodyOffset.y, 4 * scale.x);
        graphics.fillCircle(center.x + 9 + bodyOffset.x, center.y + 38 + bodyOffset.y, 4 * scale.x);
        graphics.fillCircle(center.x - 13 + bodyOffset.x, center.y + 36 + bodyOffset.y, 4 * scale.x);
        graphics.fillCircle(center.x + 13 + bodyOffset.x, center.y + 36 + bodyOffset.y, 4 * scale.x);

        // Tail (curved)
        graphics.fillStyle(bodyColor);
        graphics.beginPath();
        graphics.moveTo(center.x + 18 + bodyOffset.x, center.y + 10 + bodyOffset.y);
        graphics.lineTo(center.x + 24 + bodyOffset.x, center.y + 5 + bodyOffset.y);
        graphics.lineTo(center.x + 26 + bodyOffset.x, center.y + 12 + bodyOffset.y);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Render blob/slime body - amorphous and fluid
     */
    renderBlobBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);

        // Shadow (wider for blob)
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 4, center.y + 28, 45, 35);

        // Main blob body (very round)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.3));
        graphics.fillCircle(center.x + bodyOffset.x, center.y + 15 + bodyOffset.y, 26 * Math.max(scale.x, scale.y));

        graphics.fillStyle(bodyColor, 0.85); // Slightly transparent for gooey effect
        graphics.fillCircle(center.x - 2 + bodyOffset.x, center.y + 13 + bodyOffset.y, 24 * Math.max(scale.x, scale.y));

        // Translucent highlight (gooey shine)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.4), 0.6);
        graphics.fillCircle(center.x - 8 + bodyOffset.x, center.y + 8 + bodyOffset.y, 16 * Math.max(scale.x, scale.y));

        // Multiple shine spots (gooey bubbles)
        graphics.fillStyle(0xFFFFFF, 0.5);
        graphics.fillCircle(center.x - 10 + bodyOffset.x, center.y + 5 + bodyOffset.y, 8);
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillCircle(center.x + 4 + bodyOffset.x, center.y + 10 + bodyOffset.y, 6);
        graphics.fillCircle(center.x - 4 + bodyOffset.x, center.y + 18 + bodyOffset.y, 5);

        // Drip effect (hanging blob at bottom)
        graphics.fillStyle(bodyColor, 0.7);
        graphics.beginPath();
        graphics.moveTo(center.x + bodyOffset.x, center.y + 30 + bodyOffset.y);
        graphics.lineTo(center.x - 3 + bodyOffset.x, center.y + 36 + bodyOffset.y);
        graphics.lineTo(center.x + 3 + bodyOffset.x, center.y + 36 + bodyOffset.y);
        graphics.closePath();
        graphics.fillPath();

        // Puddle base
        graphics.fillStyle(bodyColor, 0.4);
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 32 + bodyOffset.y, 30 * scale.x, 8 * scale.y);
    }

    /**
     * Render reptilian body - scaled with ridges
     */
    renderReptilianBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 2, center.y + 25, 30, 48);

        // Main body (elongated like serpentine but thicker)
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 12 + bodyOffset.y, 32 * scale.x, 50 * scale.y);

        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 1 + bodyOffset.x, center.y + 10 + bodyOffset.y, 28 * scale.x, 46 * scale.y);

        // Body highlight
        graphics.fillStyle(this.lightenColor(bodyColor, 0.3), 0.8);
        graphics.fillEllipse(center.x - 4 + bodyOffset.x, center.y + 7 + bodyOffset.y, 18 * scale.x, 32 * scale.y);

        // Scaled texture (diamond pattern)
        const scaleColor = this.darkenColor(bodyColor, 0.15);
        graphics.lineStyle(1, scaleColor, 0.6);
        for (let i = 0; i < 5; i++) {
            const yOffset = center.y + 5 + (i * 8) + bodyOffset.y;
            graphics.beginPath();
            graphics.moveTo(center.x - 8 + bodyOffset.x, yOffset);
            graphics.lineTo(center.x + 8 + bodyOffset.x, yOffset);
            graphics.strokePath();
        }

        // Spinal ridges
        graphics.fillStyle(this.lightenColor(bodyColor, 0.2), 0.7);
        for (let i = 0; i < 4; i++) {
            const ridgeY = center.y + (i * 10) + bodyOffset.y;
            graphics.beginPath();
            graphics.moveTo(center.x - 12 + bodyOffset.x, ridgeY);
            graphics.lineTo(center.x - 10 + bodyOffset.x, ridgeY - 3);
            graphics.lineTo(center.x - 8 + bodyOffset.x, ridgeY);
            graphics.closePath();
            graphics.fillPath();
        }

        // Forked tongue (small detail)
        graphics.lineStyle(2, 0xFF6B6B, 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x + bodyOffset.x, center.y - 8 + bodyOffset.y);
        graphics.lineTo(center.x - 2 + bodyOffset.x, center.y - 12 + bodyOffset.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(center.x + bodyOffset.x, center.y - 8 + bodyOffset.y);
        graphics.lineTo(center.x + 2 + bodyOffset.x, center.y - 12 + bodyOffset.y);
        graphics.strokePath();
    }

    /**
     * Render insectoid body - segmented with antennae
     */
    renderInsectoidBody(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(center.x + 3, center.y + 28, 34, 42);

        // Head segment
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillCircle(center.x + bodyOffset.x, center.y - 5 + bodyOffset.y, 10 * Math.max(scale.x, scale.y));
        graphics.fillStyle(bodyColor);
        graphics.fillCircle(center.x - 1 + bodyOffset.x, center.y - 6 + bodyOffset.y, 9 * Math.max(scale.x, scale.y));

        // Thorax segment
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 8 + bodyOffset.y, 16 * scale.x, 20 * scale.y);
        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 1 + bodyOffset.x, center.y + 7 + bodyOffset.y, 14 * scale.x, 18 * scale.y);

        // Abdomen segment
        graphics.fillStyle(this.darkenColor(bodyColor, 0.4));
        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 26 + bodyOffset.y, 14 * scale.x, 22 * scale.y);
        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 1 + bodyOffset.x, center.y + 25 + bodyOffset.y, 12 * scale.x, 20 * scale.y);

        // Segment lines (showing separation)
        graphics.lineStyle(1, this.darkenColor(bodyColor, 0.5), 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x - 10 + bodyOffset.x, center.y + 18 + bodyOffset.y);
        graphics.lineTo(center.x + 10 + bodyOffset.x, center.y + 18 + bodyOffset.y);
        graphics.strokePath();

        // Six legs (three pairs)
        const legColor = this.darkenColor(bodyColor, 0.2);
        graphics.lineStyle(2, legColor, 0.9);
        // Front pair
        graphics.beginPath();
        graphics.moveTo(center.x - 12 + bodyOffset.x, center.y + 5 + bodyOffset.y);
        graphics.lineTo(center.x - 18 + bodyOffset.x, center.y + 15 + bodyOffset.y);
        graphics.lineTo(center.x - 16 + bodyOffset.x, center.y + 25 + bodyOffset.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(center.x + 12 + bodyOffset.x, center.y + 5 + bodyOffset.y);
        graphics.lineTo(center.x + 18 + bodyOffset.x, center.y + 15 + bodyOffset.y);
        graphics.lineTo(center.x + 16 + bodyOffset.x, center.y + 25 + bodyOffset.y);
        graphics.strokePath();

        // Middle pair
        graphics.beginPath();
        graphics.moveTo(center.x - 12 + bodyOffset.x, center.y + 12 + bodyOffset.y);
        graphics.lineTo(center.x - 20 + bodyOffset.x, center.y + 20 + bodyOffset.y);
        graphics.lineTo(center.x - 18 + bodyOffset.x, center.y + 30 + bodyOffset.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(center.x + 12 + bodyOffset.x, center.y + 12 + bodyOffset.y);
        graphics.lineTo(center.x + 20 + bodyOffset.x, center.y + 20 + bodyOffset.y);
        graphics.lineTo(center.x + 18 + bodyOffset.x, center.y + 30 + bodyOffset.y);
        graphics.strokePath();

        // Back pair
        graphics.beginPath();
        graphics.moveTo(center.x - 10 + bodyOffset.x, center.y + 20 + bodyOffset.y);
        graphics.lineTo(center.x - 16 + bodyOffset.x, center.y + 28 + bodyOffset.y);
        graphics.lineTo(center.x - 14 + bodyOffset.x, center.y + 36 + bodyOffset.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(center.x + 10 + bodyOffset.x, center.y + 20 + bodyOffset.y);
        graphics.lineTo(center.x + 16 + bodyOffset.x, center.y + 28 + bodyOffset.y);
        graphics.lineTo(center.x + 14 + bodyOffset.x, center.y + 36 + bodyOffset.y);
        graphics.strokePath();

        // Antennae
        graphics.lineStyle(2, this.lightenColor(bodyColor, 0.2), 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x - 4 + bodyOffset.x, center.y - 10 + bodyOffset.y);
        graphics.lineTo(center.x - 8 + bodyOffset.x, center.y - 18 + bodyOffset.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(center.x + 4 + bodyOffset.x, center.y - 10 + bodyOffset.y);
        graphics.lineTo(center.x + 8 + bodyOffset.x, center.y - 18 + bodyOffset.y);
        graphics.strokePath();

        // Antennae tips (small circles)
        graphics.fillStyle(this.lightenColor(bodyColor, 0.3));
        graphics.fillCircle(center.x - 8 + bodyOffset.x, center.y - 18 + bodyOffset.y, 2);
        graphics.fillCircle(center.x + 8 + bodyOffset.x, center.y - 18 + bodyOffset.y, 2);
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

            case 'avian':
                modifications.scaleX = 0.9 + (bodyShape.intensity * 0.15);
                modifications.scaleY = 1.1 + (bodyShape.intensity * 0.2);
                modifications.offsetY = -3;
                modifications.specialFeatures.push('feathered_tail', 'wings_folded', 'beak');
                break;

            case 'quadruped':
                modifications.scaleX = 1.2 + (bodyShape.intensity * 0.15);
                modifications.scaleY = 0.85 + (bodyShape.intensity * 0.1);
                modifications.offsetY = 5;
                modifications.specialFeatures.push('four_legs', 'paws', 'tail');
                break;

            case 'blob':
                modifications.scaleX = 1.3 + (bodyShape.intensity * 0.2);
                modifications.scaleY = 0.9 + (bodyShape.intensity * 0.15);
                modifications.offsetY = 8;
                modifications.specialFeatures.push('gooey_texture', 'translucent', 'dripping');
                break;

            case 'reptilian':
                modifications.scaleX = 1.0 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.15 + (bodyShape.intensity * 0.15);
                modifications.offsetY = 0;
                modifications.specialFeatures.push('scales', 'spinal_ridge', 'forked_tongue');
                break;

            case 'insectoid':
                modifications.scaleX = 0.85 + (bodyShape.intensity * 0.1);
                modifications.scaleY = 1.2 + (bodyShape.intensity * 0.2);
                modifications.offsetY = -2;
                modifications.specialFeatures.push('segmented_body', 'six_legs', 'antennae');
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
     * Advanced pattern methods for rare/epic/legendary creatures
     */
    addComplexSpots(graphics, center, baseColor, scale, intensity, distribution) {
        const numSpots = Math.floor(5 + intensity * 10); // 5-15 complex spots
        const spreadFactor = distribution === 'clustered' ? 0.6 : 1.2;

        for (let i = 0; i < numSpots; i++) {
            const angle = (i / numSpots) * Math.PI * 2 + Math.random() * 0.5;
            const distance = (12 + Math.random() * 20) * scale * spreadFactor;
            const spotX = center.x + Math.cos(angle) * distance;
            const spotY = center.y + Math.sin(angle) * distance;
            const spotSize = (3 + Math.random() * 5) * scale;

            // Outer ring
            graphics.fillStyle(this.darkenColor(baseColor, 0.3), 0.5);
            graphics.fillCircle(spotX, spotY, spotSize * 1.3);

            // Inner spot
            graphics.fillStyle(baseColor, 0.8);
            graphics.fillCircle(spotX, spotY, spotSize);

            // Highlight
            graphics.fillStyle(this.lightenColor(baseColor, 0.4), 0.6);
            graphics.fillCircle(spotX - spotSize * 0.2, spotY - spotSize * 0.2, spotSize * 0.4);
        }
    }

    addGalaxySwirls(graphics, center, baseColor, scale, intensity) {
        const numArms = 3;
        const armLength = 25 * scale;

        for (let arm = 0; arm < numArms; arm++) {
            const startAngle = (arm / numArms) * Math.PI * 2;
            const numPoints = Math.floor(8 + intensity * 8);

            graphics.lineStyle(2 * scale, baseColor, 0.7);

            for (let i = 0; i < numPoints; i++) {
                const t = i / numPoints;
                const spiralAngle = startAngle + t * Math.PI * 2;
                const radius = armLength * t;

                const x = center.x + Math.cos(spiralAngle) * radius;
                const y = center.y + Math.sin(spiralAngle) * radius;

                if (i === 0) {
                    graphics.beginPath();
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }

                // Add stars along spiral
                if (i % 2 === 0) {
                    graphics.fillStyle(this.lightenColor(baseColor, 0.3), 0.8);
                    graphics.fillCircle(x, y, 1 * scale);
                }
            }
            graphics.strokePath();
        }
    }

    addConstellationDots(graphics, center, baseColor, scale, intensity) {
        const numStars = Math.floor(6 + intensity * 10); // 6-16 stars
        const points = [];

        // Generate star positions
        for (let i = 0; i < numStars; i++) {
            const angle = (i / numStars) * Math.PI * 2;
            const distance = (10 + Math.random() * 15) * scale;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;
            points.push({ x, y });

            // Draw star
            graphics.fillStyle(baseColor, 0.9);
            this.addStarShape(graphics, x, y, (1.5 + Math.random()) * scale);
        }

        // Draw constellation lines connecting nearby stars
        graphics.lineStyle(1, this.lightenColor(baseColor, 0.2), 0.4);
        for (let i = 0; i < points.length; i++) {
            const nextIndex = (i + 1) % points.length;
            if (Math.random() < 0.5) { // 50% chance to connect
                graphics.beginPath();
                graphics.moveTo(points[i].x, points[i].y);
                graphics.lineTo(points[nextIndex].x, points[nextIndex].y);
                graphics.strokePath();
            }
        }
    }

    addAuroraStripes(graphics, center, size, colors, scale, intensity) {
        const numStripes = Math.floor(3 + intensity * 3); // 3-6 aurora stripes
        const stripeHeight = 4 * scale;

        for (let i = 0; i < numStripes; i++) {
            const y = center.y - (size.height * 0.3) + (i * (size.height * 0.6) / numStripes);
            const waveOffset = Math.sin(i * 0.5) * 5 * scale;

            // Create wave pattern
            const numSegments = 10;
            const segmentWidth = (size.width * 0.7) / numSegments;

            for (let j = 0; j < numSegments; j++) {
                const segmentX = center.x - (size.width * 0.35) + (j * segmentWidth);
                const wave = Math.sin(j * 0.8 + i) * 3 * scale;
                const colorIndex = Math.floor(j / (numSegments / 2));
                const color = colors[colorIndex % colors.length];

                graphics.fillStyle(color, 0.4);
                graphics.fillRect(segmentX, y + wave + waveOffset, segmentWidth, stripeHeight);
            }
        }
    }

    addCrystalFacets(graphics, center, baseColor, scale, intensity) {
        const numFacets = Math.floor(4 + intensity * 6); // 4-10 crystal facets

        for (let i = 0; i < numFacets; i++) {
            const angle = (i / numFacets) * Math.PI * 2;
            const distance = (8 + Math.random() * 12) * scale;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;
            const size = (3 + Math.random() * 4) * scale;

            // Draw geometric crystal shape
            const numSides = 6;
            graphics.fillStyle(baseColor, 0.6);
            graphics.beginPath();

            for (let side = 0; side < numSides; side++) {
                const sideAngle = (side / numSides) * Math.PI * 2;
                const sideX = x + Math.cos(sideAngle) * size;
                const sideY = y + Math.sin(sideAngle) * size;

                if (side === 0) {
                    graphics.moveTo(sideX, sideY);
                } else {
                    graphics.lineTo(sideX, sideY);
                }
            }
            graphics.closePath();
            graphics.fillPath();

            // Add facet highlight
            graphics.fillStyle(this.lightenColor(baseColor, 0.5), 0.7);
            graphics.fillCircle(x - size * 0.3, y - size * 0.3, size * 0.4);
        }
    }

    addStellarMandala(graphics, center, baseColor, scale, intensity) {
        const layers = Math.floor(3 + intensity * 2); // 3-5 concentric layers

        for (let layer = 0; layer < layers; layer++) {
            const radius = (8 + layer * 6) * scale;
            const numPoints = 8 + layer * 4;
            const layerAlpha = 0.8 - (layer * 0.15);

            graphics.lineStyle(1.5 * scale, baseColor, layerAlpha);
            graphics.strokeCircle(center.x, center.y, radius);

            // Add radial points
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;

                graphics.fillStyle(baseColor, layerAlpha);
                graphics.fillCircle(x, y, (1 + layer * 0.3) * scale);
            }
        }
    }

    addCosmicFractals(graphics, center, colors, scale, intensity) {
        // Recursive fractal tree pattern
        const drawFractalBranch = (x, y, angle, length, depth) => {
            if (depth === 0 || length < 2) return;

            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;

            const colorIndex = Math.floor((1 - depth / 4) * colors.length);
            const color = colors[Math.min(colorIndex, colors.length - 1)];

            graphics.lineStyle(Math.max(1, depth * 0.5) * scale, color, 0.6);
            graphics.beginPath();
            graphics.moveTo(x, y);
            graphics.lineTo(endX, endY);
            graphics.strokePath();

            // Branch recursively
            const branchAngle1 = angle - Math.PI / 6;
            const branchAngle2 = angle + Math.PI / 6;
            const newLength = length * 0.7;

            drawFractalBranch(endX, endY, branchAngle1, newLength, depth - 1);
            drawFractalBranch(endX, endY, branchAngle2, newLength, depth - 1);
        };

        const startLength = 15 * scale * intensity;
        const maxDepth = 4;

        // Draw fractals in multiple directions
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
            drawFractalBranch(center.x, center.y, angle, startLength, maxDepth);
        }
    }

    addRealityRifts(graphics, center, baseColor, scale, intensity) {
        const numRifts = Math.floor(2 + intensity * 3); // 2-5 rifts

        for (let i = 0; i < numRifts; i++) {
            const angle = (i / numRifts) * Math.PI * 2;
            const distance = 12 * scale;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;
            const riftLength = (8 + Math.random() * 8) * scale;

            // Jagged rift line
            graphics.lineStyle(2 * scale, baseColor, 0.7);
            graphics.beginPath();
            graphics.moveTo(x, y);

            for (let j = 0; j < 5; j++) {
                const jitterX = (Math.random() - 0.5) * 4 * scale;
                const jitterY = (Math.random() - 0.5) * 4 * scale;
                const segmentX = x + Math.cos(angle) * (j / 5) * riftLength + jitterX;
                const segmentY = y + Math.sin(angle) * (j / 5) * riftLength + jitterY;
                graphics.lineTo(segmentX, segmentY);
            }
            graphics.strokePath();

            // Glow around rift
            graphics.fillStyle(this.lightenColor(baseColor, 0.4), 0.3);
            graphics.fillEllipse(x, y, riftLength * 0.6, 4 * scale);
        }
    }

    addTimeSpirals(graphics, center, baseColor, scale, intensity) {
        const numSpirals = 2;
        const spiralTightness = 0.5 + intensity * 0.5;

        for (let spiral = 0; spiral < numSpirals; spiral++) {
            const direction = spiral === 0 ? 1 : -1;
            const numPoints = Math.floor(20 + intensity * 20);

            graphics.lineStyle(1.5 * scale, baseColor, 0.6);
            graphics.beginPath();

            for (let i = 0; i < numPoints; i++) {
                const t = i / numPoints;
                const angle = t * Math.PI * 4 * direction;
                const radius = (t * 20 + 5) * scale * spiralTightness;

                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;

                if (i === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }

                // Add time dots along spiral
                if (i % 5 === 0) {
                    graphics.fillStyle(this.lightenColor(baseColor, 0.4), 0.7);
                    graphics.fillCircle(x, y, 1.5 * scale);
                }
            }
            graphics.strokePath();
        }
    }

    addVoidPortals(graphics, center, baseColor, scale, intensity) {
        const numPortals = Math.floor(1 + intensity * 2); // 1-3 portals

        for (let i = 0; i < numPortals; i++) {
            const angle = (i / numPortals) * Math.PI * 2;
            const distance = 10 * scale;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;
            const portalSize = (5 + intensity * 5) * scale;

            // Multi-layer portal effect
            const layers = 5;
            for (let layer = 0; layer < layers; layer++) {
                const layerRadius = portalSize * (1 - layer / layers);
                const layerAlpha = 0.2 + (layer / layers) * 0.5;

                graphics.fillStyle(this.darkenColor(baseColor, layer * 0.1), layerAlpha);
                graphics.fillCircle(x, y, layerRadius);
            }

            // Portal swirl effect
            graphics.lineStyle(1 * scale, this.lightenColor(baseColor, 0.3), 0.6);
            for (let swirl = 0; swirl < 3; swirl++) {
                const swirlAngle = (swirl / 3) * Math.PI * 2;
                graphics.arc(x, y, portalSize * 0.7, swirlAngle, swirlAngle + Math.PI * 0.8);
            }
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
     * Add power level indicators for high-power cosmic creatures
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center position {x, y}
     * @param {number} color - Indicator color
     * @param {number} powerLevel - Power level (0-1)
     */
    addPowerIndicators(graphics, center, color, powerLevel) {
        // Add power level dots/indicators for high-power creatures
        const numIndicators = Math.floor(powerLevel * 5); // 0-5 indicators

        for (let i = 0; i < numIndicators; i++) {
            const angle = (i / numIndicators) * Math.PI * 2 - Math.PI / 2;
            const distance = 35;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;

            // Outer glow
            graphics.fillStyle(color, 0.3);
            graphics.fillCircle(x, y, 4);

            // Inner bright dot
            graphics.fillStyle(this.lightenColor(color, 0.3), 0.8);
            graphics.fillCircle(x, y, 2);
        }
    }

    /**
     * Calculate growth stage modifiers based on creature level
     * @param {number} level - Creature level (1-99+)
     * @returns {Object} Stage modifiers for rendering
     */
    getGrowthStageModifiers(level) {
        let stage, stageName, sizeMultiplier, colorSaturation, markingIntensity, specialEffects;

        if (level <= 5) {
            stage = 1;
            stageName = 'baby';
            sizeMultiplier = 0.6;
            colorSaturation = 0.7; // Softer, pastel colors
            markingIntensity = 0.3; // Few markings
            specialEffects = [];
        } else if (level <= 15) {
            stage = 2;
            stageName = 'juvenile';
            sizeMultiplier = 0.85;
            colorSaturation = 0.85; // Colors starting to deepen
            markingIntensity = 0.6; // Markings appearing
            specialEffects = [];
        } else if (level < 50) {
            stage = 3;
            stageName = 'adult';
            sizeMultiplier = 1.0;
            colorSaturation = 1.0; // Full color saturation
            markingIntensity = 1.0; // All markings visible
            specialEffects = [];
        } else {
            stage = 4;
            stageName = 'prestige';
            sizeMultiplier = 1.2;
            colorSaturation = 1.1; // Enhanced colors
            markingIntensity = 1.0; // All markings visible
            specialEffects = ['prestige_aura', 'cosmic_particles', 'legendary_glow'];
        }

        return {
            stage,
            stageName,
            sizeMultiplier,
            colorSaturation,
            markingIntensity,
            specialEffects,
            level,
            // Calculated properties
            headSizeRatio: stage === 1 ? 1.3 : 1.0, // Bigger head for babies
            featureComplexity: Math.min(1.0, stage / 3), // Features grow with stage
            particleCount: stage === 4 ? 10 : 0
        };
    }

    /**
     * Apply growth stage modifiers to colors
     */
    applyGrowthStageColors(color, saturation) {
        if (saturation === 1.0) return color;

        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;

        // Desaturate for baby stage (move toward gray)
        const gray = (r + g + b) / 3;
        const newR = Math.floor(r * saturation + gray * (1 - saturation));
        const newG = Math.floor(g * saturation + gray * (1 - saturation));
        const newB = Math.floor(b * saturation + gray * (1 - saturation));

        return (newR << 16) | (newG << 8) | newB;
    }

    /**
     * Add prestige stage special effects
     */
    addPrestigeEffects(graphics, center, size, genetics) {
        // Legendary aura
        const auraColor = genetics.traits.colorGenome.accent;
        graphics.lineStyle(3, this.lightenColor(auraColor, 0.4), 0.4);
        graphics.strokeCircle(center.x, center.y, 45);
        graphics.strokeCircle(center.x, center.y, 50);

        // Cosmic crown/halo
        const numPoints = 12;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
            const distance = 40;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance - 20; // Above head

            graphics.fillStyle(this.lightenColor(auraColor, 0.5), 0.7);
            this.addStarShape(graphics, x, y, 2);
        }

        // Power indicator dots
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const distance = 35;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;

            graphics.fillStyle(this.lightenColor(auraColor, 0.6), 0.8);
            graphics.fillCircle(x, y, 2);
        }
    }

    /**
     * Add personality-based visual effects
     */
    addPersonalityEffects(graphics, personality, center, size) {
        // Personality visual effects are subtle static enhancements
        // Note: Animations should be added in the scene, not in texture generation

        switch (personality.core) {
            case 'curious':
                // Add small sparkles around creature
                graphics.fillStyle(0xFFD54F, 0.6);
                for (let i = 0; i < 3; i++) {
                    const angle = (i * 120) * Math.PI / 180;
                    const x = center.x + Math.cos(angle) * 30;
                    const y = center.y + Math.sin(angle) * 30;
                    graphics.fillCircle(x, y, 2);
                }
                break;

            case 'playful':
                // Add cheerful swirl marks
                graphics.lineStyle(2, 0xFF6B9D, 0.5);
                graphics.arc(center.x - 15, center.y, 8, 0, Math.PI);
                graphics.strokePath();
                graphics.arc(center.x + 15, center.y, 8, 0, Math.PI);
                graphics.strokePath();
                break;

            case 'gentle':
                // Add soft glow outline
                graphics.lineStyle(3, 0xB39DDB, 0.3);
                graphics.strokeCircle(center.x, center.y, 35);
                break;

            case 'wise':
                // Add wisdom rune marks
                graphics.fillStyle(0x80CBC4, 0.7);
                graphics.fillCircle(center.x, center.y - 25, 3);
                graphics.fillCircle(center.x - 8, center.y - 20, 2);
                graphics.fillCircle(center.x + 8, center.y - 20, 2);
                break;

            case 'energetic':
                // Add energy lines
                graphics.lineStyle(2, 0xFFB74D, 0.6);
                for (let i = 0; i < 4; i++) {
                    const angle = (i * 90) * Math.PI / 180;
                    const x1 = center.x + Math.cos(angle) * 25;
                    const y1 = center.y + Math.sin(angle) * 25;
                    const x2 = center.x + Math.cos(angle) * 32;
                    const y2 = center.y + Math.sin(angle) * 32;
                    graphics.beginPath();
                    graphics.moveTo(x1, y1);
                    graphics.lineTo(x2, y2);
                    graphics.strokePath();
                }
                break;
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

    addPowerIndicators(graphics, center, color, powerLevel) {
        // Add power level dots/indicators for high-power creatures
        const numIndicators = Math.floor(powerLevel * 5); // 0-5 indicators

        for (let i = 0; i < numIndicators; i++) {
            const angle = (i / numIndicators) * Math.PI * 2 - Math.PI / 2;
            const distance = 35;
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;

            graphics.fillStyle(this.lightenColor(color, 0.3), 0.8);
            graphics.fillCircle(x, y, 2);

            // Add glow
            graphics.fillStyle(color, 0.3);
            graphics.fillCircle(x, y, 4);
        }
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

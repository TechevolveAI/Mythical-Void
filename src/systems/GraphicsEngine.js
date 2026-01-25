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
     * Create a scratch graphics instance that never flashes on screen while generating textures
     * With error handling for missing scene or graphics factory
     */
    createScratchGraphics() {
        try {
            if (!this.scene) {
                throw new Error('Scene not initialized');
            }

            if (this.scene.make && typeof this.scene.make.graphics === 'function') {
                return this.scene.make.graphics({ x: 0, y: 0, add: false });
            }

            if (this.scene.add && typeof this.scene.add.graphics === 'function') {
                const graphics = this.scene.add.graphics({ x: -1000, y: -1000 });
                graphics.setVisible(false);
                return graphics;
            }

            throw new Error('No graphics factory available');
        } catch (error) {
            console.error('graphics:error [GraphicsEngine] Failed to create scratch graphics:', error);

            // Emit error for ErrorHandler
            if (typeof window !== 'undefined' && window.ErrorHandler && typeof window.ErrorHandler.handleError === 'function') {
                window.ErrorHandler.handleError({
                    message: error.message || 'Failed to create scratch graphics',
                    type: 'GraphicsEngine.createScratchGraphics',
                    severity: 'error',
                    stack: error.stack
                });
            }

            throw error; // Re-throw as this is critical
        }
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

        // Support multiple property naming conventions
        // Priority: x/y > scaleX/scaleY > width/height (normalized to base 50)
        let x = bodyScale.x ?? bodyScale.scaleX;
        let y = bodyScale.y ?? bodyScale.scaleY;

        // If x/y not found, try width/height (normalize to scale factor)
        // Base size is ~50, so width/height should be divided to get scale
        if (x === undefined && bodyScale.width !== undefined) {
            x = bodyScale.width / 50;
        }
        if (y === undefined && bodyScale.height !== undefined) {
            y = bodyScale.height / 50;
        }

        return {
            x: x ?? 1,
            y: y ?? 1
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
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point {x, y}
     * @param {Object} size - Base size {width, height}
     * @param {number} bodyColor - Body color hex
     * @param {number} headColor - Head color hex
     * @param {number} wingColor - Wing color hex
     * @param {number} frame - Animation frame
     * @param {Object} geneticTraits - Genetic trait modifiers
     * @param {Object} stageConfig - Stage configuration with multipliers
     */
    renderCreatureOnGraphics(graphics, center, size, bodyColor = 0x9370DB, headColor = 0xDDA0DD, wingColor = 0x8A2BE2, frame = 0, geneticTraits = null, stageConfig = null) {
        const eyeColor = 0x4169E1;
        let modifiedBodyColor = bodyColor;
        let modifiedHeadColor = headColor;

        // Stage-based scaling multipliers (default to 1.0 for adult)
        const eyeMultiplier = stageConfig?.eyeSizeMultiplier || 1.0;
        const headMultiplier = stageConfig?.headSizeMultiplier || 1.0;
        const baseScale = stageConfig?.scale || 1.0;

        // Calculate scaled sizes - babies get BIGGER eyes relative to body
        // Base eye size is 5px for adults, scale up for babies
        const baseEyeSize = 5 * eyeMultiplier;
        const baseHeadSize = 16 * headMultiplier;

        console.log(`graphics:debug [GraphicsEngine] Stage scaling - eye: ${eyeMultiplier}x, head: ${headMultiplier}x, base: ${baseScale}x`);

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

        // Head with realistic shading - SCALED by headMultiplier
        const headShadow = this.darkenColor(headColor, 0.4);
        const headHighlight = this.lightenColor(headColor, 0.3);

        // Scale head position relative to body (babies have proportionally larger heads)
        const headY = center.y - (10 * baseScale);

        // Head base (shadow side) - SCALED
        graphics.fillStyle(headShadow);
        graphics.fillCircle(center.x + 1, headY + 2, baseHeadSize);

        // Head main color - SCALED
        graphics.fillStyle(headColor);
        graphics.fillCircle(center.x - 1, headY, baseHeadSize * 0.94);

        // Head highlight (lit side) - SCALED
        graphics.fillStyle(headHighlight, 0.9);
        graphics.fillCircle(center.x - (4 * headMultiplier), headY - (2 * headMultiplier), baseHeadSize * 0.625);

        // Head shine - SCALED
        graphics.fillStyle(0xFFFFFF, 0.4);
        graphics.fillCircle(center.x - (6 * headMultiplier), headY - (5 * headMultiplier), baseHeadSize * 0.3);

        // Eyes based on body type - SCALED with stage multipliers
        // Eye positions scale with head, but eye SIZE gets the eyeMultiplier (bigger for babies)
        const eyeY = headY - (2 * headMultiplier);
        const eyeSpacing = 6 * headMultiplier;

        if (this.currentBodyType === 'cyclops') {
            this.createCyclopsEye(graphics, center.x, eyeY, eyeColor, baseEyeSize);
        } else {
            this.createRealisticEyes(
                graphics,
                center.x - eyeSpacing, eyeY,
                center.x + eyeSpacing, eyeY,
                eyeColor,
                baseEyeSize
            );
        }

        // Genetic head modifications
        this.applyGeneticHeadMods(graphics, center, modifiedHeadColor, geneticTraits);

        // Dynamic wings (animated frames)
        this.createAnimatedWings(graphics, center, wingColor, frame);

        // Chest highlight
        graphics.fillStyle(0xFFFFFF, 0.2);
        graphics.fillEllipse(center.x - 2, center.y - 2, 8 * baseScale, 12 * baseScale);
    }

    /**
     * Create realistic eyes with proper depth and reflections
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {number} leftX - Left eye X position
     * @param {number} leftY - Left eye Y position
     * @param {number} rightX - Right eye X position
     * @param {number} rightY - Right eye Y position
     * @param {number} eyeColor - Eye color hex
     * @param {number} baseSize - Base eye size (default 5, scaled by stage)
     */
    createRealisticEyes(graphics, leftX, leftY, rightX, rightY, eyeColor = 0x4169E1, baseSize = 5) {
        // Scale all eye components proportionally
        const socketSize = baseSize * 1.2;      // Eye socket slightly larger
        const whiteSize = baseSize;              // Eye white = base size
        const irisSize = baseSize * 0.7;         // Iris ~70% of white
        const innerIrisSize = baseSize * 0.5;    // Inner iris ~50%
        const pupilSize = baseSize * 0.3;        // Pupil ~30%
        const reflectionSize = baseSize * 0.2;   // Main reflection ~20%
        const reflectionOffset = baseSize * 0.2; // Offset for sparkle position

        // Eye sockets (shadow) - SCALED
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(leftX, leftY + 1, socketSize);
        graphics.fillCircle(rightX, rightY + 1, socketSize);

        // Eye whites - SCALED
        graphics.fillStyle(0xFFFAF0);
        graphics.fillCircle(leftX, leftY, whiteSize);
        graphics.fillCircle(rightX, rightY, whiteSize);

        // Iris with color variation - SCALED
        graphics.fillStyle(eyeColor);
        graphics.fillCircle(leftX, leftY, irisSize);
        graphics.fillCircle(rightX, rightY, irisSize);

        // Iris inner ring (adds depth) - SCALED
        graphics.fillStyle(this.lightenColor(eyeColor, 0.2), 0.7);
        graphics.fillCircle(leftX, leftY, innerIrisSize);
        graphics.fillCircle(rightX, rightY, innerIrisSize);

        // Pupils - SCALED
        graphics.fillStyle(0x000000);
        graphics.fillCircle(leftX, leftY, pupilSize);
        graphics.fillCircle(rightX, rightY, pupilSize);

        // Eye reflections (brings them to life!) - SCALED
        // Main sparkle - upper left of each eye
        graphics.fillStyle(0xFFFFFF, 0.95);
        graphics.fillCircle(leftX - reflectionOffset, leftY - reflectionOffset, reflectionSize);
        graphics.fillCircle(rightX - reflectionOffset, rightY - reflectionOffset, reflectionSize);

        // Secondary reflection - smaller, lower right
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(leftX + reflectionOffset * 0.5, leftY + reflectionOffset * 0.25, reflectionSize * 0.5);
        graphics.fillCircle(rightX + reflectionOffset * 0.5, rightY + reflectionOffset * 0.25, reflectionSize * 0.5);

        // Subtle eyelids for realism - SCALED
        graphics.lineStyle(Math.max(1, baseSize * 0.2), 0x000000, 0.3);
        graphics.strokeCircle(leftX, leftY - (baseSize * 0.1), whiteSize);
        graphics.strokeCircle(rightX, rightY - (baseSize * 0.1), whiteSize);
    }

    /**
     * Create single large cyclops eye with enhanced detail
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {number} centerX - Eye center X position
     * @param {number} centerY - Eye center Y position
     * @param {number} eyeColor - Eye color hex
     * @param {number} baseSize - Base eye size (default 8, cyclops eyes are naturally larger)
     */
    createCyclopsEye(graphics, centerX, centerY, eyeColor = 0x4169E1, baseSize = 8) {
        // Cyclops eye is inherently larger - scale all proportionally
        const socketSize = baseSize * 1.25;      // Socket slightly larger than white
        const browWidth = baseSize * 2.5;        // Brow ridge width
        const browHeight = baseSize * 0.75;      // Brow ridge height
        const whiteSize = baseSize;              // Eye white
        const irisSize = baseSize * 0.75;        // Iris
        const innerIrisSize = baseSize * 0.56;   // Inner iris
        const pupilSize = baseSize * 0.31;       // Pupil
        const reflectionSize = baseSize * 0.19;  // Main reflection
        const irisLineStart = baseSize * 0.25;   // Iris texture start
        const irisLineEnd = baseSize * 0.5;      // Iris texture end

        // Eye socket (larger shadow for single eye) - SCALED
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillCircle(centerX, centerY + 1, socketSize);

        // Prominent brow ridge (cyclops characteristic) - SCALED
        graphics.fillStyle(0x8B4513, 0.8);
        graphics.fillEllipse(centerX, centerY - (baseSize * 0.75), browWidth, browHeight);

        // Eye white (larger than normal eyes) - SCALED
        graphics.fillStyle(0xFFFAF0);
        graphics.fillCircle(centerX, centerY, whiteSize);

        // Iris (proportionally larger) - SCALED
        graphics.fillStyle(eyeColor);
        graphics.fillCircle(centerX, centerY, irisSize);

        // Iris inner ring with depth - SCALED
        graphics.fillStyle(this.lightenColor(eyeColor, 0.2), 0.8);
        graphics.fillCircle(centerX, centerY, innerIrisSize);

        // Iris texture lines for realism - SCALED
        graphics.lineStyle(Math.max(0.5, baseSize * 0.06), this.darkenColor(eyeColor, 0.3), 0.6);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const startX = centerX + Math.cos(angle) * irisLineStart;
            const startY = centerY + Math.sin(angle) * irisLineStart;
            const endX = centerX + Math.cos(angle) * irisLineEnd;
            const endY = centerY + Math.sin(angle) * irisLineEnd;
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }

        // Large pupil - SCALED
        graphics.fillStyle(0x000000);
        graphics.fillCircle(centerX, centerY, pupilSize);

        // Primary reflection (more prominent on single eye) - SCALED
        graphics.fillStyle(0xFFFFFF, 0.95);
        graphics.fillCircle(centerX - (baseSize * 0.25), centerY - (baseSize * 0.25), reflectionSize);

        // Secondary reflection - SCALED
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(centerX + (baseSize * 0.19), centerY + (baseSize * 0.125), reflectionSize * 0.5);

        // Eyelid with more defined edge - SCALED
        graphics.lineStyle(Math.max(1.5, baseSize * 0.19), 0x000000, 0.4);
        graphics.strokeCircle(centerX, centerY - (baseSize * 0.125), whiteSize);

        // Lower eyelid shadow - SCALED
        graphics.fillStyle(0x000000, 0.2);
        graphics.fillEllipse(centerX, centerY + (baseSize * 0.75), browWidth, browHeight * 0.5);
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
        // Check if texture already exists
        if (this.scene.textures.exists('magicalSparkle')) {
            return 'magicalSparkle';
        }

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

    /**
     * Create cosmic coin collectible sprite
     * Beautiful space-themed currency with glow and sparkle effects
     */
    createCosmicCoin() {
        // Check if texture already exists
        if (this.scene.textures.exists('cosmicCoin')) {
            console.log('[GraphicsEngine] Cosmic coin texture already exists, skipping');
            return 'cosmicCoin';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 16, y: 16 };
        const radius = 12;

        // Outer glow layers (pulsing aura effect)
        const glowColors = [
            { color: 0x4A90E2, alpha: 0.3, size: 16 },
            { color: 0x00CED1, alpha: 0.4, size: 14 },
            { color: 0x9370DB, alpha: 0.3, size: 12 }
        ];

        glowColors.forEach(glow => {
            graphics.fillStyle(glow.color, glow.alpha);
            graphics.fillCircle(center.x, center.y, glow.size);
        });

        // Main coin body - gradient from cyan to purple (cosmic theme)
        // Simulate gradient with layered circles (Phaser doesn't support Canvas gradients)
        for (let i = 0; i < 8; i++) {
            const t = i / 7; // 0 to 1
            // Interpolate between cyan (0x00CED1) and purple (0x9370DB)
            const r = Math.floor(0x00 + (0x93 - 0x00) * t);
            const g = Math.floor(0xCE - (0xCE - 0x70) * t);
            const b = Math.floor(0xD1 + (0xDB - 0xD1) * t);
            const color = (r << 16) | (g << 8) | b;

            const alpha = 0.9;
            const layerRadius = radius - i * 0.5;
            graphics.fillStyle(color, alpha);
            graphics.fillCircle(center.x, center.y, layerRadius);
        }

        // Inner ring detail (gives coin depth)
        graphics.lineStyle(2, 0xFFFFFF, 0.4);
        graphics.strokeCircle(center.x, center.y, radius * 0.7);

        // Central star symbol (currency marking)
        graphics.fillStyle(0xFFD700, 0.8); // Gold star
        this.drawStar(graphics, center.x, center.y, 4, 3, 5);

        // Highlight shine (top-left)
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(center.x - 4, center.y - 4, 3);

        // Tiny sparkles around edge (3 sparkles for cosmic effect)
        const sparklePositions = [
            { angle: 45, distance: 10 },
            { angle: 135, distance: 11 },
            { angle: 270, distance: 10 }
        ];

        graphics.fillStyle(0xFFFFFF, 0.9);
        sparklePositions.forEach(pos => {
            const rads = (pos.angle * Math.PI) / 180;
            const x = center.x + Math.cos(rads) * pos.distance;
            const y = center.y + Math.sin(rads) * pos.distance;

            // Draw small diamond sparkle
            graphics.beginPath();
            graphics.moveTo(x, y - 1.5);
            graphics.lineTo(x + 1, y);
            graphics.lineTo(x, y + 1.5);
            graphics.lineTo(x - 1, y);
            graphics.closePath();
            graphics.fillPath();
        });

        return this.finalizeTexture(graphics, 'cosmicCoin', 32, 32);
    }

    /**
     * Create Star Fragment collectible - crystalline star shard with blue glow
     * Rarity: Rare (Blue)
     */
    createStarFragment() {
        if (this.scene.textures.exists('starFragment')) {
            return 'starFragment';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 20 };
        const size = 40;

        // Outer glow layers (blue cosmic energy)
        const glowColors = [
            { color: 0x1E90FF, alpha: 0.2, radius: 18 },
            { color: 0x00BFFF, alpha: 0.3, radius: 14 },
            { color: 0x87CEEB, alpha: 0.4, radius: 10 }
        ];

        glowColors.forEach(glow => {
            graphics.fillStyle(glow.color, glow.alpha);
            graphics.fillCircle(center.x, center.y, glow.radius);
        });

        // Main crystal body - faceted star shape
        graphics.fillStyle(0x4169E1, 0.9); // Royal blue
        this.drawStar(graphics, center.x, center.y, 5, 4, 12);

        // Inner facet highlights
        graphics.fillStyle(0x87CEEB, 0.7);
        this.drawStar(graphics, center.x, center.y, 5, 2, 6);

        // Central bright core
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(center.x, center.y, 3);

        // Sparkle points around the star
        graphics.fillStyle(0xFFFFFF, 0.8);
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 4) + (i * Math.PI / 2);
            const x = center.x + Math.cos(angle) * 16;
            const y = center.y + Math.sin(angle) * 16;
            graphics.fillCircle(x, y, 1.5);
        }

        return this.finalizeTexture(graphics, 'starFragment', size, size);
    }

    /**
     * Create Cosmic Gem collectible - faceted gem with purple shimmer
     * Rarity: Epic (Purple)
     */
    createCosmicGemCollectible() {
        if (this.scene.textures.exists('cosmicGemCollectible')) {
            return 'cosmicGemCollectible';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 22 };
        const size = 40;

        // Outer glow (purple cosmic energy)
        graphics.fillStyle(0x9C27B0, 0.25);
        graphics.fillCircle(center.x, center.y - 2, 18);

        // Gem body - hexagonal shape with facets
        const gemPoints = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 6) + (i * Math.PI / 3);
            gemPoints.push({
                x: center.x + Math.cos(angle) * 12,
                y: center.y - 2 + Math.sin(angle) * 10
            });
        }

        // Main gem fill
        graphics.fillStyle(0x7B1FA2, 0.9);
        graphics.beginPath();
        graphics.moveTo(gemPoints[0].x, gemPoints[0].y);
        gemPoints.forEach(p => graphics.lineTo(p.x, p.y));
        graphics.closePath();
        graphics.fillPath();

        // Facet highlights (left side)
        graphics.fillStyle(0xBA68C8, 0.7);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - 12);
        graphics.lineTo(gemPoints[0].x, gemPoints[0].y);
        graphics.lineTo(center.x, center.y);
        graphics.closePath();
        graphics.fillPath();

        // Bright highlight (top)
        graphics.fillStyle(0xE1BEE7, 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - 12);
        graphics.lineTo(center.x + 4, center.y - 6);
        graphics.lineTo(center.x - 2, center.y - 4);
        graphics.closePath();
        graphics.fillPath();

        // Central sparkle
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(center.x - 2, center.y - 5, 2);

        // Bottom point
        graphics.fillStyle(0x4A148C, 0.9);
        graphics.beginPath();
        graphics.moveTo(gemPoints[3].x, gemPoints[3].y);
        graphics.lineTo(center.x, center.y + 12);
        graphics.lineTo(gemPoints[4].x, gemPoints[4].y);
        graphics.closePath();
        graphics.fillPath();

        return this.finalizeTexture(graphics, 'cosmicGemCollectible', size, size);
    }

    /**
     * Create Ancient Relic collectible - ornate vessel with energy wisps
     * Rarity: Epic (Purple/Gold)
     */
    createAncientRelic() {
        if (this.scene.textures.exists('ancientRelic')) {
            return 'ancientRelic';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 22 };
        const size = 40;

        // Mystical energy aura
        graphics.fillStyle(0x9C27B0, 0.2);
        graphics.fillCircle(center.x, center.y, 18);
        graphics.fillStyle(0xFFD700, 0.15);
        graphics.fillCircle(center.x, center.y, 14);

        // Vessel body (vase shape)
        graphics.fillStyle(0x8D6E63, 0.95); // Bronze/brown
        graphics.beginPath();
        graphics.moveTo(center.x - 8, center.y + 10); // Bottom left
        graphics.lineTo(center.x - 10, center.y); // Left side
        graphics.lineTo(center.x - 6, center.y - 8); // Neck left
        graphics.lineTo(center.x - 4, center.y - 12); // Rim left
        graphics.lineTo(center.x + 4, center.y - 12); // Rim right
        graphics.lineTo(center.x + 6, center.y - 8); // Neck right
        graphics.lineTo(center.x + 10, center.y); // Right side
        graphics.lineTo(center.x + 8, center.y + 10); // Bottom right
        graphics.closePath();
        graphics.fillPath();

        // Golden trim lines
        graphics.lineStyle(2, 0xFFD700, 0.9);
        graphics.strokeCircle(center.x, center.y - 10, 5); // Rim
        graphics.beginPath();
        graphics.moveTo(center.x - 10, center.y + 2);
        graphics.lineTo(center.x + 10, center.y + 2);
        graphics.strokePath();

        // Glowing rune symbols
        graphics.fillStyle(0x9C27B0, 0.8);
        graphics.fillCircle(center.x, center.y, 3);
        graphics.fillStyle(0xE040FB, 0.6);
        graphics.fillCircle(center.x - 5, center.y + 4, 1.5);
        graphics.fillCircle(center.x + 5, center.y + 4, 1.5);

        // Energy wisps floating up
        graphics.fillStyle(0xE1BEE7, 0.6);
        graphics.fillCircle(center.x - 3, center.y - 16, 2);
        graphics.fillCircle(center.x + 4, center.y - 18, 1.5);
        graphics.fillStyle(0xFFFFFF, 0.5);
        graphics.fillCircle(center.x, center.y - 20, 1);

        return this.finalizeTexture(graphics, 'ancientRelic', size, size);
    }

    /**
     * Create Energy Orb collectible - swirling cyan sphere with particle trails
     * Rarity: Uncommon (Green/Cyan)
     */
    createEnergyOrbCollectible() {
        if (this.scene.textures.exists('energyOrbCollectible')) {
            return 'energyOrbCollectible';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 18, y: 18 };
        const size = 36;

        // Outer energy field
        graphics.fillStyle(0x00BFA5, 0.2);
        graphics.fillCircle(center.x, center.y, 16);
        graphics.fillStyle(0x00E5CC, 0.3);
        graphics.fillCircle(center.x, center.y, 12);

        // Main orb body - gradient layers
        for (let i = 0; i < 6; i++) {
            const t = i / 5;
            const radius = 10 - i * 1.2;
            const alpha = 0.8 - t * 0.3;
            // Cyan to white gradient
            const r = Math.floor(0 + (255 - 0) * t);
            const g = Math.floor(206 + (255 - 206) * t);
            const b = Math.floor(209 + (255 - 209) * t);
            const color = (r << 16) | (g << 8) | b;
            graphics.fillStyle(color, alpha);
            graphics.fillCircle(center.x, center.y, radius);
        }

        // Swirl effect (curved lines inside orb)
        graphics.lineStyle(1.5, 0xFFFFFF, 0.4);
        graphics.beginPath();
        graphics.arc(center.x - 2, center.y, 5, 0, Math.PI, false);
        graphics.strokePath();
        graphics.beginPath();
        graphics.arc(center.x + 2, center.y, 4, Math.PI, 0, false);
        graphics.strokePath();

        // Central bright core
        graphics.fillStyle(0xFFFFFF, 0.95);
        graphics.fillCircle(center.x, center.y, 3);

        // Particle trail dots
        graphics.fillStyle(0x00CED1, 0.6);
        graphics.fillCircle(center.x - 10, center.y + 8, 2);
        graphics.fillCircle(center.x - 12, center.y + 12, 1.5);
        graphics.fillStyle(0x00E5CC, 0.4);
        graphics.fillCircle(center.x - 14, center.y + 14, 1);

        return this.finalizeTexture(graphics, 'energyOrbCollectible', size, size);
    }

    /**
     * Create Treasure Chest collectible - wooden chest with golden glow
     * Rarity: Uncommon (Green)
     */
    createTreasureChestCollectible() {
        if (this.scene.textures.exists('treasureChestCollectible')) {
            return 'treasureChestCollectible';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 20 };
        const size = 40;

        // Golden glow behind chest
        graphics.fillStyle(0xFFD700, 0.2);
        graphics.fillCircle(center.x, center.y, 18);
        graphics.fillStyle(0xFFA000, 0.15);
        graphics.fillCircle(center.x, center.y, 14);

        // Chest body (darker wood)
        graphics.fillStyle(0x5D4037, 0.95);
        graphics.fillRoundedRect(center.x - 12, center.y - 2, 24, 14, 2);

        // Chest lid (lighter wood) - curved top using line segments
        graphics.fillStyle(0x795548, 0.95);
        graphics.beginPath();
        graphics.moveTo(center.x - 12, center.y - 2);
        graphics.lineTo(center.x - 12, center.y - 6);
        // Approximate quadratic curve with line segments for domed lid
        graphics.lineTo(center.x - 8, center.y - 10);
        graphics.lineTo(center.x - 4, center.y - 12);
        graphics.lineTo(center.x, center.y - 13);
        graphics.lineTo(center.x + 4, center.y - 12);
        graphics.lineTo(center.x + 8, center.y - 10);
        graphics.lineTo(center.x + 12, center.y - 6);
        graphics.lineTo(center.x + 12, center.y - 2);
        graphics.closePath();
        graphics.fillPath();

        // Wood grain lines
        graphics.lineStyle(1, 0x4E342E, 0.4);
        graphics.beginPath();
        graphics.moveTo(center.x - 10, center.y + 4);
        graphics.lineTo(center.x + 10, center.y + 4);
        graphics.moveTo(center.x - 10, center.y + 8);
        graphics.lineTo(center.x + 10, center.y + 8);
        graphics.strokePath();

        // Golden trim and lock
        graphics.fillStyle(0xFFD700, 0.9);
        graphics.fillRect(center.x - 12, center.y - 3, 24, 2); // Rim
        graphics.fillRoundedRect(center.x - 4, center.y - 6, 8, 8, 2); // Lock plate

        // Lock keyhole
        graphics.fillStyle(0x5D4037, 0.9);
        graphics.fillCircle(center.x, center.y - 3, 2);
        graphics.fillRect(center.x - 1, center.y - 3, 2, 3);

        // Glow from inside (slightly open)
        graphics.fillStyle(0xFFEB3B, 0.6);
        graphics.fillRect(center.x - 8, center.y - 9, 16, 2);

        // Corner reinforcements
        graphics.fillStyle(0xB8860B, 0.8);
        graphics.fillCircle(center.x - 10, center.y - 1, 2);
        graphics.fillCircle(center.x + 10, center.y - 1, 2);

        return this.finalizeTexture(graphics, 'treasureChestCollectible', size, size);
    }

    /**
     * Create Lore Fragment collectible - glowing scroll/page
     * Rarity: Uncommon (narrative reward)
     */
    createLoreFragment() {
        if (this.scene.textures.exists('loreFragment')) {
            return 'loreFragment';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 18, y: 20 };
        const size = 36;

        // Mystical glow
        graphics.fillStyle(0xFFD54F, 0.2);
        graphics.fillCircle(center.x, center.y, 16);

        // Scroll background
        graphics.fillStyle(0xFFF8E1, 0.95);
        graphics.beginPath();
        graphics.moveTo(center.x - 10, center.y - 12);
        graphics.lineTo(center.x + 8, center.y - 12);
        graphics.lineTo(center.x + 10, center.y - 10);
        graphics.lineTo(center.x + 10, center.y + 10);
        graphics.lineTo(center.x - 10, center.y + 10);
        graphics.closePath();
        graphics.fillPath();

        // Scroll edge shadow
        graphics.fillStyle(0xD7CCC8, 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x + 8, center.y - 12);
        graphics.lineTo(center.x + 10, center.y - 10);
        graphics.lineTo(center.x + 8, center.y - 10);
        graphics.closePath();
        graphics.fillPath();

        // Text lines (mystical writing)
        graphics.lineStyle(1, 0x5D4037, 0.5);
        for (let i = 0; i < 4; i++) {
            const y = center.y - 6 + i * 4;
            const width = 12 - (i % 2) * 4;
            graphics.beginPath();
            graphics.moveTo(center.x - 6, y);
            graphics.lineTo(center.x - 6 + width, y);
            graphics.strokePath();
        }

        // Glowing rune symbol
        graphics.fillStyle(0x9C27B0, 0.7);
        this.drawStar(graphics, center.x + 4, center.y - 2, 4, 1.5, 3);

        // Sparkle
        graphics.fillStyle(0xFFFFFF, 0.8);
        graphics.fillCircle(center.x + 8, center.y - 10, 1.5);

        return this.finalizeTexture(graphics, 'loreFragment', size, size);
    }

    /**
     * Create Coin Pile collectible - stack of gold coins
     * Rarity: Common (Gray/White border)
     */
    createCoinPile() {
        if (this.scene.textures.exists('coinPile')) {
            return 'coinPile';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 20, y: 22 };
        const size = 40;

        // Soft golden glow
        graphics.fillStyle(0xFFD700, 0.2);
        graphics.fillCircle(center.x, center.y, 16);

        // Draw stacked coins (bottom to top)
        const coinColors = [
            { fill: 0xDAA520, edge: 0xB8860B }, // Bottom coins (darker gold)
            { fill: 0xFFD700, edge: 0xDAA520 }, // Middle coins
            { fill: 0xFFE135, edge: 0xFFD700 }  // Top coins (brightest)
        ];

        // Bottom layer (3 coins spread out)
        const bottomCoins = [
            { x: center.x - 6, y: center.y + 6 },
            { x: center.x + 6, y: center.y + 6 },
            { x: center.x, y: center.y + 8 }
        ];

        bottomCoins.forEach(pos => {
            // Coin edge (3D effect)
            graphics.fillStyle(coinColors[0].edge, 0.9);
            graphics.fillEllipse(pos.x, pos.y + 2, 7, 3);
            // Coin face
            graphics.fillStyle(coinColors[0].fill, 1);
            graphics.fillEllipse(pos.x, pos.y, 7, 3);
        });

        // Middle layer (2 coins)
        const middleCoins = [
            { x: center.x - 3, y: center.y + 2 },
            { x: center.x + 4, y: center.y + 3 }
        ];

        middleCoins.forEach(pos => {
            graphics.fillStyle(coinColors[1].edge, 0.9);
            graphics.fillEllipse(pos.x, pos.y + 2, 7, 3);
            graphics.fillStyle(coinColors[1].fill, 1);
            graphics.fillEllipse(pos.x, pos.y, 7, 3);
        });

        // Top coin (main focus)
        graphics.fillStyle(coinColors[2].edge, 0.9);
        graphics.fillEllipse(center.x, center.y - 2, 8, 4);
        graphics.fillStyle(coinColors[2].fill, 1);
        graphics.fillEllipse(center.x, center.y - 4, 8, 4);

        // Star emblem on top coin
        graphics.fillStyle(0xFFFFFF, 0.6);
        this.drawStar(graphics, center.x, center.y - 4, 4, 1.5, 3);

        // Highlight on top coin
        graphics.fillStyle(0xFFFFFF, 0.5);
        graphics.fillEllipse(center.x - 2, center.y - 5, 2, 1);

        // Sparkle effect
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(center.x + 6, center.y - 6, 1.5);

        return this.finalizeTexture(graphics, 'coinPile', size, size);
    }

    /**
     * Create all collectible textures at once
     * Call this in scene create() to pre-generate all collectible sprites
     */
    createAllCollectibleSprites() {
        this.createCosmicCoin();
        this.createCoinPile();
        this.createStarFragment();
        this.createCosmicGemCollectible();
        this.createAncientRelic();
        this.createEnergyOrbCollectible();
        this.createTreasureChestCollectible();
        this.createLoreFragment();
        console.log('[GraphicsEngine] All collectible sprites created');
    }

    // === UTILITY METHODS ===

    /**
     * Get seasonal foliage colors
     */
    /**
     * Create Void Wisp enemy sprite (ghostly wisp with purple-blue glow)
     * @returns {string} Texture name
     */
    createVoidWisp() {
        // Check if texture already exists
        if (this.scene.textures.exists('voidWisp')) {
            return 'voidWisp';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 24, y: 24 };
        const size = 48;

        // Outer glow layers (ethereal effect)
        const glowLayers = [
            { color: 0x4A0080, alpha: 0.2, radius: 22 },
            { color: 0x6B00B3, alpha: 0.3, radius: 18 },
            { color: 0x8B00D9, alpha: 0.4, radius: 14 }
        ];

        glowLayers.forEach(layer => {
            graphics.fillStyle(layer.color, layer.alpha);
            graphics.fillCircle(center.x, center.y, layer.radius);
        });

        // Main wisp body - gradient effect
        for (let i = 0; i < 10; i++) {
            const t = i / 9;
            const radius = 12 - i * 1.2;
            const alpha = 0.6 - t * 0.3;

            // Purple to cyan gradient
            const r = Math.floor(139 - (139 - 0) * t);
            const g = Math.floor(0 + (206 - 0) * t);
            const b = Math.floor(217 + (217 - 217) * t);
            const color = (r << 16) | (g << 8) | b;

            graphics.fillStyle(color, alpha);
            graphics.fillCircle(center.x, center.y, radius);
        }

        // Wispy tendrils (3 trailing wisps)
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI / 2) + (i - 1) * (Math.PI / 6);
            const length = 10 + i * 2;

            for (let j = 0; j < 4; j++) {
                const dist = length + j * 3;
                const wispX = center.x + Math.cos(angle + Math.PI) * dist;
                const wispY = center.y + Math.sin(angle + Math.PI) * dist;
                const wispRadius = 3 - j * 0.5;
                const wispAlpha = 0.4 - j * 0.1;

                graphics.fillStyle(0x8B00D9, wispAlpha);
                graphics.fillCircle(wispX, wispY, wispRadius);
            }
        }

        // Core sparkle (white center)
        graphics.fillStyle(0xFFFFFF, 0.8);
        graphics.fillCircle(center.x, center.y, 3);

        return this.finalizeTexture(graphics, 'voidWisp', size, size);
    }

    /**
     * Create Shadow Sprite enemy (darker, more solid enemy)
     * @returns {string} Texture name
     */
    createShadowSprite() {
        // Check if texture already exists
        if (this.scene.textures.exists('shadowSprite')) {
            return 'shadowSprite';
        }

        const graphics = this.createScratchGraphics();
        const center = { x: 28, y: 28 };
        const size = 56;

        // Dark aura
        graphics.fillStyle(0x0A0118, 0.4);
        graphics.fillCircle(center.x, center.y, 24);

        // Main body - rounded shape
        graphics.fillStyle(0x1A0A2E, 0.9);
        graphics.fillEllipse(center.x, center.y, 18, 20);

        // Shadow gradient layers
        for (let i = 0; i < 6; i++) {
            const t = i / 5;
            const width = 18 - i * 2;
            const height = 20 - i * 2.5;
            const alpha = 0.9 - t * 0.4;

            // Gradient from dark purple to near-black
            const r = Math.floor(26 - 26 * t);
            const g = Math.floor(10 - 10 * t);
            const b = Math.floor(46 - 46 * t);
            const color = (r << 16) | (g << 8) | b;

            graphics.fillStyle(color, alpha);
            graphics.fillEllipse(center.x, center.y, width, height);
        }

        // Sinister eyes (glowing red)
        const eyeY = center.y - 4;
        const eyeSpacing = 8;

        // Left eye
        graphics.fillStyle(0xFF0000, 0.8);
        graphics.fillCircle(center.x - eyeSpacing / 2, eyeY, 3);
        graphics.fillStyle(0xFF4444, 0.6);
        graphics.fillCircle(center.x - eyeSpacing / 2, eyeY, 4);

        // Right eye
        graphics.fillStyle(0xFF0000, 0.8);
        graphics.fillCircle(center.x + eyeSpacing / 2, eyeY, 3);
        graphics.fillStyle(0xFF4444, 0.6);
        graphics.fillCircle(center.x + eyeSpacing / 2, eyeY, 4);

        // Eye glow
        graphics.fillStyle(0xFFFFFF, 1.0);
        graphics.fillCircle(center.x - eyeSpacing / 2, eyeY, 1.5);
        graphics.fillCircle(center.x + eyeSpacing / 2, eyeY, 1.5);

        // Dark tendrils at bottom
        for (let i = 0; i < 4; i++) {
            const tendrilX = center.x - 9 + i * 6;
            const tendrilY = center.y + 12;

            graphics.fillStyle(0x16213E, 0.7);
            graphics.fillRect(tendrilX, tendrilY, 3, 8);

            // Fade effect
            graphics.fillStyle(0x16213E, 0.4);
            graphics.fillRect(tendrilX, tendrilY + 8, 3, 4);
        }

        return this.finalizeTexture(graphics, 'shadowSprite', size, size);
    }

    /**
     * Create Cosmic Shop building sprite
     * @returns {string} Texture name
     */
    createCosmicShop() {
        // Check if texture already exists
        if (this.scene.textures.exists('cosmicShop')) {
            return 'cosmicShop';
        }

        const graphics = this.createScratchGraphics();
        const width = 160;
        const height = 180;
        const centerX = width / 2;

        // Outer glow effect - teal/cyan to stand out from purple background
        graphics.fillStyle(0x00CED1, 0.15);
        graphics.fillCircle(centerX, 110, 70);
        graphics.fillStyle(0x00CED1, 0.1);
        graphics.fillCircle(centerX, 110, 85);

        // Building base - dark teal stone (contrasts with purple BG)
        graphics.fillStyle(0x0A2E2E, 1);
        graphics.fillRect(20, 70, 120, 100);

        // Stone texture lines - cyan tint
        graphics.lineStyle(1, 0x1A4747, 0.6);
        for (let i = 0; i < 10; i++) {
            const y = 75 + i * 10;
            graphics.lineBetween(20, y, 140, y);
        }

        // Vertical stone lines
        for (let i = 0; i < 5; i++) {
            const x = 35 + i * 25;
            graphics.lineBetween(x, 70, x, 170);
        }

        // Entrance archway - deeper
        graphics.fillStyle(0x001515, 0.95);
        graphics.fillRect(55, 120, 50, 50);

        // Archway top (rounded)
        graphics.fillCircle(centerX, 120, 25);

        // Mystical door glow - bright cyan
        graphics.fillStyle(0x00FFFF, 0.4);
        graphics.fillRect(57, 125, 46, 45);

        // Inner door glow
        graphics.fillStyle(0x00FFFF, 0.6);
        graphics.fillRect(62, 130, 36, 40);

        // Door detail - cosmic portal symbol
        graphics.lineStyle(3, 0xFFD700, 0.9);
        graphics.strokeCircle(centerX, 145, 12);

        // Star symbol on door - gold
        this.drawStar(graphics, centerX, 145, 6, 4, 8);

        // Portal swirl in door
        graphics.lineStyle(2, 0x00FFFF, 0.7);
        graphics.beginPath();
        graphics.arc(centerX, 145, 8, 0, Math.PI * 1.5);
        graphics.stroke();

        // Roof - gradient teal to cyan
        graphics.fillStyle(0x008B8B, 0.95);
        graphics.fillTriangle(
            centerX, 35,    // Top point
            10, 75,         // Left point
            150, 75         // Right point
        );

        // Roof trim - gold
        graphics.lineStyle(4, 0xFFD700, 1);
        graphics.lineBetween(10, 75, centerX, 35);
        graphics.lineBetween(centerX, 35, 150, 75);
        graphics.lineBetween(10, 75, 150, 75);

        // Roof details - tile pattern
        for (let i = 0; i < 7; i++) {
            const y = 42 + i * 5;
            const leftX = 30 + i * 7;
            const rightX = 130 - i * 7;
            graphics.lineStyle(1, 0x00CED1, 0.5);
            graphics.lineBetween(leftX, y, rightX, y);
        }

        // Roof peak ornament - golden star
        graphics.fillStyle(0xFFD700, 1);
        this.drawStar(graphics, centerX, 30, 5, 6, 10);

        // Chimney (left side)
        graphics.fillStyle(0x1A4747, 1);
        graphics.fillRect(30, 30, 18, 20);

        // Chimney smoke - cyan mist
        graphics.fillStyle(0x00FFFF, 0.3);
        graphics.fillCircle(39, 22, 6);
        graphics.fillCircle(36, 14, 5);
        graphics.fillCircle(41, 8, 4);

        // Windows (2) - larger
        const windowY = 85;

        // Left window - golden glow
        graphics.fillStyle(0xFFD700, 0.8);
        graphics.fillRect(30, windowY, 20, 22);
        graphics.lineStyle(3, 0x0A2E2E, 1);
        graphics.strokeRect(30, windowY, 20, 22);
        graphics.lineBetween(40, windowY, 40, windowY + 22);
        graphics.lineBetween(30, windowY + 11, 50, windowY + 11);

        // Right window
        graphics.fillStyle(0xFFD700, 0.8);
        graphics.fillRect(110, windowY, 20, 22);
        graphics.lineStyle(3, 0x0A2E2E, 1);
        graphics.strokeRect(110, windowY, 20, 22);
        graphics.lineBetween(120, windowY, 120, windowY + 22);
        graphics.lineBetween(110, windowY + 11, 130, windowY + 11);

        // Shop sign above door - "SHOP" indicator
        graphics.fillStyle(0x008B8B, 0.95);
        graphics.fillRoundedRect(45, 105, 70, 16, 4);

        // Sign border - gold
        graphics.lineStyle(3, 0xFFD700, 1);
        graphics.strokeRoundedRect(45, 105, 70, 16, 4);

        // Sign decorations - dots
        graphics.fillStyle(0xFFD700, 0.8);
        graphics.fillCircle(55, 113, 3);
        graphics.fillCircle(80, 113, 3);
        graphics.fillCircle(105, 113, 3);

        // Hanging sign chains
        graphics.lineStyle(2, 0xFFD700, 0.8);
        graphics.lineBetween(50, 95, 50, 105);
        graphics.lineBetween(110, 95, 110, 105);

        // Ground shadow
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillEllipse(centerX, 178, 70, 10);

        // Magical sparkles around building - more prominent
        const sparklePositions = [
            { x: 15, y: 55 },
            { x: 145, y: 60 },
            { x: 25, y: 110 },
            { x: 135, y: 115 },
            { x: centerX, y: 25 },
            { x: 45, y: 45 },
            { x: 115, y: 48 }
        ];

        sparklePositions.forEach(pos => {
            graphics.fillStyle(0xFFFFFF, 0.9);
            graphics.fillCircle(pos.x, pos.y, 3);
            graphics.lineStyle(2, 0x00FFFF, 0.7);
            graphics.lineBetween(pos.x - 5, pos.y, pos.x + 5, pos.y);
            graphics.lineBetween(pos.x, pos.y - 5, pos.x, pos.y + 5);
        });

        // Corner decorations - small golden gems
        graphics.fillStyle(0xFFD700, 0.9);
        graphics.fillCircle(20, 70, 4);
        graphics.fillCircle(140, 70, 4);
        graphics.fillCircle(20, 170, 4);
        graphics.fillCircle(140, 170, 4);

        return this.finalizeTexture(graphics, 'cosmicShop', width, height);
    }

    /**
     * Create Crashed Ship landmark for the Sanctuary
     * The player's wrecked spacecraft "The Wanderer" - narrative anchor for the game
     * Futuristic horizontal spacecraft design inspired by modern space vehicles
     * Features: stainless steel fuselage, delta wings, Raptor-style engines, heat shield tiles
     * @returns {string} Texture name
     */
    createCrashedShip() {
        if (this.scene.textures.exists('crashedShip')) {
            return 'crashedShip';
        }

        const graphics = this.createScratchGraphics();
        const width = 220;
        const height = 160;
        const centerX = width / 2;
        const centerY = height / 2;

        // === IMPACT CRATER AND GROUND ===
        graphics.fillStyle(0x0A0515, 0.8);
        graphics.fillEllipse(centerX, height - 15, 160, 30);
        graphics.fillStyle(0x1A0A2E, 0.5);
        graphics.fillEllipse(centerX, height - 18, 130, 22);

        // Scattered debris
        const debrisColors = [0x4A5568, 0x718096, 0x22D3EE, 0x3B82F6];
        for (let i = 0; i < 15; i++) {
            const dx = centerX + Phaser.Math.Between(-85, 85);
            const dy = height - Phaser.Math.Between(5, 35);
            graphics.fillStyle(Phaser.Math.RND.pick(debrisColors), 0.5);
            graphics.fillRect(dx, dy, Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 4));
        }

        // === MAIN FUSELAGE ===
        // Sleek, aerodynamic body - horizontal orientation, tilted from crash
        const tilt = -3; // Slight nose-down tilt
        const fuselageLength = 140;
        const fuselageHeight = 35;
        const noseX = 35;
        const tailX = noseX + fuselageLength;

        // Main hull - stainless steel look with gradient
        // Dark underside
        graphics.fillStyle(0x78909C, 1);
        graphics.beginPath();
        graphics.moveTo(noseX, centerY + tilt);
        graphics.lineTo(noseX + 25, centerY + fuselageHeight / 2 + tilt);
        graphics.lineTo(tailX - 10, centerY + fuselageHeight / 2);
        graphics.lineTo(tailX, centerY + 5);
        graphics.lineTo(tailX, centerY - 5);
        graphics.lineTo(tailX - 10, centerY - fuselageHeight / 2);
        graphics.lineTo(noseX + 25, centerY - fuselageHeight / 2 + tilt);
        graphics.closePath();
        graphics.fillPath();

        // Light upper hull - brushed metal appearance
        graphics.fillStyle(0xCFD8DC, 1);
        graphics.beginPath();
        graphics.moveTo(noseX, centerY + tilt);
        graphics.lineTo(noseX + 25, centerY - fuselageHeight / 2 + tilt);
        graphics.lineTo(tailX - 10, centerY - fuselageHeight / 2);
        graphics.lineTo(tailX, centerY - 5);
        graphics.lineTo(tailX, centerY + 5);
        // Smooth curve back to nose (using line segments instead of quadratic curve)
        graphics.lineTo(tailX - 15, centerY + 3);
        graphics.lineTo(tailX - 40, centerY + tilt);
        graphics.lineTo(noseX, centerY + tilt);
        graphics.closePath();
        graphics.fillPath();

        // Nose highlight
        graphics.fillStyle(0xECEFF1, 0.8);
        graphics.beginPath();
        graphics.moveTo(noseX, centerY + tilt);
        graphics.lineTo(noseX + 15, centerY - 10 + tilt);
        graphics.lineTo(noseX + 40, centerY - 8 + tilt);
        // Smooth curve back (using line segments)
        graphics.lineTo(noseX + 30, centerY - 2 + tilt);
        graphics.lineTo(noseX + 15, centerY + tilt);
        graphics.lineTo(noseX, centerY + tilt);
        graphics.closePath();
        graphics.fillPath();

        // === HEAT SHIELD TILES ===
        // Hexagonal pattern on underside (visible damage)
        graphics.lineStyle(1, 0x546E7A, 0.4);
        for (let i = 0; i < 8; i++) {
            const tileX = noseX + 30 + i * 15;
            const tileY = centerY + fuselageHeight / 3;
            graphics.strokeRect(tileX, tileY, 12, 8);
        }

        // Missing/damaged tiles
        graphics.fillStyle(0x37474F, 0.8);
        graphics.fillRect(noseX + 60, centerY + fuselageHeight / 3, 12, 8);
        graphics.fillRect(noseX + 90, centerY + fuselageHeight / 3 + 2, 12, 8);

        // === COCKPIT CANOPY ===
        // Wraparound glass canopy - modern fighter-style
        const canopyX = noseX + 20;
        const canopyY = centerY - 12 + tilt;

        // Canopy frame
        graphics.fillStyle(0x1A237E, 0.9);
        graphics.beginPath();
        graphics.moveTo(canopyX, canopyY + 5);
        graphics.lineTo(canopyX + 10, canopyY - 8);
        graphics.lineTo(canopyX + 50, canopyY - 10);
        graphics.lineTo(canopyX + 55, canopyY + 2);
        graphics.lineTo(canopyX + 50, canopyY + 8);
        graphics.lineTo(canopyX + 10, canopyY + 8);
        graphics.closePath();
        graphics.fillPath();

        // Glass with cyan tint
        graphics.fillStyle(0x00BCD4, 0.6);
        graphics.beginPath();
        graphics.moveTo(canopyX + 3, canopyY + 3);
        graphics.lineTo(canopyX + 12, canopyY - 5);
        graphics.lineTo(canopyX + 47, canopyY - 7);
        graphics.lineTo(canopyX + 50, canopyY + 2);
        graphics.lineTo(canopyX + 47, canopyY + 5);
        graphics.lineTo(canopyX + 12, canopyY + 5);
        graphics.closePath();
        graphics.fillPath();

        // Cracks in canopy
        graphics.lineStyle(1, 0xFFFFFF, 0.8);
        graphics.lineBetween(canopyX + 25, canopyY - 5, canopyX + 35, canopyY + 4);
        graphics.lineBetween(canopyX + 30, canopyY - 3, canopyX + 28, canopyY + 5);
        graphics.lineBetween(canopyX + 40, canopyY - 6, canopyX + 45, canopyY);

        // Canopy reflection
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillEllipse(canopyX + 20, canopyY - 2, 8, 3);

        // === DELTA WINGS ===
        // Swept-back wings - one damaged

        // Upper wing (intact) - angular stealth design
        graphics.fillStyle(0x90A4AE, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 15, centerY - fuselageHeight / 2);
        graphics.lineTo(centerX - 50, centerY - 55);
        graphics.lineTo(centerX + 30, centerY - 45);
        graphics.lineTo(centerX + 40, centerY - fuselageHeight / 2);
        graphics.closePath();
        graphics.fillPath();

        // Wing edge highlight
        graphics.lineStyle(2, 0xB0BEC5, 0.8);
        graphics.lineBetween(centerX - 50, centerY - 55, centerX + 30, centerY - 45);

        // Lower wing (damaged - broken off)
        graphics.fillStyle(0x78909C, 0.9);
        graphics.beginPath();
        graphics.moveTo(centerX - 10, centerY + fuselageHeight / 2);
        graphics.lineTo(centerX - 30, centerY + 50);
        graphics.lineTo(centerX + 10, centerY + 45);
        graphics.lineTo(centerX + 20, centerY + fuselageHeight / 2);
        graphics.closePath();
        graphics.fillPath();

        // Broken wing edge - jagged
        graphics.lineStyle(2, 0x546E7A, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 30, centerY + 50);
        graphics.lineTo(centerX - 25, centerY + 48);
        graphics.lineTo(centerX - 20, centerY + 52);
        graphics.lineTo(centerX - 10, centerY + 47);
        graphics.lineTo(centerX + 10, centerY + 45);
        graphics.strokePath();

        // === ENGINE SECTION ===
        // Three Raptor-style engines at rear
        const engineY = centerY;
        const engineStartX = tailX - 15;

        // Engine housings
        graphics.fillStyle(0x37474F, 1);
        graphics.fillEllipse(engineStartX, engineY - 12, 12, 8);
        graphics.fillEllipse(engineStartX, engineY, 14, 10);
        graphics.fillEllipse(engineStartX, engineY + 12, 12, 8);

        // Engine bells (dark interior)
        graphics.fillStyle(0x1A1A2E, 1);
        graphics.fillEllipse(engineStartX + 5, engineY - 12, 8, 5);
        graphics.fillEllipse(engineStartX + 5, engineY, 10, 7);
        graphics.fillEllipse(engineStartX + 5, engineY + 12, 8, 5);

        // Engine glow (damaged, flickering cyan)
        graphics.fillStyle(0x00BCD4, 0.4);
        graphics.fillEllipse(engineStartX + 10, engineY, 15, 12);
        graphics.fillStyle(0x26C6DA, 0.6);
        graphics.fillEllipse(engineStartX + 8, engineY, 8, 6);
        // Top engine has no glow (damaged)
        graphics.fillStyle(0x00BCD4, 0.2);
        graphics.fillEllipse(engineStartX + 8, engineY + 12, 6, 4);

        // === CONTROL SURFACES ===
        // Tail fins (vertical stabilizers)
        graphics.fillStyle(0x78909C, 1);
        // Upper fin
        graphics.beginPath();
        graphics.moveTo(tailX - 25, centerY - fuselageHeight / 2 + 5);
        graphics.lineTo(tailX - 35, centerY - 45);
        graphics.lineTo(tailX - 15, centerY - 38);
        graphics.lineTo(tailX - 10, centerY - fuselageHeight / 2 + 5);
        graphics.closePath();
        graphics.fillPath();

        // Lower fin (bent from crash)
        graphics.fillStyle(0x607D8B, 0.9);
        graphics.beginPath();
        graphics.moveTo(tailX - 25, centerY + fuselageHeight / 2 - 5);
        graphics.lineTo(tailX - 30, centerY + 38);
        graphics.lineTo(tailX - 20, centerY + 42);
        graphics.lineTo(tailX - 10, centerY + fuselageHeight / 2 - 5);
        graphics.closePath();
        graphics.fillPath();

        // === DAMAGE DETAILS ===
        // Scorch marks from re-entry/crash
        graphics.fillStyle(0x1F1F1F, 0.6);
        graphics.fillEllipse(centerX + 20, centerY + 5, 15, 8);
        graphics.fillEllipse(noseX + 50, centerY + 8, 10, 5);

        // Hull breach with sparks
        graphics.fillStyle(0x0F0F0F, 0.9);
        graphics.fillEllipse(centerX - 20, centerY + 10, 10, 6);
        // Sparking wires
        graphics.lineStyle(1, 0xFBBF24, 0.8);
        graphics.lineBetween(centerX - 22, centerY + 8, centerX - 30, centerY + 15);
        graphics.lineStyle(1, 0x22D3EE, 0.8);
        graphics.lineBetween(centerX - 18, centerY + 12, centerX - 12, centerY + 22);
        graphics.lineStyle(1, 0xEF4444, 0.7);
        graphics.lineBetween(centerX - 20, centerY + 10, centerX - 25, centerY + 20);

        // === PANEL SEAMS ===
        graphics.lineStyle(1, 0x546E7A, 0.5);
        // Longitudinal seams
        graphics.lineBetween(noseX + 30, centerY - 8 + tilt, tailX - 20, centerY - 8);
        graphics.lineBetween(noseX + 35, centerY + 10 + tilt, tailX - 20, centerY + 10);
        // Transverse seams
        graphics.lineBetween(centerX - 30, centerY - 15, centerX - 30, centerY + 15);
        graphics.lineBetween(centerX + 20, centerY - 15, centerX + 20, centerY + 15);

        // === ALIEN MOSS/VOID GROWTH ===
        graphics.fillStyle(0x8B5CF6, 0.7);
        graphics.fillCircle(noseX + 10, centerY + 20, 5);
        graphics.fillCircle(noseX + 5, centerY + 15, 3);
        graphics.fillStyle(0xA78BFA, 0.6);
        graphics.fillCircle(tailX - 30, centerY + 25, 4);
        graphics.fillCircle(centerX - 40, centerY + 55, 6);

        // === SMOKE/STEAM WISPS ===
        graphics.fillStyle(0x6B7280, 0.25);
        graphics.fillCircle(centerX - 15, centerY - 50, 10);
        graphics.fillCircle(centerX - 25, centerY - 60, 7);
        graphics.fillCircle(centerX - 10, centerY - 65, 5);
        // Engine smoke
        graphics.fillCircle(tailX + 5, engineY + 5, 12);
        graphics.fillCircle(tailX + 15, engineY - 5, 8);

        // === IDENTIFICATION MARKINGS ===
        // "V-01" designation on hull
        graphics.fillStyle(0x263238, 0.8);
        graphics.fillRect(centerX - 5, centerY - 13, 25, 10);
        graphics.fillStyle(0xFFFFFF, 0.9);
        // Simplified text representation with lines
        graphics.lineStyle(2, 0xFFFFFF, 0.9);
        // "V"
        graphics.lineBetween(centerX - 2, centerY - 11, centerX + 2, centerY - 5);
        graphics.lineBetween(centerX + 2, centerY - 5, centerX + 6, centerY - 11);
        // "-"
        graphics.lineBetween(centerX + 9, centerY - 8, centerX + 13, centerY - 8);
        // "0"
        graphics.strokeCircle(centerX + 17, centerY - 8, 2.5);

        // === STATUS LIGHTS ===
        // Power still flickering
        graphics.fillStyle(0x22C55E, 0.9);
        graphics.fillCircle(canopyX + 55, canopyY + 3, 2);
        graphics.fillStyle(0x4ADE80, 0.4);
        graphics.fillCircle(canopyX + 55, canopyY + 3, 4);
        // Warning light (red, blinking)
        graphics.fillStyle(0xEF4444, 1);
        graphics.fillCircle(tailX - 30, centerY - 20, 2);
        graphics.fillStyle(0xF87171, 0.4);
        graphics.fillCircle(tailX - 30, centerY - 20, 5);

        // === LANDING GEAR (deployed/damaged) ===
        graphics.fillStyle(0x37474F, 1);
        // Front gear strut
        graphics.fillRect(noseX + 30, centerY + fuselageHeight / 2 + 5, 4, 15);
        graphics.fillCircle(noseX + 32, centerY + fuselageHeight / 2 + 20, 4);
        // Rear gear (bent)
        graphics.fillRect(tailX - 40, centerY + fuselageHeight / 2 + 5, 4, 12);
        graphics.fillCircle(tailX - 38, centerY + fuselageHeight / 2 + 18, 4);

        return this.finalizeTexture(graphics, 'crashedShip', width, height);
    }

    /**
     * Create Hub Portal landmark for the Sanctuary
     * A mystical portal that leads to other worlds
     * @returns {string} Texture name
     */
    createHubPortal() {
        if (this.scene.textures.exists('hubPortal')) {
            return 'hubPortal';
        }

        const graphics = this.createScratchGraphics();
        const width = 160;
        const height = 180;
        const centerX = width / 2;
        const portalY = 90;

        // Ground platform - ancient stone
        graphics.fillStyle(0x2D2D4A, 1);
        graphics.fillEllipse(centerX, height - 20, 70, 18);
        graphics.fillStyle(0x1A1A3E, 1);
        graphics.fillEllipse(centerX, height - 15, 60, 12);

        // Stone pillars on sides
        graphics.fillStyle(0x3D3D5C, 1);
        graphics.fillRect(15, 50, 25, 110);
        graphics.fillRect(120, 50, 25, 110);

        // Pillar tops
        graphics.fillStyle(0x4D4D6C, 1);
        graphics.fillRect(10, 45, 35, 12);
        graphics.fillRect(115, 45, 35, 12);

        // Rune carvings on pillars
        graphics.lineStyle(2, 0x9370DB, 0.6);
        // Left pillar runes
        graphics.lineBetween(22, 70, 32, 80);
        graphics.lineBetween(32, 70, 22, 80);
        graphics.strokeCircle(27, 100, 8);
        graphics.lineBetween(22, 120, 32, 130);
        // Right pillar runes
        graphics.lineBetween(127, 70, 137, 80);
        graphics.lineBetween(137, 70, 127, 80);
        graphics.strokeCircle(132, 100, 8);
        graphics.lineBetween(127, 120, 137, 130);

        // Portal arch
        graphics.lineStyle(6, 0x4B0082, 1);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 20, 50, Math.PI, 0);
        graphics.strokePath();

        // Inner arch glow
        graphics.lineStyle(3, 0x7B68EE, 0.8);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 20, 45, Math.PI, 0);
        graphics.strokePath();

        // Portal energy field - outer glow
        graphics.fillStyle(0x9370DB, 0.2);
        graphics.fillCircle(centerX, portalY + 20, 48);
        graphics.fillStyle(0x7B68EE, 0.3);
        graphics.fillCircle(centerX, portalY + 20, 40);
        graphics.fillStyle(0x6B5BD2, 0.4);
        graphics.fillCircle(centerX, portalY + 20, 32);

        // Portal swirl effect
        graphics.lineStyle(3, 0x00CED1, 0.6);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 20, 25, 0, Math.PI * 1.5);
        graphics.strokePath();

        graphics.lineStyle(2, 0x00FFFF, 0.5);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 20, 18, Math.PI * 0.5, Math.PI * 2);
        graphics.strokePath();

        // Center star/core
        graphics.fillStyle(0xFFFFFF, 0.9);
        this.drawStar(graphics, centerX, portalY + 20, 6, 5, 12);
        graphics.fillStyle(0x00FFFF, 0.8);
        this.drawStar(graphics, centerX, portalY + 20, 6, 3, 8);

        // Floating energy particles
        const particles = [
            { x: centerX - 30, y: portalY },
            { x: centerX + 30, y: portalY },
            { x: centerX - 20, y: portalY + 40 },
            { x: centerX + 20, y: portalY + 40 },
            { x: centerX, y: portalY - 10 }
        ];
        particles.forEach(p => {
            graphics.fillStyle(0x00FFFF, 0.7);
            graphics.fillCircle(p.x, p.y, 3);
            graphics.fillStyle(0xFFFFFF, 0.5);
            graphics.fillCircle(p.x, p.y, 1.5);
        });

        // Top decoration - cosmic crystal
        graphics.fillStyle(0x9370DB, 0.9);
        graphics.fillTriangle(centerX, 15, centerX - 12, 45, centerX + 12, 45);
        graphics.fillStyle(0xE0E0FF, 0.6);
        graphics.fillTriangle(centerX, 20, centerX - 6, 40, centerX + 2, 40);

        // Ground glow
        graphics.fillStyle(0x7B68EE, 0.15);
        graphics.fillEllipse(centerX, height - 10, 80, 20);

        return this.finalizeTexture(graphics, 'hubPortal', width, height);
    }

    /**
     * Create Void Portal - An ominous black hole that pulls creatures in
     * Features: gravitational lensing effect, swirling accretion disk, dark center
     * Used for the void mini-game entrance
     * @returns {string} Texture name
     */
    createVoidPortal() {
        if (this.scene.textures.exists('voidPortal')) {
            return 'voidPortal';
        }

        const graphics = this.createScratchGraphics();
        const width = 200;
        const height = 200;
        const centerX = width / 2;
        const centerY = height / 2;
        const blackHoleRadius = 35;

        // === GRAVITATIONAL LENSING EFFECT ===
        // Outer distortion rings (warped starlight)
        for (let i = 8; i >= 1; i--) {
            const ringRadius = blackHoleRadius + (i * 12);
            const alpha = 0.15 - (i * 0.015);

            // Distorted light ring (bluish-white on one side, reddish on other - doppler effect)
            graphics.lineStyle(2, 0x6699FF, alpha);
            graphics.beginPath();
            graphics.arc(centerX, centerY, ringRadius, Math.PI * 0.2, Math.PI * 1.3);
            graphics.strokePath();

            graphics.lineStyle(2, 0xFF6644, alpha * 0.7);
            graphics.beginPath();
            graphics.arc(centerX, centerY, ringRadius, Math.PI * 1.3, Math.PI * 2.2);
            graphics.strokePath();
        }

        // === ACCRETION DISK ===
        // Swirling matter being pulled into the black hole

        // Outer accretion disk glow (orange/yellow - hot matter)
        graphics.fillStyle(0xFF6600, 0.15);
        graphics.fillEllipse(centerX, centerY, 75, 30);
        graphics.fillStyle(0xFF9900, 0.2);
        graphics.fillEllipse(centerX, centerY, 65, 25);
        graphics.fillStyle(0xFFCC00, 0.25);
        graphics.fillEllipse(centerX, centerY, 55, 20);

        // Inner accretion disk (brighter, more intense)
        graphics.fillStyle(0xFFFF66, 0.3);
        graphics.fillEllipse(centerX, centerY, 48, 16);
        graphics.fillStyle(0xFFFFCC, 0.35);
        graphics.fillEllipse(centerX, centerY, 42, 12);

        // Spiral arms in the accretion disk
        graphics.lineStyle(3, 0xFFAA00, 0.4);
        for (let arm = 0; arm < 3; arm++) {
            const startAngle = (arm * Math.PI * 2 / 3);
            graphics.beginPath();
            for (let t = 0; t < 1; t += 0.05) {
                const angle = startAngle + (t * Math.PI * 1.5);
                const r = blackHoleRadius + 10 + (t * 35);
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r * 0.35; // Flattened for disk perspective
                if (t === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.strokePath();
        }

        // === EVENT HORIZON ===
        // The point of no return - gradient to pure black

        // Outer event horizon glow
        graphics.fillStyle(0x1A0033, 0.9);
        graphics.fillCircle(centerX, centerY, blackHoleRadius + 8);
        graphics.fillStyle(0x0D001A, 0.95);
        graphics.fillCircle(centerX, centerY, blackHoleRadius + 4);

        // The black hole center - absolute void
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(centerX, centerY, blackHoleRadius);

        // Subtle inner ring (photon sphere)
        graphics.lineStyle(1, 0x330066, 0.5);
        graphics.strokeCircle(centerX, centerY, blackHoleRadius - 2);

        // === HAWKING RADIATION PARTICLES ===
        // Tiny particles escaping near the event horizon
        const particles = [
            { x: centerX - 42, y: centerY - 15, size: 2 },
            { x: centerX + 45, y: centerY + 10, size: 1.5 },
            { x: centerX - 38, y: centerY + 20, size: 2 },
            { x: centerX + 40, y: centerY - 18, size: 1.5 },
            { x: centerX - 50, y: centerY - 5, size: 1 },
            { x: centerX + 48, y: centerY + 2, size: 1 },
            { x: centerX, y: centerY - 45, size: 2 },
            { x: centerX + 5, y: centerY + 42, size: 1.5 }
        ];

        particles.forEach(p => {
            // Particle glow
            graphics.fillStyle(0x9966FF, 0.4);
            graphics.fillCircle(p.x, p.y, p.size + 2);
            // Particle core
            graphics.fillStyle(0xCC99FF, 0.8);
            graphics.fillCircle(p.x, p.y, p.size);
            // Bright center
            graphics.fillStyle(0xFFFFFF, 0.6);
            graphics.fillCircle(p.x, p.y, p.size * 0.4);
        });

        // === GRAVITATIONAL PULL INDICATOR ===
        // Subtle arrows/lines showing matter being pulled in
        graphics.lineStyle(1, 0x666699, 0.3);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startR = blackHoleRadius + 60;
            const endR = blackHoleRadius + 25;
            const startX = centerX + Math.cos(angle) * startR;
            const startY = centerY + Math.sin(angle) * startR;
            const endX = centerX + Math.cos(angle) * endR;
            const endY = centerY + Math.sin(angle) * endR;
            graphics.lineBetween(startX, startY, endX, endY);
        }

        // === OMINOUS OUTER GLOW ===
        // Deep purple/void glow around the entire structure
        graphics.fillStyle(0x1A0033, 0.1);
        graphics.fillCircle(centerX, centerY, 95);
        graphics.fillStyle(0x0D001A, 0.08);
        graphics.fillCircle(centerX, centerY, 98);

        return this.finalizeTexture(graphics, 'voidPortal', width, height);
    }

    /**
     * Create a return portal for traveling back to Sanctuary
     * A smaller, home-themed portal with warm colors
     * @returns {string} Texture name
     */
    createReturnPortal() {
        if (this.scene.textures.exists('returnPortal')) {
            return 'returnPortal';
        }

        const graphics = this.createScratchGraphics();
        const width = 140;
        const height = 160;
        const centerX = width / 2;
        const portalY = 80;

        // Ground platform
        graphics.fillStyle(0x2D4A3D, 1);
        graphics.fillEllipse(centerX, height - 15, 55, 14);
        graphics.fillStyle(0x1A3E2D, 1);
        graphics.fillEllipse(centerX, height - 10, 45, 10);

        // Vine-wrapped pillars
        graphics.fillStyle(0x3D5C4D, 1);
        graphics.fillRect(20, 45, 20, 95);
        graphics.fillRect(100, 45, 20, 95);

        // Pillar tops
        graphics.fillStyle(0x4D6C5C, 1);
        graphics.fillRect(15, 40, 30, 10);
        graphics.fillRect(95, 40, 30, 10);

        // Vine details on pillars (using line segments to approximate curves)
        graphics.lineStyle(2, 0x4CAF50, 0.7);
        // Left pillar vines - draw as connected line segments
        graphics.beginPath();
        graphics.moveTo(25, 50);
        graphics.lineTo(30, 65);
        graphics.lineTo(25, 80);
        graphics.lineTo(30, 95);
        graphics.lineTo(25, 110);
        graphics.lineTo(35, 120);
        graphics.strokePath();
        // Right pillar vines
        graphics.beginPath();
        graphics.moveTo(115, 50);
        graphics.lineTo(110, 65);
        graphics.lineTo(115, 80);
        graphics.lineTo(110, 95);
        graphics.lineTo(115, 110);
        graphics.lineTo(105, 120);
        graphics.strokePath();

        // Portal arch - natural stone
        graphics.lineStyle(5, 0x4A6A5A, 1);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 15, 40, Math.PI, 0);
        graphics.strokePath();

        // Inner arch glow (home warm tones)
        graphics.lineStyle(3, 0xFFD700, 0.8);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 15, 35, Math.PI, 0);
        graphics.strokePath();

        // Portal energy field - warm colors
        graphics.fillStyle(0xFFA500, 0.2);
        graphics.fillCircle(centerX, portalY + 15, 38);
        graphics.fillStyle(0xFFD700, 0.3);
        graphics.fillCircle(centerX, portalY + 15, 30);
        graphics.fillStyle(0xFFFF00, 0.3);
        graphics.fillCircle(centerX, portalY + 15, 22);

        // Swirl effect
        graphics.lineStyle(2, 0x7B68EE, 0.5);
        graphics.beginPath();
        graphics.arc(centerX, portalY + 15, 18, 0, Math.PI * 1.5);
        graphics.strokePath();

        // Home icon in center (simple house shape)
        graphics.fillStyle(0xFFFFFF, 0.8);
        // House body
        graphics.fillTriangle(centerX, portalY - 5, centerX - 12, portalY + 15, centerX + 12, portalY + 15);
        graphics.fillRect(centerX - 8, portalY + 15, 16, 15);
        // Door
        graphics.fillStyle(0xFFD700, 0.9);
        graphics.fillRect(centerX - 3, portalY + 20, 6, 10);

        // Small floating leaves
        const leaves = [
            { x: centerX - 25, y: portalY - 5 },
            { x: centerX + 25, y: portalY },
            { x: centerX - 15, y: portalY + 35 },
            { x: centerX + 18, y: portalY + 30 }
        ];
        leaves.forEach(l => {
            graphics.fillStyle(0x7CB342, 0.8);
            graphics.fillEllipse(l.x, l.y, 4, 2);
        });

        // "Return Home" glow at base
        graphics.fillStyle(0xFFD700, 0.2);
        graphics.fillEllipse(centerX, height - 5, 60, 15);

        // Sparkles
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(centerX - 20, portalY - 10, 2);
        graphics.fillCircle(centerX + 22, portalY + 5, 2);
        graphics.fillCircle(centerX, portalY + 40, 2);

        return this.finalizeTexture(graphics, 'returnPortal', width, height);
    }

    /**
     * Create a simple campfire for the living area
     * @returns {string} Texture name
     */
    createCampfire() {
        if (this.scene.textures.exists('campfire')) {
            return 'campfire';
        }

        const graphics = this.createScratchGraphics();
        const width = 60;
        const height = 70;
        const centerX = width / 2;

        // Stone ring
        graphics.fillStyle(0x4A4A4A, 1);
        graphics.fillEllipse(centerX, height - 10, 28, 10);
        graphics.fillStyle(0x3A3A3A, 1);
        graphics.fillEllipse(centerX, height - 8, 22, 7);

        // Logs
        graphics.fillStyle(0x5D4037, 1);
        graphics.fillRect(centerX - 18, height - 25, 36, 8);
        graphics.fillStyle(0x4E342E, 1);
        graphics.fillRect(centerX - 12, height - 32, 24, 7);

        // Fire glow base
        graphics.fillStyle(0xFF6600, 0.3);
        graphics.fillCircle(centerX, height - 35, 25);
        graphics.fillStyle(0xFF4400, 0.4);
        graphics.fillCircle(centerX, height - 35, 18);

        // Fire flames
        graphics.fillStyle(0xFF6600, 0.9);
        graphics.fillTriangle(centerX, height - 55, centerX - 10, height - 25, centerX + 8, height - 28);
        graphics.fillStyle(0xFFAA00, 0.9);
        graphics.fillTriangle(centerX - 5, height - 48, centerX - 12, height - 28, centerX + 2, height - 30);
        graphics.fillTriangle(centerX + 5, height - 50, centerX - 2, height - 28, centerX + 12, height - 26);
        graphics.fillStyle(0xFFDD00, 0.8);
        graphics.fillTriangle(centerX, height - 42, centerX - 6, height - 30, centerX + 6, height - 30);

        // Sparks
        graphics.fillStyle(0xFFFF00, 0.8);
        graphics.fillCircle(centerX - 8, height - 50, 2);
        graphics.fillCircle(centerX + 10, height - 55, 1.5);
        graphics.fillCircle(centerX + 3, height - 58, 1);

        return this.finalizeTexture(graphics, 'campfire', width, height);
    }

    /**
     * Create animated Void Merchant shopkeeper sprite
     * @param {number} frame - Animation frame (0-3 for idle animation)
     * @returns {string} - Texture name
     */
    createVoidMerchant(frame = 0) {
        const width = 80;
        const height = 120;
        const graphics = this.createScratchGraphics();
        const centerX = width / 2;

        // Animation parameters based on frame
        const floatOffset = Math.sin((frame / 3) * Math.PI * 2) * 3;
        const orbRotation = (frame / 3) * Math.PI * 2;
        const eyeGlow = 0.5 + Math.sin((frame / 3) * Math.PI * 2) * 0.3;

        // Body - flowing cosmic robe
        const bodyY = 45 + floatOffset;

        // Robe shadow/base
        graphics.fillStyle(0x0A0520, 0.8);
        graphics.fillEllipse(centerX, bodyY + 45, 30, 12);

        // Main robe body - dark purple with gradient
        for (let i = 0; i < 40; i++) {
            const t = i / 40;
            const y = bodyY + i;
            const width_at_y = 20 + (t * 15); // Widens toward bottom
            const alpha = 0.9 - (t * 0.2);

            graphics.fillStyle(0x2A0040, alpha);
            graphics.fillEllipse(centerX, y, width_at_y, 3);
        }

        // Robe highlights (lighter purple)
        graphics.fillStyle(0x4A0080, 0.7);
        graphics.fillEllipse(centerX - 8, bodyY + 15, 8, 25);
        graphics.fillEllipse(centerX + 8, bodyY + 15, 8, 25);

        // Cosmic patterns on robe (stars and runes)
        const patterns = [
            { x: centerX - 10, y: bodyY + 20, size: 3 },
            { x: centerX + 8, y: bodyY + 28, size: 2 },
            { x: centerX - 5, y: bodyY + 35, size: 2.5 },
            { x: centerX + 12, y: bodyY + 43, size: 2 }
        ];

        patterns.forEach(p => {
            graphics.fillStyle(0x00FFFF, 0.6);
            this.drawStar(graphics, p.x, p.y, 4, p.size * 0.5, p.size);
        });

        // Head - hooded figure
        const headY = bodyY - 15;

        // Hood shadow
        graphics.fillStyle(0x1A0A2E, 0.9);
        graphics.fillCircle(centerX, headY, 22);

        // Face area (dark, mysterious)
        graphics.fillStyle(0x0A0520, 1);
        graphics.fillEllipse(centerX, headY + 2, 16, 20);

        // Hood
        graphics.fillStyle(0x2A0040, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 28, headY);
        graphics.lineTo(centerX, headY - 35);
        graphics.lineTo(centerX + 28, headY);
        graphics.lineTo(centerX + 20, headY + 10);
        graphics.lineTo(centerX - 20, headY + 10);
        graphics.closePath();
        graphics.fillPath();

        // Hood trim (lighter purple)
        graphics.lineStyle(2, 0x6B00B3);
        graphics.beginPath();
        graphics.arc(centerX, headY + 10, 20, 0, Math.PI, true);
        graphics.strokePath();

        // Glowing eyes with animation
        const eyeY = headY - 2;
        const eyeSize = 5 + eyeGlow * 2;

        // Left eye
        graphics.fillStyle(0x00FFFF, eyeGlow);
        graphics.fillCircle(centerX - 8, eyeY, eyeSize);
        graphics.fillStyle(0x00FFFF, eyeGlow * 1.5);
        graphics.fillCircle(centerX - 8, eyeY, eyeSize * 0.6);

        // Right eye
        graphics.fillStyle(0x00FFFF, eyeGlow);
        graphics.fillCircle(centerX + 8, eyeY, eyeSize);
        graphics.fillStyle(0x00FFFF, eyeGlow * 1.5);
        graphics.fillCircle(centerX + 8, eyeY, eyeSize * 0.6);

        // Floating mystical orb (rotates with animation)
        const orbDistance = 25;
        const orbX = centerX + Math.cos(orbRotation) * orbDistance;
        const orbY = bodyY - 25 + Math.sin(orbRotation) * 15;

        // Orb glow
        graphics.fillStyle(0xFFD700, 0.2);
        graphics.fillCircle(orbX, orbY, 14);
        graphics.fillStyle(0xFFD700, 0.4);
        graphics.fillCircle(orbX, orbY, 10);

        // Orb core
        graphics.fillStyle(0xFFD700, 0.9);
        graphics.fillCircle(orbX, orbY, 7);
        graphics.fillStyle(0xFFFFFF, 0.8);
        graphics.fillCircle(orbX - 2, orbY - 2, 3);

        // Mystical particles around orb
        const particleAngle = orbRotation + Math.PI / 4;
        for (let i = 0; i < 4; i++) {
            const angle = particleAngle + (i * Math.PI / 2);
            const px = orbX + Math.cos(angle) * 12;
            const py = orbY + Math.sin(angle) * 12;

            graphics.fillStyle(0xFFD700, 0.5);
            graphics.fillCircle(px, py, 2);
        }

        // Hands (simple dark shapes at sides)
        graphics.fillStyle(0x1A0A2E, 0.8);
        graphics.fillCircle(centerX - 25, bodyY + 5, 6);
        graphics.fillCircle(centerX + 25, bodyY + 5, 6);

        const textureName = `voidMerchant_${frame}`;
        return this.finalizeTexture(graphics, textureName, width, height);
    }

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
     * Finalize texture creation and cleanup with error handling
     */
    finalizeTexture(graphics, name, width, height) {
        try {
            if (!graphics || typeof graphics.generateTexture !== 'function') {
                throw new Error('Invalid graphics object');
            }

            if (!name || typeof name !== 'string') {
                throw new Error('Invalid texture name');
            }

            graphics.generateTexture(name, width, height);
            graphics.destroy();
            return name;
        } catch (error) {
            console.error('graphics:error [GraphicsEngine] Failed to finalize texture:', error);

            // Try to clean up graphics even if generation failed
            try {
                if (graphics && typeof graphics.destroy === 'function') {
                    graphics.destroy();
                }
            } catch (cleanupError) {
                console.warn('graphics:warn [GraphicsEngine] Failed to cleanup graphics:', cleanupError);
            }

            // Return a fallback texture name
            const fallbackName = `fallback_${Date.now()}`;
            console.warn(`graphics:warn [GraphicsEngine] Using fallback texture: ${fallbackName}`);
            return fallbackName;
        }
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
    createRandomizedSpaceMythicCreature(genetics, frame = 0, stage = 'adult') {
        console.log(`graphics:debug [GraphicsEngine] createRandomizedSpaceMythicCreature called with stage: "${stage}"`);

        // Input validation
        if (!genetics || !genetics.traits) {
            console.warn('graphics:warn [GraphicsEngine] Invalid genetics provided, using defaults');
            return this.createSpaceMythicCreature({ frame });
        }

        try {
            const startTime = Date.now();

            // Get stage visual configuration
            const stageConfig = this.getStageVisualConfig(stage);
            console.log(`graphics:debug [GraphicsEngine] Stage config for "${stage}":`, stageConfig);

            // USE STAGE VISUAL RESOLVER for dramatic stage-based transformations
            // This creates completely different appearances per stage (baby blob -> adult form -> elder transcendence)
            let resolvedTraits = null;
            if (window.StageVisualResolver) {
                const resolver = new window.StageVisualResolver();
                resolvedTraits = resolver.resolveTraitsForStage(genetics, stage);
                console.log(`graphics:debug [GraphicsEngine] Stage-resolved body type: "${resolvedTraits.bodyType}" (destiny: "${resolvedTraits.destinyBodyType}")`);
            }

            // Convert genetic data to visual parameters
            const visualConfig = this.geneticsToVisualConfig(genetics);

            // Apply stage-based color modifications (use resolved colors if available)
            const stageModifiedColors = resolvedTraits?.colors
                ? resolvedTraits.colors
                : this.applyStageColorModifications(visualConfig.colors, stageConfig);

            // Determine body type - use resolved stage-aware type if available
            const effectiveBodyType = resolvedTraits?.bodyType || genetics.traits.bodyShape?.type || 'balanced';
            const destinyBodyType = genetics.traits.bodyShape?.type || 'balanced';

            // Apply body shape modifications based on resolved or genetic body type
            const bodyModifications = this.calculateBodyModifications({
                type: effectiveBodyType.startsWith('baby_') || effectiveBodyType.startsWith('transitional_') || effectiveBodyType.startsWith('elder_')
                    ? destinyBodyType // Use destiny for calculating mods
                    : effectiveBodyType,
                intensity: genetics.traits.bodyShape?.intensity || 0.5
            });

            // Create enhanced creature with genetic modifications
            const enhancedTraits = {
                ...genetics.traits.features,
                bodyMods: bodyModifications,
                stageConfig: stageConfig,
                resolvedBodyType: effectiveBodyType, // Stage-aware body type
                destinyBodyType: destinyBodyType,    // What they'll become as adult
                resolvedFeatures: resolvedTraits?.features // Stage-appropriate features
            };

            // Create base creature with stage-based size
            const baseSize = {
                width: Math.round(60 * stageConfig.scale),
                height: Math.round(80 * stageConfig.scale)
            };
            console.log(`graphics:debug [GraphicsEngine] Base size for stage "${stage}":`, baseSize, '(scale:', stageConfig.scale, ')');

            // Adjust eye size based on stage (babies have proportionally larger eyes)
            const eyeSizeMultiplier = stageConfig.eyeSizeMultiplier || 1.0;

            const metrics = this.getCreatureCanvasMetrics(enhancedTraits, baseSize);

            const graphics = this.createScratchGraphics();
            const translation = this.safeGraphicsTranslate(graphics, metrics.padding);

            const center = {
                x: metrics.baseCenter.x + translation.centerShift.x,
                y: metrics.baseCenter.y + translation.centerShift.y
            };

            // Render using stage-aware body type for dramatic transformation
            this.renderStageAwareCreatureBody(
                graphics,
                center,
                baseSize,
                stageModifiedColors,
                frame,
                enhancedTraits,
                stageConfig,
                resolvedTraits
            );

            // Add enhanced markings based on resolved complexity or genetics
            const markingOpacity = resolvedTraits?.markings?.opacity ?? stageConfig.markingOpacity ?? 1.0;
            if (markingOpacity > 0.1) {
                const markingsToUse = resolvedTraits?.markings || genetics.traits.features.markings;
                this.addEnhancedMarkings(
                    graphics, center, baseSize,
                    markingsToUse,
                    genetics.traits.colorGenome,
                    markingOpacity
                );
            }

            // Add rarity-based special effects (scaled by stage glow intensity)
            const glowIntensity = stageConfig.glowIntensity || 1.0;
            if (glowIntensity > 0.2) {
                this.addRarityEffects(graphics, genetics, center, {
                    width: metrics.width,
                    height: metrics.height
                }, glowIntensity);
            }

            // Add cosmic affinity effects (scaled by stage)
            this.addCosmicAffinityEffects(graphics, genetics.cosmicAffinity, center, glowIntensity);

            // Add personality-based visual traits
            this.addPersonalityEffects(graphics, genetics.personality, center, baseSize);

            // Add stage-specific effects (cute sparkles for baby, wisdom for elder, etc.)
            this.addStageEffects(graphics, stage, stageConfig, center, baseSize, genetics);

            // Add elder wisdom marks if applicable
            if (stageConfig.hasWisdomMarks || stage === 'elder') {
                this.addElderWisdomMarks(graphics, center, baseSize, stageConfig);
            }

            // Add wacky mutations if present (includes inherited mutations from breeding)
            let allMutations = resolvedTraits?.wackyMutations || [];

            // Check for inherited mutations from breeding visual config
            const breedingVisuals = genetics.traits?.breedingVisuals;
            if (breedingVisuals?.inheritedMutations && breedingVisuals.inheritedMutations.length > 0) {
                allMutations = [...allMutations, ...breedingVisuals.inheritedMutations];
                console.log(`graphics:debug [GraphicsEngine] Added ${breedingVisuals.inheritedMutations.length} inherited mutations from breeding`);
            }

            if (allMutations.length > 0) {
                this.renderWackyMutations(graphics, center, baseSize, allMutations, stageModifiedColors);
            }

            // Apply breeding-based horn type if available
            if (breedingVisuals?.headMods?.horns?.type && breedingVisuals.headMods.horns.type !== 'none') {
                const hornConfig = breedingVisuals.headMods.horns;
                const hornColor = stageModifiedColors.accent || stageModifiedColors.primary || 0x9370DB;
                this.renderHorns(graphics, center, hornColor, hornConfig.type, hornConfig.size || 1.0);
                console.log(`graphics:debug [GraphicsEngine] Rendered breeding-inherited horns: ${hornConfig.type}`);
            }

            // Apply shiny effects if creature is shiny
            if (genetics.isShiny && genetics.shinyType) {
                this.applyShinyEffects(graphics, center, baseSize, genetics.shinyType, genetics.traits.colorGenome);
            }

            translation.restore();

            const textureName = `creature_${genetics.id}_${stage}_${frame}`;
            const textureResult = this.finalizeTexture(graphics, textureName, metrics.width, metrics.height);

            const generationTime = Date.now() - startTime;

            console.log(`graphics:debug [GraphicsEngine] Created ${stage} ${genetics.rarity} ${genetics.species} in ${generationTime}ms`, {
                textureId: textureName,
                genetics: genetics.id,
                stage: stage,
                scale: stageConfig.scale,
                bodyType: effectiveBodyType
            });

            return {
                textureName,
                genetics,
                visualConfig,
                stage,
                stageConfig,
                resolvedTraits,
                metadata: {
                    generationTime,
                    frame,
                    stage,
                    createdAt: Date.now()
                }
            };
        } catch (error) {
            console.error('graphics:error [GraphicsEngine] Failed to create randomized creature:', error);

            // Emit error event for ErrorHandler
            if (typeof window !== 'undefined' && window.ErrorHandler && typeof window.ErrorHandler.handleError === 'function') {
                window.ErrorHandler.handleError({
                    message: error.message || 'Failed to create randomized creature',
                    type: 'GraphicsEngine.createRandomizedSpaceMythicCreature',
                    severity: 'warning',
                    stack: error.stack
                });
            }

            // Graceful fallback: create default creature
            console.warn('graphics:warn [GraphicsEngine] Falling back to default creature');
            return this.createSpaceMythicCreature({ frame });
        }
    }

    /**
     * Get visual configuration for a creature stage
     * @param {string} stage - Stage ID: 'baby', 'juvenile', 'adult', 'elder'
     * @returns {Object} Stage visual configuration
     */
    getStageVisualConfig(stage) {
        // Try to load from CreatureLifecycle first (recommended)
        try {
            if (window.CreatureLifecycle?.getStageVisualConfig) {
                const configVisual = window.CreatureLifecycle.getStageVisualConfig(stage);
                if (configVisual && Object.keys(configVisual).length > 0) {
                    console.log(`graphics:debug [GraphicsEngine] Using CreatureLifecycle config for stage: ${stage}`);
                    return {
                        scale: configVisual.scale || 1.0,
                        colorSaturation: configVisual.colorSaturation || 1.0,
                        markingOpacity: configVisual.markingOpacity || 1.0,
                        featureScale: configVisual.featureScale || 1.0,
                        eyeSizeMultiplier: configVisual.eyeSizeMultiplier || 1.0,
                        headSizeMultiplier: configVisual.headSizeMultiplier || 1.0,
                        bodyRoundness: configVisual.bodyRoundness || 1.0,
                        glowIntensity: configVisual.glowIntensity || 0.5,
                        particleEffect: configVisual.particleEffect || 'none',
                        hasWisdomMarks: configVisual.hasWisdomMarks || false,
                        wisdomMarkColor: configVisual.wisdomMarkColor ? parseInt(configVisual.wisdomMarkColor.replace('#', ''), 16) : 0xFFD700,
                        auraColor: configVisual.auraColor ? parseInt(configVisual.auraColor.replace('#', ''), 16) : 0xE6E6FA,
                        cheekBlush: configVisual.cheekBlush || false,
                        sparkleEyes: configVisual.sparkleEyes || false
                    };
                }
            }
        } catch (e) {
            console.warn('graphics:warn [GraphicsEngine] Could not load from CreatureLifecycle');
        }

        // Fallback: Try to load from global evolution config
        try {
            const evolutionConfig = window.evolutionConfig;
            if (evolutionConfig?.stages?.[stage]?.visual) {
                const configVisual = evolutionConfig.stages[stage].visual;
                console.log(`graphics:debug [GraphicsEngine] Using window.evolutionConfig for stage: ${stage}`);
                return {
                    scale: configVisual.scale || 1.0,
                    colorSaturation: configVisual.colorSaturation || 1.0,
                    markingOpacity: configVisual.markingOpacity || 1.0,
                    featureScale: configVisual.featureScale || 1.0,
                    eyeSizeMultiplier: configVisual.eyeSizeMultiplier || 1.0,
                    headSizeMultiplier: configVisual.headSizeMultiplier || 1.0,
                    bodyRoundness: configVisual.bodyRoundness || 1.0,
                    glowIntensity: configVisual.glowIntensity || 0.5,
                    particleEffect: configVisual.particleEffect || 'none',
                    hasWisdomMarks: configVisual.hasWisdomMarks || false,
                    wisdomMarkColor: configVisual.wisdomMarkColor ? parseInt(configVisual.wisdomMarkColor.replace('#', ''), 16) : 0xFFD700,
                    auraColor: configVisual.auraColor ? parseInt(configVisual.auraColor.replace('#', ''), 16) : 0xE6E6FA,
                    // Baby-specific cute features
                    cheekBlush: configVisual.cheekBlush || false,
                    sparkleEyes: configVisual.sparkleEyes || false
                };
            }
        } catch (e) {
            console.warn('graphics:warn [GraphicsEngine] Could not load evolution config, using defaults');
        }

        // Fallback to hardcoded defaults with improved baby settings
        const configs = {
            baby: {
                scale: 0.6,
                colorSaturation: 0.9,
                markingOpacity: 0.5,
                featureScale: 0.5,
                eyeSizeMultiplier: 1.8,
                headSizeMultiplier: 1.4,
                bodyRoundness: 1.5,
                glowIntensity: 0.5,
                particleEffect: 'cute_sparkle',
                hasWisdomMarks: false,
                cheekBlush: true,
                sparkleEyes: true
            },
            juvenile: {
                scale: 0.75,
                colorSaturation: 0.9,
                markingOpacity: 0.7,
                featureScale: 0.7,
                eyeSizeMultiplier: 1.3,
                headSizeMultiplier: 1.2,
                bodyRoundness: 1.2,
                glowIntensity: 0.6,
                particleEffect: 'subtle_sparkle',
                hasWisdomMarks: false,
                cheekBlush: false,
                sparkleEyes: false
            },
            adult: {
                scale: 1.0,
                colorSaturation: 1.0,
                markingOpacity: 1.0,
                featureScale: 1.0,
                eyeSizeMultiplier: 1.0,
                headSizeMultiplier: 1.0,
                bodyRoundness: 1.0,
                glowIntensity: 0.8,
                particleEffect: 'standard_aura',
                hasWisdomMarks: false,
                cheekBlush: false,
                sparkleEyes: false
            },
            elder: {
                scale: 1.1,
                colorSaturation: 1.0,
                markingOpacity: 1.0,
                featureScale: 1.0,
                eyeSizeMultiplier: 1.0,
                headSizeMultiplier: 1.0,
                bodyRoundness: 1.0,
                glowIntensity: 1.0,
                particleEffect: 'ethereal_aura',
                hasWisdomMarks: true,
                wisdomMarkColor: 0xFFD700,
                auraColor: 0xE6E6FA,
                cheekBlush: false,
                sparkleEyes: false
            }
        };

        return configs[stage] || configs.adult;
    }

    /**
     * Apply stage-based color modifications (saturation adjustment)
     * @param {Object} colors - Original colors
     * @param {Object} stageConfig - Stage configuration
     * @returns {Object} Modified colors
     */
    applyStageColorModifications(colors, stageConfig) {
        const saturation = stageConfig.colorSaturation || 1.0;

        if (saturation >= 1.0) {
            return colors;
        }

        const desaturateColor = (color) => {
            // Safely extract hex color to prevent stack overflow
            const colorInt = this.extractHexColor(color, 0x808080);
            const r = (colorInt >> 16) & 0xFF;
            const g = (colorInt >> 8) & 0xFF;
            const b = colorInt & 0xFF;

            // Convert to HSL, adjust saturation, convert back
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;

            if (max === min) {
                // Grayscale
                return colorInt;
            }

            const d = (max - min) / 255;
            const s = l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255);

            // Reduce saturation
            const newS = s * saturation;

            // Simplified desaturation - blend toward gray
            const gray = Math.round((r + g + b) / 3);
            const newR = Math.round(r + (gray - r) * (1 - saturation));
            const newG = Math.round(g + (gray - g) * (1 - saturation));
            const newB = Math.round(b + (gray - b) * (1 - saturation));

            return (newR << 16) | (newG << 8) | newB;
        };

        return {
            body: desaturateColor(colors.body),
            head: desaturateColor(colors.head),
            wings: desaturateColor(colors.wings),
            eyes: colors.eyes, // Keep eyes vibrant
            accent: colors.accent
        };
    }

    /**
     * Add stage-specific visual effects
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {string} stage - Current stage
     * @param {Object} stageConfig - Stage configuration
     * @param {Object} center - Center point
     * @param {Object} size - Creature size
     * @param {Object} genetics - Creature genetics
     */
    addStageEffects(graphics, stage, stageConfig, center, size, genetics) {
        const particleEffect = stageConfig.particleEffect;
        const glowIntensity = stageConfig.glowIntensity || 0.5;

        // Add baby-specific cute features
        if (stage === 'baby' || stageConfig.cheekBlush) {
            this.addCheekBlush(graphics, center, size);
        }

        if (stage === 'baby' || stageConfig.sparkleEyes) {
            this.addSparkleEyes(graphics, center, size);
        }

        if (!particleEffect || particleEffect === 'none') {
            return;
        }

        switch (particleEffect) {
            case 'cute_sparkle':
                // Adorable sparkles around baby creature - more magical and cute
                const sparkleColors = [0xFFFFFF, 0xFFB6C1, 0xFFD700, 0x87CEEB];
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
                    const dist = size.width * (0.5 + Math.random() * 0.3);
                    const x = center.x + Math.cos(angle) * dist;
                    const y = center.y + Math.sin(angle) * dist;

                    // Star-shaped sparkle
                    const sparkleColor = sparkleColors[i % sparkleColors.length];
                    graphics.fillStyle(sparkleColor, 0.6 * glowIntensity);
                    this.drawTinyStar(graphics, x, y, 2 + Math.random() * 2);
                }

                // Add a soft glow around the baby
                graphics.fillStyle(0xFFB6C1, 0.08 * glowIntensity);
                graphics.fillCircle(center.x, center.y, size.width * 0.7);
                break;

            case 'subtle_sparkle':
                // Small sparkles around juvenile creature
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const dist = size.width * 0.6;
                    const x = center.x + Math.cos(angle) * dist;
                    const y = center.y + Math.sin(angle) * dist;

                    graphics.fillStyle(0xFFFFFF, 0.4 * glowIntensity);
                    graphics.fillCircle(x, y, 2);
                }
                break;

            case 'standard_aura':
                // Subtle glow around adult creature
                graphics.fillStyle(genetics.cosmicAffinity?.color || 0xFFD700, 0.1 * glowIntensity);
                graphics.fillCircle(center.x, center.y, size.width * 0.8);
                break;

            case 'ethereal_aura':
                // Ethereal multi-layer glow for elder
                const auraColor = stageConfig.auraColor || 0xE6E6FA;

                for (let i = 0; i < 3; i++) {
                    const radius = size.width * (0.9 + i * 0.2);
                    const alpha = (0.15 - i * 0.04) * glowIntensity;
                    graphics.fillStyle(auraColor, alpha);
                    graphics.fillCircle(center.x, center.y, radius);
                }
                break;
        }
    }

    /**
     * Add cute rosy cheek blush for baby creatures
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point
     * @param {Object} size - Creature size
     */
    addCheekBlush(graphics, center, size) {
        const blushColor = 0xFFB6C1; // Light pink
        const blushSize = Math.max(4, size.width * 0.15);
        // Position blush on the HEAD (which is at ~35% above body center)
        // Slightly below where eyes are drawn for cute kawaii look
        const headY = center.y - size.height * 0.35;
        const blushY = headY + size.width * 0.12; // Just below eye level on head
        const blushSpacing = size.width * 0.18; // Closer together for cute look

        // Left cheek - more visible pink blush
        graphics.fillStyle(blushColor, 0.45);
        graphics.fillCircle(center.x - blushSpacing, blushY, blushSize);
        graphics.fillStyle(blushColor, 0.25);
        graphics.fillCircle(center.x - blushSpacing, blushY, blushSize * 1.4);

        // Right cheek
        graphics.fillStyle(blushColor, 0.45);
        graphics.fillCircle(center.x + blushSpacing, blushY, blushSize);
        graphics.fillStyle(blushColor, 0.25);
        graphics.fillCircle(center.x + blushSpacing, blushY, blushSize * 1.4);
    }

    /**
     * Add extra sparkle highlights to eyes for baby cuteness
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point
     * @param {Object} size - Creature size
     */
    addSparkleEyes(graphics, center, size) {
        // Position sparkles on the HEAD (which is at ~35% above body center)
        // Match the eye positions used in DNA head rendering
        const headY = center.y - size.height * 0.35;
        const headSize = size.width * 0.4; // Same as renderHeadArchetype
        const eyeY = headY; // Eyes are roughly at head center
        const eyeSpacing = headSize * 0.3; // Match DNA head eye spacing

        // Extra large sparkle highlights in eyes - bigger for kawaii effect
        const sparkleSize = Math.max(3, headSize * 0.15);

        // Left eye sparkle (larger, more prominent) - upper-left position
        graphics.fillStyle(0xFFFFFF, 0.98);
        graphics.fillCircle(center.x - eyeSpacing - sparkleSize * 0.2, eyeY - sparkleSize * 0.3, sparkleSize);
        graphics.fillStyle(0xFFFFFF, 0.75);
        graphics.fillCircle(center.x - eyeSpacing + sparkleSize * 0.4, eyeY + sparkleSize * 0.4, sparkleSize * 0.5);

        // Right eye sparkle
        graphics.fillStyle(0xFFFFFF, 0.98);
        graphics.fillCircle(center.x + eyeSpacing - sparkleSize * 0.2, eyeY - sparkleSize * 0.3, sparkleSize);
        graphics.fillStyle(0xFFFFFF, 0.75);
        graphics.fillCircle(center.x + eyeSpacing + sparkleSize * 0.4, eyeY + sparkleSize * 0.4, sparkleSize * 0.5);
    }

    /**
     * Draw a tiny star shape for sparkle effects
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} size - Star size
     */
    drawTinyStar(graphics, x, y, size) {
        const points = 4;
        const outerRadius = size;
        const innerRadius = size * 0.4;

        graphics.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.fill();
    }

    /**
     * Add elder wisdom marks (special visual for elder stage)
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point
     * @param {Object} size - Creature size
     * @param {Object} stageConfig - Stage configuration
     */
    addElderWisdomMarks(graphics, center, size, stageConfig) {
        const markColor = stageConfig.wisdomMarkColor || 0xFFD700;

        // Forehead symbol
        graphics.fillStyle(markColor, 0.8);
        graphics.fillCircle(center.x, center.y - size.height * 0.35, 4);

        // Small radiating lines from forehead
        graphics.lineStyle(1.5, markColor, 0.6);
        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI / 2 + (i - 1) * 0.3;
            const startDist = 6;
            const endDist = 12;

            const x1 = center.x + Math.cos(angle) * startDist;
            const y1 = center.y - size.height * 0.35 + Math.sin(angle) * startDist;
            const x2 = center.x + Math.cos(angle) * endDist;
            const y2 = center.y - size.height * 0.35 + Math.sin(angle) * endDist;

            graphics.beginPath();
            graphics.moveTo(x1, y1);
            graphics.lineTo(x2, y2);
            graphics.strokePath();
        }

        // Side wisdom marks (small dots along body)
        graphics.fillStyle(markColor, 0.5);
        const sidePositions = [
            { x: -size.width * 0.3, y: 0 },
            { x: size.width * 0.3, y: 0 },
            { x: -size.width * 0.25, y: size.height * 0.15 },
            { x: size.width * 0.25, y: size.height * 0.15 }
        ];

        sidePositions.forEach(pos => {
            graphics.fillCircle(center.x + pos.x, center.y + pos.y, 2);
        });
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
                eyes: this.extractHexColor(features.eyes.color, 0x4169E1),
                accent: this.extractHexColor(colorGenome.accent, 0xFFD700),
                
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
        // Safely extract hex colors to prevent stack overflow from colorGenome objects
        let bodyColor = this.extractHexColor(colorGenome.primary, 0x9370DB);
        let wingsColor = this.extractHexColor(colorGenome.secondary, 0x8A2BE2);
        
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
     * Supports stage-aware body types: baby_blob, transitional_*, elder_*
     */
    renderBodyByType(graphics, center, bodyOffset, bodyScale, bodyColor, bodyType, destinyType = null) {
        // Handle stage-aware body types
        if (bodyType === 'baby_blob') {
            this.renderBabyBlobBody(graphics, center, bodyOffset, bodyScale, bodyColor, destinyType);
            return;
        }

        // Handle transitional bodies (juvenile stage)
        if (bodyType && bodyType.startsWith('transitional_')) {
            const targetType = bodyType.replace('transitional_', '');
            this.renderTransitionalBody(graphics, center, bodyOffset, bodyScale, bodyColor, targetType, 0.4);
            return;
        }

        // Handle elder bodies (elder stage with enhancements)
        if (bodyType && bodyType.startsWith('elder_')) {
            const baseType = bodyType.replace('elder_', '');
            // Render base body then add elder enhancements
            this.renderBodyByType(graphics, center, bodyOffset, bodyScale, bodyColor, baseType);
            this.addElderBodyEnhancements(graphics, center, bodyOffset, bodyScale, bodyColor);
            return;
        }

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
     * Render baby blob body - ALL babies are adorable round blobs
     * Maximum cuteness: huge shine, simple shape, optional destiny hints
     */
    renderBabyBlobBody(graphics, center, bodyOffset, bodyScale, bodyColor, destinyType = null) {
        const scale = this.resolveScale(bodyScale);
        const maxScale = Math.max(scale.x, scale.y);

        // Ground shadow (soft, circular)
        graphics.fillStyle(0x000000, 0.15);
        graphics.fillEllipse(center.x + 2, center.y + 28, 35 * maxScale, 12 * maxScale);

        // Main blob body - extremely round and simple
        // Dark base layer
        graphics.fillStyle(this.darkenColor(bodyColor, 0.25), 0.95);
        graphics.fillCircle(center.x + bodyOffset.x, center.y + 12 + bodyOffset.y, 28 * maxScale);

        // Main color layer
        graphics.fillStyle(bodyColor, 0.98);
        graphics.fillCircle(center.x - 2 + bodyOffset.x, center.y + 10 + bodyOffset.y, 26 * maxScale);

        // Bright highlight for kawaii shine
        graphics.fillStyle(this.lightenColor(bodyColor, 0.45), 0.85);
        graphics.fillCircle(center.x - 8 + bodyOffset.x, center.y + 4 + bodyOffset.y, 18 * maxScale);

        // Super bright shine spot (maximum cuteness)
        graphics.fillStyle(0xFFFFFF, 0.7);
        graphics.fillCircle(center.x - 12 + bodyOffset.x, center.y - 2 + bodyOffset.y, 10 * maxScale);

        // Secondary shine
        graphics.fillStyle(0xFFFFFF, 0.4);
        graphics.fillCircle(center.x + 8 + bodyOffset.x, center.y + 6 + bodyOffset.y, 5 * maxScale);

        // Add destiny hints if enabled - tiny nubs showing what they'll become
        if (destinyType) {
            this.addBabyDestinyHints(graphics, center, bodyOffset, bodyScale, bodyColor, destinyType);
        }
    }

    /**
     * Add tiny hints of what the baby will become
     */
    addBabyDestinyHints(graphics, center, bodyOffset, bodyScale, bodyColor, destinyType) {
        const scale = this.resolveScale(bodyScale);
        const hintColor = this.darkenColor(bodyColor, 0.15);
        const hintAlpha = 0.5;

        switch (destinyType) {
            case 'fish':
                // Tiny tail bump
                graphics.fillStyle(hintColor, hintAlpha);
                graphics.fillEllipse(center.x + bodyOffset.x, center.y + 32 + bodyOffset.y, 8 * scale.x, 4 * scale.y);
                break;

            case 'avian':
            case 'aurora':
                // Tiny wing bumps on shoulders
                graphics.fillStyle(hintColor, hintAlpha);
                graphics.fillEllipse(center.x - 20 + bodyOffset.x, center.y + 8 + bodyOffset.y, 5 * scale.x, 3 * scale.y);
                graphics.fillEllipse(center.x + 20 + bodyOffset.x, center.y + 8 + bodyOffset.y, 5 * scale.x, 3 * scale.y);
                break;

            case 'serpentine':
                // Slight elongation hint at bottom
                graphics.fillStyle(hintColor, hintAlpha);
                graphics.fillEllipse(center.x + bodyOffset.x, center.y + 30 + bodyOffset.y, 6 * scale.x, 10 * scale.y);
                break;

            case 'quadruped':
                // Four tiny leg bumps
                graphics.fillStyle(hintColor, hintAlpha);
                graphics.fillCircle(center.x - 12 + bodyOffset.x, center.y + 25 + bodyOffset.y, 3 * scale.x);
                graphics.fillCircle(center.x + 12 + bodyOffset.x, center.y + 25 + bodyOffset.y, 3 * scale.x);
                graphics.fillCircle(center.x - 8 + bodyOffset.x, center.y + 28 + bodyOffset.y, 3 * scale.x);
                graphics.fillCircle(center.x + 8 + bodyOffset.x, center.y + 28 + bodyOffset.y, 3 * scale.x);
                break;

            case 'insectoid':
                // Tiny antennae nubs
                graphics.fillStyle(hintColor, hintAlpha);
                graphics.fillCircle(center.x - 6 + bodyOffset.x, center.y - 18 + bodyOffset.y, 2 * scale.x);
                graphics.fillCircle(center.x + 6 + bodyOffset.x, center.y - 18 + bodyOffset.y, 2 * scale.x);
                break;

            case 'crystal':
            case 'guardian':
                // Tiny crystal/armor bumps
                graphics.fillStyle(this.lightenColor(bodyColor, 0.3), hintAlpha);
                graphics.fillTriangle(
                    center.x - 15 + bodyOffset.x, center.y + bodyOffset.y,
                    center.x - 12 + bodyOffset.x, center.y - 5 + bodyOffset.y,
                    center.x - 9 + bodyOffset.x, center.y + bodyOffset.y
                );
                graphics.fillTriangle(
                    center.x + 15 + bodyOffset.x, center.y + bodyOffset.y,
                    center.x + 12 + bodyOffset.x, center.y - 5 + bodyOffset.y,
                    center.x + 9 + bodyOffset.x, center.y + bodyOffset.y
                );
                break;

            case 'reptilian':
                // Tiny scale pattern hint
                graphics.lineStyle(1, hintColor, 0.3);
                for (let i = 0; i < 3; i++) {
                    const y = center.y + 5 + (i * 5) + bodyOffset.y;
                    graphics.beginPath();
                    graphics.moveTo(center.x - 5 + bodyOffset.x, y);
                    graphics.lineTo(center.x + 5 + bodyOffset.x, y);
                    graphics.strokePath();
                }
                break;
        }
    }

    /**
     * Render transitional body - blend between blob and genetic body type
     * Used for juvenile stage (40% blob, 60% toward genetic type)
     */
    renderTransitionalBody(graphics, center, bodyOffset, bodyScale, bodyColor, targetType, transitionAmount = 0.4) {
        const scale = this.resolveScale(bodyScale);
        const maxScale = Math.max(scale.x, scale.y);

        // Transitional bodies are rounder than adult but less blob-like
        const roundness = 1.0 + (1.0 - transitionAmount) * 0.5; // 1.0 = adult, 1.5 = more blob-like

        // Shadow
        graphics.fillStyle(0x000000, 0.25);
        graphics.fillEllipse(center.x + 2, center.y + 26, 32 * maxScale, 20 * maxScale);

        // Base body - between blob and target shape
        graphics.fillStyle(this.darkenColor(bodyColor, 0.35), 0.95);

        // Use modified ellipse based on target type but with blob influence
        let bodyWidth = 30 * scale.x;
        let bodyHeight = 40 * scale.y;

        // Adjust shape based on target type (but keep some roundness)
        switch (targetType) {
            case 'fish':
            case 'serpentine':
                bodyHeight = 48 * scale.y * (0.5 + transitionAmount * 0.5);
                bodyWidth = 26 * scale.x;
                break;
            case 'quadruped':
                bodyWidth = 38 * scale.x * (0.5 + transitionAmount * 0.5);
                bodyHeight = 32 * scale.y;
                break;
            case 'avian':
                bodyHeight = 42 * scale.y;
                break;
            case 'blob':
                // Blob stays blob-like
                bodyWidth = 32 * scale.x;
                bodyHeight = 32 * scale.y;
                break;
        }

        // Apply roundness modifier
        bodyWidth = bodyWidth * roundness;
        bodyHeight = bodyHeight / roundness;

        graphics.fillEllipse(center.x + bodyOffset.x, center.y + 12 + bodyOffset.y, bodyWidth, bodyHeight);

        // Main color layer
        graphics.fillStyle(bodyColor);
        graphics.fillEllipse(center.x - 2 + bodyOffset.x, center.y + 10 + bodyOffset.y, bodyWidth * 0.92, bodyHeight * 0.92);

        // Highlight layer
        graphics.fillStyle(this.lightenColor(bodyColor, 0.35), 0.8);
        graphics.fillEllipse(center.x - 6 + bodyOffset.x, center.y + 5 + bodyOffset.y, bodyWidth * 0.65, bodyHeight * 0.7);

        // Shine
        graphics.fillStyle(0xFFFFFF, 0.4);
        graphics.fillCircle(center.x - 10 + bodyOffset.x, center.y + bodyOffset.y, 8 * maxScale);

        // Add emerging features based on target type
        this.addEmergingFeatures(graphics, center, bodyOffset, bodyScale, bodyColor, targetType, transitionAmount);
    }

    /**
     * Add emerging features for transitional (juvenile) bodies
     */
    addEmergingFeatures(graphics, center, bodyOffset, bodyScale, bodyColor, targetType, emergence) {
        const scale = this.resolveScale(bodyScale);
        const featureColor = this.darkenColor(bodyColor, 0.2);
        const featureAlpha = 0.6 + emergence * 0.3;

        switch (targetType) {
            case 'fish':
                // Developing tail fin
                graphics.fillStyle(featureColor, featureAlpha);
                graphics.beginPath();
                graphics.moveTo(center.x + bodyOffset.x, center.y + 35 + bodyOffset.y);
                graphics.lineTo(center.x - 6 * emergence + bodyOffset.x, center.y + 42 + bodyOffset.y);
                graphics.lineTo(center.x + 6 * emergence + bodyOffset.x, center.y + 42 + bodyOffset.y);
                graphics.closePath();
                graphics.fillPath();
                // Small developing fins
                graphics.fillEllipse(center.x - 14 + bodyOffset.x, center.y + 12 + bodyOffset.y, 5 * scale.x * emergence, 8 * scale.y * emergence);
                graphics.fillEllipse(center.x + 14 + bodyOffset.x, center.y + 12 + bodyOffset.y, 5 * scale.x * emergence, 8 * scale.y * emergence);
                break;

            case 'quadruped':
                // Developing legs (short stubs)
                graphics.fillStyle(featureColor, featureAlpha);
                const legLength = 10 * scale.y * emergence;
                graphics.fillRect(center.x - 12 + bodyOffset.x, center.y + 22 + bodyOffset.y, 4 * scale.x, legLength);
                graphics.fillRect(center.x + 8 + bodyOffset.x, center.y + 22 + bodyOffset.y, 4 * scale.x, legLength);
                graphics.fillRect(center.x - 8 + bodyOffset.x, center.y + 20 + bodyOffset.y, 4 * scale.x, legLength);
                graphics.fillRect(center.x + 4 + bodyOffset.x, center.y + 20 + bodyOffset.y, 4 * scale.x, legLength);
                break;

            case 'serpentine':
                // Developing segments
                graphics.fillStyle(featureColor, featureAlpha * 0.5);
                for (let i = 1; i < 3; i++) {
                    const segY = center.y + 20 + (i * 10 * emergence) + bodyOffset.y;
                    graphics.fillEllipse(center.x + bodyOffset.x, segY, 18 * scale.x, 8 * scale.y);
                }
                break;

            case 'avian':
                // Developing tail feathers
                graphics.fillStyle(featureColor, featureAlpha);
                const tailY = center.y + 35 + bodyOffset.y;
                graphics.beginPath();
                graphics.moveTo(center.x + bodyOffset.x, tailY);
                graphics.lineTo(center.x - 8 * emergence + bodyOffset.x, tailY + 12 * emergence);
                graphics.lineTo(center.x + 8 * emergence + bodyOffset.x, tailY + 12 * emergence);
                graphics.closePath();
                graphics.fillPath();
                break;

            case 'insectoid':
                // Developing antennae
                graphics.fillStyle(featureColor, featureAlpha);
                const antLength = 8 * scale.y * emergence;
                graphics.lineStyle(2, featureColor, featureAlpha);
                graphics.beginPath();
                graphics.moveTo(center.x - 6 + bodyOffset.x, center.y - 15 + bodyOffset.y);
                graphics.lineTo(center.x - 8 + bodyOffset.x, center.y - 15 - antLength + bodyOffset.y);
                graphics.strokePath();
                graphics.beginPath();
                graphics.moveTo(center.x + 6 + bodyOffset.x, center.y - 15 + bodyOffset.y);
                graphics.lineTo(center.x + 8 + bodyOffset.x, center.y - 15 - antLength + bodyOffset.y);
                graphics.strokePath();
                break;

            case 'reptilian':
                // Developing spinal ridges
                graphics.fillStyle(this.lightenColor(bodyColor, 0.2), featureAlpha);
                for (let i = 0; i < Math.floor(3 * emergence); i++) {
                    const ridgeY = center.y + (i * 8) + bodyOffset.y;
                    const ridgeSize = 3 * scale.x * emergence;
                    graphics.beginPath();
                    graphics.moveTo(center.x - 10 + bodyOffset.x, ridgeY);
                    graphics.lineTo(center.x - 8 + bodyOffset.x, ridgeY - ridgeSize);
                    graphics.lineTo(center.x - 6 + bodyOffset.x, ridgeY);
                    graphics.closePath();
                    graphics.fillPath();
                }
                break;
        }
    }

    /**
     * Add elder body enhancements - crystalline accents, weathered marks
     */
    addElderBodyEnhancements(graphics, center, bodyOffset, bodyScale, bodyColor) {
        const scale = this.resolveScale(bodyScale);
        const maxScale = Math.max(scale.x, scale.y);

        // Crystalline accent color (light lavender/gold blend)
        const crystalColor = 0xE6E6FA;
        const wisdomGold = 0xFFD700;

        // Add crystalline growths around the body
        const numCrystals = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numCrystals; i++) {
            const angle = (i / numCrystals) * Math.PI * 2;
            const dist = 22 * maxScale + Math.random() * 8;
            const x = center.x + Math.cos(angle) * dist + bodyOffset.x;
            const y = center.y + 10 + Math.sin(angle) * dist * 0.7 + bodyOffset.y;

            // Crystal formation
            const size = 4 + Math.random() * 4;
            graphics.fillStyle(crystalColor, 0.7);
            graphics.fillTriangle(
                x - size / 2, y + size,
                x + size / 2, y + size,
                x, y - size
            );
            // Crystal glow
            graphics.fillStyle(crystalColor, 0.3);
            graphics.fillCircle(x, y, size * 1.2);
        }

        // Add weathered wisdom marks (subtle lines on body)
        graphics.lineStyle(1, wisdomGold, 0.4);

        // Horizontal wisdom lines
        for (let i = 0; i < 3; i++) {
            const y = center.y + 5 + (i * 8) + bodyOffset.y;
            const length = 12 - i * 2;
            graphics.beginPath();
            graphics.moveTo(center.x - length + bodyOffset.x, y);
            graphics.lineTo(center.x + length + bodyOffset.x, y);
            graphics.strokePath();
        }

        // Wisdom dots at key positions
        graphics.fillStyle(wisdomGold, 0.5);
        graphics.fillCircle(center.x - 15 + bodyOffset.x, center.y + 5 + bodyOffset.y, 2);
        graphics.fillCircle(center.x + 15 + bodyOffset.x, center.y + 5 + bodyOffset.y, 2);
        graphics.fillCircle(center.x + bodyOffset.x, center.y + 25 + bodyOffset.y, 2);

        // Ethereal glow outline
        graphics.lineStyle(2, crystalColor, 0.25);
        graphics.strokeCircle(center.x + bodyOffset.x, center.y + 10 + bodyOffset.y, 35 * maxScale);
    }

    /**
     * Render wing buds for juvenile stage - tiny bumps on shoulders
     */
    renderWingBuds(graphics, center, wingColor, destinyWingType = 'feathered') {
        const budColor = this.lightenColor(wingColor, 0.2);

        // Left wing bud
        graphics.fillStyle(budColor, 0.8);
        graphics.fillEllipse(center.x - 22, center.y - 5, 8, 5);

        // Right wing bud
        graphics.fillEllipse(center.x + 22, center.y - 5, 8, 5);

        // Small highlight on buds
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillCircle(center.x - 23, center.y - 6, 2);
        graphics.fillCircle(center.x + 21, center.y - 6, 2);
    }

    /**
     * Render horn nubs for juvenile stage - tiny protrusions
     */
    renderHornNubs(graphics, center, hornColor) {
        const nubColor = this.darkenColor(hornColor, 0.1);

        // Two small horn nubs
        graphics.fillStyle(nubColor, 0.85);
        graphics.fillCircle(center.x - 8, center.y - 28, 4);
        graphics.fillCircle(center.x + 8, center.y - 28, 4);

        // Tiny points
        graphics.fillStyle(nubColor, 0.7);
        graphics.fillTriangle(
            center.x - 8 - 2, center.y - 28,
            center.x - 8 + 2, center.y - 28,
            center.x - 8, center.y - 33
        );
        graphics.fillTriangle(
            center.x + 8 - 2, center.y - 28,
            center.x + 8 + 2, center.y - 28,
            center.x + 8, center.y - 33
        );
    }

    /**
     * Render tail bud for juvenile stage
     */
    renderTailBud(graphics, center, bodyColor) {
        const budColor = this.darkenColor(bodyColor, 0.15);

        graphics.fillStyle(budColor, 0.8);
        graphics.fillEllipse(center.x, center.y + 38, 10, 6);

        // Small highlight
        graphics.fillStyle(this.lightenColor(bodyColor, 0.2), 0.5);
        graphics.fillCircle(center.x - 2, center.y + 37, 3);
    }

    /**
     * Render stage-aware creature body - main entry point for stage-based rendering
     * Uses resolved traits from StageVisualResolver for dramatic transformation
     */
    renderStageAwareCreatureBody(graphics, center, baseSize, colors, frame, traits, stageConfig, resolvedTraits) {
        // Determine the body type and destiny
        const bodyType = resolvedTraits?.bodyType || traits.resolvedBodyType || 'balanced';
        const destinyType = resolvedTraits?.destinyBodyType || traits.destinyBodyType || 'balanced';
        const bodyColor = colors.body || 0x9370DB;

        // Calculate body positioning and scaling
        const bodyOffset = {
            x: (traits.bodyMods?.horizontalShift || 0) * baseSize.width * 0.1,
            y: (traits.bodyMods?.verticalShift || 0) * baseSize.height * 0.1
        };

        const bodyScale = {
            x: stageConfig.scale || 1.0,
            y: stageConfig.scale || 1.0
        };

        // Render the body using the stage-aware body type
        this.renderBodyByType(graphics, center, bodyOffset, bodyScale, bodyColor, bodyType, destinyType);

        // Add stage-specific features
        const resolvedFeatures = resolvedTraits?.features || {};

        // Baby features: sparkles and cute effects
        if (resolvedFeatures.sparkles) {
            this.addBabySparkles(graphics, center, baseSize);
        }
        if (resolvedFeatures.cheekBlush) {
            this.addBabyBlush(graphics, center);
        }

        // Juvenile features: Wing buds, horn nubs, tail buds
        if (resolvedFeatures.showFeatureBuds) {
            if (resolvedFeatures.wings) {
                this.renderWingBuds(graphics, center, colors.wings || bodyColor, resolvedFeatures.wings.destinyType);
            }
            if (resolvedFeatures.horns) {
                this.renderHornNubs(graphics, center, colors.accent || bodyColor);
            }
            if (resolvedFeatures.tail) {
                this.renderTailBud(graphics, center, bodyColor);
            }
        }

        // Adult/Elder full features
        if (resolvedFeatures.wings && resolvedFeatures.wings.type !== 'bud') {
            const wingType = traits.resolvedFeatures?.wings?.type || 'feathered';
            this.renderWings(graphics, center, colors.wings || bodyColor, wingType, resolvedFeatures.wings?.enhanced);
        }
        if (resolvedFeatures.horns?.type === 'full' || resolvedFeatures.horns?.type === 'crystalline') {
            this.renderHorns(graphics, center, colors.accent || bodyColor, resolvedFeatures.horns.type);
        }

        // Elder-specific features
        if (resolvedFeatures.crystallineAccents) {
            this.addCrystallineAccents(graphics, center, baseSize);
        }
        if (resolvedFeatures.cosmicAura) {
            this.addCosmicAuraLayers(graphics, center, baseSize, resolvedFeatures.auraLayers || 3);
        }

        // Render head with stage-appropriate eye size and mood expression
        const headColor = colors.head || this.blendColors(bodyColor, colors.wings || bodyColor, 0.3);
        const headScale = stageConfig.headSizeMultiplier || 1.0;
        const eyeScale = stageConfig.eyeSizeMultiplier || 1.0;

        // Get mood from traits or calculate from current stats
        const mood = traits.mood || stageConfig.mood || 'content';

        this.renderHead(graphics, center, headScale, headColor, traits.eyes || {}, eyeScale, mood);
    }

    /**
     * Add baby sparkles - cute twinkling particles
     */
    addBabySparkles(graphics, center, baseSize) {
        const sparklePositions = [
            { x: -15, y: -20 },
            { x: 18, y: -15 },
            { x: -10, y: 25 },
            { x: 12, y: 20 },
            { x: 0, y: -25 }
        ];

        sparklePositions.forEach((pos, i) => {
            const size = 2 + Math.random() * 2;
            const alpha = 0.5 + Math.random() * 0.3;
            graphics.fillStyle(0xFFFFFF, alpha);

            // Star sparkle shape
            const x = center.x + pos.x;
            const y = center.y + pos.y;

            graphics.fillCircle(x, y, size);

            // Cross rays for sparkle
            graphics.fillRect(x - size * 1.5, y - 0.5, size * 3, 1);
            graphics.fillRect(x - 0.5, y - size * 1.5, 1, size * 3);
        });
    }

    /**
     * Add baby blush - pink cheeks for cuteness
     */
    addBabyBlush(graphics, center) {
        const blushColor = 0xFF9999;

        // Left cheek
        graphics.fillStyle(blushColor, 0.35);
        graphics.fillEllipse(center.x - 18, center.y - 8, 8, 5);

        // Right cheek
        graphics.fillEllipse(center.x + 18, center.y - 8, 8, 5);
    }

    /**
     * Render horns based on type - expanded with more styles
     * @param {Object} graphics - Graphics context
     * @param {Object} center - Center position
     * @param {number} hornColor - Horn color
     * @param {string} hornType - Horn type: 'full', 'crystalline', 'curved', 'spiral', 'antlers', 'cosmic'
     * @param {number} hornSize - Size multiplier (default 1.0)
     */
    renderHorns(graphics, center, hornColor, hornType = 'full', hornSize = 1.0) {
        switch (hornType) {
            case 'crystalline':
                this.renderCrystallineHorns(graphics, center, hornColor, hornSize);
                break;
            case 'curved':
                this.renderCurvedHorns(graphics, center, hornColor, hornSize);
                break;
            case 'spiral':
                this.renderSpiralHorns(graphics, center, hornColor, hornSize);
                break;
            case 'antlers':
                this.renderAntlers(graphics, center, hornColor, hornSize);
                break;
            case 'cosmic':
                this.renderCosmicHornsVariant(graphics, center, hornColor, hornSize);
                break;
            default:
                this.renderStandardHorns(graphics, center, hornColor, hornSize);
                break;
        }
    }

    /**
     * Render standard pointed horns
     */
    renderStandardHorns(graphics, center, hornColor, hornSize = 1.0) {
        graphics.fillStyle(hornColor, 0.9);

        // Left horn
        graphics.beginPath();
        graphics.moveTo(center.x - 10, center.y - 28);
        graphics.lineTo(center.x - 6, center.y - (28 + 17 * hornSize));
        graphics.lineTo(center.x - 4, center.y - 28);
        graphics.closePath();
        graphics.fillPath();

        // Right horn
        graphics.beginPath();
        graphics.moveTo(center.x + 10, center.y - 28);
        graphics.lineTo(center.x + 6, center.y - (28 + 17 * hornSize));
        graphics.lineTo(center.x + 4, center.y - 28);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Render crystalline elder horns with glow
     */
    renderCrystallineHorns(graphics, center, hornColor, hornSize = 1.0) {
        const crystalColor = this.lightenColor(hornColor, 0.3);

        // Left horn
        graphics.fillStyle(crystalColor, 0.9);
        graphics.beginPath();
        graphics.moveTo(center.x - 12, center.y - 30);
        graphics.lineTo(center.x - 8, center.y - (30 + 20 * hornSize));
        graphics.lineTo(center.x - 6, center.y - 30);
        graphics.closePath();
        graphics.fillPath();

        // Right horn
        graphics.beginPath();
        graphics.moveTo(center.x + 12, center.y - 30);
        graphics.lineTo(center.x + 8, center.y - (30 + 20 * hornSize));
        graphics.lineTo(center.x + 6, center.y - 30);
        graphics.closePath();
        graphics.fillPath();

        // Crystal tips glow
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(center.x - 8, center.y - (28 + 20 * hornSize), 3);
        graphics.fillCircle(center.x + 8, center.y - (28 + 20 * hornSize), 3);
    }

    /**
     * Render curved horns (rams horn style)
     */
    renderCurvedHorns(graphics, center, hornColor, hornSize = 1.0) {
        graphics.fillStyle(hornColor, 0.9);

        // Left curved horn
        const leftBaseX = center.x - 12;
        const leftBaseY = center.y - 25;
        const curveRadius = 15 * hornSize;

        graphics.beginPath();
        graphics.arc(leftBaseX - curveRadius, leftBaseY, curveRadius, 0, Math.PI * 0.6, false);
        graphics.lineStyle(5, hornColor, 0.9);
        graphics.strokePath();

        // Right curved horn (mirrored)
        const rightBaseX = center.x + 12;
        graphics.beginPath();
        graphics.arc(rightBaseX + curveRadius, leftBaseY, curveRadius, Math.PI, Math.PI * 0.4, true);
        graphics.strokePath();

        // Horn tips
        graphics.fillStyle(this.darkenColor(hornColor, 0.2), 0.9);
        graphics.fillCircle(leftBaseX - curveRadius * 1.5, leftBaseY + curveRadius * 0.3, 3);
        graphics.fillCircle(rightBaseX + curveRadius * 1.5, leftBaseY + curveRadius * 0.3, 3);
    }

    /**
     * Render spiral horns (unicorn-like)
     */
    renderSpiralHorns(graphics, center, hornColor, hornSize = 1.0) {
        const hornHeight = 25 * hornSize;
        const spirals = 4;

        // Left spiral horn
        for (let i = 0; i < spirals; i++) {
            const y = center.y - 28 - (i / spirals) * hornHeight;
            const width = 6 - (i / spirals) * 4;
            const xOffset = Math.sin(i * 0.8) * 2;

            graphics.fillStyle(i % 2 === 0 ? hornColor : this.lightenColor(hornColor, 0.2), 0.9);
            graphics.fillEllipse(center.x - 10 + xOffset, y, width, hornHeight / spirals);
        }

        // Right spiral horn
        for (let i = 0; i < spirals; i++) {
            const y = center.y - 28 - (i / spirals) * hornHeight;
            const width = 6 - (i / spirals) * 4;
            const xOffset = Math.sin(i * 0.8) * 2;

            graphics.fillStyle(i % 2 === 0 ? hornColor : this.lightenColor(hornColor, 0.2), 0.9);
            graphics.fillEllipse(center.x + 10 - xOffset, y, width, hornHeight / spirals);
        }

        // Tips
        graphics.fillStyle(0xFFFFFF, 0.8);
        graphics.fillCircle(center.x - 10, center.y - 28 - hornHeight, 2);
        graphics.fillCircle(center.x + 10, center.y - 28 - hornHeight, 2);
    }

    /**
     * Render antlers (branching)
     */
    renderAntlers(graphics, center, hornColor, hornSize = 1.0) {
        graphics.fillStyle(hornColor, 0.9);
        graphics.lineStyle(3, hornColor, 0.9);

        const baseY = center.y - 28;
        const height = 20 * hornSize;

        // Left antler - main beam
        graphics.beginPath();
        graphics.moveTo(center.x - 10, baseY);
        graphics.lineTo(center.x - 15, baseY - height);
        graphics.strokePath();

        // Left antler - branches
        graphics.beginPath();
        graphics.moveTo(center.x - 12, baseY - height * 0.4);
        graphics.lineTo(center.x - 20, baseY - height * 0.6);
        graphics.strokePath();

        graphics.beginPath();
        graphics.moveTo(center.x - 14, baseY - height * 0.7);
        graphics.lineTo(center.x - 22, baseY - height * 0.85);
        graphics.strokePath();

        // Right antler - main beam
        graphics.beginPath();
        graphics.moveTo(center.x + 10, baseY);
        graphics.lineTo(center.x + 15, baseY - height);
        graphics.strokePath();

        // Right antler - branches
        graphics.beginPath();
        graphics.moveTo(center.x + 12, baseY - height * 0.4);
        graphics.lineTo(center.x + 20, baseY - height * 0.6);
        graphics.strokePath();

        graphics.beginPath();
        graphics.moveTo(center.x + 14, baseY - height * 0.7);
        graphics.lineTo(center.x + 22, baseY - height * 0.85);
        graphics.strokePath();

        // Tips glow
        graphics.fillStyle(this.lightenColor(hornColor, 0.4), 0.6);
        graphics.fillCircle(center.x - 15, baseY - height, 2);
        graphics.fillCircle(center.x + 15, baseY - height, 2);
    }

    /**
     * Render cosmic horns with star/crystal effects
     */
    renderCosmicHornsVariant(graphics, center, hornColor, hornSize = 1.0) {
        const hornHeight = 22 * hornSize;

        // Left cosmic horn - ethereal, semi-transparent
        graphics.fillStyle(hornColor, 0.7);
        graphics.beginPath();
        graphics.moveTo(center.x - 12, center.y - 28);
        graphics.lineTo(center.x - 8, center.y - 28 - hornHeight);
        graphics.lineTo(center.x - 5, center.y - 28);
        graphics.closePath();
        graphics.fillPath();

        // Right cosmic horn
        graphics.beginPath();
        graphics.moveTo(center.x + 12, center.y - 28);
        graphics.lineTo(center.x + 8, center.y - 28 - hornHeight);
        graphics.lineTo(center.x + 5, center.y - 28);
        graphics.closePath();
        graphics.fillPath();

        // Cosmic glow aura
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillCircle(center.x - 8, center.y - 28 - hornHeight * 0.5, 8);
        graphics.fillCircle(center.x + 8, center.y - 28 - hornHeight * 0.5, 8);

        // Star tips
        this.drawStar(graphics, center.x - 8, center.y - 28 - hornHeight, 5, 2, 4);
        this.drawStar(graphics, center.x + 8, center.y - 28 - hornHeight, 5, 2, 4);
    }

    /**
     * Render wings based on type and enhancement
     */
    renderWings(graphics, center, wingColor, wingType = 'feathered', enhanced = false) {
        const wingAlpha = enhanced ? 0.95 : 0.85;
        const wingGlow = enhanced ? 0.4 : 0.2;

        // Wing shadow
        graphics.fillStyle(0x000000, 0.2);
        graphics.fillEllipse(center.x - 35, center.y + 5, 25, 18);
        graphics.fillEllipse(center.x + 35, center.y + 5, 25, 18);

        // Main wings
        graphics.fillStyle(wingColor, wingAlpha);

        if (wingType === 'ethereal' || enhanced) {
            // Ethereal wings with multiple layers
            for (let layer = 0; layer < 3; layer++) {
                const offset = layer * 3;
                const layerAlpha = wingAlpha - layer * 0.2;
                graphics.fillStyle(this.lightenColor(wingColor, layer * 0.1), layerAlpha);

                // Left wing
                graphics.beginPath();
                graphics.moveTo(center.x - 15, center.y);
                graphics.lineTo(center.x - 45 - offset, center.y - 15 - offset);
                graphics.lineTo(center.x - 50 - offset, center.y + 10);
                graphics.lineTo(center.x - 30, center.y + 15);
                graphics.closePath();
                graphics.fillPath();

                // Right wing
                graphics.beginPath();
                graphics.moveTo(center.x + 15, center.y);
                graphics.lineTo(center.x + 45 + offset, center.y - 15 - offset);
                graphics.lineTo(center.x + 50 + offset, center.y + 10);
                graphics.lineTo(center.x + 30, center.y + 15);
                graphics.closePath();
                graphics.fillPath();
            }
        } else {
            // Standard wings
            // Left wing
            graphics.beginPath();
            graphics.moveTo(center.x - 15, center.y);
            graphics.lineTo(center.x - 45, center.y - 15);
            graphics.lineTo(center.x - 50, center.y + 10);
            graphics.lineTo(center.x - 30, center.y + 15);
            graphics.closePath();
            graphics.fillPath();

            // Right wing
            graphics.beginPath();
            graphics.moveTo(center.x + 15, center.y);
            graphics.lineTo(center.x + 45, center.y - 15);
            graphics.lineTo(center.x + 50, center.y + 10);
            graphics.lineTo(center.x + 30, center.y + 15);
            graphics.closePath();
            graphics.fillPath();
        }

        // Wing highlights
        graphics.fillStyle(0xFFFFFF, wingGlow);
        graphics.fillEllipse(center.x - 35, center.y - 5, 10, 6);
        graphics.fillEllipse(center.x + 35, center.y - 5, 10, 6);
    }

    /**
     * Add crystalline accents for elder creatures
     */
    addCrystallineAccents(graphics, center, baseSize) {
        const crystalColor = 0xE6E6FA;
        const numCrystals = 6;

        for (let i = 0; i < numCrystals; i++) {
            const angle = (i / numCrystals) * Math.PI * 2 - Math.PI / 2;
            const dist = 30 + Math.random() * 10;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.6;
            const size = 3 + Math.random() * 4;

            // Crystal formation
            graphics.fillStyle(crystalColor, 0.8);
            graphics.beginPath();
            graphics.moveTo(x, y - size * 2);
            graphics.lineTo(x - size, y);
            graphics.lineTo(x, y + size / 2);
            graphics.lineTo(x + size, y);
            graphics.closePath();
            graphics.fillPath();

            // Crystal glow
            graphics.fillStyle(crystalColor, 0.3);
            graphics.fillCircle(x, y - size, size);
        }
    }

    /**
     * Add cosmic aura layers for elder creatures
     */
    addCosmicAuraLayers(graphics, center, baseSize, numLayers = 3) {
        const auraColor = 0xE6E6FA;

        for (let i = numLayers - 1; i >= 0; i--) {
            const layerRadius = 45 + i * 12;
            const layerAlpha = 0.08 - i * 0.02;

            graphics.fillStyle(auraColor, layerAlpha);
            graphics.fillCircle(center.x, center.y + 5, layerRadius);
        }

        // Inner glow ring
        graphics.lineStyle(1, auraColor, 0.3);
        graphics.strokeCircle(center.x, center.y + 5, 40);
    }

    /**
     * Render head with appropriate eye size
     */
    renderHead(graphics, center, headScale, headColor, eyeConfig, eyeSizeMultiplier = 1.0, mood = 'content') {
        // Head shape
        const headRadius = 18 * headScale;

        // Head shadow
        graphics.fillStyle(0x000000, 0.2);
        graphics.fillCircle(center.x + 2, center.y - 18, headRadius);

        // Main head
        graphics.fillStyle(headColor, 0.95);
        graphics.fillCircle(center.x, center.y - 20, headRadius);

        // Head highlight
        graphics.fillStyle(this.lightenColor(headColor, 0.3), 0.7);
        graphics.fillCircle(center.x - 5, center.y - 25, headRadius * 0.6);

        // Eyes with multiplied size - now mood-aware
        const baseEyeSize = 6;
        const eyeSize = baseEyeSize * eyeSizeMultiplier;
        const eyeSpacing = 10 * (eyeSizeMultiplier > 1.5 ? 0.8 : 1.0);
        const eyeY = center.y - 22;
        const eyeColor = eyeConfig.color || 0x4A148C;

        // Render mood-specific eyes
        this.renderMoodEyes(graphics, center, eyeSpacing, eyeY, eyeSize, eyeColor, mood, eyeSizeMultiplier);

        // Add mood extras (blush, tears, etc.)
        this.renderMoodExtras(graphics, center, mood, eyeY, eyeSpacing);
    }

    /**
     * Get mood configuration for visual rendering
     * @param {string} mood - Mood state
     * @returns {Object} Mood visual configuration
     */
    getMoodConfig(mood) {
        const configs = {
            ecstatic: {
                eyeShape: 'happy_closed',
                blush: true,
                blushColor: 0xFFB6C1,
                blushIntensity: 0.4,
                hearts: true,
                pupilSize: 1.2
            },
            happy: {
                eyeShape: 'curved_happy',
                blush: true,
                blushColor: 0xFFCCCC,
                blushIntensity: 0.25,
                pupilSize: 1.1
            },
            content: {
                eyeShape: 'normal',
                pupilSize: 1.0
            },
            neutral: {
                eyeShape: 'normal',
                pupilSize: 0.95
            },
            tired: {
                eyeShape: 'droopy',
                pupilSize: 0.85
            },
            sad: {
                eyeShape: 'sad',
                tears: true,
                pupilSize: 0.9
            },
            distressed: {
                eyeShape: 'worried',
                tears: true,
                sweat: true,
                pupilSize: 0.8
            }
        };
        return configs[mood] || configs.content;
    }

    /**
     * Render mood-specific eye shapes
     */
    renderMoodEyes(graphics, center, eyeSpacing, eyeY, eyeSize, eyeColor, mood, eyeSizeMultiplier) {
        const moodConfig = this.getMoodConfig(mood);
        const sparkleSize = eyeSizeMultiplier > 1.5 ? 2.5 : 1.5;

        const leftEyeX = center.x - eyeSpacing;
        const rightEyeX = center.x + eyeSpacing;

        switch (moodConfig.eyeShape) {
            case 'happy_closed':
                // ^_^ style closed happy eyes
                graphics.lineStyle(2.5, 0x000000, 0.9);
                // Left eye arc
                graphics.beginPath();
                graphics.arc(leftEyeX, eyeY, eyeSize * 0.7, Math.PI * 0.2, Math.PI * 0.8, false);
                graphics.strokePath();
                // Right eye arc
                graphics.beginPath();
                graphics.arc(rightEyeX, eyeY, eyeSize * 0.7, Math.PI * 0.2, Math.PI * 0.8, false);
                graphics.strokePath();
                break;

            case 'curved_happy':
                // Slightly squinted happy eyes
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillEllipse(leftEyeX, eyeY, eyeSize, eyeSize * 0.75);
                graphics.fillEllipse(rightEyeX, eyeY, eyeSize, eyeSize * 0.75);

                // Iris (slightly raised, looking up slightly)
                graphics.fillStyle(eyeColor, 0.9);
                graphics.fillCircle(leftEyeX, eyeY - 1, eyeSize * 0.5 * moodConfig.pupilSize);
                graphics.fillCircle(rightEyeX, eyeY - 1, eyeSize * 0.5 * moodConfig.pupilSize);

                // Pupils
                graphics.fillStyle(0x000000, 0.95);
                graphics.fillCircle(leftEyeX, eyeY - 1, eyeSize * 0.25);
                graphics.fillCircle(rightEyeX, eyeY - 1, eyeSize * 0.25);

                // Extra sparkles for happy mood
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillCircle(leftEyeX - 1.5, eyeY - 2.5, sparkleSize);
                graphics.fillCircle(rightEyeX - 1.5, eyeY - 2.5, sparkleSize);
                graphics.fillCircle(leftEyeX + 1, eyeY, sparkleSize * 0.5);
                graphics.fillCircle(rightEyeX + 1, eyeY, sparkleSize * 0.5);
                break;

            case 'droopy':
                // Half-lidded tired eyes
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillEllipse(leftEyeX, eyeY + 1, eyeSize, eyeSize * 0.55);
                graphics.fillEllipse(rightEyeX, eyeY + 1, eyeSize, eyeSize * 0.55);

                // Iris (slightly drooped)
                graphics.fillStyle(eyeColor, 0.7);
                graphics.fillCircle(leftEyeX, eyeY + 2, eyeSize * 0.4);
                graphics.fillCircle(rightEyeX, eyeY + 2, eyeSize * 0.4);

                // Pupils
                graphics.fillStyle(0x000000, 0.8);
                graphics.fillCircle(leftEyeX, eyeY + 2, eyeSize * 0.2);
                graphics.fillCircle(rightEyeX, eyeY + 2, eyeSize * 0.2);

                // Heavy eyelids
                graphics.fillStyle(0x000000, 0.25);
                graphics.fillRect(leftEyeX - eyeSize, eyeY - eyeSize * 0.5, eyeSize * 2, eyeSize * 0.6);
                graphics.fillRect(rightEyeX - eyeSize, eyeY - eyeSize * 0.5, eyeSize * 2, eyeSize * 0.6);

                // Small sparkle
                graphics.fillStyle(0xFFFFFF, 0.6);
                graphics.fillCircle(leftEyeX - 1, eyeY, sparkleSize * 0.7);
                graphics.fillCircle(rightEyeX - 1, eyeY, sparkleSize * 0.7);
                break;

            case 'sad':
                // Downward-curved sad eyes
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillCircle(leftEyeX, eyeY, eyeSize);
                graphics.fillCircle(rightEyeX, eyeY, eyeSize);

                // Iris (looking down)
                graphics.fillStyle(eyeColor, 0.9);
                graphics.fillCircle(leftEyeX, eyeY + 2, eyeSize * 0.5 * moodConfig.pupilSize);
                graphics.fillCircle(rightEyeX, eyeY + 2, eyeSize * 0.5 * moodConfig.pupilSize);

                // Pupils
                graphics.fillStyle(0x000000, 0.95);
                graphics.fillCircle(leftEyeX, eyeY + 2, eyeSize * 0.25);
                graphics.fillCircle(rightEyeX, eyeY + 2, eyeSize * 0.25);

                // Sad eyebrow curves
                graphics.lineStyle(1.5, 0x000000, 0.5);
                graphics.beginPath();
                graphics.moveTo(leftEyeX - eyeSize, eyeY - eyeSize - 1);
                graphics.lineTo(leftEyeX + eyeSize, eyeY - eyeSize + 2);
                graphics.strokePath();
                graphics.beginPath();
                graphics.moveTo(rightEyeX - eyeSize, eyeY - eyeSize + 2);
                graphics.lineTo(rightEyeX + eyeSize, eyeY - eyeSize - 1);
                graphics.strokePath();

                // Dim sparkle
                graphics.fillStyle(0xFFFFFF, 0.5);
                graphics.fillCircle(leftEyeX - 1, eyeY - 1, sparkleSize * 0.8);
                graphics.fillCircle(rightEyeX - 1, eyeY - 1, sparkleSize * 0.8);
                break;

            case 'worried':
                // Uneven worried eyes
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillCircle(leftEyeX, eyeY, eyeSize);
                graphics.fillCircle(rightEyeX, eyeY, eyeSize);

                // Iris (looking to the side slightly, uneven)
                graphics.fillStyle(eyeColor, 0.9);
                graphics.fillCircle(leftEyeX + 1, eyeY, eyeSize * 0.45 * moodConfig.pupilSize);
                graphics.fillCircle(rightEyeX - 1, eyeY + 1, eyeSize * 0.45 * moodConfig.pupilSize);

                // Pupils
                graphics.fillStyle(0x000000, 0.95);
                graphics.fillCircle(leftEyeX + 1, eyeY, eyeSize * 0.22);
                graphics.fillCircle(rightEyeX - 1, eyeY + 1, eyeSize * 0.22);

                // Worried eyebrows (uneven)
                graphics.lineStyle(1.5, 0x000000, 0.6);
                graphics.beginPath();
                graphics.moveTo(leftEyeX - eyeSize, eyeY - eyeSize + 2);
                graphics.lineTo(leftEyeX + eyeSize, eyeY - eyeSize - 2);
                graphics.strokePath();
                graphics.beginPath();
                graphics.moveTo(rightEyeX - eyeSize, eyeY - eyeSize - 2);
                graphics.lineTo(rightEyeX + eyeSize, eyeY - eyeSize + 2);
                graphics.strokePath();

                // Small sparkles
                graphics.fillStyle(0xFFFFFF, 0.7);
                graphics.fillCircle(leftEyeX - 1, eyeY - 2, sparkleSize * 0.6);
                graphics.fillCircle(rightEyeX - 2, eyeY - 1, sparkleSize * 0.6);
                break;

            default:
                // Normal eyes (content/neutral)
                graphics.fillStyle(0xFFFFFF, 0.95);
                graphics.fillCircle(leftEyeX, eyeY, eyeSize);
                graphics.fillCircle(rightEyeX, eyeY, eyeSize);

                // Iris
                graphics.fillStyle(eyeColor, 0.9);
                graphics.fillCircle(leftEyeX, eyeY + 1, eyeSize * 0.6 * moodConfig.pupilSize);
                graphics.fillCircle(rightEyeX, eyeY + 1, eyeSize * 0.6 * moodConfig.pupilSize);

                // Pupils
                graphics.fillStyle(0x000000, 0.95);
                graphics.fillCircle(leftEyeX, eyeY + 1, eyeSize * 0.3);
                graphics.fillCircle(rightEyeX, eyeY + 1, eyeSize * 0.3);

                // Standard sparkles
                graphics.fillStyle(0xFFFFFF, 0.9);
                graphics.fillCircle(leftEyeX - 1, eyeY - 1, sparkleSize);
                graphics.fillCircle(rightEyeX - 1, eyeY - 1, sparkleSize);
                break;
        }
    }

    /**
     * Render mood extras (blush, tears, sweat, hearts)
     */
    renderMoodExtras(graphics, center, mood, eyeY, eyeSpacing) {
        const moodConfig = this.getMoodConfig(mood);

        // Blush
        if (moodConfig.blush) {
            graphics.fillStyle(moodConfig.blushColor, moodConfig.blushIntensity || 0.3);
            graphics.fillEllipse(center.x - eyeSpacing - 5, eyeY + 8, 6, 4);
            graphics.fillEllipse(center.x + eyeSpacing + 5, eyeY + 8, 6, 4);
        }

        // Tears
        if (moodConfig.tears) {
            graphics.fillStyle(0x87CEEB, 0.7);
            // Left tear
            graphics.beginPath();
            graphics.moveTo(center.x - eyeSpacing - 2, eyeY + 6);
            graphics.lineTo(center.x - eyeSpacing - 4, eyeY + 12);
            graphics.lineTo(center.x - eyeSpacing, eyeY + 12);
            graphics.closePath();
            graphics.fillPath();
            graphics.fillCircle(center.x - eyeSpacing - 2, eyeY + 13, 2);

            // Right tear
            graphics.beginPath();
            graphics.moveTo(center.x + eyeSpacing + 2, eyeY + 6);
            graphics.lineTo(center.x + eyeSpacing, eyeY + 12);
            graphics.lineTo(center.x + eyeSpacing + 4, eyeY + 12);
            graphics.closePath();
            graphics.fillPath();
            graphics.fillCircle(center.x + eyeSpacing + 2, eyeY + 13, 2);
        }

        // Sweat drop
        if (moodConfig.sweat) {
            graphics.fillStyle(0x87CEEB, 0.6);
            // Sweat drop shape
            graphics.beginPath();
            graphics.moveTo(center.x + 20, eyeY - 15);
            graphics.lineTo(center.x + 23, eyeY - 7);
            graphics.lineTo(center.x + 17, eyeY - 7);
            graphics.closePath();
            graphics.fillPath();
            graphics.fillCircle(center.x + 20, eyeY - 5, 3);
        }

        // Hearts for ecstatic
        if (moodConfig.hearts) {
            graphics.fillStyle(0xFF69B4, 0.8);
            // Small floating hearts
            this.drawMiniHeart(graphics, center.x - 25, eyeY - 10, 3);
            this.drawMiniHeart(graphics, center.x + 25, eyeY - 5, 2.5);
        }
    }

    /**
     * Draw a mini heart shape
     */
    drawMiniHeart(graphics, x, y, size) {
        // Simple heart shape using circles and triangle
        graphics.fillCircle(x - size * 0.5, y - size * 0.3, size * 0.5);
        graphics.fillCircle(x + size * 0.5, y - size * 0.3, size * 0.5);
        graphics.beginPath();
        graphics.moveTo(x - size, y);
        graphics.lineTo(x, y + size);
        graphics.lineTo(x + size, y);
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Calculate mood from creature stats
     * @param {Object} stats - Creature stats { happiness, energy, health }
     * @returns {string} Mood state
     */
    static calculateMood(stats) {
        if (!stats) return 'content';

        const { happiness = 100, energy = 100, health = 100 } = stats;
        const avg = (happiness + energy + health) / 3;

        if (avg >= 90 && happiness >= 95) return 'ecstatic';
        if (avg >= 75) return 'happy';
        if (avg >= 55) return 'content';
        if (avg >= 40) return 'neutral';
        if (energy < 30) return 'tired';
        if (happiness < 30) return 'sad';
        if (avg < 25) return 'distressed';
        return 'neutral';
    }

    /**
     * Render wacky mutations - surreal, unusual visual elements
     * Creates unique, memorable creatures with inanimate object traits, extra eyes, etc.
     */
    renderWackyMutations(graphics, center, baseSize, mutations, colors) {
        if (!mutations || mutations.length === 0) return;

        mutations.forEach(mutation => {
            switch (mutation.type) {
                case 'rock_texture':
                    this.renderRockTextureMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'gem_body':
                    this.renderGemBodyMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'geometric_patterns':
                    this.renderGeometricPatternsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'extra_eyes':
                    this.renderExtraEyesMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'floating_parts':
                    this.renderFloatingPartsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'crystal_growths':
                    this.renderCrystalGrowthsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'inanimate_markings':
                    this.renderInanimateMarkingsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'surreal_appendages':
                    this.renderSurrealAppendagesMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'void_patches':
                    this.renderVoidPatchesMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'prismatic_sheen':
                    this.renderPrismaticSheenMutation(graphics, center, baseSize, mutation, colors);
                    break;

                // New mutation types
                case 'mechanical_parts':
                    this.renderMechanicalPartsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'circuit_veins':
                    this.renderCircuitVeinsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'elemental_aura':
                    this.renderElementalAuraMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'plant_growth':
                    this.renderPlantGrowthMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'bioluminescence':
                    this.renderBioluminescenceMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'phantom_limbs':
                    this.renderPhantomLimbsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'cosmic_horns':
                    this.renderCosmicHornsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'nebula_trails':
                    this.renderNebulaTrailsMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'scale_armor':
                    this.renderScaleArmorMutation(graphics, center, baseSize, mutation, colors);
                    break;
                case 'feather_mane':
                    this.renderFeatherManeMutation(graphics, center, baseSize, mutation, colors);
                    break;
            }
        });
    }

    /**
     * Rock texture mutation - craggy, stone-like appearance
     */
    renderRockTextureMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'rough';
        const rockColor = this.darkenColor(colors.body || 0x808080, 0.3);

        // Add rocky patches based on variant
        const numPatches = Math.floor(5 * intensity) + 3;

        for (let i = 0; i < numPatches; i++) {
            const angle = (i / numPatches) * Math.PI * 2;
            const dist = 15 + Math.random() * 15;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.7;

            graphics.fillStyle(rockColor, 0.6 * intensity);

            if (variant === 'crystalline') {
                // Angular crystal-like rocks
                const size = 4 + Math.random() * 4;
                graphics.beginPath();
                graphics.moveTo(x, y - size);
                graphics.lineTo(x - size, y);
                graphics.lineTo(x - size / 2, y + size);
                graphics.lineTo(x + size / 2, y + size);
                graphics.lineTo(x + size, y);
                graphics.closePath();
                graphics.fillPath();
            } else if (variant === 'volcanic') {
                // Glowing cracks
                graphics.fillStyle(0xFF4500, 0.4 * intensity);
                graphics.lineStyle(2, 0xFF6600, 0.5 * intensity);
                const size = 3 + Math.random() * 3;
                graphics.fillCircle(x, y, size);
                graphics.beginPath();
                graphics.moveTo(x - size * 2, y);
                graphics.lineTo(x + size * 2, y);
                graphics.strokePath();
            } else {
                // Rough rounded rocks
                const size = 3 + Math.random() * 5;
                graphics.fillCircle(x, y, size);
            }
        }
    }

    /**
     * Gem body mutation - faceted, crystalline appearance
     */
    renderGemBodyMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'amethyst';

        const gemColors = {
            ruby: 0xE91E63,
            sapphire: 0x2196F3,
            emerald: 0x4CAF50,
            amethyst: 0x9C27B0,
            diamond: 0xE0E0E0
        };

        const gemColor = gemColors[variant] || gemColors.amethyst;

        // Add gem facets overlay
        const numFacets = Math.floor(6 * intensity) + 4;

        for (let i = 0; i < numFacets; i++) {
            const angle = (i / numFacets) * Math.PI * 2;
            const dist = 10 + Math.random() * 20;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.6;
            const size = 5 + Math.random() * 8;

            // Gem facet
            graphics.fillStyle(gemColor, 0.4 * intensity);
            graphics.beginPath();
            graphics.moveTo(x, y - size);
            graphics.lineTo(x + size * 0.8, y);
            graphics.lineTo(x, y + size * 0.5);
            graphics.lineTo(x - size * 0.8, y);
            graphics.closePath();
            graphics.fillPath();

            // Highlight
            graphics.fillStyle(0xFFFFFF, 0.3 * intensity);
            graphics.fillCircle(x - size * 0.3, y - size * 0.3, size * 0.3);
        }
    }

    /**
     * Geometric patterns mutation - angular impossible geometry
     */
    renderGeometricPatternsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'triangles';
        const patternColor = this.lightenColor(colors.accent || 0xFFD700, 0.2);

        graphics.lineStyle(1.5, patternColor, 0.6 * intensity);

        if (variant === 'hexagons') {
            // Honeycomb pattern
            for (let i = 0; i < 4; i++) {
                const x = center.x + (Math.random() - 0.5) * 30;
                const y = center.y + (Math.random() - 0.5) * 30;
                const size = 6 + Math.random() * 4;
                this.drawHexagon(graphics, x, y, size);
            }
        } else if (variant === 'fractals') {
            // Recursive patterns
            this.drawFractalPattern(graphics, center.x, center.y, 15, 3, intensity);
        } else if (variant === 'spirals') {
            // Sacred geometry spirals
            graphics.beginPath();
            for (let a = 0; a < Math.PI * 4; a += 0.2) {
                const r = 5 + a * 3 * intensity;
                const x = center.x + Math.cos(a) * r;
                const y = center.y + Math.sin(a) * r * 0.6;
                if (a === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.strokePath();
        } else {
            // Triangle patterns
            for (let i = 0; i < 5; i++) {
                const x = center.x + (Math.random() - 0.5) * 35;
                const y = center.y + (Math.random() - 0.5) * 35;
                const size = 5 + Math.random() * 5;
                graphics.strokeTriangle(x, y - size, x - size, y + size, x + size, y + size);
            }
        }
    }

    /**
     * Draw a hexagon helper
     */
    drawHexagon(graphics, x, y, size) {
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const px = x + Math.cos(angle) * size;
            const py = y + Math.sin(angle) * size;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.strokePath();
    }

    /**
     * Draw fractal pattern helper
     */
    drawFractalPattern(graphics, x, y, size, depth, intensity) {
        if (depth <= 0 || size < 3) return;

        graphics.strokeTriangle(x, y - size, x - size, y + size, x + size, y + size);

        // Recurse into corners
        const nextSize = size * 0.5;
        this.drawFractalPattern(graphics, x, y - size * 0.5, nextSize, depth - 1, intensity);
        this.drawFractalPattern(graphics, x - size * 0.5, y + size * 0.3, nextSize, depth - 1, intensity);
        this.drawFractalPattern(graphics, x + size * 0.5, y + size * 0.3, nextSize, depth - 1, intensity);
    }

    /**
     * Extra eyes mutation - 1-3 additional eyes in unusual positions
     */
    renderExtraEyesMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'forehead';
        const eyeColor = colors.accent || 0x9C27B0;

        const eyePositions = {
            forehead: [{ x: 0, y: -35 }],
            sides: [{ x: -25, y: -5 }, { x: 25, y: -5 }],
            back: [{ x: 0, y: 25 }],
            floating: [
                { x: -30, y: -30 },
                { x: 30, y: -25 },
                { x: 0, y: 35 }
            ]
        };

        const positions = eyePositions[variant] || eyePositions.forehead;
        const numEyes = Math.min(positions.length, Math.floor(intensity * 3) + 1);

        for (let i = 0; i < numEyes; i++) {
            const pos = positions[i];
            const x = center.x + pos.x;
            const y = center.y + pos.y;
            const eyeSize = 4 + intensity * 2;

            // Eye white
            graphics.fillStyle(0xFFFFFF, 0.9);
            graphics.fillCircle(x, y, eyeSize);

            // Iris
            graphics.fillStyle(eyeColor, 0.85);
            graphics.fillCircle(x, y + 1, eyeSize * 0.6);

            // Pupil
            graphics.fillStyle(0x000000, 0.9);
            graphics.fillCircle(x, y + 1, eyeSize * 0.3);

            // Sparkle
            graphics.fillStyle(0xFFFFFF, 0.8);
            graphics.fillCircle(x - 1, y - 1, eyeSize * 0.2);

            // Floating eyes have ethereal glow
            if (variant === 'floating') {
                graphics.fillStyle(eyeColor, 0.2);
                graphics.fillCircle(x, y, eyeSize * 2);
            }
        }
    }

    /**
     * Floating parts mutation - detached elements orbiting the creature
     */
    renderFloatingPartsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'orbs';
        const floatColor = colors.accent || 0xE6E6FA;

        const numParts = Math.floor(intensity * 4) + 2;

        for (let i = 0; i < numParts; i++) {
            const angle = (i / numParts) * Math.PI * 2;
            const dist = 35 + Math.random() * 15;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.5;

            if (variant === 'orbs') {
                // Glowing orbs
                const size = 4 + Math.random() * 4;
                graphics.fillStyle(floatColor, 0.3);
                graphics.fillCircle(x, y, size * 1.5);
                graphics.fillStyle(floatColor, 0.7);
                graphics.fillCircle(x, y, size);
                graphics.fillStyle(0xFFFFFF, 0.5);
                graphics.fillCircle(x - 1, y - 1, size * 0.4);
            } else if (variant === 'fragments') {
                // Broken fragments
                const size = 3 + Math.random() * 4;
                graphics.fillStyle(colors.body || floatColor, 0.6);
                graphics.fillTriangle(
                    x, y - size,
                    x - size, y + size,
                    x + size, y + size * 0.5
                );
            } else if (variant === 'rings') {
                // Floating rings
                const size = 6 + Math.random() * 4;
                graphics.lineStyle(2, floatColor, 0.7);
                graphics.strokeCircle(x, y, size);
            } else if (variant === 'crystals') {
                // Floating crystal shards
                const size = 4 + Math.random() * 4;
                graphics.fillStyle(floatColor, 0.75);
                graphics.beginPath();
                graphics.moveTo(x, y - size * 1.5);
                graphics.lineTo(x - size * 0.6, y);
                graphics.lineTo(x, y + size * 0.5);
                graphics.lineTo(x + size * 0.6, y);
                graphics.closePath();
                graphics.fillPath();
            }

            // Connection line to body
            graphics.lineStyle(1, floatColor, 0.15);
            graphics.beginPath();
            graphics.moveTo(center.x, center.y);
            graphics.lineTo(x, y);
            graphics.strokePath();
        }
    }

    /**
     * Crystal growths mutation - crystal formations on body
     */
    renderCrystalGrowthsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'clusters';
        const crystalColor = this.lightenColor(colors.accent || 0xE6E6FA, 0.2);

        if (variant === 'crown') {
            // Crystal crown on head
            const crownY = center.y - 35;
            for (let i = 0; i < 5; i++) {
                const x = center.x + (i - 2) * 6;
                const height = 8 + Math.random() * 8 * intensity;

                graphics.fillStyle(crystalColor, 0.85);
                graphics.beginPath();
                graphics.moveTo(x - 3, crownY);
                graphics.lineTo(x, crownY - height);
                graphics.lineTo(x + 3, crownY);
                graphics.closePath();
                graphics.fillPath();
            }
        } else if (variant === 'spires') {
            // Large crystal spires
            const positions = [
                { x: -20, y: -10 },
                { x: 20, y: -5 },
                { x: 0, y: 15 }
            ];

            positions.forEach(pos => {
                const x = center.x + pos.x;
                const y = center.y + pos.y;
                const height = 15 + Math.random() * 10 * intensity;

                graphics.fillStyle(crystalColor, 0.8);
                graphics.beginPath();
                graphics.moveTo(x - 4, y);
                graphics.lineTo(x - 2, y - height);
                graphics.lineTo(x + 2, y - height);
                graphics.lineTo(x + 4, y);
                graphics.closePath();
                graphics.fillPath();

                // Glow
                graphics.fillStyle(crystalColor, 0.3);
                graphics.fillCircle(x, y - height / 2, 6);
            });
        } else if (variant === 'embedded') {
            // Crystals embedded in body
            const numCrystals = Math.floor(6 * intensity) + 3;
            for (let i = 0; i < numCrystals; i++) {
                const angle = (i / numCrystals) * Math.PI * 2;
                const dist = 12 + Math.random() * 10;
                const x = center.x + Math.cos(angle) * dist;
                const y = center.y + Math.sin(angle) * dist * 0.6;
                const size = 3 + Math.random() * 3;

                graphics.fillStyle(crystalColor, 0.7);
                graphics.fillCircle(x, y, size);
                graphics.fillStyle(0xFFFFFF, 0.4);
                graphics.fillCircle(x - 1, y - 1, size * 0.4);
            }
        } else {
            // Clusters
            const clusterPositions = [
                { x: -15, y: 5 },
                { x: 15, y: 0 },
                { x: 0, y: 20 }
            ];

            clusterPositions.forEach(pos => {
                const baseX = center.x + pos.x;
                const baseY = center.y + pos.y;

                for (let j = 0; j < 3; j++) {
                    const x = baseX + (Math.random() - 0.5) * 8;
                    const y = baseY + (Math.random() - 0.5) * 8;
                    const height = 6 + Math.random() * 6 * intensity;

                    graphics.fillStyle(crystalColor, 0.75);
                    graphics.beginPath();
                    graphics.moveTo(x - 2, y);
                    graphics.lineTo(x, y - height);
                    graphics.lineTo(x + 2, y);
                    graphics.closePath();
                    graphics.fillPath();
                }
            });
        }
    }

    /**
     * Inanimate markings mutation - circuits, runes, gears, glyphs
     */
    renderInanimateMarkingsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'circuits';
        const markingColor = colors.accent || 0x00FFFF;

        graphics.lineStyle(1.5, markingColor, 0.6 * intensity);

        if (variant === 'circuits') {
            // Circuit board patterns
            const startPoints = [
                { x: -20, y: -10 },
                { x: 15, y: 5 },
                { x: -5, y: 15 }
            ];

            startPoints.forEach(start => {
                const x = center.x + start.x;
                const y = center.y + start.y;

                graphics.beginPath();
                graphics.moveTo(x, y);
                graphics.lineTo(x + 10, y);
                graphics.lineTo(x + 10, y + 8);
                graphics.lineTo(x + 18, y + 8);
                graphics.strokePath();

                // Connection nodes
                graphics.fillStyle(markingColor, 0.8);
                graphics.fillCircle(x, y, 2);
                graphics.fillCircle(x + 10, y, 2);
                graphics.fillCircle(x + 18, y + 8, 2);
            });
        } else if (variant === 'runes') {
            // Mystical runes
            graphics.fillStyle(markingColor, 0.5 * intensity);

            const runePositions = [
                { x: -12, y: 0 },
                { x: 12, y: 5 },
                { x: 0, y: -15 }
            ];

            runePositions.forEach(pos => {
                const x = center.x + pos.x;
                const y = center.y + pos.y;

                // Simple rune shapes
                graphics.strokeRect(x - 4, y - 6, 8, 12);
                graphics.beginPath();
                graphics.moveTo(x, y - 6);
                graphics.lineTo(x, y + 6);
                graphics.strokePath();
            });
        } else if (variant === 'gears') {
            // Mechanical gears
            [
                { x: -15, y: 0, size: 8 },
                { x: 12, y: 5, size: 6 },
                { x: 0, y: -12, size: 5 }
            ].forEach(gear => {
                const x = center.x + gear.x;
                const y = center.y + gear.y;

                // Gear teeth
                graphics.strokeCircle(x, y, gear.size);
                for (let t = 0; t < 8; t++) {
                    const angle = (t / 8) * Math.PI * 2;
                    const innerX = x + Math.cos(angle) * gear.size;
                    const innerY = y + Math.sin(angle) * gear.size;
                    const outerX = x + Math.cos(angle) * (gear.size + 3);
                    const outerY = y + Math.sin(angle) * (gear.size + 3);
                    graphics.beginPath();
                    graphics.moveTo(innerX, innerY);
                    graphics.lineTo(outerX, outerY);
                    graphics.strokePath();
                }

                // Center hole
                graphics.fillStyle(markingColor, 0.3);
                graphics.fillCircle(x, y, gear.size * 0.3);
            });
        } else {
            // Ancient glyphs
            graphics.fillStyle(markingColor, 0.5 * intensity);

            // Glyph shapes
            graphics.strokeTriangle(center.x - 10, center.y + 5, center.x - 5, center.y - 8, center.x, center.y + 5);
            graphics.strokeCircle(center.x + 10, center.y, 5);
            graphics.beginPath();
            graphics.moveTo(center.x, center.y + 15);
            graphics.lineTo(center.x - 5, center.y + 25);
            graphics.lineTo(center.x + 5, center.y + 25);
            graphics.closePath();
            graphics.strokePath();
        }
    }

    /**
     * Surreal appendages mutation - tentacles, ribbons, flames, shadows
     */
    renderSurrealAppendagesMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'tentacles';
        const appendageColor = colors.accent || 0x9C27B0;

        if (variant === 'tentacles') {
            // Ethereal tentacles
            const numTentacles = Math.floor(3 * intensity) + 2;

            for (let i = 0; i < numTentacles; i++) {
                const angle = (i / numTentacles) * Math.PI + Math.PI / 2;
                const startX = center.x + Math.cos(angle) * 15;
                const startY = center.y + 20;

                graphics.lineStyle(3, appendageColor, 0.7);
                graphics.beginPath();
                graphics.moveTo(startX, startY);

                // Wavy tentacle
                let x = startX;
                let y = startY;
                for (let j = 0; j < 5; j++) {
                    x += Math.sin(j + i) * 8;
                    y += 8;
                    graphics.lineTo(x, y);
                }
                graphics.strokePath();

                // Tip
                graphics.fillStyle(appendageColor, 0.5);
                graphics.fillCircle(x, y, 3);
            }
        } else if (variant === 'ribbons') {
            // Flowing ribbons
            const ribbonColor = this.lightenColor(appendageColor, 0.2);

            for (let i = 0; i < 3; i++) {
                const startAngle = (i / 3) * Math.PI * 2;
                const startX = center.x + Math.cos(startAngle) * 20;
                const startY = center.y + Math.sin(startAngle) * 15;

                graphics.fillStyle(ribbonColor, 0.5);
                graphics.beginPath();
                graphics.moveTo(startX, startY);

                for (let j = 0; j < 4; j++) {
                    const wave = Math.sin(j * 1.5 + i) * 15;
                    graphics.lineTo(startX + j * 12 + wave, startY + j * 5);
                }

                for (let j = 3; j >= 0; j--) {
                    const wave = Math.sin(j * 1.5 + i) * 15;
                    graphics.lineTo(startX + j * 12 + wave, startY + j * 5 + 4);
                }

                graphics.closePath();
                graphics.fillPath();
            }
        } else if (variant === 'flames') {
            // Ethereal flames
            const flameColor = 0xE040FB; // Purple flame

            for (let i = 0; i < 4; i++) {
                const x = center.x + (i - 1.5) * 12;
                const y = center.y + 25;
                const height = 15 + Math.random() * 10 * intensity;

                // Flame layers - using triangle approximation for flames
                for (let layer = 0; layer < 3; layer++) {
                    const layerAlpha = 0.4 - layer * 0.1;
                    const layerWidth = 6 - layer * 1.5;

                    graphics.fillStyle(this.lightenColor(flameColor, layer * 0.15), layerAlpha);
                    graphics.beginPath();
                    graphics.moveTo(x - layerWidth, y);
                    // Approximate flame curve with line segments
                    graphics.lineTo(x - layerWidth * 0.6, y - height * 0.4);
                    graphics.lineTo(x, y - height);
                    graphics.lineTo(x + layerWidth * 0.6, y - height * 0.4);
                    graphics.lineTo(x + layerWidth, y);
                    graphics.closePath();
                    graphics.fillPath();
                }
            }
        } else {
            // Shadows - use ellipses instead of complex curves
            graphics.fillStyle(0x000000, 0.3 * intensity);

            for (let i = 0; i < 3; i++) {
                const x = center.x + (Math.random() - 0.5) * 40;
                const y = center.y + (Math.random() - 0.5) * 40;
                const size = 10 + Math.random() * 15;

                // Shadow blob as ellipse (simpler and Phaser-compatible)
                graphics.fillEllipse(x, y, size, size * 0.8);
            }
        }
    }

    /**
     * Void patches mutation - dark, starry void areas
     */
    renderVoidPatchesMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'small';

        const sizes = {
            small: { count: 3, size: 8 },
            medium: { count: 2, size: 15 },
            swirling: { count: 2, size: 12 },
            crackling: { count: 4, size: 10 }
        };

        const config = sizes[variant] || sizes.small;

        for (let i = 0; i < config.count; i++) {
            const x = center.x + (Math.random() - 0.5) * 30;
            const y = center.y + (Math.random() - 0.5) * 30;
            const patchSize = config.size * (0.8 + Math.random() * 0.4);

            // Dark void base
            graphics.fillStyle(0x0D001A, 0.8 * intensity);
            graphics.fillCircle(x, y, patchSize);

            // Darker center
            graphics.fillStyle(0x000000, 0.9);
            graphics.fillCircle(x, y, patchSize * 0.6);

            // Star-like sparkles within void
            graphics.fillStyle(0xFFFFFF, 0.8);
            for (let s = 0; s < 4; s++) {
                const starX = x + (Math.random() - 0.5) * patchSize;
                const starY = y + (Math.random() - 0.5) * patchSize;
                graphics.fillCircle(starX, starY, 0.5 + Math.random());
            }

            if (variant === 'swirling') {
                // Swirl effect
                graphics.lineStyle(1, 0x4A148C, 0.5);
                graphics.beginPath();
                for (let a = 0; a < Math.PI * 2; a += 0.3) {
                    const r = patchSize * (0.3 + a / (Math.PI * 4));
                    const px = x + Math.cos(a) * r;
                    const py = y + Math.sin(a) * r;
                    if (a === 0) {
                        graphics.moveTo(px, py);
                    } else {
                        graphics.lineTo(px, py);
                    }
                }
                graphics.strokePath();
            } else if (variant === 'crackling') {
                // Energy crackling at edges
                graphics.lineStyle(1, 0x7B1FA2, 0.6);
                for (let c = 0; c < 4; c++) {
                    const angle = (c / 4) * Math.PI * 2;
                    const edgeX = x + Math.cos(angle) * patchSize;
                    const edgeY = y + Math.sin(angle) * patchSize;
                    const crackX = x + Math.cos(angle) * (patchSize + 5 + Math.random() * 5);
                    const crackY = y + Math.sin(angle) * (patchSize + 5 + Math.random() * 5);

                    graphics.beginPath();
                    graphics.moveTo(edgeX, edgeY);
                    graphics.lineTo(crackX, crackY);
                    graphics.strokePath();
                }
            }
        }
    }

    /**
     * Prismatic sheen mutation - rainbow/iridescent effects
     */
    renderPrismaticSheenMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'rainbow';

        const prismaticColors = {
            rainbow: [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x8B00FF],
            opalescent: [0xFFE4E1, 0xE6E6FA, 0xB0E0E6, 0xF0FFF0, 0xFFF0F5],
            oil_slick: [0x4A148C, 0x1A237E, 0x006064, 0x1B5E20, 0x311B92],
            aurora: [0x00FF7F, 0x00CED1, 0x9370DB, 0xFF69B4, 0x00FA9A]
        };

        const colorSet = prismaticColors[variant] || prismaticColors.rainbow;

        // Overlapping color patches
        colorSet.forEach((color, i) => {
            const angle = (i / colorSet.length) * Math.PI * 2;
            const dist = 5 + Math.random() * 10;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.7;
            const size = 20 + Math.random() * 15;

            graphics.fillStyle(color, 0.15 * intensity);
            graphics.fillEllipse(x, y, size, size * 0.8);
        });

        // Shimmer highlights
        graphics.fillStyle(0xFFFFFF, 0.2 * intensity);
        for (let i = 0; i < 5; i++) {
            const x = center.x + (Math.random() - 0.5) * 30;
            const y = center.y + (Math.random() - 0.5) * 25;
            graphics.fillCircle(x, y, 2 + Math.random() * 3);
        }

        // Border shimmer
        if (variant === 'aurora') {
            graphics.lineStyle(2, 0x00FF7F, 0.3 * intensity);
            graphics.strokeCircle(center.x, center.y + 5, 35);
            graphics.lineStyle(2, 0x9370DB, 0.2 * intensity);
            graphics.strokeCircle(center.x, center.y + 5, 38);
        }
    }

    // ==================== NEW MUTATION RENDERERS ====================

    /**
     * Mechanical parts mutation - gears, pistons, clockwork
     */
    renderMechanicalPartsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'gears';
        const metalColor = 0x78909C; // Steel gray

        const numParts = Math.floor(3 * intensity) + 2;

        for (let i = 0; i < numParts; i++) {
            const angle = (i / numParts) * Math.PI * 2;
            const dist = 15 + Math.random() * 10;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist * 0.7;
            const size = 6 + Math.random() * 4;

            if (variant === 'gears') {
                // Gear teeth
                graphics.fillStyle(metalColor, 0.8 * intensity);
                for (let t = 0; t < 8; t++) {
                    const toothAngle = (t / 8) * Math.PI * 2;
                    const toothX = x + Math.cos(toothAngle) * size;
                    const toothY = y + Math.sin(toothAngle) * size;
                    graphics.fillRect(toothX - 1.5, toothY - 1.5, 3, 3);
                }
                // Gear center
                graphics.fillStyle(this.darkenColor(metalColor, 0.3));
                graphics.fillCircle(x, y, size * 0.6);
                graphics.fillStyle(0x455A64);
                graphics.fillCircle(x, y, size * 0.2);
            } else if (variant === 'pistons') {
                // Piston cylinder
                graphics.fillStyle(metalColor, 0.8 * intensity);
                graphics.fillRect(x - 2, y - size, 4, size * 2);
                graphics.fillStyle(0xB0BEC5, 0.9);
                graphics.fillRect(x - 1.5, y - size * 0.5, 3, size);
            } else {
                // Clockwork - small circles and connectors
                graphics.fillStyle(0xFFD700, 0.6 * intensity);
                graphics.fillCircle(x, y, size * 0.4);
                graphics.lineStyle(1, metalColor, 0.7);
                graphics.strokeCircle(x, y, size * 0.6);
            }
        }
    }

    /**
     * Circuit veins mutation - glowing circuit-like patterns
     */
    renderCircuitVeinsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'blue_glow';

        const glowColors = {
            blue_glow: 0x00BCD4,
            green_glow: 0x4CAF50,
            gold_glow: 0xFFD700,
            pulsing: 0xFF4081
        };

        const glowColor = glowColors[variant] || glowColors.blue_glow;

        // Draw circuit paths
        graphics.lineStyle(1.5, glowColor, 0.7 * intensity);

        for (let i = 0; i < 4; i++) {
            const startAngle = (i / 4) * Math.PI * 2;
            const startX = center.x + Math.cos(startAngle) * 10;
            const startY = center.y + Math.sin(startAngle) * 8;

            graphics.beginPath();
            graphics.moveTo(startX, startY);

            // Create angular circuit path
            let currentX = startX;
            let currentY = startY;
            for (let j = 0; j < 3; j++) {
                if (j % 2 === 0) {
                    currentX += (Math.random() - 0.5) * 20;
                } else {
                    currentY += (Math.random() - 0.5) * 15;
                }
                graphics.lineTo(currentX, currentY);
            }
            graphics.strokePath();

            // Node points
            graphics.fillStyle(glowColor, 0.9 * intensity);
            graphics.fillCircle(currentX, currentY, 2);
        }

        // Glow effect around center
        graphics.fillStyle(glowColor, 0.15 * intensity);
        graphics.fillCircle(center.x, center.y + 5, 25);
    }

    /**
     * Elemental aura mutation - fire, ice, lightning effects
     */
    renderElementalAuraMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'fire';

        if (variant === 'fire') {
            // Fire flames
            const flameColors = [0xFF6B35, 0xFF9500, 0xFFD93D];
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const x = center.x + Math.cos(angle) * 25;
                const y = center.y + Math.sin(angle) * 20;

                flameColors.forEach((color, ci) => {
                    graphics.fillStyle(color, (0.5 - ci * 0.15) * intensity);
                    graphics.beginPath();
                    graphics.moveTo(x, y);
                    graphics.lineTo(x - 4, y + 10 - ci * 2);
                    graphics.lineTo(x + 4, y + 10 - ci * 2);
                    graphics.closePath();
                    graphics.fillPath();
                });
            }
        } else if (variant === 'ice') {
            // Ice crystals
            graphics.fillStyle(0xB2EBF2, 0.6 * intensity);
            for (let i = 0; i < 5; i++) {
                const x = center.x + (Math.random() - 0.5) * 40;
                const y = center.y + (Math.random() - 0.5) * 35;
                const size = 3 + Math.random() * 4;

                graphics.beginPath();
                graphics.moveTo(x, y - size);
                graphics.lineTo(x - size * 0.5, y);
                graphics.lineTo(x, y + size);
                graphics.lineTo(x + size * 0.5, y);
                graphics.closePath();
                graphics.fillPath();
            }
            // Cold mist
            graphics.fillStyle(0xE0F7FA, 0.2 * intensity);
            graphics.fillCircle(center.x, center.y + 5, 30);
        } else if (variant === 'lightning') {
            // Lightning bolts
            graphics.lineStyle(2, 0xFFEB3B, 0.8 * intensity);
            for (let i = 0; i < 3; i++) {
                const startX = center.x + (Math.random() - 0.5) * 20;
                const startY = center.y - 20;

                graphics.beginPath();
                graphics.moveTo(startX, startY);

                let cx = startX, cy = startY;
                for (let j = 0; j < 4; j++) {
                    cx += (Math.random() - 0.5) * 15;
                    cy += 8;
                    graphics.lineTo(cx, cy);
                }
                graphics.strokePath();
            }
        }
    }

    /**
     * Plant growth mutation - vines, flowers, moss
     */
    renderPlantGrowthMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'vines';

        const plantColor = 0x4CAF50;

        if (variant === 'vines') {
            graphics.lineStyle(2, plantColor, 0.7 * intensity);
            for (let i = 0; i < 4; i++) {
                const startAngle = (i / 4) * Math.PI * 2;
                const startX = center.x + Math.cos(startAngle) * 15;
                const startY = center.y + Math.sin(startAngle) * 12;

                graphics.beginPath();
                graphics.moveTo(startX, startY);

                for (let j = 0; j < 3; j++) {
                    const cx = startX + Math.cos(startAngle + j * 0.3) * (10 + j * 5);
                    const cy = startY + Math.sin(startAngle + j * 0.3) * (8 + j * 4);
                    graphics.lineTo(cx, cy);

                    // Small leaves
                    graphics.fillStyle(0x81C784, 0.6 * intensity);
                    graphics.fillEllipse(cx, cy, 3, 2);
                }
                graphics.strokePath();
            }
        } else if (variant === 'flowers') {
            for (let i = 0; i < 4; i++) {
                const x = center.x + (Math.random() - 0.5) * 35;
                const y = center.y + (Math.random() - 0.5) * 30;

                // Flower petals
                const petalColor = [0xE91E63, 0xFFEB3B, 0x9C27B0, 0xFF5722][i];
                for (let p = 0; p < 5; p++) {
                    const pAngle = (p / 5) * Math.PI * 2;
                    graphics.fillStyle(petalColor, 0.6 * intensity);
                    graphics.fillEllipse(x + Math.cos(pAngle) * 4, y + Math.sin(pAngle) * 4, 3, 5);
                }
                // Flower center
                graphics.fillStyle(0xFFEB3B, 0.9);
                graphics.fillCircle(x, y, 2);
            }
        } else if (variant === 'moss') {
            graphics.fillStyle(0x558B2F, 0.5 * intensity);
            for (let i = 0; i < 8; i++) {
                const x = center.x + (Math.random() - 0.5) * 40;
                const y = center.y + (Math.random() - 0.5) * 35;
                graphics.fillCircle(x, y, 2 + Math.random() * 3);
            }
        }
    }

    /**
     * Bioluminescence mutation - glowing patches
     */
    renderBioluminescenceMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'spots';

        const glowColor = colors.accent || 0x00BCD4;

        if (variant === 'spots') {
            for (let i = 0; i < 6; i++) {
                const x = center.x + (Math.random() - 0.5) * 35;
                const y = center.y + (Math.random() - 0.5) * 30;
                const size = 3 + Math.random() * 4;

                // Glow
                graphics.fillStyle(glowColor, 0.3 * intensity);
                graphics.fillCircle(x, y, size * 2);
                // Core
                graphics.fillStyle(glowColor, 0.8 * intensity);
                graphics.fillCircle(x, y, size);
                // Bright center
                graphics.fillStyle(0xFFFFFF, 0.6 * intensity);
                graphics.fillCircle(x, y, size * 0.4);
            }
        } else if (variant === 'stripes') {
            graphics.lineStyle(3, glowColor, 0.4 * intensity);
            for (let i = 0; i < 4; i++) {
                const y = center.y - 10 + i * 8;
                graphics.beginPath();
                graphics.moveTo(center.x - 20, y);
                graphics.lineTo(center.x + 20, y);
                graphics.strokePath();
            }
        }
    }

    /**
     * Phantom limbs mutation - ghostly translucent extra limbs
     */
    renderPhantomLimbsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'arms';

        const phantomColor = colors.body || 0x9370DB;

        if (variant === 'arms') {
            // Ghostly arms
            graphics.fillStyle(phantomColor, 0.25 * intensity);
            // Left phantom arm
            graphics.fillEllipse(center.x - 30, center.y, 8, 20);
            graphics.fillEllipse(center.x - 35, center.y + 15, 5, 8);
            // Right phantom arm
            graphics.fillEllipse(center.x + 30, center.y, 8, 20);
            graphics.fillEllipse(center.x + 35, center.y + 15, 5, 8);
        } else if (variant === 'wings') {
            graphics.fillStyle(phantomColor, 0.2 * intensity);
            // Phantom wings
            graphics.fillEllipse(center.x - 35, center.y - 10, 15, 25);
            graphics.fillEllipse(center.x + 35, center.y - 10, 15, 25);
        } else if (variant === 'tail') {
            graphics.fillStyle(phantomColor, 0.25 * intensity);
            // Flowing phantom tail
            for (let i = 0; i < 5; i++) {
                graphics.fillEllipse(center.x + i * 8, center.y + 30 + i * 3, 6 - i, 8 - i);
            }
        }
    }

    /**
     * Cosmic horns mutation - star/crystal horn formations
     */
    renderCosmicHornsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'star_tipped';

        const hornColor = colors.accent || 0xFFD700;

        if (variant === 'star_tipped') {
            // Horns with stars at tips
            this.renderHorns(graphics, center, hornColor, 'cosmic', intensity);
        } else if (variant === 'crystal') {
            // Crystal horns
            this.renderHorns(graphics, center, 0x00BCD4, 'crystalline', intensity);
        } else if (variant === 'spiral') {
            this.renderHorns(graphics, center, hornColor, 'spiral', intensity);
        } else {
            this.renderHorns(graphics, center, hornColor, 'antlers', intensity);
        }
    }

    /**
     * Nebula trails mutation - trailing mist effects
     */
    renderNebulaTrailsMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'misty';

        const nebulaColors = [0x9C27B0, 0xE91E63, 0x3F51B5, 0x00BCD4];

        for (let i = 0; i < 5; i++) {
            const x = center.x + (Math.random() - 0.5) * 20;
            const y = center.y + 20 + i * 8;
            const size = 15 - i * 2;
            const color = nebulaColors[i % nebulaColors.length];

            graphics.fillStyle(color, (0.3 - i * 0.05) * intensity);
            graphics.fillEllipse(x, y, size, size * 0.6);
        }

        if (variant === 'sparkling') {
            graphics.fillStyle(0xFFFFFF, 0.8 * intensity);
            for (let i = 0; i < 5; i++) {
                const x = center.x + (Math.random() - 0.5) * 25;
                const y = center.y + 15 + Math.random() * 30;
                graphics.fillCircle(x, y, 1.5);
            }
        }
    }

    /**
     * Scale armor mutation - visible armored scales
     */
    renderScaleArmorMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'dragon';

        const scaleColor = this.darkenColor(colors.body || 0x4A148C, 0.2);

        const rows = 4;
        const scalesPerRow = 6;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < scalesPerRow; col++) {
                const x = center.x - 15 + col * 6 + (row % 2) * 3;
                const y = center.y - 5 + row * 7;

                graphics.fillStyle(scaleColor, 0.6 * intensity);
                graphics.beginPath();
                graphics.moveTo(x, y - 3);
                graphics.lineTo(x + 3, y);
                graphics.lineTo(x, y + 3);
                graphics.lineTo(x - 3, y);
                graphics.closePath();
                graphics.fillPath();

                // Scale highlight
                graphics.fillStyle(0xFFFFFF, 0.15 * intensity);
                graphics.fillCircle(x - 0.5, y - 1, 1);
            }
        }
    }

    /**
     * Feather mane mutation - feathered crest/mane
     */
    renderFeatherManeMutation(graphics, center, baseSize, mutation, colors) {
        const intensity = mutation.intensity || 0.5;
        const variant = mutation.variant || 'mohawk';

        const featherColor = colors.wings || colors.accent || 0xE91E63;

        if (variant === 'mohawk') {
            // Central crest
            for (let i = 0; i < 5; i++) {
                const x = center.x;
                const y = center.y - 30 - i * 5;
                const height = 12 - i * 2;

                graphics.fillStyle(featherColor, (0.8 - i * 0.1) * intensity);
                graphics.beginPath();
                graphics.moveTo(x, y - height);
                graphics.lineTo(x - 3, y);
                graphics.lineTo(x + 3, y);
                graphics.closePath();
                graphics.fillPath();
            }
        } else if (variant === 'flowing') {
            // Side flowing feathers
            for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i < 4; i++) {
                    const x = center.x + side * (8 + i * 3);
                    const y = center.y - 25 + i * 3;
                    const height = 10 - i;

                    graphics.fillStyle(featherColor, (0.7 - i * 0.1) * intensity);
                    graphics.fillEllipse(x, y, 3, height);
                }
            }
        } else {
            // Royal plume
            for (let i = 0; i < 3; i++) {
                const angle = (i - 1) * 0.3;
                const x = center.x + Math.sin(angle) * 10;
                const y = center.y - 35 - Math.cos(angle) * 5;

                graphics.fillStyle(featherColor, 0.7 * intensity);
                graphics.fillEllipse(x, y, 4, 15);

                // Feather tip
                graphics.fillStyle(0xFFD700, 0.6 * intensity);
                graphics.fillCircle(x, y - 12, 2);
            }
        }
    }

    // ==================== END NEW MUTATION RENDERERS ====================

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
     * @param {Phaser.Graphics} graphics - Graphics context
     * @param {Object} genetics - Creature genetics data
     * @param {Object} center - Center position {x, y}
     * @param {Object} size - Size dimensions
     * @param {number} stageGlowIntensity - Stage-specific glow intensity multiplier (1.0 for adult)
     */
    addRarityEffects(graphics, genetics, center, size, stageGlowIntensity = 1.0) {
        const rarity = genetics.rarity;
        const specialFeatures = genetics.traits.features.specialFeatures || [];

        // Common creatures get basic effects
        if (rarity === 'common') {
            return;
        }

        // Uncommon and above get enhanced aura (scaled by stage glow intensity)
        if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'legendary') {
            const baseAuraIntensity = {
                uncommon: 0.2,
                rare: 0.4,
                legendary: 0.6
            }[rarity];

            // Apply stage-specific glow scaling
            const auraIntensity = baseAuraIntensity * stageGlowIntensity;

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

        // Legendary creatures get extra sparkles (scaled by stage glow)
        if (rarity === 'legendary' && stageGlowIntensity > 0.5) {
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
     * @param {Phaser.Graphics} graphics - Graphics context
     * @param {Object} center - Center position {x, y}
     * @param {number} size - Base size
     * @param {Object} markings - Marking configuration
     * @param {Object} colorGenome - Color genome for color calculations
     * @param {number} stageOpacity - Stage-specific opacity multiplier (1.0 for adult)
     */
    addEnhancedMarkings(graphics, center, size, markings, colorGenome, stageOpacity = 1.0) {
        if (!markings || markings.pattern === 'none' || markings.intensity === 0) {
            return;
        }

        const baseColor = this.calculateMarkingColor(colorGenome, markings.colorVariant);
        // Apply stage-specific opacity multiplier
        const baseAlpha = markings.opacity || 0.6;
        const alpha = baseAlpha * stageOpacity;
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
                this.addAuroraStripes(graphics, center, size, [
                    this.extractHexColor(colorGenome.primary, 0x9370DB),
                    this.extractHexColor(colorGenome.secondary, 0x8A2BE2)
                ], scale, intensity);
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
        // Safely extract colors to prevent stack overflow
        const baseColor = this.extractHexColor(colorGenome.primary, 0x9370DB);
        const accentColor = this.extractHexColor(colorGenome.accent, 0xFFD700);

        switch (colorVariant) {
            case 'darker':
                return this.darkenColor(baseColor, 0.3);
            case 'lighter':
                return this.lightenColor(baseColor, 0.3);
            case 'complementary':
                return this.getComplementaryColor(baseColor);
            case 'cosmic':
                // Use accent color with slight enhancement
                return this.lightenColor(accentColor, 0.1);
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
     * Add soft glow effect around creature
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
     * @param {Object} center - Center point {x, y}
     * @param {number} color - Color for glow
     * @param {number} intensity - Intensity of glow (0-1)
     */
    addSoftGlow(graphics, center, color, intensity) {
        const numCircles = 3 + Math.floor(intensity * 3); // 3-6 layers
        const maxRadius = 40 + intensity * 20; // 40-60 pixel radius

        for (let i = 0; i < numCircles; i++) {
            const radius = (maxRadius / numCircles) * (i + 1);
            const alpha = (1 - i / numCircles) * intensity * 0.15; // Fade out, max 15% opacity

            graphics.fillStyle(color, alpha);
            graphics.fillCircle(center.x, center.y, radius);
        }
    }

    /**
     * Add gentle shimmer effect with subtle sparkles
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
     * @param {Object} center - Center point {x, y}
     * @param {number} color - Color for shimmer
     * @param {number} intensity - Intensity of shimmer (0-1)
     */
    addGentleShimmer(graphics, center, color, intensity) {
        const numShimmers = Math.floor(3 + intensity * 5); // 3-8 shimmer points
        const spread = 30 + intensity * 15; // 30-45 pixel spread

        for (let i = 0; i < numShimmers; i++) {
            const angle = (i / numShimmers) * Math.PI * 2 + Math.random() * 0.3;
            const distance = (Math.random() * 0.5 + 0.5) * spread;
            const shimmerX = center.x + Math.cos(angle) * distance;
            const shimmerY = center.y + Math.sin(angle) * distance;
            const shimmerSize = (1 + Math.random() * 1.5) * intensity;

            // Outer glow
            graphics.fillStyle(color, 0.2 * intensity);
            graphics.fillCircle(shimmerX, shimmerY, shimmerSize * 2);

            // Inner bright point
            graphics.fillStyle(this.lightenColor(color, 0.4), 0.6 * intensity);
            graphics.fillCircle(shimmerX, shimmerY, shimmerSize);
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
     * Apply shiny visual effects based on shiny type
     * Called for creatures with genetics.isShiny = true
     * @param {Phaser.Graphics} graphics - Graphics context
     * @param {Object} center - Center position {x, y}
     * @param {Object} size - Creature size {width, height}
     * @param {string} shinyType - Type: 'sparkle', 'chromatic', 'inverted', 'golden'
     * @param {Object} colorGenome - Color genome with shiny modifications
     */
    applyShinyEffects(graphics, center, size, shinyType, colorGenome) {
        console.log(`graphics:debug [GraphicsEngine] Applying shiny effects: ${shinyType}`);

        switch (shinyType) {
            case 'sparkle':
                this.renderSparkleShiny(graphics, center, size, colorGenome);
                break;

            case 'chromatic':
                this.renderChromaticShiny(graphics, center, size, colorGenome);
                break;

            case 'inverted':
                this.renderInvertedShiny(graphics, center, size, colorGenome);
                break;

            case 'golden':
                this.renderGoldenShiny(graphics, center, size, colorGenome);
                break;

            default:
                // Fallback to sparkle
                this.renderSparkleShiny(graphics, center, size, colorGenome);
        }
    }

    /**
     * Sparkle shiny: 8 sparkle points around creature
     */
    renderSparkleShiny(graphics, center, size, colorGenome) {
        const sparkleColor = colorGenome.sparkleColor || 0xFFFFFF;
        const intensity = colorGenome.sparkleIntensity || 0.8;
        const radius = Math.max(size.width, size.height) * 0.5 + 5;

        // Draw 8 sparkle points around creature
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const distance = radius + Math.sin(i * 1.5) * 5; // Slight variation
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;

            // Draw 4-point star sparkle
            this.drawSparkle(graphics, x, y, 4 + (i % 2) * 2, sparkleColor, intensity);
        }

        // Add inner sparkle ring
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 8; // Offset from outer ring
            const x = center.x + Math.cos(angle) * (radius * 0.6);
            const y = center.y + Math.sin(angle) * (radius * 0.6);
            this.drawSparkle(graphics, x, y, 3, sparkleColor, intensity * 0.7);
        }
    }

    /**
     * Draw a 4-point sparkle/star
     */
    drawSparkle(graphics, x, y, size, color, alpha = 1) {
        graphics.fillStyle(color, alpha);

        // Horizontal diamond
        graphics.fillTriangle(x - size, y, x, y - size * 0.4, x + size, y);
        graphics.fillTriangle(x - size, y, x, y + size * 0.4, x + size, y);

        // Vertical diamond
        graphics.fillTriangle(x, y - size, x - size * 0.4, y, x, y + size);
        graphics.fillTriangle(x, y - size, x + size * 0.4, y, x, y + size);

        // Center glow
        graphics.fillStyle(0xFFFFFF, alpha * 0.8);
        graphics.fillCircle(x, y, size * 0.3);
    }

    /**
     * Chromatic shiny: Rainbow outline with RGB offset circles
     */
    renderChromaticShiny(graphics, center, size, colorGenome) {
        const radius = Math.max(size.width, size.height) * 0.55;
        const offset = 3; // RGB offset amount

        // Red channel outline (offset left)
        graphics.lineStyle(2, 0xFF0000, 0.3);
        graphics.strokeCircle(center.x - offset, center.y, radius);

        // Green channel outline (centered)
        graphics.lineStyle(2, 0x00FF00, 0.3);
        graphics.strokeCircle(center.x, center.y - offset, radius);

        // Blue channel outline (offset right)
        graphics.lineStyle(2, 0x0000FF, 0.3);
        graphics.strokeCircle(center.x + offset, center.y, radius);

        // Add rainbow shimmer dots around perimeter
        if (colorGenome.hasRainbowShimmer) {
            const rainbowColors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
            for (let i = 0; i < 14; i++) {
                const angle = (i / 14) * Math.PI * 2;
                const x = center.x + Math.cos(angle) * (radius + 8);
                const y = center.y + Math.sin(angle) * (radius + 8);
                const color = rainbowColors[i % rainbowColors.length];
                graphics.fillStyle(color, 0.6);
                graphics.fillCircle(x, y, 2);
            }
        }
    }

    /**
     * Inverted shiny: Subtle inversion indicator with contrast rings
     */
    renderInvertedShiny(graphics, center, size, colorGenome) {
        const radius = Math.max(size.width, size.height) * 0.5;

        // Add dark/light contrast rings to indicate inversion
        graphics.lineStyle(2, 0x000000, 0.4);
        graphics.strokeCircle(center.x, center.y, radius + 2);

        graphics.lineStyle(2, 0xFFFFFF, 0.4);
        graphics.strokeCircle(center.x, center.y, radius + 5);

        // Add inverted corner markers
        const corners = [
            { x: center.x - radius * 0.7, y: center.y - radius * 0.7 },
            { x: center.x + radius * 0.7, y: center.y - radius * 0.7 },
            { x: center.x - radius * 0.7, y: center.y + radius * 0.7 },
            { x: center.x + radius * 0.7, y: center.y + radius * 0.7 }
        ];

        corners.forEach(corner => {
            // Yin-yang style small circles
            graphics.fillStyle(0x000000, 0.5);
            graphics.fillCircle(corner.x - 1, corner.y, 3);
            graphics.fillStyle(0xFFFFFF, 0.5);
            graphics.fillCircle(corner.x + 1, corner.y, 3);
        });
    }

    /**
     * Golden shiny: Gold-tinted glow circle
     */
    renderGoldenShiny(graphics, center, size, colorGenome) {
        const goldColor = colorGenome.overlay?.color || 0xFFD700;
        const radius = Math.max(size.width, size.height) * 0.6;

        // Outer golden glow (largest, most transparent)
        graphics.fillStyle(goldColor, 0.15);
        graphics.fillCircle(center.x, center.y, radius + 15);

        // Middle golden glow
        graphics.fillStyle(goldColor, 0.2);
        graphics.fillCircle(center.x, center.y, radius + 8);

        // Inner golden ring
        graphics.lineStyle(3, goldColor, 0.5);
        graphics.strokeCircle(center.x, center.y, radius);

        // Add golden sparkle points
        const sparklePositions = [
            { angle: 0, dist: radius + 12 },
            { angle: Math.PI / 2, dist: radius + 10 },
            { angle: Math.PI, dist: radius + 12 },
            { angle: Math.PI * 1.5, dist: radius + 10 }
        ];

        sparklePositions.forEach(pos => {
            const x = center.x + Math.cos(pos.angle) * pos.dist;
            const y = center.y + Math.sin(pos.angle) * pos.dist;
            this.drawSparkle(graphics, x, y, 4, goldColor, 0.8);
        });

        // Golden crown indicator at top
        graphics.fillStyle(goldColor, 0.7);
        const crownY = center.y - radius - 5;
        graphics.fillTriangle(
            center.x - 6, crownY + 4,
            center.x, crownY - 4,
            center.x + 6, crownY + 4
        );
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

    // ============================================================
    // DNA-BASED CREATURE RENDERING SYSTEM
    // Extends GraphicsEngine to support CreatureDNA traits
    // ============================================================

    /**
     * Create a creature from CreatureDNA
     * Main entry point for DNA-based creature rendering
     * @param {Object} dna - CreatureDNA object with discrete traits
     * @param {number} frame - Animation frame (0-based)
     * @returns {Object} Creature render result with texture name
     */
    createCreatureFromDNA(dna, frame = 0, stage = 'adult') {
        if (!dna) {
            console.warn('graphics:warn [GraphicsEngine] No DNA provided, using default creature');
            return this.createSpaceMythicCreature({ frame });
        }

        try {
            const startTime = Date.now();

            // Get DNA-based color scheme
            const colors = this.getDNAColorScheme(dna);

            // Calculate canvas size based on body archetype
            const metrics = this.getDNACanvasMetrics(dna.bodyArchetype);

            // Get lifecycle stage visual config
            const stageConfig = window.CreatureLifecycle?.getStageVisualConfig(stage) || { scale: 1.0, colorSaturation: 1.0 };

            // Create graphics context
            const graphics = this.createScratchGraphics();
            const translation = this.safeGraphicsTranslate(graphics, metrics.padding);

            const center = {
                x: metrics.baseCenter.x + translation.centerShift.x,
                y: metrics.baseCenter.y + translation.centerShift.y
            };

            // Apply stage-based size scaling
            // metrics.size is an object {width, height}, so scale each dimension
            const baseWidth = metrics.size.width || 50;
            const baseHeight = metrics.size.height || 65;
            const stageScale = stageConfig.scale || 1.0;

            // Create properly scaled size object for rendering
            const sizeObj = {
                width: baseWidth * stageScale,
                height: baseHeight * stageScale
            };
            console.log('graphics:debug [GraphicsEngine] Size object for stage:', stage, sizeObj);

            // Apply stage-based color saturation to colors (preserve color structure)
            const stageColors = {
                body: this.adjustColorSaturation(colors.body, stageConfig.colorSaturation),
                head: this.adjustColorSaturation(colors.head, stageConfig.colorSaturation),
                accent: this.adjustColorSaturation(colors.accent, stageConfig.colorSaturation),
                eyes: colors.eyes // Eyes stay the same brightness
            };
            console.log('graphics:debug [GraphicsEngine] Stage colors applied:', stageColors);

            // Get full stage config for baby enhancements BEFORE rendering
            const fullStageConfig = this.getStageVisualConfig(stage);

            // Render body based on DNA bodyArchetype with stage scaling
            this.renderBodyArchetype(graphics, center, sizeObj, dna.bodyArchetype, stageColors);

            // Render head based on DNA headArchetype (with hybrid support) with stage scaling
            // Pass fullStageConfig for proper eye/head scaling at different lifecycle stages
            this.renderHeadArchetype(graphics, center, sizeObj, dna.headArchetype, stageColors, dna.hybridTag, fullStageConfig);

            // Add elemental aura effects (drawn on graphics for texture)
            // Use average of width/height for aura radius
            const auraSize = (sizeObj.width + sizeObj.height) / 2;
            this.addElementalAuraToGraphics(graphics, center, auraSize, dna.elementalAura);

            // Add rarity enhancements for epic+
            if (this.isEpicOrHigher(dna.raritySignature)) {
                this.addRarityEnhancements(graphics, center, auraSize, dna.raritySignature);
            }

            // Add stage-specific effects (baby cute features, etc.)
            // Use the same sizeObj for consistent positioning
            const minimalGenetics = {
                cosmicAffinity: { color: colors.accent }
            };
            this.addStageEffects(graphics, stage, fullStageConfig, center, sizeObj, minimalGenetics);

            translation.restore();

            // Generate texture
            const textureName = `creature_dna_${dna.id}_${frame}_${stage}`;
            this.finalizeTexture(graphics, textureName, metrics.width, metrics.height);

            const generationTime = Date.now() - startTime;
            console.log(`graphics:info [GraphicsEngine] DNA creature created in ${generationTime}ms`, {
                id: dna.id,
                body: dna.bodyArchetype,
                head: dna.headArchetype,
                rarity: dna.raritySignature
            });

            return {
                textureName,
                dna,
                colors,
                metadata: {
                    generationTime,
                    frame,
                    createdAt: Date.now()
                }
            };
        } catch (error) {
            console.error('graphics:error [GraphicsEngine] Failed to create DNA creature:', error);
            if (typeof window !== 'undefined' && window.ErrorHandler && typeof window.ErrorHandler.handleError === 'function') {
                window.ErrorHandler.handleError({
                    message: error.message || 'Failed to create DNA creature',
                    type: 'GraphicsEngine.createCreatureFromDNA',
                    severity: 'warning',
                    stack: error.stack
                });
            }
            return this.createSpaceMythicCreature({ frame });
        }
    }

    /**
     * Get color scheme based on DNA traits
     * @param {Object} dna - CreatureDNA object
     * @returns {Object} Color configuration
     */
    getDNAColorScheme(dna) {
        // Map elemental aura to color themes
        const auraColors = {
            cosmic: { primary: 0x9370DB, secondary: 0xDDA0DD, accent: 0x8A2BE2 },
            forest: { primary: 0x228B22, secondary: 0x90EE90, accent: 0x32CD32 },
            ember: { primary: 0xFF4500, secondary: 0xFF6347, accent: 0xFF8C00 },
            tidal: { primary: 0x4682B4, secondary: 0x87CEEB, accent: 0x00CED1 },
            storm: { primary: 0x4B0082, secondary: 0x9370DB, accent: 0xFFD700 },
            'shadow-soft': { primary: 0x2F4F4F, secondary: 0x696969, accent: 0x9370DB }
        };

        const colorScheme = auraColors[dna.elementalAura] || auraColors.cosmic;

        return {
            body: colorScheme.primary,
            head: colorScheme.secondary,
            accent: colorScheme.accent,
            eyes: 0x4169E1
        };
    }

    /**
     * Calculate canvas metrics based on body archetype
     * @param {string} bodyArchetype - DNA body archetype
     * @returns {Object} Canvas metrics
     */
    getDNACanvasMetrics(bodyArchetype) {
        const baseSizes = {
            blob: { width: 60, height: 60 },
            quadruped: { width: 70, height: 55 },
            biped: { width: 50, height: 80 },
            serpentine: { width: 45, height: 90 },
            winged: { width: 75, height: 70 }
        };

        const size = baseSizes[bodyArchetype] || baseSizes.blob;
        const padding = { x: 15, y: 15 };

        return {
            size,
            width: size.width + padding.x * 2,
            height: size.height + padding.y * 2,
            padding,
            baseCenter: {
                x: size.width / 2 + padding.x,
                y: size.height / 2 + padding.y
            }
        };
    }

    /**
     * Render body based on DNA bodyArchetype
     * Maps DNA archetypes to existing body renderers
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point {x, y}
     * @param {Object} size - Body size {width, height}
     * @param {string} bodyArchetype - DNA body archetype
     * @param {Object} colors - Color scheme
     */
    renderBodyArchetype(graphics, center, size, bodyArchetype, colors) {
        const bodyScale = { width: size.width, height: size.height };
        const bodyOffset = { x: 0, y: 0 };

        switch (bodyArchetype) {
            case 'blob':
                this.renderBlobBody(graphics, center, bodyOffset, bodyScale, colors.body);
                break;

            case 'quadruped':
                this.renderQuadrupedBody(graphics, center, bodyOffset, bodyScale, colors.body);
                break;

            case 'biped':
                // Biped uses standard body with upright stance
                this.renderStandardBody(graphics, center, bodyOffset, bodyScale, colors.body);
                break;

            case 'serpentine':
                this.renderSerpentineBody(graphics, center, bodyOffset, bodyScale, colors.body);
                break;

            case 'winged':
                // Winged uses avian body
                this.renderAvianBody(graphics, center, bodyOffset, bodyScale, colors.body);
                break;

            default:
                this.renderStandardBody(graphics, center, bodyOffset, bodyScale, colors.body);
        }
    }

    /**
     * Render head based on DNA headArchetype with hybrid support
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point {x, y}
     * @param {Object} size - Body size {width, height}
     * @param {string} headArchetype - DNA head archetype
     * @param {Object} colors - Color scheme
     * @param {string} hybridTag - Hybrid type (single-species, dual-hybrid, triple-hybrid, glitchy)
     */
    renderHeadArchetype(graphics, center, size, headArchetype, colors, hybridTag, stageConfig = null) {
        // Head position (top of body)
        const headY = center.y - size.height * 0.35;

        // Stage-based head size multiplier (babies have proportionally larger heads)
        const headMultiplier = stageConfig?.headSizeMultiplier || 1.0;
        const eyeMultiplier = stageConfig?.eyeSizeMultiplier || 1.0;
        const headSize = size.width * 0.4 * headMultiplier;

        console.log(`graphics:debug [GraphicsEngine] DNA Head rendering - headMultiplier: ${headMultiplier}, eyeMultiplier: ${eyeMultiplier}`);

        // For hybrids, blend features
        const isDualHybrid = hybridTag === 'dual-hybrid';
        const isTripleHybrid = hybridTag === 'triple-hybrid';
        const isGlitchy = hybridTag === 'glitchy';

        // Main head features - pass eye multiplier for proper scaling
        this.drawHeadFeatures(graphics, center.x, headY, headSize, headArchetype, colors, eyeMultiplier);

        // Add hybrid features
        if (isDualHybrid || isTripleHybrid) {
            // Draw subtle second head features (smaller, offset)
            const secondHeadArchetype = this.getComplementaryHeadType(headArchetype);
            graphics.setAlpha(0.4);
            this.drawHeadFeatures(graphics, center.x + headSize * 0.3, headY - 2, headSize * 0.7, secondHeadArchetype, colors, eyeMultiplier);
            graphics.setAlpha(1.0);
        }

        if (isGlitchy) {
            // Add glitch effect - offset RGB channels
            graphics.setAlpha(0.3);
            this.drawHeadFeatures(graphics, center.x - 2, headY, headSize, headArchetype, { ...colors, head: 0x00FFFF }, eyeMultiplier);
            this.drawHeadFeatures(graphics, center.x + 2, headY, headSize, headArchetype, { ...colors, head: 0xFF00FF }, eyeMultiplier);
            graphics.setAlpha(1.0);
        }
    }

    /**
     * Draw head features based on head archetype
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Head size
     * @param {string} headArchetype - Head type
     * @param {Object} colors - Color scheme
     * @param {number} eyeMultiplier - Eye size multiplier for stage scaling (babies get bigger eyes)
     */
    drawHeadFeatures(graphics, x, y, size, headArchetype, colors, eyeMultiplier = 1.0) {
        switch (headArchetype) {
            case 'feline':
                this.drawFelineHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'canine':
                this.drawCanineHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'avian':
                this.drawAvianHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'reptile':
                this.drawReptileHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'aquatic':
                this.drawAquaticHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'simian':
                this.drawSimianHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'insectoid':
                this.drawInsectoidHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'rodent':
                this.drawRodentHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            case 'cervine':
                this.drawCervineHead(graphics, x, y, size, colors, eyeMultiplier);
                break;
            default:
                this.drawFelineHead(graphics, x, y, size, colors, eyeMultiplier);
        }
    }

    /**
     * Get complementary head type for hybrids
     * @param {string} primaryHead - Primary head archetype
     * @returns {string} Complementary head type
     */
    getComplementaryHeadType(primaryHead) {
        const complements = {
            feline: 'avian',
            canine: 'reptile',
            avian: 'feline',
            reptile: 'canine',
            aquatic: 'insectoid',
            simian: 'rodent',
            insectoid: 'aquatic',
            rodent: 'cervine',
            cervine: 'simian'
        };
        return complements[primaryHead] || 'feline';
    }

    // ============================================================
    // HEAD ARCHETYPE RENDERERS
    // Individual head rendering methods for each archetype
    // ============================================================

    drawFelineHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Cat-like head - round with pointed ears
        graphics.fillStyle(colors.head);
        graphics.fillCircle(x, y, size);

        // Pointed ears
        graphics.beginPath();
        graphics.moveTo(x - size * 0.6, y - size * 0.5);
        graphics.lineTo(x - size * 0.3, y - size);
        graphics.lineTo(x - size * 0.4, y - size * 0.3);
        graphics.closePath();
        graphics.fillPath();

        graphics.beginPath();
        graphics.moveTo(x + size * 0.6, y - size * 0.5);
        graphics.lineTo(x + size * 0.3, y - size);
        graphics.lineTo(x + size * 0.4, y - size * 0.3);
        graphics.closePath();
        graphics.fillPath();

        // Eyes - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.35 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.3, y, x + size * 0.3, y, colors.eyes, baseEyeSize);

        // Whiskers
        graphics.lineStyle(1, colors.accent, 0.8);
        graphics.lineBetween(x + size * 0.5, y, x + size * 1.2, y - 2);
        graphics.lineBetween(x + size * 0.5, y + 3, x + size * 1.2, y + 3);
        graphics.lineBetween(x - size * 0.5, y, x - size * 1.2, y - 2);
        graphics.lineBetween(x - size * 0.5, y + 3, x - size * 1.2, y + 3);
    }

    drawCanineHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Dog-like head - elongated snout
        graphics.fillStyle(colors.head);
        graphics.fillCircle(x, y, size);

        // Floppy ears
        graphics.fillEllipse(x - size * 0.8, y + size * 0.2, size * 0.4, size * 0.8);
        graphics.fillEllipse(x + size * 0.8, y + size * 0.2, size * 0.4, size * 0.8);

        // Snout - use safe darkenColor instead of Phaser.Display.Color.ValueToColor
        const headColor = this.extractHexColor(colors.head, 0x808080);
        graphics.fillStyle(this.darkenColor(headColor, 0.1));
        graphics.fillEllipse(x, y + size * 0.4, size * 0.6, size * 0.4);

        // Nose
        graphics.fillStyle(0x000000);
        graphics.fillCircle(x, y + size * 0.5, size * 0.15);

        // Eyes - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.35 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.3, y - size * 0.2, x + size * 0.3, y - size * 0.2, colors.eyes, baseEyeSize);
    }

    drawAvianHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Bird-like head - small with beak
        const safeHeadColor = this.extractHexColor(colors.head, 0x808080);
        graphics.fillStyle(safeHeadColor);
        graphics.fillCircle(x, y, size * 0.8);

        // Beak
        graphics.fillStyle(0xFFA500);
        graphics.beginPath();
        graphics.moveTo(x, y + size * 0.2);
        graphics.lineTo(x + size * 0.6, y + size * 0.4);
        graphics.lineTo(x, y + size * 0.6);
        graphics.closePath();
        graphics.fillPath();

        // Eyes (larger for birds) - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.4 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.4, y - size * 0.1, x + size * 0.2, y - size * 0.1, colors.eyes, baseEyeSize);

        // Crest feathers
        graphics.fillStyle(colors.accent);
        for (let i = 0; i < 3; i++) {
            const featherX = x - size * 0.3 + i * size * 0.3;
            graphics.fillTriangle(
                featherX, y - size * 0.8,
                featherX - size * 0.15, y - size * 1.2,
                featherX + size * 0.15, y - size * 1.2
            );
        }
    }

    drawReptileHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Reptile/dragon-like head - angular with scales
        graphics.fillStyle(colors.head);

        // Main head (angular)
        graphics.beginPath();
        graphics.moveTo(x, y - size);
        graphics.lineTo(x + size * 0.8, y);
        graphics.lineTo(x + size * 0.5, y + size * 0.5);
        graphics.lineTo(x - size * 0.5, y + size * 0.5);
        graphics.lineTo(x - size * 0.8, y);
        graphics.closePath();
        graphics.fillPath();

        // Horns/spikes
        graphics.fillStyle(colors.accent);
        graphics.fillTriangle(x - size * 0.4, y - size * 0.5, x - size * 0.6, y - size * 1.2, x - size * 0.2, y - size * 0.7);
        graphics.fillTriangle(x + size * 0.4, y - size * 0.5, x + size * 0.6, y - size * 1.2, x + size * 0.2, y - size * 0.7);

        // Slit eyes (reptilian) - scaled by eyeMultiplier
        const eyeWidth = size * 0.15 * eyeMultiplier;
        const eyeHeight = size * 0.25 * eyeMultiplier;
        graphics.fillStyle(colors.eyes);
        graphics.fillEllipse(x - size * 0.3, y - size * 0.2, eyeWidth, eyeHeight);
        graphics.fillEllipse(x + size * 0.3, y - size * 0.2, eyeWidth, eyeHeight);
        // Slit pupils
        const pupilWidth = Math.max(2, 2 * eyeMultiplier);
        const pupilHeight = size * 0.2 * eyeMultiplier;
        graphics.fillStyle(0x000000);
        graphics.fillRect(x - size * 0.3 - pupilWidth/2, y - size * 0.3, pupilWidth, pupilHeight);
        graphics.fillRect(x + size * 0.3 - pupilWidth/2, y - size * 0.3, pupilWidth, pupilHeight);
    }

    drawAquaticHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Fish/dolphin-like head - streamlined
        graphics.fillStyle(colors.head);
        graphics.fillEllipse(x, y, size * 1.2, size * 0.9);

        // Fins
        graphics.fillStyle(colors.accent);
        graphics.fillTriangle(x - size * 0.8, y - size * 0.3, x - size * 1.3, y - size * 0.6, x - size * 1.1, y);
        graphics.fillTriangle(x + size * 0.8, y - size * 0.3, x + size * 1.3, y - size * 0.6, x + size * 1.1, y);

        // Large eyes (fish-like) - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.4 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.4, y - size * 0.2, x + size * 0.4, y - size * 0.2, colors.eyes, baseEyeSize);

        // Bubbles
        graphics.fillStyle(0x87CEEB, 0.5);
        graphics.fillCircle(x + size * 0.7, y - size * 0.5, size * 0.1);
        graphics.fillCircle(x + size * 0.9, y - size * 0.7, size * 0.08);
    }

    drawSimianHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Monkey-like head - round with prominent features
        const headColor = this.extractHexColor(colors.head, 0x808080);
        graphics.fillStyle(headColor);
        graphics.fillCircle(x, y, size);

        // Large ears
        graphics.fillCircle(x - size * 0.9, y, size * 0.5);
        graphics.fillCircle(x + size * 0.9, y, size * 0.5);

        // Face (lighter) - use safe lightenColor instead of Phaser.Display.Color.ValueToColor
        graphics.fillStyle(this.lightenColor(headColor, 0.2));
        graphics.fillEllipse(x, y + size * 0.2, size * 0.7, size * 0.8);

        // Eyes - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.35 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.3, y, x + size * 0.3, y, colors.eyes, baseEyeSize);

        // Nose
        graphics.fillStyle(0x000000);
        graphics.fillTriangle(x, y + size * 0.3, x - size * 0.1, y + size * 0.5, x + size * 0.1, y + size * 0.5);
    }

    drawInsectoidHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Bug-like head - compact with antennae
        graphics.fillStyle(colors.head);
        graphics.fillEllipse(x, y, size * 0.9, size);

        // Compound eyes (large) - scaled by eyeMultiplier for baby cuteness
        const compoundEyeSize = size * 0.4 * eyeMultiplier;
        graphics.fillStyle(colors.eyes);
        graphics.fillCircle(x - size * 0.4, y - size * 0.2, compoundEyeSize);
        graphics.fillCircle(x + size * 0.4, y - size * 0.2, compoundEyeSize);

        // Eye facets - scale with eye size
        const facetRadius = compoundEyeSize * 0.375;
        const facetDotSize = compoundEyeSize * 0.2;
        graphics.fillStyle(0x000000, 0.3);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            graphics.fillCircle(
                x - size * 0.4 + Math.cos(angle) * facetRadius,
                y - size * 0.2 + Math.sin(angle) * facetRadius,
                facetDotSize
            );
            graphics.fillCircle(
                x + size * 0.4 + Math.cos(angle) * facetRadius,
                y - size * 0.2 + Math.sin(angle) * facetRadius,
                facetDotSize
            );
        }

        // Antennae
        graphics.lineStyle(2, colors.accent);
        graphics.lineBetween(x - size * 0.2, y - size * 0.8, x - size * 0.4, y - size * 1.5);
        graphics.lineBetween(x + size * 0.2, y - size * 0.8, x + size * 0.4, y - size * 1.5);
        graphics.fillStyle(colors.accent);
        graphics.fillCircle(x - size * 0.4, y - size * 1.5, size * 0.15);
        graphics.fillCircle(x + size * 0.4, y - size * 1.5, size * 0.15);
    }

    drawRodentHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Mouse/rabbit-like head - small with large ears
        graphics.fillStyle(colors.head);
        graphics.fillCircle(x, y, size);

        // Large ears (rabbit style)
        graphics.fillEllipse(x - size * 0.6, y - size * 0.8, size * 0.4, size * 1.2);
        graphics.fillEllipse(x + size * 0.6, y - size * 0.8, size * 0.4, size * 1.2);

        // Inner ear (pink)
        graphics.fillStyle(0xFFB6C1);
        graphics.fillEllipse(x - size * 0.6, y - size * 0.7, size * 0.2, size * 0.8);
        graphics.fillEllipse(x + size * 0.6, y - size * 0.7, size * 0.2, size * 0.8);

        // Large eyes - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.35 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.3, y - size * 0.1, x + size * 0.3, y - size * 0.1, colors.eyes, baseEyeSize);

        // Nose
        graphics.fillStyle(0xFF69B4);
        graphics.fillCircle(x, y + size * 0.3, size * 0.15);

        // Whiskers
        graphics.lineStyle(1, colors.accent, 0.8);
        for (let i = -1; i <= 1; i++) {
            graphics.lineBetween(x + size * 0.4, y + size * 0.2 + i * 3, x + size * 1.0, y + i * 3);
            graphics.lineBetween(x - size * 0.4, y + size * 0.2 + i * 3, x - size * 1.0, y + i * 3);
        }
    }

    drawCervineHead(graphics, x, y, size, colors, eyeMultiplier = 1.0) {
        // Deer-like head - elegant with antlers
        const headColor = this.extractHexColor(colors.head, 0x808080);
        graphics.fillStyle(headColor);
        graphics.fillEllipse(x, y, size * 0.7, size * 1.1);

        // Snout - use safe darkenColor instead of Phaser.Display.Color.ValueToColor
        graphics.fillStyle(this.darkenColor(headColor, 0.1));
        graphics.fillEllipse(x, y + size * 0.5, size * 0.5, size * 0.4);

        // Nose
        graphics.fillStyle(0x000000);
        graphics.fillCircle(x, y + size * 0.7, size * 0.12);

        // Eyes (gentle, large) - scaled by eyeMultiplier for baby cuteness
        const baseEyeSize = size * 0.35 * eyeMultiplier;
        this.createRealisticEyes(graphics, x - size * 0.3, y - size * 0.2, x + size * 0.3, y - size * 0.2, colors.eyes, baseEyeSize);

        // Antlers
        graphics.lineStyle(3, colors.accent);
        // Left antler
        graphics.lineBetween(x - size * 0.3, y - size * 0.8, x - size * 0.5, y - size * 1.5);
        graphics.lineBetween(x - size * 0.5, y - size * 1.5, x - size * 0.7, y - size * 1.3);
        graphics.lineBetween(x - size * 0.5, y - size * 1.5, x - size * 0.4, y - size * 1.8);
        // Right antler
        graphics.lineBetween(x + size * 0.3, y - size * 0.8, x + size * 0.5, y - size * 1.5);
        graphics.lineBetween(x + size * 0.5, y - size * 1.5, x + size * 0.7, y - size * 1.3);
        graphics.lineBetween(x + size * 0.5, y - size * 1.5, x + size * 0.4, y - size * 1.8);

        // Ears (pointed)
        graphics.fillStyle(colors.head);
        graphics.fillTriangle(x - size * 0.5, y - size * 0.5, x - size * 0.7, y - size * 0.9, x - size * 0.3, y - size * 0.7);
        graphics.fillTriangle(x + size * 0.5, y - size * 0.5, x + size * 0.7, y - size * 0.9, x + size * 0.3, y - size * 0.7);
    }

    // ============================================================
    // ELEMENTAL AURA & RARITY ENHANCEMENTS
    // ============================================================

    /**
     * Add elemental aura visual effects to graphics
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point {x, y}
     * @param {Object} size - Body size {width, height}
     * @param {string} elementalAura - Elemental aura type
     */
    addElementalAuraToGraphics(graphics, center, size, elementalAura) {
        const auraRadius = Math.max(size.width, size.height) * 0.7;

        switch (elementalAura) {
            case 'cosmic':
                // Purple/blue sparkles
                graphics.fillStyle(0x9370DB, 0.3);
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = center.x + Math.cos(angle) * auraRadius;
                    const y = center.y + Math.sin(angle) * auraRadius;
                    this.drawStar(graphics, x, y, 4, 2, 4);
                }
                break;

            case 'forest':
                // Green leaves
                graphics.fillStyle(0x32CD32, 0.4);
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const x = center.x + Math.cos(angle) * auraRadius;
                    const y = center.y + Math.sin(angle) * auraRadius;
                    graphics.fillEllipse(x, y, 3, 5);
                }
                break;

            case 'ember':
                // Orange/red flames
                graphics.fillStyle(0xFF4500, 0.4);
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = center.x + Math.cos(angle) * auraRadius;
                    const y = center.y + Math.sin(angle) * auraRadius - 5;
                    graphics.fillTriangle(x, y, x - 2, y + 6, x + 2, y + 6);
                }
                break;

            case 'tidal':
                // Blue water droplets
                graphics.fillStyle(0x00CED1, 0.4);
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = center.x + Math.cos(angle) * auraRadius;
                    const y = center.y + Math.sin(angle) * auraRadius;
                    graphics.fillCircle(x, y, 2);
                    graphics.fillCircle(x, y - 4, 1.5);
                }
                break;

            case 'storm':
                // Yellow/white lightning bolts
                graphics.lineStyle(2, 0xFFD700, 0.5);
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const startX = center.x + Math.cos(angle) * auraRadius * 0.5;
                    const startY = center.y + Math.sin(angle) * auraRadius * 0.5;
                    const endX = center.x + Math.cos(angle) * auraRadius;
                    const endY = center.y + Math.sin(angle) * auraRadius;
                    graphics.lineBetween(startX, startY, endX, endY);
                }
                break;

            case 'shadow-soft':
                // Dark purple wisps
                graphics.fillStyle(0x9370DB, 0.2);
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const x = center.x + Math.cos(angle) * auraRadius;
                    const y = center.y + Math.sin(angle) * auraRadius;
                    graphics.fillCircle(x, y, 4);
                }
                break;
        }
    }

    /**
     * Add rarity enhancements for epic+ creatures
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics context
     * @param {Object} center - Center point {x, y}
     * @param {Object} size - Body size {width, height}
     * @param {string} raritySignature - Rarity tier
     */
    addRarityEnhancements(graphics, center, size, raritySignature) {
        const radius = Math.max(size.width, size.height) * 0.8;

        switch (raritySignature) {
            case 'epic':
                // Gentle purple glow
                graphics.lineStyle(2, 0x9B59B6, 0.3);
                graphics.strokeCircle(center.x, center.y, radius);
                break;

            case 'legendary':
                // Golden rays
                graphics.lineStyle(2, 0xFFD700, 0.4);
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    graphics.lineBetween(
                        center.x,
                        center.y,
                        center.x + Math.cos(angle) * radius,
                        center.y + Math.sin(angle) * radius
                    );
                }
                break;

            case 'mythic':
                // Prismatic outline
                const mythicColors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x8B00FF];
                mythicColors.forEach((color, i) => {
                    graphics.lineStyle(1, color, 0.3);
                    graphics.strokeCircle(center.x, center.y, radius - i * 2);
                });
                break;

            case 'secret':
                // Glitch effect
                graphics.lineStyle(2, 0x00FFFF, 0.4);
                graphics.strokeRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
                graphics.lineStyle(2, 0xFF00FF, 0.4);
                graphics.strokeRect(center.x - radius + 2, center.y - radius - 2, radius * 2, radius * 2);
                break;
        }
    }

    /**
     * Check if rarity is epic or higher
     * @param {string} raritySignature - Rarity tier
     * @returns {boolean} True if epic or higher
     */
    isEpicOrHigher(raritySignature) {
        const epicTiers = ['epic', 'legendary', 'mythic', 'secret'];
        return epicTiers.includes(raritySignature);
    }

    /**
     * Create particle emitter for elemental aura (for live sprites)
     * Call this after sprite is created to add particle effects
     * @param {Phaser.Scene} scene - Scene instance
     * @param {Phaser.GameObjects.Sprite} sprite - Target sprite
     * @param {string} elementalAura - Elemental aura type
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter|null} Particle emitter or null
     */
    createElementalAuraParticles(scene, sprite, elementalAura) {
        if (!scene || !sprite || !scene.add || !scene.add.particles) {
            return null;
        }

        const auraConfigs = {
            cosmic: {
                color: [0x9370DB, 0xDDA0DD, 0x8A2BE2],
                speed: 20,
                lifespan: 2000,
                scale: { start: 0.3, end: 0 }
            },
            forest: {
                color: [0x228B22, 0x90EE90, 0x32CD32],
                speed: 15,
                lifespan: 2500,
                scale: { start: 0.2, end: 0 }
            },
            ember: {
                color: [0xFF4500, 0xFF6347, 0xFF8C00],
                speed: 25,
                lifespan: 1500,
                scale: { start: 0.4, end: 0.1 },
                gravityY: -50
            },
            tidal: {
                color: [0x4682B4, 0x87CEEB, 0x00CED1],
                speed: 10,
                lifespan: 3000,
                scale: { start: 0.2, end: 0 },
                gravityY: 20
            },
            storm: {
                color: [0x4B0082, 0x9370DB, 0xFFD700],
                speed: 30,
                lifespan: 1000,
                scale: { start: 0.5, end: 0 }
            },
            'shadow-soft': {
                color: [0x2F4F4F, 0x696969, 0x9370DB],
                speed: 10,
                lifespan: 2500,
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.5, end: 0 }
            }
        };

        const config = auraConfigs[elementalAura] || auraConfigs.cosmic;

        try {
            // Create simple particle graphics texture if doesn't exist
            if (!scene.textures.exists('particle')) {
                const graphics = scene.add.graphics();
                graphics.fillStyle(0xFFFFFF);
                graphics.fillCircle(4, 4, 4);
                graphics.generateTexture('particle', 8, 8);
                graphics.destroy();
            }

            const emitter = scene.add.particles(sprite.x, sprite.y, 'particle', {
                speed: config.speed,
                lifespan: config.lifespan,
                scale: config.scale,
                alpha: config.alpha || { start: 0.6, end: 0 },
                blendMode: 'ADD',
                frequency: 200,
                tint: config.color,
                gravityY: config.gravityY || 0
            });

            // Follow sprite
            emitter.startFollow(sprite);

            return emitter;
        } catch (error) {
            console.warn('graphics:warn [GraphicsEngine] Failed to create particle emitter:', error);
            return null;
        }
    }

    /**
     * Load and render creature from GameState
     * This is the unified method for all scenes to render the player's creature
     * @param {number} frame - Animation frame (0-3 for walk cycle)
     * @returns {Object|null} Creature render result or null
     */
    loadCreatureFromGameState(frame = 0) {
        // Try to get GameState
        const gameState = typeof window !== 'undefined' && window.GameState
            ? window.GameState
            : (typeof getGameState === 'function' ? getGameState() : null);

        if (!gameState) {
            console.error('graphics:error [GraphicsEngine] GameState not available');
            return null;
        }

        // Get creature's current lifecycle stage
        const lifecycle = gameState.get('creature.lifecycle');
        const currentStage = lifecycle?.stage || 'baby';
        console.log('graphics:debug [GraphicsEngine] loadCreatureFromGameState - lifecycle:', lifecycle, 'stage:', currentStage);

        // CRITICAL: Check if texture already exists to preserve visual consistency
        // This prevents re-randomization of visual elements between scenes
        const genes = gameState.get('creature.genes') || gameState.getActiveCreature?.()?.genes;
        if (genes?.id) {
            const existingTextureName = `creature_${genes.id}_${currentStage}_${frame}`;
            if (this.scene?.textures?.exists(existingTextureName)) {
                console.log('graphics:info [GraphicsEngine] Using existing creature texture:', existingTextureName);
                return { textureName: existingTextureName, genetics: genes, stage: currentStage };
            }
        }

        // CRITICAL: Check if we're in a hatching flow (creature.hatched but not yet named/added to collection)
        // In this case, ALWAYS use creature.* slot instead of activeCreature from collection
        const isHatchingFlow = gameState.get('creature.hatched') && !gameState.get('creature.named');

        // Priority 0: Try active creature from collection (most reliable for roster sync)
        // BUT skip this if we're in a hatching flow
        const activeCreature = !isHatchingFlow ? gameState.getActiveCreature?.() : null;
        if (activeCreature) {
            // Try DNA first from active creature
            if (activeCreature.dna) {
                console.log('graphics:info [GraphicsEngine] Loading creature from active creature DNA:', activeCreature.dna.id);
                try {
                    const result = this.createCreatureFromDNA(activeCreature.dna, frame, currentStage);
                    if (result && result.textureName) {
                        console.log('graphics:info [GraphicsEngine] Successfully loaded creature from active creature DNA');
                        return result;
                    }
                } catch (error) {
                    console.warn('graphics:warn [GraphicsEngine] Active creature DNA rendering failed:', error);
                }
            }
            // Try genes from active creature (stored as 'genes' in collection)
            if (activeCreature.genes) {
                console.log('graphics:info [GraphicsEngine] Loading creature from active creature genes:', activeCreature.genes.id);
                try {
                    if (typeof this.createRandomizedSpaceMythicCreature === 'function') {
                        const result = this.createRandomizedSpaceMythicCreature(activeCreature.genes, frame, currentStage);
                        if (result && result.textureName) {
                            console.log('graphics:info [GraphicsEngine] Successfully loaded creature from active creature genes');
                            return result;
                        }
                    }
                } catch (error) {
                    console.warn('graphics:warn [GraphicsEngine] Active creature genes rendering failed:', error);
                }
            }
        }

        // Priority 1: Try DNA-based rendering from creature slot (backward compatibility + hatching flow)
        const dna = gameState.get('creature.dna');
        if (dna) {
            console.log('graphics:info [GraphicsEngine] Loading creature from DNA slot:', dna.id);
            try {
                const result = this.createCreatureFromDNA(dna, frame, currentStage);
                if (result && result.textureName) {
                    console.log('graphics:info [GraphicsEngine] Successfully loaded creature from DNA slot');
                    return result;
                }
            } catch (error) {
                console.warn('graphics:warn [GraphicsEngine] DNA rendering failed, trying genetics:', error);
            }
        }

        // Priority 2: Try genetics-based rendering from creature slot
        const genetics = gameState.get('creature.genetics') || gameState.get('creature.genes');
        if (genetics) {
            console.log('graphics:info [GraphicsEngine] Loading creature from genetics/genes slot:', genetics.id);
            try {
                if (typeof this.createRandomizedSpaceMythicCreature === 'function') {
                    const result = this.createRandomizedSpaceMythicCreature(genetics, frame, currentStage);
                    if (result && result.textureName) {
                        console.log('graphics:info [GraphicsEngine] Successfully loaded creature from genetics/genes slot');
                        return result;
                    }
                }
            } catch (error) {
                console.warn('graphics:warn [GraphicsEngine] Genetics rendering failed:', error);
            }
        }

        // Priority 3: Fallback to basic creature
        console.warn('graphics:warn [GraphicsEngine] No DNA or genetics found, using fallback creature');
        return this.createSpaceMythicCreature({ frame });
    }

    /**
     * Create creature animation frames for walking
     * Generates all 4 frames needed for walk cycle
     * @returns {Array<string>} Array of texture names [frame0, frame1, frame2, frame3]
     */
    createCreatureAnimationFrames() {
        const frameNames = [];

        for (let frame = 0; frame < 4; frame++) {
            const result = this.loadCreatureFromGameState(frame);
            if (result && result.textureName) {
                frameNames.push(result.textureName);
            } else {
                console.warn(`graphics:warn [GraphicsEngine] Failed to create frame ${frame}, using fallback`);
                frameNames.push(`enhancedCreature${frame}`);
            }
        }

        console.log('graphics:info [GraphicsEngine] Created animation frames:', frameNames);
        return frameNames;
    }

    /**
     * Adjust color saturation for lifecycle stage visualization
     * @param {number} colorValue - Hex color value
     * @param {number} saturation - Saturation multiplier (0.0 to 1.0+)
     * @returns {number} Adjusted hex color value
     */
    adjustColorSaturation(colorValue, saturation) {
        // Extract hex value if colorValue is an object
        const hexColor = this.extractHexColor(colorValue, 0x808080);
        if (!hexColor || saturation === 1.0) return hexColor;

        // Extract RGB using bit manipulation (safe - no Phaser Color class)
        const r = (hexColor >> 16) & 0xFF;
        const g = (hexColor >> 8) & 0xFF;
        const b = hexColor & 0xFF;

        // Get HSV values using static method (no Color object needed)
        const hsv = Phaser.Display.Color.RGBToHSV(r, g, b);

        // Adjust saturation
        hsv.s = Math.min(1.0, hsv.s * saturation);

        // Convert back to RGB
        const rgb = Phaser.Display.Color.HSVToRGB(hsv.h, hsv.s, hsv.v);

        // Return as hex color value
        return Phaser.Display.Color.GetColor(rgb.r, rgb.g, rgb.b);
    }
}

// Export for use in scenes
window.GraphicsEngine = GraphicsEngine;

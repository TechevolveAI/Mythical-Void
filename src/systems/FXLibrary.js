const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * FXLibrary - Reusable particle effects for Space-Mythic theme
 * Provides standardized visual effects for stardust, aurora, and bioluminescence
 */

class FXLibrary {
    constructor() {
        this.activeEffects = new Map();
        this.poolSize = 50;
        this.particlePool = [];
        this.initialized = false;
    }

    /**
     * Initialize the FX library with configuration
     */
    initialize(config = {}) {
        this.config = {
            defaultDuration: 2000,
            poolSize: 50,
            globalScale: 1.0,
            enablePhysics: true,
            colors: {
                stardust: [0xFFD700, 0xFFA500, 0xFFE4B5],
                aurora: [0x87CEEB, 0xB19CD9, 0xDDA0DD],
                biolume: [0x98FB98, 0x00FA9A, 0x7FFFD4]
            },
            ...config
        };

        this.initialized = true;
        console.log('fx:info [FXLibrary] Space-Mythic FX Library initialized', { config: this.config });
    }

    /**
     * Create stardust burst effect at specified coordinates
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Effect options
     */
    stardustBurst(scene, x, y, options = {}) {
        const opts = {
            count: 8,
            speed: { min: 50, max: 120 },
            scale: { start: 0.8, end: 0.1 },
            duration: 1200,
            color: this.config.colors.stardust,
            spread: 360,
            gravity: { x: 0, y: 20 },
            alpha: { start: 1.0, end: 0.0 },
            glow: true,
            ...options
        };

        const effectId = `stardust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const particles = [];

        for (let i = 0; i < opts.count; i++) {
            const angle = (opts.spread / opts.count) * i + (Math.random() * 30 - 15);
            const speed = Phaser.Math.Between(opts.speed.min, opts.speed.max);
            const color = Array.isArray(opts.color) ? 
                opts.color[Math.floor(Math.random() * opts.color.length)] : opts.color;

            const particle = this.createStarParticle(scene, x, y, {
                angle,
                speed,
                color,
                scale: opts.scale,
                alpha: opts.alpha,
                glow: opts.glow,
                gravity: opts.gravity
            });

            particles.push(particle);

            // Animate particle
            scene.tweens.add({
                targets: particle,
                scale: opts.scale.end,
                alpha: opts.alpha.end,
                duration: opts.duration,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.destroyParticle(particle);
                }
            });

            // Physics movement
            const velocityX = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
            const velocityY = Math.sin(Phaser.Math.DegToRad(angle)) * speed;

            scene.tweens.add({
                targets: particle,
                x: particle.x + velocityX * (opts.duration / 1000),
                y: particle.y + velocityY * (opts.duration / 1000) + opts.gravity.y * (opts.duration / 1000),
                duration: opts.duration,
                ease: 'Quad.easeOut'
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        this.logEffect('stardust_burst', { x, y, count: opts.count });

        return effectId;
    }

    /**
     * Create aurora pass effect across the scene
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {Object} options - Effect options
     */
    auroraPass(scene, options = {}) {
        const opts = {
            width: scene.cameras.main.width,
            height: scene.cameras.main.height,
            strips: 3,
            duration: 4000,
            colors: this.config.colors.aurora,
            opacity: { start: 0.0, peak: 0.4, end: 0.0 },
            waveAmplitude: 30,
            waveFrequency: 2,
            direction: 'horizontal',
            ...options
        };

        const effectId = `aurora_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const strips = [];

        for (let i = 0; i < opts.strips; i++) {
            const stripHeight = opts.height / opts.strips;
            const y = (stripHeight * i) + (stripHeight * 0.5);
            const color = opts.colors[i % opts.colors.length];

            const strip = this.createAuroraStrip(scene, {
                x: -opts.width * 0.2,
                y: y + (Math.random() * 60 - 30),
                width: opts.width * 1.4,
                height: stripHeight * 0.6,
                color: color,
                waveAmplitude: opts.waveAmplitude,
                waveFrequency: opts.waveFrequency
            });

            strips.push(strip);

            // Animate opacity
            scene.tweens.add({
                targets: strip,
                alpha: opts.opacity.peak,
                duration: opts.duration * 0.3,
                ease: 'Sine.easeIn',
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    this.destroyParticle(strip);
                }
            });

            // Gentle movement animation
            scene.tweens.add({
                targets: strip,
                x: strip.x + 100,
                duration: opts.duration,
                ease: 'Linear'
            });
        }

        this.activeEffects.set(effectId, { strips, startTime: Date.now() });
        this.logEffect('aurora_pass', { strips: opts.strips, duration: opts.duration });

        return effectId;
    }

    /**
     * Create bioluminescent pulse effect on a sprite
     * @param {Phaser.GameObjects.Sprite} sprite - Target sprite
     * @param {Object} options - Effect options
     */
    biolumePulse(sprite, options = {}) {
        const opts = {
            color: this.config.colors.biolume[0],
            intensity: { min: 0.2, max: 0.8 },
            duration: 2000,
            pulseCount: 3,
            glowRadius: 40,
            rippleEffect: true,
            ...options
        };

        const effectId = `biolume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create glow effect around sprite
        const glow = sprite.scene.add.graphics();
        glow.setPosition(sprite.x, sprite.y);
        
        // Create glowing circle
        const glowColor = Phaser.Display.Color.ValueToColor(opts.color);
        glow.fillGradientStyle(opts.color, opts.color, opts.color, opts.color, 1, 1, 0, 0);
        glow.fillCircle(0, 0, opts.glowRadius);
        glow.setAlpha(opts.intensity.min);
        glow.setBlendMode(Phaser.BlendModes.ADD);

        // Pulse animation
        sprite.scene.tweens.add({
            targets: glow,
            alpha: opts.intensity.max,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: opts.duration / (opts.pulseCount * 2),
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: (opts.pulseCount * 2) - 1,
            onComplete: () => {
                glow.destroy();
            }
        });

        // Optional ripple effect
        if (opts.rippleEffect) {
            const ripple = sprite.scene.add.graphics();
            ripple.setPosition(sprite.x, sprite.y);
            ripple.lineStyle(3, opts.color, 0.6);
            ripple.strokeCircle(0, 0, 10);
            ripple.setAlpha(0.8);

            sprite.scene.tweens.add({
                targets: ripple,
                scaleX: 3.0,
                scaleY: 3.0,
                alpha: 0,
                duration: opts.duration * 0.7,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    ripple.destroy();
                }
            });
        }

        // Subtle sprite tint pulse
        const originalTint = sprite.tint;
        sprite.scene.tweens.add({
            targets: sprite,
            tint: opts.color,
            duration: opts.duration / opts.pulseCount,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: opts.pulseCount - 1,
            onComplete: () => {
                sprite.setTint(originalTint);
            }
        });

        this.activeEffects.set(effectId, { 
            elements: [glow, sprite], 
            startTime: Date.now() 
        });

        this.logEffect('biolume_pulse', { 
            sprite: sprite.texture.key, 
            x: sprite.x, 
            y: sprite.y, 
            pulses: opts.pulseCount 
        });

        return effectId;
    }

    /**
     * Create individual star particle
     */
    createStarParticle(scene, x, y, options) {
        const particle = scene.add.graphics();
        particle.setPosition(x, y);
        particle.setScale(options.scale.start);
        particle.setAlpha(options.alpha.start);

        // Create star shape
        particle.fillStyle(options.color, 1.0);
        this.drawStar(particle, 0, 0, 4, 3, 6);

        // Optional glow effect
        if (options.glow) {
            particle.setBlendMode(Phaser.BlendModes.ADD);
        }

        return particle;
    }

    /**
     * Create aurora strip graphics
     */
    createAuroraStrip(scene, options) {
        const strip = scene.add.graphics();
        strip.setPosition(options.x, options.y);
        strip.setAlpha(0);

        // Create wavy aurora effect
        const points = [];
        const segments = 20;
        
        for (let i = 0; i <= segments; i++) {
            const progress = i / segments;
            const x = progress * options.width;
            const waveOffset = Math.sin(progress * Math.PI * options.waveFrequency) * options.waveAmplitude;
            points.push({ x, y: waveOffset });
        }

        // Create gradient-like effect with multiple strips
        const stripHeight = options.height / 3;
        for (let layer = 0; layer < 3; layer++) {
            const alpha = 1.0 - (layer * 0.3);
            const baseColor = Phaser.Display.Color.ValueToColor(options.color);
            const lightenAmount = layer * 20;
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                baseColor,
                Phaser.Display.Color.ValueToColor(0xFFFFFF),
                100,
                lightenAmount
            );

            strip.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), alpha);
            strip.beginPath();
            strip.moveTo(points[0].x, points[0].y - stripHeight * layer);
            
            for (let i = 1; i < points.length; i++) {
                strip.lineTo(points[i].x, points[i].y - stripHeight * layer);
            }
            
            strip.lineTo(options.width, options.height);
            strip.lineTo(0, options.height);
            strip.closePath();
            strip.fillPath();
        }

        strip.setBlendMode(Phaser.BlendModes.ADD);
        return strip;
    }

    /**
     * Draw a star shape on graphics object
     */
    drawStar(graphics, x, y, points, innerRadius, outerRadius) {
        const angle = Math.PI / points;
        
        graphics.beginPath();
        graphics.moveTo(x + Math.cos(-Math.PI / 2) * outerRadius, 
                       y + Math.sin(-Math.PI / 2) * outerRadius);
        
        for (let i = 0; i < points; i++) {
            const outerAngle = (i * 2 * angle) - Math.PI / 2;
            const innerAngle = ((i + 0.5) * 2 * angle) - Math.PI / 2;
            
            graphics.lineTo(x + Math.cos(innerAngle) * innerRadius, 
                           y + Math.sin(innerAngle) * innerRadius);
            graphics.lineTo(x + Math.cos(outerAngle + 2 * angle) * outerRadius, 
                           y + Math.sin(outerAngle + 2 * angle) * outerRadius);
        }
        
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Stop an active effect
     */
    stopEffect(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (!effect) return false;

        if (effect.particles) {
            effect.particles.forEach(particle => this.destroyParticle(particle));
        }
        if (effect.strips) {
            effect.strips.forEach(strip => this.destroyParticle(strip));
        }
        if (effect.elements) {
            effect.elements.forEach(element => {
                if (element && element.destroy) {
                    element.destroy();
                }
            });
        }

        this.activeEffects.delete(effectId);
        return true;
    }

    /**
     * Clean up all active effects
     */
    cleanup() {
        for (const [effectId, effect] of this.activeEffects.entries()) {
            this.stopEffect(effectId);
        }
        this.activeEffects.clear();
        console.log('fx:info [FXLibrary] All effects cleaned up');
    }

    /**
     * Destroy a particle and return it to pool
     */
    destroyParticle(particle) {
        if (particle && particle.destroy) {
            particle.destroy();
        }
    }

    /**
     * Get statistics about active effects
     */
    getStats() {
        return {
            activeEffects: this.activeEffects.size,
            effectTypes: Array.from(this.activeEffects.keys()).map(id => id.split('_')[0]),
            initialized: this.initialized,
            poolSize: this.particlePool.length
        };
    }

    /**
     * Log effect creation for telemetry
     */
    logEffect(effectType, data) {
        const telemetryData = {
            effect: effectType,
            timestamp: Date.now(),
            ...data
        };

        console.log(`fx:debug [FXLibrary] Effect created: ${effectType}`, telemetryData);

        // Emit to GameState for telemetry collection
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('telemetry/fx_created', telemetryData);
        }
    }

    /**
     * Create landing dust effect when player lands from height
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate (ground level)
     * @param {Object} options - Effect options
     */
    landingDust(scene, x, y, options = {}) {
        const opts = {
            count: 10,
            speed: { min: 40, max: 100 },
            scale: { start: 0.6, end: 0.1 },
            duration: 500,
            color: [0xA0826D, 0xD2B48C, 0xC4A878, 0x8B7355], // Brown/tan dust colors
            spread: 160, // Upward arc (not full 360)
            gravity: { x: 0, y: 80 }, // Falls back down
            alpha: { start: 0.7, end: 0 },
            ...options
        };

        const effectId = `dust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const particles = [];

        for (let i = 0; i < opts.count; i++) {
            // Spread from -80 to 80 degrees (upward arc centered at -90)
            const baseAngle = -90; // Straight up
            const spreadHalf = opts.spread / 2;
            const angle = baseAngle + (Math.random() * opts.spread) - spreadHalf;
            const speed = Phaser.Math.Between(opts.speed.min, opts.speed.max);
            const color = Array.isArray(opts.color) ?
                opts.color[Math.floor(Math.random() * opts.color.length)] : opts.color;

            const particle = this.createDustParticle(scene, x, y, {
                color,
                scale: opts.scale,
                alpha: opts.alpha
            });

            particles.push(particle);

            // Animate opacity and scale
            scene.tweens.add({
                targets: particle,
                scale: opts.scale.end,
                alpha: opts.alpha.end,
                duration: opts.duration,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.destroyParticle(particle);
                }
            });

            // Physics movement with gravity
            const velocityX = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
            const velocityY = Math.sin(Phaser.Math.DegToRad(angle)) * speed;

            scene.tweens.add({
                targets: particle,
                x: particle.x + velocityX * (opts.duration / 1000),
                y: particle.y + velocityY * (opts.duration / 1000) + opts.gravity.y * (opts.duration / 1000) * 0.5,
                duration: opts.duration,
                ease: 'Quad.easeOut'
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        this.logEffect('landing_dust', { x, y, count: opts.count });

        return effectId;
    }

    /**
     * Create individual dust particle (small cloud puff)
     */
    createDustParticle(scene, x, y, options) {
        const particle = scene.add.graphics();
        particle.setPosition(x, y);
        particle.setScale(options.scale.start);
        particle.setAlpha(options.alpha.start);

        // Create small cloud/puff shape
        particle.fillStyle(options.color, 1.0);
        particle.fillCircle(0, 0, 4);
        particle.fillCircle(2, -1, 3);
        particle.fillCircle(-2, -1, 3);

        return particle;
    }

    /**
     * Create speed lines effect when player moves fast
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} direction - Movement direction (-1 left, 1 right)
     * @param {Object} options - Effect options
     */
    speedLines(scene, x, y, direction, options = {}) {
        const opts = {
            count: 5,
            length: { min: 15, max: 35 },
            duration: 250,
            color: 0xFFFFFF,
            alpha: { start: 0.5, end: 0 },
            spread: 40, // Vertical spread
            ...options
        };

        const effectId = `speed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const particles = [];

        for (let i = 0; i < opts.count; i++) {
            const offsetY = (Math.random() * opts.spread) - (opts.spread / 2);
            const length = Phaser.Math.Between(opts.length.min, opts.length.max);

            const line = scene.add.graphics();
            line.setPosition(x, y + offsetY);
            line.setAlpha(opts.alpha.start);

            // Draw horizontal speed line
            line.lineStyle(2, opts.color, 1.0);
            line.beginPath();
            line.moveTo(0, 0);
            line.lineTo(-direction * length, 0); // Trail behind movement
            line.strokePath();

            particles.push(line);

            // Fade out and move
            scene.tweens.add({
                targets: line,
                alpha: opts.alpha.end,
                x: line.x - (direction * 30), // Move in opposite direction of player
                duration: opts.duration,
                ease: 'Linear',
                onComplete: () => {
                    this.destroyParticle(line);
                }
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });

        return effectId;
    }

    /**
     * Create shield aura effect around player
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {Phaser.GameObjects.Sprite} target - Target sprite to follow
     * @param {Object} options - Effect options
     * @returns {Object} Controller with update() and destroy() methods
     */
    shieldAura(scene, target, options = {}) {
        const opts = {
            color: 0x00FFFF,
            radius: 50,
            alpha: 0.4,
            pulseSpeed: 800,
            ...options
        };

        // Create aura graphics
        const aura = scene.add.graphics();
        aura.setDepth(target.depth - 1);
        aura.setBlendMode(Phaser.BlendModes.ADD);

        // Draw initial aura
        const drawAura = () => {
            aura.clear();

            // Outer glow
            aura.fillStyle(opts.color, opts.alpha * 0.3);
            aura.fillCircle(0, 0, opts.radius + 10);

            // Middle ring
            aura.fillStyle(opts.color, opts.alpha * 0.5);
            aura.fillCircle(0, 0, opts.radius);

            // Inner bright core
            aura.fillStyle(opts.color, opts.alpha);
            aura.fillCircle(0, 0, opts.radius - 15);

            // Ring outline
            aura.lineStyle(2, 0xFFFFFF, opts.alpha * 0.8);
            aura.strokeCircle(0, 0, opts.radius);
        };

        drawAura();
        aura.setPosition(target.x, target.y);

        // Pulsing animation
        const pulseTween = scene.tweens.add({
            targets: aura,
            scaleX: { from: 1, to: 1.15 },
            scaleY: { from: 1, to: 1.15 },
            alpha: { from: 1, to: 0.7 },
            duration: opts.pulseSpeed,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Return controller object
        return {
            aura,
            pulseTween,
            update: () => {
                if (target && target.active) {
                    aura.setPosition(target.x, target.y);
                }
            },
            destroy: () => {
                if (pulseTween) pulseTween.stop();
                if (aura) aura.destroy();
            }
        };
    }

    /**
     * Create preset effect combinations
     */
    presets = {
        /**
         * Gentle welcome burst for new creatures
         */
        welcomeBurst: (scene, x, y) => {
            return this.stardustBurst(scene, x, y, {
                count: 12,
                speed: { min: 30, max: 80 },
                duration: 2000,
                color: this.config.colors.stardust,
                spread: 180,
                gravity: { x: 0, y: 10 }
            });
        },

        /**
         * Magical feeding effect
         */
        feedingSparkles: (scene, x, y) => {
            return this.stardustBurst(scene, x, y, {
                count: 6,
                speed: { min: 20, max: 50 },
                duration: 1500,
                color: [0x98FB98, 0x32CD32],
                spread: 120,
                scale: { start: 0.6, end: 0.1 }
            });
        },

        /**
         * Soothing sleep aurora
         */
        sleepAurora: (scene) => {
            return this.auroraPass(scene, {
                strips: 2,
                duration: 6000,
                colors: [0x4169E1, 0x9370DB],
                opacity: { start: 0.0, peak: 0.3, end: 0.0 }
            });
        },

        /**
         * Happy creature celebration
         */
        celebrationBurst: (scene, x, y) => {
            const burst1 = this.stardustBurst(scene, x, y, {
                count: 15,
                color: this.config.colors.stardust,
                duration: 1800
            });
            
            scene.time.delayedCall(300, () => {
                this.stardustBurst(scene, x, y - 20, {
                    count: 8,
                    color: this.config.colors.aurora,
                    duration: 1200,
                    spread: 90
                });
            });
            
            return burst1;
        }
    };
}

// Create singleton instance
window.FXLibrary = window.FXLibrary || new FXLibrary();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FXLibrary;
}

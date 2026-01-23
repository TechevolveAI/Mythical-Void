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

// =============================================================
    // EMOTION PARTICLE EFFECTS
    // These communicate creature emotions without facial expressions
    // =============================================================

    /**
     * Happy emotion - Rising hearts and sparkles
     * @param {Phaser.Scene} scene
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {Object} options
     */
    emotionHappy(scene, x, y, options = {}) {
        const opts = {
            count: 6,
            duration: 1500,
            colors: [0xFF69B4, 0xFFD700, 0xFFFFFF], // Pink, gold, white
            ...options
        };

        const effectId = `emotion_happy_${Date.now()}`;
        const particles = [];

        for (let i = 0; i < opts.count; i++) {
            const isHeart = i % 2 === 0;
            const offsetX = (Math.random() * 60) - 30;
            const delay = i * 150;

            scene.time.delayedCall(delay, () => {
                const particle = scene.add.graphics();
                particle.setPosition(x + offsetX, y);
                const color = opts.colors[Math.floor(Math.random() * opts.colors.length)];

                if (isHeart) {
                    // Draw heart shape
                    particle.fillStyle(color, 1);
                    this.drawHeart(particle, 0, 0, 6);
                } else {
                    // Draw sparkle
                    particle.fillStyle(color, 1);
                    this.drawStar(particle, 0, 0, 4, 2, 5);
                }

                particle.setScale(0.5);
                particle.setAlpha(0);

                particles.push(particle);

                // Float up and fade
                scene.tweens.add({
                    targets: particle,
                    y: y - 80 - (Math.random() * 40),
                    alpha: { from: 0.8, to: 0 },
                    scale: { from: 0.5, to: 1 },
                    duration: opts.duration,
                    ease: 'Quad.easeOut',
                    onComplete: () => this.destroyParticle(particle)
                });

                // Gentle sideways drift
                scene.tweens.add({
                    targets: particle,
                    x: particle.x + (Math.random() * 30 - 15),
                    duration: opts.duration,
                    ease: 'Sine.easeInOut'
                });
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Draw heart shape on graphics using Phaser-compatible methods
     * Uses two circles for the top bumps and a triangle for the bottom
     */
    drawHeart(graphics, x, y, size) {
        const radius = size * 0.4;

        // Left bump (circle)
        graphics.fillCircle(x - radius * 0.7, y - radius * 0.3, radius);

        // Right bump (circle)
        graphics.fillCircle(x + radius * 0.7, y - radius * 0.3, radius);

        // Bottom triangle point
        graphics.fillTriangle(
            x - size * 0.85, y,           // Left point
            x + size * 0.85, y,           // Right point
            x, y + size * 1.1             // Bottom point
        );
    }

    /**
     * Curious emotion - Question marks and swirling dots
     */
    emotionCurious(scene, x, y, options = {}) {
        const opts = {
            duration: 2000,
            color: 0x87CEEB, // Sky blue
            ...options
        };

        const effectId = `emotion_curious_${Date.now()}`;
        const particles = [];

        // Main question mark
        const questionMark = scene.add.text(x + 20, y - 40, '?', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#' + opts.color.toString(16).padStart(6, '0'),
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        particles.push(questionMark);

        // Pop in animation
        scene.tweens.add({
            targets: questionMark,
            alpha: 1,
            scale: { from: 0.3, to: 1.2 },
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Gentle bob
                scene.tweens.add({
                    targets: questionMark,
                    y: questionMark.y - 8,
                    duration: 500,
                    yoyo: true,
                    repeat: 2,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        scene.tweens.add({
                            targets: questionMark,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => questionMark.destroy()
                        });
                    }
                });
            }
        });

        // Swirling dots
        for (let i = 0; i < 3; i++) {
            const dot = scene.add.graphics();
            dot.fillStyle(opts.color, 0.6);
            dot.fillCircle(0, 0, 3);
            dot.setPosition(x, y - 20);
            dot.setAlpha(0);
            particles.push(dot);

            const angle = (i / 3) * Math.PI * 2;
            const radius = 25;

            scene.time.delayedCall(i * 200, () => {
                dot.setAlpha(0.7);
                let currentAngle = angle;

                // Orbit animation
                scene.time.addEvent({
                    delay: 50,
                    repeat: (opts.duration - 600) / 50,
                    callback: () => {
                        currentAngle += 0.15;
                        dot.setPosition(
                            x + Math.cos(currentAngle) * radius,
                            y - 20 + Math.sin(currentAngle) * (radius * 0.5)
                        );
                    }
                });

                scene.time.delayedCall(opts.duration - 500, () => {
                    scene.tweens.add({
                        targets: dot,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => this.destroyParticle(dot)
                    });
                });
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Shy emotion - Small retreating particles, creature shrinks slightly
     */
    emotionShy(scene, x, y, options = {}) {
        const opts = {
            duration: 1200,
            color: 0xDDA0DD, // Plum/soft purple
            ...options
        };

        const effectId = `emotion_shy_${Date.now()}`;
        const particles = [];

        // Small fading particles that retreat inward
        for (let i = 0; i < 5; i++) {
            const particle = scene.add.graphics();
            const startX = x + (Math.random() * 40 - 20);
            const startY = y - 20 + (Math.random() * 20 - 10);

            particle.fillStyle(opts.color, 0.5);
            particle.fillCircle(0, 0, 4);
            particle.setPosition(startX, startY);
            particle.setAlpha(0.6);

            particles.push(particle);

            // Retreat toward center and fade
            scene.tweens.add({
                targets: particle,
                x: x + (startX - x) * 0.3,
                y: y + (startY - y) * 0.3,
                alpha: 0,
                scale: 0.3,
                duration: opts.duration,
                delay: i * 100,
                ease: 'Sine.easeIn',
                onComplete: () => this.destroyParticle(particle)
            });
        }

        // Soft blush effect
        const blush = scene.add.graphics();
        blush.fillStyle(0xFFB6C1, 0.3); // Light pink
        blush.fillCircle(0, 0, 15);
        blush.setPosition(x, y - 5);
        blush.setAlpha(0);
        particles.push(blush);

        scene.tweens.add({
            targets: blush,
            alpha: { from: 0, to: 0.4 },
            duration: 400,
            yoyo: true,
            hold: opts.duration - 800,
            onComplete: () => this.destroyParticle(blush)
        });

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Excited emotion - Bursting stars and rapid bouncing particles
     */
    emotionExcited(scene, x, y, options = {}) {
        const opts = {
            count: 12,
            duration: 1000,
            colors: [0xFFD700, 0xFFA500, 0xFF6347, 0xFFFF00], // Gold, orange, tomato, yellow
            ...options
        };

        const effectId = `emotion_excited_${Date.now()}`;
        const particles = [];

        // Rapid burst of stars
        for (let i = 0; i < opts.count; i++) {
            const angle = (i / opts.count) * 360;
            const speed = 80 + Math.random() * 60;
            const color = opts.colors[Math.floor(Math.random() * opts.colors.length)];

            const particle = scene.add.graphics();
            particle.fillStyle(color, 1);
            this.drawStar(particle, 0, 0, 4, 2, 5);
            particle.setPosition(x, y - 20);
            particle.setScale(0.3);
            particle.setBlendMode(Phaser.BlendModes.ADD);

            particles.push(particle);

            const velocityX = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
            const velocityY = Math.sin(Phaser.Math.DegToRad(angle)) * speed;

            scene.tweens.add({
                targets: particle,
                x: particle.x + velocityX * 0.8,
                y: particle.y + velocityY * 0.8,
                scale: { from: 0.3, to: 0.8 },
                alpha: { from: 1, to: 0 },
                duration: opts.duration,
                ease: 'Cubic.easeOut',
                onComplete: () => this.destroyParticle(particle)
            });
        }

        // Exclamation marks
        for (let i = 0; i < 2; i++) {
            const exclaim = scene.add.text(
                x + (i === 0 ? -25 : 25),
                y - 50,
                '!',
                {
                    fontSize: '24px',
                    fontFamily: 'Arial',
                    color: '#FFD700',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5).setAlpha(0);

            particles.push(exclaim);

            scene.tweens.add({
                targets: exclaim,
                alpha: 1,
                y: exclaim.y - 15,
                scale: { from: 0.5, to: 1.3 },
                duration: 400,
                ease: 'Back.easeOut',
                delay: i * 150,
                onComplete: () => {
                    scene.tweens.add({
                        targets: exclaim,
                        alpha: 0,
                        duration: 300,
                        delay: 300,
                        onComplete: () => exclaim.destroy()
                    });
                }
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Tired emotion - Floating Z's and dim, slow particles
     */
    emotionTired(scene, x, y, options = {}) {
        const opts = {
            duration: 3000,
            color: 0x6B6BA0, // Muted blue
            ...options
        };

        const effectId = `emotion_tired_${Date.now()}`;
        const particles = [];

        // Floating Z's
        const zPositions = [
            { x: x + 15, y: y - 35, size: '14px', delay: 0 },
            { x: x + 25, y: y - 50, size: '18px', delay: 500 },
            { x: x + 35, y: y - 70, size: '22px', delay: 1000 }
        ];

        zPositions.forEach(pos => {
            scene.time.delayedCall(pos.delay, () => {
                const z = scene.add.text(pos.x, pos.y, 'z', {
                    fontSize: pos.size,
                    fontFamily: 'Arial',
                    color: '#' + opts.color.toString(16).padStart(6, '0'),
                    fontStyle: 'italic'
                }).setOrigin(0.5).setAlpha(0);

                particles.push(z);

                scene.tweens.add({
                    targets: z,
                    alpha: { from: 0, to: 0.7 },
                    y: z.y - 30,
                    x: z.x + 10,
                    duration: opts.duration - pos.delay,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        scene.tweens.add({
                            targets: z,
                            alpha: 0,
                            duration: 400,
                            onComplete: () => z.destroy()
                        });
                    }
                });
            });
        });

        // Slow, dim sparkles
        for (let i = 0; i < 3; i++) {
            const sparkle = scene.add.graphics();
            sparkle.fillStyle(opts.color, 0.4);
            sparkle.fillCircle(0, 0, 3);
            sparkle.setPosition(x + (Math.random() * 40 - 20), y - 10);
            sparkle.setAlpha(0);

            particles.push(sparkle);

            scene.time.delayedCall(i * 400, () => {
                scene.tweens.add({
                    targets: sparkle,
                    alpha: { from: 0, to: 0.5 },
                    y: sparkle.y - 40,
                    duration: opts.duration - (i * 400),
                    ease: 'Sine.easeOut',
                    onComplete: () => this.destroyParticle(sparkle)
                });
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Scared emotion - Trembling lines and dark wisps
     */
    emotionScared(scene, x, y, options = {}) {
        const opts = {
            duration: 1500,
            colors: [0x4B0082, 0x2F2F4F, 0x483D8B], // Indigo, dark slate, dark slate blue
            ...options
        };

        const effectId = `emotion_scared_${Date.now()}`;
        const particles = [];

        // Trembling lines around creature
        for (let i = 0; i < 6; i++) {
            const line = scene.add.graphics();
            const angle = (i / 6) * Math.PI * 2;
            const dist = 30;

            const startX = x + Math.cos(angle) * dist;
            const startY = y - 15 + Math.sin(angle) * (dist * 0.6);

            line.lineStyle(2, opts.colors[i % opts.colors.length], 0.7);
            line.beginPath();
            line.moveTo(0, -8);
            line.lineTo(0, 8);
            line.strokePath();
            line.setPosition(startX, startY);

            particles.push(line);

            // Rapid trembling
            scene.tweens.add({
                targets: line,
                x: startX + (Math.random() * 6 - 3),
                duration: 50,
                yoyo: true,
                repeat: (opts.duration / 100),
                ease: 'Sine.easeInOut'
            });

            // Fade out
            scene.tweens.add({
                targets: line,
                alpha: 0,
                duration: opts.duration,
                delay: 500,
                onComplete: () => this.destroyParticle(line)
            });
        }

        // Dark wisps drifting away
        for (let i = 0; i < 4; i++) {
            const wisp = scene.add.graphics();
            wisp.fillStyle(opts.colors[0], 0.4);
            wisp.fillEllipse(0, 0, 12, 6);
            wisp.setPosition(x + (Math.random() * 30 - 15), y - 10);
            wisp.setAlpha(0);

            particles.push(wisp);

            scene.time.delayedCall(i * 200, () => {
                scene.tweens.add({
                    targets: wisp,
                    alpha: { from: 0.5, to: 0 },
                    x: wisp.x + (Math.random() > 0.5 ? 40 : -40),
                    y: wisp.y - 30,
                    scaleX: 2,
                    duration: opts.duration - (i * 200),
                    ease: 'Sine.easeOut',
                    onComplete: () => this.destroyParticle(wisp)
                });
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    /**
     * Content/peaceful emotion - Soft floating sparkles with gentle glow
     */
    emotionContent(scene, x, y, options = {}) {
        const opts = {
            duration: 2500,
            colors: [0x98FB98, 0xADD8E6, 0xFFE4E1], // Pale green, light blue, misty rose
            ...options
        };

        const effectId = `emotion_content_${Date.now()}`;
        const particles = [];

        // Soft glow underneath
        const glow = scene.add.graphics();
        glow.fillStyle(opts.colors[0], 0.2);
        glow.fillCircle(0, 0, 40);
        glow.setPosition(x, y);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        glow.setAlpha(0);
        particles.push(glow);

        scene.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.5 },
            scale: { from: 0.8, to: 1.1 },
            duration: opts.duration * 0.4,
            yoyo: true,
            hold: opts.duration * 0.2,
            onComplete: () => this.destroyParticle(glow)
        });

        // Gentle floating sparkles
        for (let i = 0; i < 5; i++) {
            const sparkle = scene.add.graphics();
            const color = opts.colors[i % opts.colors.length];
            sparkle.fillStyle(color, 0.6);
            this.drawStar(sparkle, 0, 0, 4, 1.5, 3.5);
            sparkle.setPosition(
                x + (Math.random() * 50 - 25),
                y + (Math.random() * 30 - 15)
            );
            sparkle.setAlpha(0);
            sparkle.setScale(0.4);

            particles.push(sparkle);

            scene.time.delayedCall(i * 300, () => {
                scene.tweens.add({
                    targets: sparkle,
                    alpha: { from: 0, to: 0.7 },
                    y: sparkle.y - 50,
                    scale: { from: 0.4, to: 0.8 },
                    duration: opts.duration - (i * 300),
                    ease: 'Sine.easeInOut',
                    onComplete: () => this.destroyParticle(sparkle)
                });
            });
        }

        this.activeEffects.set(effectId, { particles, startTime: Date.now() });
        return effectId;
    }

    // =============================================================
    // END EMOTION PARTICLE EFFECTS
    // =============================================================

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

    /**
     * Create aurora borealis effect across the top of screen
     * Used when real space weather indicates geomagnetic activity
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {number} intensity - Aurora intensity 0-1
     * @param {Object} options - Effect options
     * @returns {Object} Aurora controller with update/destroy methods
     */
    createAurora(scene, intensity = 0.5, options = {}) {
        const opts = {
            colors: [0x00FF88, 0x88FF00, 0x00FFCC, 0xFF00FF, 0x8800FF],
            height: 150,
            waveSpeed: 0.002,
            shimmerSpeed: 0.01,
            alpha: Math.min(0.6, intensity * 0.8),
            ...options
        };

        const width = scene.cameras.main.width;
        const effectId = `aurora_${Date.now()}`;

        // Create aurora graphics container
        const auroraContainer = scene.add.container(0, 0);
        auroraContainer.setDepth(1); // Very low depth - below ALL UI elements (MobileHUD is 1500+)
        auroraContainer.setScrollFactor(0); // Fixed to camera

        // Create multiple aurora bands
        const bands = [];
        const numBands = 5;

        for (let i = 0; i < numBands; i++) {
            const band = scene.add.graphics();
            band.phase = Math.random() * Math.PI * 2;
            band.color = opts.colors[i % opts.colors.length];
            band.yOffset = i * 25;
            bands.push(band);
            auroraContainer.add(band);
        }

        // Aurora update function
        let time = 0;
        const updateAurora = () => {
            time += 16; // ~60fps

            bands.forEach((band, index) => {
                band.clear();

                // Vertical gradient with wave
                for (let x = 0; x < width; x += 8) {
                    const wave = Math.sin((x * 0.01) + (time * opts.waveSpeed) + band.phase);
                    const shimmer = Math.sin((x * 0.03) + (time * opts.shimmerSpeed) + index);
                    const heightMod = (wave * 0.3 + shimmer * 0.2 + 0.5) * opts.height * intensity;

                    const alpha = opts.alpha * (0.5 + shimmer * 0.3) * (1 - (band.yOffset / 150));

                    band.fillStyle(band.color, alpha);
                    band.fillRect(x, band.yOffset + wave * 20, 10, heightMod);
                }
            });
        };

        // Start update loop
        const updateTimer = scene.time.addEvent({
            delay: 50,
            callback: updateAurora,
            loop: true
        });

        // Initial draw
        updateAurora();

        // Store effect
        this.activeEffects.set(effectId, {
            container: auroraContainer,
            bands,
            timer: updateTimer,
            startTime: Date.now()
        });

        this.logEffect('aurora', { intensity, width });

        // Return controller
        return {
            id: effectId,
            setIntensity: (newIntensity) => {
                opts.alpha = Math.min(0.6, newIntensity * 0.8);
            },
            destroy: () => {
                updateTimer.remove();
                auroraContainer.destroy();
                this.activeEffects.delete(effectId);
            }
        };
    }

    /**
     * Apply sky tint overlay for solar flare effects
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {number} tintColor - Hex color for tint
     * @param {number} alpha - Tint intensity 0-1
     * @returns {Object} Tint controller with update/destroy methods
     */
    createSkyTint(scene, tintColor = 0xFFD700, alpha = 0.15) {
        const effectId = `skytint_${Date.now()}`;

        const tintOverlay = scene.add.graphics();
        tintOverlay.setDepth(4); // Behind aurora
        tintOverlay.setScrollFactor(0);

        const width = scene.cameras.main.width;
        const height = scene.cameras.main.height;

        // Create gradient from top
        tintOverlay.fillStyle(tintColor, alpha);
        tintOverlay.fillRect(0, 0, width, height * 0.4);

        // Fade gradient
        for (let i = 0; i < 10; i++) {
            const gradientAlpha = alpha * (1 - i / 10);
            tintOverlay.fillStyle(tintColor, gradientAlpha);
            tintOverlay.fillRect(0, height * 0.4 + (i * height * 0.06), width, height * 0.06);
        }

        // Subtle pulse animation
        scene.tweens.add({
            targets: tintOverlay,
            alpha: { from: 1, to: 0.7 },
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.activeEffects.set(effectId, {
            overlay: tintOverlay,
            startTime: Date.now()
        });

        this.logEffect('sky_tint', { color: tintColor.toString(16), alpha });

        return {
            id: effectId,
            setAlpha: (newAlpha) => {
                tintOverlay.setAlpha(newAlpha);
            },
            destroy: () => {
                scene.tweens.killTweensOf(tintOverlay);
                tintOverlay.destroy();
                this.activeEffects.delete(effectId);
            }
        };
    }
}

// Create singleton instance
window.FXLibrary = window.FXLibrary || new FXLibrary();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FXLibrary;
}

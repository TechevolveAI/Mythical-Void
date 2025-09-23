const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * ParallaxBiome - Layered space-fantasy background system
 * Creates immersive crash-site biome with gentle parallax layers
 */

class ParallaxBiomeManager {
    constructor() {
        this.scene = null;
        this.layers = [];
        this.config = null;
        this.isActive = false;
        this.scrollFactor = 0;
    }

    /**
     * Initialize the parallax biome system
     */
    initialize(scene, biomeConfig = null) {
        this.scene = scene;
        this.config = biomeConfig || this.getDefaultConfig();
        this.layers = [];
        
        console.log('biome:info [ParallaxBiome] Space-fantasy biome system initialized', this.config.name);
    }

    /**
     * Get default crash-site biome configuration
     */
    getDefaultConfig() {
        return {
            name: "CrashSite",
            palette: {
                skyTop: 0xB39DDB,        // Crystal Lilac
                skyBottom: 0x80CBC4,     // Aurora Teal (very light)
                nebula: 0xF48FB1,        // Nebula Pink
                stars: 0xFFFFFF,         // Pure white
                floatingRocks: 0x90A4AE, // Blue Grey
                crystalFlora: 0x64B5F6,  // Comet Blue
                biolume: 0xFFD54F,       // Star Gold
                dust: 0xE1F5FE,          // Very light cyan
                vignette: 0x37474F       // Deep Ink (subtle)
            },
            layers: {
                nebulaBackground: { 
                    parallax: 0.1, 
                    alpha: 0.6, 
                    animate: true,
                    speed: 0.3
                },
                distantStars: { 
                    parallax: 0.15, 
                    alpha: 0.8, 
                    animate: true,
                    speed: 0.1,
                    count: 25
                },
                floatingRocks: { 
                    parallax: 0.3, 
                    alpha: 0.7, 
                    animate: true,
                    speed: 0.5,
                    count: 8
                },
                crystalFlora: { 
                    parallax: 0.6, 
                    alpha: 0.9, 
                    animate: true,
                    speed: 0.2,
                    count: 12
                },
                foregroundDust: { 
                    parallax: 0.8, 
                    alpha: 0.4, 
                    animate: true,
                    speed: 1.2,
                    count: 15
                }
            },
            effects: {
                enableTwinkling: true,
                enableBioluminescence: true,
                enableGentleFloat: true,
                enableDustDrift: true,
                vignette: {
                    enabled: true,
                    intensity: 0.1,
                    radius: 0.8
                }
            },
            performance: {
                maxLayers: 5,
                particleLimit: 60,
                enableAnimations: true
            }
        };
    }

    /**
     * Create the complete crash-site biome
     */
    createBiome() {
        if (this.isActive) {
            this.cleanup();
        }

        this.isActive = true;
        console.log('biome:info [ParallaxBiome] Creating space crash-site biome');

        // Layer 1: Pastel nebula background
        this.createNebulaBackground();
        
        // Layer 2: Distant twinkling stars
        this.createDistantStars();
        
        // Layer 3: Floating rock silhouettes
        this.createFloatingRocks();
        
        // Layer 4: Crystal flora with bioluminescence
        this.createCrystalFlora();
        
        // Layer 5: Foreground stardust
        this.createForegroundDust();
        
        // Optional: Subtle vignette
        if (this.config.effects.vignette.enabled) {
            this.createGentleVignette();
        }

        // Set up parallax scrolling
        this.setupParallaxScrolling();

        console.log(`biome:info [ParallaxBiome] Biome '${this.config.name}' created with ${this.layers.length} layers`);
    }

    /**
     * Layer 1: Create nebula background with gradient and optional noise
     */
    createNebulaBackground() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.nebulaBackground;
        
        // Create gradient background
        const nebulaBg = this.scene.add.graphics();
        nebulaBg.fillGradientStyle(
            this.config.palette.skyTop, this.config.palette.skyTop,
            this.config.palette.skyBottom, this.config.palette.skyBottom,
            1
        );
        nebulaBg.fillRect(0, 0, width * 2, height); // Wider for parallax
        
        // Add nebula wisps
        for (let i = 0; i < 3; i++) {
            const wisp = this.scene.add.graphics();
            wisp.fillStyle(this.config.palette.nebula, 0.2);
            
            // Create organic nebula shape
            const centerX = width * (0.2 + i * 0.3);
            const centerY = height * (0.3 + i * 0.2);
            wisp.fillEllipse(centerX, centerY, 200 + i * 50, 100 + i * 30);
            
            // Gentle drift animation
            if (layer.animate) {
                this.scene.tweens.add({
                    targets: wisp,
                    x: wisp.x + 20,
                    alpha: { from: 0.1, to: 0.3 },
                    duration: 8000 + i * 2000,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 1000
                });
            }
            
            wisp.setScrollFactor(layer.parallax);
            this.layers.push({ type: 'nebula', object: wisp, config: layer });
        }
        
        nebulaBg.setScrollFactor(layer.parallax);
        nebulaBg.setAlpha(layer.alpha);
        this.layers.push({ type: 'background', object: nebulaBg, config: layer });
    }

    /**
     * Layer 2: Create distant twinkling stars
     */
    createDistantStars() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.distantStars;
        
        for (let i = 0; i < layer.count; i++) {
            const star = this.scene.add.graphics();
            star.fillStyle(this.config.palette.stars, 0.9);
            
            // Vary star sizes for depth
            const size = Phaser.Math.FloatBetween(0.8, 2.2);
            star.fillCircle(0, 0, size);
            
            // Random positioning across extended area
            star.setPosition(
                Phaser.Math.Between(0, width * 1.5),
                Phaser.Math.Between(0, height * 0.7) // Keep in upper area
            );
            
            // Accessibility
            star.setData('ariaLabel', 'Distant star in space');
            
            // Twinkling animation
            if (layer.animate && this.config.effects.enableTwinkling) {
                this.scene.tweens.add({
                    targets: star,
                    alpha: { from: 0.4, to: 1.0 },
                    scale: { from: 0.8, to: 1.2 },
                    duration: Phaser.Math.Between(2000, 4000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 200
                });
            }
            
            star.setScrollFactor(layer.parallax);
            star.setAlpha(layer.alpha);
            this.layers.push({ type: 'star', object: star, config: layer });
        }
    }

    /**
     * Layer 3: Create floating rock silhouettes with gentle movement
     */
    createFloatingRocks() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.floatingRocks;
        
        for (let i = 0; i < layer.count; i++) {
            const rock = this.scene.add.graphics();
            rock.fillStyle(this.config.palette.floatingRocks, 0.6);
            
            // Create organic rock shapes
            const baseSize = 40 + i * 15;
            rock.fillEllipse(0, 0, baseSize, baseSize * 0.7);
            rock.fillEllipse(baseSize * 0.3, -baseSize * 0.2, baseSize * 0.6, baseSize * 0.4);
            
            // Position in mid-distance
            rock.setPosition(
                Phaser.Math.Between(100, width + 200),
                Phaser.Math.Between(height * 0.2, height * 0.8)
            );
            
            // Accessibility
            rock.setData('ariaLabel', 'Floating space rock');
            
            // Gentle floating animation
            if (layer.animate && this.config.effects.enableGentleFloat) {
                this.scene.tweens.add({
                    targets: rock,
                    y: rock.y + Phaser.Math.Between(-15, 15),
                    x: rock.x + Phaser.Math.Between(-10, 10),
                    rotation: Phaser.Math.FloatBetween(-0.1, 0.1),
                    duration: Phaser.Math.Between(6000, 10000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 800
                });
            }
            
            rock.setScrollFactor(layer.parallax);
            rock.setAlpha(layer.alpha);
            this.layers.push({ type: 'rock', object: rock, config: layer });
        }
    }

    /**
     * Layer 4: Create crystal flora with bioluminescent pulses
     */
    createCrystalFlora() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.crystalFlora;
        
        for (let i = 0; i < layer.count; i++) {
            const flora = this.scene.add.graphics();
            
            // Create crystalline plant shapes
            const baseHeight = 30 + Phaser.Math.Between(10, 50);
            const baseWidth = 8 + Phaser.Math.Between(2, 12);
            
            // Stem
            flora.fillStyle(this.config.palette.crystalFlora, 0.7);
            flora.fillRect(-baseWidth/2, 0, baseWidth, baseHeight);
            
            // Crystal formations at top
            flora.fillStyle(this.config.palette.biolume, 0.9);
            flora.fillTriangle(-baseWidth, -5, baseWidth, -5, 0, -baseHeight * 0.4);
            
            // Position in foreground
            flora.setPosition(
                Phaser.Math.Between(50, width + 100),
                height - Phaser.Math.Between(10, 80)
            );
            
            // Accessibility
            flora.setData('ariaLabel', 'Bioluminescent crystal plant');
            
            // Gentle sway animation
            if (layer.animate) {
                this.scene.tweens.add({
                    targets: flora,
                    rotation: Phaser.Math.FloatBetween(-0.05, 0.05),
                    duration: Phaser.Math.Between(3000, 5000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 400
                });
            }
            
            // Bioluminescent pulse
            if (this.config.effects.enableBioluminescence) {
                this.scene.tweens.add({
                    targets: flora,
                    alpha: { from: 0.6, to: 1.0 },
                    duration: Phaser.Math.Between(2000, 3500),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 600
                });
            }
            
            flora.setScrollFactor(layer.parallax);
            this.layers.push({ type: 'flora', object: flora, config: layer });
        }
    }

    /**
     * Layer 5: Create foreground stardust particles
     */
    createForegroundDust() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.foregroundDust;
        
        for (let i = 0; i < layer.count; i++) {
            const dust = this.scene.add.graphics();
            dust.fillStyle(this.config.palette.dust, 0.6);
            
            const size = Phaser.Math.FloatBetween(1, 3);
            dust.fillCircle(0, 0, size);
            
            // Position across scene
            dust.setPosition(
                Phaser.Math.Between(0, width * 1.2),
                Phaser.Math.Between(0, height)
            );
            
            // Accessibility
            dust.setData('ariaLabel', 'Floating stardust particle');
            
            // Gentle drift animation
            if (layer.animate && this.config.effects.enableDustDrift) {
                const driftDirection = Phaser.Math.FloatBetween(-1, 1);
                
                this.scene.tweens.add({
                    targets: dust,
                    x: dust.x + driftDirection * 50,
                    y: dust.y + Phaser.Math.Between(-20, 20),
                    alpha: { from: 0.2, to: 0.8 },
                    duration: Phaser.Math.Between(4000, 7000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 300
                });
            }
            
            dust.setScrollFactor(layer.parallax);
            dust.setAlpha(layer.alpha);
            this.layers.push({ type: 'dust', object: dust, config: layer });
        }
    }

    /**
     * Create subtle vignette effect
     */
    createGentleVignette() {
        const { width, height } = this.scene.cameras.main;
        const vignetteConfig = this.config.effects.vignette;
        
        const vignette = this.scene.add.graphics();
        
        // Create radial gradient effect (approximated with concentric circles)
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.max(width, height) * 0.7;
        
        for (let i = 0; i < 5; i++) {
            const radius = maxRadius * (1 - i * 0.2);
            const alpha = vignetteConfig.intensity * (i * 0.2);
            
            vignette.fillStyle(this.config.palette.vignette, alpha);
            vignette.fillCircle(centerX, centerY, radius);
        }
        
        // Blend mode for subtle effect
        vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
        vignette.setScrollFactor(0); // Fixed to camera
        vignette.setDepth(1000); // Always on top
        
        // Accessibility
        vignette.setData('ariaLabel', 'Atmospheric vignette effect');
        
        this.layers.push({ type: 'vignette', object: vignette, config: { parallax: 0 } });
    }

    /**
     * Set up parallax scrolling for all layers
     */
    setupParallaxScrolling() {
        // Enable camera bounds for parallax effect
        if (this.scene.cameras && this.scene.cameras.main) {
            const camera = this.scene.cameras.main;
            
            // Set world bounds larger than camera for parallax effect
            this.scene.physics?.world?.setBounds(0, 0, camera.width * 1.5, camera.height);
            
            console.log('biome:debug [ParallaxBiome] Parallax scrolling configured');
        }
    }

    /**
     * Update parallax effect based on camera movement
     */
    updateParallax(deltaX = 0, deltaY = 0) {
        if (!this.isActive || !this.layers.length) return;
        
        this.layers.forEach(layer => {
            if (layer.config.parallax < 1.0) {
                const parallaxOffsetX = deltaX * layer.config.parallax;
                const parallaxOffsetY = deltaY * layer.config.parallax;
                
                // Apply parallax offset
                if (layer.object && layer.object.setScrollFactor) {
                    layer.object.setScrollFactor(layer.config.parallax, layer.config.parallax);
                }
            }
        });
    }

    /**
     * Trigger atmospheric effects on key actions
     */
    triggerAtmosphericEffect(effectType, x, y, intensity = 1.0) {
        console.log(`biome:debug [ParallaxBiome] Triggering ${effectType} at (${x}, ${y})`);
        
        switch (effectType) {
            case 'stardust_burst':
                this.createStardustBurst(x, y, intensity);
                break;
            case 'aurora_flash':
                this.createAuroraFlash(x, y, intensity);
                break;
            case 'crystal_resonance':
                this.createCrystalResonance(x, y, intensity);
                break;
        }
    }

    /**
     * Create stardust burst effect
     */
    createStardustBurst(x, y, intensity) {
        const particleCount = Math.floor(8 * intensity);
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.scene.add.graphics();
            particle.fillStyle(this.config.palette.biolume, 0.8);
            particle.fillCircle(0, 0, 2);
            particle.setPosition(x, y);
            
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 40 * intensity;
            
            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0.5 },
                duration: 800,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }

    /**
     * Create aurora flash effect
     */
    createAuroraFlash(x, y, intensity) {
        const flash = this.scene.add.graphics();
        flash.fillStyle(this.config.palette.nebula, 0.4 * intensity);
        flash.fillCircle(x, y, 60 * intensity);
        
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: { from: 0.5, to: 2.0 },
            duration: 600,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
    }

    /**
     * Create crystal resonance effect
     */
    createCrystalResonance(x, y, intensity) {
        // Find nearby crystal flora and make them pulse
        this.layers.filter(layer => layer.type === 'flora').forEach(layer => {
            const flora = layer.object;
            const distance = Phaser.Math.Distance.Between(x, y, flora.x, flora.y);
            
            if (distance < 150) {
                this.scene.tweens.add({
                    targets: flora,
                    scaleX: { from: 1, to: 1.2, to: 1 },
                    scaleY: { from: 1, to: 1.2, to: 1 },
                    alpha: { from: flora.alpha, to: 1, to: flora.alpha },
                    duration: 400,
                    ease: 'Back.easeOut'
                });
            }
        });
    }

    /**
     * Get biome configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Set biome configuration
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('biome:debug [ParallaxBiome] Configuration updated');
    }

    /**
     * Clean up all biome layers
     */
    cleanup() {
        this.layers.forEach(layer => {
            if (layer.object && layer.object.destroy) {
                layer.object.destroy();
            }
        });
        
        this.layers = [];
        this.isActive = false;
        console.log('biome:info [ParallaxBiome] Biome layers cleaned up');
    }

    /**
     * Get layer count for performance monitoring
     */
    getLayerCount() {
        return this.layers.length;
    }

    /**
     * Get active layer types
     */
    getActiveLayerTypes() {
        return this.layers.map(layer => layer.type);
    }
}

// Create singleton instance
window.ParallaxBiome = window.ParallaxBiome || new ParallaxBiomeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParallaxBiomeManager;
}

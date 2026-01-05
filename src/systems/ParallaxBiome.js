const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

// Import biome configurations
import biomeConfigs from '../config/biomes.json';

/**
 * ParallaxBiome - Enhanced layered space-fantasy background system
 * Features:
 * - GPU-accelerated particle emitters for stars, dust, and effects
 * - Shader-based animated nebula backgrounds
 * - Smooth biome transitions with palette morphing
 * - 5x more particles with better performance
 */

// Custom Nebula Shader Pipeline
const NebulaShaderPipeline = Phaser.Class && Phaser.Renderer?.WebGL?.Pipelines?.PostFXPipeline ? Phaser.Class({
    Extends: Phaser.Renderer.WebGL.Pipelines.PostFXPipeline,

    initialize: function NebulaShaderPipeline(game) {
        Phaser.Renderer.WebGL.Pipelines.PostFXPipeline.call(this, {
            game: game,
            renderTarget: true,
            fragShader: `
                precision mediump float;

                uniform sampler2D uMainSampler;
                uniform float uTime;
                uniform vec2 uResolution;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                uniform float uIntensity;

                varying vec2 outTexCoord;

                // Simplex noise function
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                       -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v -   i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                                           + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                                           dot(x12.zw,x12.zw)), 0.0);
                    m = m*m;
                    m = m*m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                // Fractal Brownian Motion for organic nebula shapes
                float fbm(vec2 p) {
                    float f = 0.0;
                    float w = 0.5;
                    for (int i = 0; i < 5; i++) {
                        f += w * snoise(p);
                        p *= 2.0;
                        w *= 0.5;
                    }
                    return f;
                }

                void main() {
                    vec2 uv = outTexCoord;
                    vec2 p = uv * 3.0;

                    // Animated nebula layers
                    float t = uTime * 0.05;

                    float n1 = fbm(p + vec2(t * 0.3, t * 0.2));
                    float n2 = fbm(p * 1.5 + vec2(-t * 0.2, t * 0.4));
                    float n3 = fbm(p * 2.0 + vec2(t * 0.1, -t * 0.3));

                    // Mix nebula colors based on noise
                    vec3 nebula = mix(uColor1, uColor2, smoothstep(-0.5, 0.5, n1));
                    nebula = mix(nebula, uColor3, smoothstep(-0.3, 0.7, n2) * 0.5);

                    // Add glow intensity
                    float glow = smoothstep(0.0, 0.8, n3) * uIntensity;

                    // Get original texture
                    vec4 texColor = texture2D(uMainSampler, uv);

                    // Blend nebula with original
                    vec3 finalColor = mix(texColor.rgb, nebula, glow * 0.4);

                    gl_FragColor = vec4(finalColor, texColor.a);
                }
            `
        });

        this.time = 0;
        this.colors = {
            color1: [0.6, 0.2, 0.8],
            color2: [0.2, 0.5, 0.7],
            color3: [0.8, 0.4, 0.6]
        };
        this.intensity = 0.6;
    },

    onPreRender: function() {
        this.time += 0.016;
        this.set1f('uTime', this.time);
        this.set2f('uResolution', this.renderer.width, this.renderer.height);
        this.set3f('uColor1', this.colors.color1[0], this.colors.color1[1], this.colors.color1[2]);
        this.set3f('uColor2', this.colors.color2[0], this.colors.color2[1], this.colors.color2[2]);
        this.set3f('uColor3', this.colors.color3[0], this.colors.color3[1], this.colors.color3[2]);
        this.set1f('uIntensity', this.intensity);
    },

    setColors: function(color1, color2, color3) {
        this.colors = { color1, color2, color3 };
    },

    setIntensity: function(intensity) {
        this.intensity = intensity;
    }
}) : null;

class ParallaxBiomeManager {
    constructor() {
        this.scene = null;
        this.layers = [];
        this.config = null;
        this.isActive = false;
        this.scrollFactor = 0;
        this.currentBiomeId = 'nebula';
        this.biomeConfigs = biomeConfigs;

        // Particle emitters (GPU-accelerated)
        this.particleEmitters = {
            stars: null,
            dust: null,
            aurora: null,
            bubbles: null
        };

        // Shader pipeline
        this.nebulaShader = null;
        this.shaderEnabled = false;

        // Transition state
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionFrom = null;
        this.transitionTo = null;

        // Particle textures
        this.particleTextures = {};
    }

    /**
     * Initialize the parallax biome system
     */
    initialize(scene, biomeConfigOrId = null) {
        this.scene = scene;
        this.layers = [];

        // Handle biome ID string or config object
        if (typeof biomeConfigOrId === 'string') {
            this.currentBiomeId = biomeConfigOrId;
            this.config = this.loadBiomeConfig(biomeConfigOrId);
        } else if (biomeConfigOrId && typeof biomeConfigOrId === 'object') {
            this.config = biomeConfigOrId;
            this.currentBiomeId = biomeConfigOrId.id || 'custom';
        } else {
            const sceneBiome = scene?.currentBiome || 'nebula';
            this.currentBiomeId = sceneBiome;
            this.config = this.loadBiomeConfig(sceneBiome);
        }

        // Generate particle textures
        this.createParticleTextures();

        // Initialize shader if WebGL available
        this.initializeShader();

        console.log(`biome:info [ParallaxBiome] Initializing enhanced biome: ${this.currentBiomeId}`);
    }

    /**
     * Create particle textures for emitters
     */
    createParticleTextures() {
        // Guard: Skip if scene or textures not available yet
        if (!this.scene || !this.scene.textures) {
            console.log('[ParallaxBiome] Deferring particle texture creation - no scene available');
            return;
        }

        const textures = this.scene.textures;

        // Star particle (small glowing circle)
        if (!textures.exists('particle_star')) {
            const starGraphics = this.scene.make.graphics({ add: false });
            starGraphics.fillStyle(0xFFFFFF, 1);
            starGraphics.fillCircle(8, 8, 6);
            starGraphics.fillStyle(0xFFFFFF, 0.5);
            starGraphics.fillCircle(8, 8, 8);
            starGraphics.generateTexture('particle_star', 16, 16);
            starGraphics.destroy();
        }

        // Dust particle (soft glow)
        if (!textures.exists('particle_dust')) {
            const dustGraphics = this.scene.make.graphics({ add: false });
            dustGraphics.fillStyle(0xFFFFFF, 0.8);
            dustGraphics.fillCircle(6, 6, 4);
            dustGraphics.fillStyle(0xFFFFFF, 0.3);
            dustGraphics.fillCircle(6, 6, 6);
            dustGraphics.generateTexture('particle_dust', 12, 12);
            dustGraphics.destroy();
        }

        // Aurora particle (elongated glow)
        if (!textures.exists('particle_aurora')) {
            const auroraGraphics = this.scene.make.graphics({ add: false });
            auroraGraphics.fillStyle(0xFFFFFF, 0.6);
            auroraGraphics.fillEllipse(16, 8, 28, 8);
            auroraGraphics.fillStyle(0xFFFFFF, 0.3);
            auroraGraphics.fillEllipse(16, 8, 32, 12);
            auroraGraphics.generateTexture('particle_aurora', 32, 16);
            auroraGraphics.destroy();
        }

        // Bubble particle
        if (!textures.exists('particle_bubble')) {
            const bubbleGraphics = this.scene.make.graphics({ add: false });
            bubbleGraphics.lineStyle(1, 0xFFFFFF, 0.8);
            bubbleGraphics.strokeCircle(8, 8, 6);
            bubbleGraphics.fillStyle(0xFFFFFF, 0.2);
            bubbleGraphics.fillCircle(6, 6, 2);
            bubbleGraphics.generateTexture('particle_bubble', 16, 16);
            bubbleGraphics.destroy();
        }

        // Crystal particle (diamond shape)
        if (!textures.exists('particle_crystal')) {
            const crystalGraphics = this.scene.make.graphics({ add: false });
            crystalGraphics.fillStyle(0xFFFFFF, 0.9);
            crystalGraphics.fillTriangle(8, 0, 0, 8, 8, 16);
            crystalGraphics.fillTriangle(8, 0, 16, 8, 8, 16);
            crystalGraphics.fillStyle(0xFFFFFF, 0.5);
            crystalGraphics.fillTriangle(8, 2, 2, 8, 8, 14);
            crystalGraphics.generateTexture('particle_crystal', 16, 16);
            crystalGraphics.destroy();
        }

        // Void particle (dark with purple edge)
        if (!textures.exists('particle_void')) {
            const voidGraphics = this.scene.make.graphics({ add: false });
            voidGraphics.fillStyle(0x4B0082, 0.8);
            voidGraphics.fillCircle(8, 8, 8);
            voidGraphics.fillStyle(0x000000, 0.9);
            voidGraphics.fillCircle(8, 8, 5);
            voidGraphics.generateTexture('particle_void', 16, 16);
            voidGraphics.destroy();
        }

        console.log('biome:debug [ParallaxBiome] Particle textures created');
    }

    /**
     * Initialize WebGL shader pipeline
     */
    initializeShader() {
        // Guard: Skip if scene not available yet
        if (!this.scene || !this.scene.renderer) {
            return;
        }

        if (this.scene.renderer.type !== Phaser.WEBGL) {
            console.log('biome:info [ParallaxBiome] WebGL not available, using fallback rendering');
            return;
        }

        try {
            if (NebulaShaderPipeline && !this.scene.renderer.pipelines.has('NebulaShader')) {
                this.scene.renderer.pipelines.addPostPipeline('NebulaShader', NebulaShaderPipeline);
            }
            this.shaderEnabled = true;
            console.log('biome:info [ParallaxBiome] Nebula shader pipeline initialized');
        } catch (error) {
            console.warn('biome:warn [ParallaxBiome] Failed to initialize shader:', error.message);
            this.shaderEnabled = false;
        }
    }

    /**
     * Load biome configuration by ID
     */
    loadBiomeConfig(biomeId) {
        const biomeConfig = this.biomeConfigs[biomeId];

        if (!biomeConfig) {
            console.warn(`biome:warn [ParallaxBiome] Unknown biome "${biomeId}", falling back to nebula`);
            return this.convertToPaletteConfig(this.biomeConfigs['nebula'] || this.getDefaultConfig());
        }

        return this.convertToPaletteConfig(biomeConfig);
    }

    /**
     * Convert hex color to RGB array (0-1 range)
     */
    hexToRgb(hex) {
        const color = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
        return [
            ((color >> 16) & 0xFF) / 255,
            ((color >> 8) & 0xFF) / 255,
            (color & 0xFF) / 255
        ];
    }

    /**
     * Convert JSON config to runtime palette config
     */
    convertToPaletteConfig(jsonConfig) {
        const hexToInt = (hex) => {
            if (typeof hex === 'number') return hex;
            if (typeof hex === 'string') {
                return parseInt(hex.replace('#', ''), 16);
            }
            return 0xFFFFFF;
        };

        const palette = jsonConfig.palette || {};

        return {
            name: jsonConfig.name || jsonConfig.id || 'Unknown',
            id: jsonConfig.id,
            palette: {
                skyTop: hexToInt(palette.skyTop) || 0xB39DDB,
                skyBottom: hexToInt(palette.skyBottom) || 0x80CBC4,
                nebula: hexToInt(palette.nebula) || 0xF48FB1,
                stars: 0xFFFFFF,
                floatingRocks: hexToInt(palette.rocks) || 0x90A4AE,
                crystalFlora: hexToInt(palette.flora) || 0x64B5F6,
                accent: hexToInt(palette.accent) || 0xFFD54F,
                biolume: hexToInt(palette.accent) || 0xFFD54F,
                dust: 0xE1F5FE,
                vignette: 0x37474F
            },
            layers: this.getLayerConfig(jsonConfig),
            effects: {
                enableTwinkling: true,
                enableBioluminescence: jsonConfig.layers?.crystalFlora?.bioluminescence || false,
                enableGentleFloat: true,
                enableDustDrift: true,
                enableShader: true,
                vignette: {
                    enabled: true,
                    intensity: 0.1,
                    radius: 0.8
                }
            },
            performance: {
                maxLayers: 5,
                particleLimit: 500, // Increased from 60
                enableAnimations: true
            },
            enemies: jsonConfig.enemies,
            collectibles: jsonConfig.collectibles,
            ambientEffects: jsonConfig.ambientEffects
        };
    }

    /**
     * Get layer configuration from biome config
     */
    getLayerConfig(jsonConfig) {
        const layers = jsonConfig.layers || {};

        return {
            nebulaBackground: {
                parallax: layers.nebulaBackground?.scrollFactor || 0.1,
                alpha: layers.nebulaBackground?.opacity || 0.6,
                animate: true,
                speed: 0.3,
                colors: layers.nebulaBackground?.colors || []
            },
            distantStars: {
                parallax: layers.distantStars?.scrollFactor || 0.15,
                alpha: 0.8,
                animate: true,
                speed: 0.1,
                count: (layers.distantStars?.count || 25) * 4, // 4x more stars
                colors: layers.distantStars?.colors || []
            },
            floatingRocks: {
                parallax: layers.floatingRocks?.scrollFactor || 0.3,
                alpha: 0.7,
                animate: true,
                speed: 0.5,
                count: layers.floatingRocks?.count || 8,
                colors: layers.floatingRocks?.colors || []
            },
            crystalFlora: {
                parallax: layers.crystalFlora?.scrollFactor || 0.6,
                alpha: 0.9,
                animate: true,
                speed: 0.2,
                count: layers.crystalFlora?.count || 12,
                colors: layers.crystalFlora?.colors || []
            },
            foregroundDust: {
                parallax: layers.foregroundDust?.scrollFactor || 0.8,
                alpha: 0.4,
                animate: true,
                speed: 1.2,
                count: (layers.foregroundDust?.count || 15) * 5, // 5x more dust
                colors: layers.foregroundDust?.colors || []
            }
        };
    }

    /**
     * Get available biome IDs
     */
    getAvailableBiomes() {
        return Object.keys(this.biomeConfigs);
    }

    /**
     * Get biome info by ID
     */
    getBiomeInfo(biomeId) {
        const config = this.biomeConfigs[biomeId];
        if (!config) return null;

        return {
            id: biomeId,
            name: config.name,
            description: config.description,
            unlockCost: config.unlockCost || 0
        };
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            id: 'nebula',
            name: 'Cosmic Crash Site',
            palette: {
                skyTop: 0xB39DDB,
                skyBottom: 0x80CBC4,
                nebula: 0xF48FB1,
                stars: 0xFFFFFF,
                floatingRocks: 0x90A4AE,
                crystalFlora: 0x64B5F6,
                biolume: 0xFFD54F,
                dust: 0xE1F5FE,
                vignette: 0x37474F
            }
        };
    }

    /**
     * Create the complete biome with enhanced effects
     */
    createBiome() {
        if (this.isActive) {
            this.cleanup();
        }

        this.isActive = true;
        console.log(`biome:info [ParallaxBiome] Creating enhanced biome: ${this.currentBiomeId}`);

        // Layer 1: Gradient background with shader
        this.createNebulaBackground();

        // Layer 2: Particle-based stars (GPU accelerated)
        this.createStarParticles();

        // Layer 3: Floating rock silhouettes
        this.createFloatingRocks();

        // Layer 4: Biome-specific ambient particles
        this.createAmbientParticles();

        // Layer 5: Crystal flora with bioluminescence
        this.createCrystalFlora();

        // Layer 6: Foreground dust particles
        this.createDustParticles();

        // Optional: Subtle vignette
        if (this.config.effects.vignette.enabled) {
            this.createGentleVignette();
        }

        // Apply nebula shader to camera
        this.applyNebulaShader();

        console.log(`biome:info [ParallaxBiome] Biome '${this.config.name}' created with ${this.layers.length} layers + particle systems`);
    }

    /**
     * Layer 1: Create nebula background with animated gradient
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
        nebulaBg.fillRect(0, 0, width * 2, height);

        // Add nebula wisps with enhanced animation
        for (let i = 0; i < 5; i++) {
            const wisp = this.scene.add.graphics();
            wisp.fillStyle(this.config.palette.nebula, 0.15 + i * 0.03);

            const centerX = width * (0.1 + i * 0.2);
            const centerY = height * (0.2 + (i % 3) * 0.25);
            const size = 150 + i * 40;

            wisp.fillEllipse(centerX, centerY, size, size * 0.6);

            if (layer.animate) {
                this.scene.tweens.add({
                    targets: wisp,
                    x: wisp.x + 30,
                    y: wisp.y + 15,
                    alpha: { from: 0.1, to: 0.25 },
                    scaleX: { from: 1, to: 1.1 },
                    scaleY: { from: 1, to: 1.05 },
                    duration: 10000 + i * 3000,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 1500
                });
            }

            wisp.setScrollFactor(layer.parallax);
            wisp.setDepth(-100 + i);
            this.layers.push({ type: 'nebula', object: wisp, config: layer });
        }

        nebulaBg.setScrollFactor(layer.parallax);
        nebulaBg.setAlpha(layer.alpha);
        nebulaBg.setDepth(-200);
        this.layers.push({ type: 'background', object: nebulaBg, config: layer });
    }

    /**
     * Layer 2: Create GPU-accelerated star particles
     */
    createStarParticles() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.distantStars;

        // Get biome-specific star colors
        const starColors = this.getStarColors();

        // Create particle emitter for stars
        const starEmitter = this.scene.add.particles(0, 0, 'particle_star', {
            x: { min: 0, max: width * 1.5 },
            y: { min: 0, max: height * 0.8 },
            scale: { min: 0.2, max: 0.8 },
            alpha: { start: 0.3, end: 1, ease: 'Sine.easeInOut' },
            tint: starColors,
            lifespan: { min: 3000, max: 6000 },
            frequency: 100,
            quantity: 2,
            blendMode: 'ADD',
            emitting: true
        });

        starEmitter.setScrollFactor(layer.parallax);
        starEmitter.setDepth(-50);

        this.particleEmitters.stars = starEmitter;
        this.layers.push({ type: 'starEmitter', object: starEmitter, config: layer });

        // Also create static stars for instant density
        for (let i = 0; i < layer.count / 2; i++) {
            const star = this.scene.add.graphics();
            const color = Phaser.Math.RND.pick(starColors);
            star.fillStyle(color, 0.9);

            const size = Phaser.Math.FloatBetween(0.5, 2.0);
            star.fillCircle(0, 0, size);

            star.setPosition(
                Phaser.Math.Between(0, width * 1.5),
                Phaser.Math.Between(0, height * 0.7)
            );

            // Twinkling animation
            if (this.config.effects.enableTwinkling) {
                this.scene.tweens.add({
                    targets: star,
                    alpha: { from: 0.3, to: 1.0 },
                    scale: { from: 0.8, to: 1.3 },
                    duration: Phaser.Math.Between(1500, 4000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 100
                });
            }

            star.setScrollFactor(layer.parallax);
            star.setDepth(-45);
            this.layers.push({ type: 'star', object: star, config: layer });
        }
    }

    /**
     * Get biome-specific star colors
     */
    getStarColors() {
        switch (this.currentBiomeId) {
            case 'stellar_reef':
                return [0xE0F7FA, 0xB2EBF2, 0x80DEEA, 0x4DD0E1];
            case 'crystal_caves':
                // Dim, sparse glowing spots in dark cave - like distant crystals
                return [0x7B68EE, 0x9370DB, 0x483D8B, 0x5A4A8A];
            case 'void_peaks':
                return [0xFF4500, 0xDC143C, 0x8B0000, 0x4B0082];
            case 'aurora_depths':
                return [0x7FFFD4, 0x00FA9A, 0x00FF7F, 0xFFD700];
            default:
                return [0xFFFFFF, 0xCCCCFF, 0xFFCCFF, 0xCCFFFF];
        }
    }

    /**
     * Layer 3: Create floating rock silhouettes
     */
    createFloatingRocks() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.floatingRocks;

        for (let i = 0; i < layer.count; i++) {
            const rock = this.scene.add.graphics();
            rock.fillStyle(this.config.palette.floatingRocks, 0.6);

            const baseSize = 40 + i * 15;
            rock.fillEllipse(0, 0, baseSize, baseSize * 0.7);
            rock.fillEllipse(baseSize * 0.3, -baseSize * 0.2, baseSize * 0.6, baseSize * 0.4);

            // Add crystal accents on some rocks
            if (i % 2 === 0) {
                rock.fillStyle(this.config.palette.accent, 0.4);
                rock.fillTriangle(
                    -baseSize * 0.2, -baseSize * 0.3,
                    baseSize * 0.1, -baseSize * 0.3,
                    -baseSize * 0.05, -baseSize * 0.6
                );
            }

            rock.setPosition(
                Phaser.Math.Between(100, width + 200),
                Phaser.Math.Between(height * 0.2, height * 0.8)
            );

            if (layer.animate && this.config.effects.enableGentleFloat) {
                this.scene.tweens.add({
                    targets: rock,
                    y: rock.y + Phaser.Math.Between(-20, 20),
                    x: rock.x + Phaser.Math.Between(-15, 15),
                    rotation: Phaser.Math.FloatBetween(-0.1, 0.1),
                    duration: Phaser.Math.Between(5000, 9000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 600
                });
            }

            rock.setScrollFactor(layer.parallax);
            rock.setAlpha(layer.alpha);
            rock.setDepth(-30 + i);
            this.layers.push({ type: 'rock', object: rock, config: layer });
        }
    }

    /**
     * Layer 4: Create biome-specific ambient particles
     */
    createAmbientParticles() {
        const { width, height } = this.scene.cameras.main;

        switch (this.currentBiomeId) {
            case 'stellar_reef':
                this.createBubbleParticles(width, height);
                break;
            case 'crystal_caves':
                this.createCrystalParticles(width, height);
                break;
            case 'void_peaks':
                this.createVoidParticles(width, height);
                break;
            case 'aurora_depths':
                this.createAuroraParticles(width, height);
                break;
            default:
                // Nebula has default dust only
                break;
        }
    }

    /**
     * Create bubble particles for Stellar Reef
     */
    createBubbleParticles(width, height) {
        const bubbleEmitter = this.scene.add.particles(0, 0, 'particle_bubble', {
            x: { min: 0, max: width * 1.5 },
            y: height + 20,
            speedY: { min: -30, max: -80 },
            speedX: { min: -10, max: 10 },
            scale: { min: 0.3, max: 1.0 },
            alpha: { start: 0.6, end: 0 },
            tint: [0xE0F7FA, 0xB2EBF2, 0xFFFFFF],
            lifespan: { min: 4000, max: 8000 },
            frequency: 150,
            quantity: 1,
            emitting: true
        });

        bubbleEmitter.setScrollFactor(0.5);
        bubbleEmitter.setDepth(-20);
        this.particleEmitters.bubbles = bubbleEmitter;
        this.layers.push({ type: 'bubbleEmitter', object: bubbleEmitter, config: { parallax: 0.5 } });
    }

    /**
     * Create crystal particles for Crystal Caves
     */
    createCrystalParticles(width, height) {
        const crystalEmitter = this.scene.add.particles(0, 0, 'particle_crystal', {
            x: { min: 0, max: width * 1.5 },
            y: { min: 0, max: height },
            speedY: { min: 5, max: 20 },
            speedX: { min: -5, max: 5 },
            rotate: { min: 0, max: 360 },
            scale: { min: 0.2, max: 0.6 },
            alpha: { start: 0.8, end: 0.2 },
            tint: [0x00FFFF, 0x7B68EE, 0xE040FB, 0x9370DB],
            lifespan: { min: 5000, max: 10000 },
            frequency: 200,
            quantity: 1,
            blendMode: 'ADD',
            emitting: true
        });

        crystalEmitter.setScrollFactor(0.6);
        crystalEmitter.setDepth(-20);
        this.layers.push({ type: 'crystalEmitter', object: crystalEmitter, config: { parallax: 0.6 } });
    }

    /**
     * Create void particles for Void Peaks
     */
    createVoidParticles(width, height) {
        const voidEmitter = this.scene.add.particles(0, 0, 'particle_void', {
            x: { min: 0, max: width * 1.5 },
            y: { min: 0, max: height },
            speedY: { min: -10, max: 10 },
            speedX: { min: -20, max: 20 },
            scale: { start: 0.5, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            tint: [0x4B0082, 0x8B008B, 0xFF4500],
            lifespan: { min: 2000, max: 4000 },
            frequency: 100,
            quantity: 2,
            emitting: true
        });

        voidEmitter.setScrollFactor(0.4);
        voidEmitter.setDepth(-20);
        this.layers.push({ type: 'voidEmitter', object: voidEmitter, config: { parallax: 0.4 } });
    }

    /**
     * Create aurora particles for Aurora Depths
     */
    createAuroraParticles(width, height) {
        const auroraEmitter = this.scene.add.particles(0, 0, 'particle_aurora', {
            x: { min: 0, max: width * 1.5 },
            y: { min: 50, max: height * 0.4 },
            speedY: { min: -5, max: 5 },
            speedX: { min: 10, max: 30 },
            scaleX: { min: 1, max: 3 },
            scaleY: { min: 0.3, max: 0.8 },
            alpha: { start: 0.5, end: 0 },
            tint: [0x00FF7F, 0x7FFFD4, 0x40E0D0, 0xFFD700],
            lifespan: { min: 3000, max: 6000 },
            frequency: 80,
            quantity: 1,
            blendMode: 'ADD',
            emitting: true
        });

        auroraEmitter.setScrollFactor(0.2);
        auroraEmitter.setDepth(-15);
        this.particleEmitters.aurora = auroraEmitter;
        this.layers.push({ type: 'auroraEmitter', object: auroraEmitter, config: { parallax: 0.2 } });
    }

    /**
     * Layer 5: Create crystal flora with enhanced effects
     */
    createCrystalFlora() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.crystalFlora;

        for (let i = 0; i < layer.count; i++) {
            const flora = this.scene.add.graphics();

            const baseHeight = 30 + Phaser.Math.Between(10, 50);
            const baseWidth = 8 + Phaser.Math.Between(2, 12);

            // Stem with gradient effect
            flora.fillStyle(this.config.palette.crystalFlora, 0.7);
            flora.fillRect(-baseWidth/2, 0, baseWidth, baseHeight);

            // Crystal formations with glow
            flora.fillStyle(this.config.palette.biolume, 0.9);
            flora.fillTriangle(-baseWidth, -5, baseWidth, -5, 0, -baseHeight * 0.4);

            // Add glow halo
            flora.fillStyle(this.config.palette.biolume, 0.2);
            flora.fillCircle(0, -baseHeight * 0.2, baseWidth * 2);

            flora.setPosition(
                Phaser.Math.Between(50, width + 100),
                height - Phaser.Math.Between(10, 80)
            );

            // Sway animation
            if (layer.animate) {
                this.scene.tweens.add({
                    targets: flora,
                    rotation: Phaser.Math.FloatBetween(-0.08, 0.08),
                    duration: Phaser.Math.Between(2500, 4500),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 300
                });
            }

            // Bioluminescent pulse
            if (this.config.effects.enableBioluminescence) {
                this.scene.tweens.add({
                    targets: flora,
                    alpha: { from: 0.5, to: 1.0 },
                    duration: Phaser.Math.Between(1500, 3000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: i * 500
                });
            }

            flora.setScrollFactor(layer.parallax);
            flora.setDepth(-10 + i);
            this.layers.push({ type: 'flora', object: flora, config: layer });
        }
    }

    /**
     * Layer 6: Create GPU-accelerated dust particles
     */
    createDustParticles() {
        const { width, height } = this.scene.cameras.main;
        const layer = this.config.layers.foregroundDust;

        const dustColors = this.getDustColors();

        const dustEmitter = this.scene.add.particles(0, 0, 'particle_dust', {
            x: { min: -50, max: width * 1.5 },
            y: { min: 0, max: height },
            speedY: { min: -15, max: 15 },
            speedX: { min: -20, max: 20 },
            scale: { min: 0.2, max: 0.8 },
            alpha: { start: 0.6, end: 0.1 },
            tint: dustColors,
            lifespan: { min: 4000, max: 8000 },
            frequency: 50,
            quantity: 3,
            blendMode: 'ADD',
            emitting: true
        });

        dustEmitter.setScrollFactor(layer.parallax);
        dustEmitter.setDepth(5);

        this.particleEmitters.dust = dustEmitter;
        this.layers.push({ type: 'dustEmitter', object: dustEmitter, config: layer });
    }

    /**
     * Get biome-specific dust colors
     */
    getDustColors() {
        switch (this.currentBiomeId) {
            case 'stellar_reef':
                return [0xE0F7FA, 0x80DEEA, 0x00BCD4];
            case 'crystal_caves':
                // Darker, more muted dust for murky cave atmosphere
                return [0x4A3B5C, 0x2D1B3D, 0x1A0A20];
            case 'void_peaks':
                return [0x4B0082, 0x8B008B, 0xFF4500];
            case 'aurora_depths':
                return [0x00FF7F, 0x7FFFD4, 0xFFD700];
            default:
                return [0xE1F5FE, 0xB3E5FC, 0xFFCCFF];
        }
    }

    /**
     * Create subtle vignette effect
     */
    createGentleVignette() {
        const { width, height } = this.scene.cameras.main;
        const vignetteConfig = this.config.effects.vignette;

        const vignette = this.scene.add.graphics();

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.max(width, height) * 0.7;

        for (let i = 0; i < 5; i++) {
            const radius = maxRadius * (1 - i * 0.2);
            const alpha = vignetteConfig.intensity * (i * 0.2);

            vignette.fillStyle(this.config.palette.vignette, alpha);
            vignette.fillCircle(centerX, centerY, radius);
        }

        vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
        vignette.setScrollFactor(0);
        vignette.setDepth(1000);

        this.layers.push({ type: 'vignette', object: vignette, config: { parallax: 0 } });
    }

    /**
     * Apply nebula shader to camera
     */
    applyNebulaShader() {
        if (!this.shaderEnabled || !this.config.effects.enableShader) {
            return;
        }

        try {
            const camera = this.scene.cameras.main;
            camera.setPostPipeline('NebulaShader');

            const pipeline = camera.getPostPipeline('NebulaShader');
            if (pipeline) {
                // Set biome-specific nebula colors
                const nebulaColors = this.getShaderColors();
                pipeline.setColors(
                    nebulaColors.color1,
                    nebulaColors.color2,
                    nebulaColors.color3
                );
                pipeline.setIntensity(0.5);

                console.log('biome:info [ParallaxBiome] Nebula shader applied to camera');
            }
        } catch (error) {
            console.warn('biome:warn [ParallaxBiome] Failed to apply shader:', error.message);
        }
    }

    /**
     * Get shader colors based on biome
     */
    getShaderColors() {
        const colors = {
            nebula: {
                color1: [0.6, 0.2, 0.8],
                color2: [0.5, 0.8, 0.8],
                color3: [0.96, 0.56, 0.69]
            },
            stellar_reef: {
                color1: [0.05, 0.28, 0.56],
                color2: [0.0, 0.52, 0.56],
                color3: [0.0, 0.74, 0.83]
            },
            crystal_caves: {
                // Much darker, murkier cave atmosphere
                color1: [0.03, 0.02, 0.08],  // Very dark purple-black
                color2: [0.15, 0.08, 0.25],  // Dark purple
                color3: [0.3, 0.2, 0.5]       // Dim purple glow
            },
            void_peaks: {
                color1: [0.05, 0.05, 0.05],
                color2: [0.29, 0.0, 0.51],
                color3: [1.0, 0.27, 0.0]
            },
            aurora_depths: {
                color1: [0.04, 0.1, 0.18],
                color2: [0.0, 1.0, 0.5],
                color3: [1.0, 0.84, 0.0]
            }
        };

        return colors[this.currentBiomeId] || colors.nebula;
    }

    /**
     * Smooth transition to another biome
     * @param {string} targetBiomeId - The biome to transition to
     * @param {number} duration - Transition duration in ms
     */
    transitionToBiome(targetBiomeId, duration = 2000) {
        if (this.isTransitioning) {
            console.warn('biome:warn [ParallaxBiome] Transition already in progress');
            return;
        }

        if (targetBiomeId === this.currentBiomeId) {
            console.log('biome:info [ParallaxBiome] Already in target biome');
            return;
        }

        console.log(`biome:info [ParallaxBiome] Transitioning from ${this.currentBiomeId} to ${targetBiomeId}`);

        this.isTransitioning = true;
        this.transitionFrom = this.currentBiomeId;
        this.transitionTo = targetBiomeId;

        const startConfig = { ...this.config };
        const targetConfig = this.loadBiomeConfig(targetBiomeId);

        // Create transition overlay
        const { width, height } = this.scene.cameras.main;
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(2000);

        // Phase 1: Fade out (0-40%)
        this.scene.tweens.add({
            targets: overlay,
            fillAlpha: 0.8,
            duration: duration * 0.4,
            ease: 'Sine.easeIn',
            onComplete: () => {
                // Rebuild biome with new config
                this.currentBiomeId = targetBiomeId;
                this.config = targetConfig;
                this.cleanup();
                this.createBiome();

                // Phase 2: Fade in (40-100%)
                this.scene.tweens.add({
                    targets: overlay,
                    fillAlpha: 0,
                    duration: duration * 0.6,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        overlay.destroy();
                        this.isTransitioning = false;
                        this.transitionFrom = null;
                        this.transitionTo = null;

                        console.log(`biome:info [ParallaxBiome] Transition to ${targetBiomeId} complete`);

                        // Emit transition complete event
                        this.scene.events.emit('biomeTransitionComplete', targetBiomeId);
                    }
                });
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
            case 'void_ripple':
                this.createVoidRipple(x, y, intensity);
                break;
        }
    }

    /**
     * Create enhanced stardust burst effect using particles
     */
    createStardustBurst(x, y, intensity) {
        const burstEmitter = this.scene.add.particles(x, y, 'particle_star', {
            speed: { min: 50 * intensity, max: 150 * intensity },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [this.config.palette.biolume, this.config.palette.accent, 0xFFFFFF],
            lifespan: 800,
            quantity: Math.floor(15 * intensity),
            blendMode: 'ADD',
            emitting: false
        });

        burstEmitter.explode();

        this.scene.time.delayedCall(1000, () => {
            burstEmitter.destroy();
        });
    }

    /**
     * Create aurora flash effect
     */
    createAuroraFlash(x, y, intensity) {
        const flash = this.scene.add.graphics();
        flash.fillStyle(this.config.palette.nebula, 0.5 * intensity);
        flash.fillCircle(x, y, 80 * intensity);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 700,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
    }

    /**
     * Create crystal resonance effect
     */
    createCrystalResonance(x, y, intensity) {
        this.layers.filter(layer => layer.type === 'flora').forEach(layer => {
            const flora = layer.object;
            const distance = Phaser.Math.Distance.Between(x, y, flora.x, flora.y);

            if (distance < 200) {
                const delay = distance * 2;
                this.scene.tweens.add({
                    targets: flora,
                    scaleX: 1.3,
                    scaleY: 1.3,
                    alpha: 1,
                    duration: 200,
                    ease: 'Back.easeOut',
                    delay: delay,
                    yoyo: true,
                    repeat: 1
                });
            }
        });
    }

    /**
     * Create void ripple effect (for Void Peaks)
     */
    createVoidRipple(x, y, intensity) {
        for (let i = 0; i < 3; i++) {
            const ring = this.scene.add.graphics();
            ring.lineStyle(3 - i, 0x4B0082, 0.8);
            ring.strokeCircle(x, y, 10);

            this.scene.tweens.add({
                targets: ring,
                scaleX: 3 + i,
                scaleY: 3 + i,
                alpha: 0,
                duration: 1000 + i * 200,
                ease: 'Sine.easeOut',
                delay: i * 150,
                onComplete: () => ring.destroy()
            });
        }
    }

    /**
     * Update parallax effect based on camera movement
     */
    updateParallax(deltaX = 0, deltaY = 0) {
        if (!this.isActive || !this.layers.length) return;

        this.layers.forEach(layer => {
            if (layer.config.parallax < 1.0 && layer.object && layer.object.setScrollFactor) {
                layer.object.setScrollFactor(layer.config.parallax, layer.config.parallax);
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
    }

    /**
     * Clean up all biome layers and particle emitters
     */
    cleanup() {
        // Destroy particle emitters
        Object.values(this.particleEmitters).forEach(emitter => {
            if (emitter && emitter.destroy) {
                emitter.destroy();
            }
        });
        this.particleEmitters = {
            stars: null,
            dust: null,
            aurora: null,
            bubbles: null
        };

        // Destroy layers
        this.layers.forEach(layer => {
            if (layer.object && layer.object.destroy) {
                layer.object.destroy();
            }
        });

        // Remove shader from camera
        if (this.shaderEnabled) {
            try {
                const camera = this.scene?.cameras?.main;
                if (camera) {
                    camera.removePostPipeline('NebulaShader');
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        this.layers = [];
        this.isActive = false;
        console.log('biome:info [ParallaxBiome] Biome layers and emitters cleaned up');
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

    /**
     * Get particle count across all emitters
     */
    getParticleCount() {
        let count = 0;
        Object.values(this.particleEmitters).forEach(emitter => {
            if (emitter && emitter.getParticleCount) {
                count += emitter.getParticleCount();
            }
        });
        return count;
    }

    /**
     * Check if currently transitioning
     */
    isInTransition() {
        return this.isTransitioning;
    }
}

// Create singleton instance
window.ParallaxBiome = window.ParallaxBiome || new ParallaxBiomeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParallaxBiomeManager;
}

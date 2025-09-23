const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

/**
 * HatchCinematics - Space-themed 8-beat cinematic sequence for egg hatching
 * Creates a magical "hero moment" with precise timing and space-fantasy effects
 */

class HatchCinematicsManager {
    constructor() {
        this.timeline = null;
        this.config = null;
        this.scene = null;
        this.assets = {};
        this.startTime = 0;
        this.currentBeat = 0;
    }

    /**
     * Initialize the space-themed cinematics system
     */
    initialize(config = null) {
        this.config = config || this.getDefaultConfig();
        console.log('cinematic:debug [HatchCinematics] Space-Mythic cinematics system initialized', this.config);
    }

    /**
     * Get default space-themed configuration
     */
    getDefaultConfig() {
        return {
            timings: {
                crack: 0.5,          // Beat 1: Cosmic energy crack
                glowPulse: 2.0,      // Beat 2: Nebula glow pulses
                particleLeak: 1.0,   // Beat 3: Stardust particles leak
                shellPop: 0.2,       // Beat 4: Shell breaks with stellar burst
                creatureBlink: 0.8,  // Beat 5: Space creature emerges
                traitCards: 1.2,     // Beat 6: Cosmic trait cards fan out
                nameInput: 0.6,      // Beat 7: Name input with aurora whoosh
                firstEmote: 0.4      // Beat 8: Happy stellar emote
            },
            effects: {
                crackLineWidth: 3,
                glowRadius: 70,
                glowIntensity: 0.7,
                particleCount: 18,
                particleSize: { min: 2, max: 4 },
                shakeAmplitude: 3,
                shakeDuration: 120,
                cardFanAngle: 50,
                cardSpacing: 90,
                cardSize: { width: 85, height: 65 }
            },
            colors: {
                crack: 0xF48FB1,       // Nebula Pink crack
                glow: 0xFFD54F,        // Star Gold glow
                particles: 0x80CBC4,   // Aurora Teal particles  
                cards: 0xB39DDB,       // Crystal Lilac cards
                cardBorder: 0x64B5F6,  // Comet Blue borders
                text: 0x37474F,        // Deep Ink text
                highlight: 0xFFFFFF    // Pure white highlights
            },
            sfx: {
                crack: 'space_crack',
                glow: 'nebula_pulse',
                pop: 'stellar_burst',
                blink: 'cosmic_chirp',
                cards: 'aurora_whoosh',
                whoosh: 'gentle_drift',
                emote: 'stellar_joy',
                volumes: {
                    crack: 0.4,
                    glow: 0.3,
                    pop: 0.7,
                    blink: 0.5,
                    cards: 0.4,
                    whoosh: 0.6,
                    emote: 0.8
                }
            },
            performance: {
                enableParticles: true,
                enableScreenshake: true,
                enableSounds: true,
                maxParticles: 25,
                particleLifetime: 2500
            },
            accessibility: {
                reduceMotion: false,
                skipCinematics: false,
                visualCuesOnly: false,
                audioDescriptions: false
            }
        };
    }

    /**
     * Play the complete space-themed hatch cinematic sequence
     */
    async play(scene, options = {}) {
        return new Promise((resolve) => {
            this.scene = scene;
            this.startTime = Date.now();
            this.currentBeat = 0;
            
            const config = { ...this.config, ...options };
            
            // Log sequence start with space theme
            this.logTelemetry('hatch/space_sequence_start', { 
                config,
                theme: 'spaceMythic'
            });

            // Create the 8-beat space timeline
            this.createSpaceTimeline(scene, config, resolve);
            
            console.log('cinematic:info [HatchCinematics] Starting 8-beat space-mythic hatch sequence');
        });
    }

    /**
     * Create the main space-themed timeline with all 8 beats
     */
    createSpaceTimeline(scene, config, resolve) {
        const { timings } = config;
        let currentTime = 0;

        // Beat 1: Cosmic energy crack (0.0-0.5s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 1;
            this.logTelemetry('hatch/phase_start', { phase: 'cosmic_crack', beat: 1, offset: currentTime });
            this.createCosmicCrack(scene, config);
            this.playSpaceSound(scene, config.sfx.crack);
        });
        currentTime += timings.crack;

        // Beat 2: Nebula glow pulses x2 (0.5-2.5s) 
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 2;
            this.logTelemetry('hatch/phase_start', { phase: 'nebula_glow', beat: 2, offset: currentTime });
            this.createNebulaGlow(scene, config);
            this.playSpaceSound(scene, config.sfx.glow);
        });
        currentTime += timings.glowPulse;

        // Beat 3: Stardust particles leak (2.5-3.5s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 3;
            this.logTelemetry('hatch/phase_start', { phase: 'stardust_leak', beat: 3, offset: currentTime });
            this.createStardustLeak(scene, config);
        });
        currentTime += timings.particleLeak;

        // Beat 4: Stellar burst + gentle screenshake (3.5-3.7s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 4;
            this.logTelemetry('hatch/phase_start', { phase: 'stellar_burst', beat: 4, offset: currentTime });
            this.createStellarBurst(scene, config);
            this.createGentleShake(scene, config);
            this.playSpaceSound(scene, config.sfx.pop);
        });
        currentTime += timings.shellPop;

        // Beat 5: Space creature emerges + cosmic chirp (3.7-4.5s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 5;
            this.logTelemetry('hatch/phase_start', { phase: 'creature_emerge', beat: 5, offset: currentTime });
            this.createCreatureEmergence(scene, config);
            this.playSpaceSound(scene, config.sfx.blink);
        });
        currentTime += timings.creatureBlink;

        // Beat 6: Cosmic trait cards fan-out (4.5-5.7s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 6;
            this.logTelemetry('hatch/phase_start', { phase: 'cosmic_traits', beat: 6, offset: currentTime });
            this.createCosmicTraitCards(scene, config);
            this.playSpaceSound(scene, config.sfx.cards);
        });
        currentTime += timings.traitCards;

        // Beat 7: Name input with aurora whoosh (5.7-6.3s)
        scene.time.delayedCall(currentTime * 1000, () => {
            this.currentBeat = 7;
            this.logTelemetry('hatch/phase_start', { phase: 'aurora_naming', beat: 7, offset: currentTime });
            this.createAuroraNamingPrompt(scene, config);
            this.playSpaceSound(scene, config.sfx.whoosh);
        });
        currentTime += timings.nameInput;

        // Beat 8: Stellar joy emote (6.3-6.7s) - triggered externally
        // This will be called when name is confirmed

        // Complete sequence
        scene.time.delayedCall((currentTime + timings.firstEmote) * 1000, () => {
            this.logTelemetry('hatch/space_sequence_complete', { 
                totalDuration: Date.now() - this.startTime,
                totalBeats: 8
            });
            console.log('cinematic:info [HatchCinematics] Space-Mythic sequence complete');
            resolve();
        });
    }

    /**
     * Beat 1: Create cosmic energy crack effect
     */
    createCosmicCrack(scene, config) {
        const crack = scene.add.graphics();
        crack.lineStyle(config.effects.crackLineWidth, config.colors.crack, 0.9);
        
        // Draw energy crack across the egg with space-like branching
        const eggX = scene.cameras.main.width / 2;
        const eggY = scene.cameras.main.height / 2;
        
        // Main crack line with cosmic energy
        crack.beginPath();
        crack.moveTo(eggX - 35, eggY - 15);
        crack.lineTo(eggX + 40, eggY + 20);
        crack.lineTo(eggX + 25, eggY + 30);
        crack.strokePath();
        
        // Energy branches
        crack.beginPath();
        crack.moveTo(eggX, eggY);
        crack.lineTo(eggX - 15, eggY - 25);
        crack.moveTo(eggX + 10, eggY + 5);
        crack.lineTo(eggX + 30, eggY - 10);
        crack.strokePath();
        
        // Cosmic energy glow
        const energyGlow = scene.add.graphics();
        energyGlow.lineStyle(config.effects.crackLineWidth + 2, config.colors.glow, 0.4);
        energyGlow.beginPath();
        energyGlow.moveTo(eggX - 35, eggY - 15);
        energyGlow.lineTo(eggX + 40, eggY + 20);
        energyGlow.strokePath();
        
        // Animate appearance with space energy
        crack.setAlpha(0);
        energyGlow.setAlpha(0);
        
        scene.tweens.add({
            targets: [crack, energyGlow],
            alpha: 1,
            duration: config.timings.crack * 1000,
            ease: 'Power2'
        });

        this.assets.crack = crack;
        this.assets.energyGlow = energyGlow;
    }

    /**
     * Beat 2: Create nebula glow pulse effect
     */
    createNebulaGlow(scene, config) {
        const eggX = scene.cameras.main.width / 2;
        const eggY = scene.cameras.main.height / 2;
        
        // Multi-layered nebula glow
        const baseGlow = scene.add.graphics();
        baseGlow.fillStyle(config.colors.glow, 0.3);
        baseGlow.fillCircle(0, 0, config.effects.glowRadius);
        baseGlow.setPosition(eggX, eggY);
        
        const outerGlow = scene.add.graphics();
        outerGlow.fillStyle(config.colors.particles, 0.2);
        outerGlow.fillCircle(0, 0, config.effects.glowRadius * 1.4);
        outerGlow.setPosition(eggX, eggY);
        
        // Nebula pulse animation - 2 cycles with space timing
        scene.tweens.add({
            targets: [baseGlow, outerGlow],
            scaleX: { from: 0.4, to: 1.3 },
            scaleY: { from: 0.4, to: 1.3 },
            alpha: { from: 0.1, to: config.effects.glowIntensity },
            duration: config.timings.glowPulse * 500, // Half duration per pulse
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: 1 // 2 total pulses
        });

        // Add twinkling stars around glow
        this.createTwinklingStars(scene, eggX, eggY, config);

        this.assets.baseGlow = baseGlow;
        this.assets.outerGlow = outerGlow;
    }

    /**
     * Beat 3: Create stardust particle leak effect
     */
    createStardustLeak(scene, config) {
        const eggX = scene.cameras.main.width / 2;
        const eggY = scene.cameras.main.height / 2;
        
        const particles = [];
        
        for (let i = 0; i < config.effects.particleCount; i++) {
            const particle = scene.add.graphics();
            const size = Phaser.Math.Between(config.effects.particleSize.min, config.effects.particleSize.max);
            
            // Create stardust particle with glow
            particle.fillStyle(config.colors.particles, 0.9);
            particle.fillCircle(0, 0, size);
            
            // Add subtle glow to each particle
            const particleGlow = scene.add.graphics();
            particleGlow.fillStyle(config.colors.particles, 0.3);
            particleGlow.fillCircle(0, 0, size * 2);
            
            const angle = (i / config.effects.particleCount) * Math.PI * 2;
            const startX = eggX + Math.cos(angle) * 25;
            const startY = eggY + Math.sin(angle) * 20;
            const endX = startX + Math.cos(angle) * 60 + Phaser.Math.Between(-20, 20);
            const endY = startY + Math.sin(angle) * 50 + Phaser.Math.Between(-15, 15);
            
            particle.setPosition(startX, startY);
            particleGlow.setPosition(startX, startY);
            particle.setAlpha(0);
            particleGlow.setAlpha(0);
            
            // Animate stardust leak with space physics
            scene.tweens.add({
                targets: [particle, particleGlow],
                x: endX,
                y: endY,
                alpha: { from: 0, to: 1, to: 0.2 },
                scale: { from: 0.3, to: 1.2, to: 0.8 },
                duration: config.timings.particleLeak * 1000,
                ease: 'Power2',
                delay: i * 35 // Stagger particles for space effect
            });
            
            particles.push(particle, particleGlow);
        }

        this.assets.particles = particles;
    }

    /**
     * Beat 4: Create stellar burst effect
     */
    createStellarBurst(scene, config) {
        const egg = scene.children.getByName('egg') || this.assets.egg;
        
        if (egg) {
            // Stellar burst scale effect
            scene.tweens.add({
                targets: egg,
                scaleX: { from: 1.0, to: 1.4, to: 1.1 },
                scaleY: { from: 1.0, to: 1.4, to: 1.1 },
                duration: config.timings.shellPop * 1000,
                ease: 'Back.easeOut'
            });

            // Stellar flash with multiple colors
            const flash = scene.add.graphics();
            flash.fillStyle(config.colors.glow, 0.8);
            flash.fillCircle(egg.x, egg.y, 80);
            
            scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: { from: 0.5, to: 2.0 },
                duration: config.timings.shellPop * 1000,
                ease: 'Power2',
                onComplete: () => flash.destroy()
            });
        }

        // Create burst particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(scene, scene.cameras.main.width / 2, scene.cameras.main.height / 2, {
                count: 12,
                color: config.colors.glow,
                scale: 0.8,
                duration: 600
            });
        }
    }

    /**
     * Beat 4: Create gentle space screenshake
     */
    createGentleShake(scene, config) {
        if (!config.performance.enableScreenshake || config.accessibility.reduceMotion) {
            return;
        }

        const camera = scene.cameras.main;
        const amplitude = Math.min(config.effects.shakeAmplitude, 3); // Max 3px for comfort
        
        // Gentle cosmic rumble
        scene.tweens.add({
            targets: camera,
            x: { from: 0, to: amplitude, to: -amplitude, to: 0 },
            y: { from: 0, to: amplitude * 0.7, to: -amplitude * 0.7, to: 0 },
            duration: config.effects.shakeDuration,
            ease: 'Sine.easeInOut',
            repeat: 1
        });
    }

    /**
     * Beat 5: Create space creature emergence
     */
    createCreatureEmergence(scene, config) {
        const creature = scene.children.getByName('creature') || this.assets.creature;
        
        if (creature) {
            // Magical emergence from stardust
            creature.setAlpha(0);
            creature.setTint(config.colors.particles);
            
            scene.tweens.add({
                targets: creature,
                alpha: 1,
                scale: { from: 0.8, to: 1.2 },
                duration: config.timings.creatureBlink * 600,
                ease: 'Back.easeOut'
            });

            // Clear tint to show true colors
            scene.tweens.add({
                targets: creature,
                duration: config.timings.creatureBlink * 400,
                delay: config.timings.creatureBlink * 300,
                onUpdate: (tween) => {
                    const progress = tween.progress;
                    const tintValue = Phaser.Display.Color.Interpolate.ColorWithColor(
                        Phaser.Display.Color.ValueToColor(config.colors.particles),
                        Phaser.Display.Color.ValueToColor(0xFFFFFF),
                        1,
                        progress
                    );
                    creature.setTint(Phaser.Display.Color.GetColor(tintValue.r, tintValue.g, tintValue.b));
                }
            });

            // Cosmic blink effect
            scene.time.delayedCall(config.timings.creatureBlink * 500, () => {
                scene.tweens.add({
                    targets: creature,
                    alpha: { from: 1, to: 0.4, to: 1 },
                    duration: 200,
                    ease: 'Power2',
                    repeat: 1
                });
            });
        }

        // Add emergence sparkles
        this.createEmergenceSparkles(scene, config);
    }

    /**
     * Beat 6: Create cosmic trait cards fan-out
     */
    createCosmicTraitCards(scene, config) {
        const centerX = scene.cameras.main.width / 2 + 180;
        const centerY = scene.cameras.main.height / 2;
        
        // Get creature data for space traits
        const creatureData = window.GameState ? window.GameState.get('creature') : {};
        const spaceTraits = [
            { title: 'Origin', value: creatureData.genes?.size || 'Stellar', icon: '⭐' },
            { title: 'Energy', value: creatureData.genes?.pattern || 'Cosmic', icon: '✨' },
            { title: 'Spirit', value: creatureData.genes?.temperament || 'Peaceful', icon: '🌟' }
        ];

        const cards = [];
        
        spaceTraits.forEach((trait, index) => {
            // Create glassmorphism card
            const card = scene.add.graphics();
            card.fillStyle(config.colors.cards, 0.2);
            card.fillRoundedRect(-config.effects.cardSize.width/2, -config.effects.cardSize.height/2, 
                               config.effects.cardSize.width, config.effects.cardSize.height, 12);
            
            // Cosmic border with glow
            card.lineStyle(2, config.colors.cardBorder, 0.8);
            card.strokeRoundedRect(-config.effects.cardSize.width/2, -config.effects.cardSize.height/2,
                                 config.effects.cardSize.width, config.effects.cardSize.height, 12);
            
            // Inner highlight
            card.lineStyle(1, config.colors.highlight, 0.3);
            card.strokeRoundedRect(-config.effects.cardSize.width/2 + 2, -config.effects.cardSize.height/2 + 2,
                                 config.effects.cardSize.width - 4, config.effects.cardSize.height - 4, 10);
            
            // Space-themed trait content
            const iconText = scene.add.text(0, -15, trait.icon, {
                fontSize: '18px',
                align: 'center'
            }).setOrigin(0.5);
            
            const titleText = scene.add.text(0, 0, trait.title, {
                fontSize: '12px',
                color: '#64B5F6',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5);
            
            const valueText = scene.add.text(0, 15, trait.value, {
                fontSize: '10px',
                color: '#B39DDB',
                fontFamily: 'Arial, sans-serif',
                align: 'center'
            }).setOrigin(0.5);
            
            // Group card elements
            const cardContainer = scene.add.container(centerX, centerY);
            cardContainer.add([card, iconText, titleText, valueText]);
            cardContainer.setAlpha(0);
            cardContainer.setScale(0.1);
            
            // Accessibility
            cardContainer.setData('ariaLabel', `Space trait: ${trait.title} is ${trait.value}`);
            
            // Calculate cosmic fan position
            const angle = (index - 1) * config.effects.cardFanAngle;
            const radians = Phaser.Math.DegToRad(angle);
            const targetX = centerX + Math.cos(radians) * config.effects.cardSpacing;
            const targetY = centerY + Math.sin(radians) * 35;
            
            // Animate cosmic card into position
            scene.tweens.add({
                targets: cardContainer,
                x: targetX,
                y: targetY,
                alpha: 1,
                scale: 1,
                rotation: radians * 0.2,
                duration: config.timings.traitCards * 1000,
                ease: 'Back.easeOut',
                delay: index * 150
            });
            
            cards.push(cardContainer);
        });

        this.assets.cosmicTraitCards = cards;
    }

    /**
     * Beat 7: Create aurora naming prompt with gentle descent
     */
    createAuroraNamingPrompt(scene, config) {
        const promptContainer = scene.add.container(scene.cameras.main.width / 2, -60);
        
        // Aurora-like background glow
        const auroraGlow = scene.add.graphics();
        auroraGlow.fillGradientStyle(config.colors.particles, config.colors.glow, config.colors.particles, config.colors.glow, 0.3);
        auroraGlow.fillRoundedRect(-180, -30, 360, 60, 20);
        
        const promptText = scene.add.text(0, 0, '✨ Name Your Stellar Companion! ✨', {
            fontSize: '22px',
            color: '#FFD54F',
            stroke: '#37474F',
            strokeThickness: 2,
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        
        promptContainer.add([auroraGlow, promptText]);
        
        // Accessibility
        promptContainer.setData('ariaLabel', 'Ready to name your space companion');
        promptContainer.setData('role', 'alert');
        
        // Gentle aurora descent with cozy whoosh
        scene.tweens.add({
            targets: promptContainer,
            y: 90,
            alpha: { from: 0, to: 1 },
            duration: config.timings.nameInput * 1000,
            ease: 'Back.easeOut'
        });

        // Add gentle floating animation
        scene.tweens.add({
            targets: promptContainer,
            y: promptContainer.y + 5,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: config.timings.nameInput * 1000
        });

        this.assets.auroraPrompt = promptContainer;
    }

    /**
     * Beat 8: Trigger stellar joy emote (called externally)
     */
    triggerStellarJoyEmote(scene, config = null) {
        const effectConfig = config || this.config;
        
        this.currentBeat = 8;
        this.logTelemetry('hatch/phase_start', { 
            phase: 'stellar_joy', 
            beat: 8,
            offset: (Date.now() - this.startTime) / 1000 
        });

        const creature = scene.children.getByName('creature') || this.assets.creature;
        
        if (creature) {
            // Stellar joy bounce with stardust
            scene.tweens.add({
                targets: creature,
                scaleY: { from: 1.0, to: 1.3, to: 1.0 },
                y: creature.y - 25,
                duration: effectConfig.timings.firstEmote * 1000,
                ease: 'Back.easeOut',
                yoyo: true
            });

            // Add joy sparkles
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(scene, creature.x, creature.y, {
                    count: 8,
                    color: effectConfig.colors.glow,
                    scale: 0.6,
                    duration: 800
                });
            }

            this.playSpaceSound(scene, effectConfig.sfx.emote);
        }

        console.log('cinematic:debug [HatchCinematics] Stellar joy emote triggered');
    }

    /**
     * Create twinkling stars around glow effect
     */
    createTwinklingStars(scene, centerX, centerY, config) {
        for (let i = 0; i < 6; i++) {
            const star = scene.add.graphics();
            star.fillStyle(config.colors.highlight, 0.8);
            star.fillCircle(0, 0, 1);
            
            const angle = (i / 6) * Math.PI * 2;
            const distance = config.effects.glowRadius * 1.8;
            star.setPosition(
                centerX + Math.cos(angle) * distance,
                centerY + Math.sin(angle) * distance
            );
            
            // Twinkling animation
            scene.tweens.add({
                targets: star,
                alpha: { from: 0.3, to: 1 },
                scale: { from: 0.5, to: 1.5 },
                duration: Phaser.Math.Between(800, 1200),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: i * 200
            });
        }
    }

    /**
     * Create sparkles for creature emergence
     */
    createEmergenceSparkles(scene, config) {
        const centerX = scene.cameras.main.width / 2;
        const centerY = scene.cameras.main.height / 2;
        
        for (let i = 0; i < 8; i++) {
            const sparkle = scene.add.graphics();
            sparkle.fillStyle(config.colors.glow, 0.9);
            sparkle.fillCircle(0, 0, 2);
            
            sparkle.setPosition(
                centerX + Phaser.Math.Between(-50, 50),
                centerY + Phaser.Math.Between(-40, 40)
            );
            
            scene.tweens.add({
                targets: sparkle,
                alpha: { from: 0, to: 1, to: 0 },
                scale: { from: 0.3, to: 1.2 },
                y: sparkle.y - 30,
                duration: 1000,
                ease: 'Power2',
                delay: i * 100,
                onComplete: () => sparkle.destroy()
            });
        }
    }

    /**
     * Play space-themed sound effect
     */
    playSpaceSound(scene, soundKey) {
        try {
            if (scene.sound && scene.sound.play && this.config.performance.enableSounds) {
                const volume = this.config.sfx.volumes[soundKey.split('_')[1]] || 0.5;
                scene.sound.play(soundKey, { volume });
            }
        } catch (error) {
            console.log(`cinematic:debug [HatchCinematics] Space sound '${soundKey}' not available:`, error.message);
        }
    }

    /**
     * Log telemetry event with space theme context
     */
    logTelemetry(event, data = {}) {
        const telemetryData = {
            event,
            timestamp: Date.now(),
            offset: (Date.now() - this.startTime) / 1000,
            beat: this.currentBeat,
            theme: 'spaceMythic',
            ...data
        };

        console.log(`cinematic:debug [HatchCinematics] ${event}`, telemetryData);
        
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('telemetry/hatch_cinematic', telemetryData);
            
            // Store last played timestamp
            if (event === 'hatch/space_sequence_start') {
                window.GameState.set('hatch.lastPlayedAt', Date.now());
            }
        }
    }

    /**
     * Clean up cinematic assets
     */
    cleanup() {
        Object.values(this.assets).forEach(asset => {
            if (Array.isArray(asset)) {
                asset.forEach(item => item.destroy && item.destroy());
            } else if (asset && asset.destroy) {
                asset.destroy();
            }
        });

        this.assets = {};
        this.scene = null;
        this.currentBeat = 0;
        console.log('cinematic:debug [HatchCinematics] Space-mythic assets cleaned up');
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
}

// Create singleton instance
window.HatchCinematics = window.HatchCinematics || new HatchCinematicsManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HatchCinematicsManager;
}

/**
 * CreatureAnimationController - State-driven idle animation system
 * Creates lively, personality-influenced creature behaviors based on stats and traits
 *
 * Enhanced with:
 * - Emotion particle effects (via FXLibrary)
 * - Movement pattern modifiers based on emotional state
 * - Thought bubble trigger callbacks
 */

class CreatureAnimationController {
    constructor(scene, creatureSprite, genetics) {
        this.scene = scene;
        this.sprite = creatureSprite;
        this.genetics = genetics;
        this.currentState = 'idle';
        this.isDestroyed = false;

        // Get personality from genetics
        this.personality = genetics?.personality?.core || 'curious';

        // Determine lifecycle stage
        this.stage = this.determineStage();

        // Store original transform values
        this.baseX = creatureSprite?.x || 0;
        this.baseY = creatureSprite?.y || 0;
        this.baseScaleX = creatureSprite?.scaleX || 1;
        this.baseScaleY = creatureSprite?.scaleY || 1;

        // Active tweens reference for cleanup
        this.activeTweens = [];
        this.breathTween = null;
        this.behaviorCheckTimer = null;
        this.randomBehaviorTimer = null;

        // Emotion state tracking
        this.currentEmotion = 'content';
        this.emotionIntensity = 0.5; // 0-1 scale
        this.lastEmotionParticleTime = 0;
        this.emotionParticleCooldown = 5000; // 5 seconds between particle bursts

        // Thought bubble callback (set by scene)
        this.onThoughtBubble = null;
        this.lastThoughtTime = 0;
        this.thoughtCooldown = 15000; // 15 seconds between thoughts

        // Initialize
        this.initializeAnimations();
    }

    /**
     * Determine creature's lifecycle stage from GameState
     */
    determineStage() {
        const daysSinceHatch = window.GameState?.get('creature.lifecycle.daysAlive') ||
                               window.GameState?.get('creature.daysSinceHatch') || 0;
        if (daysSinceHatch < 3) return 'baby';
        if (daysSinceHatch < 7) return 'juvenile';
        if (daysSinceHatch < 30) return 'adult';
        return 'elder';
    }

    /**
     * Initialize all animation systems
     */
    initializeAnimations() {
        if (!this.sprite || !this.scene) {
            console.warn('[CreatureAnimationController] Missing sprite or scene');
            return;
        }

        // Start base breathing animation (always active)
        this.startBreathing();

        // Set up periodic behavior checks based on stats
        this.behaviorCheckTimer = this.scene.time.addEvent({
            delay: 3000,
            callback: () => this.checkForStateBehavior(),
            loop: true
        });

        // Set up random personality-driven behaviors
        const randomDelay = 8000 + Math.random() * 7000;
        this.randomBehaviorTimer = this.scene.time.addEvent({
            delay: randomDelay,
            callback: () => this.triggerRandomBehavior(),
            loop: true
        });

        console.log(`[CreatureAnimationController] Initialized for ${this.personality} ${this.stage}`);
    }

    /**
     * Start subtle breathing animation (always running)
     */
    startBreathing() {
        if (this.isDestroyed || !this.sprite) return;

        this.breathTween = this.scene.tweens.add({
            targets: this.sprite,
            scaleX: this.baseScaleX * 1.02,
            scaleY: this.baseScaleY * 0.98,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.activeTweens.push(this.breathTween);
    }

    /**
     * Check creature stats and trigger appropriate behaviors
     * Also updates emotional state based on stats
     */
    checkForStateBehavior() {
        if (this.isDestroyed || this.currentState !== 'idle') return;

        const stats = window.GameState?.get('creature.stats') || { happiness: 100, energy: 100, health: 100 };

        // Update emotion based on stats
        this.updateEmotionFromStats(stats);

        // State-driven behavior triggers
        if (stats.energy < 30 && Math.random() < 0.4) {
            this.triggerBehavior('yawn');
        } else if (stats.happiness > 85 && Math.random() < 0.3) {
            this.triggerBehavior('excited_bounce');
        } else if (stats.happiness < 30 && Math.random() < 0.3) {
            this.triggerBehavior('sad_droop');
        } else if (stats.health < 40 && Math.random() < 0.25) {
            this.triggerBehavior('shiver');
        }
    }

    /**
     * Automatically update emotion based on creature stats
     */
    updateEmotionFromStats(stats) {
        const happiness = stats.happiness || 50;
        const energy = stats.energy || 50;
        const health = stats.health || 50;

        let emotion = 'content';
        let intensity = 0.5;

        // Determine primary emotion from stats
        if (health < 30) {
            emotion = 'scared';
            intensity = (30 - health) / 30;
        } else if (energy < 30) {
            emotion = 'tired';
            intensity = (30 - energy) / 30;
        } else if (happiness > 80 && energy > 60) {
            emotion = 'excited';
            intensity = (happiness - 80) / 20;
        } else if (happiness > 65) {
            emotion = 'happy';
            intensity = (happiness - 65) / 35;
        } else if (happiness < 35) {
            emotion = 'shy'; // Using shy for unhappy/withdrawn
            intensity = (35 - happiness) / 35;
        } else {
            // Default content state
            emotion = 'content';
            intensity = 0.5;
        }

        // Only update if emotion changed significantly
        if (emotion !== this.currentEmotion || Math.abs(intensity - this.emotionIntensity) > 0.2) {
            this.setEmotion(emotion, intensity);
        }
    }

    /**
     * Trigger random personality-influenced behavior
     * Now also considers current emotional state
     */
    triggerRandomBehavior() {
        if (this.isDestroyed || this.currentState !== 'idle') return;

        // Check emotion frequency modifier
        const frequencyMod = this.emotionBehaviorBias?.frequency || 0.5;
        if (Math.random() > frequencyMod) {
            return; // Skip this behavior based on emotion (tired = less frequent)
        }

        // Get emotion-influenced behaviors
        const behaviors = this.getEmotionInfluencedBehaviors();
        const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        this.triggerBehavior(randomBehavior);

        // Occasionally trigger a thought after behavior
        if (Math.random() < 0.15) { // 15% chance
            this.scene.time.delayedCall(1500, () => {
                this.triggerThought('idle_thought', { afterBehavior: randomBehavior });
            });
        }
    }

    /**
     * Get available behaviors based on personality
     */
    getPersonalityBehaviors() {
        const personalityBehaviors = {
            curious: ['look_around', 'head_tilt', 'sniff', 'ear_perk'],
            playful: ['bounce', 'spin', 'wiggle', 'hop'],
            gentle: ['slow_blink', 'nuzzle', 'stretch', 'sigh'],
            wise: ['contemplate', 'slow_nod', 'gaze_up', 'meditate'],
            energetic: ['vibrate', 'quick_hop', 'tail_wag', 'excited_spin']
        };
        return personalityBehaviors[this.personality] || personalityBehaviors.curious;
    }

    /**
     * Trigger a specific behavior animation
     */
    triggerBehavior(behaviorType) {
        if (this.isDestroyed || this.currentState !== 'idle') return;

        // Sync base position from current sprite position before animating
        this.syncBasePosition();

        this.currentState = behaviorType;

        switch (behaviorType) {
            case 'yawn':
                this.playYawnAnimation();
                break;
            case 'excited_bounce':
                this.playExcitedBounce();
                break;
            case 'sad_droop':
                this.playSadDroop();
                break;
            case 'look_around':
                this.playLookAround();
                break;
            case 'head_tilt':
                this.playHeadTilt();
                break;
            case 'bounce':
            case 'hop':
            case 'quick_hop':
                this.playBounce();
                break;
            case 'spin':
            case 'excited_spin':
                this.playSpin();
                break;
            case 'wiggle':
            case 'vibrate':
                this.playWiggle();
                break;
            case 'slow_blink':
                this.playSlowBlink();
                break;
            case 'stretch':
                this.playStretch();
                break;
            case 'shiver':
                this.playShiver();
                break;
            case 'contemplate':
            case 'meditate':
                this.playContemplate();
                break;
            case 'nuzzle':
                this.playNuzzle();
                break;
            case 'sniff':
            case 'ear_perk':
                this.playSniff();
                break;
            case 'slow_nod':
            case 'gaze_up':
                this.playSlowNod();
                break;
            case 'tail_wag':
                this.playTailWag();
                break;
            case 'sigh':
                this.playSigh();
                break;
            default:
                this.currentState = 'idle';
        }
    }

    // ==========================================
    // Animation Implementations
    // ==========================================

    playYawnAnimation() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                {
                    scaleY: this.baseScaleY * 1.1,
                    scaleX: this.baseScaleX * 0.95,
                    duration: 400,
                    ease: 'Back.easeOut'
                },
                {
                    scaleY: this.baseScaleY * 1.15,
                    duration: 600,
                    ease: 'Sine.easeInOut'
                },
                {
                    scaleY: this.baseScaleY,
                    scaleX: this.baseScaleX,
                    duration: 500,
                    ease: 'Back.easeIn'
                }
            ],
            onComplete: () => {
                this.returnToIdle();
                // Baby yawn sound
                if (this.stage === 'baby' && window.AudioManager?.playBabyYawn) {
                    window.AudioManager.playBabyYawn();
                }
            }
        });

        this.activeTweens.push(tween);
    }

    playExcitedBounce() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { y: this.baseY - 15, scaleX: this.baseScaleX * 0.9, scaleY: this.baseScaleY * 1.1, duration: 150, ease: 'Quad.easeOut' },
                { y: this.baseY, scaleX: this.baseScaleX * 1.05, scaleY: this.baseScaleY * 0.95, duration: 150, ease: 'Bounce.easeOut' },
                { y: this.baseY - 20, scaleX: this.baseScaleX * 0.9, scaleY: this.baseScaleY * 1.1, duration: 150, ease: 'Quad.easeOut' },
                { y: this.baseY, scaleX: this.baseScaleX, scaleY: this.baseScaleY, duration: 200, ease: 'Bounce.easeOut' }
            ],
            onComplete: () => {
                this.returnToIdle();
                if (this.stage === 'baby' && window.AudioManager?.playBabyGiggle) {
                    window.AudioManager.playBabyGiggle();
                }
            }
        });

        this.activeTweens.push(tween);
    }

    playSadDroop() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            y: this.baseY + 5,
            scaleY: this.baseScaleY * 0.92,
            angle: -3,
            duration: 800,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playLookAround() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { angle: -8, duration: 400, ease: 'Sine.easeOut' },
                { angle: 8, duration: 600, ease: 'Sine.easeInOut' },
                { angle: 0, duration: 400, ease: 'Sine.easeIn' }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playHeadTilt() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            angle: 12,
            duration: 300,
            yoyo: true,
            hold: 500,
            ease: 'Back.easeOut',
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playBounce() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            y: this.baseY - 12,
            duration: 200,
            yoyo: true,
            repeat: 2,
            ease: 'Quad.easeOut',
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playSpin() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            angle: 360,
            duration: 600,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                this.sprite.angle = 0;
                this.returnToIdle();
            }
        });

        this.activeTweens.push(tween);
    }

    playWiggle() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            x: this.baseX + 3,
            duration: 50,
            yoyo: true,
            repeat: 6,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.sprite.x = this.baseX;
                this.returnToIdle();
            }
        });

        this.activeTweens.push(tween);
    }

    playSlowBlink() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            scaleY: this.baseScaleY * 0.85,
            duration: 300,
            yoyo: true,
            hold: 200,
            ease: 'Sine.easeInOut',
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playStretch() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { scaleX: this.baseScaleX * 1.15, scaleY: this.baseScaleY * 0.9, duration: 400, ease: 'Back.easeOut' },
                { scaleX: this.baseScaleX * 0.95, scaleY: this.baseScaleY * 1.08, duration: 400, ease: 'Back.easeOut' },
                { scaleX: this.baseScaleX, scaleY: this.baseScaleY, duration: 300, ease: 'Sine.easeOut' }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playShiver() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            x: this.baseX + 2,
            angle: 1,
            duration: 40,
            yoyo: true,
            repeat: 8,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.sprite.x = this.baseX;
                this.sprite.angle = 0;
                this.returnToIdle();
            }
        });

        this.activeTweens.push(tween);
    }

    playContemplate() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { y: this.baseY - 3, duration: 800, ease: 'Sine.easeOut' },
                { y: this.baseY - 3, duration: 1500 }, // Hold
                { y: this.baseY, duration: 600, ease: 'Sine.easeIn' }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playNuzzle() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { x: this.baseX + 8, angle: 5, duration: 200 },
                { x: this.baseX - 5, angle: -3, duration: 200 },
                { x: this.baseX + 5, angle: 3, duration: 200 },
                { x: this.baseX, angle: 0, duration: 150 }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playSniff() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { y: this.baseY - 2, scaleY: this.baseScaleY * 1.02, duration: 150 },
                { y: this.baseY, scaleY: this.baseScaleY * 0.98, duration: 100 },
                { y: this.baseY - 2, scaleY: this.baseScaleY * 1.02, duration: 150 },
                { y: this.baseY, scaleY: this.baseScaleY, duration: 150 }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playSlowNod() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { y: this.baseY + 3, duration: 400, ease: 'Sine.easeOut' },
                { y: this.baseY, duration: 400, ease: 'Sine.easeIn' },
                { y: this.baseY + 3, duration: 400, ease: 'Sine.easeOut' },
                { y: this.baseY, duration: 400, ease: 'Sine.easeIn' }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    playTailWag() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.add({
            targets: this.sprite,
            angle: { from: -5, to: 5 },
            duration: 100,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.sprite.angle = 0;
                this.returnToIdle();
            }
        });

        this.activeTweens.push(tween);
    }

    playSigh() {
        if (this.isDestroyed || !this.sprite) return;

        const tween = this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [
                { scaleY: this.baseScaleY * 1.05, duration: 500, ease: 'Sine.easeOut' },
                { scaleY: this.baseScaleY * 0.95, duration: 800, ease: 'Sine.easeIn' },
                { scaleY: this.baseScaleY, duration: 300, ease: 'Sine.easeOut' }
            ],
            onComplete: () => this.returnToIdle()
        });

        this.activeTweens.push(tween);
    }

    // ==========================================
    // EMOTION SYSTEM
    // ==========================================

    /**
     * Update creature's current emotional state
     * This affects movement patterns and can trigger particles/thoughts
     * @param {string} emotion - 'happy', 'curious', 'shy', 'excited', 'tired', 'scared', 'content'
     * @param {number} intensity - 0-1 intensity of emotion
     */
    setEmotion(emotion, intensity = 0.5) {
        const previousEmotion = this.currentEmotion;
        this.currentEmotion = emotion;
        this.emotionIntensity = Math.max(0, Math.min(1, intensity));

        // Only trigger particles on emotion change or high intensity
        const emotionChanged = previousEmotion !== emotion;
        const shouldShowParticles = emotionChanged || intensity > 0.7;

        if (shouldShowParticles) {
            this.maybeShowEmotionParticles();
        }

        // Adjust movement behavior based on emotion
        this.applyEmotionMovementModifier();

        console.log(`[CreatureAnimationController] Emotion set: ${emotion} (${Math.round(intensity * 100)}%)`);
    }

    /**
     * Show emotion particles if cooldown has passed
     */
    maybeShowEmotionParticles() {
        const now = Date.now();
        if (now - this.lastEmotionParticleTime < this.emotionParticleCooldown) {
            return; // On cooldown
        }

        if (!window.FXLibrary || !this.sprite) return;

        const x = this.sprite.x;
        const y = this.sprite.y;

        // Trigger appropriate emotion particle effect
        switch (this.currentEmotion) {
            case 'happy':
                window.FXLibrary.emotionHappy(this.scene, x, y);
                break;
            case 'curious':
                window.FXLibrary.emotionCurious(this.scene, x, y);
                break;
            case 'shy':
                window.FXLibrary.emotionShy(this.scene, x, y);
                break;
            case 'excited':
                window.FXLibrary.emotionExcited(this.scene, x, y);
                break;
            case 'tired':
                window.FXLibrary.emotionTired(this.scene, x, y);
                break;
            case 'scared':
                window.FXLibrary.emotionScared(this.scene, x, y);
                break;
            case 'content':
                // Content only shows particles at high intensity
                if (this.emotionIntensity > 0.7) {
                    window.FXLibrary.emotionContent(this.scene, x, y);
                }
                break;
        }

        this.lastEmotionParticleTime = now;
    }

    /**
     * Apply movement modifier based on current emotion
     * This changes how the creature moves/animates
     */
    applyEmotionMovementModifier() {
        // Emotion affects behavior frequency and type
        const emotionBehaviorBias = {
            happy: { behaviors: ['bounce', 'spin', 'wiggle'], frequency: 0.8 },
            curious: { behaviors: ['look_around', 'head_tilt', 'sniff'], frequency: 0.7 },
            shy: { behaviors: ['slow_blink', 'nuzzle'], frequency: 0.3 },
            excited: { behaviors: ['excited_bounce', 'vibrate', 'quick_hop'], frequency: 1.0 },
            tired: { behaviors: ['yawn', 'sigh', 'slow_blink'], frequency: 0.2 },
            scared: { behaviors: ['shiver', 'look_around'], frequency: 0.5 },
            content: { behaviors: ['stretch', 'slow_nod', 'contemplate'], frequency: 0.4 }
        };

        this.emotionBehaviorBias = emotionBehaviorBias[this.currentEmotion] || emotionBehaviorBias.content;
    }

    /**
     * Get current emotion-influenced behaviors
     * Blends personality behaviors with emotion behaviors
     */
    getEmotionInfluencedBehaviors() {
        const personalityBehaviors = this.getPersonalityBehaviors();
        const emotionBehaviors = this.emotionBehaviorBias?.behaviors || [];

        // 70% emotion, 30% personality when emotion is strong
        if (this.emotionIntensity > 0.6 && emotionBehaviors.length > 0) {
            const combined = [...emotionBehaviors, ...emotionBehaviors, ...personalityBehaviors];
            return combined;
        }

        // 50/50 blend for moderate emotion
        return [...personalityBehaviors, ...emotionBehaviors];
    }

    /**
     * Trigger a thought bubble with content
     * @param {string} thoughtType - Type of thought for categorization
     * @param {Object} context - Context data for thought generation
     */
    triggerThought(thoughtType, context = {}) {
        const now = Date.now();
        if (now - this.lastThoughtTime < this.thoughtCooldown) {
            return false; // On cooldown
        }

        if (this.onThoughtBubble) {
            this.onThoughtBubble(thoughtType, {
                emotion: this.currentEmotion,
                emotionIntensity: this.emotionIntensity,
                personality: this.personality,
                stage: this.stage,
                ...context
            });
            this.lastThoughtTime = now;
            return true;
        }
        return false;
    }

    /**
     * Set the thought bubble callback handler
     * @param {Function} callback - Function(thoughtType, context) to call
     */
    setThoughtBubbleHandler(callback) {
        this.onThoughtBubble = callback;
    }

    // ==========================================
    // ENVIRONMENTAL REACTIONS
    // ==========================================

    /**
     * React to entering a new biome/environment
     * @param {string} biomeType - 'cave', 'water', 'crystal', 'forest', 'void', 'reef'
     */
    reactToBiome(biomeType) {
        if (this.isDestroyed) return;

        console.log(`[CreatureAnimationController] Reacting to biome: ${biomeType}`);

        // Biome-specific reactions
        const biomeReactions = {
            cave: { emotion: 'curious', behavior: 'look_around', thoughtType: 'biome_cave' },
            water: { emotion: 'excited', behavior: 'wiggle', thoughtType: 'biome_water' },
            crystal: { emotion: 'curious', behavior: 'head_tilt', thoughtType: 'biome_crystal' },
            forest: { emotion: 'content', behavior: 'stretch', thoughtType: 'biome_forest' },
            void: { emotion: 'curious', behavior: 'contemplate', thoughtType: 'biome_void' },
            reef: { emotion: 'excited', behavior: 'spin', thoughtType: 'biome_reef' }
        };

        const reaction = biomeReactions[biomeType] || biomeReactions.forest;

        // Set emotion
        this.setEmotion(reaction.emotion, 0.7);

        // Play reaction behavior
        this.scene.time.delayedCall(500, () => {
            this.triggerBehavior(reaction.behavior);
        });

        // Trigger thought about the environment
        this.scene.time.delayedCall(2000, () => {
            this.triggerThought(reaction.thoughtType, { biome: biomeType });
        });
    }

    /**
     * React to space weather changes (aurora, solar flares)
     * @param {Object} weatherData - From SpaceWeatherSystem
     */
    reactToSpaceWeather(weatherData) {
        if (this.isDestroyed) return;

        console.log(`[CreatureAnimationController] Reacting to space weather:`, weatherData);

        if (weatherData.auroraActive) {
            // Aurora reaction - look up in wonder
            this.setEmotion('curious', 0.8);
            this.triggerBehavior('gaze_up');

            this.scene.time.delayedCall(2000, () => {
                this.triggerThought('space_weather_aurora', {
                    auroraIntensity: weatherData.auroraIntensity
                });
            });
        } else if (weatherData.solarActivity === 'intense' || weatherData.solarActivity === 'active') {
            // Solar flare reaction - feel energized
            this.setEmotion('excited', 0.9);
            this.triggerBehavior('vibrate');

            this.scene.time.delayedCall(1500, () => {
                this.triggerThought('space_weather_solar', {
                    solarActivity: weatherData.solarActivity
                });
            });
        }
    }

    /**
     * React to time of day changes
     * @param {string} timeOfDay - 'morning', 'day', 'evening', 'night'
     */
    reactToTimeOfDay(timeOfDay) {
        if (this.isDestroyed) return;

        const timeReactions = {
            morning: { emotion: 'happy', behavior: 'stretch', intensity: 0.6 },
            day: { emotion: 'content', behavior: 'look_around', intensity: 0.5 },
            evening: { emotion: 'content', behavior: 'slow_blink', intensity: 0.5 },
            night: { emotion: 'tired', behavior: 'yawn', intensity: 0.6 }
        };

        const reaction = timeReactions[timeOfDay] || timeReactions.day;

        this.setEmotion(reaction.emotion, reaction.intensity);

        // Occasional behavior when time changes
        if (Math.random() < 0.4) {
            this.triggerBehavior(reaction.behavior);
        }

        // Occasional thought about time
        if (Math.random() < 0.2) {
            this.triggerThought('time_of_day', { timeOfDay });
        }
    }

    /**
     * React to player returning after being away
     * @param {number} awayMinutes - How long player was away
     */
    reactToPlayerReturn(awayMinutes) {
        if (this.isDestroyed) return;

        if (awayMinutes > 60) {
            // Long absence - excited to see player
            this.setEmotion('excited', 0.9);
            this.triggerBehavior('excited_bounce');
            this.triggerThought('welcome_back_long', { awayMinutes });
        } else if (awayMinutes > 15) {
            // Short absence - happy to see player
            this.setEmotion('happy', 0.7);
            this.triggerBehavior('bounce');
            this.triggerThought('welcome_back_short', { awayMinutes });
        }
    }

    /**
     * React to game events (level completion, failure, etc.)
     * @param {string} eventType - 'level_complete', 'level_failed', 'boss_defeated', 'collectible_found'
     * @param {Object} eventData - Additional event data
     */
    reactToGameEvent(eventType, eventData = {}) {
        if (this.isDestroyed) return;

        console.log(`[CreatureAnimationController] Reacting to game event: ${eventType}`);

        const eventReactions = {
            level_complete: { emotion: 'excited', behavior: 'excited_bounce', intensity: 1.0 },
            level_failed: { emotion: 'shy', behavior: 'sad_droop', intensity: 0.6 }, // shy=withdrawn
            boss_defeated: { emotion: 'excited', behavior: 'spin', intensity: 1.0 },
            collectible_found: { emotion: 'happy', behavior: 'bounce', intensity: 0.8 },
            player_hurt: { emotion: 'scared', behavior: 'shiver', intensity: 0.7 },
            low_health: { emotion: 'scared', behavior: 'look_around', intensity: 0.6 }
        };

        const reaction = eventReactions[eventType];
        if (reaction) {
            this.setEmotion(reaction.emotion, reaction.intensity);
            this.triggerBehavior(reaction.behavior);
            this.triggerThought(`event_${eventType}`, eventData);
        }
    }

    // ==========================================
    // Public Methods
    // ==========================================

    /**
     * Return sprite to idle state
     */
    returnToIdle() {
        if (this.isDestroyed) return;

        this.currentState = 'idle';

        // Just reset angle, don't force position (player may have moved)
        if (this.sprite) {
            this.sprite.angle = 0;
        }
    }

    /**
     * Play a reaction animation in response to player action
     */
    playReaction(reactionType) {
        if (this.isDestroyed) return;

        // Force current animation to end (just reset state, don't move sprite)
        this.currentState = 'idle';
        if (this.sprite) {
            this.sprite.angle = 0;
        }

        switch (reactionType) {
            case 'pet':
                this.triggerBehavior('nuzzle');
                break;
            case 'feed':
                this.triggerBehavior('excited_bounce');
                break;
            case 'play':
                this.triggerBehavior('spin');
                break;
            case 'levelUp':
                this.triggerBehavior('excited_bounce');
                break;
            case 'hurt':
                this.triggerBehavior('shiver');
                break;
            default:
                this.triggerBehavior('bounce');
        }
    }

    /**
     * Update base position (call when sprite moves)
     */
    updateBasePosition(x, y) {
        this.baseX = x;
        this.baseY = y;
    }

    /**
     * Sync base position from current sprite position (call before animations)
     */
    syncBasePosition() {
        if (this.sprite) {
            this.baseX = this.sprite.x;
            this.baseY = this.sprite.y;
            this.baseScaleX = this.sprite.scaleX;
            this.baseScaleY = this.sprite.scaleY;
        }
    }

    /**
     * Check if currently animating
     */
    isAnimating() {
        return this.currentState !== 'idle';
    }

    /**
     * Pause all animations
     */
    pause() {
        this.activeTweens.forEach(tween => {
            if (tween && tween.pause) {
                tween.pause();
            }
        });
    }

    /**
     * Resume all animations
     */
    resume() {
        this.activeTweens.forEach(tween => {
            if (tween && tween.resume) {
                tween.resume();
            }
        });
    }

    /**
     * Clean up all resources
     */
    destroy() {
        console.log('[CreatureAnimationController] Destroying animation controller');
        this.isDestroyed = true;

        // Stop all tweens
        this.activeTweens.forEach(tween => {
            if (tween && tween.stop) {
                tween.stop();
            }
        });
        this.activeTweens = [];

        // Stop breath tween
        if (this.breathTween) {
            this.breathTween.stop();
            this.breathTween = null;
        }

        // Remove timers
        if (this.behaviorCheckTimer) {
            this.behaviorCheckTimer.remove();
            this.behaviorCheckTimer = null;
        }
        if (this.randomBehaviorTimer) {
            this.randomBehaviorTimer.remove();
            this.randomBehaviorTimer = null;
        }

        // Clear references
        this.sprite = null;
        this.scene = null;
        this.genetics = null;
    }
}

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CreatureAnimationController = CreatureAnimationController;
}

// Export for module systems (CommonJS for Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureAnimationController;
}

export default CreatureAnimationController;

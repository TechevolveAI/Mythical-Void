/**
 * CreatureAnimationController - State-driven idle animation system
 * Creates lively, personality-influenced creature behaviors based on stats and traits
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
     */
    checkForStateBehavior() {
        if (this.isDestroyed || this.currentState !== 'idle') return;

        const stats = window.GameState?.get('creature.stats') || { happiness: 100, energy: 100, health: 100 };

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
     * Trigger random personality-influenced behavior
     */
    triggerRandomBehavior() {
        if (this.isDestroyed || this.currentState !== 'idle') return;

        const behaviors = this.getPersonalityBehaviors();
        const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        this.triggerBehavior(randomBehavior);
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

export default CreatureAnimationController;

/**
 * ThoughtBubbleSystem - Displays contextual creature thoughts
 *
 * ALL thoughts are pre-written. NO AI-generated text is shown to children.
 * The AI director (CreatureAnimationController) decides WHEN to show thoughts
 * and WHICH category to use, but the actual text comes from this safe library.
 *
 * Context types:
 * - idle_thought: Random idle observations
 * - biome_*: Reactions to environments
 * - space_weather_*: Reactions to NASA space weather
 * - time_of_day: Time-based observations
 * - event_*: Game event reactions
 * - welcome_back_*: Return greetings
 */

class ThoughtBubbleSystem {
    constructor() {
        this.isInitialized = false;
        this.thoughtLibrary = this.buildThoughtLibrary();
        this.currentBubble = null;
        this.currentElements = [];

        // Contextual awareness tracking
        this.context = {
            recentFailures: 0,
            lastFailureTime: 0,
            consecutiveFailures: 0,
            lastSuccessTime: 0,
            totalAttempts: 0,
            currentBiome: null,
            playerStruggling: false,
            lastLevelId: null
        };
    }

    /**
     * Initialize the thought bubble system
     */
    initialize() {
        this.isInitialized = true;
        this.loadContextFromGameState();
        console.log('[ThoughtBubbleSystem] Initialized with', Object.keys(this.thoughtLibrary).length, 'categories');
        return this;
    }

    // ==================================================
    // CONTEXT TRACKING
    // ==================================================

    /**
     * Load context from GameState if available
     */
    loadContextFromGameState() {
        if (window.GameState) {
            const stored = window.GameState.get('thoughtContext');
            if (stored) {
                this.context = { ...this.context, ...stored };
            }
        }
    }

    /**
     * Save context to GameState
     */
    saveContext() {
        if (window.GameState) {
            window.GameState.set('thoughtContext', this.context);
        }
    }

    /**
     * Record a level failure (call from game)
     * @param {string} levelId - ID of the failed level
     */
    recordFailure(levelId) {
        const now = Date.now();

        this.context.recentFailures++;
        this.context.lastFailureTime = now;
        this.context.totalAttempts++;

        // Track consecutive failures on same level
        if (levelId === this.context.lastLevelId) {
            this.context.consecutiveFailures++;
        } else {
            this.context.consecutiveFailures = 1;
            this.context.lastLevelId = levelId;
        }

        // Mark as struggling if 3+ consecutive failures
        this.context.playerStruggling = this.context.consecutiveFailures >= 3;

        this.saveContext();

        console.log('[ThoughtBubbleSystem] Failure recorded:', {
            levelId,
            consecutive: this.context.consecutiveFailures,
            struggling: this.context.playerStruggling
        });
    }

    /**
     * Record a level success (call from game)
     * @param {string} levelId - ID of the completed level
     */
    recordSuccess(levelId) {
        const now = Date.now();

        this.context.lastSuccessTime = now;
        this.context.consecutiveFailures = 0;
        this.context.playerStruggling = false;
        this.context.lastLevelId = levelId;

        // Decay recent failures slowly
        this.context.recentFailures = Math.max(0, this.context.recentFailures - 2);

        this.saveContext();

        console.log('[ThoughtBubbleSystem] Success recorded:', { levelId });
    }

    /**
     * Set current biome context
     * @param {string} biome - Current biome name
     */
    setBiome(biome) {
        this.context.currentBiome = biome;
    }

    /**
     * Check if player is currently struggling
     */
    isPlayerStruggling() {
        return this.context.playerStruggling || this.context.consecutiveFailures >= 2;
    }

    /**
     * Get context-appropriate thought category
     * This adds extra encouragement when player is struggling
     */
    getContextualThoughtType(baseType) {
        // If player just failed and is struggling, prioritize encouragement
        if (this.isPlayerStruggling() && baseType === 'idle_thought') {
            // 40% chance to show encouraging thought instead of idle
            if (Math.random() < 0.4) {
                return 'struggling_encouragement';
            }
        }
        return baseType;
    }

    /**
     * Build the complete library of pre-written thoughts
     * Organized by personality and context type
     */
    buildThoughtLibrary() {
        return {
            // ==================================================
            // IDLE THOUGHTS - Random observations
            // ==================================================
            idle_thought: {
                curious: [
                    "I wonder what's over there...",
                    "What makes those stars twinkle?",
                    "There's so much to explore!",
                    "I bet there are secrets everywhere!",
                    "Ooh, what was that sound?",
                    "I love discovering new things!",
                    "Every corner has a story..."
                ],
                playful: [
                    "I feel like bouncing!",
                    "Wheee! This is fun!",
                    "I bet I can jump higher!",
                    "Let's play a game!",
                    "Spin spin spin!",
                    "Everything is more fun with you!",
                    "Adventure time!"
                ],
                gentle: [
                    "What a peaceful moment...",
                    "I'm so grateful for this journey",
                    "The universe feels warm today",
                    "Kindness makes everything better",
                    "I feel safe here with you",
                    "Let's take our time...",
                    "Breathe in the starlight..."
                ],
                wise: [
                    "The cosmos holds many mysteries",
                    "Patience reveals hidden truths",
                    "Every star has a story to tell",
                    "Wisdom comes from observation",
                    "The journey matters most",
                    "All things are connected",
                    "Listen to the universe..."
                ],
                energetic: [
                    "I have SO much energy!",
                    "Let's go go go!",
                    "I can't sit still!",
                    "Ready for anything!",
                    "Power up! Let's do this!",
                    "Maximum excitement mode!",
                    "Adventure awaits!"
                ]
            },

            // ==================================================
            // BIOME REACTIONS
            // ==================================================
            biome_cave: {
                default: [
                    "It's so dark and mysterious in here!",
                    "Look at those crystal formations!",
                    "I can hear echoes...",
                    "Caves are like nature's treasure chests!",
                    "I wonder what secrets hide in the shadows",
                    "The rocks are glittering!",
                    "Every cave tells an ancient story"
                ],
                curious: [
                    "What creatures live down here?",
                    "These rock patterns are fascinating!",
                    "I must explore every tunnel!",
                    "What made these formations?"
                ],
                playful: [
                    "Hello-o-o-o! *echo echo*",
                    "Cave hide and seek!",
                    "The crystals are so sparkly!"
                ]
            },

            biome_water: {
                default: [
                    "The water feels amazing!",
                    "Bubble bubble bubble!",
                    "Swimming is the best!",
                    "Look at all the sea creatures!",
                    "The ocean is full of wonders",
                    "I love the gentle currents",
                    "Everything floats so peacefully here"
                ],
                curious: [
                    "What lives in the deep?",
                    "How do fish breathe underwater?",
                    "The coral is so colorful!"
                ],
                playful: [
                    "Splish splash!",
                    "Let's race the fish!",
                    "Wheee, the current is fun!"
                ]
            },

            biome_crystal: {
                default: [
                    "So many beautiful crystals!",
                    "The light refracts through everything!",
                    "I feel energized here!",
                    "Each crystal has unique colors",
                    "The geometric shapes are perfect",
                    "It's like a rainbow cave!",
                    "Magic feels strong in this place"
                ]
            },

            biome_void: {
                default: [
                    "The void is... vast",
                    "I can see infinity here",
                    "Stars stretch forever",
                    "It's peaceful in the cosmic dark",
                    "The universe is so big!",
                    "I feel small but connected",
                    "Space whispers ancient secrets"
                ]
            },

            biome_reef: {
                default: [
                    "A cosmic reef! How beautiful!",
                    "Bioluminescent creatures everywhere!",
                    "The colors are otherworldly",
                    "Life finds a way even in space!",
                    "These space corals glow!",
                    "I've never seen anything like this",
                    "The reef pulses with energy"
                ]
            },

            // ==================================================
            // SPACE WEATHER REACTIONS (NASA Integration)
            // ==================================================
            space_weather_aurora: {
                default: [
                    "LOOK! The sky is dancing!",
                    "Aurora! The lights are so beautiful!",
                    "The sun painted the sky for us!",
                    "Dancing lights! It's magical!",
                    "This is a real cosmic light show!",
                    "The colors... I can't look away!",
                    "Geomagnetic storms make the prettiest skies!"
                ],
                high_intensity: [
                    "WOW! The aurora is INCREDIBLE tonight!",
                    "I've never seen colors this bright!",
                    "The whole sky is alive!",
                    "This is the most magical thing ever!"
                ]
            },

            space_weather_solar: {
                default: [
                    "The sun sent us a burst of energy!",
                    "I feel tingly! Solar activity!",
                    "The star is active today!",
                    "Cosmic energy is flowing!",
                    "The sun is doing something special!",
                    "I feel more powerful somehow!"
                ],
                intense: [
                    "MAJOR solar flare! Feel that power!",
                    "The sun is showing off today!",
                    "Such incredible cosmic energy!"
                ]
            },

            space_weather_quiet: {
                default: [
                    "The cosmos is peaceful today",
                    "Quiet skies, calm hearts",
                    "A gentle day in space",
                    "Sometimes stillness is beautiful",
                    "The sun is resting quietly"
                ]
            },

            // ==================================================
            // TIME OF DAY
            // ==================================================
            time_of_day: {
                morning: [
                    "Good morning! A new day to explore!",
                    "Rise and shine! Ready for adventure?",
                    "The morning stars are fading!",
                    "What will we discover today?",
                    "Fresh energy for fresh adventures!"
                ],
                day: [
                    "Perfect exploring weather!",
                    "The day is full of possibilities!",
                    "So much to see and do!",
                    "Adventure hours are the best hours!"
                ],
                evening: [
                    "The sky is turning beautiful colors...",
                    "Evening stars are appearing!",
                    "What a wonderful day it's been",
                    "Time to wind down a little",
                    "The universe settles into twilight"
                ],
                night: [
                    "Look at all those stars!",
                    "Night time is star time!",
                    "The cosmos comes alive at night",
                    "I love nighttime adventures",
                    "Sleepy time is coming...",
                    "The stars are watching over us"
                ]
            },

            // ==================================================
            // GAME EVENTS - Including failure awareness
            // ==================================================
            event_level_complete: {
                default: [
                    "WE DID IT! Amazing!",
                    "Victory! You're incredible!",
                    "That was awesome teamwork!",
                    "We conquered that challenge!",
                    "Celebration time! Woohoo!",
                    "You make a great explorer!",
                    "Nothing can stop us!"
                ]
            },

            event_level_failed: {
                default: [
                    "That was tough... but we'll get it!",
                    "Don't worry, we learn from trying!",
                    "Every attempt makes us stronger!",
                    "Let's rest and try again!",
                    "Failure is just practice for success!",
                    "We almost had it! One more try?",
                    "The best adventurers never give up!"
                ],
                encouraging: [
                    "I believe in you! Let's try again!",
                    "We're getting better each time!",
                    "That was SO close! Next time for sure!",
                    "Remember: every master was once a beginner!",
                    "Take a breath. We've got this!"
                ]
            },

            event_boss_defeated: {
                default: [
                    "THE BOSS IS DOWN! INCREDIBLE!",
                    "What an epic victory!",
                    "You're a true hero!",
                    "That was legendary!",
                    "We faced our fears and WON!",
                    "Nothing can stop us now!"
                ]
            },

            event_collectible_found: {
                default: [
                    "Ooh, treasure!",
                    "Nice find!",
                    "Shiny!",
                    "Every collectible counts!",
                    "Great exploring skills!",
                    "You have a good eye!"
                ]
            },

            event_player_hurt: {
                default: [
                    "Ouch! Be careful!",
                    "Watch out!",
                    "That looked painful...",
                    "Stay strong! You've got this!",
                    "Maybe we should be more careful?"
                ]
            },

            event_low_health: {
                default: [
                    "We should find some healing!",
                    "I'm worried about your health...",
                    "Let's be extra careful now",
                    "Finding health would be good!",
                    "Stay safe! We need you!"
                ]
            },

            // ==================================================
            // WELCOME BACK MESSAGES
            // ==================================================
            welcome_back_long: {
                default: [
                    "YOU'RE BACK! I missed you so much!",
                    "Finally! I was waiting forever!",
                    "Best surprise EVER! You're here!",
                    "I have so much to tell you!",
                    "The cosmos isn't the same without you!",
                    "My favorite human is back!",
                    "Let's make up for lost time!"
                ]
            },

            welcome_back_short: {
                default: [
                    "Welcome back! Ready to continue?",
                    "There you are! Let's go!",
                    "I knew you'd come back!",
                    "Hi again! Miss me?",
                    "Back for more adventure?"
                ]
            },

            // ==================================================
            // EMOTION-SPECIFIC (used when emotion is high)
            // ==================================================
            emotion_happy: {
                default: [
                    "I'm so happy right now!",
                    "Everything is wonderful!",
                    "Life is beautiful!",
                    "This feeling is the best!",
                    "Happiness overload!"
                ]
            },

            emotion_curious: {
                default: [
                    "I need to know more...",
                    "What's that over there?",
                    "So many questions!",
                    "Investigation mode: activated!",
                    "Curiosity is my superpower!"
                ]
            },

            emotion_excited: {
                default: [
                    "I can't contain my excitement!",
                    "THIS IS AMAZING!",
                    "Best day ever!",
                    "SO MUCH ENERGY!",
                    "Let's GOOOO!"
                ]
            },

            emotion_tired: {
                default: [
                    "*yaaawn* Getting sleepy...",
                    "A rest would be nice...",
                    "My energy is low...",
                    "Maybe just a little nap?",
                    "Running on empty here..."
                ]
            },

            emotion_scared: {
                default: [
                    "That was scary!",
                    "I feel a bit nervous...",
                    "Let's stick together, okay?",
                    "I'm glad you're here with me",
                    "Deep breaths... we're okay"
                ]
            },

            // ==================================================
            // CONTEXTUAL: STRUGGLING PLAYER ENCOURAGEMENT
            // These appear when player has failed multiple times
            // ==================================================
            struggling_encouragement: {
                default: [
                    "Hey, you're doing great! Don't give up!",
                    "Every try teaches us something new!",
                    "I believe in you! We can do this!",
                    "Tough challenges make the victory sweeter!",
                    "Take a breath. You've got this!",
                    "Even the best explorers face setbacks!",
                    "Remember: practice makes progress!",
                    "I'm proud of you for trying again!",
                    "The stars didn't align YET, but they will!",
                    "You're learning the patterns! Keep going!",
                    "Failure is just success in training!",
                    "Would you like to try a different approach?",
                    "We're in this together, no matter what!"
                ],
                // Extra encouraging after 3+ failures
                persistent_struggle: [
                    "I know it's hard, but I'm SO proud of you!",
                    "You haven't given up and that's amazing!",
                    "True heroes keep trying. You're a hero!",
                    "Maybe we can find another way?",
                    "Every expert was once a beginner!",
                    "Your determination inspires me!",
                    "It's okay to take breaks! Self-care matters!",
                    "The universe rewards those who persist!"
                ]
            },

            // ==================================================
            // CONTEXTUAL: POST-STRUGGLE SUCCESS
            // When player finally succeeds after struggling
            // ==================================================
            post_struggle_success: {
                default: [
                    "YOU DID IT! All that practice paid off!",
                    "I KNEW you could do it! AMAZING!",
                    "See? You never gave up and now look!",
                    "This victory is EXTRA special!",
                    "Your persistence is incredible!",
                    "From struggle to success! Beautiful!",
                    "That's the power of not giving up!",
                    "I'm SO happy right now! You're amazing!"
                ]
            }
        };
    }

    /**
     * Get a random thought for a given context
     * @param {string} thoughtType - Category of thought
     * @param {Object} context - Context data (personality, emotion, etc.)
     * @returns {string} Pre-written thought text
     */
    getThought(thoughtType, context = {}) {
        // Apply contextual modifications to thought type
        const actualThoughtType = this.getContextualThoughtType(thoughtType);

        const category = this.thoughtLibrary[actualThoughtType];
        if (!category) {
            // Fall back to original type if contextual type not found
            const fallbackCategory = this.thoughtLibrary[thoughtType];
            if (!fallbackCategory) {
                console.warn(`[ThoughtBubbleSystem] Unknown thought type: ${thoughtType}`);
                return null;
            }
            return this.selectFromCategory(fallbackCategory, context);
        }

        return this.selectFromCategory(category, context, actualThoughtType);
    }

    /**
     * Select a thought from a category with context awareness
     */
    selectFromCategory(category, context = {}, thoughtType = '') {
        // Get personality-specific thoughts if available
        const personality = context.personality || 'curious';
        let thoughts = category[personality] || category.default || [];

        // Check for intensity-specific subcategories
        if (context.auroraIntensity > 0.7 && category.high_intensity) {
            thoughts = [...thoughts, ...category.high_intensity];
        }
        if (context.solarActivity === 'intense' && category.intense) {
            thoughts = [...thoughts, ...category.intense];
        }
        if (thoughtType === 'event_level_failed' && category.encouraging) {
            thoughts = [...thoughts, ...category.encouraging];
        }

        // Add persistent struggle thoughts if player is really struggling
        if (thoughtType === 'struggling_encouragement' && this.context.consecutiveFailures >= 3) {
            if (category.persistent_struggle) {
                thoughts = [...thoughts, ...category.persistent_struggle];
            }
        }

        // If no thoughts available, try default
        if (thoughts.length === 0) {
            thoughts = category.default || [];
        }

        if (thoughts.length === 0) {
            return null;
        }

        // Return random thought
        return thoughts[Math.floor(Math.random() * thoughts.length)];
    }

    /**
     * Get a special success thought if player was struggling
     */
    getSuccessThought(context = {}) {
        if (this.context.consecutiveFailures >= 2) {
            // Player overcame struggle - use special success message
            return this.getThought('post_struggle_success', context);
        }
        return this.getThought('event_level_complete', context);
    }

    /**
     * Show a thought bubble above a creature
     * @param {Phaser.Scene} scene - Current scene
     * @param {Phaser.GameObjects.Sprite} target - Creature sprite
     * @param {string} thoughtType - Category of thought
     * @param {Object} context - Context data
     * @param {Object} options - Display options
     */
    showThoughtBubble(scene, target, thoughtType, context = {}, options = {}) {
        // Get thought text
        const thought = this.getThought(thoughtType, context);
        if (!thought) return null;

        // Clear existing bubble
        this.hideThoughtBubble();

        const opts = {
            duration: 4000,
            fadeIn: 300,
            fadeOut: 500,
            maxWidth: 200,
            offsetY: -60,
            ...options
        };

        // Calculate position
        const x = target.x;
        const y = target.y + opts.offsetY;

        // Create bubble background
        const padding = 12;
        const tempText = scene.add.text(0, 0, thought, {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            wordWrap: { width: opts.maxWidth - padding * 2 }
        });
        const textWidth = Math.min(tempText.width, opts.maxWidth - padding * 2);
        const textHeight = tempText.height;
        tempText.destroy();

        const bubbleWidth = textWidth + padding * 2;
        const bubbleHeight = textHeight + padding * 2;

        // Bubble graphics
        const bubble = scene.add.graphics();
        bubble.fillStyle(0xFFFFFF, 0.95);
        bubble.fillRoundedRect(
            x - bubbleWidth / 2,
            y - bubbleHeight,
            bubbleWidth,
            bubbleHeight,
            10
        );

        // Bubble tail (triangle pointing down)
        bubble.fillTriangle(
            x - 8, y - 2,
            x + 8, y - 2,
            x, y + 10
        );

        // Border
        bubble.lineStyle(2, 0xCCCCCC, 1);
        bubble.strokeRoundedRect(
            x - bubbleWidth / 2,
            y - bubbleHeight,
            bubbleWidth,
            bubbleHeight,
            10
        );

        bubble.setScrollFactor(0);
        bubble.setDepth(500);
        bubble.setAlpha(0);

        // Thought text
        const text = scene.add.text(x, y - bubbleHeight / 2 - padding / 2, thought, {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#333333',
            wordWrap: { width: opts.maxWidth - padding * 2 },
            align: 'center'
        });
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(501);
        text.setAlpha(0);

        // Store elements
        this.currentElements = [bubble, text];

        // Fade in
        scene.tweens.add({
            targets: [bubble, text],
            alpha: 1,
            duration: opts.fadeIn,
            ease: 'Sine.easeOut'
        });

        // Auto-hide after duration
        scene.time.delayedCall(opts.duration, () => {
            this.hideThoughtBubble(scene, opts.fadeOut);
        });

        return { bubble, text, thought };
    }

    /**
     * Hide current thought bubble
     */
    hideThoughtBubble(scene, fadeOutDuration = 0) {
        if (this.currentElements.length === 0) return;

        const elements = [...this.currentElements];
        this.currentElements = [];

        if (fadeOutDuration > 0 && scene) {
            scene.tweens.add({
                targets: elements,
                alpha: 0,
                duration: fadeOutDuration,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    elements.forEach(el => {
                        if (el && el.destroy) el.destroy();
                    });
                }
            });
        } else {
            elements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
        }
    }

    /**
     * Clean up system
     */
    destroy() {
        this.hideThoughtBubble();
        this.isInitialized = false;
    }
}

// Create singleton
const thoughtBubbleSystem = new ThoughtBubbleSystem();
window.ThoughtBubbleSystem = thoughtBubbleSystem;

// Export for module systems (CommonJS for Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThoughtBubbleSystem;
}

export default thoughtBubbleSystem;

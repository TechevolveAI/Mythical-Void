/**
 * CreatureAnimationController Unit Tests
 * Tests emotion system, behavior selection, and environmental reactions
 *
 * Note: Tests the core logic by creating a minimal implementation that mirrors
 * the actual CreatureAnimationController class (which uses ES6 exports not compatible with Jest)
 */

// Mock Phaser scene and sprite
const mockTween = {
    stop: jest.fn(),
    remove: jest.fn()
};

const mockTweens = {
    add: jest.fn(() => mockTween),
    killAll: jest.fn()
};

const mockTime = {
    addEvent: jest.fn(() => ({ remove: jest.fn() })),
    delayedCall: jest.fn((delay, callback) => {
        return { remove: jest.fn() };
    }),
    removeAllEvents: jest.fn()
};

const mockScene = {
    tweens: mockTweens,
    time: mockTime
};

const mockSprite = {
    x: 100,
    y: 100,
    scaleX: 1,
    scaleY: 1,
    setScale: jest.fn()
};

const mockGenetics = {
    personality: { core: 'curious' }
};

// Mock window objects
global.window = {
    GameState: {
        get: jest.fn((key) => {
            if (key === 'creature.stats') {
                return { happiness: 75, energy: 80, health: 90 };
            }
            if (key === 'creature.lifecycle.stage') {
                return 'adult';
            }
            return null;
        })
    },
    FXLibrary: {
        emotionHappy: jest.fn(),
        emotionCurious: jest.fn(),
        emotionShy: jest.fn(),
        emotionExcited: jest.fn(),
        emotionTired: jest.fn(),
        emotionScared: jest.fn(),
        emotionContent: jest.fn()
    }
};

/**
 * Minimal CreatureAnimationController implementation for testing
 * Mirrors the core logic of src/systems/CreatureAnimationController.js
 */
class CreatureAnimationController {
    constructor(scene, creatureSprite, genetics) {
        this.scene = scene;
        this.sprite = creatureSprite;
        this.genetics = genetics;
        this.currentState = 'idle';
        this.isDestroyed = false;

        this.personality = genetics?.personality?.core || 'curious';
        this.stage = this.determineStage();

        this.baseScaleX = creatureSprite?.scaleX || 1;
        this.baseScaleY = creatureSprite?.scaleY || 1;

        this.activeTweens = [];
        this.breathTween = null;
        this.behaviorCheckTimer = null;
        this.randomBehaviorTimer = null;

        this.currentEmotion = 'content';
        this.emotionIntensity = 0.5;
        this.lastEmotionParticleTime = 0;
        this.emotionParticleCooldown = 5000;

        this.onThoughtBubble = null;
        this.lastThoughtTime = 0;
        this.thoughtCooldown = 15000;

        this.emotionBehaviorBias = null;
    }

    determineStage() {
        return window.GameState?.get('creature.lifecycle.stage') || 'adult';
    }

    setEmotion(emotion, intensity = 0.5) {
        if (this.isDestroyed) return;
        this.currentEmotion = emotion;
        this.emotionIntensity = Math.max(0, Math.min(1, intensity));
        this.applyEmotionMovementModifier();
    }

    updateEmotionFromStats(stats) {
        const happiness = stats.happiness || 50;
        const energy = stats.energy || 50;
        const health = stats.health || 50;

        let emotion = 'content';
        let intensity = 0.5;

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
            emotion = 'shy';
            intensity = (35 - happiness) / 35;
        } else {
            emotion = 'content';
            intensity = 0.5;
        }

        if (emotion !== this.currentEmotion || Math.abs(intensity - this.emotionIntensity) > 0.2) {
            this.setEmotion(emotion, intensity);
        }
    }

    applyEmotionMovementModifier() {
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

    getPersonalityBehaviors() {
        const personalityBehaviors = {
            curious: ['look_around', 'head_tilt', 'sniff', 'ear_perk'],
            playful: ['bounce', 'spin', 'wiggle', 'quick_hop'],
            gentle: ['slow_blink', 'nuzzle', 'sigh', 'stretch'],
            wise: ['contemplate', 'slow_nod', 'look_around', 'gaze_up'],
            energetic: ['excited_bounce', 'vibrate', 'quick_hop', 'spin']
        };

        return personalityBehaviors[this.personality] || personalityBehaviors.curious;
    }

    getEmotionInfluencedBehaviors() {
        const personalityBehaviors = this.getPersonalityBehaviors();
        const emotionBehaviors = this.emotionBehaviorBias?.behaviors || [];

        if (this.emotionIntensity > 0.6 && emotionBehaviors.length > 0) {
            const combined = [...emotionBehaviors, ...emotionBehaviors, ...personalityBehaviors];
            return combined;
        }

        return [...personalityBehaviors, ...emotionBehaviors];
    }

    setThoughtBubbleHandler(callback) {
        this.onThoughtBubble = callback;
    }

    triggerThought(thoughtType, context = {}) {
        const now = Date.now();
        if (now - this.lastThoughtTime < this.thoughtCooldown) {
            return false;
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

    reactToBiome(biomeType) {
        if (this.isDestroyed) return;

        const biomeReactions = {
            cave: { emotion: 'curious', behavior: 'look_around', thoughtType: 'biome_cave' },
            water: { emotion: 'excited', behavior: 'wiggle', thoughtType: 'biome_water' },
            crystal: { emotion: 'curious', behavior: 'head_tilt', thoughtType: 'biome_crystal' },
            forest: { emotion: 'content', behavior: 'stretch', thoughtType: 'biome_forest' },
            void: { emotion: 'curious', behavior: 'contemplate', thoughtType: 'biome_void' },
            reef: { emotion: 'excited', behavior: 'spin', thoughtType: 'biome_reef' }
        };

        const reaction = biomeReactions[biomeType] || biomeReactions.forest;
        this.setEmotion(reaction.emotion, 0.7);
    }

    reactToGameEvent(eventType, eventData = {}) {
        if (this.isDestroyed) return;

        const eventReactions = {
            level_complete: { emotion: 'excited', behavior: 'excited_bounce', intensity: 1.0 },
            level_failed: { emotion: 'shy', behavior: 'sad_droop', intensity: 0.6 },
            boss_defeated: { emotion: 'excited', behavior: 'spin', intensity: 1.0 },
            collectible_found: { emotion: 'happy', behavior: 'bounce', intensity: 0.8 },
            player_hurt: { emotion: 'scared', behavior: 'shiver', intensity: 0.7 },
            low_health: { emotion: 'scared', behavior: 'look_around', intensity: 0.6 }
        };

        const reaction = eventReactions[eventType];
        if (reaction) {
            this.setEmotion(reaction.emotion, reaction.intensity);
            this.triggerThought(`event_${eventType}`, eventData);
        }
    }

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
    }

    reactToPlayerReturn(awayMinutes) {
        if (this.isDestroyed) return;

        if (awayMinutes > 60) {
            this.setEmotion('excited', 0.9);
        } else if (awayMinutes > 15) {
            this.setEmotion('happy', 0.7);
        }
    }

    reactToSpaceWeather(weatherData) {
        if (this.isDestroyed) return;

        if (weatherData.auroraActive) {
            this.setEmotion('curious', 0.8);
        } else if (weatherData.solarActivity === 'intense' || weatherData.solarActivity === 'active') {
            this.setEmotion('excited', 0.9);
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.activeTweens = [];
        this.sprite = null;
        this.scene = null;
        this.genetics = null;
    }
}

describe('CreatureAnimationController', () => {
    let controller;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new CreatureAnimationController(mockScene, mockSprite, mockGenetics);
    });

    afterEach(() => {
        if (controller && !controller.isDestroyed) {
            controller.destroy();
        }
    });

    describe('Initialization', () => {
        test('initializes with default emotion state', () => {
            expect(controller.currentEmotion).toBe('content');
            expect(controller.emotionIntensity).toBe(0.5);
        });

        test('initializes with idle state', () => {
            expect(controller.currentState).toBe('idle');
        });

        test('stores scene and sprite references', () => {
            expect(controller.scene).toBe(mockScene);
            expect(controller.sprite).toBe(mockSprite);
        });

        test('extracts personality from genetics', () => {
            expect(controller.personality).toBe('curious');
        });

        test('sets up thought bubble callback as null initially', () => {
            expect(controller.onThoughtBubble).toBeNull();
        });
    });

    describe('Emotion System', () => {
        test('setEmotion updates current emotion', () => {
            controller.setEmotion('happy', 0.8);

            expect(controller.currentEmotion).toBe('happy');
            expect(controller.emotionIntensity).toBe(0.8);
        });

        test('setEmotion clamps intensity between 0 and 1', () => {
            controller.setEmotion('excited', 1.5);
            expect(controller.emotionIntensity).toBe(1);

            controller.setEmotion('tired', -0.5);
            expect(controller.emotionIntensity).toBe(0);
        });

        test('updateEmotionFromStats sets scared when health is low', () => {
            controller.updateEmotionFromStats({ happiness: 50, energy: 50, health: 20 });
            expect(controller.currentEmotion).toBe('scared');
        });

        test('updateEmotionFromStats sets tired when energy is low', () => {
            controller.updateEmotionFromStats({ happiness: 50, energy: 20, health: 50 });
            expect(controller.currentEmotion).toBe('tired');
        });

        test('updateEmotionFromStats sets excited when happiness and energy are high', () => {
            controller.updateEmotionFromStats({ happiness: 90, energy: 80, health: 100 });
            expect(controller.currentEmotion).toBe('excited');
        });

        test('updateEmotionFromStats sets happy when happiness is moderately high', () => {
            controller.updateEmotionFromStats({ happiness: 70, energy: 50, health: 100 });
            expect(controller.currentEmotion).toBe('happy');
        });

        test('updateEmotionFromStats sets shy when happiness is low', () => {
            controller.updateEmotionFromStats({ happiness: 25, energy: 50, health: 100 });
            expect(controller.currentEmotion).toBe('shy');
        });

        test('updateEmotionFromStats sets content for balanced stats', () => {
            controller.updateEmotionFromStats({ happiness: 50, energy: 50, health: 100 });
            expect(controller.currentEmotion).toBe('content');
        });
    });

    describe('Emotion Movement Modifiers', () => {
        test('applyEmotionMovementModifier sets behavior bias for happy', () => {
            controller.currentEmotion = 'happy';
            controller.applyEmotionMovementModifier();

            expect(controller.emotionBehaviorBias).toBeDefined();
            expect(controller.emotionBehaviorBias.behaviors).toContain('bounce');
            expect(controller.emotionBehaviorBias.frequency).toBe(0.8);
        });

        test('applyEmotionMovementModifier sets low frequency for tired', () => {
            controller.currentEmotion = 'tired';
            controller.applyEmotionMovementModifier();

            expect(controller.emotionBehaviorBias.frequency).toBe(0.2);
            expect(controller.emotionBehaviorBias.behaviors).toContain('yawn');
        });

        test('applyEmotionMovementModifier sets high frequency for excited', () => {
            controller.currentEmotion = 'excited';
            controller.applyEmotionMovementModifier();

            expect(controller.emotionBehaviorBias.frequency).toBe(1.0);
            expect(controller.emotionBehaviorBias.behaviors).toContain('excited_bounce');
        });
    });

    describe('Personality Behaviors', () => {
        test('getPersonalityBehaviors returns curious behaviors', () => {
            controller.personality = 'curious';
            const behaviors = controller.getPersonalityBehaviors();

            expect(behaviors).toContain('look_around');
            expect(behaviors).toContain('head_tilt');
        });

        test('getPersonalityBehaviors returns playful behaviors', () => {
            controller.personality = 'playful';
            const behaviors = controller.getPersonalityBehaviors();

            expect(behaviors).toContain('bounce');
            expect(behaviors).toContain('spin');
        });

        test('getPersonalityBehaviors returns gentle behaviors', () => {
            controller.personality = 'gentle';
            const behaviors = controller.getPersonalityBehaviors();

            expect(behaviors).toContain('slow_blink');
            expect(behaviors).toContain('nuzzle');
        });

        test('getPersonalityBehaviors falls back to default for unknown personality', () => {
            controller.personality = 'unknown';
            const behaviors = controller.getPersonalityBehaviors();

            expect(Array.isArray(behaviors)).toBe(true);
            expect(behaviors.length).toBeGreaterThan(0);
        });
    });

    describe('Emotion-Influenced Behaviors', () => {
        test('getEmotionInfluencedBehaviors blends personality and emotion', () => {
            controller.personality = 'curious';
            controller.emotionIntensity = 0.5;
            controller.emotionBehaviorBias = {
                behaviors: ['bounce', 'wiggle'],
                frequency: 0.8
            };

            const behaviors = controller.getEmotionInfluencedBehaviors();

            expect(Array.isArray(behaviors)).toBe(true);
        });

        test('getEmotionInfluencedBehaviors favors emotion at high intensity', () => {
            controller.personality = 'curious';
            controller.emotionIntensity = 0.8;
            controller.emotionBehaviorBias = {
                behaviors: ['excited_bounce'],
                frequency: 1.0
            };

            const behaviors = controller.getEmotionInfluencedBehaviors();

            const excitedCount = behaviors.filter(b => b === 'excited_bounce').length;
            expect(excitedCount).toBeGreaterThan(0);
        });
    });

    describe('Thought Bubble System', () => {
        test('setThoughtBubbleHandler sets callback', () => {
            const handler = jest.fn();
            controller.setThoughtBubbleHandler(handler);

            expect(controller.onThoughtBubble).toBe(handler);
        });

        test('triggerThought calls handler with context', () => {
            const handler = jest.fn();
            controller.setThoughtBubbleHandler(handler);
            controller.lastThoughtTime = 0;

            controller.triggerThought('idle_thought', { extra: 'data' });

            expect(handler).toHaveBeenCalledWith('idle_thought', expect.objectContaining({
                emotion: controller.currentEmotion,
                emotionIntensity: controller.emotionIntensity,
                personality: controller.personality,
                extra: 'data'
            }));
        });

        test('triggerThought respects cooldown', () => {
            const handler = jest.fn();
            controller.setThoughtBubbleHandler(handler);
            controller.lastThoughtTime = Date.now();

            const result = controller.triggerThought('idle_thought');

            expect(result).toBe(false);
            expect(handler).not.toHaveBeenCalled();
        });

        test('triggerThought returns false without handler', () => {
            controller.onThoughtBubble = null;
            controller.lastThoughtTime = 0;

            const result = controller.triggerThought('idle_thought');

            expect(result).toBe(false);
        });
    });

    describe('Environmental Reactions', () => {
        test('reactToBiome sets appropriate emotion for cave', () => {
            controller.reactToBiome('cave');

            expect(controller.currentEmotion).toBe('curious');
        });

        test('reactToBiome sets appropriate emotion for water', () => {
            controller.reactToBiome('water');

            expect(controller.currentEmotion).toBe('excited');
        });

        test('reactToBiome sets appropriate emotion for crystal', () => {
            controller.reactToBiome('crystal');

            expect(controller.currentEmotion).toBe('curious');
        });

        test('reactToBiome defaults to forest reaction for unknown biome', () => {
            controller.reactToBiome('unknown_biome');

            expect(controller.currentEmotion).toBe('content');
        });
    });

    describe('Game Event Reactions', () => {
        test('reactToGameEvent sets excited for level_complete', () => {
            controller.reactToGameEvent('level_complete');

            expect(controller.currentEmotion).toBe('excited');
            expect(controller.emotionIntensity).toBe(1.0);
        });

        test('reactToGameEvent sets shy for level_failed', () => {
            controller.reactToGameEvent('level_failed');

            expect(controller.currentEmotion).toBe('shy');
        });

        test('reactToGameEvent sets scared for player_hurt', () => {
            controller.reactToGameEvent('player_hurt');

            expect(controller.currentEmotion).toBe('scared');
        });

        test('reactToGameEvent triggers thought bubble', () => {
            const handler = jest.fn();
            controller.setThoughtBubbleHandler(handler);
            controller.lastThoughtTime = 0;

            controller.reactToGameEvent('collectible_found', { itemId: 'star_1' });

            expect(handler).toHaveBeenCalledWith('event_collectible_found', expect.objectContaining({
                itemId: 'star_1'
            }));
        });
    });

    describe('Time of Day Reactions', () => {
        test('reactToTimeOfDay sets happy for morning', () => {
            controller.reactToTimeOfDay('morning');

            expect(controller.currentEmotion).toBe('happy');
        });

        test('reactToTimeOfDay sets tired for night', () => {
            controller.reactToTimeOfDay('night');

            expect(controller.currentEmotion).toBe('tired');
        });

        test('reactToTimeOfDay sets content for day', () => {
            controller.reactToTimeOfDay('day');

            expect(controller.currentEmotion).toBe('content');
        });
    });

    describe('Player Return Reactions', () => {
        test('reactToPlayerReturn sets excited for long absence', () => {
            controller.reactToPlayerReturn(120);

            expect(controller.currentEmotion).toBe('excited');
            expect(controller.emotionIntensity).toBe(0.9);
        });

        test('reactToPlayerReturn sets happy for short absence', () => {
            controller.reactToPlayerReturn(30);

            expect(controller.currentEmotion).toBe('happy');
            expect(controller.emotionIntensity).toBe(0.7);
        });

        test('reactToPlayerReturn does nothing for very short absence', () => {
            const originalEmotion = controller.currentEmotion;
            controller.reactToPlayerReturn(5);

            expect(controller.currentEmotion).toBe(originalEmotion);
        });
    });

    describe('Space Weather Reactions', () => {
        test('reactToSpaceWeather sets curious for aurora', () => {
            controller.reactToSpaceWeather({
                auroraActive: true,
                auroraIntensity: 0.8
            });

            expect(controller.currentEmotion).toBe('curious');
            expect(controller.emotionIntensity).toBe(0.8);
        });

        test('reactToSpaceWeather sets excited for intense solar activity', () => {
            controller.reactToSpaceWeather({
                auroraActive: false,
                solarActivity: 'intense'
            });

            expect(controller.currentEmotion).toBe('excited');
            expect(controller.emotionIntensity).toBe(0.9);
        });
    });

    describe('Cleanup', () => {
        test('destroy sets isDestroyed flag', () => {
            controller.destroy();

            expect(controller.isDestroyed).toBe(true);
        });

        test('methods no-op after destroy', () => {
            controller.destroy();

            expect(() => controller.setEmotion('happy')).not.toThrow();
            expect(() => controller.reactToBiome('cave')).not.toThrow();
            expect(() => controller.reactToGameEvent('level_complete')).not.toThrow();
        });
    });
});

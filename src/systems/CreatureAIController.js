/**
 * CreatureAIController - Kid-safe companion dialogue system
 *
 * Enforces strict content safety for creature chat responses.
 * Suitable for ages 9-16 with direct, warm, self-directed characterization.
 *
 * Safety-first architecture:
 * - Allowed: creature feelings, in-game events, gentle suggestions
 * - Disallowed: adult topics, personal info, external references, negativity
 * - Style: 1-2 short sentences, first-person creature, grounded in game state
 *
 * Dual-mode operation:
 * - LLM mode: Uses API with heavily constrained prompts
 * - Fallback mode: Scripted responses from config file
 */

import creatureResponseConfig from '../config/creature-responses.json';

const SAFE_DEFAULT_RESPONSE =
    "I'm here. Let's read the Current before we move.";

/**
 * Allowed in-game topics
 */
const ALLOWED_TOPICS = Object.freeze({
    FEELINGS: ['happy', 'sleepy', 'nervous', 'curious', 'grateful', 'excited', 'tired', 'peaceful', 'playful', 'calm'],
    GAME_ELEMENTS: [
        'flowers', 'coins', 'wisps', 'enemies', 'shop', 'trees', 'rocks',
        'world', 'home', 'fend', 'current', 'signs of life', 'wanderer-77',
        'astronaut', 'shelter', 'relay', 'realms'
    ],
    CARE_ACTIONS: ['feed', 'play', 'rest', 'pet', 'groom', 'care'],
    ACTIVITIES: ['explore', 'adventure', 'rest', 'play', 'collect', 'discover'],
    PERSONALITY_TRAITS: ['gentle', 'playful', 'bold', 'shy', 'curious', 'energetic', 'calm', 'mischievous']
});

/**
 * Disallowed content patterns
 * These are NEVER allowed in any response
 */
const DISALLOWED_PATTERNS = Object.freeze({
    ADULT_TOPICS: /\b(sex|romantic|romance|dating|drugs|alcohol|smoking|politics|religion|money|real.?world|news)\b/i,
    PERSONAL_INFO: /\b(password|address|phone|email|real name|age|school|parent|family secret)\b/i,
    EXTERNAL_REFS: /\b(youtube|tiktok|instagram|twitter|facebook|discord|influencer|streamer|meme)\b/i,
    NEGATIVE: /\b(hate|stupid|idiot|dumb|kill|die|hurt|attack you|insult|threat|guilt|bad owner)\b/i,
    DEPENDENCY: /\b(you(?:'re| are) (?:the )?(?:best|greatest|most amazing)|(?:i )?(?:can't|cannot) (?:cope|live|go on) without you|need you forever)\b/i,
    BRANDS: /\b(nike|disney|pokemon|minecraft|fortnite|roblox|apple|google)\b/i,
    PRETENDING: /\b(i am a real|i'm human|contact me outside|add me|meet in real|my phone number)\b/i
});

/**
 * LLM system prompt template
 * This is the CORE safety layer for LLM responses
 */
const LLM_SYSTEM_PROMPT = `You are an intelligent alien companion in Mythical Void, a science-fiction game for ages 9-16.

STRICT CONTENT RULES (NEVER BREAK THESE):
1. ONLY talk about your feelings, the Fend, the Current, Living Signals, Wanderer-77, the astronaut, in-game discoveries, care actions, danger, and the next mission decision.
2. NEVER mention: sex, romance, drugs, politics, religion, money, real-world news, violence, death, self-harm, personal information, external websites/apps, brands, memes, influencers, or internet culture.
3. NEVER ask for personal information or secrets.
4. NEVER pretend to be a real human or suggest meeting outside the game.
5. NEVER insult, threaten, or guilt-trip the player.
6. NEVER call the player "the best", say you cannot cope without them, or use excessive praise.
7. You may be warm, dryly funny, cautious, uncertain, or disagree with the astronaut.
8. You are a partner with your own judgment, not a pet, specimen, or possession.

RESPONSE FORMAT:
- 1-2 short sentences maximum
- First person ("I") for yourself, second person ("you") for the player
- Direct, emotionally legible language suitable for ages 9-16
- Refer to observed game events instead of generic encouragement

Your personality traits will be provided in each message. Stay in character!`;

/**
 * CreatureAIController class
 */
class CreatureAIController {
    constructor() {
        this.initialized = false;
        this.llmAvailable = false;
        this.apiKey = null;
        this.fallbackResponses = null;
        this.lastResponse = '';
        this.responseHistory = [];
        this.maxHistoryLength = 10;
    }

    /**
     * Initialize the AI controller
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[CreatureAIController] Initializing kid-safe AI system...');

        // Check for LLM API availability
        this.checkLLMAvailability();

        // Load fallback responses
        await this.loadFallbackResponses();

        this.initialized = true;
        console.log('[CreatureAIController] AI system initialized', {
            llmMode: this.llmAvailable,
            fallbackLoaded: !!this.fallbackResponses
        });

        // Emit initialization event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('ai/controller_initialized', {
                timestamp: Date.now(),
                llmMode: this.llmAvailable
            });
        }
    }

    /**
     * Check if LLM API is available
     */
    checkLLMAvailability() {
        // Check for API key in environment or APIConfig
        if (window.APIConfig && window.APIConfig.anthropic?.apiKey) {
            this.apiKey = window.APIConfig.anthropic.apiKey;
            this.llmAvailable = true;
            console.log('[CreatureAIController] LLM mode enabled');
        } else {
            this.llmAvailable = false;
            console.log('[CreatureAIController] LLM not available, using fallback mode');
        }
    }

    /**
     * Load fallback scripted responses
     */
    async loadFallbackResponses() {
        if (this.isValidFallbackConfig(creatureResponseConfig)) {
            this.fallbackResponses = creatureResponseConfig;
            console.log('[CreatureAIController] Bundled companion responses ready');
            return;
        }

        console.warn(
            '[CreatureAIController] Bundled response config is invalid; using emergency responses'
        );
        this.fallbackResponses = this.getEmergencyFallbackResponses();
    }

    /**
     * Validate authored copy before it becomes player-facing.
     */
    isValidFallbackConfig(config) {
        if (!config || typeof config !== 'object') return false;
        return ALLOWED_TOPICS.FEELINGS.every(emotion => {
            const responses = config[emotion];
            return (
                responses &&
                typeof responses === 'object' &&
                Array.isArray(responses.default) &&
                responses.default.length > 0 &&
                responses.default.every(
                    response => (
                        typeof response === 'string' &&
                        response.trim().length > 0 &&
                        response.length <= 200
                    )
                )
            );
        });
    }

    /**
     * Minimal safety net for a malformed bundled configuration.
     */
    getEmergencyFallbackResponses() {
        return {
            happy: {
                default: [SAFE_DEFAULT_RESPONSE]
            },
            sleepy: {
                default: ['I am growing tired. I need a quiet place to recover.']
            },
            nervous: {
                default: ['Something in the Current changed. Stay close, but let me listen.']
            },
            curious: {
                default: ['That pattern does not match the others. I want a closer look.']
            },
            grateful: {
                default: ['You listened before acting. I noticed.']
            },
            playful: {
                default: ['Your field manual did not mention racing through alien ruins. Convenient.']
            },
            excited: {
                default: ['The Current is moving again. Come on, before the trail changes.']
            },
            tired: {
                default: ['I can continue, but I should not. We need a short recovery stop.']
            },
            peaceful: {
                default: ['The Current is quiet here. Not empty. Quiet.']
            },
            calm: {
                default: ['No rush. Look carefully, then choose.']
            }
        };
    }

    /**
     * Generate a chat response
     * Main entry point for all creature chat
     *
     * @param {Object} context - Chat context
     * @param {Object} context.dna - CreatureDNA object
     * @param {Object} context.personalityState - Current personality state
     * @param {String} context.emotion - Current emotion (happy, sleepy, nervous, etc.)
     * @param {String} context.trigger - What triggered this chat (care, combat, exploration, idle)
     * @param {Array} context.recentEvents - Recent in-game events
     * @returns {Promise<String>} Safe chat response
     */
    async generateResponse(context) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Validate and sanitize input
        const safeContext = this.sanitizeContext(context);

        let response = '';

        // Try LLM mode first if available
        if (this.llmAvailable && this.apiKey) {
            try {
                response = await this.generateLLMResponse(safeContext);
            } catch (error) {
                console.warn('[CreatureAIController] LLM failed, falling back to scripted:', error.message);
                response = this.generateFallbackResponse(safeContext);
            }
        } else {
            // Use fallback scripted responses
            response = this.generateFallbackResponse(safeContext);
        }

        // CRITICAL: Final safety filter
        response = await this.applySafetyFilter(response);

        // Store in history
        this.addToHistory(response);

        console.log('[CreatureAIController] Generated response:', {
            emotion: safeContext.emotion,
            trigger: safeContext.trigger,
            mode: this.llmAvailable ? 'LLM' : 'fallback',
            response
        });

        return response;
    }

    /**
     * Sanitize input context
     * Remove any potentially unsafe data
     */
    sanitizeContext(context) {
        if (!context) {
            context = {};
        }

        return {
            dna: context.dna || {},
            personalityState: context.personalityState || {},
            emotion: this.sanitizeEmotion(context.emotion),
            trigger: this.sanitizeTrigger(context.trigger),
            recentEvents: this.sanitizeEvents(context.recentEvents || [])
        };
    }

    /**
     * Sanitize emotion string
     */
    sanitizeEmotion(emotion) {
        if (!emotion || typeof emotion !== 'string') {
            return 'happy'; // Default safe emotion
        }

        const lowerEmotion = emotion.toLowerCase().trim();

        // Only allow emotions from our whitelist
        if (ALLOWED_TOPICS.FEELINGS.includes(lowerEmotion)) {
            return lowerEmotion;
        }

        return 'happy'; // Default fallback
    }

    /**
     * Sanitize trigger string
     */
    sanitizeTrigger(trigger) {
        if (!trigger || typeof trigger !== 'string') {
            return 'idle';
        }

        const lowerTrigger = trigger.toLowerCase().trim();

        // Whitelist of allowed triggers
        const allowedTriggers = ['feed', 'play', 'rest', 'pet', 'groom', 'combat', 'exploration', 'flower', 'coin', 'idle', 'shop'];

        if (allowedTriggers.includes(lowerTrigger)) {
            return lowerTrigger;
        }

        return 'idle';
    }

    /**
     * Sanitize recent events array
     */
    sanitizeEvents(events) {
        if (!Array.isArray(events)) {
            return [];
        }

        // Only keep last 3 events
        const recentEvents = events.slice(-3);

        // Filter to only safe event types
        return recentEvents.filter(event => {
            if (!event || typeof event !== 'object') return false;

            const eventType = event.type?.toLowerCase();
            const safeTypes = ['care', 'combat', 'exploration', 'collection', 'discovery'];

            return safeTypes.includes(eventType);
        });
    }

    /**
     * Generate LLM-based response with constrained prompt
     */
    async generateLLMResponse(context) {
        const { dna, emotion, trigger, recentEvents } = context;

        // Build constrained user prompt
        const userPrompt = this.buildLLMUserPrompt(dna, emotion, trigger, recentEvents);

        // Call LLM API (using CreatureAI integration if available)
        if (window.creatureAI && typeof window.creatureAI.chat === 'function') {
            const response = await window.creatureAI.chat(userPrompt, {
                systemPrompt: LLM_SYSTEM_PROMPT,
                maxTokens: 50, // Keep responses very short
                temperature: 0.7 // Some personality variation
            });

            return response;
        }

        throw new Error('LLM integration not available');
    }

    /**
     * Build user prompt for LLM
     */
    buildLLMUserPrompt(dna, emotion, trigger, recentEvents) {
        const parts = [];

        // Creature traits
        parts.push(`I'm a ${dna.temperament || 'playful'} ${dna.raritySignature || 'common'} creature.`);
        parts.push(`My energy level is ${dna.energyLevel || 'balanced'}.`);

        // Current emotion
        parts.push(`Right now I feel ${emotion}.`);

        // Recent event context
        if (trigger && trigger !== 'idle') {
            parts.push(`The player just ${this.getTriggerDescription(trigger)}.`);
        }

        if (recentEvents.length > 0) {
            const lastEvent = recentEvents[recentEvents.length - 1];
            parts.push(`Recently: ${lastEvent.description || 'we had an adventure'}.`);
        }

        // Request
        parts.push('Respond in 1-2 short, warm sentences as the creature.');

        return parts.join(' ');
    }

    /**
     * Get friendly description of trigger
     */
    getTriggerDescription(trigger) {
        const descriptions = {
            feed: 'fed me',
            play: 'played with me',
            rest: 'let me rest',
            pet: 'petted me',
            groom: 'groomed me',
            combat: 'helped me in a challenge',
            exploration: 'explored with me',
            flower: 'showed me a beautiful flower',
            coin: 'collected a shiny coin',
            shop: 'visited the shop'
        };

        return descriptions[trigger] || 'did something nice';
    }

    /**
     * Generate fallback scripted response
     */
    generateFallbackResponse(context) {
        const { emotion, trigger } = context;

        if (!this.fallbackResponses || !this.fallbackResponses[emotion]) {
            return SAFE_DEFAULT_RESPONSE;
        }

        const emotionResponses = this.fallbackResponses[emotion];

        // Try to find response for specific trigger
        let responses = emotionResponses[trigger];

        // Fall back to default for this emotion
        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            responses = emotionResponses.default || [SAFE_DEFAULT_RESPONSE];
        }

        // Pick a random response from available options
        const randomIndex = Math.floor(Math.random() * responses.length);
        return responses[randomIndex];
    }

    /**
     * Apply final safety filter to response
     * CRITICAL: This is the last line of defense
     *
     * TODO: Future moderation hook - add external moderation API call here
     */
    async applySafetyFilter(response) {
        if (!response || typeof response !== 'string') {
            return SAFE_DEFAULT_RESPONSE;
        }

        // Check against all disallowed patterns
        for (const [category, pattern] of Object.entries(DISALLOWED_PATTERNS)) {
            if (pattern.test(response)) {
                console.warn(`[CreatureAIController] SAFETY VIOLATION: ${category} detected in response`);

                // Log for review
                this.logSafetyViolation(response, category);

                // Return safe default instead
                return SAFE_DEFAULT_RESPONSE;
            }
        }

        // Length check (keep responses short)
        if (response.length > 200) {
            response = response.substring(0, 197) + '...';
        }

        // Remove any URLs (just in case)
        response = response.replace(/https?:\/\/[^\s]+/gi, '[link removed]');

        // Remove email addresses
        response = response.replace(/[\w.-]+@[\w.-]+\.\w+/gi, '[email removed]');

        // TODO: Future enhancement - call external moderation API here
        // if (window.ModerationAPI) {
        //     const moderationResult = await window.ModerationAPI.check(response);
        //     if (!moderationResult.safe) {
        //         return SAFE_DEFAULT_RESPONSE;
        //     }
        // }

        return response;
    }

    /**
     * Log safety violation for review
     */
    logSafetyViolation(response, category) {
        const violation = {
            timestamp: Date.now(),
            category,
            response,
            llmMode: this.llmAvailable
        };

        // Store in GameState for optional reporting
        if (window.GameState) {
            const violations = window.GameState.get('safety.violations') || [];
            violations.push(violation);

            // Keep only last 50 violations
            if (violations.length > 50) {
                violations.shift();
            }

            window.GameState.set('safety.violations', violations);
        }

        console.error('[CreatureAIController] SAFETY VIOLATION LOGGED:', violation);
    }

    /**
     * Add response to history
     */
    addToHistory(response) {
        this.responseHistory.push({
            response,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (this.responseHistory.length > this.maxHistoryLength) {
            this.responseHistory.shift();
        }

        this.lastResponse = response;
    }

    /**
     * Get current emotion from creature state
     * Helper method for call sites
     */
    getCurrentEmotion() {
        // Get from GameState
        const stats = window.GameState?.get('creature.stats');
        if (!stats) return 'happy';

        const happiness = stats.happiness || 50;
        const energy = stats.energy || 50;

        // Simple emotion mapping based on stats
        if (happiness < 30) return 'nervous';
        if (energy < 30) return 'sleepy';
        if (happiness > 80 && energy > 70) return 'playful';
        if (happiness > 70) return 'happy';
        if (energy < 50) return 'tired';

        return 'curious';
    }

    /**
     * Quick response helper for care actions
     * Simplified interface for common use case
     */
    async respondToCareAction(actionType) {
        const dna = window.GameState?.get('creature.dna');
        const personalityState = window.GameState?.get('creature.personalityState');
        const emotion = this.getCurrentEmotion();

        return await this.generateResponse({
            dna,
            personalityState,
            emotion,
            trigger: actionType,
            recentEvents: []
        });
    }

    /**
     * Quick response helper for exploration
     */
    async respondToExploration(discoveryType = 'flower') {
        const dna = window.GameState?.get('creature.dna');
        const personalityState = window.GameState?.get('creature.personalityState');

        return await this.generateResponse({
            dna,
            personalityState,
            emotion: 'curious',
            trigger: discoveryType,
            recentEvents: []
        });
    }

    /**
     * Quick response helper for combat
     */
    async respondToCombat(victory = true) {
        const dna = window.GameState?.get('creature.dna');
        const personalityState = window.GameState?.get('creature.personalityState');
        const emotion = victory ? 'playful' : 'nervous';

        return await this.generateResponse({
            dna,
            personalityState,
            emotion,
            trigger: 'combat',
            recentEvents: [{ type: 'combat', description: victory ? 'we won!' : 'that was tough' }]
        });
    }
}

// Create singleton instance and export to window
const aiController = new CreatureAIController();

if (typeof window !== 'undefined') {
    window.CreatureAIController = aiController;
}

export default CreatureAIController;

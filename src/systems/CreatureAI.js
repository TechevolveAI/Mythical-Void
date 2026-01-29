/**
 * CreatureAI - Personality generation and pre-written response system
 *
 * EU AI Act Compliance Note:
 * This system uses ONLY pre-written, human-authored responses.
 * NO external LLM/AI APIs are called - all responses are deterministic
 * and curated for child safety (ages 8-14).
 *
 * Features: personality generation, conversation management, pre-written responses
 */

class CreatureAI {
    constructor() {
        this.isInitialized = false;
        this.responseCache = new Map();
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        this.totalRequests = 0;
    }

    /**
     * Initialize the AI system
     * Uses pre-written responses only - no external AI APIs
     */
    async initialize() {
        this.isInitialized = true;
        console.log('[CreatureAI] Initialized with pre-written response system (EU AI Act compliant)');
    }

    /**
     * Generate personality using genetics system if available, fallback to color-based generation
     */
    generatePersonality(creatureData) {
        // If genetics data is available, use it for rich personality generation
        if (creatureData.genetics && creatureData.genetics.personality) {
            return this.generateGeneticsBasedPersonality(creatureData);
        }
        
        // Fallback to legacy color-based personality generation
        return this.generateColorBasedPersonality(creatureData);
    }

    /**
     * Generate personality from genetics data
     */
    generateGeneticsBasedPersonality(creatureData) {
        const genetics = creatureData.genetics;
        const personality = genetics.personality;
        const cosmicAffinity = genetics.cosmicAffinity;
        
        // Enhanced personality based on genetics
        const enhancedPersonality = {
            name: this.getPersonalityDisplayName(personality.core),
            traits: [personality.core, ...this.getSecondaryTraits(personality)],
            description: personality.description,
            
            // Genetic personality data
            core: personality.core,
            quirks: personality.quirks || [],
            socialLevel: personality.socialLevel || 0.5,
            independence: personality.independence || 0.5,
            emotionModifiers: personality.emotionModifiers || {},
            carePreferences: personality.carePreferences || {},
            
            // Cosmic influence
            cosmicAffinity: {
                element: cosmicAffinity.element,
                description: cosmicAffinity.description,
                powerLevel: cosmicAffinity.powerLevel,
                visualEffects: cosmicAffinity.visualEffects || [],
                specialAbilities: cosmicAffinity.specialAbilities || []
            },
            
            // Species and rarity influence
            species: genetics.species,
            rarity: genetics.rarity,
            
            // Dynamic properties
            level: creatureData.level || 1,
            experience: creatureData.experience || 0,
            mood: this.calculateGeneticMood(creatureData.stats, personality)
        };
        
        console.log(`ai:debug [CreatureAI] Generated genetics-based personality:`, {
            core: personality.core,
            species: genetics.species,
            rarity: genetics.rarity,
            cosmicElement: cosmicAffinity.element,
            quirks: personality.quirks
        });
        
        return enhancedPersonality;
    }

    /**
     * Generate legacy color-based personality for backward compatibility
     */
    generateColorBasedPersonality(creatureData) {
        const personalities = [
            {
                name: "Curious Explorer",
                traits: ["curious", "adventurous", "observant"],
                description: "Always eager to learn about the world around them",
                core: "curious"
            },
            {
                name: "Gentle Sage",
                traits: ["wise", "calm", "helpful"],
                description: "Offers gentle guidance and shares knowledge peacefully",
                core: "wise"
            },
            {
                name: "Playful Spirit",
                traits: ["energetic", "fun-loving", "creative"],
                description: "Brings joy and creativity to every interaction",
                core: "playful"
            },
            {
                name: "Mysterious Oracle",
                traits: ["mysterious", "intuitive", "enigmatic"],
                description: "Speaks in riddles and offers profound insights",
                core: "wise"
            },
            {
                name: "Loyal Companion",
                traits: ["loyal", "supportive", "empathetic"],
                description: "Always there to listen and offer emotional support",
                core: "gentle"
            }
        ];

        // Generate personality based on creature colors and level
        const colorHash = this.hashColors(creatureData.colors);
        const levelInfluence = creatureData.level || 1;

        const personalityIndex = (colorHash + levelInfluence) % personalities.length;
        const personality = personalities[personalityIndex];

        return {
            ...personality,
            level: creatureData.level || 1,
            experience: creatureData.experience || 0,
            mood: this.calculateMood(creatureData.stats)
        };
    }

    /**
     * Get display name for personality core
     */
    getPersonalityDisplayName(core) {
        const displayNames = {
            curious: "Curious Explorer",
            playful: "Playful Spirit", 
            gentle: "Gentle Soul",
            wise: "Ancient Sage",
            energetic: "Energetic Spark"
        };
        
        return displayNames[core] || "Mysterious Being";
    }

    /**
     * Get secondary traits based on personality
     */
    getSecondaryTraits(personality) {
        const secondaryTraits = [];
        
        // Add traits based on social level and independence
        if (personality.socialLevel > 0.7) {
            secondaryTraits.push('social');
        } else if (personality.socialLevel < 0.3) {
            secondaryTraits.push('solitary');
        }
        
        if (personality.independence > 0.7) {
            secondaryTraits.push('independent');
        } else if (personality.independence < 0.3) {
            secondaryTraits.push('dependent');
        }
        
        // Add trait based on dominant care preference
        const carePrefs = personality.carePreferences || {};
        const topCare = Object.entries(carePrefs).sort((a, b) => b[1] - a[1])[0];
        if (topCare && topCare[1] > 1.1) {
            secondaryTraits.push(`${topCare[0]}_loving`);
        }
        
        return secondaryTraits.slice(0, 2); // Limit to 2 secondary traits
    }

    /**
     * Calculate creature's current mood based on stats with genetic personality influence
     */
    calculateGeneticMood(stats, personality) {
        const happiness = stats.happiness || 50;
        const health = stats.health || 50;
        const energy = stats.energy || 50;

        let average = (happiness + health + energy) / 3;
        
        // Apply personality-based emotion modifiers
        const emotionModifiers = personality.emotionModifiers || {};
        
        // Adjust average based on personality traits
        if (emotionModifiers.happy && average >= 60) {
            average += (emotionModifiers.happy * 10); // Boost happy moods
        }
        if (emotionModifiers.content && average >= 40 && average < 60) {
            average += (emotionModifiers.content * 10); // Boost contentment
        }
        if (emotionModifiers.excited && energy > 70) {
            average += (emotionModifiers.excited * 5); // Energy affects excitement
        }
        if (emotionModifiers.stressed && average < 40) {
            average += (emotionModifiers.stressed * 10); // Reduce stress impact
        }
        
        // Clamp average to valid range
        average = Math.max(0, Math.min(100, average));

        if (average >= 85) return "ecstatic";
        if (average >= 70) return "joyful";
        if (average >= 60) return "happy";
        if (average >= 50) return "content";
        if (average >= 40) return "calm";
        if (average >= 30) return "tired";
        if (average >= 20) return "unhappy";
        if (average >= 10) return "troubled";
        return "miserable";
    }

    /**
     * Legacy mood calculation for backward compatibility
     */
    calculateMood(stats) {
        const happiness = stats.happiness || 50;
        const health = stats.health || 50;
        const energy = stats.energy || 50;

        const average = (happiness + health + energy) / 3;

        if (average >= 80) return "ecstatic";
        if (average >= 65) return "happy";
        if (average >= 50) return "content";
        if (average >= 35) return "tired";
        if (average >= 20) return "unhappy";
        return "miserable";
    }

    /**
     * Hash creature colors for personality generation
     */
    hashColors(colors) {
        let hash = 0;
        const colorString = JSON.stringify(colors);
        for (let i = 0; i < colorString.length; i++) {
            const char = colorString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Send a message and get a pre-written response
     * No external AI APIs are called - all responses are curated
     */
    async sendMessage(message, creatureData, context = {}) {
        this.totalRequests++;

        const response = this.generateFallbackResponse(message, creatureData);
        this.addToConversationHistory(message, response);

        return response;
    }

    /**
     * Generate pre-written response based on message type and creature personality
     * All responses are human-authored and curated for child safety
     */
    generateFallbackResponse(message, creatureData) {
        const personality = this.generatePersonality(creatureData);
        const responses = {
            greeting: [
                `Hello! I'm ${creatureData.name}, feeling ${personality.mood} today!`,
                `Hi there! I'm a ${personality.name} creature exploring this wonderful world!`,
                `Greetings! I'm ${creatureData.name}, and I'm ${personality.mood} to chat!`
            ],
            question: [
                `That's an interesting question! As a ${personality.name}, I think about these things differently.`,
                `Hmm, let me think about that. My experiences in this world have taught me...`,
                `I may not have all the answers, but I can share what I've learned exploring!`
            ],
            interaction: [
                `I love interacting with you! It makes me so ${personality.mood}!`,
                `Every conversation helps me grow and learn more about our world!`,
                `Thank you for talking with me! I feel more connected to everything around us.`
            ],
            default: [
                `I'm enjoying our conversation! Tell me more about what you're thinking.`,
                `This world is full of wonders. What else shall we explore together?`,
                `I feel ${personality.mood} and grateful for moments like this!`
            ]
        };

        let responseType = 'default';

        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
            responseType = 'greeting';
        } else if (message.includes('?')) {
            responseType = 'question';
        } else if (message.toLowerCase().includes('interact') || message.toLowerCase().includes('talk')) {
            responseType = 'interaction';
        }

        const responseList = responses[responseType];
        return responseList[Math.floor(Math.random() * responseList.length)];
    }

    /**
     * Add message to conversation history
     */
    addToConversationHistory(userMessage, aiResponse) {
        this.conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: aiResponse }
        );

        // Keep history within limits
        if (this.conversationHistory.length > this.maxHistoryLength * 2) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
        }
    }

    /**
     * Get current system status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            mode: 'pre-written', // Always pre-written responses
            totalRequests: this.totalRequests,
            conversationLength: this.conversationHistory.length,
            euAiActCompliant: true
        };
    }

    /**
     * Reset conversation history
     */
    resetConversation() {
        this.conversationHistory = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureAI;
}

// Make available globally for browser usage
window.CreatureAI = CreatureAI;
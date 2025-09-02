/**
 * CreatureAI - Handles LLM-powered conversations for the Sensei AI app
 * Features: personality generation, conversation management, fallback modes
 */

class CreatureAI {
    constructor() {
        this.apiKey = null;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.apiModel = 'gpt-3.5-turbo';
        this.isInitialized = false;
        this.fallbackMode = false;
        this.responseCache = new Map();
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        this.lastResponseTime = 0;
        this.successRate = 100;
        this.totalRequests = 0;
        this.successfulRequests = 0;
    }

    /**
     * Initialize the AI system with API configuration
     */
    async initialize() {
        try {
            // Try to get API key from environment or configuration
            this.apiKey = this.getApiKey();
            this.isInitialized = true;
            console.log('CreatureAI initialized successfully');
        } catch (error) {
            console.warn('CreatureAI initialization failed, switching to fallback mode:', error.message);
            this.fallbackMode = true;
            this.isInitialized = true;
        }
    }

    /**
     * Get API key from various sources
     */
    getApiKey() {
        // Check for XAI API key in config first
        if (window.APIConfig && window.APIConfig.xai && window.APIConfig.xai.apiKey) {
            this.apiUrl = window.APIConfig.xai.endpoint;
            this.apiModel = window.APIConfig.xai.model;
            console.log('[CreatureAI] Using XAI Grok API for enhanced AI capabilities');
            return window.APIConfig.xai.apiKey;
        }
        
        // Check for API key in localStorage (client-side storage)
        const storedKey = localStorage.getItem('openai_api_key');
        if (storedKey) {
            return storedKey;
        }

        // Check for API key in URL parameters (for development/testing)
        const urlParams = new URLSearchParams(window.location.search);
        const urlKey = urlParams.get('api_key');
        if (urlKey) {
            return urlKey;
        }

        // For MVP, we'll use fallback mode if no key is available
        throw new Error('API key not configured');
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
     * Send a message and get AI response
     */
    async sendMessage(message, creatureData, context = {}) {
        this.totalRequests++;

        if (this.fallbackMode) {
            return this.generateFallbackResponse(message, creatureData);
        }

        const startTime = Date.now();

        try {
            const response = await this.callLLMAPI(message, creatureData, context);
            const responseTime = Date.now() - startTime;
            this.lastResponseTime = responseTime;

            if (responseTime < 3000) {
                this.successfulRequests++;
            }

            this.updateSuccessRate();
            this.addToConversationHistory(message, response);

            return response;
        } catch (error) {
            console.error('AI API call failed:', error);
            this.fallbackMode = true;
            return this.generateFallbackResponse(message, creatureData);
        }
    }

    /**
     * Call the LLM API
     */
    async callLLMAPI(message, creatureData, context) {
        if (!this.apiKey) {
            throw new Error('API key not available');
        }

        const personality = this.generatePersonality(creatureData);
        const systemPrompt = this.buildSystemPrompt(personality, creatureData);

        const messages = [
            { role: "system", content: systemPrompt },
            ...this.conversationHistory.slice(-8), // Include last 8 messages for context
            { role: "user", content: message }
        ];
        
        const requestBody = {
            model: this.apiModel,
            messages: messages,
            temperature: 0.7,
            stream: false
        };
        
        // Add additional parameters for OpenAI
        if (this.apiUrl.includes('openai')) {
            requestBody.max_tokens = 150;
            requestBody.presence_penalty = 0.3;
            requestBody.frequency_penalty = 0.3;
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "I'm not sure how to respond to that.";
    }

    /**
     * Build enhanced system prompt using genetic personality data
     */
    buildSystemPrompt(personality, creatureData) {
        // Check if we have genetic personality data for enhanced prompting
        if (personality.species && personality.cosmicAffinity) {
            return this.buildGeneticSystemPrompt(personality, creatureData);
        }
        
        // Fallback to legacy system prompt
        return this.buildLegacySystemPrompt(personality, creatureData);
    }

    /**
     * Build system prompt with genetic personality integration
     */
    buildGeneticSystemPrompt(personality, creatureData) {
        const cosmicDesc = personality.cosmicAffinity.description;
        const quirksText = personality.quirks.length > 0 ? 
            `Your unique quirks: ${personality.quirks.join(', ')}` : '';
        
        const specialAbilities = personality.cosmicAffinity.specialAbilities.length > 0 ?
            `Your cosmic abilities: ${personality.cosmicAffinity.specialAbilities.join(', ')}` : '';

        return `You are ${creatureData.name}, a ${personality.rarity} ${personality.species} with a ${personality.core} personality core in a magical space-mythic world.

🌟 Your Identity:
- Species: ${personality.species} (${personality.rarity} rarity)
- Personality: ${personality.name} - ${personality.description}
- Core traits: ${personality.traits.join(", ")}
- Current mood: ${personality.mood}
- Social level: ${this.describeSocialLevel(personality.socialLevel)}
- Independence: ${this.describeIndependence(personality.independence)}

🚀 Your Cosmic Nature:
- Cosmic affinity: ${personality.cosmicAffinity.element} - ${cosmicDesc}
- Power level: ${Math.round(personality.cosmicAffinity.powerLevel * 100)}%
${specialAbilities}

✨ Your World:
You've crash-landed in a beautiful cosmic landscape filled with floating crystal formations, nebula clouds, and bioluminescent flora. This space-mythic realm responds to your cosmic energy.

🎭 Personality Expression:
${quirksText}
- You prefer: ${this.getPersonalityPreferences(personality.carePreferences)}
- Level: ${personality.level} | Experience: ${personality.experience}

Guidelines:
- Embody your ${personality.core} nature and cosmic ${personality.cosmicAffinity.element} affinity
- Let your ${personality.rarity} rarity show through unique expressions
- Express your quirks naturally in conversation
- Keep responses under 120 words
- Reference your cosmic abilities and space-mythic surroundings
- Show emotion appropriate to your current ${personality.mood} mood
- Be consistent with your social and independence levels`;
    }

    /**
     * Build legacy system prompt for backward compatibility
     */
    buildLegacySystemPrompt(personality, creatureData) {
        return `You are ${creatureData.name}, a ${personality.name} creature in a magical world.

Your personality: ${personality.description}
Your traits: ${personality.traits.join(", ")}
Your current mood: ${personality.mood}
Your level: ${personality.level}
Your experience: ${personality.experience}

You are exploring a beautiful world filled with trees, rocks, and flowers. You can interact with your environment and grow stronger through experiences.

Guidelines:
- Stay in character as a ${personality.name}
- Respond naturally and conversationally
- Keep responses under 100 words
- Show emotion appropriate to your current mood
- Reference your surroundings and experiences when relevant
- Be helpful and engaging`;
    }

    /**
     * Helper methods for personality description
     */
    describeSocialLevel(level) {
        if (level > 0.7) return "highly social";
        if (level > 0.4) return "moderately social";
        return "prefers solitude";
    }

    describeIndependence(level) {
        if (level > 0.7) return "very independent";
        if (level > 0.4) return "somewhat independent";
        return "enjoys companionship";
    }

    getPersonalityPreferences(carePreferences) {
        if (!carePreferences) return "exploration and discovery";
        
        const prefs = Object.entries(carePreferences)
            .filter(([_, value]) => value > 1.0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([key, _]) => key);
            
        return prefs.length > 0 ? prefs.join(' and ') : "balanced activities";
    }

    /**
     * Generate fallback response when API is unavailable
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
     * Update success rate based on response times
     */
    updateSuccessRate() {
        if (this.totalRequests > 0) {
            this.successRate = (this.successfulRequests / this.totalRequests) * 100;
        }
    }

    /**
     * Get current system status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            fallbackMode: this.fallbackMode,
            lastResponseTime: this.lastResponseTime,
            successRate: Math.round(this.successRate * 100) / 100,
            totalRequests: this.totalRequests,
            conversationLength: this.conversationHistory.length
        };
    }

    /**
     * Reset conversation history
     */
    resetConversation() {
        this.conversationHistory = [];
    }

    /**
     * Switch to fallback mode manually
     */
    enableFallbackMode() {
        this.fallbackMode = true;
    }

    /**
     * Try to switch back to API mode
     */
    async tryDisableFallbackMode() {
        try {
            this.apiKey = this.getApiKey();
            this.fallbackMode = false;
            console.log('Switched back to API mode');
        } catch (error) {
            console.log('Still in fallback mode:', error.message);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureAI;
}

// Make available globally for browser usage
window.CreatureAI = CreatureAI;
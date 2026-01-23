/**
 * ChatManager - Manages creature chat conversations
 * Supports scripted responses now, designed for AI integration later
 */

import { devLog } from '../utils/devLogger.js';

class ChatManager {
    constructor() {
        this.isInitialized = false;
        this.responses = null;
        this.conversationHistory = [];
        this.lastChatTime = 0;
        this.chatCooldown = 30000; // 30 seconds between mood boosts
        this.maxHistory = 10;

        // Event emitter pattern
        this.listeners = {};
    }

    /**
     * Initialize the chat system
     */
    async initialize() {
        try {
            // Load scripted responses
            const response = await fetch('/src/config/chat-responses.json');
            this.responses = await response.json();
            this.isInitialized = true;
            devLog('[ChatManager] Initialized with scripted responses');
        } catch (error) {
            console.error('[ChatManager] Failed to load responses:', error);
            // Use fallback responses
            this.responses = this.getFallbackResponses();
            this.isInitialized = true;
        }
    }

    /**
     * Get greeting based on creature personality and mood
     * May include space weather comments if exciting cosmic events are happening
     */
    getGreeting() {
        const genetics = window.GameState?.get('creature.genes');
        const stats = window.GameState?.get('creature.stats') || { happiness: 50 };
        const name = window.GameState?.get('creature.name') || 'Creature';

        if (!genetics || !this.responses) {
            return { text: `*${name} looks at you curiously*`, mood: 'neutral' };
        }

        const personality = genetics.personality?.core || 'curious';
        const mood = this.getMoodFromStats(stats);

        const greetings = this.responses.greetings?.[personality]?.[mood]
            || this.responses.greetings?.curious?.neutral
            || [`*${name} acknowledges you*`];

        let text = this.randomChoice(greetings).replace('{name}', name);

        // 40% chance to mention exciting space weather if available
        if (Math.random() < 0.4) {
            const spaceComment = this.getSpaceWeatherComment();
            if (spaceComment) {
                text = spaceComment;
            }
        }

        return { text, mood, personality };
    }

    /**
     * Get a space weather comment if exciting cosmic events are happening
     * Uses real NASA data from SpaceWeatherSystem
     */
    getSpaceWeatherComment() {
        if (!window.SpaceWeatherSystem?.isInitialized) {
            return null;
        }

        // Only comment if there's exciting space weather
        if (!window.SpaceWeatherSystem.hasExcitingNews()) {
            return null;
        }

        return window.SpaceWeatherSystem.getCreatureComment();
    }

    /**
     * Get response options for player to choose
     */
    getResponseOptions(context = 'general') {
        if (!this.responses) return this.getFallbackOptions();

        const options = this.responses.playerOptions?.[context] || this.responses.playerOptions?.general;

        // Return 3-4 random options
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4);
    }

    /**
     * Get creature response to player choice
     */
    getCreatureResponse(playerChoice) {
        const genetics = window.GameState?.get('creature.genes');
        const stats = window.GameState?.get('creature.stats') || { happiness: 50 };
        const name = window.GameState?.get('creature.name') || 'Creature';

        const personality = genetics?.personality?.core || 'curious';
        const mood = this.getMoodFromStats(stats);

        // Find matching response category
        const category = this.findResponseCategory(playerChoice);
        const responses = this.responses?.creatureResponses?.[category]?.[personality]
            || this.responses?.creatureResponses?.general?.[personality]
            || [`*${name} responds thoughtfully*`];

        const text = this.randomChoice(responses).replace('{name}', name);

        // Add to history
        this.addToHistory('player', playerChoice);
        this.addToHistory('creature', text);

        // Check if this chat should boost mood
        const moodBoost = this.checkMoodBoost();

        return {
            text,
            mood,
            personality,
            moodBoost,
            nextOptions: this.getResponseOptions('followup')
        };
    }

    /**
     * Check if mood should be boosted (cooldown-based)
     */
    checkMoodBoost() {
        const now = Date.now();
        if (now - this.lastChatTime >= this.chatCooldown) {
            this.lastChatTime = now;
            return { amount: 5, applied: true };
        }
        return { amount: 0, applied: false };
    }

    /**
     * Apply mood boost to creature
     */
    applyMoodBoost(amount) {
        if (!window.GameState || amount <= 0) return false;

        const currentHappiness = window.GameState.get('creature.stats.happiness') || 50;
        const newHappiness = Math.min(100, currentHappiness + amount);
        window.GameState.set('creature.stats.happiness', newHappiness);

        devLog(`[ChatManager] Applied mood boost: +${amount} happiness`);
        this.emit('moodBoosted', { amount, newHappiness });

        return true;
    }

    /**
     * Determine mood from stats
     */
    getMoodFromStats(stats) {
        const happiness = stats.happiness || 50;
        if (happiness >= 80) return 'happy';
        if (happiness >= 50) return 'neutral';
        if (happiness >= 30) return 'sad';
        return 'upset';
    }

    /**
     * Find response category from player choice
     */
    findResponseCategory(playerChoice) {
        const choice = playerChoice.toLowerCase();

        if (choice.includes('play') || choice.includes('fun')) return 'play';
        if (choice.includes('feel') || choice.includes('doing')) return 'feelings';
        if (choice.includes('adventure') || choice.includes('explore')) return 'adventure';
        if (choice.includes('eat') || choice.includes('hungry')) return 'food';
        if (choice.includes('love') || choice.includes('friend')) return 'affection';
        if (choice.includes('tell') || choice.includes('story')) return 'story';

        return 'general';
    }

    /**
     * Add message to conversation history
     */
    addToHistory(speaker, text) {
        this.conversationHistory.push({
            speaker,
            text,
            timestamp: Date.now()
        });

        // Trim history
        if (this.conversationHistory.length > this.maxHistory) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get fallback responses if config fails to load
     */
    getFallbackResponses() {
        return {
            greetings: {
                curious: {
                    happy: ['*{name} bounces excitedly to see you!*'],
                    neutral: ['*{name} tilts head curiously*'],
                    sad: ['*{name} looks up at you with big eyes*'],
                    upset: ['*{name} seems a bit down*']
                },
                playful: {
                    happy: ['*{name} does a happy spin!*'],
                    neutral: ['*{name} playfully nudges you*'],
                    sad: ['*{name} tries to smile*'],
                    upset: ['*{name} looks like they need cheering up*']
                },
                gentle: {
                    happy: ['*{name} nuzzles you warmly*'],
                    neutral: ['*{name} approaches gently*'],
                    sad: ['*{name} looks at you softly*'],
                    upset: ['*{name} seems to need comfort*']
                },
                wise: {
                    happy: ['*{name} greets you with knowing eyes*'],
                    neutral: ['*{name} regards you thoughtfully*'],
                    sad: ['*{name} seems contemplative*'],
                    upset: ['*{name} appears troubled*']
                },
                energetic: {
                    happy: ['*{name} zooms around you excitedly!*'],
                    neutral: ['*{name} bounces in place*'],
                    sad: ['*{name} has less bounce than usual*'],
                    upset: ['*{name} seems unusually still*']
                }
            },
            playerOptions: {
                general: [
                    'How are you feeling?',
                    'Want to play?',
                    'Tell me about your day',
                    'You\'re my best friend!'
                ],
                followup: [
                    'That sounds fun!',
                    'Tell me more',
                    'You\'re the best!',
                    'Let\'s go on an adventure!'
                ]
            },
            creatureResponses: {
                general: {
                    curious: ['*{name} chirps happily and explores nearby*'],
                    playful: ['*{name} does a little dance*'],
                    gentle: ['*{name} purrs contentedly*'],
                    wise: ['*{name} nods sagely*'],
                    energetic: ['*{name} zooms in circles!*']
                }
            }
        };
    }

    /**
     * Get fallback options
     */
    getFallbackOptions() {
        return [
            'How are you feeling?',
            'Want to play?',
            'Tell me about your day',
            'You\'re my best friend!'
        ];
    }

    /**
     * Random choice helper
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Event emitter methods
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback(data));
    }
}

// Create singleton instance
const chatManager = new ChatManager();

// Export for global access
window.ChatManager = chatManager;

export default chatManager;

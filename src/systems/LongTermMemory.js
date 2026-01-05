/**
 * LongTermMemory - Extended memory system for AI creature agents
 * Manages conversation history, relationships, and key-value storage
 * Extends CreatureMemory with agent-specific capabilities
 */

import { devLog, devWarn } from '../utils/devLogger.js';

class LongTermMemoryService {
    constructor() {
        this.initialized = false;
        this.gameState = null;
        this.maxConversationHistory = 100;
        this.maxSummarizedArchive = 20;
        this.maxKeyValueEntries = 50;
    }

    /**
     * Initialize long-term memory service
     */
    initialize(gameState = null) {
        if (this.initialized && gameState === this.gameState) {
            return this;
        }

        const resolvedGameState = gameState || (typeof window !== 'undefined' ? window.GameState : null);

        if (!resolvedGameState || typeof resolvedGameState.get !== 'function') {
            devWarn('[LongTermMemory] GameState not ready, standing by');
            return this;
        }

        this.gameState = resolvedGameState;

        // Ensure long-term memory node exists
        if (!this.gameState.get('longTermMemory')) {
            this.gameState.set('longTermMemory', {
                creatures: {},
                global: {
                    keyValue: {},
                    lastUpdated: null
                }
            });
        }

        this.initialized = true;
        devLog('[LongTermMemory] Initialized');
        return this;
    }

    /**
     * Ensure creature memory container exists
     */
    ensureCreatureMemory(creatureId) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const id = this.resolveCreatureId(creatureId);
        const path = `longTermMemory.creatures.${id}`;

        if (!this.gameState.get(path)) {
            this.gameState.set(path, {
                conversations: {
                    history: [],
                    summarizedArchive: [],
                    lastConversation: null
                },
                relationship: {
                    trust: 50,           // 0-100, starts neutral
                    familiarity: 0,      // 0-100, grows over time
                    mood: 'neutral',     // current mood toward player
                    sharedExperiences: [],
                    playerPreferences: {},
                    firstMet: Date.now(),
                    lastInteraction: null
                },
                keyValue: {},
                metadata: {
                    createdAt: Date.now(),
                    conversationCount: 0,
                    totalInteractions: 0
                }
            });
        }

        return true;
    }

    // ===== Conversation History =====

    /**
     * Add a message to conversation history
     */
    addConversation(role, content, creatureId = null, context = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const id = this.resolveCreatureId(creatureId);
        this.ensureCreatureMemory(id);

        const historyPath = `longTermMemory.creatures.${id}.conversations.history`;
        const history = [...(this.gameState.get(historyPath) || [])];

        const entry = {
            id: this.generateId('conv'),
            role, // 'user', 'creature', 'system'
            content,
            timestamp: Date.now(),
            context: {
                mood: context.mood || null,
                location: context.location || null,
                activity: context.activity || null
            }
        };

        history.push(entry);

        // Archive old conversations if exceeding limit
        if (history.length > this.maxConversationHistory) {
            const toArchive = history.splice(0, 20);
            this.archiveConversations(id, toArchive);
        }

        this.gameState.set(historyPath, history);
        this.gameState.set(`longTermMemory.creatures.${id}.conversations.lastConversation`, Date.now());
        this.updateInteractionCount(id);

        devLog('[LongTermMemory] Added conversation:', role, content.slice(0, 50));
        return entry;
    }

    /**
     * Get recent conversation history
     */
    getConversationHistory(creatureId = null, limit = 20) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return [];

        const id = this.resolveCreatureId(creatureId);
        const history = this.gameState.get(`longTermMemory.creatures.${id}.conversations.history`) || [];

        return [...history].slice(-limit);
    }

    /**
     * Archive old conversations with summary
     */
    archiveConversations(creatureId, messages) {
        if (!messages || messages.length === 0) return;

        const id = this.resolveCreatureId(creatureId);
        const archivePath = `longTermMemory.creatures.${id}.conversations.summarizedArchive`;
        const archive = [...(this.gameState.get(archivePath) || [])];

        // Create a summary of the archived messages
        const summary = {
            id: this.generateId('arch'),
            messageCount: messages.length,
            timeRange: {
                start: messages[0]?.timestamp,
                end: messages[messages.length - 1]?.timestamp
            },
            topics: this.extractTopics(messages),
            summary: this.generateSummary(messages),
            archivedAt: Date.now()
        };

        archive.push(summary);

        // Limit archive size
        if (archive.length > this.maxSummarizedArchive) {
            archive.shift();
        }

        this.gameState.set(archivePath, archive);
        devLog('[LongTermMemory] Archived', messages.length, 'messages');
    }

    /**
     * Extract topics from messages (simple keyword extraction)
     */
    extractTopics(messages) {
        const wordCounts = {};
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'you', 'we', 'they', 'it', 'to', 'and', 'of', 'in', 'for', 'on', 'with', 'my', 'your', 'do', 'can', 'what', 'how', 'that', 'this']);

        messages.forEach(msg => {
            const words = (msg.content || '')
                .toLowerCase()
                .replace(/[^a-z\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3 && !stopWords.has(w));

            words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
        });

        // Get top 5 topics
        return Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Generate a simple summary of messages
     */
    generateSummary(messages) {
        const userMessages = messages.filter(m => m.role === 'user').length;
        const creatureMessages = messages.filter(m => m.role === 'creature').length;
        const topics = this.extractTopics(messages);

        return `${userMessages} player messages, ${creatureMessages} creature responses. Topics: ${topics.join(', ') || 'general chat'}.`;
    }

    // ===== Relationship Tracking =====

    /**
     * Get relationship data for a creature
     */
    getRelationship(creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const id = this.resolveCreatureId(creatureId);
        this.ensureCreatureMemory(id);

        return this.gameState.get(`longTermMemory.creatures.${id}.relationship`) || null;
    }

    /**
     * Update relationship metrics
     */
    updateRelationship(creatureId = null, updates = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const id = this.resolveCreatureId(creatureId);
        this.ensureCreatureMemory(id);

        const basePath = `longTermMemory.creatures.${id}.relationship`;
        const current = this.gameState.get(basePath) || {};

        // Update trust (clamped 0-100)
        if (updates.trustDelta !== undefined) {
            const newTrust = Math.max(0, Math.min(100, (current.trust || 50) + updates.trustDelta));
            this.gameState.set(`${basePath}.trust`, newTrust);
        }

        // Update familiarity (only increases, clamped 0-100)
        if (updates.familiarityDelta !== undefined && updates.familiarityDelta > 0) {
            const newFamiliarity = Math.min(100, (current.familiarity || 0) + updates.familiarityDelta);
            this.gameState.set(`${basePath}.familiarity`, newFamiliarity);
        }

        // Update mood
        if (updates.mood) {
            this.gameState.set(`${basePath}.mood`, updates.mood);
        }

        // Add shared experience
        if (updates.experience) {
            const experiences = [...(current.sharedExperiences || [])];
            experiences.push({
                description: updates.experience,
                timestamp: Date.now()
            });
            // Keep last 20 experiences
            if (experiences.length > 20) experiences.shift();
            this.gameState.set(`${basePath}.sharedExperiences`, experiences);
        }

        // Store player preference
        if (updates.preference) {
            const prefs = { ...(current.playerPreferences || {}) };
            prefs[updates.preference.key] = updates.preference.value;
            this.gameState.set(`${basePath}.playerPreferences`, prefs);
        }

        this.gameState.set(`${basePath}.lastInteraction`, Date.now());

        devLog('[LongTermMemory] Updated relationship:', updates);
        return true;
    }

    /**
     * Get relationship level description
     */
    getRelationshipLevel(creatureId = null) {
        const relationship = this.getRelationship(creatureId);
        if (!relationship) return 'unknown';

        const trust = relationship.trust || 50;
        const familiarity = relationship.familiarity || 0;
        const combined = (trust + familiarity) / 2;

        if (combined >= 90) return 'best friends';
        if (combined >= 70) return 'close friends';
        if (combined >= 50) return 'friendly';
        if (combined >= 30) return 'acquaintances';
        if (combined >= 15) return 'strangers';
        return 'wary';
    }

    // ===== Key-Value Storage =====

    /**
     * Store a key-value pair in memory
     */
    store(key, value, creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        if (!key || typeof key !== 'string') {
            devWarn('[LongTermMemory] Invalid key:', key);
            return false;
        }

        const id = this.resolveCreatureId(creatureId);
        this.ensureCreatureMemory(id);

        const kvPath = `longTermMemory.creatures.${id}.keyValue`;
        const kv = { ...(this.gameState.get(kvPath) || {}) };

        kv[key] = {
            value,
            storedAt: Date.now(),
            updatedAt: Date.now()
        };

        // Limit total entries
        const keys = Object.keys(kv);
        if (keys.length > this.maxKeyValueEntries) {
            // Remove oldest entries
            const sorted = keys
                .map(k => ({ key: k, ...kv[k] }))
                .sort((a, b) => a.updatedAt - b.updatedAt);

            sorted.slice(0, keys.length - this.maxKeyValueEntries).forEach(entry => {
                delete kv[entry.key];
            });
        }

        this.gameState.set(kvPath, kv);
        devLog('[LongTermMemory] Stored:', key);
        return true;
    }

    /**
     * Retrieve a value from memory
     */
    retrieve(key, creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const id = this.resolveCreatureId(creatureId);
        const entry = this.gameState.get(`longTermMemory.creatures.${id}.keyValue.${key}`);

        return entry?.value || null;
    }

    /**
     * Get all stored keys
     */
    getAllKeys(creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return [];

        const id = this.resolveCreatureId(creatureId);
        const kv = this.gameState.get(`longTermMemory.creatures.${id}.keyValue`) || {};

        return Object.keys(kv);
    }

    /**
     * Remove a key from memory
     */
    forget(key, creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const id = this.resolveCreatureId(creatureId);
        const kvPath = `longTermMemory.creatures.${id}.keyValue`;
        const kv = { ...(this.gameState.get(kvPath) || {}) };

        if (kv[key]) {
            delete kv[key];
            this.gameState.set(kvPath, kv);
            devLog('[LongTermMemory] Forgot:', key);
            return true;
        }

        return false;
    }

    // ===== Context Building =====

    /**
     * Get memory context for LLM prompts
     */
    getContextForPrompt(creatureId = null, options = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return {};

        const id = this.resolveCreatureId(creatureId);
        this.ensureCreatureMemory(id);

        const context = {
            conversationHistory: [],
            relationship: null,
            memories: {},
            metadata: null
        };

        // Get recent conversation history
        if (options.includeHistory !== false) {
            context.conversationHistory = this.getConversationHistory(id, options.historyLimit || 10);
        }

        // Get relationship info
        if (options.includeRelationship !== false) {
            const rel = this.getRelationship(id);
            if (rel) {
                context.relationship = {
                    level: this.getRelationshipLevel(id),
                    trust: rel.trust,
                    familiarity: rel.familiarity,
                    mood: rel.mood,
                    recentExperiences: (rel.sharedExperiences || []).slice(-5),
                    preferences: rel.playerPreferences || {}
                };
            }
        }

        // Get stored memories
        if (options.includeMemories !== false) {
            const kv = this.gameState.get(`longTermMemory.creatures.${id}.keyValue`) || {};
            Object.entries(kv).forEach(([key, entry]) => {
                context.memories[key] = entry.value;
            });
        }

        // Get metadata
        const metadata = this.gameState.get(`longTermMemory.creatures.${id}.metadata`);
        if (metadata) {
            context.metadata = {
                conversationCount: metadata.conversationCount || 0,
                totalInteractions: metadata.totalInteractions || 0,
                daysSinceMet: Math.floor((Date.now() - (metadata.createdAt || Date.now())) / (1000 * 60 * 60 * 24))
            };
        }

        return context;
    }

    // ===== Utilities =====

    resolveCreatureId(creatureId) {
        if (creatureId) return creatureId;

        const genetics = this.gameState?.get('creature.genes');
        if (genetics?.id) return genetics.id;

        return 'active-creature';
    }

    updateInteractionCount(creatureId) {
        const id = this.resolveCreatureId(creatureId);
        const metaPath = `longTermMemory.creatures.${id}.metadata`;
        const meta = this.gameState.get(metaPath) || {};

        meta.conversationCount = (meta.conversationCount || 0) + 1;
        meta.totalInteractions = (meta.totalInteractions || 0) + 1;

        this.gameState.set(metaPath, meta);

        // Increase familiarity slightly with each interaction
        this.updateRelationship(id, { familiarityDelta: 0.5 });
    }

    generateId(prefix = 'ltm') {
        const entropy = Math.random().toString(36).slice(2, 8);
        return `${prefix}_${Date.now().toString(36)}_${entropy}`;
    }

    /**
     * Clear all memory for a creature
     */
    clearCreatureMemory(creatureId = null, reason = 'user_clear') {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const id = this.resolveCreatureId(creatureId);
        const path = `longTermMemory.creatures.${id}`;

        if (this.gameState.get(path)) {
            this.gameState.set(path, null);

            this.gameState.emit('longTermMemory/cleared', {
                creatureId: id,
                reason,
                timestamp: Date.now()
            });

            devLog('[LongTermMemory] Cleared memory for:', id);
            return true;
        }

        return false;
    }
}

// Singleton wiring
window.LongTermMemory = window.LongTermMemory || new LongTermMemoryService();
window.LongTermMemory.initialize();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LongTermMemoryService;
}

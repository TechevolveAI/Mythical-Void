/**
 * CreatureMemoryService - Persisted memory + diary timeline for AI companions.
 * Handles opt-in privacy, per-creature timelines, and deletion controls.
 */

class CreatureMemoryService {
    constructor() {
        this.initialized = false;
        this.gameState = null;
        this.maxEntriesPerCreature = 120;
        this.maxDeletionLog = 60;
    }

    /**
     * Initialize memory service with GameState (defaults to window.GameState)
     */
    initialize(gameState = null) {
        if (this.initialized && gameState === this.gameState) {
            return this;
        }

        const resolvedGameState = gameState || (typeof window !== 'undefined' ? window.GameState : null);

        if (!resolvedGameState || typeof resolvedGameState.get !== 'function') {
            console.warn('memory:warn [CreatureMemory] GameState not ready, memory service standing by');
            return this;
        }

        this.gameState = resolvedGameState;

        // Ensure memory node exists in state tree
        if (!this.gameState.get('memory')) {
            this.gameState.set('memory', {
                optIn: false,
                lastOptInChange: null,
                lastPurge: null,
                deletionLog: [],
                creatures: {}
            });
        }

        this.initialized = true;
        console.log('memory:info [CreatureMemory] Memory service initialized', {
            optIn: this.gameState.get('memory.optIn'),
            storedCreatures: Object.keys(this.gameState.get('memory.creatures') || {}).length
        });

        return this;
    }

    isTrackingEnabled() {
        if (!this.initialized) this.initialize();
        return !!(this.gameState && this.gameState.get('memory.optIn'));
    }

    /**
     * Toggle creature memory tracking (requires explicit opt-in)
     */
    setOptIn(enabled, metadata = {}) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return false;

        const now = Date.now();
        const flag = !!enabled;

        this.gameState.set('memory.optIn', flag);
        this.gameState.set('memory.lastOptInChange', now);

        if (metadata?.source) {
            const auditEntry = {
                type: 'opt_in_change',
                enabled: flag,
                source: metadata.source,
                reason: metadata.reason || 'unspecified',
                timestamp: now
            };
            this.appendDeletionLog(auditEntry);
        }

        this.gameState.emit('memory/opt_in_changed', {
            enabled: flag,
            timestamp: now,
            metadata
        });

        return flag;
    }

    /**
     * Store an interaction or milestone in the creature's diary timeline.
     */
    logEntry({
        creatureId = null,
        type = 'interaction',
        summary,
        details = null,
        tags = [],
        moodSnapshot = null,
        source = 'system'
    }) {
        if (!summary) {
            console.warn('memory:warn [CreatureMemory] Cannot log entry without summary');
            return null;
        }

        if (!this.isTrackingEnabled()) {
            console.info('memory:info [CreatureMemory] Skipping memory log - tracking disabled');
            return null;
        }

        const resolvedCreatureId = this.resolveCreatureId(creatureId);
        const timelinePath = `memory.creatures.${resolvedCreatureId}.timeline`;
        const timeline = [...(this.gameState.get(timelinePath) || [])];

        const entry = {
            id: this.generateEntryId(resolvedCreatureId),
            creatureId: resolvedCreatureId,
            creatureName: this.gameState.get('creature.name') || 'Your Creature',
            type,
            summary,
            details,
            tags: Array.isArray(tags) ? tags.slice(0, 6) : [],
            moodSnapshot: moodSnapshot || this.captureMoodSnapshot(),
            source,
            createdAt: Date.now()
        };

        timeline.push(entry);

        if (timeline.length > this.maxEntriesPerCreature) {
            timeline.splice(0, timeline.length - this.maxEntriesPerCreature);
        }

        this.ensureCreatureContainer(resolvedCreatureId);
        this.gameState.set(timelinePath, timeline);
        this.refreshTimelineSummary(resolvedCreatureId, timeline);

        this.gameState.emit('memory/entry_added', { entry });

        return entry;
    }

    /**
     * Retrieve timeline entries for a creature.
     */
    getTimeline(creatureId = null, limit = 50) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return [];

        const resolvedCreatureId = this.resolveCreatureId(creatureId);
        const timeline = [...(this.gameState.get(`memory.creatures.${resolvedCreatureId}.timeline`) || [])];

        return timeline
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    /**
     * Remove a single diary entry (privacy control).
     */
    deleteEntry(creatureId, entryId, reason = 'user_delete') {
        if (!this.isTrackingEnabled()) return false;

        const resolvedCreatureId = this.resolveCreatureId(creatureId);
        const timelinePath = `memory.creatures.${resolvedCreatureId}.timeline`;
        const timeline = [...(this.gameState.get(timelinePath) || [])];

        const entryIndex = timeline.findIndex(entry => entry.id === entryId);
        if (entryIndex === -1) {
            console.warn(`memory:warn [CreatureMemory] Entry ${entryId} not found for ${resolvedCreatureId}`);
            return false;
        }

        const [removedEntry] = timeline.splice(entryIndex, 1);
        this.gameState.set(timelinePath, timeline);
        this.refreshTimelineSummary(resolvedCreatureId, timeline);

        const deletionInfo = {
            type: 'entry_deleted',
            creatureId: resolvedCreatureId,
            entryId,
            reason,
            deletedAt: Date.now()
        };
        this.appendDeletionLog(deletionInfo);

        this.gameState.emit('memory/entry_deleted', deletionInfo);

        return true;
    }

    /**
     * Clear entire timeline for a creature (opt-in privacy reset).
     */
    clearTimeline(creatureId = null, reason = 'user_wipe') {
        if (!this.isTrackingEnabled()) return false;

        const resolvedCreatureId = this.resolveCreatureId(creatureId);
        const timelinePath = `memory.creatures.${resolvedCreatureId}.timeline`;
        const hadEntries = (this.gameState.get(timelinePath) || []).length > 0;

        this.ensureCreatureContainer(resolvedCreatureId);
        this.gameState.set(timelinePath, []);
        this.refreshTimelineSummary(resolvedCreatureId, []);

        const purgeInfo = {
            type: 'timeline_cleared',
            creatureId: resolvedCreatureId,
            reason,
            clearedAt: Date.now()
        };

        this.appendDeletionLog(purgeInfo);
        this.gameState.set('memory.lastPurge', purgeInfo.clearedAt);
        this.gameState.emit('memory/timeline_cleared', purgeInfo);

        return hadEntries;
    }

    /**
     * Get summary metadata for a creature timeline.
     */
    getTimelineSummary(creatureId = null) {
        if (!this.initialized) this.initialize();
        if (!this.gameState) return null;

        const resolvedCreatureId = this.resolveCreatureId(creatureId);
        const summary = this.gameState.get(`memory.creatures.${resolvedCreatureId}.summary`);

        return summary ? { ...summary } : null;
    }

    /**
     * Helper to guarantee creature container exists.
     */
    ensureCreatureContainer(creatureId) {
        const basePath = `memory.creatures.${creatureId}`;
        const existing = this.gameState.get(basePath);

        if (!existing) {
            this.gameState.set(basePath, {
                createdAt: Date.now(),
                lastUpdated: null,
                summary: {
                    totalEntries: 0,
                    lastEntryAt: null,
                    categories: {}
                },
                timeline: []
            });
        }
    }

    refreshTimelineSummary(creatureId, timeline = []) {
        const summaryPath = `memory.creatures.${creatureId}.summary`;
        const categories = {};

        timeline.forEach(entry => {
            categories[entry.type] = (categories[entry.type] || 0) + 1;
        });

        const summary = {
            totalEntries: timeline.length,
            lastEntryAt: timeline.length > 0 ? timeline[timeline.length - 1].createdAt : null,
            categories
        };

        this.gameState.set(summaryPath, summary);
        this.gameState.set(`memory.creatures.${creatureId}.lastUpdated`, summary.lastEntryAt);
    }

    appendDeletionLog(entry) {
        const log = [...(this.gameState.get('memory.deletionLog') || [])];
        log.push(entry);

        if (log.length > this.maxDeletionLog) {
            log.splice(0, log.length - this.maxDeletionLog);
        }

        this.gameState.set('memory.deletionLog', log);
    }

    resolveCreatureId(creatureId) {
        if (creatureId) return creatureId;

        const genetics = this.gameState?.get('creature.genetics');
        if (genetics?.id) return genetics.id;

        return 'active-creature';
    }

    captureMoodSnapshot() {
        if (!this.gameState) return null;

        const stats = this.gameState.get('creature.stats') || {};

        return {
            happiness: stats.happiness ?? null,
            energy: stats.energy ?? null,
            health: stats.health ?? null,
            level: this.gameState.get('creature.level') ?? null,
            rarity: this.gameState.get('creature.rarity') || null
        };
    }

    generateEntryId(creatureId) {
        const entropy = Math.random().toString(16).slice(2, 8);
        return `mem_${creatureId}_${Date.now().toString(36)}_${entropy}`;
    }
}

// Singleton wiring
window.CreatureMemory = window.CreatureMemory || new CreatureMemoryService();
window.CreatureMemory.initialize();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatureMemoryService;
}

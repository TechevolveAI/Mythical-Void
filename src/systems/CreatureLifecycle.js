/**
 * CreatureLifecycle - Manages creature evolution stages, aging, mood, and departure
 *
 * Handles:
 * - Stage calculation based on days alive
 * - Evolution detection and triggering
 * - Abandonment detection when player is away
 * - Mood management affecting evolution
 * - Departure warnings and ceremony
 */

import evolutionConfig from '../config/evolution.json';

class CreatureLifecycleManager {
    constructor() {
        this.config = evolutionConfig;
        this.stageOrder = this.config.stageOrder;
        this.initialized = false;

        // Make evolution config available globally for other systems (GraphicsEngine)
        if (typeof window !== 'undefined') {
            window.evolutionConfig = evolutionConfig;
        }
    }

    /**
     * Initialize the lifecycle system
     * Call this when game starts to check for evolution/abandonment
     */
    initialize() {
        if (this.initialized) return;

        console.log('[CreatureLifecycle] Initializing lifecycle system');
        this.initialized = true;
    }

    // ==========================================
    // STAGE CALCULATION
    // ==========================================

    /**
     * Get the number of days a creature has been alive
     * @param {number} birthDate - Timestamp of creature birth
     * @returns {number} Days alive (can be fractional)
     */
    getDaysAlive(birthDate) {
        if (!birthDate) return 0;

        const now = Date.now();
        const msAlive = now - birthDate;
        const daysAlive = msAlive / (1000 * 60 * 60 * 24);

        return daysAlive;
    }

    /**
     * Get the number of full days a creature has been alive
     * @param {number} birthDate - Timestamp of creature birth
     * @returns {number} Full days alive
     */
    getFullDaysAlive(birthDate) {
        return Math.floor(this.getDaysAlive(birthDate));
    }

    /**
     * Calculate what stage a creature should be based on days alive
     * @param {number} birthDate - Timestamp of creature birth
     * @returns {string} Stage ID: 'baby', 'juvenile', 'adult', 'elder'
     */
    calculateStage(birthDate) {
        const daysAlive = this.getFullDaysAlive(birthDate);

        // Check stages in reverse order (elder -> adult -> juvenile -> baby)
        for (let i = this.stageOrder.length - 1; i >= 0; i--) {
            const stageId = this.stageOrder[i];
            const stageConfig = this.config.stages[stageId];

            if (daysAlive >= stageConfig.daysRequired) {
                return stageId;
            }
        }

        return 'baby';
    }

    /**
     * Get the next stage after the current one
     * @param {string} currentStage - Current stage ID
     * @returns {string|null} Next stage ID or null if at max
     */
    getNextStage(currentStage) {
        const currentIndex = this.stageOrder.indexOf(currentStage);

        if (currentIndex === -1 || currentIndex >= this.stageOrder.length - 1) {
            return null;
        }

        return this.stageOrder[currentIndex + 1];
    }

    /**
     * Get days until next stage
     * @param {number} birthDate - Timestamp of creature birth
     * @param {string} currentStage - Current stage ID
     * @returns {number} Days until next stage, or -1 if at max stage
     */
    getDaysUntilNextStage(birthDate, currentStage) {
        const nextStage = this.getNextStage(currentStage);

        if (!nextStage) return -1;

        const nextStageConfig = this.config.stages[nextStage];
        const daysAlive = this.getDaysAlive(birthDate);
        const daysRemaining = nextStageConfig.daysRequired - daysAlive;

        return Math.max(0, daysRemaining);
    }

    /**
     * Get days until departure (day 90)
     * @param {number} birthDate - Timestamp of creature birth
     * @returns {number} Days until departure
     */
    getDaysUntilDeparture(birthDate) {
        const totalLifespan = this.config.departure.totalLifespanDays;
        const daysAlive = this.getDaysAlive(birthDate);

        return Math.max(0, totalLifespan - daysAlive);
    }

    /**
     * Get stage configuration
     * @param {string} stageId - Stage ID
     * @returns {Object} Stage configuration
     */
    getStageConfig(stageId) {
        return this.config.stages[stageId] || this.config.stages.baby;
    }

    /**
     * Get visual configuration for a stage
     * @param {string} stageId - Stage ID
     * @returns {Object} Visual configuration
     */
    getStageVisualConfig(stageId) {
        const stageConfig = this.getStageConfig(stageId);
        return stageConfig.visual || {};
    }

    /**
     * Get stat modifiers for a stage
     * @param {string} stageId - Stage ID
     * @returns {Object} Stat modifiers
     */
    getStageStatModifiers(stageId) {
        const stageConfig = this.getStageConfig(stageId);
        return stageConfig.stats || {};
    }

    /**
     * Get progress percentage through current stage
     * @param {number} birthDate - Timestamp of creature birth
     * @param {string} currentStage - Current stage ID
     * @returns {number} Progress percentage (0-100)
     */
    getStageProgress(birthDate, currentStage) {
        const stageConfig = this.getStageConfig(currentStage);
        const nextStage = this.getNextStage(currentStage);

        if (!nextStage) {
            // Elder stage - progress toward departure
            const daysAlive = this.getDaysAlive(birthDate);
            const elderStart = stageConfig.daysRequired;
            const departureDay = this.config.departure.totalLifespanDays;
            const elderDuration = departureDay - elderStart;
            const daysInElder = daysAlive - elderStart;

            return Math.min(100, (daysInElder / elderDuration) * 100);
        }

        const nextStageConfig = this.config.stages[nextStage];
        const daysAlive = this.getDaysAlive(birthDate);
        const stageStart = stageConfig.daysRequired;
        const stageEnd = nextStageConfig.daysRequired;
        const stageDuration = stageEnd - stageStart;
        const daysInStage = daysAlive - stageStart;

        return Math.min(100, Math.max(0, (daysInStage / stageDuration) * 100));
    }

    // ==========================================
    // EVOLUTION DETECTION
    // ==========================================

    /**
     * Check if creature should evolve
     * @param {Object} creatureData - Creature state from GameState (optional, will fetch if not provided)
     * @returns {Object} Evolution check result
     */
    checkForEvolution(creatureData) {
        // Get creature data from GameState if not provided
        if (!creatureData) {
            creatureData = window.GameState?.get('creature') || {};
        }
        const lifecycle = creatureData.lifecycle || {};
        const mood = creatureData.mood || {};
        const stats = creatureData.stats || {};

        const birthDate = lifecycle.birthDate;
        const currentStage = lifecycle.stage || 'baby';
        const isStuck = lifecycle.isStuck || false;

        // No evolution if no birth date
        if (!birthDate) {
            return { shouldEvolve: false, reason: 'no_birth_date' };
        }

        // No evolution if stuck
        if (isStuck) {
            return {
                shouldEvolve: false,
                reason: 'stuck',
                stuckReason: lifecycle.stuckReason
            };
        }

        // Check happiness requirement
        const minHappiness = this.config.evolution.minimumHappinessToEvolve;
        if (stats.happiness < minHappiness) {
            return {
                shouldEvolve: false,
                reason: 'low_happiness',
                currentHappiness: stats.happiness,
                requiredHappiness: minHappiness
            };
        }

        // Check mood - can't evolve if sad or abandoned
        if (mood.current === 'sad' || mood.current === 'abandoned') {
            return {
                shouldEvolve: false,
                reason: 'bad_mood',
                mood: mood.current
            };
        }

        // Calculate expected stage based on days alive
        const expectedStage = this.calculateStage(birthDate);

        // Check if stage should change
        const currentIndex = this.stageOrder.indexOf(currentStage);
        const expectedIndex = this.stageOrder.indexOf(expectedStage);

        if (expectedIndex > currentIndex) {
            const nextStage = this.stageOrder[currentIndex + 1];
            return {
                shouldEvolve: true,
                fromStage: currentStage,
                toStage: nextStage,
                expectedStage: expectedStage,
                skippedStages: expectedIndex - currentIndex - 1
            };
        }

        return { shouldEvolve: false, reason: 'not_ready' };
    }

    /**
     * Get evolution celebration config
     * @param {string} fromStage - Stage evolving from
     * @param {string} toStage - Stage evolving to
     * @returns {Object} Celebration configuration
     */
    getEvolutionCelebration(fromStage, toStage) {
        const key = `${fromStage}_to_${toStage}`;
        return this.config.evolution.celebrations[key] || null;
    }

    // ==========================================
    // ABANDONMENT DETECTION
    // ==========================================

    /**
     * Check if creature has been abandoned (player away too long)
     * @param {number} lastSessionEnd - Timestamp of last session end (optional, will fetch if not provided)
     * @returns {Object} Abandonment check result
     */
    checkForAbandonment(lastSessionEnd) {
        // Get lastSessionEnd from GameState if not provided
        if (lastSessionEnd === undefined) {
            lastSessionEnd = window.GameState?.get('session.lastSessionEnd');
        }
        if (!lastSessionEnd) {
            return { isAbandoned: false, wasAbandoned: false, reason: 'no_last_session' };
        }

        const now = Date.now();
        const msOffline = now - lastSessionEnd;
        const daysOffline = msOffline / (1000 * 60 * 60 * 24);
        const threshold = this.config.mood.abandonmentRules.daysOfflineToTrigger;

        if (daysOffline >= threshold) {
            return {
                isAbandoned: true,
                daysOffline: daysOffline,
                threshold: threshold,
                happinessDrop: Math.min(
                    this.config.mood.abandonmentRules.happinessDropPerDay * daysOffline,
                    100 - this.config.mood.abandonmentRules.minimumHappiness
                )
            };
        }

        return {
            isAbandoned: false,
            daysOffline: daysOffline,
            threshold: threshold
        };
    }

    /**
     * Calculate happiness after being offline
     * @param {number} currentHappiness - Current happiness value
     * @param {number} daysOffline - Days player was offline
     * @returns {number} New happiness value
     */
    calculateOfflineHappinessDrop(currentHappiness, daysOffline) {
        const rules = this.config.mood.abandonmentRules;
        const drop = rules.happinessDropPerDay * daysOffline;
        const newHappiness = currentHappiness - drop;

        return Math.max(rules.minimumHappiness, newHappiness);
    }

    /**
     * Process return from extended absence
     * @param {Object} creatureData - Creature state from GameState (optional, will fetch if not provided)
     * @param {number} lastSessionEnd - Timestamp of last session end (optional, will fetch if not provided)
     * @returns {Object} Return processing result
     */
    processReturnFromAbsence(creatureData, lastSessionEnd) {
        // Get creature data from GameState if not provided
        if (!creatureData) {
            creatureData = window.GameState?.get('creature') || {};
        }
        // Get lastSessionEnd from GameState if not provided
        if (lastSessionEnd === undefined) {
            lastSessionEnd = window.GameState?.get('session.lastSessionEnd');
        }
        const abandonmentCheck = this.checkForAbandonment(lastSessionEnd);
        const result = {
            wasAbandoned: abandonmentCheck.isAbandoned,
            daysOffline: abandonmentCheck.daysOffline || 0,
            happinessBefore: creatureData.stats?.happiness || 100,
            happinessAfter: creatureData.stats?.happiness || 100,
            evolutionBlocked: false,
            moodChange: null,
            stageEvolved: false,
            newStage: null
        };

        if (!abandonmentCheck.isAbandoned) {
            // Normal return - check for evolution
            const evolutionCheck = this.checkForEvolution(creatureData);
            if (evolutionCheck.shouldEvolve) {
                result.stageEvolved = true;
                result.newStage = evolutionCheck.toStage;
            }
            return result;
        }

        // Abandoned - apply happiness drop
        result.happinessAfter = this.calculateOfflineHappinessDrop(
            result.happinessBefore,
            abandonmentCheck.daysOffline
        );

        // Determine new mood
        result.moodChange = this.calculateMood(result.happinessAfter);

        // Check if evolution should happen (max 1 stage when abandoned)
        const lifecycle = creatureData.lifecycle || {};
        const currentStage = lifecycle.stage || 'baby';
        const birthDate = lifecycle.birthDate;

        if (birthDate) {
            const expectedStage = this.calculateStage(birthDate);
            const currentIndex = this.stageOrder.indexOf(currentStage);
            const expectedIndex = this.stageOrder.indexOf(expectedStage);

            // Allow max 1 evolution when abandoned
            if (expectedIndex > currentIndex) {
                const nextStage = this.stageOrder[currentIndex + 1];
                result.stageEvolved = true;
                result.newStage = nextStage;

                // If they should be more than 1 stage ahead, block further evolution
                if (expectedIndex > currentIndex + 1) {
                    result.evolutionBlocked = true;
                }
            }
        }

        // Block evolution if creature is sad/abandoned
        if (result.moodChange === 'sad' || result.moodChange === 'abandoned') {
            result.evolutionBlocked = true;
        }

        return result;
    }

    // ==========================================
    // MOOD MANAGEMENT
    // ==========================================

    /**
     * Calculate mood based on happiness
     * @param {number} happiness - Current happiness value
     * @returns {string} Mood: 'happy', 'neutral', 'sad', 'abandoned'
     */
    calculateMood(happiness) {
        const thresholds = this.config.mood.thresholds;

        if (happiness >= thresholds.happy.minHappiness) return 'happy';
        if (happiness >= thresholds.neutral.minHappiness) return 'neutral';
        if (happiness >= thresholds.sad.minHappiness) return 'sad';
        return 'abandoned';
    }

    /**
     * Get mood visual effects
     * @param {string} mood - Current mood
     * @returns {Object} Visual effect configuration
     */
    getMoodVisualEffects(mood) {
        if (mood === 'happy' || mood === 'neutral') {
            return { saturationMultiplier: 1.0, brightnessMultiplier: 1.0 };
        }

        return this.config.mood.visualEffects[mood] || {};
    }

    /**
     * Get mood color
     * @param {string} mood - Current mood
     * @returns {string} Hex color for mood
     */
    getMoodColor(mood) {
        return this.config.mood.thresholds[mood]?.color || '#FFFFFF';
    }

    /**
     * Check if creature can evolve based on mood
     * @param {string} mood - Current mood
     * @returns {boolean} Whether evolution is allowed
     */
    canEvolveWithMood(mood) {
        return mood === 'happy' || mood === 'neutral';
    }

    // ==========================================
    // DEPARTURE WARNINGS
    // ==========================================

    /**
     * Check for departure warnings
     * @param {number} birthDate - Timestamp of creature birth
     * @param {Object} warnings - Current warning flags
     * @returns {Object|null} Warning to show, or null
     */
    checkDepartureWarnings(birthDate, warnings = {}) {
        const daysAlive = this.getFullDaysAlive(birthDate);
        const warningDays = this.config.departure.warningDays;

        for (const day of warningDays) {
            const warningKey = `day${day}Shown`;

            if (daysAlive >= day && !warnings[warningKey]) {
                const warningConfig = this.config.departure.warnings[`day${day}`];
                return {
                    day: day,
                    key: warningKey,
                    ...warningConfig
                };
            }
        }

        return null;
    }

    /**
     * Check if creature should depart
     * @param {number} birthDate - Timestamp of creature birth
     * @returns {boolean} Whether creature should depart
     */
    shouldDepart(birthDate) {
        const daysAlive = this.getDaysAlive(birthDate);
        return daysAlive >= this.config.departure.totalLifespanDays;
    }

    /**
     * Get departure ceremony configuration
     * @returns {Object} Ceremony configuration
     */
    getDepartureCeremonyConfig() {
        return this.config.departure.ceremony;
    }

    /**
     * Get legacy configuration
     * @returns {Object} Legacy bonuses configuration
     */
    getLegacyConfig() {
        return this.config.departure.legacy;
    }

    // ==========================================
    // HATCHING CONFIGURATION
    // ==========================================

    /**
     * Get hatching vision reveal configuration
     * @returns {Object} Vision reveal configuration
     */
    getHatchingVisionConfig() {
        return this.config.hatching.visionReveal;
    }

    // ==========================================
    // AUDIO CONFIGURATION
    // ==========================================

    /**
     * Get audio configuration for a stage
     * @param {string} stageId - Stage ID
     * @returns {Object} Audio configuration
     */
    getStageAudioConfig(stageId) {
        return this.config.audio.stageAmbience[stageId] || {};
    }

    /**
     * Get evolution sound configuration
     * @returns {Object} Evolution sound configuration
     */
    getEvolutionSoundConfig() {
        return this.config.audio.evolutionSounds;
    }

    /**
     * Get mood sound configuration
     * @param {string} mood - Current mood
     * @returns {Object} Mood sound configuration
     */
    getMoodSoundConfig(mood) {
        return this.config.audio.moodSounds[mood] || {};
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Format days as human-readable string
     * @param {number} days - Number of days
     * @returns {string} Formatted string
     */
    formatDays(days) {
        if (days < 0) return 'N/A';
        if (days < 1) {
            const hours = Math.floor(days * 24);
            if (hours < 1) {
                const minutes = Math.floor(days * 24 * 60);
                return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        const fullDays = Math.floor(days);
        return `${fullDays} day${fullDays !== 1 ? 's' : ''}`;
    }

    /**
     * Get comprehensive lifecycle status
     * @param {Object} creatureData - Creature state from GameState (optional, will fetch if not provided)
     * @returns {Object} Full lifecycle status
     */
    getLifecycleStatus(creatureData) {
        // Get creature data from GameState if not provided
        if (!creatureData) {
            creatureData = window.GameState?.get('creature') || {};
        }
        const lifecycle = creatureData.lifecycle || {};
        const mood = creatureData.mood || {};
        const stats = creatureData.stats || {};

        const birthDate = lifecycle.birthDate;
        const currentStage = lifecycle.stage || 'baby';

        if (!birthDate) {
            return {
                stage: 'baby',
                daysAlive: 0,
                stageProgress: 0,
                daysUntilNextStage: -1,
                daysUntilDeparture: 90,
                mood: 'happy',
                canEvolve: false,
                isStuck: false,
                warnings: []
            };
        }

        const daysAlive = this.getDaysAlive(birthDate);
        const currentMood = this.calculateMood(stats.happiness || 100);

        return {
            stage: currentStage,
            stageConfig: this.getStageConfig(currentStage),
            daysAlive: daysAlive,
            fullDaysAlive: Math.floor(daysAlive),
            stageProgress: this.getStageProgress(birthDate, currentStage),
            nextStage: this.getNextStage(currentStage),
            daysUntilNextStage: this.getDaysUntilNextStage(birthDate, currentStage),
            daysUntilDeparture: this.getDaysUntilDeparture(birthDate),
            mood: currentMood,
            moodColor: this.getMoodColor(currentMood),
            canEvolve: this.canEvolveWithMood(currentMood) && !lifecycle.isStuck,
            isStuck: lifecycle.isStuck || false,
            stuckReason: lifecycle.stuckReason || null,
            shouldDepart: this.shouldDepart(birthDate),
            pendingWarning: this.checkDepartureWarnings(birthDate, lifecycle.warnings)
        };
    }
}

// Create singleton instance
const CreatureLifecycle = new CreatureLifecycleManager();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CreatureLifecycle = CreatureLifecycle;
}

// Export for module systems
export default CreatureLifecycle;
export { CreatureLifecycleManager };

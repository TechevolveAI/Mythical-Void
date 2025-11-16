/**
 * PersonalitySystem - Dynamic personality shaping based on player behavior
 *
 * Tracks player actions and gradually adjusts creature personality traits over time.
 * Uses internal axes that map to discrete DNA trait labels for a smooth evolution system.
 *
 * Core Concept:
 * - Each personality dimension has a numeric axis (-100 to +100)
 * - Player behaviors nudge axes gradually
 * - Axes map back to discrete labels (shy → balanced → bold)
 * - All changes are reversible with different care patterns
 *
 * Part of Mythical Void's creature identity system (DNA v1 + Personality Shaping)
 */

/**
 * Axis-to-Label Mappings
 * Each axis range maps to discrete trait labels from CreatureDNA
 */
const AXIS_MAPPINGS = Object.freeze({
    // Temperament axis: shy/gentle ← → bold/mischievous
    temperament: {
        ranges: [
            { min: -100, max: -40, label: 'shy', description: 'Timid and cautious' },
            { min: -39, max: -10, label: 'gentle', description: 'Calm and kind' },
            { min: -9, max: 30, label: 'playful', description: 'Energetic and fun' },
            { min: 31, max: 60, label: 'mischievous', description: 'Cheeky and clever' },
            { min: 61, max: 100, label: 'bold', description: 'Brave and confident' }
        ]
    },

    // Energy axis: chill ← → hyper
    energy: {
        ranges: [
            { min: -100, max: -30, label: 'chill', description: 'Low energy, relaxed' },
            { min: -29, max: 30, label: 'balanced', description: 'Medium energy' },
            { min: 31, max: 100, label: 'hyper', description: 'High energy, active' }
        ]
    },

    // Curiosity axis: low ← → high
    curiosity: {
        ranges: [
            { min: -100, max: -30, label: 'low', description: 'Prefers familiar places' },
            { min: -29, max: 30, label: 'medium', description: 'Average curiosity' },
            { min: 31, max: 100, label: 'high', description: 'Loves exploring' }
        ]
    },

    // Attachment axis: independent ← → clingy
    attachment: {
        ranges: [
            { min: -100, max: -30, label: 'independent', description: 'Prefers alone time' },
            { min: -29, max: 30, label: 'balanced', description: 'Normal attachment' },
            { min: 31, max: 100, label: 'clingy', description: 'Needs lots of attention' }
        ]
    }
});

/**
 * Behavior adjustment rules
 * Define how player actions influence personality axes
 */
const ADJUSTMENT_RULES = Object.freeze({
    // Care actions
    feed: {
        temperament: 0.5,    // Slightly nudges toward gentle
        energy: 0.3,         // Slight energy boost
        attachment: 0.8      // Regular feeding builds attachment
    },
    play: {
        temperament: 1.0,    // Nudges toward playful/bold
        energy: 1.5,         // Strong energy increase
        curiosity: 0.5       // Playing encourages exploration
    },
    rest: {
        temperament: -0.8,   // Nudges toward gentle/shy
        energy: -1.2,        // Reduces energy level
        attachment: 0.3      // Quiet time together builds bond
    },
    pet: {
        temperament: -0.5,   // Gentle action, nudges toward calm
        attachment: 1.0      // Direct bonding action
    },
    groom: {
        temperament: -0.3,   // Calming activity
        attachment: 0.8      // Grooming builds trust
    },

    // Combat and exploration
    combat: {
        temperament: 2.0,    // Strong nudge toward bold/mischievous
        energy: 1.0,         // Combat is energizing
        attachment: -0.3     // Independent behavior
    },
    exploration: {
        curiosity: 1.5,      // Strong curiosity boost
        temperament: 0.5,    // Slightly adventurous
        attachment: -0.2     // Exploring alone
    },
    flowerInteraction: {
        temperament: -1.0,   // Gentle, peaceful activity
        curiosity: 0.3,      // Noticing details
        energy: -0.5         // Calming effect
    },

    // Session patterns
    longAbsence: {
        attachment: 15.0,    // Significant clingy increase after absence
        temperament: -5.0    // May become more shy/gentle
    },
    frequentVisits: {
        attachment: -0.5,    // Becomes more independent with consistent care
        energy: 0.5          // Stays energized
    },
    neglect: {
        temperament: -3.0,   // Becomes shy/withdrawn
        attachment: -5.0,    // Becomes independent (protective)
        energy: -2.0         // Low energy from neglect
    }
});

/**
 * Behavior tracking windows (in milliseconds)
 */
const TRACKING_WINDOWS = Object.freeze({
    SHORT_TERM: 24 * 60 * 60 * 1000,      // 24 hours
    MEDIUM_TERM: 7 * 24 * 60 * 60 * 1000, // 7 days
    LONG_ABSENCE: 2 * 24 * 60 * 60 * 1000 // 2 days = long absence
});

/**
 * PersonalitySystem class
 */
class PersonalitySystem {
    constructor() {
        this.initialized = false;
        this.axisMappings = AXIS_MAPPINGS;
        this.adjustmentRules = ADJUSTMENT_RULES;
        this.trackingWindows = TRACKING_WINDOWS;
    }

    /**
     * Initialize the personality system
     */
    initialize() {
        if (this.initialized) return;

        console.log('[PersonalitySystem] Initializing personality shaping system...');

        // Listen for game events
        if (window.GameState && typeof window.GameState.on === 'function') {
            window.GameState.on('careActionPerformed', (data) => {
                this.onCareAction(data.actionType);
            });

            window.GameState.on('combatEngaged', (data) => {
                this.onCombat(data);
            });

            window.GameState.on('sessionStarted', () => {
                this.onSessionStart();
            });

            window.GameState.on('sessionEnded', () => {
                this.onSessionEnd();
            });
        }

        this.initialized = true;
        console.log('[PersonalitySystem] Personality shaping system initialized');

        // Emit initialization event
        if (window.GameState && typeof window.GameState.emit === 'function') {
            window.GameState.emit('personality/system_initialized', {
                timestamp: Date.now(),
                systemReady: true
            });
        }
    }

    /**
     * Initialize personality state for a new creature
     * Sets up axes based on initial DNA traits
     */
    initializePersonalityState(dna) {
        if (!dna) {
            console.warn('[PersonalitySystem] Cannot initialize without DNA');
            return null;
        }

        // Convert DNA traits to initial axis positions
        const axes = {
            temperament: this.traitToAxis('temperament', dna.temperament),
            energy: this.traitToAxis('energy', dna.energyLevel),
            curiosity: this.traitToAxis('curiosity', dna.curiosity),
            attachment: this.traitToAxis('attachment', dna.attachmentStyle)
        };

        // Initialize behavior tracking
        const behaviorTracking = {
            // Care action counters (rolling 24h window)
            feeds: 0,
            plays: 0,
            rests: 0,
            pets: 0,
            grooms: 0,

            // Combat and exploration
            combats: 0,
            explorationActions: 0,
            flowerInteractions: 0,
            distinctPOIsVisited: 0,

            // Session tracking
            lastSessionEnd: Date.now(),
            currentSessionStart: Date.now(),
            totalSessions: 0,
            longestAbsence: 0,

            // Rolling window metadata
            windowStart: Date.now(),
            lastUpdate: Date.now()
        };

        const personalityState = {
            axes,
            behaviorTracking,
            version: '1.0',
            createdAt: Date.now(),
            lastShift: null // Track last trait label change
        };

        console.log('[PersonalitySystem] Initialized personality state:', {
            axes,
            initialTraits: this.getCurrentTraits(personalityState)
        });

        return personalityState;
    }

    /**
     * Convert a discrete trait label to an axis position
     * Places it in the middle of that trait's range
     */
    traitToAxis(axisName, traitLabel) {
        const mapping = this.axisMappings[axisName];
        if (!mapping) return 0;

        const range = mapping.ranges.find(r => r.label === traitLabel);
        if (!range) return 0;

        // Place in middle of range
        return Math.round((range.min + range.max) / 2);
    }

    /**
     * Convert an axis value to a discrete trait label
     */
    axisToTrait(axisName, axisValue) {
        const mapping = this.axisMappings[axisName];
        if (!mapping) return null;

        const range = mapping.ranges.find(r =>
            axisValue >= r.min && axisValue <= r.max
        );

        return range ? {
            label: range.label,
            description: range.description,
            axis: axisValue
        } : null;
    }

    /**
     * Get current trait labels from personality state
     */
    getCurrentTraits(personalityState) {
        if (!personalityState || !personalityState.axes) return null;

        const { axes } = personalityState;

        return {
            temperament: this.axisToTrait('temperament', axes.temperament),
            energyLevel: this.axisToTrait('energy', axes.energy),
            curiosity: this.axisToTrait('curiosity', axes.curiosity),
            attachmentStyle: this.axisToTrait('attachment', axes.attachment)
        };
    }

    /**
     * Track a care action and adjust personality
     */
    onCareAction(actionType) {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) {
            console.warn('[PersonalitySystem] No personality state found');
            return;
        }

        // Update behavior tracking
        const tracking = personalityState.behaviorTracking;
        this.resetWindowIfNeeded(tracking);

        // Increment counter
        const counterKey = `${actionType}s`;
        if (counterKey in tracking) {
            tracking[counterKey]++;
        }

        // Apply personality adjustments
        const rules = this.adjustmentRules[actionType];
        if (rules) {
            this.applyAdjustments(personalityState, rules, `care:${actionType}`);
        }

        // Save updated state
        state.set('creature.personalityState', personalityState);

        console.log(`[PersonalitySystem] Tracked ${actionType}, current axes:`, personalityState.axes);
    }

    /**
     * Track combat engagement
     */
    onCombat(data) {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        const tracking = personalityState.behaviorTracking;
        this.resetWindowIfNeeded(tracking);

        tracking.combats++;

        // Apply combat adjustments
        const rules = this.adjustmentRules.combat;
        this.applyAdjustments(personalityState, rules, 'combat');

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Track session start
     */
    onSessionStart() {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        const tracking = personalityState.behaviorTracking;
        const now = Date.now();

        // Calculate absence duration
        const absenceDuration = now - tracking.lastSessionEnd;
        tracking.longestAbsence = Math.max(tracking.longestAbsence, absenceDuration);

        tracking.currentSessionStart = now;
        tracking.totalSessions++;

        // Check for long absence
        if (absenceDuration > this.trackingWindows.LONG_ABSENCE) {
            console.log('[PersonalitySystem] Long absence detected:', {
                duration: Math.round(absenceDuration / 1000 / 60 / 60) + ' hours'
            });

            // Apply long absence adjustments
            const rules = this.adjustmentRules.longAbsence;
            this.applyAdjustments(personalityState, rules, 'longAbsence');
        }

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Track session end
     */
    onSessionEnd() {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        personalityState.behaviorTracking.lastSessionEnd = Date.now();

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Track exploration action
     */
    trackExploration(poiId = null) {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        const tracking = personalityState.behaviorTracking;
        this.resetWindowIfNeeded(tracking);

        tracking.explorationActions++;

        // Track distinct POIs if provided
        if (poiId) {
            // Simple tracking: store recent POIs
            if (!tracking.recentPOIs) {
                tracking.recentPOIs = [];
            }

            if (!tracking.recentPOIs.includes(poiId)) {
                tracking.recentPOIs.push(poiId);
                tracking.distinctPOIsVisited = tracking.recentPOIs.length;

                // Apply exploration adjustment
                const rules = this.adjustmentRules.exploration;
                this.applyAdjustments(personalityState, rules, 'exploration');
            }

            // Keep only last 20 POIs
            if (tracking.recentPOIs.length > 20) {
                tracking.recentPOIs.shift();
            }
        }

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Track flower interaction
     */
    trackFlowerInteraction() {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        const tracking = personalityState.behaviorTracking;
        this.resetWindowIfNeeded(tracking);

        tracking.flowerInteractions++;

        // Apply flower interaction adjustments
        const rules = this.adjustmentRules.flowerInteraction;
        this.applyAdjustments(personalityState, rules, 'flowerInteraction');

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Apply adjustment rules to personality axes
     * Changes are gradual and bounded (-100 to +100)
     */
    applyAdjustments(personalityState, rules, reason) {
        const beforeTraits = this.getCurrentTraits(personalityState);
        const { axes } = personalityState;

        // Apply each axis adjustment
        for (const [axisName, delta] of Object.entries(rules)) {
            if (axisName in axes) {
                const oldValue = axes[axisName];
                const newValue = this.clampAxis(oldValue + delta);
                axes[axisName] = newValue;

                if (import.meta.env.DEV && Math.abs(delta) > 0.1) {
                    console.log(`[PersonalitySystem] ${axisName}: ${oldValue.toFixed(1)} → ${newValue.toFixed(1)} (${reason})`);
                }
            }
        }

        // Check for trait label changes
        const afterTraits = this.getCurrentTraits(personalityState);
        this.checkForShifts(beforeTraits, afterTraits, personalityState, reason);
    }

    /**
     * Clamp axis value to valid range
     */
    clampAxis(value) {
        return Math.max(-100, Math.min(100, value));
    }

    /**
     * Check if any trait labels have changed
     */
    checkForShifts(beforeTraits, afterTraits, personalityState, reason) {
        if (!beforeTraits || !afterTraits) return;

        const shifts = [];

        for (const [traitType, afterTrait] of Object.entries(afterTraits)) {
            const beforeTrait = beforeTraits[traitType];

            if (beforeTrait && afterTrait && beforeTrait.label !== afterTrait.label) {
                const shift = {
                    traitType,
                    from: beforeTrait.label,
                    to: afterTrait.label,
                    reason,
                    timestamp: Date.now()
                };

                shifts.push(shift);

                console.log(`[PersonalitySystem] 🌟 Personality shift detected:`, shift);
            }
        }

        if (shifts.length > 0) {
            personalityState.lastShift = shifts[0]; // Store most recent shift

            // Emit shift event
            if (window.GameState && typeof window.GameState.emit === 'function') {
                window.GameState.emit('personality/shift', {
                    shifts,
                    newTraits: afterTraits
                });
            }
        }
    }

    /**
     * Reset rolling window counters if needed
     */
    resetWindowIfNeeded(tracking) {
        const now = Date.now();
        const windowAge = now - tracking.windowStart;

        if (windowAge > this.trackingWindows.SHORT_TERM) {
            // Reset all counters
            tracking.feeds = 0;
            tracking.plays = 0;
            tracking.rests = 0;
            tracking.pets = 0;
            tracking.grooms = 0;
            tracking.combats = 0;
            tracking.explorationActions = 0;
            tracking.flowerInteractions = 0;
            tracking.recentPOIs = [];
            tracking.distinctPOIsVisited = 0;

            tracking.windowStart = now;

            console.log('[PersonalitySystem] Rolling window reset');
        }

        tracking.lastUpdate = now;
    }

    /**
     * Analyze behavior patterns and apply contextual adjustments
     * Called periodically (e.g., once per session)
     */
    analyzeBehaviorPatterns() {
        const state = this.getGameState();
        if (!state) return;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return;

        const tracking = personalityState.behaviorTracking;

        // Calculate care balance
        const totalCareActions = tracking.feeds + tracking.plays + tracking.rests;
        const combatRatio = totalCareActions > 0 ? tracking.combats / totalCareActions : 0;

        console.log('[PersonalitySystem] Behavior analysis:', {
            totalCare: totalCareActions,
            combats: tracking.combats,
            combatRatio: combatRatio.toFixed(2),
            explorations: tracking.distinctPOIsVisited
        });

        // High combat, low care = aggressive/independent pattern
        if (combatRatio > 0.5 && totalCareActions < 5) {
            console.log('[PersonalitySystem] Detected combat-heavy neglect pattern');
            const rules = this.adjustmentRules.neglect;
            this.applyAdjustments(personalityState, rules, 'neglect_pattern');
        }

        // Frequent visits with regular care = healthy pattern
        if (tracking.totalSessions > 10 && totalCareActions > 15) {
            console.log('[PersonalitySystem] Detected frequent care pattern');
            const rules = this.adjustmentRules.frequentVisits;
            this.applyAdjustments(personalityState, rules, 'frequent_care');
        }

        state.set('creature.personalityState', personalityState);
    }

    /**
     * Get GameState instance
     */
    getGameState() {
        if (typeof window === 'undefined' || !window.GameState) {
            return null;
        }
        return window.GameState;
    }

    /**
     * Get formatted personality summary for UI display
     */
    getPersonalitySummary() {
        const state = this.getGameState();
        if (!state) return null;

        const personalityState = state.get('creature.personalityState');
        if (!personalityState) return null;

        const traits = this.getCurrentTraits(personalityState);
        const { axes } = personalityState;

        return {
            traits,
            axes,
            lastShift: personalityState.lastShift,
            tracking: personalityState.behaviorTracking
        };
    }
}

// Create singleton instance and export to window
const personalitySystem = new PersonalitySystem();

if (typeof window !== 'undefined') {
    window.PersonalitySystem = personalitySystem;
}

export default PersonalitySystem;

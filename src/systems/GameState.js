/**
 * GameStateManager - Central state management system for the mythical creature game
 * Handles player progression, world state, creature data, and persistence
 */

// GAME VERSION - Increment when making breaking changes to save data schema
const GAME_VERSION = '1.1.0'; // Format: major.minor.patch

class GameStateManager {
    constructor() {
        this.initialized = false;
        this.saveKey = 'mythical-creature-save';
        this.gameVersion = GAME_VERSION;

        this.state = this.createInitialState();
        this.eventListeners = new Map();
        this.autoSaveInterval = null;

        // Storage mode tracking
        this.storageMode = 'localStorage'; // 'localStorage', 'sessionStorage', or 'memory'
        this.storageErrorShown = false; // Show error message only once
        this.checkStorageAvailability();
    }

    /**
     * Check if localStorage is available and working
     * Handles private browsing, disabled storage, and quota issues
     */
    checkStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            this.storageMode = 'localStorage';
            return true;
        } catch (error) {
            console.warn('[GameState] localStorage unavailable, falling back to memory-only mode');
            this.storageMode = 'memory';
            this.showStorageWarning('localStorage unavailable - progress will not be saved');
            return false;
        }
    }

    /**
     * Show storage warning to user (only once)
     * Kid Mode gets simplified message
     */
    showStorageWarning(message) {
        if (this.storageErrorShown) return;
        this.storageErrorShown = true;

        const isKidMode = typeof window !== 'undefined' && window.KidMode?.isEnabled?.();
        const userMessage = isKidMode
            ? 'Your progress might not be saved. Ask a grown-up if you need help!'
            : message;

        console.warn('[GameState]', userMessage);
        this.emit('storageWarning', { message: userMessage, isKidMode });
    }

    /**
     * Get available storage space (approximate)
     * Returns null if detection fails
     */
    getStorageQuota() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length + key.length;
                }
            }
            // Most browsers allow 5-10MB for localStorage
            const estimatedLimit = 5 * 1024 * 1024; // 5MB conservative estimate
            return {
                used: total,
                available: estimatedLimit - total,
                percentUsed: (total / estimatedLimit) * 100
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Create a brand-new default state tree
     */
    createInitialState() {
        const now = Date.now();

        return {
            // Version tracking for save data migration
            version: GAME_VERSION,
            savedAt: now,

            player: {
                name: '',
                playTime: 0,
                gamesPlayed: 0,
                lastPlayed: null
            },
            creature: {
                hatched: false,
                hatchTime: null,
                name: 'Your Creature',
                level: 1,
                experience: 0,
                stats: {
                    happiness: 100,
                    energy: 100,
                    health: 100
                },
                traits: [],
                genes: null,
                colors: {
                    body: 0x9370DB,
                    head: 0xDDA0DD,
                    wings: 0x9370DB
                },
                care: {
                    lastCareTime: null,
                    careStreak: 0,
                    careHistory: [],
                    dailyCare: {
                        feedCount: 0,
                        playCount: 0,
                        restCount: 0,
                        lastReset: null
                    }
                },
                // Lifecycle system - Evolution stages and aging
                lifecycle: {
                    birthDate: null,              // Timestamp when creature was hatched
                    stage: 'baby',                // Current stage: baby, juvenile, adult, elder
                    lastStageChange: null,        // Timestamp of last evolution
                    evolutionHistory: [],         // Array of {stage, timestamp} for each evolution
                    departureDate: null,          // Calculated: birthDate + 90 days
                    isStuck: false,               // Evolution blocked due to abandonment/sadness
                    stuckReason: null,            // Why evolution is stuck: 'abandoned', 'sad', null
                    // Departure warnings
                    warnings: {
                        day85Shown: false,
                        day88Shown: false,
                        day89Shown: false
                    },
                    // Departure status
                    hasDeparted: false,
                    departureTimestamp: null
                },
                // Mood system - Affects evolution and gameplay
                mood: {
                    current: 'happy',             // happy, neutral, sad, abandoned
                    lastMoodChange: null,
                    moodHistory: []               // Track mood changes over time
                }
            },
            world: {
                currentPosition: { x: 800, y: 600 },
                visitedAreas: [],
                discoveredObjects: {
                    flowers: 0,
                    trees: 0,
                    rocks: 0
                },
                interactionCount: 0
            },
            settings: {
                volume: {
                    master: 1.0,
                    music: 0.7,
                    sfx: 0.8
                },
                graphics: {
                    effects: true,
                    particles: true,
                    smoothMovement: true
                },
                controls: {
                    moveSpeed: 200
                }
            },
            unlocks: {
                scenes: ['HatchingScene'],
                features: [],
                achievements: []
            },
            breedingShrine: {
                unlocked: false,
                lastBreedingTime: null,
                breedingCooldown: 24 * 60 * 60 * 1000,
                breedingHistory: []
            },
            dailyBonus: {
                lastLoginDate: null,
                currentStreak: 0,
                longestStreak: 0,
                totalLogins: 0,
                claimedToday: false
            },
            pitySystem: {
                hatchesSinceEpic: 0,
                guaranteedEpicNext: false,
                totalHatches: 0,
                pitiesTriggered: 0,
                lastHatchTime: null,
                history: []
            },
            rerollSystem: {
                freeRerollsAvailable: 1,
                totalRerolls: 0,
                successfulRerolls: 0,
                rerollHistory: [],
                lastRerollTime: null
            },
            creatures: [],  // Collection of all hatched creatures (max 8)
            activeCreatureIndex: 0,  // Index of currently active creature in collection
            maxCreatures: 8,  // Maximum creatures in collection
            codex: {
                discovered: 0,
                total: 50,
                byRarity: {
                    common: 0,
                    uncommon: 0,
                    rare: 0,
                    epic: 0,
                    legendary: 0
                }
            },
            memory: {
                optIn: false,
                lastOptInChange: null,
                lastPurge: null,
                deletionLog: [],
                creatures: {}
            },
            longTermMemory: {
                creatures: {},
                global: {
                    keyValue: {},
                    lastUpdated: null
                }
            },
            agent: {
                enabled: true,
                tasks: {
                    active: [],      // Currently executing tasks
                    pending: [],     // Queued tasks
                    history: []      // Completed tasks (max 50)
                },
                reminders: [],       // Player reminders set by creature
                toolUsage: {},       // Tool execution stats
                pendingExploration: null,  // Movement intent from explore tool
                settings: {
                    allowExternalAPIs: false,
                    backgroundTasksEnabled: true,
                    maxActiveTools: 3,
                    toolCooldownMultiplier: 1.0
                },
                lastActivity: null
            },
            hubWorld: {
                currentGate: 'main',  // Which gate player is at
                gates: {
                    main: { unlocked: true, name: 'Main World', biome: 'nebula', visits: 0 },
                    stellar_reef: { unlocked: false, name: 'Stellar Reef', biome: 'stellar_reef', visits: 0, unlockCost: 500 },
                    crystal_caves: { unlocked: false, name: 'Crystal Caves', biome: 'crystal_caves', visits: 0, unlockCost: 1000 },
                    void_peaks: { unlocked: false, name: 'Void Peaks', biome: 'void_peaks', visits: 0, unlockCost: 2000 },
                    aurora_depths: { unlocked: false, name: 'Aurora Depths', biome: 'aurora_depths', visits: 0, unlockCost: 5000 }
                },
                mapsOwned: [],  // Map items purchased from shop
                lastVisitedGate: 'main'
            },
            safety: {
                kidProfile: {
                    enabled: false,
                    nickname: '',
                    emojiAvatar: '🛸',
                    ageBracket: '7-9',
                    createdAt: null
                },
                parentalControls: {
                    enabled: false,
                    requireChatApproval: true,
                    allowMemoryTracking: false,
                    allowExplorationWithoutGuardian: true,
                    screenTimeLimitMinutes: 0,
                    lastUpdated: null
                },
                guardian: {
                    pinHash: null,
                    lastVerified: null
                },
                auditLog: []
            },
            session: {
                sessionStart: now,
                currentScene: 'HatchingScene',
                debugMode: false,
                gameStarted: false,
                lastSessionEnd: null,           // Timestamp when last session ended
                lastActiveDate: null,           // Date string of last activity (for abandonment)
                totalSessionsPlayed: 0
            },
            // Tutorial tracking
            tutorial: {
                profileSeen: false,
                evolutionSeen: false,
                departureSeen: false,
                abandonmentSeen: false
            }
        };
    }

    /**
     * Initialize the GameState system
     */
    init() {
        if (this.initialized) return;
        
        console.log('[GameState] Initializing game state system...');
        
        // Load existing save data
        this.load();
        
        // Update session data
        this.state.session.sessionStart = Date.now();
        this.state.player.gamesPlayed += 1;

        // Initialize care system for existing creatures
        if (this.state.creature.hatched) {
            this.initializeCareSystem();
            this.updateHappinessFromTime();
        }

        // Check and claim daily login bonus
        const dailyBonus = this.getDailyLoginBonus();
        if (dailyBonus.available) {
            console.log('[GameState] Daily login bonus available - player can claim it');
        }

        // Start auto-save (every 30 seconds)
        this.startAutoSave();

        this.initialized = true;
        this.emit('initialized', this.state);

        console.log('[GameState] Game state initialized:', this.state);
    }

    /**
     * Get current game state (or specific property)
     */
    get(path = null) {
        if (!path) return { ...this.state };
        
        // Support dot notation (e.g., 'creature.stats.happiness')
        const keys = path.split('.');
        let result = this.state;
        
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return undefined;
            }
        }
        
        return result;
    }

    /**
     * Set a value in the state tree with input validation
     * Supports dot-notation paths and emits events on changes
     * @param {string} path - Dot-notation path (e.g., 'creature.stats.happiness')
     * @param {*} value - Value to set
     */
    set(path, value) {
        // Input validation
        if (!path || typeof path !== 'string') {
            console.error('[GameState] Invalid path: must be a non-empty string');
            return;
        }

        if (path.trim() === '') {
            console.error('[GameState] Invalid path: cannot be empty');
            return;
        }

        // Prevent setting dangerous paths
        if (path.includes('__proto__') || path.includes('constructor') || path.includes('prototype')) {
            console.error('[GameState] Invalid path: prototype pollution attempt blocked');
            return;
        }

        try {
            const keys = path.split('.');
            const lastKey = keys.pop();

            if (!lastKey || lastKey.trim() === '') {
                console.error('[GameState] Invalid path: ends with a dot');
                return;
            }

            let target = this.state;

            // Navigate to the target object
            for (const key of keys) {
                if (!key || key.trim() === '') {
                    console.error('[GameState] Invalid path: contains empty segment');
                    return;
                }

                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }

            // Store old value for event
            const oldValue = target[lastKey];

            // Set new value
            target[lastKey] = value;

            // Emit change event
            this.emit('stateChanged', {
                path,
                oldValue,
                newValue: value,
                timestamp: Date.now()
            });

            // Emit specific property change event
            this.emit(`changed:${path}`, value, oldValue);

            console.log(`[GameState] ${path} changed:`, oldValue, '->', value);
        } catch (error) {
            console.error('[GameState] Failed to set value at path:', path, error);

            // Emit error event
            if (typeof window !== 'undefined' && window.ErrorHandler) {
                window.ErrorHandler.handleError(error, 'GameState.set', 'warning');
            }
        }
    }

    /**
     * Update creature stats and handle progression
     */
    updateCreature(updates) {
        const creature = this.get('creature');
        
        Object.keys(updates).forEach(key => {
            if (key === 'stats') {
                // Handle stat updates with bounds checking
                Object.keys(updates.stats).forEach(statKey => {
                    const newValue = Math.max(0, Math.min(100, updates.stats[statKey]));
                    this.set(`creature.stats.${statKey}`, newValue);
                });
            } else if (key === 'experience') {
                // Handle experience and level progression
                const currentExp = creature.experience;
                const newExp = currentExp + updates.experience;
                this.set('creature.experience', newExp);
                
                // Check for level up (every 100 XP)
                const currentLevel = creature.level;
                const newLevel = Math.floor(newExp / 100) + 1;
                
                if (newLevel > currentLevel) {
                    this.set('creature.level', newLevel);
                    this.emit('levelUp', { oldLevel: currentLevel, newLevel });
                    
                    // Check if breeding shrine should be unlocked
                    this.checkBreedingShrineUnlock();
                }
            } else {
                this.set(`creature.${key}`, updates[key]);
            }
        });
    }

    /**
     * Track world exploration
     */
    updateWorldExploration(position, objectType = null) {
        // Update current position
        this.set('world.currentPosition', position);
        
        // Track object discovery
        if (objectType) {
            const currentCount = this.get(`world.discoveredObjects.${objectType}`) || 0;
            this.set(`world.discoveredObjects.${objectType}`, currentCount + 1);
            
            // Track total interactions
            const interactions = this.get('world.interactionCount');
            this.set('world.interactionCount', interactions + 1);
            
            // Give creature experience for exploration
            this.updateCreature({ experience: 5 });
        }
    }

    /**
     * Unlock new content
     */
    unlock(type, item) {
        const unlocks = this.get('unlocks');
        if (!unlocks[type].includes(item)) {
            unlocks[type].push(item);
            this.set(`unlocks.${type}`, unlocks[type]);
            this.emit('unlocked', { type, item });
            
            console.log(`[GameState] Unlocked ${type}:`, item);
        }
    }

    /**
     * Check if content is unlocked
     */
    isUnlocked(type, item) {
        const unlocks = this.get(`unlocks.${type}`) || [];
        return unlocks.includes(item);
    }

    /**
     * Complete creature hatching process
     */
    completeHatching() {
        if (!this.get('creature.hatched')) {
            const now = Date.now();
            this.set('creature.hatched', true);
            this.set('creature.hatchTime', now);
            this.unlock('scenes', 'GameScene');
            this.updateCreature({ experience: 50 }); // Bonus XP for hatching

            // Initialize lifecycle for the newly hatched creature
            this.set('creature.lifecycle.birthDate', now);
            this.set('creature.lifecycle.stage', 'baby');
            this.set('creature.lifecycle.lastStageChange', now);
            this.set('creature.lifecycle.evolutionHistory', []);
            this.set('creature.lifecycle.isStuck', false);
            this.set('creature.lifecycle.stuckReason', null);
            this.set('creature.lifecycle.hasDeparted', false);
            console.log('[GameState] Initialized lifecycle for newly hatched creature - stage set to: baby');

            // Initialize mood as happy for newly hatched creature
            this.set('creature.mood.current', 'happy');
            this.set('creature.mood.lastMoodChange', now);

            // Initialize care system for the new creature
            this.initializeCareSystem();

            console.log('[GameState] Creature hatching completed with lifecycle initialized!');
        }
    }

    // ==========================================
    // MULTI-CREATURE COLLECTION MANAGEMENT
    // ==========================================

    /**
     * Add current creature to the collection
     * Called when hatching a new creature or saving an offspring from breeding
     * @returns {boolean} Whether creature was added successfully
     */
    addCreatureToCollection(creatureData = null) {
        const creatures = this.get('creatures') || [];
        const maxCreatures = this.get('maxCreatures') || 8;

        if (creatures.length >= maxCreatures) {
            console.warn('[GameState] Creature collection is full!');
            this.emit('collectionFull', { max: maxCreatures, current: creatures.length });
            return false;
        }

        // If no creature data provided, use current active creature
        const creature = creatureData || {
            id: `creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: this.get('creature.name') || 'Unnamed',
            genes: this.get('creature.genes'),
            dna: this.get('creature.dna'),
            personality: this.get('creature.personality'),
            personalityState: this.get('creature.personalityState'),
            stats: { ...this.get('creature.stats') },
            level: this.get('creature.level') || 1,
            experience: this.get('creature.experience') || 0,
            textureName: this.get('creature.textureName'),
            hatchTime: this.get('creature.hatchTime') || Date.now(),
            cosmicAffinity: this.get('creature.genes')?.cosmicAffinity?.element || null,
            rarity: this.get('creature.genes')?.rarity || 'common',
            addedAt: Date.now()
        };

        // Check for duplicates by genes.id or textureName + name combination
        const genesId = creature.genes?.id;
        const textureName = creature.textureName;

        const isDuplicate = creatures.some(existing => {
            // Check by genes.id first (most reliable)
            if (genesId && existing.genes?.id === genesId) {
                return true;
            }
            // Fallback: check by texture AND name combination
            if (textureName && existing.textureName === textureName &&
                existing.name === creature.name) {
                return true;
            }
            return false;
        });

        if (isDuplicate) {
            console.warn(`[GameState] Creature "${creature.name}" already exists in collection, skipping duplicate`);
            this.emit('duplicateCreature', { creature });
            return false;
        }

        creatures.push(creature);
        this.set('creatures', creatures);
        this.set('activeCreatureIndex', creatures.length - 1);

        this.emit('creatureAddedToCollection', { creature, index: creatures.length - 1 });
        console.log(`[GameState] Creature "${creature.name}" added to collection (${creatures.length}/${maxCreatures})`);

        return true;
    }

    /**
     * Get the currently active creature from collection
     * @returns {Object|null} The active creature or null if none
     */
    getActiveCreature() {
        const creatures = this.get('creatures') || [];
        const activeIndex = this.get('activeCreatureIndex') || 0;

        if (creatures.length === 0) {
            // Fall back to current creature state (for backward compatibility)
            if (this.get('creature.hatched')) {
                return {
                    name: this.get('creature.name'),
                    genes: this.get('creature.genes'),
                    stats: this.get('creature.stats'),
                    level: this.get('creature.level'),
                    textureName: this.get('creature.textureName')
                };
            }
            return null;
        }

        return creatures[activeIndex] || creatures[0];
    }

    /**
     * Switch to a different creature in the collection
     * @param {number} index - Index of creature to switch to
     * @returns {boolean} Whether switch was successful
     */
    switchActiveCreature(index) {
        const creatures = this.get('creatures') || [];

        if (index < 0 || index >= creatures.length) {
            console.warn(`[GameState] Invalid creature index: ${index}`);
            return false;
        }

        const previousIndex = this.get('activeCreatureIndex');
        const previousCreature = creatures[previousIndex];
        const newCreature = creatures[index];

        // Save current creature's state back to collection before switching
        if (previousCreature) {
            previousCreature.stats = { ...this.get('creature.stats') };
            previousCreature.level = this.get('creature.level');
            previousCreature.experience = this.get('creature.experience');
            previousCreature.personalityState = this.get('creature.personalityState');
            creatures[previousIndex] = previousCreature;
        }

        // Update active index
        this.set('activeCreatureIndex', index);

        // Load new creature's state into active creature slot
        this.set('creature.name', newCreature.name);
        this.set('creature.genes', newCreature.genes);
        this.set('creature.dna', newCreature.dna);
        this.set('creature.personality', newCreature.personality);
        this.set('creature.personalityState', newCreature.personalityState);
        this.set('creature.stats', { ...newCreature.stats });
        this.set('creature.level', newCreature.level);
        this.set('creature.experience', newCreature.experience);
        this.set('creature.textureName', newCreature.textureName);
        this.set('creature.hatched', true);
        this.set('creature.named', true);

        this.set('creatures', creatures);

        this.emit('creatureSwitched', {
            previousIndex,
            newIndex: index,
            previousCreature,
            newCreature
        });

        console.log(`[GameState] Switched to creature "${newCreature.name}" (index ${index})`);
        return true;
    }

    /**
     * Get all creatures in collection
     * @returns {Array} Array of creatures
     */
    getCreatureCollection() {
        return this.get('creatures') || [];
    }

    /**
     * Get collection status
     * @returns {Object} Collection stats
     */
    getCollectionStatus() {
        const creatures = this.get('creatures') || [];
        const maxCreatures = this.get('maxCreatures') || 8;

        return {
            count: creatures.length,
            max: maxCreatures,
            isFull: creatures.length >= maxCreatures,
            hasSpace: creatures.length < maxCreatures,
            activeIndex: this.get('activeCreatureIndex') || 0
        };
    }

    /**
     * Reset the creatures collection for a fresh game start
     * Clears all old/test creatures from previous sessions
     * @returns {boolean} Whether reset was successful
     */
    resetCreatureCollection() {
        console.log('[GameState] Resetting creature collection for fresh start');

        // Clear the creatures array
        this.set('creatures', []);
        this.set('activeCreatureIndex', 0);

        // Also clear the creature slot to ensure clean state
        this.set('creature.hatched', false);
        this.set('creature.named', false);
        this.set('creature.name', null);
        this.set('creature.genes', null);
        this.set('creature.genetics', null);
        this.set('creature.dna', null);
        this.set('creature.personality', null);
        this.set('creature.personalityState', null);
        this.set('creature.textureName', null);
        this.set('creature.stats', { happiness: 100, energy: 100, health: 100 });
        this.set('creature.level', 1);
        this.set('creature.experience', 0);

        this.emit('creatureCollectionReset');
        console.log('[GameState] Creature collection has been reset');
        return true;
    }

    /**
     * Remove a creature from the collection
     * @param {number} index - Index of creature to remove
     * @returns {Object|null} Removed creature or null if failed
     */
    removeCreatureFromCollection(index) {
        const creatures = this.get('creatures') || [];

        if (creatures.length <= 1) {
            console.warn('[GameState] Cannot remove last creature from collection');
            return null;
        }

        if (index < 0 || index >= creatures.length) {
            console.warn(`[GameState] Invalid creature index: ${index}`);
            return null;
        }

        const removed = creatures.splice(index, 1)[0];
        this.set('creatures', creatures);

        // Adjust active index if needed
        const activeIndex = this.get('activeCreatureIndex');
        if (activeIndex >= creatures.length) {
            this.switchActiveCreature(creatures.length - 1);
        } else if (activeIndex === index) {
            this.switchActiveCreature(Math.max(0, activeIndex - 1));
        }

        this.emit('creatureRemovedFromCollection', { creature: removed, index });
        console.log(`[GameState] Creature "${removed.name}" removed from collection`);

        return removed;
    }

    // ==========================================
    // HUB WORLD GATE MANAGEMENT
    // ==========================================

    /**
     * Check if a gate is unlocked
     * @param {string} gateId - ID of the gate
     * @returns {boolean} Whether gate is unlocked
     */
    isGateUnlocked(gateId) {
        const gates = this.get('hubWorld.gates') || {};
        return gates[gateId]?.unlocked || false;
    }

    /**
     * Attempt to unlock a gate
     * @param {string} gateId - ID of the gate to unlock
     * @param {boolean} useCoins - Whether to spend coins for unlock
     * @returns {Object} Result of unlock attempt
     */
    unlockGate(gateId, useCoins = true) {
        const gates = this.get('hubWorld.gates') || {};
        const gate = gates[gateId];

        if (!gate) {
            return { success: false, reason: 'Gate not found' };
        }

        if (gate.unlocked) {
            return { success: true, reason: 'Already unlocked' };
        }

        // Check if player has the map for this gate
        const mapsOwned = this.get('hubWorld.mapsOwned') || [];
        const hasMap = mapsOwned.includes(gateId);

        if (hasMap) {
            // Unlock with map (free)
            gate.unlocked = true;
            this.set(`hubWorld.gates.${gateId}`, gate);
            this.emit('gateUnlocked', { gateId, method: 'map' });
            console.log(`[GameState] Gate "${gateId}" unlocked with map`);
            return { success: true, method: 'map' };
        }

        if (useCoins) {
            const currentCoins = this.get('player.cosmicCoins') || 0;
            const cost = gate.unlockCost || 500;

            if (currentCoins < cost) {
                return { success: false, reason: 'Not enough coins', cost, current: currentCoins };
            }

            // Spend coins and unlock
            this.set('player.cosmicCoins', currentCoins - cost);
            gate.unlocked = true;
            this.set(`hubWorld.gates.${gateId}`, gate);
            this.emit('gateUnlocked', { gateId, method: 'coins', cost });
            console.log(`[GameState] Gate "${gateId}" unlocked with ${cost} coins`);
            return { success: true, method: 'coins', cost };
        }

        return { success: false, reason: 'No map and coins not used' };
    }

    /**
     * Add a map to player's collection (called when purchasing from shop)
     * @param {string} gateId - ID of the gate the map unlocks
     */
    addMapToCollection(gateId) {
        const mapsOwned = this.get('hubWorld.mapsOwned') || [];

        if (!mapsOwned.includes(gateId)) {
            mapsOwned.push(gateId);
            this.set('hubWorld.mapsOwned', mapsOwned);
            this.emit('mapAcquired', { gateId });
            console.log(`[GameState] Map for gate "${gateId}" added to collection`);

            // Auto-unlock the gate now that player owns the map
            const unlockResult = this.unlockGate(gateId, false); // false = don't try to use coins
            if (unlockResult.success) {
                console.log(`[GameState] Gate "${gateId}" auto-unlocked with map purchase`);
            }
        }
    }

    /**
     * Enter a gate (travel to biome)
     * @param {string} gateId - ID of the gate to enter
     * @returns {Object} Result of enter attempt
     */
    enterGate(gateId) {
        if (!this.isGateUnlocked(gateId)) {
            return { success: false, reason: 'Gate is locked' };
        }

        const gates = this.get('hubWorld.gates') || {};
        const gate = gates[gateId];

        // Update visit count
        gate.visits = (gate.visits || 0) + 1;
        this.set(`hubWorld.gates.${gateId}`, gate);
        this.set('hubWorld.currentGate', gateId);
        this.set('hubWorld.lastVisitedGate', gateId);

        this.emit('gateEntered', { gateId, biome: gate.biome, visits: gate.visits });
        console.log(`[GameState] Entered gate "${gateId}" (visit #${gate.visits})`);

        return { success: true, biome: gate.biome, gate };
    }

    /**
     * Get all gates and their status
     * @returns {Object} All gates with status
     */
    getAllGates() {
        return this.get('hubWorld.gates') || {};
    }

    /**
     * Check if breeding shrine should be unlocked (level 5+)
     */
    checkBreedingShrineUnlock() {
        const creatureLevel = this.get('creature.level');
        const isUnlocked = this.get('breedingShrine.unlocked');

        if (creatureLevel >= 5 && !isUnlocked) {
            this.set('breedingShrine.unlocked', true);
            this.unlock('features', 'breedingShrine');
            this.emit('breedingShrineUnlocked', { level: creatureLevel });

            console.log('[GameState] Breeding shrine unlocked at level', creatureLevel);
            return true;
        }

        return false;
    }

    /**
     * Get breeding shrine status
     */
    getBreedingShrineStatus() {
        const shrine = this.get('breedingShrine');
        const creatureLevel = this.get('creature.level');
        const currentTime = Date.now();

        return {
            unlocked: shrine.unlocked,
            levelRequirement: 5,
            currentLevel: creatureLevel,
            canBreed: shrine.unlocked && (!shrine.lastBreedingTime ||
                        currentTime - shrine.lastBreedingTime >= shrine.breedingCooldown),
            cooldownRemaining: shrine.lastBreedingTime ?
                Math.max(0, shrine.breedingCooldown - (currentTime - shrine.lastBreedingTime)) : 0,
            breedingHistory: shrine.breedingHistory
        };
    }

    /**
     * Attempt to breed creatures using genetics engine
     */
    attemptBreeding(partnerGenes = null) {
        const shrineStatus = this.getBreedingShrineStatus();

        if (!shrineStatus.canBreed) {
            throw new Error('Breeding shrine is not ready or not unlocked');
        }

        // Get current creature genes (generate if not exists)
        let creatureGenes = this.get('creature.genes');
        if (!creatureGenes) {
            // Generate initial genes for current creature
            creatureGenes = window.BreedingEngine.generateInitialGenes();
            this.set('creature.genes', creatureGenes);
        }

        // If no partner provided, generate a random partner
        if (!partnerGenes) {
            partnerGenes = window.BreedingEngine.generateRandomGenes();
        }

        // Perform breeding
        const offspringGenes = window.BreedingEngine.breedCreatures(creatureGenes, partnerGenes);
        const offspringData = window.BreedingEngine.getCreatureTraits(offspringGenes);

        // Update breeding shrine state
        this.set('breedingShrine.lastBreedingTime', Date.now());

        // Add to breeding history
        const history = this.get('breedingShrine.breedingHistory');
        history.push({
            timestamp: Date.now(),
            offspringTraits: offspringData.traits,
            compatibility: window.BreedingEngine.getBreedingCompatibility(creatureGenes, partnerGenes)
        });
        this.set('breedingShrine.breedingHistory', history);

        // Give experience for breeding
        this.updateCreature({ experience: 25 });

        this.emit('breedingCompleted', {
            offspringGenes,
            offspringData,
            breedingTime: Date.now()
        });

        console.log('[GameState] Breeding completed, offspring generated');

        return {
            offspringGenes,
            offspringData,
            breedingHistory: history
        };
    }

    /**
     * Get breeding shrine information for UI
     */
    getBreedingShrineInfo() {
        const shrineData = window.BreedingEngine.getBreedingShrineData();
        const status = this.getBreedingShrineStatus();

        return {
            ...shrineData,
            ...status,
            creatureGenes: this.get('creature.genes')
        };
    }

    /**
     * Initialize care system for hatched creature
     */
    initializeCareSystem() {
        const creature = this.get('creature');
        if (creature.hatched && !creature.care.lastCareTime) {
            this.set('creature.care.lastCareTime', Date.now());
            this.set('creature.care.careStreak', 1);
            console.log('[GameState] Care system initialized for creature');
        }
    }

    /**
     * Update creature happiness based on time offline
     */
    updateHappinessFromTime() {
        const creature = this.get('creature');
        if (!creature.hatched) return;

        const lastCareTime = creature.care.lastCareTime;
        if (!lastCareTime) return;

        const currentTime = Date.now();
        const timeOffline = currentTime - lastCareTime;
        const hoursOffline = timeOffline / (1000 * 60 * 60);

        // Decay happiness: -2 points per hour
        const happinessDecay = Math.floor(hoursOffline * 2);
        if (happinessDecay > 0) {
            const currentHappiness = creature.stats.happiness;
            const newHappiness = Math.max(20, currentHappiness - happinessDecay); // Minimum 20

            if (newHappiness !== currentHappiness) {
                this.set('creature.stats.happiness', newHappiness);
                console.log(`[GameState] Happiness decayed from ${currentHappiness} to ${newHappiness} (${hoursOffline.toFixed(1)} hours offline)`);
            }
        }
    }

    /**
     * Perform care action (feed, play, rest)
     */
    performCareAction(actionType, happinessOverride = null) {
        const creature = this.get('creature');
        if (!creature.hatched) return false;

        // Reset daily counters if it's a new day
        this.resetDailyCountersIfNeeded();

        const dailyCare = creature.care.dailyCare;
        let canPerform = false;
        let happinessBonus = 0;

        switch (actionType) {
            case 'feed':
                if (dailyCare.feedCount < 3) {
                    happinessBonus = 15;
                    this.set('creature.care.dailyCare.feedCount', dailyCare.feedCount + 1);
                    canPerform = true;
                }
                break;

            case 'play':
                if (dailyCare.playCount < 2) {
                    happinessBonus = 10;
                    this.set('creature.care.dailyCare.playCount', dailyCare.playCount + 1);
                    canPerform = true;
                }
                break;

            case 'rest':
                // Unlimited rests, smaller happiness bonus
                happinessBonus = 5;
                this.set('creature.care.dailyCare.restCount', dailyCare.restCount + 1);
                canPerform = true;
                break;
        }

        if (canPerform) {
            const appliedHappinessBonus = happinessOverride !== null
                ? Math.max(0, Math.round(happinessOverride))
                : happinessBonus;

            // Update happiness
            const currentHappiness = creature.stats.happiness;
            const newHappiness = Math.min(100, currentHappiness + appliedHappinessBonus);
            this.set('creature.stats.happiness', newHappiness);

            // Update care tracking
            this.set('creature.care.lastCareTime', Date.now());

            // Update care streak
            this.updateCareStreak();

            // Add to care history
            const careHistory = creature.care.careHistory;
            careHistory.push({
                action: actionType,
                timestamp: Date.now(),
                happinessBefore: currentHappiness,
                happinessAfter: newHappiness,
                happinessApplied: appliedHappinessBonus,
                baseHappinessBonus: happinessBonus
            });

            // Keep only last 20 care actions
            if (careHistory.length > 20) {
                careHistory.splice(0, careHistory.length - 20);
            }
            this.set('creature.care.careHistory', careHistory);

            this.emit('careActionPerformed', {
                action: actionType,
                actionType: actionType, // For PersonalitySystem compatibility
                happinessBonus: appliedHappinessBonus,
                baseHappinessBonus: happinessBonus,
                happinessOverride: happinessOverride !== null,
                newHappiness
            });

            console.log(`[GameState] Care action ${actionType} performed: happiness ${currentHappiness} → ${newHappiness}`);
            return true;
        }

        return false;
    }

    /**
     * Reset daily care counters if it's a new day
     */
    resetDailyCountersIfNeeded() {
        const lastReset = this.get('creature.care.dailyCare.lastReset');
        const today = new Date().toDateString();

        if (!lastReset || new Date(lastReset).toDateString() !== today) {
            this.set('creature.care.dailyCare', {
                feedCount: 0,
                playCount: 0,
                restCount: 0,
                lastReset: Date.now()
            });
            console.log('[GameState] Daily care counters reset');
        }
    }

    /**
     * Update care streak based on recent activity
     */
    updateCareStreak() {
        const careHistory = this.get('creature.care.careHistory');
        const currentStreak = this.get('creature.care.careStreak');

        // Check if cared for today
        const today = new Date().toDateString();
        const todaysCare = careHistory.filter(action =>
            new Date(action.timestamp).toDateString() === today
        );

        if (todaysCare.length > 0) {
            // Check if cared for yesterday to maintain streak
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
            const yesterdaysCare = careHistory.filter(action =>
                new Date(action.timestamp).toDateString() === yesterday
            );

            if (yesterdaysCare.length > 0) {
                // Maintain or increase streak
                this.set('creature.care.careStreak', currentStreak + 1);
            } else if (currentStreak === 0) {
                // Start new streak
                this.set('creature.care.careStreak', 1);
            }
            // If streak > 0 and no care yesterday, it breaks the streak (handled by daily login check)
        }
    }

    /**
     * Get daily login bonus information
     */
    getDailyLoginBonus() {
        const dailyBonus = this.get('dailyBonus');
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

        let bonus = {
            available: false,
            claimed: dailyBonus.claimedToday,
            streak: dailyBonus.currentStreak,
            rewards: { xp: 0, stardust: 0 }
        };

        if (dailyBonus.lastLoginDate !== today && !dailyBonus.claimedToday) {
            bonus.available = true;

            // Calculate streak
            if (dailyBonus.lastLoginDate === yesterday) {
                bonus.streak = dailyBonus.currentStreak + 1;
            } else {
                bonus.streak = 1; // Streak broken
            }

            // Calculate rewards based on streak
            if (bonus.streak === 1) {
                bonus.rewards = { xp: 25, stardust: 10 };
            } else if (bonus.streak === 2) {
                bonus.rewards = { xp: 50, stardust: 20 };
            } else if (bonus.streak === 7) {
                bonus.rewards = { xp: 200, stardust: 100 };
            } else if (bonus.streak === 14) {
                bonus.rewards = { xp: 500, stardust: 250 };
            } else {
                // Escalating rewards for long streaks
                const baseXP = 25 + (bonus.streak - 1) * 10;
                const baseStardust = 10 + (bonus.streak - 1) * 5;
                bonus.rewards = {
                    xp: Math.min(baseXP, 100),
                    stardust: Math.min(baseStardust, 50)
                };
            }
        }

        return bonus;
    }

    /**
     * Claim daily login bonus
     */
    claimDailyLoginBonus() {
        const bonus = this.getDailyLoginBonus();
        if (!bonus.available || bonus.claimed) return false;

        const today = new Date().toDateString();

        // Update daily bonus state
        this.set('dailyBonus.lastLoginDate', today);
        this.set('dailyBonus.claimedToday', true);
        this.set('dailyBonus.currentStreak', bonus.streak);
        this.set('dailyBonus.longestStreak', Math.max(bonus.streak, this.get('dailyBonus.longestStreak')));
        this.set('dailyBonus.totalLogins', this.get('dailyBonus.totalLogins') + 1);

        // Grant rewards
        this.updateCreature({ experience: bonus.rewards.xp });

        // TODO: Add stardust currency system when implemented
        console.log(`[GameState] Daily login bonus claimed: Day ${bonus.streak}, +${bonus.rewards.xp} XP`);

        this.emit('dailyBonusClaimed', bonus);
        return true;
    }

    /**
     * Get care system status for UI
     */
    getCareStatus() {
        const creature = this.get('creature');
        if (!creature.hatched) return null;

        const dailyCare = creature.care.dailyCare;
        const happiness = creature.stats.happiness;

        return {
            happiness,
            happinessLevel: happiness >= 80 ? 'ecstatic' :
                           happiness >= 65 ? 'happy' :
                           happiness >= 50 ? 'content' :
                           happiness >= 35 ? 'tired' :
                           happiness >= 20 ? 'unhappy' : 'miserable',
            careStreak: creature.care.careStreak,
            dailyCare: {
                feedCount: dailyCare.feedCount,
                feedLimit: 3,
                playCount: dailyCare.playCount,
                playLimit: 2,
                restCount: dailyCare.restCount,
                restLimit: -1 // Unlimited
            },
            canFeed: dailyCare.feedCount < 3,
            canPlay: dailyCare.playCount < 2,
            canRest: true, // Always available
            lastCareTime: creature.care.lastCareTime
        };
    }

    /**
     * Save game state to localStorage with quota detection and fallback
     */
    save() {
        // Skip saving in memory-only mode
        if (this.storageMode === 'memory') {
            console.warn('[GameState] Running in memory-only mode, save skipped');
            return false;
        }

        try {
            // Update play time before saving
            const sessionTime = Date.now() - this.state.session.sessionStart;
            this.state.player.playTime += sessionTime;
            this.state.player.lastPlayed = Date.now();
            this.state.session.sessionStart = Date.now();

            // Create save data (exclude session data)
            const saveData = {
                ...this.state,
                version: '1.0.0',
                savedAt: Date.now()
            };
            delete saveData.session;

            const serialized = JSON.stringify(saveData);

            // Check quota before saving
            const quota = this.getStorageQuota();
            if (quota && quota.percentUsed > 90) {
                console.warn('[GameState] Storage quota nearly full:', quota.percentUsed.toFixed(1) + '%');
            }

            localStorage.setItem(this.saveKey, serialized);

            this.emit('saved', saveData);
            console.log('[GameState] Game saved successfully');

            return true;
        } catch (error) {
            // Handle specific quota exceeded error
            if (error.name === 'QuotaExceededError' ||
                error.code === 22 ||
                error.code === 1014) {

                console.error('[GameState] Storage quota exceeded!');
                this.storageMode = 'memory';
                this.showStorageWarning('Storage full - progress will not be saved. Try clearing browser data.');
                this.stopAutoSave(); // Disable auto-save to prevent spam

                this.emit('saveError', {
                    type: 'quota_exceeded',
                    error,
                    mode: this.storageMode
                });
            } else {
                console.error('[GameState] Save failed:', error);
                this.emit('saveError', { type: 'unknown', error });
            }

            return false;
        }
    }

    /**
     * Load game state from localStorage with error handling
     */
    load() {
        // Skip loading in memory-only mode
        if (this.storageMode === 'memory') {
            console.warn('[GameState] Running in memory-only mode, load skipped');
            return false;
        }

        try {
            const saveData = localStorage.getItem(this.saveKey);

            if (saveData) {
                // Validate JSON before parsing
                const parsed = JSON.parse(saveData);

                // Basic validation of save data structure
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid save data structure');
                }

                // VERSION CHECKING: Detect incompatible save data
                const saveVersion = parsed.version || '1.0.0';
                const isCompatible = this.checkVersionCompatibility(saveVersion, GAME_VERSION);

                if (!isCompatible) {
                    console.warn(`[GameState] Save data version ${saveVersion} incompatible with game version ${GAME_VERSION}`);
                    console.warn('[GameState] Starting fresh game to prevent errors');

                    // Backup old save before clearing
                    try {
                        localStorage.setItem(`${this.saveKey}_backup_${saveVersion}`, saveData);
                        console.log(`[GameState] Old save backed up as ${this.saveKey}_backup_${saveVersion}`);
                    } catch (e) {
                        console.warn('[GameState] Could not backup old save:', e);
                    }

                    this.showStorageWarning(`Game updated! Starting fresh. Your old progress was backed up.`);
                    this.emit('versionMismatch', { oldVersion: saveVersion, newVersion: GAME_VERSION });
                    return false;
                }

                // MIGRATION: Auto-migrate old saves to new schema
                const migrated = this.migrateSaveData(parsed, saveVersion);

                // Merge saved data with current state (preserves new properties in updates)
                this.state = this.deepMerge(this.state, migrated);

                // Update version and timestamp
                this.state.version = GAME_VERSION;
                this.state.savedAt = Date.now();

                this.emit('loaded', this.state);
                console.log(`[GameState] Game loaded successfully (v${saveVersion} → v${GAME_VERSION})`);

                return true;
            } else {
                console.log('[GameState] No save data found, using defaults');
                return false;
            }
        } catch (error) {
            // Handle corrupted save data
            if (error instanceof SyntaxError) {
                console.error('[GameState] Save data corrupted (JSON parse failed):', error);
                this.showStorageWarning('Save data corrupted - starting fresh game');
                this.emit('loadError', { type: 'corrupted', error });

                // Try to clear corrupted data
                try {
                    localStorage.removeItem(this.saveKey);
                    console.log('[GameState] Cleared corrupted save data');
                } catch (e) {
                    console.warn('[GameState] Could not clear corrupted data:', e);
                }
            } else {
                console.error('[GameState] Load failed:', error);
                this.emit('loadError', { type: 'unknown', error });
            }

            return false;
        }
    }

    /**
     * Check if save version is compatible with current game version
     * Major version mismatches are incompatible (1.x.x vs 2.x.x)
     */
    checkVersionCompatibility(saveVersion, gameVersion) {
        const saveParts = saveVersion.split('.').map(Number);
        const gameParts = gameVersion.split('.').map(Number);

        const saveMajor = saveParts[0] || 1;
        const gameMajor = gameParts[0] || 1;

        // Major version mismatch = incompatible
        if (saveMajor !== gameMajor) {
            return false;
        }

        // Same major version = compatible (minor/patch changes should be backward compatible)
        return true;
    }

    /**
     * Migrate save data from old versions to current schema
     * Add migration logic here when changing save data structure
     */
    migrateSaveData(saveData, fromVersion) {
        const migrated = { ...saveData };

        // Example migration for v1.0.0 → v1.1.0
        // if (fromVersion === '1.0.0') {
        //     migrated.newField = 'default value';
        // }

        console.log(`[GameState] Migration complete: ${fromVersion} → ${GAME_VERSION}`);
        return migrated;
    }

    /**
     * Reset game state to defaults with error handling
     */
    reset(options = {}) {
        const { preserveSessionDebug = true } = options;

        // Only try to remove from localStorage if not in memory-only mode
        if (this.storageMode !== 'memory') {
            try {
                localStorage.removeItem(this.saveKey);
            } catch (error) {
                console.warn('[GameState] Failed to remove save data:', error);
                // Continue with reset even if removal fails
            }
        }

        const previousSession = this.state.session || {};

        this.stopAutoSave();
        this.state = this.createInitialState();
        this.initialized = false;

        if (preserveSessionDebug && previousSession) {
            this.state.session.debugMode = !!previousSession.debugMode;
        }

        this.emit('reset', this.get());
        console.log('[GameState] Game state reset');
    }

    /**
     * Start automatic saving
     */
    startAutoSave(intervalMs = 30000) { // 30 seconds
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            this.save();
        }, intervalMs);
        
        console.log(`[GameState] Auto-save started (${intervalMs}ms interval)`);
    }

    /**
     * Stop automatic saving
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    /**
     * Event system for state changes
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        const listeners = this.eventListeners.get(event);
        listeners.add(callback);

        return () => this.off(event, callback);
    }

    once(event, callback) {
        const wrapped = (data) => {
            this.off(event, wrapped);
            callback(data);
        };

        return this.on(event, wrapped);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (!listeners) return;

        listeners.delete(callback);

        if (listeners.size === 0) {
            this.eventListeners.delete(event);
        }
    }

    removeAllListeners(event = null) {
        if (event === null) {
            this.eventListeners.clear();
            return;
        }

        this.eventListeners.delete(event);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (!listeners || listeners.size === 0) {
            return;
        }

        Array.from(listeners).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[GameState] Event listener error for ${event}:`, error);
            }
        });
    }

    /**
     * Deep merge objects (for loading save data)
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            initialized: this.initialized,
            autoSaveActive: !!this.autoSaveInterval,
            saveExists: !!localStorage.getItem(this.saveKey),
            eventListeners: Array.from(this.eventListeners.keys()),
            state: this.state
        };
    }

    /**
     * Cleanup when game shuts down
     */
    destroy() {
        this.stopAutoSave();
        this.save(); // Final save
        this.eventListeners.clear();
        this.initialized = false;
        
        console.log('[GameState] Game state system destroyed');
    }
}

// Export singleton instance
if (typeof window !== 'undefined') {
    window.GameState = new GameStateManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameStateManager;
}

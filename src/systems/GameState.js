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
    createEmptyPortraitState() {
        return {
            schemaVersion: 1,
            activeStage: null,
            byStage: {}
        };
    }

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
            stats: {
                levelsCompleted: 0,
                totalPlayTime: 0,
                coinsCollected: 0
            },
            combat: {
                enemiesDefeated: 0,
                bossesDefeated: 0
            },
            story: {
                projectBeacon: {
                    missionLogSeen: false,
                    currentMission: null,
                    fieldKit: {
                        id: 'wanderer_7_field_kit',
                        name: 'Wanderer-7 Field Kit',
                        recovered: false,
                        recoveredAt: null,
                        katana: {
                            id: 'earth_field_katana',
                            name: 'Earth-forged Field Katana',
                            material: 'Titanium-ceramic laminate',
                            configuration: 'secured_in_case',
                            upgradeSlots: 2,
                            installedUpgrades: []
                        }
                    },
                    pendingDebriefs: [],
                    debriefsSeen: [],
                    firstExpeditionPromptSeen: false,
                    firstExpeditionDrill: {
                        completed: false,
                        completedAt: null
                    },
                    expeditionCheckpoint: null,
                    uplinkRestored: false,
                    uplinkRestoredAt: null,
                    endingChoice: null,
                    endingChoiceDate: null,
                    endingEpilogueSeen: false,
                    endingEpilogueCompletedAt: null
                }
            },
            quests: {
                active: [],
                completed: [],
                lastDailyReset: null
            },
            levels: {
                crystalCaves: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
                cosmicReef: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
                mythicalForest: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
                voidPeaks: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
                auroraDepths: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null },
                finalVoid: { entered: false, completed: false, noDamageRun: false, speedrun: false, bestTime: null }
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
                portraits: this.createEmptyPortraitState(),
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
                },
                // Bond system - Relationship between player and creature
                bond: {
                    level: 1,                     // Bond level (1-20)
                    experience: 0,                // XP towards next level (50 per level)
                    totalInteractions: 0,         // Total care/chat interactions
                    careActions: 0,               // Total care actions performed
                    conversations: 0,             // Total chat conversations
                    levelsCompleted: 0,           // Levels completed together
                    firstInteraction: null,       // Timestamp of first interaction
                    lastInteraction: null,        // Timestamp of last interaction
                    // Ability slots unlocked by bond level
                    abilitySlots: {
                        slot1: true,              // Always unlocked
                        slot2: false,             // Unlocked at bond level 5
                        slot3: false              // Unlocked at bond level 10
                    },
                    // Equipped abilities in each slot
                    equippedAbilities: {
                        slot1: null,
                        slot2: null,
                        slot3: null
                    }
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
                interactionCount: 0,
                signalGarden: {
                    stage: 'seed',
                    tendCount: 0,
                    lastTendedDay: null,
                    lastTendedAt: null,
                    plantedAt: null,
                    bloomedAt: null
                },
                livingSignals: {
                    observedIds: [],
                    lastObservedId: null,
                    lastObservedAt: null
                },
                sanctuaryDecorations: {
                    voidCrystals: 0
                }
            },
            settings: {
                audioMuted: false,
                hapticEnabled: true,
                screenShakeEnabled: true,
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
                    main: { unlocked: true, name: 'Sanctuary', biome: 'nebula', visits: 0 },
                    stellar_reef: { unlocked: false, name: 'Stellar Reef', biome: 'stellar_reef', visits: 0, unlockCost: 500, shipPart: 'Dimensional Drive' },
                    crystal_caves: { unlocked: false, name: 'Crystal Caves', biome: 'crystal_caves', visits: 0, unlockCost: 500, shipPart: 'Crystal Core Engine' },
                    mythical_forest: { unlocked: true, name: 'Mythical Forest', biome: 'mythical_forest', visits: 0, inDevelopment: false, unlockCost: 0, shipPart: 'Forest Core' },
                    void_peaks: { unlocked: false, name: 'Void Peaks', biome: 'void_peaks', visits: 0, inDevelopment: false, unlockCost: 1000, shipPart: 'Hull Plating' },
                    aurora_depths: { unlocked: false, name: 'Aurora Depths', biome: 'aurora_depths', visits: 0, inDevelopment: false, unlockCost: 750, shipPart: 'Aurora Reactor' },
                    final_void: { unlocked: false, name: 'The Final Void', biome: 'final_void', visits: 0, inDevelopment: false, unlockCost: 0, shipPart: 'Command Module', requiresAllParts: true }
                },
                mapsOwned: [],  // Map items purchased from shop
                lastVisitedGate: 'main',
                // Ship parts collected from completing levels - needed for final boss battle
                // 5 pre-final parts unlock Final Void. Command Module is awarded by the final boss.
                shipParts: {
                    collected: [],  // Array of part IDs: 'crystal_core', 'dimensional_drive', 'forest_core', 'hull_plating', 'aurora_reactor', 'command_module'
                    totalRequired: 5,
                    finalBossUnlocked: false
                }
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
     * Record a unique realm, Sanctuary zone, or living-signal site.
     */
    visitArea(areaId, { persist = true } = {}) {
        const normalizedId = typeof areaId === 'string'
            ? areaId.trim().toLowerCase()
            : '';
        if (
            !normalizedId ||
            normalizedId.length > 64 ||
            !/^[a-z0-9:_-]+$/.test(normalizedId)
        ) {
            console.warn('[GameState] Ignoring invalid exploration area:', areaId);
            return false;
        }

        const visitedAreas = this.get('world.visitedAreas');
        const normalizedAreas = Array.isArray(visitedAreas)
            ? [...new Set(visitedAreas.filter(area => typeof area === 'string'))]
            : [];
        if (normalizedAreas.includes(normalizedId)) {
            return false;
        }

        normalizedAreas.push(normalizedId);
        this.set('world.visitedAreas', normalizedAreas);
        this.emit('areaVisited', {
            areaId: normalizedId,
            totalVisited: normalizedAreas.length
        });

        if (persist) {
            this.save();
        }
        if (typeof window !== 'undefined') {
            window.AchievementSystem?.checkAchievements?.();
        }
        return true;
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

    /**
     * Persist generated portrait metadata for the active creature.
     * Provider files may be temporary until the storage pipeline copies them.
     */
    saveCreaturePortrait(record) {
        const allowedStages = new Set(['baby', 'juvenile', 'adult', 'elder']);
        if (!record || typeof record !== 'object' || !allowedStages.has(record.stage)) {
            return false;
        }
        if (
            typeof record.imageUrl !== 'string' ||
            record.imageUrl.length > 2048 ||
            !/^https:\/\//i.test(record.imageUrl)
        ) {
            return false;
        }
        if (
            typeof record.identityKey !== 'string' ||
            record.identityKey.length === 0 ||
            record.identityKey.length > 180
        ) {
            return false;
        }

        const normalized = {
            identityKey: record.identityKey,
            stage: record.stage,
            style: typeof record.style === 'string' ? record.style.slice(0, 32) : 'cinematic',
            imageUrl: record.imageUrl,
            status: 'ready',
            provider: typeof record.provider === 'string' ? record.provider.slice(0, 48) : 'unknown',
            model: typeof record.model === 'string' ? record.model.slice(0, 80) : 'unknown',
            promptVersion: typeof record.promptVersion === 'string'
                ? record.promptVersion.slice(0, 48)
                : 'unknown',
            generatedAt: Number.isFinite(Number(record.generatedAt))
                ? Number(record.generatedAt)
                : Date.now(),
            expiresAt: Number.isFinite(Number(record.expiresAt))
                ? Number(record.expiresAt)
                : null,
            storage: record.storage === 'persistent' ? 'persistent' : 'provider-temporary',
            aiGenerated: true
        };

        const current = this.get('creature.portraits');
        const portraits = current && typeof current === 'object'
            ? {
                schemaVersion: 1,
                activeStage: record.stage,
                byStage: { ...(current.byStage || {}) }
            }
            : this.createEmptyPortraitState();

        portraits.activeStage = record.stage;
        portraits.byStage[record.stage] = normalized;
        this.set('creature.portraits', portraits);

        const currentCreatures = this.get('creatures');
        const activeIndex = Number(this.get('activeCreatureIndex')) || 0;
        if (Array.isArray(currentCreatures) && currentCreatures[activeIndex]) {
            const creatures = [...currentCreatures];
            creatures[activeIndex] = {
                ...creatures[activeIndex],
                portraits: {
                    schemaVersion: portraits.schemaVersion,
                    activeStage: portraits.activeStage,
                    byStage: { ...portraits.byStage }
                }
            };
            this.set('creatures', creatures);
        }

        this.save();
        this.emit('creaturePortraitReady', normalized);
        return true;
    }

    getCreaturePortrait(stage = null) {
        const targetStage = stage || this.get('creature.lifecycle.stage') || 'baby';
        const record = this.get(`creature.portraits.byStage.${targetStage}`);
        if (!record || record.status !== 'ready') return null;
        if (record.expiresAt && Date.now() >= record.expiresAt) {
            return null;
        }
        return { ...record };
    }

    // ==========================================
    // MULTI-CREATURE COLLECTION MANAGEMENT
    // ==========================================

    /**
     * Add current creature to the collection
     * Called when hatching a new creature or saving an offspring from breeding
     * @returns {Object} Result object with success status and reason
     *   - success: boolean - Whether creature was added
     *   - reason: string - 'added', 'full', or 'duplicate'
     *   - creature: object - The creature data (if added)
     */
    addCreatureToCollection(creatureData = null) {
        const creatures = this.get('creatures') || [];
        const maxCreatures = this.get('maxCreatures') || 8;

        if (creatures.length >= maxCreatures) {
            console.warn('[GameState] Creature collection is full!');
            this.emit('collectionFull', { max: maxCreatures, current: creatures.length });
            return { success: false, reason: 'full' };
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
            portraits: this.get('creature.portraits') || this.createEmptyPortraitState(),
            hatchTime: this.get('creature.hatchTime') || Date.now(),
            cosmicAffinity: this.get('creature.genes')?.cosmicAffinity?.element || null,
            rarity: this.get('creature.genes')?.rarity || 'common',
            lifecycle: { ...this.get('creature.lifecycle') }, // Include lifecycle for breeding eligibility
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
            return { success: false, reason: 'duplicate', creature };
        }

        creatures.push(creature);
        this.set('creatures', creatures);
        this.set('activeCreatureIndex', creatures.length - 1);

        this.emit('creatureAddedToCollection', { creature, index: creatures.length - 1 });
        console.log(`[GameState] Creature "${creature.name}" added to collection (${creatures.length}/${maxCreatures})`);

        // Check if breeding just became unlocked (2+ creatures)
        if (creatures.length === 2 && !this.get('tutorial.breedingUnlockSeen')) {
            console.log('[GameState] Breeding unlocked! Player now has 2 creatures.');
            this.emit('breedingUnlocked', {
                creatureCount: creatures.length,
                creatures: creatures.map(c => ({ name: c.name, id: c.id }))
            });
        }

        // Return object for new callers, but also truthy for backward compatibility
        const result = { success: true, reason: 'added', creature, index: creatures.length - 1 };
        return result;
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
                    textureName: this.get('creature.textureName'),
                    portraits: this.get('creature.portraits') || this.createEmptyPortraitState()
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
            previousCreature.portraits = this.get('creature.portraits') || this.createEmptyPortraitState();
            // Save lifecycle state back to collection (critical for stage cycling)
            previousCreature.lifecycle = { ...this.get('creature.lifecycle') };
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
        this.set('creature.portraits', newCreature.portraits || this.createEmptyPortraitState());
        this.set('creature.hatched', true);
        this.set('creature.named', true);
        // Load lifecycle from collection (critical for Fusion Pod to recognize stage)
        this.set('creature.lifecycle', newCreature.lifecycle || {
            stage: 'baby',
            birthDate: Date.now(),
            lastStageChange: Date.now()
        });

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
        this.set('creature.portraits', this.createEmptyPortraitState());
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
     * @returns {boolean} Whether a new permanent map unlock was recorded
     */
    addMapToCollection(gateId) {
        const gate = this.get(`hubWorld.gates.${gateId}`);
        if (!gate) {
            console.warn(`[GameState] Cannot add map for unknown gate: ${gateId}`);
            return false;
        }

        const mapsOwned = this.get('hubWorld.mapsOwned') || [];

        if (mapsOwned.includes(gateId)) {
            if (!gate.unlocked) {
                this.unlockGate(gateId, false);
                this.save();
            }
            return false;
        }

        this.set('hubWorld.mapsOwned', [...mapsOwned, gateId]);

        // Auto-unlock the gate now that player owns the map.
        const unlockResult = this.unlockGate(gateId, false);
        if (!unlockResult.success) {
            this.set('hubWorld.mapsOwned', mapsOwned);
            console.warn(`[GameState] Failed to unlock gate for map: ${gateId}`);
            return false;
        }

        this.emit('mapAcquired', { gateId });
        this.save();
        console.log(`[GameState] Map for gate "${gateId}" added and persisted`);
        return true;
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
        this.visitArea(`realm:${gateId}`, { persist: false });

        this.emit('gateEntered', { gateId, biome: gate.biome, visits: gate.visits });
        this.save();
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
            const saveData = this.createSaveSnapshot({ updatePlayTime: true });

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
     * Create the canonical versioned snapshot used by local and cloud saves.
     */
    createSaveSnapshot(options = {}) {
        const { updatePlayTime = false } = options;
        const now = Date.now();

        if (updatePlayTime && this.state.session) {
            const sessionStart = Number(this.state.session.sessionStart) || now;
            const sessionTime = Math.max(0, now - sessionStart);
            this.state.player.playTime += sessionTime;
            this.state.player.lastPlayed = now;
            this.state.session.sessionStart = now;
        }

        this.state.version = GAME_VERSION;
        if (updatePlayTime || !Number.isFinite(Number(this.state.savedAt))) {
            this.state.savedAt = now;
        }

        const snapshot = JSON.parse(JSON.stringify(this.state));
        delete snapshot.session;
        return snapshot;
    }

    /**
     * Report whether this browser currently has a durable game save.
     * Cloud recovery uses this distinction so a brand-new default state cannot
     * overwrite an existing remote save merely because it has a newer timestamp.
     */
    hasPersistedSave() {
        if (this.storageMode === 'memory') {
            return false;
        }

        try {
            return Boolean(localStorage.getItem(this.saveKey));
        } catch (error) {
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
                this.state.savedAt = Number(migrated.savedAt) || Date.now();

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
     * Validate, migrate, and apply a save received from an external source.
     * The active browser session is preserved and the restored state is written
     * locally without re-emitting a normal save event.
     */
    applyExternalSave(saveData, options = {}) {
        const { source = 'external', persist = true } = options;

        if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) {
            this.emit('externalLoadError', { source, type: 'invalid_structure' });
            return false;
        }

        const saveVersion = saveData.version || '1.0.0';
        if (!this.checkVersionCompatibility(saveVersion, GAME_VERSION)) {
            this.emit('externalLoadError', {
                source,
                type: 'version_mismatch',
                oldVersion: saveVersion,
                newVersion: GAME_VERSION
            });
            return false;
        }

        try {
            const clonedSave = JSON.parse(JSON.stringify(saveData));
            const migrated = this.migrateSaveData(clonedSave, saveVersion);
            const currentSession = this.state.session || {};
            const defaultState = this.createInitialState();

            this.state = this.deepMerge(defaultState, migrated);
            this.state.version = GAME_VERSION;
            this.state.savedAt = Number(migrated.savedAt) || Date.now();
            this.state.session = {
                ...defaultState.session,
                ...currentSession,
                sessionStart: Date.now()
            };

            if (persist && this.storageMode !== 'memory') {
                const localSnapshot = JSON.parse(JSON.stringify(this.state));
                delete localSnapshot.session;
                localStorage.setItem(this.saveKey, JSON.stringify(localSnapshot));
            }

            this.emit('externalLoaded', { source, state: this.get() });
            this.emit('loaded', this.state);
            console.log(`[GameState] ${source} save restored successfully`);
            return true;
        } catch (error) {
            console.error(`[GameState] Failed to restore ${source} save:`, error);
            this.emit('externalLoadError', { source, type: 'restore_failed', error });
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

        // CRITICAL: Sanitize colorGenome data to fix nested objects
        // Old buggy code returned {primary: {color: hex, saturation, brightness}}
        // New format should be {primary: hex, secondary: hex, accent: hex}
        this.sanitizeColorGenome(migrated);

        // CRITICAL: Fix stale inDevelopment flags on hub world gates
        // Old development builds may have left gates marked as inDevelopment
        // All gates are now ready for production
        this.migrateHubWorldGates(migrated);
        this.migrateCampaignProgress(migrated);

        console.log(`[GameState] Migration complete: ${fromVersion} → ${GAME_VERSION}`);
        return migrated;
    }

    /**
     * Migrate hub world gates to ensure inDevelopment flags are cleared
     * and gate unlock status is correct
     *
     * @param {Object} data - Save data to migrate (mutates in place)
     */
    migrateHubWorldGates(data) {
        if (!data?.hubWorld?.gates) return;

        const gates = data.hubWorld.gates;
        let migrationsMade = false;

        // Define expected gate states (all levels are now production-ready)
        const gateDefaults = {
            main: { inDevelopment: false },
            stellar_reef: { inDevelopment: false },
            crystal_caves: { inDevelopment: false },
            mythical_forest: { inDevelopment: false, unlocked: true }, // Should be unlocked by default
            void_peaks: { inDevelopment: false },
            aurora_depths: { inDevelopment: false },
            final_void: { inDevelopment: false }
        };

        // Fix each gate
        Object.keys(gates).forEach(gateId => {
            const gate = gates[gateId];
            const defaults = gateDefaults[gateId];

            if (!defaults) return;

            // Remove inDevelopment: true (all levels are ready)
            if (gate.inDevelopment === true) {
                console.log(`[GameState] Clearing inDevelopment flag for gate: ${gateId}`);
                gate.inDevelopment = false;
                migrationsMade = true;
            }

            // Ensure mythical_forest is unlocked (it's the first unlockable level)
            if (gateId === 'mythical_forest' && gate.unlocked !== true) {
                console.log(`[GameState] Unlocking mythical_forest gate (should be unlocked by default)`);
                gate.unlocked = true;
                migrationsMade = true;
            }
        });

        if (migrationsMade) {
            console.log('[GameState] Hub world gates migrated successfully');
        }
    }

    /**
     * Backfill campaign counters and final-gate state for saves created before
     * every playable level shared the same completion contract.
     */
    migrateCampaignProgress(data) {
        if (!data || typeof data !== 'object') return;

        const levels = data.levels || {};
        const completedLevels = Object.values(levels).filter(level => level?.completed === true).length;
        this.migrateProjectBeaconKatana(data);

        data.stats = data.stats || {};
        const recordedCompletions = Number.isFinite(data.stats.levelsCompleted)
            ? Math.max(0, Math.floor(data.stats.levelsCompleted))
            : 0;
        data.stats.levelsCompleted = Math.max(recordedCompletions, completedLevels);

        const shipParts = data.hubWorld?.shipParts;
        const gates = data.hubWorld?.gates;
        if (!shipParts || !gates) return;

        const preFinalPartIds = [
            'crystal_core',
            'dimensional_drive',
            'forest_core',
            'hull_plating',
            'aurora_reactor'
        ];
        const collected = Array.isArray(shipParts.collected) ? shipParts.collected : [];
        const collectedPreFinalParts = preFinalPartIds.filter(partId => collected.includes(partId)).length;
        const totalRequired = preFinalPartIds.length;
        shipParts.totalRequired = totalRequired;

        const beaconState = data.story?.projectBeacon;
        const hasDebriefTracking = Array.isArray(beaconState?.pendingDebriefs)
            || Array.isArray(beaconState?.debriefsSeen);
        const earnedDebriefCount = Math.min(
            preFinalPartIds.length,
            Math.max(completedLevels, Number(data.stats.levelsCompleted) || 0)
        );
        const milestoneGateIds = [
            'crystal_caves',
            'stellar_reef',
            'void_peaks',
            'aurora_depths'
        ];
        milestoneGateIds
            .slice(0, Math.min(earnedDebriefCount, milestoneGateIds.length))
            .forEach((gateId) => {
                if (gates[gateId]) {
                    gates[gateId].unlocked = true;
                }
            });

        if (!hasDebriefTracking && earnedDebriefCount > 0) {
            const partToLevel = {
                crystal_core: 'crystalCaves',
                dimensional_drive: 'cosmicReef',
                forest_core: 'mythicalForest',
                hull_plating: 'voidPeaks',
                aurora_reactor: 'auroraDepths'
            };
            const collectedPreFinal = collected.filter(partId => preFinalPartIds.includes(partId));

            data.story = data.story || {};
            data.story.projectBeacon = data.story.projectBeacon || {};
            data.story.projectBeacon.pendingDebriefs = Array.from(
                { length: earnedDebriefCount },
                (_, index) => {
                    const shipPartId = collectedPreFinal[index] || null;
                    return {
                        id: `beacon_debrief_${index + 1}`,
                        levelId: partToLevel[shipPartId] || null,
                        shipPartId,
                        completedAt: null
                    };
                }
            );
            data.story.projectBeacon.debriefsSeen = [];
        }

        if (collectedPreFinalParts >= totalRequired) {
            shipParts.finalBossUnlocked = true;
            if (data.hubWorld.shipCompletionCutsceneShown && gates.final_void) {
                gates.final_void.unlocked = true;
            }
        }
    }

    /**
     * Backfill creature-tech katana rewards for campaigns completed before the
     * two field-kit interfaces became playable.
     */
    migrateProjectBeaconKatana(data) {
        const fieldKit = data?.story?.projectBeacon?.fieldKit;
        const katana = fieldKit?.katana;
        if (!fieldKit?.recovered || !katana) {
            return;
        }

        const installed = Array.isArray(katana.installedUpgrades)
            ? [...katana.installedUpgrades]
            : [];
        const installedIds = new Set(
            installed
                .map(upgrade => typeof upgrade === 'string' ? upgrade : upgrade?.id)
                .filter(Boolean)
        );
        const upgradeSlots = Math.max(0, Number(katana.upgradeSlots) || 2);
        const earned = [
            {
                id: 'crystal_edge',
                name: 'Resonant Edge',
                source: 'Crystal Guardian',
                sourceLevelId: 'crystalCaves',
                completed: data.levels?.crystalCaves?.completed === true
            },
            {
                id: 'aurora_guard',
                name: 'Aurora Guard',
                source: 'Aurora Phoenix',
                sourceLevelId: 'auroraDepths',
                completed: data.levels?.auroraDepths?.completed === true
            }
        ];

        earned.forEach(upgrade => {
            if (
                upgrade.completed
                && !installedIds.has(upgrade.id)
                && installed.length < upgradeSlots
            ) {
                installed.push({
                    id: upgrade.id,
                    name: upgrade.name,
                    source: upgrade.source,
                    sourceLevelId: upgrade.sourceLevelId,
                    installedAt: null,
                    migrated: true
                });
                installedIds.add(upgrade.id);
            }
        });

        katana.upgradeSlots = upgradeSlots;
        katana.installedUpgrades = installed;
        if (installed.length > 0) {
            katana.configuration = 'creature_tech_adapted';
        }
    }

    /**
     * Sanitize colorGenome data to fix nested color objects
     *
     * CRITICAL: This fixes "Maximum call stack size exceeded" errors in Phaser's Color
     * system caused by passing objects instead of hex numbers to color methods.
     *
     * Fixes this structure:
     *   { primary: { color: 0xFF0000, saturation: 0.8 } }  →  { primary: 0xFF0000 }
     *
     * @param {Object} data - Save data to sanitize (mutates in place)
     */
    sanitizeColorGenome(data) {
        if (!data) return;

        // Helper to extract hex from potentially nested color
        const extractHex = (colorValue, fallback = 0x808080) => {
            if (typeof colorValue === 'number' && !isNaN(colorValue)) {
                return colorValue;
            }
            if (typeof colorValue === 'object' && colorValue !== null) {
                if (typeof colorValue.color === 'number') return colorValue.color;
                if (typeof colorValue.hex === 'number') return colorValue.hex;
                if (typeof colorValue.value === 'number') return colorValue.value;
                if (typeof colorValue.primary === 'number') return colorValue.primary;
            }
            return fallback;
        };

        // Sanitize colorGenome in a genes object
        const sanitizeGenes = (genes) => {
            if (!genes?.traits?.colorGenome) return;

            const cg = genes.traits.colorGenome;

            // Fix primary/secondary/accent if they're objects
            if (cg.primary && typeof cg.primary === 'object') {
                console.log('[GameState] Fixing nested colorGenome.primary');
                cg.primary = extractHex(cg.primary, 0x9370DB);
            }
            if (cg.secondary && typeof cg.secondary === 'object') {
                console.log('[GameState] Fixing nested colorGenome.secondary');
                cg.secondary = extractHex(cg.secondary, 0x8A2BE2);
            }
            if (cg.accent && typeof cg.accent === 'object') {
                console.log('[GameState] Fixing nested colorGenome.accent');
                cg.accent = extractHex(cg.accent, 0xFFD700);
            }
        };

        // Sanitize creature.genes
        if (data.creature?.genes) {
            sanitizeGenes(data.creature.genes);
        }

        // Sanitize creature.dna if it has colorGenome
        if (data.creature?.dna?.traits?.colorGenome) {
            sanitizeGenes(data.creature.dna);
        }

        // Sanitize creatures in collection
        if (data.collection?.creatures && Array.isArray(data.collection.creatures)) {
            data.collection.creatures.forEach(creature => {
                if (creature.genes) sanitizeGenes(creature.genes);
                if (creature.dna) sanitizeGenes(creature.dna);
            });
        }
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
     * Get bond status for creature relationship system
     * @returns {Object} Bond status information
     */
    getBondStatus() {
        const bond = this.get('creature.bond') || {
            level: 1,
            experience: 0,
            totalInteractions: 0,
            careActions: 0,
            conversations: 0,
            levelsCompleted: 0,
            abilitySlots: { slot1: true, slot2: false, slot3: false },
            equippedAbilities: { slot1: null, slot2: null, slot3: null }
        };

        const xpPerLevel = 50;
        const xpInCurrentLevel = bond.experience % xpPerLevel;
        const xpToNextLevel = xpPerLevel - xpInCurrentLevel;

        return {
            level: bond.level,
            experience: bond.experience,
            xpInCurrentLevel,
            xpToNextLevel,
            xpPerLevel,
            progressPercent: (xpInCurrentLevel / xpPerLevel) * 100,
            totalInteractions: bond.totalInteractions,
            careActions: bond.careActions,
            conversations: bond.conversations,
            levelsCompleted: bond.levelsCompleted,
            abilitySlots: bond.abilitySlots,
            equippedAbilities: bond.equippedAbilities,
            // Bond level descriptions
            description: this.getBondLevelDescription(bond.level)
        };
    }

    /**
     * Get bond level description
     * @param {number} level - Current bond level
     * @returns {Object} Level info with title and perks
     */
    getBondLevelDescription(level) {
        const levels = {
            1: { title: 'Stranger', perk: 'Starting your journey' },
            2: { title: 'Acquaintance', perk: 'Getting to know each other' },
            3: { title: 'Friend', perk: 'Building trust' },
            4: { title: 'Companion', perk: 'Growing closer' },
            5: { title: 'Trusted Ally', perk: 'Ability Slot 2 unlocked!' },
            6: { title: 'Close Friend', perk: 'Deeper connection' },
            7: { title: 'Partner', perk: 'Working as a team' },
            8: { title: 'Best Friend', perk: 'Unbreakable bond forming' },
            9: { title: 'Soulmate', perk: 'Understanding each other perfectly' },
            10: { title: 'Bonded', perk: 'Ability Slot 3 unlocked!' },
            11: { title: 'Inseparable', perk: 'Always together' },
            12: { title: 'Kindred Spirit', perk: 'Minds intertwined' },
            13: { title: 'Heart Link', perk: 'Emotions synchronized' },
            14: { title: 'Cosmic Pair', perk: 'Destiny intertwined' },
            15: { title: 'Eternal Bond', perk: 'Forever companions' },
            16: { title: 'Legendary', perk: 'Stories told of your bond' },
            17: { title: 'Mythical', perk: 'Bond transcends time' },
            18: { title: 'Transcendent', perk: 'Beyond mortal bonds' },
            19: { title: 'Divine', perk: 'Cosmic unity' },
            20: { title: 'Ultimate', perk: 'Perfect harmony achieved' }
        };

        return levels[Math.min(level, 20)] || levels[20];
    }

    /**
     * Equip an ability to a slot
     * @param {number} slotNumber - Slot number (1, 2, or 3)
     * @param {string} abilityId - Ability ID to equip (or null to unequip)
     * @returns {boolean} Success
     */
    equipAbility(slotNumber, abilityId) {
        const bond = this.get('creature.bond') || {};
        const slotKey = `slot${slotNumber}`;

        // Check if slot is unlocked
        if (!bond.abilitySlots?.[slotKey]) {
            console.warn(`[GameState] Ability slot ${slotNumber} is not unlocked`);
            return false;
        }

        // Update equipped abilities
        const equippedAbilities = { ...bond.equippedAbilities };
        equippedAbilities[slotKey] = abilityId;

        this.set('creature.bond.equippedAbilities', equippedAbilities);
        this.emit('abilityEquipped', { slot: slotNumber, abilityId });

        console.log(`[GameState] Equipped ${abilityId || 'nothing'} to slot ${slotNumber}`);
        return true;
    }

    /**
     * Get equipped abilities
     * @returns {Object} Equipped abilities by slot
     */
    getEquippedAbilities() {
        const bond = this.get('creature.bond') || {};
        return bond.equippedAbilities || { slot1: null, slot2: null, slot3: null };
    }

    /**
     * Check if ability slot is unlocked
     * @param {number} slotNumber - Slot number (1, 2, or 3)
     * @returns {boolean} Whether slot is unlocked
     */
    isAbilitySlotUnlocked(slotNumber) {
        const bond = this.get('creature.bond') || {};
        const slotKey = `slot${slotNumber}`;
        return bond.abilitySlots?.[slotKey] || false;
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

/**
 * GameStateManager - Central state management system for the mythical creature game
 * Handles player progression, world state, creature data, and persistence
 */

// GAME VERSION - Increment when making breaking changes to save data schema
const GAME_VERSION = '1.1.0'; // Format: major.minor.patch
const SAVE_BACKUP_LIMIT = 3;
const SAVE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const FUSION_TRANSACTION_SCHEMA_VERSION = 2;
const FUSION_DISCOVERY_SCHEMA_VERSION = 1;
const KINSHIP_BEACON_SCHEMA_VERSION = 2;
const FUSION_TRANSACTION_TTL_MS = 30 * 60 * 1000;
const MAX_FUSION_HISTORY = 50;
const MAX_FUSION_RECONCILIATIONS = 1;
const CREATURE_LIFECYCLE_DAY_MS = 24 * 60 * 60 * 1000;
const CREATURE_LIFECYCLE_STAGES = ['baby', 'juvenile', 'adult', 'elder'];
const CREATURE_LIFECYCLE_THRESHOLDS = {
    baby: 0,
    juvenile: 1,
    adult: 2,
    elder: 9
};
const MIN_HAPPINESS_TO_EVOLVE = 50;
const PORTRAIT_STATE_SCHEMA_VERSION = 2;
const CAMPAIGN_ROUTE_SEQUENCE = Object.freeze([
    Object.freeze({
        gateId: 'mythical_forest',
        levelStateId: 'mythicalForest',
        label: 'Mythical Forest',
        shipPartId: 'forest_core',
        debriefId: 'beacon_debrief_1'
    }),
    Object.freeze({
        gateId: 'crystal_caves',
        levelStateId: 'crystalCaves',
        label: 'Crystal Caves',
        shipPartId: 'crystal_core',
        debriefId: 'beacon_debrief_2'
    }),
    Object.freeze({
        gateId: 'stellar_reef',
        levelStateId: 'cosmicReef',
        label: 'Stellar Reef',
        shipPartId: 'dimensional_drive',
        debriefId: 'beacon_debrief_3'
    }),
    Object.freeze({
        gateId: 'void_peaks',
        levelStateId: 'voidPeaks',
        label: 'Void Peaks',
        shipPartId: 'hull_plating',
        debriefId: 'beacon_debrief_4'
    }),
    Object.freeze({
        gateId: 'aurora_depths',
        levelStateId: 'auroraDepths',
        label: 'Aurora Depths',
        shipPartId: 'aurora_reactor',
        debriefId: 'beacon_debrief_5'
    }),
    Object.freeze({
        gateId: 'final_void',
        levelStateId: 'finalVoid',
        label: 'The Final Void',
        shipPartId: 'command_module',
        debriefId: null
    })
]);
const PORTRAIT_ASSET_REF_PATTERN =
    /^portrait-job-v1:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORTABLE_CREATURE_FIELDS = [
    'id',
    'name',
    'hatched',
    'hatchTime',
    'level',
    'experience',
    'stats',
    'traits',
    'genes',
    'dna',
    'colors',
    'powerHistory',
    'agencyHistory',
    'portraits',
    'identityArchive',
    'care',
    'lifecycle',
    'mood',
    'bond',
    'personality',
    'personalityState',
    'textureName',
    'cosmicAffinity',
    'rarity',
    'generation',
    'parentIds',
    'isOffspring',
    'offspringBonus',
    'birthEvents',
    'secretAbilities',
    'isShiny',
    'hasDualAffinity',
    'dualAffinity',
    'isTwin',
    'twinIndex',
    'twinSiblingId',
    'twinSiblingName',
    'lineage'
];

function readStatePath(data, propertyPath) {
    return propertyPath.split('.').reduce(
        (value, key) => value?.[key],
        data
    );
}

function getCampaignGateAccessFromData(data, gateId) {
    const routeIndex = CAMPAIGN_ROUTE_SEQUENCE.findIndex(
        route => route.gateId === gateId
    );
    const gate = readStatePath(data, `hubWorld.gates.${gateId}`);
    const mapsOwned = readStatePath(data, 'hubWorld.mapsOwned');

    if (routeIndex < 0) {
        return {
            gateId,
            isCampaignGate: false,
            discovered: Boolean(gate),
            prerequisitesMet: true,
            missingPrerequisites: [],
            shipRequirementsMet: true,
            unlocked: gate?.unlocked === true
        };
    }

    const priorRoutes = CAMPAIGN_ROUTE_SEQUENCE.slice(0, routeIndex);
    const missingPrerequisites = priorRoutes.filter(route => (
        readStatePath(data, `levels.${route.levelStateId}.completed`) !== true
    ));
    const route = CAMPAIGN_ROUTE_SEQUENCE[routeIndex];
    const requiresShipAssembly = gate?.requiresAllParts === true || gateId === 'final_void';
    const shipRequirementsMet = !requiresShipAssembly || (
        readStatePath(data, 'hubWorld.shipParts.finalBossUnlocked') === true &&
        readStatePath(data, 'hubWorld.shipCompletionCutsceneShown') === true
    );

    return {
        gateId,
        levelStateId: route.levelStateId,
        label: route.label,
        isCampaignGate: true,
        discovered: routeIndex === 0 ||
            Array.isArray(mapsOwned) && mapsOwned.includes(gateId) ||
            gate?.unlocked === true,
        prerequisitesMet: missingPrerequisites.length === 0,
        missingPrerequisites: missingPrerequisites.map(missing => ({
            gateId: missing.gateId,
            levelStateId: missing.levelStateId,
            label: missing.label
        })),
        nextRequiredRoute: missingPrerequisites[0]
            ? {
                gateId: missingPrerequisites[0].gateId,
                levelStateId: missingPrerequisites[0].levelStateId,
                label: missingPrerequisites[0].label
            }
            : null,
        shipRequirementsMet,
        unlocked: gate?.unlocked === true &&
            missingPrerequisites.length === 0 &&
            shipRequirementsMet
    };
}

class GameStateManager {
    constructor() {
        this.initialized = false;
        this.saveKey = 'mythical-creature-save';
        this.saveBackupIndexKey = `${this.saveKey}-backup-index`;
        this.saveBackupKeyPrefix = `${this.saveKey}-backup-`;
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
            schemaVersion: PORTRAIT_STATE_SCHEMA_VERSION,
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
                        name: 'Wanderer-77 Field Kit',
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
                    highPowerReveals: [],
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
                    endingEpilogueCompletedAt: null,
                    finale: {
                        schemaVersion: 1,
                        sharedOutcome: null,
                        priority: null,
                        prioritySelectedAt: null,
                        epilogueSeen: false,
                        epilogueCompletedAt: null
                    },
                    remainAndDefend: {
                        schemaVersion: 1,
                        status: 'not_started',
                        completedAt: null,
                        completionOperationId: null,
                        priorityAtCompletion: null,
                        history: []
                    },
                    sensei: {
                        schemaVersion: 2,
                        relationship: 'pre_mission_friend_and_training_partner',
                        memories: [
                            'begin_with_your_footing',
                            'trust_begins_with_how_you_enter',
                            'power_is_knowing_what_not_to_take'
                        ],
                        memoryLedger: {
                            schemaVersion: 1,
                            recalledMemoryIds: [],
                            lesson: {
                                id: 'centering_stance',
                                status: 'locked',
                                practiceCount: 0,
                                firstPracticedAt: null,
                                lastPracticedAt: null
                            },
                            history: []
                        },
                        encryptedContact: {
                            channelId: 'DOJO-23-77',
                            status: 'fragmented',
                            contactAttempted: false,
                            contactEstablished: false,
                            recoveredAt: null
                        }
                    },
                    shipCapabilities: {
                        schemaVersion: 1,
                        stealthDescent: 'damaged',
                        secureReturnVector: 'unavailable',
                        manualLanding: 'unavailable',
                        blackBoxProof: 'missing',
                        passengerCapacity: 0,
                        creatureLifeSupport: 'not_assessed',
                        longRangeUplink: 'offline'
                    },
                    shipReconstruction: {
                        schemaVersion: 1,
                        completedStepIds: [],
                        firstInstalledAt: null,
                        completedAt: null,
                        history: []
                    },
                    shipFieldSupport: {
                        schemaVersion: 1,
                        lastServicedLevel: 0,
                        serviceCount: 0,
                        lastServicedAt: null,
                        history: []
                    },
                    shipArchive: {
                        schemaVersion: 1,
                        reviewedSectionIds: [],
                        firstReviewedAt: null,
                        completedAt: null,
                        history: []
                    },
                    protectedReturnProtocol: {
                        schemaVersion: 1,
                        completedStepIds: [],
                        packetStatus: 'not_prepared',
                        transmissionStatus: 'not_sent',
                        firstAppliedAt: null,
                        completedAt: null,
                        history: []
                    },
                    companionConsent: {
                        schemaVersion: 2,
                        activeCompanionId: null,
                        records: []
                    },
                    companionEarthMemory: {
                        schemaVersion: 1,
                        activeCompanionId: null,
                        records: []
                    },
                    legacyCapsule: null
                },
                companionMedia: {
                    schemaVersion: 2,
                    activeIdentityKey: null,
                    appearances: {},
                    videos: {},
                    lastMomentId: null,
                    lastViewedAt: null
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
                hatchTransaction: null,
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
                genetics: null,
                colors: {
                    body: 0x9370DB,
                    head: 0xDDA0DD,
                    wings: 0x9370DB
                },
                powerHistory: [],
                agencyHistory: [],
                portraits: this.createEmptyPortraitState(),
                identityArchive: {
                    schemaVersion: 1,
                    creatureId: 'active_companion',
                    reviewedChapterIds: [],
                    firstReviewedAt: null,
                    completedAt: null,
                    history: []
                },
                care: {
                    lastCareTime: null,
                    lastOfflineRecoveryTime: null,
                    careStreak: 0,
                    careHistory: [],
                    dailyCare: {
                        feedCount: 0,
                        playCount: 0,
                        petCount: 0,
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
                currentEcology: {
                    schemaVersion: 3,
                    observedSignalIds: [],
                    restoredRegionIds: [],
                    arrivalConsequences: {},
                    regions: {},
                    history: []
                },
                fendCommunity: {
                    schemaVersion: 1,
                    builtProjectIds: [],
                    contributionHistory: [],
                    foundedAt: null,
                    lastContributionAt: null
                },
                village: {
                    schemaVersion: 1,
                    foundedAt: null,
                    starterSuppliesClaimed: false,
                    guidanceSeen: false,
                    resources: {
                        wood: 0,
                        stone: 0,
                        food: 0
                    },
                    lifetimeProduced: {
                        wood: 0,
                        stone: 0,
                        food: 0
                    },
                    buildings: [],
                    history: [],
                    lastReconciledAt: null
                },
                fendResidents: {
                    schemaVersion: 1,
                    metResidentIds: [],
                    activeRequestId: null,
                    activeRequestBaseline: null,
                    completedRequestIds: [],
                    history: [],
                    firstMetAt: null,
                    lastInteractionAt: null,
                    activeResidentId: null
                },
                guardianResidents: {
                    schemaVersion: 4,
                    rescuedIds: [],
                    metIds: [],
                    interactions: {},
                    rescueHistory: [],
                    acceptedTaskIds: [],
                    completedTaskIds: [],
                    taskBaselines: {},
                    activityEvidence: {
                        gardenVisits: 0,
                        campfireRests: 0,
                        targetHits: 0
                    },
                    routineAssists: {},
                    routineHistory: [],
                    expeditionHistory: [],
                    pendingExpeditionDebrief: null,
                    activeTeamGuardianId: null,
                    lastInteractionId: null,
                    lastInteractionAt: null
                },
                rescuedResidents: {
                    schemaVersion: 1,
                    rescuedIds: [],
                    interactions: {},
                    rescueHistory: [],
                    lastInteractionId: null,
                    lastInteractionAt: null
                },
                fendCulture: {
                    schemaVersion: 1,
                    firstListening: {
                        status: 'locked',
                        heldAt: null,
                        operationId: null,
                        selectedPriority: null
                    },
                    history: []
                },
                currentVeilMission: {
                    schemaVersion: 1,
                    status: 'not_started',
                    stabilizedAnchorIds: [],
                    maskStatus: 'inactive',
                    transmissionStatus: 'not_sent',
                    startedAt: null,
                    completedAt: null,
                    history: []
                },
                sanctuaryDecorations: {
                    voidCrystals: 0,
                    kinshipBeacon: {
                        schemaVersion: KINSHIP_BEACON_SCHEMA_VERSION,
                        unlocked: false,
                        firstOperationId: null,
                        firstLitAt: null,
                        lineageCount: 0,
                        lastOperationId: null,
                        lastLitAt: null,
                        sharedLineageCount: 0,
                        firstSharedOperationId: null,
                        firstSharedAt: null,
                        lastSharedOperationId: null,
                        lastSharedAt: null
                    }
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
                schemaVersion: FUSION_TRANSACTION_SCHEMA_VERSION,
                unlocked: false,
                discovery: {
                    schemaVersion: FUSION_DISCOVERY_SCHEMA_VERSION,
                    state: 'dormant',
                    source: 'fend_current_archive',
                    discoveredAt: null,
                    stabilizedAt: null,
                    firstLineageAt: null,
                    firstLineageOperationId: null,
                    introductionAcknowledged: false
                },
                lastBreedingTime: null,
                breedingCooldown: 24 * 60 * 60 * 1000,
                breedingHistory: [],
                pendingFusion: null,
                completedOperationIds: [],
                reconciliationQueue: [],
                sharedFusion: {
                    schemaVersion: 1,
                    activeInvitation: null,
                    completedOperationIds: [],
                    pendingReveal: null
                },
                consent: {
                    schemaVersion: 1,
                    records: [],
                    sharedBoundary: {
                        status: 'sealed',
                        reason: 'protected_invitation_required',
                        requires: [
                            'keeper_a_grant',
                            'keeper_b_grant',
                            'companion_a_grant',
                            'companion_b_grant',
                            'server_invitation'
                        ],
                        excludes: [
                            'public_matchmaking',
                            'open_trading',
                            'player_search',
                            'location_sharing'
                        ]
                    }
                }
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
                abandonmentSeen: false,
                breedingUnlockSeen: false
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
        const genes = this.get('creature.genes') || this.get('creature.genetics');
        if (!genes || typeof genes !== 'object' || !genes.id) {
            console.error('[GameState] Refusing to complete hatching without a durable creature identity');
            return false;
        }

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

        return true;
    }

    /**
     * Persist generated portrait metadata for the active creature.
     */
    saveCreaturePortrait(record) {
        const allowedStages = new Set(['baby', 'juvenile', 'adult', 'elder']);
        if (!record || typeof record !== 'object' || !allowedStages.has(record.stage)) {
            return false;
        }
        const imageUrl = (
            typeof record.imageUrl !== 'string' ||
            record.imageUrl.length > 2048 ||
            !/^https:\/\//i.test(record.imageUrl)
        )
            ? null
            : record.imageUrl;
        const assetRef = PORTRAIT_ASSET_REF_PATTERN.test(
            record.assetRef || ''
        )
            ? record.assetRef.toLowerCase()
            : null;
        if (!imageUrl && !assetRef) {
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
            schemaVersion: PORTRAIT_STATE_SCHEMA_VERSION,
            identityKey: record.identityKey,
            stage: record.stage,
            style: typeof record.style === 'string' ? record.style.slice(0, 32) : 'cinematic',
            imageUrl,
            assetRef,
            status: record.status === 'processing' && !imageUrl
                ? 'processing'
                : 'ready',
            provider: typeof record.provider === 'string' ? record.provider.slice(0, 48) : 'unknown',
            model: typeof record.model === 'string' ? record.model.slice(0, 80) : 'unknown',
            promptVersion: typeof record.promptVersion === 'string'
                ? record.promptVersion.slice(0, 48)
                : 'unknown',
            generatedAt: Number.isFinite(Number(record.generatedAt))
                ? Number(record.generatedAt)
                : Date.now(),
            generationDurationMs: Number.isFinite(Number(record.generationDurationMs))
                ? Math.max(0, Math.round(Number(record.generationDurationMs)))
                : null,
            pollCount: Number.isFinite(Number(record.pollCount))
                ? Math.max(0, Math.round(Number(record.pollCount)))
                : 0,
            expiresAt: Number.isFinite(Number(record.expiresAt))
                ? Number(record.expiresAt)
                : null,
            storage: assetRef || record.storage === 'supabase-private'
                ? 'supabase-private'
                : 'provider-temporary',
            jobId: typeof record.jobId === 'string'
                ? record.jobId.slice(0, 64)
                : null,
            aiGenerated: true
        };

        const current = this.get('creature.portraits');
        const portraits = current && typeof current === 'object'
            ? {
                schemaVersion: PORTRAIT_STATE_SCHEMA_VERSION,
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
        if (!record) return null;
        if (record.status === 'processing' && record.assetRef) {
            return {
                ...record,
                imageUrl: null,
                expiresAt: null
            };
        }
        if (record.status !== 'ready') return null;
        if (record.expiresAt && Date.now() >= record.expiresAt) {
            if (!record.assetRef) return null;
            return {
                ...record,
                imageUrl: null,
                expiresAt: null
            };
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
            identityArchive: this.get('creature.identityArchive') || {
                schemaVersion: 1,
                creatureId: this.get('creature.id')
                    || this.get('creature.genes.id')
                    || 'active_companion',
                reviewedChapterIds: [],
                firstReviewedAt: null,
                completedAt: null,
                history: []
            },
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
        const newIndex = creatures.length - 1;
        this.set('creatures', creatures);
        this.switchActiveCreature(newIndex);

        this.emit('creatureAddedToCollection', { creature, index: newIndex });
        console.log(`[GameState] Creature "${creature.name}" added to collection (${creatures.length}/${maxCreatures})`);

        const fusionDiscovery = this.syncFusionDiscovery({ emitEvents: true });
        if (fusionDiscovery.newlyDiscovered) {
            console.log('[GameState] Fusion Pod signal discovered from two family records.');
            // Compatibility event for older listeners. The Pod is discovered here;
            // operational readiness remains governed by level and lifecycle checks.
            this.emit('breedingUnlocked', {
                creatureCount: creatures.length,
                creatures: creatures.map(c => ({ name: c.name, id: c.id })),
                discovery: fusionDiscovery.discovery
            });
        }

        // Return object for new callers, but also truthy for backward compatibility
        const result = { success: true, reason: 'added', creature, index: newIndex };
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
                    id: this.get('creature.id'),
                    name: this.get('creature.name'),
                    genes: this.get('creature.genes'),
                    stats: this.get('creature.stats'),
                    level: this.get('creature.level'),
                    textureName: this.get('creature.textureName'),
                    portraits: this.get('creature.portraits') || this.createEmptyPortraitState(),
                    lifecycle: this.get('creature.lifecycle'),
                    bond: this.get('creature.bond'),
                    powerHistory: this.get('creature.powerHistory') || [],
                    agencyHistory: this.get('creature.agencyHistory') || [],
                    lineage: this.get('creature.lineage') || null
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
        const activeCreatureId = this.get('creature.id');

        // Save the complete portable creature record before switching. Keeping
        // lineage, bond, powers, and portrait provenance here prevents data
        // loss when companions are swapped or later synced between devices.
        // Identity must match before writing: an old or externally restored
        // active slot must never overwrite a different collection record.
        if (previousCreature && activeCreatureId === previousCreature.id) {
            PORTABLE_CREATURE_FIELDS.forEach(field => {
                const activeValue = this.get(`creature.${field}`);
                if (activeValue !== undefined) {
                    previousCreature[field] = this.clonePortableValue(activeValue);
                }
            });
            creatures[previousIndex] = previousCreature;
        }

        // Build the active slot from clean defaults so optional powers, twin
        // metadata, or lineage from the previous companion cannot leak into
        // the newly selected creature.
        const portableRecord = {};
        PORTABLE_CREATURE_FIELDS.forEach(field => {
            if (newCreature[field] !== undefined) {
                portableRecord[field] = this.clonePortableValue(newCreature[field]);
            }
        });
        const nextActiveCreature = this.deepMerge(
            this.createInitialState().creature,
            portableRecord
        );
        nextActiveCreature.hatched = true;
        nextActiveCreature.named = newCreature.named ?? Boolean(newCreature.name);
        nextActiveCreature.identityArchive = {
            schemaVersion: 1,
            creatureId: newCreature.id
                || newCreature.genes?.id
                || 'active_companion',
            reviewedChapterIds: Array.isArray(
                newCreature.identityArchive?.reviewedChapterIds
            )
                ? [...newCreature.identityArchive.reviewedChapterIds]
                : [],
            firstReviewedAt:
                newCreature.identityArchive?.firstReviewedAt || null,
            completedAt:
                newCreature.identityArchive?.completedAt || null,
            history: Array.isArray(newCreature.identityArchive?.history)
                ? [...newCreature.identityArchive.history]
                : []
        };

        if (!nextActiveCreature.lifecycle.birthDate) {
            nextActiveCreature.lifecycle.birthDate =
                newCreature.hatchTime || Date.now();
            nextActiveCreature.lifecycle.lastStageChange =
                nextActiveCreature.lifecycle.lastStageChange ||
                nextActiveCreature.lifecycle.birthDate;
        }

        this.set('activeCreatureIndex', index);
        this.set('creature', nextActiveCreature);
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

    clonePortableValue(value) {
        if (value === undefined || value === null) {
            return value;
        }

        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // Fall through to JSON cloning for plain save data.
            }
        }

        return typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : value;
    }

    /**
     * Get all creatures in collection
     * @returns {Array} Array of creatures
     */
    getCreatureCollection() {
        return this.get('creatures') || [];
    }

    /**
     * Reconcile lifecycle stages for every stored creature, including inactive
     * companions. Evolution remains blocked by the same wellbeing rules used
     * by the active-creature lifecycle system.
     */
    reconcileCreatureCollectionLifecycles({ now = Date.now(), persist = false } = {}) {
        const collection = this.getCreatureCollection();
        const activeIndex = this.get('activeCreatureIndex') || 0;
        const updatedIds = [];

        const reconciled = collection.map((creature, index) => {
            if (!creature || typeof creature !== 'object') return creature;

            const lifecycle = {
                ...(creature.lifecycle || {})
            };
            const rawBirthDate = lifecycle.birthDate ?? creature.hatchTime;
            const birthDate = typeof rawBirthDate === 'number'
                ? rawBirthDate
                : Date.parse(rawBirthDate);

            if (!Number.isFinite(birthDate) || birthDate > now) {
                return creature;
            }

            const happiness = Number.isFinite(creature.stats?.happiness)
                ? creature.stats.happiness
                : 100;
            const mood = String(creature.mood?.current || 'happy').toLowerCase();
            const evolutionBlocked = Boolean(
                lifecycle.isStuck ||
                lifecycle.hasDeparted ||
                happiness < MIN_HAPPINESS_TO_EVOLVE ||
                mood === 'sad' ||
                mood === 'abandoned'
            );
            if (evolutionBlocked) return creature;

            const fullDaysAlive = Math.max(
                0,
                Math.floor((now - birthDate) / CREATURE_LIFECYCLE_DAY_MS)
            );
            const expectedStage = [...CREATURE_LIFECYCLE_STAGES]
                .reverse()
                .find(stage => fullDaysAlive >= CREATURE_LIFECYCLE_THRESHOLDS[stage]) ||
                'baby';
            const currentStage = CREATURE_LIFECYCLE_STAGES.includes(lifecycle.stage)
                ? lifecycle.stage
                : 'baby';
            const currentIndex = CREATURE_LIFECYCLE_STAGES.indexOf(currentStage);
            const expectedIndex = CREATURE_LIFECYCLE_STAGES.indexOf(expectedStage);

            if (expectedIndex <= currentIndex) return creature;

            const evolutionHistory = Array.isArray(lifecycle.evolutionHistory)
                ? [...lifecycle.evolutionHistory]
                : [];
            for (let stageIndex = currentIndex + 1; stageIndex <= expectedIndex; stageIndex++) {
                const stage = CREATURE_LIFECYCLE_STAGES[stageIndex];
                if (!evolutionHistory.some(entry => entry?.stage === stage)) {
                    evolutionHistory.push({
                        stage,
                        timestamp: Math.min(
                            now,
                            birthDate +
                                CREATURE_LIFECYCLE_THRESHOLDS[stage] *
                                CREATURE_LIFECYCLE_DAY_MS
                        ),
                        source: 'collection_reconciliation'
                    });
                }
            }

            const nextCreature = {
                ...creature,
                lifecycle: {
                    ...lifecycle,
                    birthDate,
                    stage: expectedStage,
                    lastStageChange: evolutionHistory.at(-1)?.timestamp || now,
                    evolutionHistory
                }
            };
            updatedIds.push(nextCreature.id || `collection_${index}`);
            return nextCreature;
        });

        if (updatedIds.length === 0) {
            return { changed: false, updatedIds: [] };
        }

        this.set('creatures', reconciled);
        const activeCreature = reconciled[activeIndex];
        if (activeCreature?.lifecycle) {
            this.set('creature.lifecycle', this.clonePortableValue(activeCreature.lifecycle));
        }
        if (persist) this.save();

        this.emit('creatureCollectionLifecyclesReconciled', { updatedIds });
        return { changed: true, updatedIds };
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
        return this.getCampaignGateAccess(gateId).unlocked;
    }

    /**
     * Return effective campaign access without treating a purchased route map
     * as permission to skip earlier expeditions.
     */
    getCampaignGateAccess(gateId) {
        return getCampaignGateAccessFromData(this.state, gateId);
    }

    /**
     * Reconcile raw gate flags with explicit level records. This also lets an
     * older out-of-order save recover automatically as soon as its missing
     * earlier expedition is completed.
     */
    syncCanonicalCampaignGates({ emitEvents = true } = {}) {
        const changedGateIds = [];

        CAMPAIGN_ROUTE_SEQUENCE.forEach((route, routeIndex) => {
            const gatePath = `hubWorld.gates.${route.gateId}`;
            const gate = this.get(gatePath);
            if (!gate) return;

            const prerequisitesMet = CAMPAIGN_ROUTE_SEQUENCE
                .slice(0, routeIndex)
                .every(previousRoute => (
                    this.get(
                        `levels.${previousRoute.levelStateId}.completed`
                    ) === true
                ));
            const shipRequirementsMet = route.gateId !== 'final_void' || (
                this.get('hubWorld.shipParts.finalBossUnlocked') === true &&
                this.get('hubWorld.shipCompletionCutsceneShown') === true
            );
            const shouldUnlock = prerequisitesMet && shipRequirementsMet;

            if (gate.unlocked === shouldUnlock) return;
            this.set(gatePath, { ...gate, unlocked: shouldUnlock });
            changedGateIds.push(route.gateId);
            if (emitEvents) {
                this.emit(
                    shouldUnlock ? 'gateUnlocked' : 'gateRelocked',
                    {
                        gateId: route.gateId,
                        method: 'campaign_sync'
                    }
                );
            }
        });

        return changedGateIds;
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

        const campaignAccess = this.getCampaignGateAccess(gateId);
        if (!campaignAccess.prerequisitesMet) {
            return {
                success: false,
                code: 'campaign_prerequisite',
                reason: `Complete ${campaignAccess.nextRequiredRoute.label} first`,
                requiredRoute: campaignAccess.nextRequiredRoute,
                discovered: campaignAccess.discovered
            };
        }

        if (!campaignAccess.shipRequirementsMet) {
            return {
                success: false,
                code: 'ship_requirements',
                reason: 'Finish rebuilding Wanderer-77 before entering the Final Void'
            };
        }

        if (campaignAccess.unlocked) {
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
     * @param {string} gateId - ID of the route the map discovers
     * @returns {boolean} Whether a new permanent route discovery was recorded
     */
    addMapToCollection(gateId) {
        const gate = this.get(`hubWorld.gates.${gateId}`);
        if (!gate) {
            console.warn(`[GameState] Cannot add map for unknown gate: ${gateId}`);
            return false;
        }

        const mapsOwned = this.get('hubWorld.mapsOwned') || [];

        if (mapsOwned.includes(gateId)) {
            return false;
        }

        this.set('hubWorld.mapsOwned', [...mapsOwned, gateId]);
        const campaignAccess = this.getCampaignGateAccess(gateId);
        this.emit('mapAcquired', {
            gateId,
            discovered: true,
            prerequisitesMet: campaignAccess.prerequisitesMet,
            requiredRoute: campaignAccess.nextRequiredRoute
        });
        this.save();
        console.log(`[GameState] Route "${gateId}" discovered and persisted`);
        return true;
    }

    /**
     * Enter a gate (travel to biome)
     * @param {string} gateId - ID of the gate to enter
     * @returns {Object} Result of enter attempt
     */
    enterGate(gateId) {
        const campaignAccess = this.getCampaignGateAccess(gateId);
        if (!campaignAccess.prerequisitesMet) {
            return {
                success: false,
                code: 'campaign_prerequisite',
                reason: `Complete ${campaignAccess.nextRequiredRoute.label} first`,
                requiredRoute: campaignAccess.nextRequiredRoute,
                discovered: campaignAccess.discovered
            };
        }

        if (!campaignAccess.shipRequirementsMet) {
            return {
                success: false,
                code: 'ship_requirements',
                reason: 'Finish rebuilding Wanderer-77 before entering the Final Void'
            };
        }

        if (!campaignAccess.unlocked) {
            return { success: false, code: 'gate_locked', reason: 'Gate is locked' };
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
            const discovery = this.syncFusionDiscovery({ emitEvents: true });
            this.emit('breedingShrineUnlocked', {
                level: creatureLevel,
                discovery: discovery.discovery
            });

            console.log('[GameState] Breeding shrine unlocked at level', creatureLevel);
            return true;
        }

        return false;
    }

    syncFusionDiscovery(options = {}) {
        const { emitEvents = false } = options;
        const existing = this.get('breedingShrine.discovery') || {};
        const creatureCount = (this.get('creatures') || []).length;
        const shrineUnlocked = Boolean(this.get('breedingShrine.unlocked'));
        const hasFirstLineage = Boolean(
            existing.firstLineageOperationId ||
            this.get('world.sanctuaryDecorations.kinshipBeacon.firstOperationId')
        );
        const now = Date.now();

        let state = 'dormant';
        if (hasFirstLineage) {
            state = 'first_lineage';
        } else if (creatureCount >= 2 && shrineUnlocked) {
            state = 'stable';
        } else if (creatureCount >= 2) {
            state = 'two_signals';
        }

        const wasDiscovered = existing.state && existing.state !== 'dormant';
        const wasStable = ['stable', 'first_lineage'].includes(existing.state);
        const newlyDiscovered = !wasDiscovered && creatureCount >= 2;
        const newlyStable = !wasStable && ['stable', 'first_lineage'].includes(state);
        const discovery = {
            schemaVersion: FUSION_DISCOVERY_SCHEMA_VERSION,
            state,
            source: 'fend_current_archive',
            discoveredAt: existing.discoveredAt || (creatureCount >= 2 ? now : null),
            stabilizedAt: existing.stabilizedAt || (newlyStable ? now : null),
            firstLineageAt: existing.firstLineageAt || null,
            firstLineageOperationId: existing.firstLineageOperationId || null,
            introductionAcknowledged: Boolean(existing.introductionAcknowledged)
        };

        if (JSON.stringify(existing) !== JSON.stringify(discovery)) {
            this.set('breedingShrine.discovery', discovery);
        }

        const payload = {
            creatureCount,
            creatures: (this.get('creatures') || []).map(creature => ({
                id: creature.id,
                name: creature.name
            })),
            discovery
        };
        if (emitEvents && newlyDiscovered) {
            this.emit('fusionPodDiscovered', payload);
        }
        if (emitEvents && newlyStable) {
            this.emit('fusionPodStabilized', payload);
        }

        return {
            discovery,
            newlyDiscovered,
            newlyStable,
            shouldIntroduce: creatureCount >= 2 &&
                !discovery.introductionAcknowledged
        };
    }

    acknowledgeFusionDiscovery() {
        const current = this.syncFusionDiscovery().discovery;
        if (current.introductionAcknowledged) {
            return false;
        }

        this.set('breedingShrine.discovery', {
            ...current,
            introductionAcknowledged: true
        });
        this.set('tutorial.breedingUnlockSeen', true);
        this.save();
        return true;
    }

    normalizeKinshipBeaconState(
        state = {},
        breedingHistory = [],
        fallbackOperationId = null,
        fallbackCompletedAt = null
    ) {
        const source = state && typeof state === 'object' ? state : {};
        const history = Array.isArray(breedingHistory)
            ? breedingHistory
            : [];
        const seen = new Set();
        const records = history.map(entry => {
            const operationId = typeof entry?.operationId === 'string'
                ? entry.operationId.slice(0, 180)
                : null;
            if (!operationId || seen.has(operationId)) return null;
            seen.add(operationId);
            const rawTime = entry?.completedAt;
            const parsedTime = typeof rawTime === 'number'
                ? rawTime
                : Date.parse(rawTime);
            return {
                operationId,
                shared: entry?.origin === 'shared_fusion',
                completedAt: Number.isFinite(parsedTime)
                    ? parsedTime
                    : null
            };
        }).filter(Boolean);
        if (
            typeof fallbackOperationId === 'string' &&
            fallbackOperationId.length > 0 &&
            !seen.has(fallbackOperationId)
        ) {
            const parsedFallback = typeof fallbackCompletedAt === 'number'
                ? fallbackCompletedAt
                : Date.parse(fallbackCompletedAt);
            records.push({
                operationId: fallbackOperationId.slice(0, 180),
                shared: false,
                completedAt: Number.isFinite(parsedFallback)
                    ? parsedFallback
                    : null
            });
        }
        const sharedRecords = records.filter(record => record.shared);
        const first = records[0] || null;
        const last = records[records.length - 1] || null;
        const firstShared = sharedRecords[0] || null;
        const lastShared =
            sharedRecords[sharedRecords.length - 1] || null;
        const lineageCount = Math.max(
            0,
            Number(source.lineageCount) || 0,
            records.length
        );
        const sharedLineageCount = Math.max(
            0,
            Number(source.sharedLineageCount) || 0,
            sharedRecords.length
        );
        const unlocked = Boolean(
            source.unlocked ||
            lineageCount > 0 ||
            source.firstOperationId ||
            first
        );

        return {
            schemaVersion: KINSHIP_BEACON_SCHEMA_VERSION,
            unlocked,
            firstOperationId:
                source.firstOperationId ||
                first?.operationId ||
                null,
            firstLitAt:
                Number(source.firstLitAt) ||
                first?.completedAt ||
                null,
            lineageCount,
            lastOperationId:
                last?.operationId ||
                source.lastOperationId ||
                null,
            lastLitAt:
                last?.completedAt ||
                Number(source.lastLitAt) ||
                null,
            sharedLineageCount,
            firstSharedOperationId:
                source.firstSharedOperationId ||
                firstShared?.operationId ||
                null,
            firstSharedAt:
                Number(source.firstSharedAt) ||
                firstShared?.completedAt ||
                null,
            lastSharedOperationId:
                lastShared?.operationId ||
                source.lastSharedOperationId ||
                null,
            lastSharedAt:
                lastShared?.completedAt ||
                Number(source.lastSharedAt) ||
                null
        };
    }

    recordFusionLineageConsequence(operationId, completedAt = Date.now()) {
        if (typeof operationId !== 'string' || operationId.length === 0) {
            return { firstLineage: false, beacon: null };
        }

        const parsedCompletedAt = typeof completedAt === 'number'
            ? completedAt
            : Date.parse(completedAt);
        const occurredAt = Number.isFinite(parsedCompletedAt)
            ? parsedCompletedAt
            : Date.now();
        const existing = this.get('world.sanctuaryDecorations.kinshipBeacon') || {};
        const history = this.get('breedingShrine.breedingHistory') || [];
        const firstLineage = !existing.firstOperationId;
        const beacon = this.normalizeKinshipBeaconState(
            existing,
            history,
            operationId,
            occurredAt
        );
        this.set('world.sanctuaryDecorations.kinshipBeacon', beacon);

        const discovery = this.syncFusionDiscovery().discovery;
        this.set('breedingShrine.discovery', {
            ...discovery,
            state: 'first_lineage',
            firstLineageAt: discovery.firstLineageAt || occurredAt,
            firstLineageOperationId:
                discovery.firstLineageOperationId || operationId
        });

        return { firstLineage, beacon };
    }

    /**
     * Get breeding shrine status
     */
    getBreedingShrineStatus() {
        const shrine = this.get('breedingShrine') || {};
        const creatureLevel = this.get('creature.level');
        const currentTime = Date.now();
        const unlocked = Boolean(shrine.unlocked || creatureLevel >= 5);
        const pendingFusion = shrine.pendingFusion || null;
        const pendingExpired = Boolean(
            pendingFusion?.createdAt &&
            currentTime - pendingFusion.createdAt > FUSION_TRANSACTION_TTL_MS
        );
        const reconciliationPending = Array.isArray(
            shrine.reconciliationQueue
        )
            ? shrine.reconciliationQueue.length
            : 0;
        const sharedFusionPending = Boolean(
            shrine.sharedFusion?.activeInvitation?.invitationId
        );

        return {
            unlocked,
            levelRequirement: 5,
            currentLevel: creatureLevel,
            canBreed: unlocked && (!shrine.lastBreedingTime ||
                        currentTime - shrine.lastBreedingTime >= shrine.breedingCooldown) &&
                        (!pendingFusion || pendingExpired) &&
                        reconciliationPending === 0 &&
                        !sharedFusionPending,
            cooldownRemaining: shrine.lastBreedingTime ?
                Math.max(0, shrine.breedingCooldown - (currentTime - shrine.lastBreedingTime)) : 0,
            breedingHistory: shrine.breedingHistory || [],
            pendingFusion,
            pendingExpired,
            reconciliationPending,
            sharedFusionPending,
            sharedInvitation: sharedFusionPending
                ? this.clonePortableValue(
                    shrine.sharedFusion.activeInvitation
                )
                : null
        };
    }

    getPendingFusionReconciliations() {
        const queue = this.get(
            'breedingShrine.reconciliationQueue'
        );
        return Array.isArray(queue)
            ? this.clonePortableValue(queue)
            : [];
    }

    getPendingReservedFusion() {
        const status = this.getBreedingShrineStatus();
        const pending = status.pendingFusion;
        if (
            !pending ||
            status.pendingExpired ||
            pending.result?.hatchData ||
            pending.authorityReservation?.reservationMode !==
                'server_reserved' ||
            !pending.authorityRequest
        ) {
            return null;
        }

        return this.clonePortableValue(pending);
    }

    getPendingSharedFusionReveal() {
        const pending = this.get(
            'breedingShrine.sharedFusion.pendingReveal'
        );
        if (!pending?.creatureId) return null;
        const creature = (this.get('creatures') || []).find(
            entry => entry?.id === pending.creatureId
        );
        if (!creature) return null;
        return {
            ...this.clonePortableValue(pending),
            creature: this.clonePortableValue(creature)
        };
    }

    acknowledgeSharedFusionReveal(invitationId) {
        const pending = this.get(
            'breedingShrine.sharedFusion.pendingReveal'
        );
        if (
            !pending ||
            pending.invitationId !== invitationId
        ) {
            return false;
        }
        this.set(
            'breedingShrine.sharedFusion.pendingReveal',
            null
        );
        this.save();
        this.emit('sharedFusionRevealAcknowledged', {
            invitationId,
            operationId: pending.operationId,
            creatureId: pending.creatureId
        });
        return true;
    }

    createPortableId(prefix = 'id') {
        const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
        if (cryptoApi?.randomUUID) {
            return `${prefix}_${cryptoApi.randomUUID()}`;
        }

        const randomPart = Math.random().toString(36).slice(2, 12);
        return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
    }

    getCreatureFusionReadiness(creature, now = Date.now()) {
        if (!creature || typeof creature !== 'object') {
            return {
                eligible: false,
                reason: 'missing_creature',
                stage: 'unknown',
                readyAt: null,
                remainingMs: null
            };
        }
        if (
            creature.lifecycle?.hasDeparted ||
            creature.lifecycle?.departureDate
        ) {
            return {
                eligible: false,
                reason: 'departed',
                stage: String(creature.lifecycle?.stage || 'unknown').toLowerCase(),
                readyAt: null,
                remainingMs: null
            };
        }

        const stage = typeof creature.lifecycle?.stage === 'string'
            ? creature.lifecycle.stage.toLowerCase()
            : '';
        if (stage === 'adult' || stage === 'elder') {
            return {
                eligible: true,
                reason: 'ready',
                stage,
                readyAt: null,
                remainingMs: 0
            };
        }

        const rawBirthDate = creature.lifecycle?.birthDate ?? creature.hatchTime;
        const birthDate = typeof rawBirthDate === 'number'
            ? rawBirthDate
            : Date.parse(rawBirthDate);
        if (!Number.isFinite(birthDate) || birthDate > now) {
            return {
                eligible: false,
                reason: 'missing_birth_record',
                stage: stage || 'unknown',
                readyAt: null,
                remainingMs: null
            };
        }

        const readyAt = birthDate +
            CREATURE_LIFECYCLE_THRESHOLDS.adult * CREATURE_LIFECYCLE_DAY_MS;
        const remainingMs = Math.max(0, readyAt - now);

        // Legacy saves may not have persisted a stage. Their birth record is
        // authoritative once they have reached the adult threshold.
        if (!stage && remainingMs === 0) {
            return {
                eligible: true,
                reason: 'ready',
                stage: 'adult',
                readyAt,
                remainingMs: 0
            };
        }

        if (remainingMs > 0) {
            return {
                eligible: false,
                reason: 'maturing',
                stage: stage || 'baby',
                readyAt,
                remainingMs
            };
        }

        const happiness = Number.isFinite(creature.stats?.happiness)
            ? creature.stats.happiness
            : 100;
        const mood = String(creature.mood?.current || 'happy').toLowerCase();
        const wellbeingBlocked = Boolean(
            creature.lifecycle?.isStuck ||
            happiness < MIN_HAPPINESS_TO_EVOLVE ||
            mood === 'sad' ||
            mood === 'abandoned'
        );

        return {
            eligible: false,
            reason: wellbeingBlocked ? 'wellbeing' : 'lifecycle_sync',
            stage: stage || 'unknown',
            readyAt,
            remainingMs: 0
        };
    }

    getFusionReadinessStatus(now = Date.now()) {
        const shrine = this.getBreedingShrineStatus();
        const collection = this.getCreatureCollection();
        const companions = collection.map(creature => ({
            id: creature?.id || null,
            name: creature?.name || 'Unnamed companion',
            ...this.getCreatureFusionReadiness(creature, now)
        }));
        const eligibleCount = companions.filter(companion => companion.eligible).length;

        return {
            ...shrine,
            collectionCount: collection.length,
            eligibleCount,
            companions,
            ready: Boolean(
                shrine.unlocked &&
                shrine.canBreed &&
                collection.length >= 2 &&
                eligibleCount >= 2
            )
        };
    }

    isFusionEligibleCreature(creature, now = Date.now()) {
        return this.getCreatureFusionReadiness(creature, now).eligible;
    }

    clearInterruptedFusion(reason = 'interrupted') {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        if (!pending) return false;

        this.set('breedingShrine.pendingFusion', null);
        this.emit('fusionCancelled', {
            operationId: pending.operationId,
            reason
        });
        this.save();
        return true;
    }

    beginFusionTransaction(parentIds, offspringCapacity = 1, options = {}) {
        const status = this.getBreedingShrineStatus();
        if (status.pendingFusion && !status.pendingExpired) {
            return { success: false, reason: 'fusion_in_progress' };
        }
        if (status.pendingExpired) {
            this.clearInterruptedFusion('expired');
        }
        if (!status.unlocked) {
            return { success: false, reason: 'locked' };
        }
        if (status.cooldownRemaining > 0) {
            return { success: false, reason: 'cooldown', cooldownRemaining: status.cooldownRemaining };
        }

        const normalizedParentIds = Array.isArray(parentIds)
            ? [...new Set(parentIds.filter(id => typeof id === 'string' && id.length <= 128))]
            : [];
        if (normalizedParentIds.length !== 2) {
            return { success: false, reason: 'invalid_parents' };
        }

        const collection = this.getCreatureCollection();
        const parents = normalizedParentIds.map(id => collection.find(creature => creature.id === id));
        if (parents.some(parent => !this.isFusionEligibleCreature(parent))) {
            return { success: false, reason: 'ineligible_parents' };
        }

        const requestedCapacity = offspringCapacity === 2 ? 2 : 1;
        const capacity = (this.get('maxCreatures') || 8) - collection.length;
        if (capacity < requestedCapacity) {
            return { success: false, reason: 'collection_capacity', required: requestedCapacity, available: capacity };
        }

        const requestedOperationId = typeof options.operationId === 'string'
            ? options.operationId
            : '';
        if (
            requestedOperationId &&
            !/^fusion_[A-Za-z0-9_-]{1,160}$/.test(requestedOperationId)
        ) {
            return { success: false, reason: 'invalid_operation_id' };
        }
        const operationId = requestedOperationId || this.createPortableId('fusion');
        const completedOperationIds = Array.isArray(
            this.get('breedingShrine.completedOperationIds')
        )
            ? this.get('breedingShrine.completedOperationIds')
            : [];
        if (completedOperationIds.includes(operationId)) {
            return { success: false, reason: 'operation_replayed' };
        }

        const candidateOffspringIds = Array.from(
            { length: requestedCapacity },
            () => this.createPortableId('creature')
        );
        const transaction = {
            schemaVersion: FUSION_TRANSACTION_SCHEMA_VERSION,
            operationId,
            parentIds: normalizedParentIds,
            candidateOffspringIds,
            offspringCapacity: requestedCapacity,
            offspringIds: [...candidateOffspringIds],
            offspringCount: requestedCapacity,
            createdAt: Date.now(),
            resultSeed: typeof options.resultSeed === 'string'
                ? options.resultSeed.slice(0, 128)
                : null,
            status: 'pending',
            consentReceipt: options.consentReceipt
                ? this.clonePortableValue(options.consentReceipt)
                : null
        };

        this.set('breedingShrine.pendingFusion', transaction);
        this.emit('fusionStarted', transaction);
        this.save();
        return { success: true, transaction };
    }

    attachFusionAuthorityRequest(operationId, authorityRequest) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        const fusionAuthority = typeof globalThis !== 'undefined'
            ? globalThis.FusionAuthority
            : null;
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }
        if (
            !authorityRequest ||
            authorityRequest.operationId !== operationId ||
            authorityRequest.requestFingerprint === undefined ||
            JSON.stringify(authorityRequest.parentIds) !== JSON.stringify(pending.parentIds) ||
            (
                authorityRequest.contractVersion !== 2
                    ? JSON.stringify(authorityRequest.offspringIds) !==
                        JSON.stringify(pending.offspringIds)
                    : (
                        JSON.stringify(
                            authorityRequest.candidateOffspringIds
                        ) !== JSON.stringify(
                            pending.candidateOffspringIds
                        ) ||
                        authorityRequest.offspringCapacity !==
                            pending.offspringCapacity
                    )
            ) ||
            (
                typeof fusionAuthority?.validateRequest === 'function' &&
                !fusionAuthority.validateRequest(authorityRequest)
            )
        ) {
            return { success: false, reason: 'invalid_authority_request' };
        }

        const updatedTransaction = {
            ...pending,
            resultSeed: authorityRequest.resultSeed || pending.resultSeed || null,
            authorityRequest: this.clonePortableValue(authorityRequest)
        };
        this.set('breedingShrine.pendingFusion', updatedTransaction);
        this.emit('fusionAuthorityAttached', {
            operationId,
            requestFingerprint: authorityRequest.requestFingerprint
        });
        this.save();
        return {
            success: true,
            transaction: updatedTransaction
        };
    }

    attachFusionAuthorityReservation(operationId, reservation) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }
        if (
            !reservation ||
            reservation.operationId !== operationId ||
            reservation.requestFingerprint !==
                pending.authorityRequest?.requestFingerprint ||
            ![
                'server_reserved',
                'local_only',
                'local_offline'
            ].includes(reservation.reservationMode) ||
            ![1, 2].includes(Number(reservation.offspringCount)) ||
            !Array.isArray(reservation.offspringIds) ||
            reservation.offspringIds.length !==
                Number(reservation.offspringCount) ||
            reservation.offspringIds.some(id => (
                !pending.candidateOffspringIds.includes(id)
            ))
        ) {
            return { success: false, reason: 'invalid_authority_reservation' };
        }

        const updatedTransaction = {
            ...pending,
            offspringIds: [...reservation.offspringIds],
            offspringCount: Number(reservation.offspringCount),
            authorityReservation: this.clonePortableValue(reservation)
        };
        this.set('breedingShrine.pendingFusion', updatedTransaction);
        this.emit('fusionAuthorityReserved', {
            operationId,
            reservationMode: reservation.reservationMode,
            reconciliationRequired: Boolean(
                reservation.reconciliationRequired
            )
        });
        this.save();
        return {
            success: true,
            transaction: updatedTransaction
        };
    }

    attachFusionAuthorityExecution(operationId, execution) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        const receipt = execution?.receipt;
        const outcome = execution?.outcome;
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }
        if (
            pending.authorityReservation?.reservationMode !== 'server_reserved' ||
            execution?.operationId !== operationId ||
            outcome?.operationId !== operationId ||
            !Array.isArray(outcome?.offspring) ||
            outcome.offspring.length !== pending.offspringCount ||
            outcome.offspring.some((child, index) => (
                child?.offspringData?.creatureId !== pending.offspringIds[index]
            )) ||
            receipt?.operationId !== operationId ||
            receipt?.authority !== 'server_generated' ||
            receipt?.requestFingerprint !==
                pending.authorityRequest?.requestFingerprint ||
            receipt?.serverFingerprint !==
                pending.authorityReservation?.serverFingerprint
        ) {
            return { success: false, reason: 'invalid_authority_execution' };
        }

        const updatedTransaction = {
            ...pending,
            authorityExecution: {
                schemaVersion: 1,
                executionVersion: outcome.executionVersion || null,
                resultFingerprint: receipt.resultFingerprint,
                receipt: this.clonePortableValue(receipt),
                replay: Boolean(execution.replay)
            }
        };
        this.set('breedingShrine.pendingFusion', updatedTransaction);
        this.emit('fusionAuthorityExecuted', {
            operationId,
            executionVersion: outcome.executionVersion || null,
            replay: Boolean(execution.replay)
        });
        this.save();
        return {
            success: true,
            transaction: updatedTransaction
        };
    }

    stageFusionResult(operationId, hatchData, authorityReceipt = null) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        const fusionAuthority = typeof globalThis !== 'undefined'
            ? globalThis.FusionAuthority
            : null;
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }
        if (!hatchData || typeof hatchData !== 'object') {
            return { success: false, reason: 'invalid_result' };
        }
        if (
            authorityReceipt &&
            (
                authorityReceipt.operationId !== operationId ||
                authorityReceipt.requestFingerprint !==
                    pending.authorityRequest?.requestFingerprint ||
                (
                    authorityReceipt.authority !== 'server_generated' &&
                    typeof fusionAuthority?.validateReceipt === 'function' &&
                    !fusionAuthority.validateReceipt(
                        pending.authorityRequest,
                        hatchData,
                        authorityReceipt
                    )
                ) ||
                (
                    authorityReceipt.authority === 'server_generated' &&
                    (
                        authorityReceipt.receiptFingerprint !==
                            pending.authorityExecution?.receipt?.receiptFingerprint ||
                        authorityReceipt.serverFingerprint !==
                            pending.authorityReservation?.serverFingerprint
                    )
                )
            )
        ) {
            return { success: false, reason: 'invalid_authority_receipt' };
        }

        const stagedAt = Date.now();
        const stagedTransaction = {
            ...pending,
            status: 'staged',
            result: {
                schemaVersion: FUSION_TRANSACTION_SCHEMA_VERSION,
                stagedAt,
                authorityReceipt: authorityReceipt
                    ? this.clonePortableValue(authorityReceipt)
                    : null,
                hatchData: this.clonePortableValue(hatchData)
            }
        };
        this.set('breedingShrine.pendingFusion', stagedTransaction);
        this.emit('fusionResultStaged', {
            operationId,
            stagedAt
        });
        this.save();
        return {
            success: true,
            transaction: stagedTransaction
        };
    }

    stageFusionNames(operationId, names) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        const normalizedNames = Array.isArray(names)
            ? names.map(value => String(value || '').trim())
            : [];
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }
        if (
            normalizedNames.length !== pending.offspringCount ||
            normalizedNames.some(name => (
                name.length < 1 ||
                name.length > 20 ||
                !/^[\p{L}\p{N} '\-_]+$/u.test(name)
            ))
        ) {
            return { success: false, reason: 'invalid_names' };
        }

        const updatedTransaction = {
            ...pending,
            proposedNames: normalizedNames
        };
        this.set('breedingShrine.pendingFusion', updatedTransaction);
        this.emit('fusionNamesStaged', {
            operationId,
            names: [...normalizedNames]
        });
        this.save();
        return {
            success: true,
            transaction: updatedTransaction,
            names: normalizedNames
        };
    }

    getPendingFusionHatchData() {
        const pending = this.get('breedingShrine.pendingFusion');
        const hatchData = pending?.result?.hatchData;
        if (!pending || !hatchData || typeof hatchData !== 'object') {
            return null;
        }

        const transaction = {
            ...pending
        };
        delete transaction.result;

        return {
            ...this.clonePortableValue(hatchData),
            fusionTransaction: transaction,
            previewOnly: false,
            resumedFusion: true
        };
    }

    commitFusionTransaction(operationId, offspringCreatures) {
        const shrine = this.get('breedingShrine') || {};
        const pending = shrine.pendingFusion;
        const completedIds = Array.isArray(shrine.completedOperationIds)
            ? shrine.completedOperationIds
            : [];

        if (completedIds.includes(operationId)) {
            return { success: true, reason: 'already_committed' };
        }
        if (!pending || pending.operationId !== operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }

        const offspring = Array.isArray(offspringCreatures) ? offspringCreatures : [];
        if (offspring.length !== pending.offspringCount) {
            return { success: false, reason: 'offspring_count_mismatch' };
        }

        const expectedIds = new Set(pending.offspringIds);
        if (offspring.some(creature => !creature?.id || !expectedIds.has(creature.id))) {
            return { success: false, reason: 'offspring_identity_mismatch' };
        }
        const submittedIds = offspring.map(creature => creature.id);
        if (
            new Set(submittedIds).size !== submittedIds.length ||
            expectedIds.size !== submittedIds.length
        ) {
            return { success: false, reason: 'offspring_identity_mismatch' };
        }

        const collection = this.getCreatureCollection();
        const maxCreatures = this.get('maxCreatures') || 8;
        if (collection.length + offspring.length > maxCreatures) {
            return { success: false, reason: 'collection_capacity' };
        }

        const existingIds = new Set(collection.map(creature => creature.id).filter(Boolean));
        if (offspring.some(creature => existingIds.has(creature.id))) {
            return { success: false, reason: 'duplicate' };
        }

        const committedAt = Date.now();
        const normalizedOffspring = offspring.map(creature => ({
            ...this.clonePortableValue(creature),
            lineage: {
                schemaVersion: 1,
                creatureId: creature.id,
                origin: 'fusion',
                generation: creature.generation || 2,
                parentIds: [...pending.parentIds],
                fusionOperationId: pending.operationId,
                createdAt: committedAt
            }
        }));
        const firstOffspringIndex = collection.length;
        const nextCollection = [...collection, ...normalizedOffspring];
        const historyEntry = {
            schemaVersion: FUSION_TRANSACTION_SCHEMA_VERSION,
            operationId: pending.operationId,
            parentIds: [...pending.parentIds],
            offspringIds: normalizedOffspring.map(creature => creature.id),
            offspringCount: normalizedOffspring.length,
            authority: pending.result?.authorityReceipt?.authority || 'local_legacy',
            requestFingerprint: pending.authorityRequest?.requestFingerprint || null,
            resultFingerprint: pending.result?.authorityReceipt?.resultFingerprint || null,
            reconciliationRequired: Boolean(
                pending.result?.authorityReceipt?.reconciliationRequired
            ),
            reconciliationStatus:
                pending.result?.authorityReceipt?.reconciliationRequired
                    ? 'pending'
                    : 'not_required',
            completedAt: committedAt
        };
        const history = [...(shrine.breedingHistory || []), historyEntry].slice(-MAX_FUSION_HISTORY);
        const reconciliationQueue = Array.isArray(
            shrine.reconciliationQueue
        )
            ? shrine.reconciliationQueue
            : [];
        const reconciliationRecord =
            pending.result?.authorityReceipt?.reconciliationRequired
                ? {
                    schemaVersion: pending.authorityRequest?.schemaVersion ||
                        FUSION_TRANSACTION_SCHEMA_VERSION,
                    operationId: pending.operationId,
                    request: this.clonePortableValue(
                        pending.authorityRequest
                    ),
                    receipt: this.clonePortableValue(
                        pending.result.authorityReceipt
                    ),
                    offspringIds: normalizedOffspring.map(
                        creature => creature.id
                    ),
                    offspringCount: normalizedOffspring.length,
                    names: normalizedOffspring.map(
                        creature => creature.name
                    ),
                    queuedAt: committedAt,
                    status: 'pending'
                }
                : null;

        this.set('creatures', nextCollection);
        this.set('breedingShrine.lastBreedingTime', committedAt);
        this.set('breedingShrine.breedingHistory', history);
        this.set('breedingShrine.completedOperationIds', [...completedIds, operationId].slice(-MAX_FUSION_HISTORY));
        if (reconciliationRecord) {
            this.set(
                'breedingShrine.reconciliationQueue',
                [
                    ...reconciliationQueue.filter(
                        entry => (
                            entry?.operationId !==
                                reconciliationRecord.operationId
                        )
                    ),
                    reconciliationRecord
                ].slice(0, MAX_FUSION_RECONCILIATIONS)
            );
        }
        this.set('breedingShrine.pendingFusion', null);
        const lineageConsequence = this.recordFusionLineageConsequence(
            operationId,
            committedAt
        );
        this.switchActiveCreature(firstOffspringIndex);
        normalizedOffspring.forEach((creature, offset) => {
            this.emit('creatureAddedToCollection', {
                creature,
                index: firstOffspringIndex + offset,
                source: 'fusion',
                operationId
            });
        });
        this.emit('breedingCompleted', {
            operationId,
            offspring: normalizedOffspring,
            breedingTime: committedAt,
            firstLineage: lineageConsequence.firstLineage,
            kinshipBeacon: lineageConsequence.beacon,
            reconciliationRequired: Boolean(reconciliationRecord)
        });
        this.save();

        return {
            success: true,
            offspring: normalizedOffspring,
            activeIndex: firstOffspringIndex
        };
    }

    async finalizeFusionTransaction(operationId, offspringCreatures) {
        const pending = this.get('breedingShrine.pendingFusion');
        const offspring = Array.isArray(offspringCreatures)
            ? offspringCreatures
            : [];
        const names = offspring.map(creature => creature?.name);
        const stagedNames = this.stageFusionNames(operationId, names);
        if (!stagedNames.success) {
            return stagedNames;
        }

        const transaction = stagedNames.transaction;
        if (
            transaction.authorityReservation?.reservationMode !==
                'server_reserved'
        ) {
            return this.commitFusionTransaction(operationId, offspring);
        }

        const fusionAuthority = typeof globalThis !== 'undefined'
            ? globalThis.FusionAuthority
            : null;
        if (typeof fusionAuthority?.finalizeReservedOperation !== 'function') {
            return {
                success: false,
                reason: 'server_finalize_unavailable',
                recoverable: true
            };
        }

        try {
            const finalization = await fusionAuthority.finalizeReservedOperation(
                transaction.authorityRequest,
                transaction.authorityReservation,
                transaction.authorityExecution?.receipt,
                stagedNames.names,
                {
                    cloudSave: typeof globalThis !== 'undefined'
                        ? globalThis.CloudSave
                        : null
                }
            );
            const collection = this.getCreatureCollection();
            const committedOffspring = transaction.offspringIds.map(id => (
                collection.find(creature => creature?.id === id)
            ));
            if (committedOffspring.some(creature => !creature)) {
                return {
                    success: false,
                    reason: 'server_commit_state_invalid',
                    recoverable: true
                };
            }

            const firstOffspringIndex = collection.findIndex(
                creature => creature?.id === transaction.offspringIds[0]
            );
            const breedingTime =
                finalization.receipt?.completedAt || Date.now();
            const lineageConsequence = this.recordFusionLineageConsequence(
                operationId,
                breedingTime
            );
            this.save();
            committedOffspring.forEach(creature => {
                this.emit('creatureAddedToCollection', {
                    creature,
                    index: collection.findIndex(entry => entry?.id === creature.id),
                    source: 'fusion',
                    operationId
                });
            });
            this.emit('breedingCompleted', {
                operationId,
                offspring: committedOffspring,
                breedingTime,
                authority: 'server_finalized',
                replay: Boolean(finalization.replay),
                firstLineage: lineageConsequence.firstLineage,
                kinshipBeacon: lineageConsequence.beacon
            });

            return {
                success: true,
                offspring: committedOffspring,
                activeIndex: firstOffspringIndex,
                authority: 'server_finalized',
                replay: Boolean(finalization.replay),
                revision: finalization.revision
            };
        } catch (error) {
            console.warn('[GameState] Server Fusion finalization deferred:', error);
            return {
                success: false,
                reason: 'server_finalize_failed',
                recoverable: true,
                error
            };
        }
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
            const initializedAt = Date.now();
            this.set('creature.care.lastCareTime', initializedAt);
            this.set('creature.care.lastOfflineRecoveryTime', initializedAt);
            this.set('creature.care.careStreak', 1);
            console.log('[GameState] Care system initialized for creature');
        }
    }

    /**
     * Restore the companion while the player is away without punishing absence.
     */
    updateHappinessFromTime() {
        const creature = this.get('creature');
        if (!creature.hatched) return;

        const currentTime = Date.now();
        const lastCareTime = Number(creature.care.lastCareTime) || 0;
        const lastRecoveryTime = Number(
            creature.care.lastOfflineRecoveryTime
        ) || 0;
        const recoveryBaseline = Math.max(lastCareTime, lastRecoveryTime);
        if (!recoveryBaseline) return;

        const timeOffline = Math.max(0, currentTime - recoveryBaseline);
        const hoursOffline = timeOffline / (1000 * 60 * 60);
        if (hoursOffline < 0.5) return;

        const currentEnergy = Math.max(0, Number(creature.stats.energy) || 0);
        const currentHappiness = Math.max(
            0,
            Number(creature.stats.happiness) || 0
        );
        const energyRecovered = Math.floor(hoursOffline * 6);
        const signalRecovered = currentHappiness < 60
            ? Math.floor(hoursOffline / 4)
            : 0;
        const nextEnergy = Math.min(100, currentEnergy + energyRecovered);
        const nextHappiness = currentHappiness < 60
            ? Math.min(60, currentHappiness + signalRecovered)
            : currentHappiness;

        if (nextEnergy !== currentEnergy) {
            this.set('creature.stats.energy', nextEnergy);
        }
        if (nextHappiness !== currentHappiness) {
            this.set('creature.stats.happiness', nextHappiness);
        }
        this.set('creature.care.lastOfflineRecoveryTime', currentTime);
        this.emit('creatureOfflineRecoveryApplied', {
            hoursOffline,
            energyBefore: currentEnergy,
            energyAfter: nextEnergy,
            happinessBefore: currentHappiness,
            happinessAfter: nextHappiness
        });
        console.log(
            `[GameState] Offline recovery applied after ${hoursOffline.toFixed(1)} hours`
        );
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

            case 'pet':
                // Calm contact is unlimited; CareSystem supplies a short cooldown.
                happinessBonus = 8;
                this.set(
                    'creature.care.dailyCare.petCount',
                    (dailyCare.petCount || 0) + 1
                );
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
            const careTime = Date.now();
            this.set('creature.care.lastCareTime', careTime);
            this.set('creature.care.lastOfflineRecoveryTime', careTime);

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
                petCount: 0,
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
                           happiness >= 35 ? 'quiet' :
                           happiness >= 20 ? 'withdrawn' : 'recovering',
            careStreak: creature.care.careStreak,
            dailyCare: {
                feedCount: dailyCare.feedCount,
                feedLimit: 3,
                playCount: dailyCare.playCount,
                playLimit: 2,
                petCount: dailyCare.petCount || 0,
                petLimit: -1,
                restCount: dailyCare.restCount,
                restLimit: -1 // Unlimited
            },
            canFeed: dailyCare.feedCount < 3,
            canPlay: dailyCare.playCount < 2,
            canPet: true,
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
            this.validateSaveDataStructure(saveData, { requireCoreState: true });

            const serialized = JSON.stringify(saveData);

            // Check quota before saving
            const quota = this.getStorageQuota();
            if (quota && quota.percentUsed > 90) {
                console.warn('[GameState] Storage quota nearly full:', quota.percentUsed.toFixed(1) + '%');
            }

            const currentRaw = localStorage.getItem(this.saveKey);
            if (currentRaw && currentRaw !== serialized) {
                const backup = this.createLocalSaveBackup(
                    currentRaw,
                    'before_local_save'
                );
                if (!backup) {
                    throw new Error('Recovery copy could not be created');
                }
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

        // The full session is browser-local and must not be restored from a
        // backup or cloud save. Keep only the durable journey-start marker so
        // boot can return a named companion to the Sanctuary after a reload.
        snapshot.session = {
            gameStarted: this.state.session?.gameStarted === true
        };
        this.stripTransientPortraitUrls(snapshot);
        return snapshot;
    }

    stripTransientPortraitUrls(snapshot) {
        const sanitizePortraits = portraits => {
            if (!portraits?.byStage || typeof portraits.byStage !== 'object') {
                return;
            }
            Object.values(portraits.byStage).forEach(record => {
                if (!record?.assetRef) return;
                delete record.imageUrl;
                delete record.expiresAt;
            });
        };

        sanitizePortraits(snapshot?.creature?.portraits);
        if (Array.isArray(snapshot?.creatures)) {
            snapshot.creatures.forEach(creature => {
                sanitizePortraits(creature?.portraits);
            });
        }
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
            const rawSave = localStorage.getItem(this.saveKey);
            if (!rawSave) return false;
            const parsed = JSON.parse(rawSave);
            this.validateSaveDataStructure(parsed);
            return true;
        } catch (error) {
            return false;
        }
    }

    validateSaveDataStructure(saveData, options = {}) {
        const { requireCoreState = false } = options;
        const isRecord = value => (
            value !== null && typeof value === 'object' && !Array.isArray(value)
        );

        if (!isRecord(saveData)) {
            throw new Error('Invalid save data structure');
        }
        if (
            saveData.version !== undefined &&
            (
                typeof saveData.version !== 'string' ||
                !SAVE_VERSION_PATTERN.test(saveData.version)
            )
        ) {
            throw new Error('Invalid save version');
        }
        if (
            saveData.savedAt !== undefined &&
            (!Number.isFinite(Number(saveData.savedAt)) || Number(saveData.savedAt) < 0)
        ) {
            throw new Error('Invalid save timestamp');
        }

        const recordFields = [
            'player',
            'stats',
            'combat',
            'story',
            'creature',
            'world',
            'levels',
            'hubWorld'
        ];
        recordFields.forEach(field => {
            if (saveData[field] !== undefined && !isRecord(saveData[field])) {
                throw new Error(`Invalid save field: ${field}`);
            }
        });

        if (requireCoreState) {
            ['player', 'creature', 'world', 'levels', 'hubWorld'].forEach(field => {
                if (!isRecord(saveData[field])) {
                    throw new Error(`Missing save field: ${field}`);
                }
            });
        }

        JSON.stringify(saveData);
        return true;
    }

    prepareSaveCandidate(saveData) {
        const serializedInput = typeof saveData === 'string'
            ? saveData
            : JSON.stringify(saveData);
        const parsed = JSON.parse(serializedInput);
        this.validateSaveDataStructure(parsed);

        const saveVersion = parsed.version || '1.0.0';
        if (!this.checkVersionCompatibility(saveVersion, GAME_VERSION)) {
            const error = new Error(
                `Save version ${saveVersion} is incompatible with ${GAME_VERSION}`
            );
            error.code = 'version_mismatch';
            error.saveVersion = saveVersion;
            throw error;
        }

        const clonedSave = JSON.parse(JSON.stringify(parsed));
        const migrated = this.migrateSaveData(clonedSave, saveVersion);
        this.validateSaveDataStructure(migrated);

        const preparedState = this.deepMerge(this.createInitialState(), migrated);
        preparedState.version = GAME_VERSION;
        preparedState.savedAt = Number(migrated.savedAt) || Date.now();
        this.validateSaveDataStructure(preparedState, { requireCoreState: true });

        const snapshot = JSON.parse(JSON.stringify(preparedState));
        snapshot.session = {
            gameStarted: preparedState.session?.gameStarted === true ||
                preparedState.creature?.hatched === true ||
                (Array.isArray(preparedState.creatures) && preparedState.creatures.length > 0)
        };
        this.stripTransientPortraitUrls(snapshot);
        this.validateSaveDataStructure(snapshot, { requireCoreState: true });

        return {
            state: preparedState,
            snapshot,
            serialized: JSON.stringify(snapshot),
            sourceVersion: saveVersion
        };
    }

    readLocalSaveBackupIndex() {
        if (this.storageMode === 'memory') return [];
        try {
            const parsed = JSON.parse(
                localStorage.getItem(this.saveBackupIndexKey) || '[]'
            );
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    getLocalSaveBackups() {
        return this.readLocalSaveBackupIndex()
            .filter(entry => (
                entry?.id && localStorage.getItem(`${this.saveBackupKeyPrefix}${entry.id}`)
            ))
            .slice(0, SAVE_BACKUP_LIMIT)
            .map(entry => ({ ...entry }));
    }

    createLocalSaveBackup(saveData, reason = 'manual_safety_copy') {
        if (this.storageMode === 'memory' || saveData === null || saveData === undefined) {
            return null;
        }

        const payload = typeof saveData === 'string'
            ? saveData
            : JSON.stringify(saveData);
        if (!payload) return null;

        const createdAt = Date.now();
        let id = String(createdAt);
        let suffix = 0;
        while (localStorage.getItem(`${this.saveBackupKeyPrefix}${id}`)) {
            suffix += 1;
            id = `${createdAt}-${suffix}`;
        }

        let sourceVersion = null;
        let sourceSavedAt = null;
        try {
            const parsed = JSON.parse(payload);
            sourceVersion = typeof parsed?.version === 'string' ? parsed.version : null;
            sourceSavedAt = Number.isFinite(Number(parsed?.savedAt))
                ? Number(parsed.savedAt)
                : null;
        } catch (error) {
            // Corrupted payloads are intentionally retained for manual recovery.
        }

        const metadata = {
            id,
            createdAt,
            reason,
            sourceVersion,
            sourceSavedAt
        };
        const backupKey = `${this.saveBackupKeyPrefix}${id}`;
        const envelope = {
            schemaVersion: 1,
            ...metadata,
            payload
        };

        try {
            const previousIndex = this.readLocalSaveBackupIndex()
                .filter(entry => (
                    entry?.id &&
                    localStorage.getItem(`${this.saveBackupKeyPrefix}${entry.id}`)
                ));
            const retainedPrevious = previousIndex.slice(0, SAVE_BACKUP_LIMIT - 1);
            previousIndex.slice(SAVE_BACKUP_LIMIT - 1).forEach(entry => {
                localStorage.removeItem(`${this.saveBackupKeyPrefix}${entry.id}`);
            });
            localStorage.setItem(
                this.saveBackupIndexKey,
                JSON.stringify(retainedPrevious)
            );
            localStorage.setItem(backupKey, JSON.stringify(envelope));
            const nextIndex = [metadata, ...retainedPrevious]
                .filter((entry, index, entries) => (
                    entry?.id && entries.findIndex(item => item?.id === entry.id) === index
                ));
            const retained = nextIndex.slice(0, SAVE_BACKUP_LIMIT);
            localStorage.setItem(this.saveBackupIndexKey, JSON.stringify(retained));
            this.emit('saveBackupCreated', metadata);
            return { ...metadata };
        } catch (error) {
            try {
                localStorage.removeItem(backupKey);
            } catch (cleanupError) {
                console.warn('[GameState] Could not clean up incomplete backup:', cleanupError);
            }
            console.warn('[GameState] Could not create recovery copy:', error);
            return null;
        }
    }

    commitPreparedSave(prepared, options = {}) {
        const {
            source = 'local',
            persist = true,
            backupReason = `before_${source}_restore`
        } = options;
        const currentSession = this.state.session || {};
        const preparedSession = prepared.state.session || {};
        const preparedCreature = prepared.state.creature || {};
        const savedJourneyHasStarted = preparedSession.gameStarted === true ||
            preparedCreature.hatched === true ||
            (Array.isArray(prepared.state.creatures) && prepared.state.creatures.length > 0);
        const stagedState = {
            ...prepared.state,
            session: {
                ...preparedSession,
                ...currentSession,
                // Preserve a deliberate current-session start and restore the
                // durable marker from the save. The creature fallback keeps
                // pre-marker saves on their established journey path.
                gameStarted: currentSession.gameStarted === true || savedJourneyHasStarted,
                sessionStart: Date.now()
            }
        };

        if (persist && this.storageMode !== 'memory') {
            try {
                const currentRaw = localStorage.getItem(this.saveKey);
                if (currentRaw && currentRaw !== prepared.serialized) {
                    const backup = this.createLocalSaveBackup(currentRaw, backupReason);
                    if (!backup) {
                        throw new Error('Recovery copy could not be created');
                    }
                }
                localStorage.setItem(this.saveKey, prepared.serialized);
            } catch (error) {
                error.code = error.code || 'commit_failed';
                throw error;
            }
        }

        this.state = stagedState;
        return true;
    }

    quarantineInvalidLocalSave(saveData, reason) {
        const backup = this.createLocalSaveBackup(saveData, reason);
        if (backup) {
            localStorage.removeItem(this.saveKey);
            return backup;
        }
        return null;
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

        const saveData = localStorage.getItem(this.saveKey);
        if (!saveData) {
            console.log('[GameState] No save data found, using defaults');
            return false;
        }

        try {
            const prepared = this.prepareSaveCandidate(saveData);
            this.commitPreparedSave(prepared, {
                source: 'migration',
                persist: prepared.serialized !== saveData,
                backupReason: 'before_automatic_migration'
            });

            this.emit('loaded', this.state);
            console.log(
                `[GameState] Game loaded successfully (v${prepared.sourceVersion} → v${GAME_VERSION})`
            );
            return true;
        } catch (error) {
            if (error.code === 'commit_failed') {
                console.error('[GameState] Migrated save could not be committed:', error);
                this.showStorageWarning(
                    'Progress could not be updated safely. The previous save was retained.'
                );
                this.emit('loadError', { type: 'commit_failed', error });
                return false;
            }
            const type = error.code === 'version_mismatch'
                ? 'version_mismatch'
                : error instanceof SyntaxError
                    ? 'corrupted'
                    : 'migration_failed';
            console.error(`[GameState] Save load failed (${type}):`, error);
            const backup = type === 'migration_failed'
                ? this.createLocalSaveBackup(saveData, type)
                : this.quarantineInvalidLocalSave(saveData, type);
            const retainedMessage = backup
                ? ' A recovery copy is available in Save Settings.'
                : ' The original save was retained because a recovery copy could not be created.';
            this.showStorageWarning(`Progress could not be loaded.${retainedMessage}`);
            this.emit('loadError', { type, error, backupId: backup?.id || null });
            if (type === 'version_mismatch') {
                this.emit('versionMismatch', {
                    oldVersion: error.saveVersion,
                    newVersion: GAME_VERSION,
                    backupId: backup?.id || null
                });
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

        try {
            const prepared = this.prepareSaveCandidate(saveData);
            this.commitPreparedSave(prepared, {
                source,
                persist,
                backupReason: `before_${source}_restore`
            });

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

    restoreLocalSaveBackup(backupId) {
        if (!backupId || this.storageMode === 'memory') return false;

        const metadata = this.getLocalSaveBackups().find(entry => entry.id === backupId);
        if (!metadata) {
            this.emit('saveBackupRestoreError', { backupId, type: 'not_found' });
            return false;
        }

        try {
            const envelope = JSON.parse(
                localStorage.getItem(`${this.saveBackupKeyPrefix}${backupId}`)
            );
            const prepared = this.prepareSaveCandidate(envelope?.payload);
            this.commitPreparedSave(prepared, {
                source: 'local_backup',
                persist: true,
                backupReason: 'before_manual_backup_restore'
            });
            this.emit('saveBackupRestored', { backupId, state: this.get() });
            this.emit('loaded', this.state);
            return true;
        } catch (error) {
            console.error('[GameState] Recovery copy could not be restored:', error);
            this.emit('saveBackupRestoreError', {
                backupId,
                type: 'restore_failed',
                error
            });
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
        this.migrateCreaturePortability(migrated);
        this.migratePortraitReferences(migrated);
        this.migrateFusionPortability(migrated);

        console.log(`[GameState] Migration complete: ${fromVersion} → ${GAME_VERSION}`);
        return migrated;
    }

    migratePortraitReferences(data) {
        const migratePortraits = portraits => {
            if (!portraits || typeof portraits !== 'object') return;
            portraits.schemaVersion = PORTRAIT_STATE_SCHEMA_VERSION;
            if (!portraits.byStage || typeof portraits.byStage !== 'object') {
                portraits.byStage = {};
                return;
            }
            Object.values(portraits.byStage).forEach(record => {
                if (!record || typeof record !== 'object') return;
                record.schemaVersion = PORTRAIT_STATE_SCHEMA_VERSION;
                if (
                    !PORTRAIT_ASSET_REF_PATTERN.test(record.assetRef || '') &&
                    record.storage === 'supabase-private' &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                        .test(record.jobId || '')
                ) {
                    record.assetRef =
                        `portrait-job-v1:${record.jobId.toLowerCase()}`;
                }
                if (!PORTRAIT_ASSET_REF_PATTERN.test(record.assetRef || '')) {
                    record.assetRef = null;
                }
            });
        };

        migratePortraits(data?.creature?.portraits);
        if (Array.isArray(data?.creatures)) {
            data.creatures.forEach(creature => {
                migratePortraits(creature?.portraits);
            });
        }
    }

    migrateFusionPortability(data) {
        if (!data || typeof data !== 'object') return;
        const shrine = data.breedingShrine &&
            typeof data.breedingShrine === 'object'
            ? data.breedingShrine
            : {};
        data.breedingShrine = shrine;
        shrine.schemaVersion = FUSION_TRANSACTION_SCHEMA_VERSION;
        shrine.completedOperationIds = Array.from(new Set(
            Array.isArray(shrine.completedOperationIds)
                ? shrine.completedOperationIds.filter(id => (
                    typeof id === 'string' &&
                    /^fusion_[A-Za-z0-9_-]{1,160}$/.test(id)
                ))
                : []
        )).slice(-MAX_FUSION_HISTORY);

        const consentSystem = typeof globalThis !== 'undefined'
            ? globalThis.FusionConsent
            : null;
        shrine.consent = typeof consentSystem
            ?.normalizeFusionConsentState === 'function'
            ? consentSystem.normalizeFusionConsentState(shrine.consent)
            : {
                schemaVersion: 1,
                records: [],
                sharedBoundary: {
                    status: 'sealed',
                    reason: 'protected_invitation_required',
                    requires: [
                        'keeper_a_grant',
                        'keeper_b_grant',
                        'companion_a_grant',
                        'companion_b_grant',
                        'server_invitation'
                    ],
                    excludes: [
                        'public_matchmaking',
                        'open_trading',
                        'player_search',
                        'location_sharing'
                    ]
                }
            };
        const sharedFusionSystem = typeof globalThis !== 'undefined'
            ? globalThis.SharedFusionInvitation
            : null;
        shrine.sharedFusion = typeof sharedFusionSystem
            ?.normalizeSharedFusionSaveState === 'function'
            ? sharedFusionSystem.normalizeSharedFusionSaveState(
                shrine.sharedFusion
            )
            : {
                schemaVersion: 1,
                activeInvitation: null,
                completedOperationIds: [],
                pendingReveal: null
            };

        const seenReconciliations = new Set();
        shrine.reconciliationQueue = (
            Array.isArray(shrine.reconciliationQueue)
                ? shrine.reconciliationQueue
                : []
        ).map(entry => {
            const operationId = typeof entry?.operationId === 'string' &&
                /^fusion_[A-Za-z0-9_-]{1,160}$/.test(entry.operationId)
                ? entry.operationId
                : null;
            const request = entry?.request;
            const receipt = entry?.receipt;
            const offspringIds = Array.isArray(entry?.offspringIds)
                ? entry.offspringIds.filter(id => (
                    typeof id === 'string' &&
                    /^[A-Za-z0-9_-]{1,180}$/.test(id)
                )).slice(0, 2)
                : [];
            const names = Array.isArray(entry?.names)
                ? entry.names.map(name => String(name || '').trim())
                    .filter(name => (
                        name.length >= 1 &&
                        name.length <= 20 &&
                        /^[\p{L}\p{N} '\-_]+$/u.test(name)
                    )).slice(0, 2)
                : [];
            if (
                !operationId ||
                seenReconciliations.has(operationId) ||
                request?.operationId !== operationId ||
                receipt?.operationId !== operationId ||
                receipt?.reconciliationRequired !== true ||
                offspringIds.length < 1 ||
                offspringIds.length !== names.length
            ) {
                return null;
            }
            seenReconciliations.add(operationId);
            return {
                schemaVersion: [1, 2].includes(Number(entry.schemaVersion))
                    ? Number(entry.schemaVersion)
                    : 1,
                operationId,
                request: this.clonePortableValue(request),
                receipt: this.clonePortableValue(receipt),
                offspringIds,
                offspringCount: offspringIds.length,
                names,
                queuedAt: Math.max(0, Number(entry.queuedAt) || 0),
                status: 'pending'
            };
        }).filter(Boolean).slice(0, MAX_FUSION_RECONCILIATIONS);

        if (shrine.pendingFusion && typeof shrine.pendingFusion === 'object') {
            const pending = shrine.pendingFusion;
            pending.schemaVersion = [1, 2].includes(
                Number(pending.schemaVersion)
            )
                ? Number(pending.schemaVersion)
                : 1;
            pending.candidateOffspringIds = Array.isArray(
                pending.candidateOffspringIds
            )
                ? pending.candidateOffspringIds.slice(0, 2)
                : Array.isArray(pending.offspringIds)
                    ? pending.offspringIds.slice(0, 2)
                    : [];
            pending.offspringCapacity = [1, 2].includes(
                Number(pending.offspringCapacity)
            )
                ? Number(pending.offspringCapacity)
                : Math.max(1, pending.candidateOffspringIds.length);
        }

        const world = data.world && typeof data.world === 'object'
            ? data.world
            : {};
        data.world = world;
        const decorations = world.sanctuaryDecorations &&
            typeof world.sanctuaryDecorations === 'object'
            ? world.sanctuaryDecorations
            : {};
        world.sanctuaryDecorations = decorations;
        decorations.kinshipBeacon = this.normalizeKinshipBeaconState(
            decorations.kinshipBeacon,
            shrine.breedingHistory
        );
        if (decorations.kinshipBeacon.unlocked) {
            const discovery = shrine.discovery &&
                typeof shrine.discovery === 'object'
                ? shrine.discovery
                : {};
            shrine.discovery = {
                ...discovery,
                schemaVersion: FUSION_DISCOVERY_SCHEMA_VERSION,
                state: 'first_lineage',
                source: 'fend_current_archive',
                firstLineageAt:
                    discovery.firstLineageAt ||
                    decorations.kinshipBeacon.firstLitAt,
                firstLineageOperationId:
                    discovery.firstLineageOperationId ||
                    decorations.kinshipBeacon.firstOperationId,
                introductionAcknowledged: Boolean(
                    discovery.introductionAcknowledged
                )
            };
        }
    }

    migrateCreaturePortability(data) {
        const normalizeIdentityArchive = (value, creatureId) => {
            const source = value && typeof value === 'object' ? value : {};
            const knownChapters = [
                'identity',
                'living_form',
                'shared_journey',
                'inheritance'
            ];
            const normalizeIdentifier = input => {
                if (typeof input !== 'string') return null;
                const normalized = input
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9:_-]+/g, '_')
                    .replace(/^_+|_+$/g, '');
                return normalized
                    ? normalized.slice(0, 96)
                    : null;
            };
            const seenOperations = new Set();
            const history = (
                Array.isArray(source.history) ? source.history : []
            ).map(entry => {
                const chapterId = knownChapters.includes(entry?.chapterId)
                    ? entry.chapterId
                    : null;
                const operationId = normalizeIdentifier(
                    entry?.operationId
                );
                if (
                    !chapterId ||
                    !operationId ||
                    seenOperations.has(operationId)
                ) {
                    return null;
                }
                seenOperations.add(operationId);
                return {
                    operationId,
                    type: 'chapter_reviewed',
                    chapterId,
                    creatureId,
                    occurredAt:
                        typeof entry?.occurredAt === 'string'
                            ? entry.occurredAt.slice(0, 40)
                            : null
                };
            }).filter(Boolean).slice(-24);
            const reviewed = new Set(
                Array.isArray(source.reviewedChapterIds)
                    ? source.reviewedChapterIds.filter(
                        id => knownChapters.includes(id)
                    )
                    : []
            );
            history.forEach(entry => reviewed.add(entry.chapterId));
            const reviewedChapterIds = [];
            for (const chapterId of knownChapters) {
                if (!reviewed.has(chapterId)) break;
                reviewedChapterIds.push(chapterId);
            }
            return {
                schemaVersion: 1,
                creatureId,
                reviewedChapterIds,
                firstReviewedAt:
                    typeof source.firstReviewedAt === 'string'
                        ? source.firstReviewedAt.slice(0, 40)
                        : history[0]?.occurredAt || null,
                completedAt:
                    reviewedChapterIds.length === knownChapters.length
                        ? (
                            typeof source.completedAt === 'string'
                                ? source.completedAt.slice(0, 40)
                                : history.find(
                                    entry => (
                                        entry.chapterId === 'inheritance'
                                    )
                                )?.occurredAt || null
                        )
                        : null,
                history
            };
        };
        if (!Array.isArray(data?.creatures)) {
            if (data?.creature && typeof data.creature === 'object') {
                const creatureId = data.creature.id
                    || data.creature.genes?.id
                    || 'active_companion';
                data.creature.identityArchive = normalizeIdentityArchive(
                    data.creature.identityArchive,
                    creatureId
                );
            }
            return;
        }

        data.creatures = data.creatures.map((creature, index) => {
            if (!creature || typeof creature !== 'object') return creature;

            const stableId = creature.id ||
                (creature.genes?.id ? `creature_${creature.genes.id}` : null) ||
                `legacy_creature_${index}_${creature.hatchTime || creature.lifecycle?.birthDate || 'unknown'}`;
            const generation = Number.isFinite(creature.generation)
                ? Math.max(1, Math.floor(creature.generation))
                : 1;
            const parentIds = Array.isArray(creature.parentIds)
                ? creature.parentIds.filter(id => typeof id === 'string').slice(0, 2)
                : [];

            return {
                ...creature,
                id: stableId,
                lineage: {
                    schemaVersion: 1,
                    creatureId: stableId,
                    origin: creature.isOffspring ? 'fusion' : 'hatch',
                    generation,
                    parentIds,
                    fusionOperationId: creature.lineage?.fusionOperationId || null,
                    createdAt: creature.lineage?.createdAt ||
                        creature.hatchTime ||
                        creature.lifecycle?.birthDate ||
                        null,
                    ...creature.lineage
                },
                identityArchive: normalizeIdentityArchive(
                    creature.identityArchive,
                    stableId
                )
            };
        });

        const activeIndex = Number.isInteger(data.activeCreatureIndex)
            ? data.activeCreatureIndex
            : 0;
        const activeRecord = data.creatures[activeIndex] || data.creatures[0];
        if (activeRecord && data.creature && typeof data.creature === 'object') {
            data.creature.id = activeRecord.id;
            data.creature.lineage = data.creature.lineage || activeRecord.lineage;
            data.creature.identityArchive = normalizeIdentityArchive(
                data.creature.identityArchive || activeRecord.identityArchive,
                activeRecord.id
            );
        }
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

        data.levels = data.levels || {};
        data.stats = data.stats || {};
        const recordedCompletions = Number.isFinite(data.stats.levelsCompleted)
            ? Math.max(0, Math.floor(data.stats.levelsCompleted))
            : 0;
        const hasExplicitCampaignRecords = CAMPAIGN_ROUTE_SEQUENCE.some(
            route => Object.prototype.hasOwnProperty.call(
                data.levels,
                route.levelStateId
            )
        );

        // Count-only saves predate per-level records and necessarily followed
        // the original linear campaign. Convert that legacy counter once so all
        // future decisions can use explicit canonical IDs.
        if (!hasExplicitCampaignRecords && recordedCompletions > 0) {
            CAMPAIGN_ROUTE_SEQUENCE
                .slice(0, Math.min(recordedCompletions, CAMPAIGN_ROUTE_SEQUENCE.length))
                .forEach(route => {
                    data.levels[route.levelStateId] = {
                        completed: true,
                        migratedFromLegacyCounter: true
                    };
                });
        }

        const completedRoutes = CAMPAIGN_ROUTE_SEQUENCE.filter(route => (
            data.levels[route.levelStateId]?.completed === true
        ));
        data.stats.levelsCompleted = completedRoutes.length;
        this.migrateWandererDesignation(data);
        this.migrateProjectBeaconKatana(data);
        this.migrateFranchiseHandoff(data);

        const shipParts = data.hubWorld?.shipParts;
        const gates = data.hubWorld?.gates;
        if (!shipParts || !gates) return;

        const preFinalRoutes = CAMPAIGN_ROUTE_SEQUENCE.slice(0, -1);
        const preFinalPartIds = preFinalRoutes.map(route => route.shipPartId);
        const collected = Array.isArray(shipParts.collected) ? shipParts.collected : [];
        const collectedPreFinalParts = preFinalPartIds.filter(partId => collected.includes(partId)).length;
        const totalRequired = preFinalPartIds.length;
        shipParts.totalRequired = totalRequired;

        // A gate is usable only when every earlier canonical expedition is
        // complete. This repairs map-created skips while retaining mapsOwned as
        // the player's durable discovery record.
        CAMPAIGN_ROUTE_SEQUENCE.forEach((route, routeIndex) => {
            const gate = gates[route.gateId];
            if (!gate) return;

            if (routeIndex === 0) {
                gate.unlocked = true;
                return;
            }

            const prerequisitesMet = CAMPAIGN_ROUTE_SEQUENCE
                .slice(0, routeIndex)
                .every(previousRoute => (
                    data.levels[previousRoute.levelStateId]?.completed === true
                ));
            gate.unlocked = route.gateId === 'final_void'
                ? prerequisitesMet &&
                    collectedPreFinalParts >= totalRequired &&
                    data.hubWorld.shipCompletionCutsceneShown === true
                : prerequisitesMet;
        });

        const finalReady = preFinalRoutes.every(route => (
            data.levels[route.levelStateId]?.completed === true
        )) && collectedPreFinalParts >= totalRequired;
        shipParts.finalBossUnlocked = finalReady;

        data.story = data.story || {};
        const beaconState = data.story.projectBeacon = (
            data.story.projectBeacon || {}
        );
        const validDebriefIds = new Set(
            preFinalRoutes.map(route => route.debriefId)
        );
        const seenDebriefs = Array.from(new Set(
            (Array.isArray(beaconState.debriefsSeen)
                ? beaconState.debriefsSeen
                : []
            ).filter(id => validDebriefIds.has(id))
        ));
        const seenSet = new Set(seenDebriefs);
        const pendingById = new Map();

        (Array.isArray(beaconState.pendingDebriefs)
            ? beaconState.pendingDebriefs
            : []
        ).forEach(entry => {
            const route = preFinalRoutes.find(candidate => (
                candidate.levelStateId === entry?.levelId ||
                candidate.debriefId === entry?.id
            ));
            if (
                !route ||
                data.levels[route.levelStateId]?.completed !== true ||
                seenSet.has(route.debriefId)
            ) {
                return;
            }
            pendingById.set(route.debriefId, {
                id: route.debriefId,
                levelId: route.levelStateId,
                shipPartId: route.shipPartId,
                completedAt: entry?.completedAt || null
            });
        });

        preFinalRoutes.forEach(route => {
            if (
                data.levels[route.levelStateId]?.completed !== true ||
                seenSet.has(route.debriefId) ||
                pendingById.has(route.debriefId)
            ) {
                return;
            }
            pendingById.set(route.debriefId, {
                id: route.debriefId,
                levelId: route.levelStateId,
                shipPartId: route.shipPartId,
                completedAt: data.levels[route.levelStateId]?.completedAt || null
            });
        });

        beaconState.pendingDebriefs = preFinalRoutes
            .map(route => pendingById.get(route.debriefId))
            .filter(Boolean);
        beaconState.debriefsSeen = seenDebriefs;
    }

    /**
     * Preserve the field-kit save ID while updating its player-facing ship name.
     */
    migrateWandererDesignation(data) {
        const fieldKit = data?.story?.projectBeacon?.fieldKit;
        if (fieldKit?.name === 'Wanderer-7 Field Kit') {
            fieldKit.name = 'Wanderer-77 Field Kit';
        }
    }

    /**
     * Replace the original binary departure ending with the canonical saga
     * handoff. Older Earth/void choices become preparation priorities while
     * coordinates remain protected and departure remains deferred.
     */
    migrateFranchiseHandoff(data) {
        data.story = data.story || {};
        const beacon = data.story.projectBeacon = (
            data.story.projectBeacon || {}
        );
        const priorities = [
            'remain_and_defend',
            'prepare_homecoming',
            'prepare_first_contact'
        ];
        const legacyPriority = beacon.endingChoice === 'earth'
            ? 'prepare_homecoming'
            : beacon.endingChoice === 'void'
                ? 'remain_and_defend'
                : null;
        const existingFinale = beacon.finale && typeof beacon.finale === 'object'
            ? beacon.finale
            : {};
        const priority = priorities.includes(existingFinale.priority)
            ? existingFinale.priority
            : legacyPriority;
        const selectedAt = existingFinale.prioritySelectedAt
            || beacon.endingChoiceDate
            || null;

        beacon.finale = {
            schemaVersion: 1,
            sharedOutcome: priority
                ? {
                    coordinatesProtected: true,
                    uplinkMode: 'held',
                    departureStatus: 'deferred',
                    currentCommitment: 'remain_and_defend',
                    recordedAt: existingFinale.sharedOutcome?.recordedAt
                        || selectedAt
                }
                : existingFinale.sharedOutcome || null,
            priority,
            prioritySelectedAt: selectedAt,
            epilogueSeen: existingFinale.epilogueSeen === true
                || beacon.endingEpilogueSeen === true,
            epilogueCompletedAt: existingFinale.epilogueCompletedAt
                || beacon.endingEpilogueCompletedAt
                || null,
            ...(legacyPriority && !existingFinale.priority
                ? { migratedFromEndingChoice: beacon.endingChoice }
                : {})
        };

        const remainSource = beacon.remainAndDefend
            && typeof beacon.remainAndDefend === 'object'
            ? beacon.remainAndDefend
            : {};
        const normalizeRemainIdentifier = value => {
            if (typeof value !== 'string') return null;
            const normalized = value
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9:_-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            return normalized ? normalized.slice(0, 96) : null;
        };
        const normalizeRemainTimestamp = value => (
            typeof value === 'string' && value.trim()
                ? value.trim().slice(0, 40)
                : null
        );
        const seenRemainOperations = new Set();
        const remainHistory = (
            Array.isArray(remainSource.history)
                ? remainSource.history
                : []
        ).map(entry => {
            const operationId = normalizeRemainIdentifier(
                entry?.operationId
            );
            if (
                !operationId ||
                seenRemainOperations.has(operationId)
            ) {
                return null;
            }
            seenRemainOperations.add(operationId);
            return {
                operationId,
                type: 'chapter_completed',
                priority: priorities.includes(entry?.priority)
                    ? entry.priority
                    : 'remain_and_defend',
                occurredAt: normalizeRemainTimestamp(entry?.occurredAt)
            };
        }).filter(Boolean).slice(-4);
        const remainComplete =
            remainSource.status === 'complete' ||
            remainHistory.length > 0;
        const remainCompletion =
            remainHistory[remainHistory.length - 1] || null;
        beacon.remainAndDefend = {
            schemaVersion: 1,
            status: remainComplete ? 'complete' : 'not_started',
            completedAt: remainComplete
                ? normalizeRemainTimestamp(remainSource.completedAt)
                    || remainCompletion?.occurredAt
                    || null
                : null,
            completionOperationId: remainComplete
                ? normalizeRemainIdentifier(
                    remainSource.completionOperationId
                ) || remainCompletion?.operationId || null
                : null,
            priorityAtCompletion: remainComplete
                ? (
                    priorities.includes(
                        remainSource.priorityAtCompletion
                    )
                        ? remainSource.priorityAtCompletion
                        : remainCompletion?.priority
                            || 'remain_and_defend'
                )
                : null,
            history: remainHistory
        };

        const sensei = beacon.sensei && typeof beacon.sensei === 'object'
            ? beacon.sensei
            : {};
        beacon.sensei = {
            schemaVersion: 2,
            relationship: sensei.relationship
                || 'pre_mission_friend_and_training_partner',
            memories: Array.isArray(sensei.memories)
                ? sensei.memories
                : [
                    'begin_with_your_footing',
                    'trust_begins_with_how_you_enter',
                    'power_is_knowing_what_not_to_take'
                ],
            memoryLedger: sensei.memoryLedger
                && typeof sensei.memoryLedger === 'object'
                ? sensei.memoryLedger
                : {
                    schemaVersion: 1,
                    recalledMemoryIds: [],
                    lesson: {
                        id: 'centering_stance',
                        status: 'locked',
                        practiceCount: 0,
                        firstPracticedAt: null,
                        lastPracticedAt: null
                    },
                    history: []
                },
            encryptedContact: {
                channelId: sensei.encryptedContact?.channelId || 'DOJO-23-77',
                status: priority
                    ? 'route_recovered'
                    : sensei.encryptedContact?.status || 'fragmented',
                contactAttempted:
                    sensei.encryptedContact?.contactAttempted === true,
                contactEstablished:
                    sensei.encryptedContact?.contactEstablished === true,
                recoveredAt: sensei.encryptedContact?.recoveredAt
                    || (priority ? selectedAt : null)
            }
        };

        const hadReconstructionState =
            beacon.shipReconstruction &&
            typeof beacon.shipReconstruction === 'object';
        const capabilities = beacon.shipCapabilities
            && typeof beacon.shipCapabilities === 'object'
            ? beacon.shipCapabilities
            : {};
        beacon.shipCapabilities = {
            schemaVersion: 1,
            stealthDescent: capabilities.stealthDescent || 'damaged',
            secureReturnVector: priority && !hadReconstructionState
                ? 'sealed'
                : capabilities.secureReturnVector || 'unavailable',
            manualLanding: priority && !hadReconstructionState
                ? 'available'
                : capabilities.manualLanding || 'unavailable',
            blackBoxProof: priority && !hadReconstructionState
                ? 'recovered'
                : capabilities.blackBoxProof || 'missing',
            passengerCapacity: priority && !hadReconstructionState
                ? 1
                : Math.max(0, Number(capabilities.passengerCapacity) || 0),
            creatureLifeSupport: priority && !hadReconstructionState
                ? 'prototype_required'
                : capabilities.creatureLifeSupport || 'not_assessed',
            longRangeUplink: priority && !hadReconstructionState
                ? 'held_exposure_risk'
                : capabilities.longRangeUplink || 'offline'
        };

        const reconstructionSteps = [
            ['living_power_lattice', 'forest_core'],
            ['propulsion_control', 'crystal_core'],
            ['sealed_return_vector', 'dimensional_drive'],
            ['resonance_hull', 'hull_plating'],
            ['uplink_hold', 'aurora_reactor'],
            ['black_box_recovery', 'command_module']
        ];
        const reconstructionSource = hadReconstructionState
            ? beacon.shipReconstruction
            : {};
        const requestedReconstructionIds = new Set(
            Array.isArray(reconstructionSource.completedStepIds)
                ? reconstructionSource.completedStepIds
                : []
        );
        const collectedShipParts = new Set(
            Array.isArray(data.hubWorld?.shipParts?.collected)
                ? data.hubWorld.shipParts.collected
                : []
        );
        const completedReconstructionIds = [];
        for (const [stepId, partId] of reconstructionSteps) {
            const legacyCompleted =
                !hadReconstructionState &&
                Boolean(priority);
            if (
                (
                    !collectedShipParts.has(partId) &&
                    !legacyCompleted
                ) ||
                (!requestedReconstructionIds.has(stepId) &&
                    !legacyCompleted)
            ) {
                break;
            }
            completedReconstructionIds.push(stepId);
        }
        const reconstructionComplete =
            completedReconstructionIds.length ===
            reconstructionSteps.length;
        beacon.shipReconstruction = {
            schemaVersion: 1,
            completedStepIds: completedReconstructionIds,
            firstInstalledAt:
                reconstructionSource.firstInstalledAt ||
                (
                    completedReconstructionIds.length > 0
                        ? selectedAt
                        : null
                ),
            completedAt: reconstructionComplete
                ? reconstructionSource.completedAt || selectedAt
                : null,
            history: Array.isArray(reconstructionSource.history)
                ? reconstructionSource.history.slice(-18)
                : []
        };

        const fieldSupport = beacon.shipFieldSupport
            && typeof beacon.shipFieldSupport === 'object'
            ? beacon.shipFieldSupport
            : {};
        const normalizeSupportIdentifier = value => {
            if (typeof value !== 'string') return null;
            const normalized = value
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9:_-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            return normalized ? normalized.slice(0, 96) : null;
        };
        const seenSupportOperations = new Set();
        const fieldSupportHistory = (
            Array.isArray(fieldSupport.history)
                ? fieldSupport.history
                : []
        ).map(entry => {
            const operationId = normalizeSupportIdentifier(
                entry?.operationId
            );
            const companionId = normalizeSupportIdentifier(
                entry?.companionId
            );
            const rawLevelMilestone = Math.floor(
                Number(entry?.levelMilestone) || 0
            );
            if (
                !operationId ||
                !companionId ||
                rawLevelMilestone < 1 ||
                seenSupportOperations.has(operationId)
            ) {
                return null;
            }
            const levelMilestone = Math.min(999, rawLevelMilestone);
            seenSupportOperations.add(operationId);
            return {
                operationId,
                type: 'powered_berth_service',
                companionId,
                levelMilestone,
                energyRestored: Math.max(
                    0,
                    Math.min(50, Number(entry?.energyRestored) || 0)
                ),
                healthRestored: Math.max(
                    0,
                    Math.min(30, Number(entry?.healthRestored) || 0)
                ),
                occurredAt:
                    typeof entry?.occurredAt === 'string'
                        ? entry.occurredAt.slice(0, 40)
                        : null
            };
        }).filter(Boolean).slice(-12);
        const highestServicedLevel = fieldSupportHistory.reduce(
            (highest, entry) => Math.max(
                highest,
                Math.floor(Number(entry.levelMilestone) || 0)
            ),
            0
        );
        beacon.shipFieldSupport = {
            schemaVersion: 1,
            lastServicedLevel: Math.max(
                highestServicedLevel,
                Math.max(
                    0,
                    Math.min(
                        999,
                        Math.floor(
                            Number(fieldSupport.lastServicedLevel) || 0
                        )
                    )
                )
            ),
            serviceCount: Math.max(
                fieldSupportHistory.length,
                Math.max(
                    0,
                    Math.min(
                        999,
                        Math.floor(Number(fieldSupport.serviceCount) || 0)
                    )
                )
            ),
            lastServicedAt:
                typeof fieldSupport.lastServicedAt === 'string'
                    ? fieldSupport.lastServicedAt.slice(0, 40)
                    : null,
            history: fieldSupportHistory
        };

        const archive = beacon.shipArchive
            && typeof beacon.shipArchive === 'object'
            ? beacon.shipArchive
            : {};
        const knownArchiveSections = [
            'systems',
            'evidence',
            'boundaries'
        ];
        const normalizeArchiveIdentifier = value => {
            if (typeof value !== 'string') return null;
            const normalized = value
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9:_-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            return normalized ? normalized.slice(0, 96) : null;
        };
        const normalizeArchiveTimestamp = value => (
            typeof value === 'string' && value.trim()
                ? value.trim().slice(0, 40)
                : null
        );
        const seenArchiveOperations = new Set();
        const archiveHistory = (
            Array.isArray(archive.history) ? archive.history : []
        ).map(entry => {
            const sectionId = knownArchiveSections.includes(entry?.sectionId)
                ? entry.sectionId
                : null;
            const operationId = normalizeArchiveIdentifier(
                entry?.operationId
            );
            if (
                !sectionId ||
                !operationId ||
                seenArchiveOperations.has(operationId)
            ) {
                return null;
            }
            seenArchiveOperations.add(operationId);
            return {
                operationId,
                type: 'section_reviewed',
                sectionId,
                companionId: normalizeArchiveIdentifier(
                    entry?.companionId
                ),
                occurredAt: normalizeArchiveTimestamp(entry?.occurredAt)
            };
        }).filter(Boolean).slice(-18);
        const reviewedArchiveSections = new Set(
            Array.isArray(archive.reviewedSectionIds)
                ? archive.reviewedSectionIds.filter(
                    id => knownArchiveSections.includes(id)
                )
                : []
        );
        archiveHistory.forEach(
            entry => reviewedArchiveSections.add(entry.sectionId)
        );
        const reviewedSectionIds = [];
        for (const sectionId of knownArchiveSections) {
            if (!reviewedArchiveSections.has(sectionId)) break;
            reviewedSectionIds.push(sectionId);
        }
        beacon.shipArchive = {
            schemaVersion: 1,
            reviewedSectionIds,
            firstReviewedAt:
                normalizeArchiveTimestamp(archive.firstReviewedAt)
                || archiveHistory[0]?.occurredAt
                || null,
            completedAt:
                reviewedSectionIds.length === knownArchiveSections.length &&
                (
                    normalizeArchiveTimestamp(archive.completedAt)
                    || archiveHistory.find(
                        entry => entry.sectionId === 'boundaries'
                    )?.occurredAt
                    || null
                ),
            history: archiveHistory
        };

        const protocol = beacon.protectedReturnProtocol
            && typeof beacon.protectedReturnProtocol === 'object'
            ? beacon.protectedReturnProtocol
            : {};
        const protocolNormalizer = typeof window !== 'undefined'
            ? window.ProtectedReturnProtocol
                ?.normalizeProtectedReturnState
            : null;
        if (protocolNormalizer) {
            beacon.protectedReturnProtocol = protocolNormalizer(protocol);
        } else {
            const knownProtocolSteps = [
                'survival_packet',
                'route_quarantine',
                'living_witness_seal',
                'uplink_hold'
            ];
            const completedProtocolSteps = new Set(
                Array.isArray(protocol.completedStepIds)
                    ? protocol.completedStepIds.filter(
                        id => knownProtocolSteps.includes(id)
                    )
                    : []
            );
            const completedStepIds = [];
            for (const stepId of knownProtocolSteps) {
                if (!completedProtocolSteps.has(stepId)) break;
                completedStepIds.push(stepId);
            }
            const protocolComplete =
                completedStepIds.length === knownProtocolSteps.length;
            beacon.protectedReturnProtocol = {
                schemaVersion: 1,
                completedStepIds,
                packetStatus: protocolComplete
                    ? 'sealed_ready_not_sent'
                    : completedStepIds.length > 0
                        ? 'safeguards_in_progress'
                        : 'not_prepared',
                transmissionStatus: 'not_sent',
                firstAppliedAt:
                    normalizeArchiveTimestamp(protocol.firstAppliedAt),
                completedAt: protocolComplete
                    ? normalizeArchiveTimestamp(protocol.completedAt)
                    : null,
                history: []
            };
        }

        const consent = beacon.companionConsent
            && typeof beacon.companionConsent === 'object'
            ? beacon.companionConsent
            : {};
        const companionId = String(
            data?.creature?.genes?.id
                || data?.creature?.id
                || data?.creature?.name
                || 'active_companion'
        )
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9:_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 96) || 'active_companion';
        const existingRecords = Array.isArray(consent.records)
            ? consent.records
            : (
                consent.travelStatus ||
                consent.disclosureStatus ||
                consent.recordedAt ||
                priority
                    ? [{
                        companionId,
                        travelStatus:
                            consent.travelStatus || 'not_yet_asked',
                        disclosureStatus:
                            consent.disclosureStatus || 'withheld',
                        locationBoundary:
                            consent.locationBoundary || 'not_discussed',
                        informedRisks: consent.informedRisks === true,
                        willingPassenger:
                            typeof consent.willingPassenger === 'boolean'
                                ? consent.willingPassenger
                                : null,
                        vetoRecognized: consent.vetoRecognized !== false,
                        powerBoundary:
                            consent.powerBoundary || 'not_discussed',
                        reviewedTopicIds: Array.isArray(
                            consent.reviewedTopicIds
                        ) ? consent.reviewedTopicIds : [],
                        history: Array.isArray(consent.history)
                            ? consent.history
                            : [],
                        recordedAt:
                            consent.recordedAt || (priority ? selectedAt : null),
                        lastReviewedAt: consent.lastReviewedAt || null
                    }]
                    : []
            );
        beacon.companionConsent = {
            schemaVersion: 2,
            activeCompanionId: companionId,
            records: existingRecords.slice(-24)
        };

        const earthMemorySource = beacon.companionEarthMemory
            && typeof beacon.companionEarthMemory === 'object'
            ? beacon.companionEarthMemory
            : {};
        const knownEarthMemoryIds = new Set([
            'dojo_dawn',
            'ocean_after_storm',
            'city_lights'
        ]);
        const normalizeEarthMemoryId = value => {
            if (typeof value !== 'string') return null;
            const normalized = value
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9:_-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            return normalized ? normalized.slice(0, 96) : null;
        };
        const earthMemoryRecords = Array.isArray(
            earthMemorySource.records
        )
            ? earthMemorySource.records.map(record => {
                const recordCompanionId = normalizeEarthMemoryId(
                    record?.companionId
                );
                const selectedMemoryId = knownEarthMemoryIds.has(
                    record?.selectedMemoryId
                )
                    ? record.selectedMemoryId
                    : null;
                if (!recordCompanionId) return null;
                const history = Array.isArray(record?.history)
                    ? record.history.map(entry => {
                        const operationId = normalizeEarthMemoryId(
                            entry?.operationId
                        );
                        const memoryId = knownEarthMemoryIds.has(
                            entry?.memoryId
                        )
                            ? entry.memoryId
                            : null;
                        if (!operationId || !memoryId) return null;
                        return {
                            operationId,
                            type: 'earth_memory_shared',
                            memoryId,
                            occurredAt:
                                typeof entry?.occurredAt === 'string'
                                    ? entry.occurredAt.trim().slice(0, 40)
                                        || null
                                    : null
                        };
                    }).filter(Boolean).slice(-12)
                    : [];
                const recoveredMemoryId = selectedMemoryId
                    || history[history.length - 1]?.memoryId
                    || null;
                return {
                    companionId: recordCompanionId,
                    status: recoveredMemoryId
                        ? 'shared'
                        : 'not_shared',
                    selectedMemoryId: recoveredMemoryId,
                    invitationStatus: 'not_offered',
                    travelConsentRecorded: false,
                    transmissionStatus: 'not_sent',
                    sharedAt: recoveredMemoryId &&
                        typeof record?.sharedAt === 'string'
                        ? record.sharedAt.trim().slice(0, 40) || null
                        : history[history.length - 1]?.occurredAt || null,
                    history
                };
            }).filter(Boolean).slice(-24)
            : [];
        beacon.companionEarthMemory = {
            schemaVersion: 1,
            activeCompanionId: companionId,
            records: earthMemoryRecords
        };

        data.world = data.world || {};
        const currentVeil = data.world.currentVeilMission
            && typeof data.world.currentVeilMission === 'object'
            ? data.world.currentVeilMission
            : {};
        const currentVeilNormalizer = typeof window !== 'undefined'
            ? window.CurrentVeilMission
                ?.normalizeCurrentVeilState
            : null;
        if (currentVeilNormalizer) {
            data.world.currentVeilMission = currentVeilNormalizer(
                currentVeil
            );
        } else {
            const knownAnchorIds = [
                'root_echo',
                'well_echo',
                'relay_echo'
            ];
            const stabilizedAnchorIds = knownAnchorIds.filter(
                id => Array.isArray(
                    currentVeil.stabilizedAnchorIds
                ) && currentVeil.stabilizedAnchorIds.includes(id)
            );
            const complete =
                currentVeil.status === 'complete' &&
                stabilizedAnchorIds.length === knownAnchorIds.length;
            const verificationReady =
                !complete &&
                stabilizedAnchorIds.length === knownAnchorIds.length;
            const active =
                !complete &&
                !verificationReady &&
                (
                    currentVeil.status === 'active' ||
                    stabilizedAnchorIds.length > 0
                );
            data.world.currentVeilMission = {
                schemaVersion: 1,
                status: complete
                    ? 'complete'
                    : verificationReady
                        ? 'verification_ready'
                        : active
                            ? 'active'
                            : 'not_started',
                stabilizedAnchorIds,
                maskStatus: complete
                    ? 'verified'
                    : verificationReady
                        ? 'ready_for_verification'
                        : active
                            ? 'aligning'
                            : 'inactive',
                transmissionStatus: 'not_sent',
                startedAt:
                    normalizeArchiveTimestamp(currentVeil.startedAt),
                completedAt: complete
                    ? normalizeArchiveTimestamp(
                        currentVeil.completedAt
                    )
                    : null,
                history: []
            };
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
        const activeCompanionId = String(
            data?.creature?.id
                || data?.creature?.genes?.id
                || 'active_companion'
        )
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9:_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 96) || 'active_companion';
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
                    witnessCompanionId: activeCompanionId,
                    migrated: true
                });
                installedIds.add(upgrade.id);
            }
        });

        katana.upgradeSlots = upgradeSlots;
        katana.installedUpgrades = installed.map(upgrade => {
            if (typeof upgrade === 'string') {
                return {
                    id: upgrade,
                    witnessCompanionId: activeCompanionId,
                    migrated: true
                };
            }
            return {
                ...upgrade,
                witnessCompanionId:
                    upgrade?.witnessCompanionId || activeCompanionId
            };
        });
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

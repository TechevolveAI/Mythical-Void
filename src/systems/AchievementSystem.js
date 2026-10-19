/**
 * AchievementSystem - Tiered achievement system with rewards
 *
 * Features:
 * - Bronze → Silver → Gold → Platinum tiers
 * - Progress tracking with percentages
 * - Coin and Stardust rewards
 * - Egg rewards for major achievements
 * - Hidden/secret achievements
 * - Category organization
 */

import { devLog, devWarn } from '../utils/devLogger.js';
import { copyDetachedJsonData, freezeDetachedJsonData } from '../utils/DetachedJsonData.js';

const completionEventDrafts = new WeakMap();

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

function getEconomyManager() {
    if (typeof window === 'undefined' || !window.EconomyManager) {
        return null;
    }
    return window.EconomyManager;
}

function getInventoryManager() {
    if (typeof window === 'undefined' || !window.InventoryManager) {
        return null;
    }
    return window.InventoryManager;
}

// Achievement tier definitions
const TIERS = {
    BRONZE: { name: 'Bronze', icon: '🥉', level: 1 },
    SILVER: { name: 'Silver', icon: '🥈', level: 2 },
    GOLD: { name: 'Gold', icon: '🥇', level: 3 },
    PLATINUM: { name: 'Platinum', icon: '💎', level: 4 }
};

// Achievement categories
const CATEGORIES = {
    CARE: { name: 'Care & Bonding', icon: '❤️', order: 1 },
    COLLECTION: { name: 'Collection', icon: '🥚', order: 2 },
    EXPLORATION: { name: 'Exploration', icon: '🗺️', order: 3 },
    COMBAT: { name: 'Combat', icon: '⚔️', order: 4 },
    MASTERY: { name: 'Mastery', icon: '🏆', order: 5 },
    HIDDEN: { name: 'Hidden', icon: '❓', order: 6 }
};

/**
 * Achievement definitions with tiered progression
 *
 * Reward philosophy:
 * - Bronze: Small coin reward (25-50)
 * - Silver: Medium coin reward (75-100)
 * - Gold: Large coin reward (150-200) + occasional Uncommon egg
 * - Platinum: Stardust reward (50-150) + occasional Rare egg for BIG achievements
 */
const ACHIEVEMENT_DEFINITIONS = {
    // ==================== CARE & BONDING ====================
    caring_owner: {
        id: 'caring_owner',
        name: 'Caring Owner',
        category: 'CARE',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Care for your creature once',
                requirement: 1,
                rewards: { coins: 25 }
            },
            SILVER: {
                description: 'Care for your creature 25 times',
                requirement: 25,
                rewards: { coins: 75 }
            },
            GOLD: {
                description: 'Care for your creature 100 times',
                requirement: 100,
                rewards: { coins: 150 }
            },
            PLATINUM: {
                description: 'Care for your creature 500 times',
                requirement: 500,
                rewards: { stardust: 75 }
            }
        },
        getProgress: (state) => {
            const care = state.creature?.care || {};
            return (care.totalCareActions || 0);
        }
    },

    best_friends: {
        id: 'best_friends',
        name: 'Best Friends',
        category: 'CARE',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Spend 1 day with your creature',
                requirement: 1,
                rewards: { coins: 25 }
            },
            SILVER: {
                description: 'Spend 7 days with your creature',
                requirement: 7,
                rewards: { coins: 75 }
            },
            GOLD: {
                description: 'Spend 30 days with your creature',
                requirement: 30,
                rewards: { coins: 200, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Spend 100 days with your creature',
                requirement: 100,
                rewards: { stardust: 100, egg: 'rare' }
            }
        },
        getProgress: (state, _tier, preparedNow) => {
            const hatchedAt = state.creature?.lifecycle?.birthDate ||
                state.creature?.hatchTime;
            if (!hatchedAt) return 0;
            const hatchTimestamp = new Date(hatchedAt).getTime();
            if (!Number.isFinite(hatchTimestamp)) return 0;
            const daysSinceHatch = Math.floor(
                Math.max(0, (preparedNow === undefined ? Date.now() : preparedNow) - hatchTimestamp) / (1000 * 60 * 60 * 24)
            );
            return daysSinceHatch;
        }
    },

    care_streak: {
        id: 'care_streak',
        name: 'Care Streak Master',
        category: 'CARE',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Maintain a 3-day care streak',
                requirement: 3,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Maintain a 7-day care streak',
                requirement: 7,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Maintain a 14-day care streak',
                requirement: 14,
                rewards: { coins: 200, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Maintain a 30-day care streak',
                requirement: 30,
                rewards: { stardust: 150, egg: 'rare' }
            }
        },
        getProgress: (state) => {
            return state.creature?.care?.careStreak || 0;
        }
    },

    happy_creature: {
        id: 'happy_creature',
        name: 'Happy Creature',
        category: 'CARE',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Keep happiness above 80',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Keep happiness at 100 for a full day',
                requirement: 1,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Maintain max happiness for 7 days',
                requirement: 7,
                rewards: { coins: 200 }
            },
            PLATINUM: {
                description: 'Maintain max happiness for 30 days',
                requirement: 30,
                rewards: { stardust: 100 }
            }
        },
        getProgress: (state, tier) => {
            const happiness = state.creature?.stats?.happiness || 0;
            if (tier === 'BRONZE') {
                return happiness >= 80 ? 1 : 0;
            }
            return state.stats?.maxHappinessDays || 0;
        },
        isSpecialProgress: true
    },

    // ==================== COLLECTION ====================
    first_hatch: {
        id: 'first_hatch',
        name: 'Hatchling',
        category: 'COLLECTION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Hatch your first creature',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Hatch 3 creatures',
                requirement: 3,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Hatch 10 creatures',
                requirement: 10,
                rewards: { coins: 200, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Hatch 25 creatures',
                requirement: 25,
                rewards: { stardust: 150, egg: 'rare' }
            }
        },
        getProgress: (state) => {
            return state.stats?.creaturesHatched || (state.creature?.hatched ? 1 : 0);
        }
    },

    rarity_seeker: {
        id: 'rarity_seeker',
        name: 'Rarity Seeker',
        category: 'COLLECTION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Hatch an Uncommon creature',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Hatch a Rare creature',
                requirement: 1,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Hatch an Epic creature',
                requirement: 1,
                rewards: { coins: 250 }
            },
            PLATINUM: {
                description: 'Hatch a Legendary creature',
                requirement: 1,
                rewards: { stardust: 200 }
            }
        },
        getProgress: (state, tier) => {
            const stats = state.stats || {};
            switch (tier) {
                case 'BRONZE': return stats.uncommonHatched || 0;
                case 'SILVER': return stats.rareHatched || 0;
                case 'GOLD': return stats.epicHatched || 0;
                case 'PLATINUM': return stats.legendaryHatched || 0;
                default: return 0;
            }
        },
        isSpecialProgress: true
    },

    species_collector: {
        id: 'species_collector',
        name: 'Species Collector',
        category: 'COLLECTION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Collect 2 different species',
                requirement: 2,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Collect 3 different species',
                requirement: 3,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Collect 4 different species',
                requirement: 4,
                rewards: { coins: 200 }
            },
            PLATINUM: {
                description: 'Collect all 5 species',
                requirement: 5,
                rewards: { stardust: 200, egg: 'rare' }
            }
        },
        getProgress: (state) => {
            const species = state.stats?.speciesDiscovered || [];
            return Array.isArray(species) ? species.length : 0;
        }
    },

    // ==================== EXPLORATION ====================
    explorer: {
        id: 'explorer',
        name: 'Explorer',
        category: 'EXPLORATION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Visit 3 different areas',
                requirement: 3,
                rewards: { coins: 25 }
            },
            SILVER: {
                description: 'Visit 5 different areas',
                requirement: 5,
                rewards: { coins: 75 }
            },
            GOLD: {
                description: 'Visit every realm',
                requirement: 7,
                rewards: { coins: 150 }
            },
            PLATINUM: {
                description: 'Discover 15 realms, Sanctuary places, and signs of life',
                requirement: 15,
                rewards: { stardust: 100 }
            }
        },
        getProgress: (state) => {
            const visited = state.world?.visitedAreas || [];
            return Array.isArray(visited) ? visited.length : 0;
        }
    },

    crystal_conqueror: {
        id: 'crystal_conqueror',
        name: 'Crystal Keeper',
        category: 'EXPLORATION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Enter the Crystal Caves',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Complete Crystal Caves',
                requirement: 1,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Complete Crystal Caves without taking damage',
                requirement: 1,
                rewards: { coins: 200, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Speedrun Crystal Caves under 3 minutes',
                requirement: 1,
                rewards: { stardust: 100 }
            }
        },
        getProgress: (state, tier) => {
            const level = state.levels?.crystalCaves || {};
            switch (tier) {
                case 'BRONZE': return level.entered ? 1 : 0;
                case 'SILVER': return level.completed ? 1 : 0;
                case 'GOLD': return level.noDamageRun ? 1 : 0;
                case 'PLATINUM': return level.speedrun ? 1 : 0;
                default: return 0;
            }
        },
        isSpecialProgress: true
    },

    void_voyager: {
        id: 'void_voyager',
        name: 'Void Voyager',
        category: 'EXPLORATION',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Enter the Cosmic Reef',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Complete Cosmic Reef',
                requirement: 1,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Complete Cosmic Reef without taking damage',
                requirement: 1,
                rewards: { coins: 200, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Speedrun Cosmic Reef under 4 minutes',
                requirement: 1,
                rewards: { stardust: 100 }
            }
        },
        getProgress: (state, tier) => {
            const level = state.levels?.cosmicReef || {};
            switch (tier) {
                case 'BRONZE': return level.entered ? 1 : 0;
                case 'SILVER': return level.completed ? 1 : 0;
                case 'GOLD': return level.noDamageRun ? 1 : 0;
                case 'PLATINUM': return level.speedrun ? 1 : 0;
                default: return 0;
            }
        },
        isSpecialProgress: true
    },

    // ==================== COMBAT ====================
    first_victory: {
        id: 'first_victory',
        name: 'First Victory',
        category: 'COMBAT',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Defeat your first enemy',
                requirement: 1,
                rewards: { coins: 25 }
            },
            SILVER: {
                description: 'Defeat 25 enemies',
                requirement: 25,
                rewards: { coins: 75 }
            },
            GOLD: {
                description: 'Defeat 100 enemies',
                requirement: 100,
                rewards: { coins: 150 }
            },
            PLATINUM: {
                description: 'Defeat 500 enemies',
                requirement: 500,
                rewards: { stardust: 75 }
            }
        },
        getProgress: (state) => {
            return state.combat?.enemiesDefeated || 0;
        }
    },

    boss_slayer: {
        id: 'boss_slayer',
        name: 'Guardian Restorer',
        category: 'COMBAT',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Restore your first guardian',
                requirement: 1,
                rewards: { coins: 75 }
            },
            SILVER: {
                description: 'Restore 3 guardians',
                requirement: 3,
                rewards: { coins: 150 }
            },
            GOLD: {
                description: 'Restore 10 guardians across your journeys',
                requirement: 10,
                rewards: { coins: 250, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Restore every guardian without taking damage',
                requirement: 1,
                rewards: { stardust: 150, egg: 'rare' }
            }
        },
        getProgress: (state, tier) => {
            if (tier === 'PLATINUM') {
                return state.combat?.allBossesNoDamage ? 1 : 0;
            }
            return state.combat?.bossesDefeated || 0;
        },
        isSpecialProgress: true
    },

    // ==================== MASTERY ====================
    dedicated_player: {
        id: 'dedicated_player',
        name: 'Dedicated Player',
        category: 'MASTERY',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Play for 10 minutes',
                requirement: 10,
                rewards: { coins: 25 }
            },
            SILVER: {
                description: 'Play for 1 hour',
                requirement: 60,
                rewards: { coins: 75 }
            },
            GOLD: {
                description: 'Play for 5 hours',
                requirement: 300,
                rewards: { coins: 200 }
            },
            PLATINUM: {
                description: 'Play for 20 hours',
                requirement: 1200,
                rewards: { stardust: 150 }
            }
        },
        getProgress: (state) => {
            const playTimeMs = state.player?.playTime || 0;
            return Math.floor(playTimeMs / (1000 * 60)); // Convert to minutes
        }
    },

    wealthy: {
        id: 'wealthy',
        name: 'Wealthy',
        category: 'MASTERY',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Accumulate 500 coins total',
                requirement: 500,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Accumulate 2,000 coins total',
                requirement: 2000,
                rewards: { coins: 100 }
            },
            GOLD: {
                description: 'Accumulate 10,000 coins total',
                requirement: 10000,
                rewards: { coins: 250 }
            },
            PLATINUM: {
                description: 'Accumulate 50,000 coins total',
                requirement: 50000,
                rewards: { stardust: 200 }
            }
        },
        getProgress: (state) => {
            return state.stats?.coinsCollected || state.player?.cosmicCoins || 0;
        }
    },

    elder_keeper: {
        id: 'elder_keeper',
        name: 'Elder Keeper',
        category: 'MASTERY',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Raise a creature to Juvenile stage',
                requirement: 1,
                rewards: { coins: 50 }
            },
            SILVER: {
                description: 'Raise a creature to Adult stage',
                requirement: 1,
                rewards: { coins: 150 }
            },
            GOLD: {
                description: 'Raise a creature to Elder stage',
                requirement: 1,
                rewards: { coins: 250, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Raise 3 creatures to Elder stage',
                requirement: 3,
                rewards: { stardust: 200, egg: 'rare' }
            }
        },
        getProgress: (state, tier) => {
            const stages = state.stats?.stagesReached || {};
            switch (tier) {
                case 'BRONZE': return stages.juvenile || 0;
                case 'SILVER': return stages.adult || 0;
                case 'GOLD': return stages.elder || 0;
                case 'PLATINUM': return stages.elderCount || 0;
                default: return 0;
            }
        },
        isSpecialProgress: true
    },

    beacon_restorer: {
        id: 'beacon_restorer',
        name: 'Beacon Restorer',
        category: 'MASTERY',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Restore every realm and bring Project Beacon online',
                requirement: 1,
                rewards: { coins: 500 }
            }
        },
        getProgress: (state) => {
            return state.story?.projectBeacon?.uplinkRestored ? 1 : 0;
        },
        singleTier: true
    },

    // ==================== HIDDEN ====================
    night_owl: {
        id: 'night_owl',
        name: 'Night Owl',
        category: 'HIDDEN',
        hidden: true,
        tiers: {
            BRONZE: {
                description: 'Play between midnight and 4am',
                requirement: 1,
                rewards: { coins: 100, stardust: 25 }
            }
        },
        getProgress: (state) => {
            return state.stats?.nightOwlTriggered ? 1 : 0;
        },
        singleTier: true
    },

    aurora_witness: {
        id: 'aurora_witness',
        name: 'Aurora Witness',
        category: 'HIDDEN',
        hidden: true,
        tiers: {
            BRONZE: {
                description: 'Witness a NASA aurora event in-game',
                requirement: 1,
                rewards: { coins: 75, egg: 'uncommon' }
            }
        },
        getProgress: (state) => {
            return state.stats?.auroraWitnessed ? 1 : 0;
        },
        singleTier: true
    },

    persistence: {
        id: 'persistence',
        name: 'Persistence',
        category: 'HIDDEN',
        hidden: true,
        tiers: {
            BRONZE: {
                description: 'Fail a level 5 times, then succeed',
                requirement: 1,
                rewards: { coins: 100, egg: 'uncommon' }
            }
        },
        getProgress: (state) => {
            return state.stats?.persistenceTriggered ? 1 : 0;
        },
        singleTier: true
    }
};

const COMPLETION_CATALOGUE = Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, definition]) => {
    const { getProgress, ...data } = definition;
    return { id, getProgress, bytes: JSON.stringify(data) };
});

class AchievementSystem {
    constructor() {
        this.initialized = false;
        this.definitions = ACHIEVEMENT_DEFINITIONS;
        this.tiers = TIERS;
        this.categories = CATEGORIES;
        this.events = null;

        // Queue for pending achievement notifications
        this.notificationQueue = [];

        // Track achievements waiting to be claimed
        this.pendingClaims = [];
        this.loadedGameState = null;
        this.loadedAdmissionEpoch = null;
        this.loadedAchievementsBytes = null;
    }

    /**
     * Initialize the achievement system
     */
    initialize() {
        if (this.initialized) return;

        // Create event emitter
        if (typeof Phaser !== 'undefined') {
            this.events = new Phaser.Events.EventEmitter();
        }

        // Load saved progress
        if (this.loadProgress() === false) return;

        this.initialized = true;
        devLog('[AchievementSystem] Initialized with', Object.keys(this.definitions).length, 'achievements');
    }

    /**
     * Load achievement progress from GameState
     */
    loadProgress() {
        const state = getGameState(), reader = state.captureSaveAdmissionOwner?.();
        const epoch = state.getSaveAdmission?.().epoch;
        const definitions = this.definitions, ids = Object.keys(definitions);
        const slots = ids.map(id => definitions[id]);
        const saved = state.get('achievements') || {}, bytes = JSON.stringify(saved);
        const current = () => getGameState() === state && window.AchievementSystem === this && this.definitions === definitions &&
            state.getSaveAdmission?.().epoch === epoch && (!reader || reader.isCurrent()) &&
            JSON.stringify(Object.keys(definitions)) === JSON.stringify(ids) && ids.every((id, index) => definitions[id] === slots[index]);
        if (!current()) return false;
        const changedSource = this.loadedGameState &&
            (this.loadedGameState !== state || this.loadedAdmissionEpoch !== epoch);

        // Merge saved progress into definitions
        for (const id of ids) {
            if (!current()) return false;
            if (saved[id]) {
                this.definitions[id].progress = saved[id].progress || {};
                if (!current()) return false;
                this.definitions[id].claimed = saved[id].claimed || {};
            } else {
                this.definitions[id].progress = {};
                if (!current()) return false;
                this.definitions[id].claimed = {};
            }
        }
        if (!current()) return false;
        // A new admitted source has the same empty volatile queue as a fresh service.
        // Its durable unlock/claim records are loaded above, never merged or rewarded.
        if (changedSource) this.pendingClaims = [];
        if (!current()) return false;
        this.loadedGameState = state;
        this.loadedAdmissionEpoch = epoch;
        this.loadedAchievementsBytes = bytes;
        return current();
    }

    hasHatchProgressSource(state) {
        try {
            const saved = state.get('achievements') || {};
            return this.initialized && getGameState() === state && window.AchievementSystem === this && this.loadedGameState === state &&
                this.loadedAdmissionEpoch === state.getSaveAdmission().epoch &&
                this.loadedAchievementsBytes === JSON.stringify(saved) &&
                Object.keys(saved).every(id => Object.hasOwn(this.definitions, id)) &&
                Object.entries(this.definitions).every(([id, definition]) =>
                    JSON.stringify(definition.progress || {}) === JSON.stringify(saved[id]?.progress || {}) &&
                    JSON.stringify(definition.claimed || {}) === JSON.stringify(saved[id]?.claimed || {}));
        } catch (error) { return false; }
    }

    ensureHatchProgressSource(state) {
        if (this.hasHatchProgressSource(state)) return;
        if (!this.initialized || !this.loadedGameState || getGameState() !== state ||
            (this.loadedGameState === state && this.loadedAdmissionEpoch === state.getSaveAdmission().epoch)) {
            throw new Error('Achievement source needs review');
        }
        if (this.loadProgress() === false || !this.hasHatchProgressSource(state)) {
            throw new Error('Achievement source changed while loading');
        }
    }

    /**
     * Save achievement progress to GameState
     */
    saveProgress(targetState = null) {
        const source = targetState ? null : getGameState();
        const toSave = {};

        Object.keys(this.definitions).forEach(id => {
            toSave[id] = {
                progress: this.definitions[id].progress || {},
                claimed: this.definitions[id].claimed || {}
            };
        });

        (targetState || getGameState()).set('achievements', toSave);
        (targetState || getGameState()).save?.();
        if (source && getGameState() === source && this.loadedGameState === source &&
            this.loadedAdmissionEpoch === source.getSaveAdmission?.().epoch) {
            this.loadedAchievementsBytes = JSON.stringify(source.get('achievements') || {});
        }
    }

    /**
     * Check all achievements and return newly unlocked ones
     * @returns {Array} Array of newly unlocked achievement tier objects
     */
    checkAchievements(targetState = null) {
        const newUnlocks = [];
        const gameState = (targetState || getGameState()).get();

        Object.values(this.definitions).forEach(achievement => {
            const tierOrder = achievement.singleTier ? ['BRONZE'] : ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

            tierOrder.forEach(tierKey => {
                const tier = achievement.tiers[tierKey];
                if (!tier) return;

                // Skip if already claimed
                if (achievement.claimed && achievement.claimed[tierKey]) return;

                // Skip if already unlocked (waiting to be claimed)
                if (achievement.progress && achievement.progress[tierKey]?.unlocked) return;

                // Calculate progress
                let progress;
                if (targetState && Object.hasOwn(targetState, 'achievementNow')) {
                    progress = achievement.getProgress(gameState, achievement.isSpecialProgress ? tierKey : undefined, targetState.achievementNow);
                } else if (achievement.isSpecialProgress) {
                    progress = achievement.getProgress(gameState, tierKey);
                } else {
                    progress = achievement.getProgress(gameState);
                }

                // Check if requirement met
                if (progress >= tier.requirement) {
                    // Mark as unlocked (but not claimed)
                    if (!achievement.progress) achievement.progress = {};
                    achievement.progress[tierKey] = {
                        unlocked: true,
                        unlockedAt: targetState && Object.hasOwn(targetState, 'achievementNow') ? targetState.achievementNow : Date.now(),
                        value: progress
                    };

                    const unlockData = {
                        id: achievement.id,
                        name: achievement.name,
                        tier: tierKey,
                        tierInfo: this.tiers[tierKey],
                        description: tier.description,
                        rewards: tier.rewards,
                        category: achievement.category,
                        hidden: achievement.hidden
                    };

                    newUnlocks.push(unlockData);
                    this.pendingClaims.push(unlockData);

                    if (!targetState) {
                        devLog(`[AchievementSystem] Unlocked: ${achievement.name} (${tierKey})`);
                    }
                }
            });
        });

        // Save progress
        if (newUnlocks.length > 0) {
            if (targetState) this.saveProgress(targetState);
            else this.saveProgress();

            // Emit events
            newUnlocks.forEach(unlock => {
                if (this.events) {
                    this.events.emit('achievement:unlocked', unlock);
                }
            });
        }

        return newUnlocks;
    }

    /**
     * Claim rewards for an unlocked achievement tier
     * @param {string} achievementId - Achievement ID
     * @param {string} tierKey - Tier key (BRONZE, SILVER, GOLD, PLATINUM)
     * @returns {object|null} Claimed rewards or null if claim failed
     */
    claimReward(achievementId, tierKey) {
        const achievement = this.definitions[achievementId];
        if (!achievement) {
            devWarn(`[AchievementSystem] Unknown achievement: ${achievementId}`);
            return null;
        }

        const tier = achievement.tiers[tierKey];
        if (!tier) {
            devWarn(`[AchievementSystem] Unknown tier: ${tierKey}`);
            return null;
        }

        // Check if unlocked
        if (!achievement.progress || !achievement.progress[tierKey]?.unlocked) {
            devWarn(`[AchievementSystem] Achievement not unlocked: ${achievementId} ${tierKey}`);
            return null;
        }

        // Check if already claimed
        if (achievement.claimed && achievement.claimed[tierKey]) {
            devWarn(`[AchievementSystem] Already claimed: ${achievementId} ${tierKey}`);
            return null;
        }

        // Grant rewards
        const rewards = tier.rewards;
        const grantedRewards = { coins: 0, stardust: 0, eggs: [] };

        if (rewards.coins) {
            const economy = getEconomyManager();
            if (economy) {
                economy.addCoins(rewards.coins, `achievement:${achievementId}`);
                grantedRewards.coins = rewards.coins;
            }
        }

        if (rewards.stardust) {
            const economy = getEconomyManager();
            if (economy) {
                economy.addStardust(rewards.stardust, `achievement:${achievementId}`);
                grantedRewards.stardust = rewards.stardust;
            }
        }

        if (rewards.egg) {
            const inventory = getInventoryManager();
            if (inventory) {
                // Create egg item based on rarity
                const eggItem = this.createEggReward(rewards.egg);
                if (eggItem) {
                    inventory.addItem(eggItem);
                    grantedRewards.eggs.push(eggItem);
                }
            }
        }

        // Mark as claimed
        if (!achievement.claimed) achievement.claimed = {};
        achievement.claimed[tierKey] = {
            claimedAt: Date.now(),
            rewards: grantedRewards
        };

        // Remove from pending claims
        this.pendingClaims = this.pendingClaims.filter(
            p => !(p.id === achievementId && p.tier === tierKey)
        );

        // Save progress
        this.saveProgress();

        // Emit event
        if (this.events) {
            this.events.emit('achievement:claimed', {
                id: achievementId,
                tier: tierKey,
                rewards: grantedRewards
            });
        }

        devLog(`[AchievementSystem] Claimed: ${achievement.name} (${tierKey}) - Rewards:`, grantedRewards);

        return grantedRewards;
    }

    /**
     * Create an egg item for achievement rewards
     * @param {string} rarity - Egg rarity
     * @returns {object} Egg item
     */
    createEggReward(rarity) {
        const eggTypes = {
            common: { id: 'common_egg', name: 'Common Egg', rarity: 'common', icon: '🥚' },
            uncommon: { id: 'uncommon_egg', name: 'Uncommon Egg', rarity: 'uncommon', icon: '🥚' },
            rare: { id: 'rare_egg', name: 'Rare Egg', rarity: 'rare', icon: '🥚' },
            epic: { id: 'epic_egg', name: 'Epic Egg', rarity: 'epic', icon: '🥚' },
            legendary: { id: 'legendary_egg', name: 'Legendary Egg', rarity: 'legendary', icon: '🥚' }
        };

        const template = eggTypes[rarity] || eggTypes.common;

        return {
            id: `${template.id}_${Date.now()}`,
            templateId: template.id,
            name: template.name,
            type: 'egg',
            rarity: template.rarity,
            icon: template.icon,
            description: `A ${template.rarity} egg from achievement rewards`,
            stackable: false,
            usable: true,
            source: 'achievement'
        };
    }

    /**
     * Get achievement by ID
     */
    getAchievement(id) {
        return this.definitions[id] || null;
    }

    /**
     * Get all achievements organized by category
     */
    getAchievementsByCategory() {
        const byCategory = {};

        // Initialize categories
        Object.keys(this.categories).forEach(catKey => {
            byCategory[catKey] = {
                ...this.categories[catKey],
                achievements: []
            };
        });

        // Populate achievements
        Object.values(this.definitions).forEach(achievement => {
            const catKey = achievement.category;
            if (byCategory[catKey]) {
                byCategory[catKey].achievements.push(achievement);
            }
        });

        // Sort by category order
        return Object.fromEntries(
            Object.entries(byCategory).sort((a, b) => a[1].order - b[1].order)
        );
    }

    /**
     * Get progress for a specific achievement
     */
    getAchievementProgress(achievementId) {
        const achievement = this.definitions[achievementId];
        if (!achievement) return null;

        const gameState = getGameState().get();
        const tierOrder = achievement.singleTier ? ['BRONZE'] : ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

        // Find current tier (first unclaimed)
        let currentTierKey = null;
        let completedTiers = [];

        for (const tierKey of tierOrder) {
            if (achievement.claimed && achievement.claimed[tierKey]) {
                completedTiers.push(tierKey);
            } else {
                currentTierKey = tierKey;
                break;
            }
        }

        // If all claimed, return max progress
        if (!currentTierKey) {
            return {
                achievementId,
                name: achievement.name,
                category: achievement.category,
                hidden: achievement.hidden,
                allComplete: true,
                completedTiers,
                currentTier: 'PLATINUM',
                percentage: 100
            };
        }

        const currentTier = achievement.tiers[currentTierKey];
        let currentValue;

        if (achievement.isSpecialProgress) {
            currentValue = achievement.getProgress(gameState, currentTierKey);
        } else {
            currentValue = achievement.getProgress(gameState);
        }

        const percentage = Math.min(100, Math.round((currentValue / currentTier.requirement) * 100));

        return {
            achievementId,
            name: achievement.name,
            category: achievement.category,
            hidden: achievement.hidden,
            allComplete: false,
            completedTiers,
            currentTier: currentTierKey,
            currentTierInfo: this.tiers[currentTierKey],
            description: currentTier.description,
            rewards: currentTier.rewards,
            currentValue,
            requirement: currentTier.requirement,
            percentage,
            unlocked: achievement.progress?.[currentTierKey]?.unlocked || false
        };
    }

    /**
     * Get all pending (unlocked but unclaimed) achievements
     */
    getPendingClaims() {
        return [...this.pendingClaims];
    }

    /**
     * Get overall achievement statistics
     */
    getStats() {
        let totalTiers = 0;
        let claimedTiers = 0;
        let totalCoinsEarned = 0;
        let totalStardustEarned = 0;
        let eggsEarned = 0;

        Object.values(this.definitions).forEach(achievement => {
            const tierOrder = achievement.singleTier ? ['BRONZE'] : ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

            tierOrder.forEach(tierKey => {
                if (achievement.tiers[tierKey]) {
                    totalTiers++;

                    if (achievement.claimed && achievement.claimed[tierKey]) {
                        claimedTiers++;
                        const claimed = achievement.claimed[tierKey];
                        if (claimed.rewards) {
                            totalCoinsEarned += claimed.rewards.coins || 0;
                            totalStardustEarned += claimed.rewards.stardust || 0;
                            eggsEarned += (claimed.rewards.eggs?.length || 0);
                        }
                    }
                }
            });
        });

        return {
            totalAchievements: Object.keys(this.definitions).length,
            totalTiers,
            claimedTiers,
            percentage: totalTiers > 0 ? Math.round((claimedTiers / totalTiers) * 100) : 0,
            totalCoinsEarned,
            totalStardustEarned,
            eggsEarned,
            pendingClaims: this.pendingClaims.length
        };
    }

    /**
     * Record a specific event for achievements
     */
    recordEvent(eventType, data = {}) {
        switch (eventType) {
            case 'night_play':
                const hour = new Date().getHours();
                if (hour >= 0 && hour < 4) {
                    getGameState().set('stats.nightOwlTriggered', true);
                }
                break;

            case 'aurora_seen':
                getGameState().set('stats.auroraWitnessed', true);
                break;

            case 'persistence_win':
                if (data.failCount >= 5) {
                    getGameState().set('stats.persistenceTriggered', true);
                }
                break;

            case 'care_action':
                const total = getGameState().get('creature.care.totalCareActions') || 0;
                getGameState().set('creature.care.totalCareActions', total + 1);
                break;

            case 'creature_hatched':
                this.recordHatchEvent(data);
                break;

            case 'enemy_defeated':
                const enemies = getGameState().get('combat.enemiesDefeated') || 0;
                getGameState().set('combat.enemiesDefeated', enemies + 1);
                break;

            // `boss_defeated` remains as a compatibility alias for older callers.
            case 'guardian_restored':
            case 'boss_defeated':
                this.recordGuardianRestoredEvent(data);
                break;

            case 'level_entered':
                if (data.levelId) {
                    getGameState().set(`levels.${data.levelId}.entered`, true);
                }
                break;

            case 'level_completed':
                this.recordLevelCompletedEvent(data);
                break;

            case 'campaign_completed':
                getGameState().set('story.projectBeacon.uplinkRestored', true);
                if (!getGameState().get('story.projectBeacon.uplinkRestoredAt')) {
                    getGameState().set(
                        'story.projectBeacon.uplinkRestoredAt',
                        data.restoredAt || new Date().toISOString()
                    );
                }
                break;

            case 'stage_reached':
                if (data.stage) {
                    const stageKey = `stats.stagesReached.${data.stage}`;
                    const current = getGameState().get(stageKey) || 0;
                    getGameState().set(stageKey, current + 1);
                }
                break;
        }

        // Check achievements after recording event
        this.checkAchievements();
    }

    recordHatchEvent(data = {}, targetState = null) {
        const state = () => targetState || getGameState();
        const recordedHatchIds = state().get('stats.recordedHatchIds') || [];
        if (data.hatchId && recordedHatchIds.includes(data.hatchId)) return;
        const hatched = state().get('stats.creaturesHatched') || 0;
        state().set('stats.creaturesHatched', hatched + 1);
        if (data.hatchId) {
            state().set('stats.recordedHatchIds', [...recordedHatchIds, data.hatchId]);
        }
        if (data.rarity) {
            const rarityKey = `stats.${data.rarity}Hatched`;
            const rarityCount = state().get(rarityKey) || 0;
            state().set(rarityKey, rarityCount + 1);
        }
        if (data.species) {
            const species = state().get('stats.speciesDiscovered') || [];
            if (!species.includes(data.species)) {
                species.push(data.species);
                state().set('stats.speciesDiscovered', species);
            }
        }
    }

    recordLevelCompletedEvent(data = {}, targetState = null) {
        const state = () => targetState || getGameState();
        if (data.levelId) {
            state().set(`levels.${data.levelId}.completed`, true);
            if (data.noDamage) state().set(`levels.${data.levelId}.noDamageRun`, true);
            if (data.time && data.speedrunThreshold && data.time < data.speedrunThreshold) {
                state().set(`levels.${data.levelId}.speedrun`, true);
            }
        }
    }

    recordGuardianRestoredEvent(_data = {}, targetState = null) {
        const state = targetState || getGameState();
        const bosses = state.get('combat.bossesDefeated') || 0;
        state.set('combat.bossesDefeated', bosses + 1);
    }

    hasCompletionCalculationCatalogue() {
        try {
            if (JSON.stringify(Object.keys(this.definitions)) !== JSON.stringify(COMPLETION_CATALOGUE.map(item => item.id))) return false;
            return COMPLETION_CATALOGUE.every(item => {
                const fields = Object.getOwnPropertyDescriptors(this.definitions[item.id]);
                if (fields.getProgress?.value !== item.getProgress || !fields.getProgress.enumerable) return false;
                const data = {};
                for (const key of Reflect.ownKeys(fields)) {
                    if (['getProgress', 'progress', 'claimed'].includes(key)) continue;
                    if (typeof key !== 'string' || !fields[key].enumerable || !Object.hasOwn(fields[key], 'value')) return false;
                    Object.defineProperty(data, key, { value: fields[key].value, enumerable: true });
                }
                return JSON.stringify(copyDetachedJsonData(data)) === item.bytes;
            });
        } catch { return false; }
    }

    prepareLevelCompletionEventDraft(state, data, now, topology = null) {
        if (!Number.isSafeInteger(now) || now < 0 || !this.hasCompletionCalculationCatalogue()) {
            throw new Error('Achievement completion calculation is unavailable');
        }
        const original = topology || this.captureProgressTopology();
        const prepared = freezeDetachedJsonData(this.prepareProgressEventDraft(copyDetachedJsonData(state),
            copyDetachedJsonData(data), this.recordLevelCompletedEvent, now, original));
        completionEventDrafts.set(prepared, { manager: this, kind: 'level', topology: original, definitions: this.definitions, tiers: this.tiers,
            prepare: this.prepareProgressEventDraft, guardian: this.recordGuardianRestoredEvent,
            level: this.recordLevelCompletedEvent,
            check: this.checkAchievements, save: this.saveProgress, state: this.loadedGameState, epoch: this.loadedAdmissionEpoch });
        return prepared;
    }

    prepareGuardianCompletionEventDraft(state, now, topology = null) {
        if (!Number.isSafeInteger(now) || now < 0 || !this.hasCompletionCalculationCatalogue()) {
            throw new Error('Achievement Guardian calculation is unavailable');
        }
        const original = topology || this.captureProgressTopology();
        const input = copyDetachedJsonData(state), bosses = input.combat?.bossesDefeated;
        if (bosses != null && (typeof bosses !== 'number' || !Number.isFinite(bosses))) throw new Error('Completion Guardian count changed');
        const prepared = freezeDetachedJsonData(this.prepareProgressEventDraft(input, {},
            this.recordGuardianRestoredEvent, now, original));
        completionEventDrafts.set(prepared, { manager: this, kind: 'guardian', topology: original, definitions: this.definitions, tiers: this.tiers,
            prepare: this.prepareProgressEventDraft, guardian: this.recordGuardianRestoredEvent, level: this.recordLevelCompletedEvent,
            check: this.checkAchievements, save: this.saveProgress, state: this.loadedGameState, epoch: this.loadedAdmissionEpoch });
        return prepared;
    }

    // Each level keeps its actual before/after order using the issued detached
    // cache. Neither continuation reloads live progress or grants anything.
    continueCompletionGuardianEventDraft(previous, state, now) {
        return this.continueCompletionEventDraft(previous, state, {}, now, 'guardian');
    }

    continueCompletionLevelEventDraft(previous, state, data, now) {
        return this.continueCompletionEventDraft(previous, state, data, now, 'level');
    }

    continueCompletionEventDraft(previous, state, data, now, kind) {
        const owner = completionEventDrafts.get(previous);
        const current = () => owner?.manager === this && owner.topology.isCurrent() &&
            owner.kind === (kind === 'guardian' ? 'level' : 'guardian') &&
            window.AchievementSystem === this && getGameState() === owner.state && this.loadedGameState === owner.state &&
            this.loadedAdmissionEpoch === owner.epoch && this.definitions === owner.definitions && this.tiers === owner.tiers &&
            this.prepareProgressEventDraft === owner.prepare && this.recordGuardianRestoredEvent === owner.guardian &&
            this.recordLevelCompletedEvent === owner.level &&
            this.checkAchievements === owner.check && this.saveProgress === owner.save && this.hasCompletionCalculationCatalogue();
        if (!['guardian', 'level'].includes(kind) || !current() || !Number.isSafeInteger(now) || now < 0) throw new Error('Completion event source changed');
        const input = copyDetachedJsonData(state), saved = previous.state.achievements;
        const event = copyDetachedJsonData(data);
        if (kind === 'level' && (!event || !['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths', 'finalVoid'].includes(event.levelId) ||
            typeof event.noDamage !== 'boolean' || !Number.isFinite(event.time) || event.time < 0 || !Number.isFinite(event.speedrunThreshold) || event.speedrunThreshold < 0)) {
            throw new Error('Completion level event changed');
        }
        const matches = snapshot => Object.hasOwn(snapshot, 'achievements') === Object.hasOwn(previous.state, 'achievements') &&
            JSON.stringify(snapshot.achievements) === JSON.stringify(saved);
        const bosses = input.combat?.bossesDefeated;
        if (!matches(input) || (bosses != null && (typeof bosses !== 'number' || !Number.isFinite(bosses)))) {
            throw new Error('Completion Guardian input changed');
        }
        const relations = Object.fromEntries(Object.entries(previous.achievements).map(([id, entry]) => [id,
            Object.fromEntries(['progress', 'claimed'].map(key => [key, entry[key] === saved?.[id]?.[key]]))]));
        const topology = { isCurrent: current, matches, bind: (snapshot, definitions) => {
            for (const [id, fields] of Object.entries(relations)) for (const key of ['progress', 'claimed']) {
                if (fields[key]) definitions[id][key] = snapshot.achievements[id][key];
            }
        } };
        const detached = { initialized: true, definitions: Object.fromEntries(Object.entries(this.definitions).map(([id, definition]) => [id, {
            ...definition, progress: copyDetachedJsonData(previous.achievements[id].progress),
            claimed: copyDetachedJsonData(previous.achievements[id].claimed)
        }])), tiers: owner.tiers, pendingClaims: copyDetachedJsonData(previous.pendingClaims), events: this.events,
        checkAchievements: owner.check, saveProgress: owner.save };
        const result = owner.prepare.call(detached, input, event, kind === 'guardian' ? owner.guardian : owner.level, now, topology);
        if (!current()) throw new Error('Completion Guardian source changed');
        return freezeDetachedJsonData(result);
    }

    /** Prepare domain changes only. The naming transaction must own publication. */
    prepareHatchEventDraft(state, data = {}) {
        return this.prepareProgressEventDraft(state, data, this.recordHatchEvent);
    }

    // Loaded dictionaries may alias their own saved slots, or be separate after
    // a known publication. Equal bytes alone do not distinguish those cases.
    captureProgressTopology() {
        const state = this.loadedGameState, root = state?.state, definitions = this.definitions;
        if (!root) throw new Error('Achievement topology source is unavailable');
        const pins = [], canonicalSlots = new Map(), cacheSlots = new Map(), relations = {};
        const pin = (owner, key) => {
            const field = Object.getOwnPropertyDescriptor(owner, key);
            if (field && (!Object.hasOwn(field, 'value') || !field.enumerable)) throw new Error('Unsupported achievement slot');
            pins.push({ owner, key, field }); return field;
        };
        const savedField = pin(root, 'achievements'), saved = savedField?.value;
        const savedBytes = JSON.stringify(copyDetachedJsonData(savedField ? saved : {}));
        if (savedField && (!saved || typeof saved !== 'object' || Array.isArray(saved))) throw new Error('Unsupported achievement root');
        for (const [id, entry] of Object.entries(saved || {})) {
            pin(saved, id);
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Unsupported achievement entry');
            for (const key of ['progress', 'claimed']) {
                const field = pin(entry, key);
                if (field) {
                    copyDetachedJsonData(field.value);
                    if (!field.value || typeof field.value !== 'object' || Array.isArray(field.value) || canonicalSlots.has(field.value)) {
                        throw new Error('Unsupported cross-slot achievement alias');
                    }
                    canonicalSlots.set(field.value, `${id}:${key}`);
                }
            }
        }
        for (const [id, definition] of Object.entries(definitions)) {
            pin(definitions, id); relations[id] = {};
            for (const key of ['progress', 'claimed']) {
                const value = pin(definition, key)?.value, label = `${id}:${key}`;
                if (!value || typeof value !== 'object' || Array.isArray(value) || cacheSlots.has(value) ||
                    (canonicalSlots.has(value) && canonicalSlots.get(value) !== label)) throw new Error('Unsupported achievement cache alias');
                copyDetachedJsonData(value); cacheSlots.set(value, label);
                relations[id][key] = canonicalSlots.get(value) === label;
            }
        }
        const isCurrent = () => {
            try {
                return this.loadedGameState === state && state.state === root && this.definitions === definitions && pins.every(({ owner, key, field }) => {
                    const next = Object.getOwnPropertyDescriptor(owner, key);
                    return !field ? !next : Boolean(next) && ['value', 'get', 'set', 'enumerable', 'writable', 'configurable'].every(name => next[name] === field[name]);
                }) && JSON.stringify(copyDetachedJsonData(savedField ? root.achievements : {})) === savedBytes;
            } catch { return false; }
        };
        return { isCurrent, matches: snapshot => Object.hasOwn(snapshot, 'achievements') === Boolean(savedField) &&
            JSON.stringify(copyDetachedJsonData(savedField ? snapshot.achievements : {})) === savedBytes,
        bind: (snapshot, stagedDefinitions) => {
            for (const [id, fields] of Object.entries(relations)) for (const key of ['progress', 'claimed']) {
                if (fields[key]) stagedDefinitions[id][key] = snapshot.achievements[id][key];
            }
        } };
    }

    prepareProgressEventDraft(state, data, record, preparedNow, capturedTopology = null) {
        if (!this.initialized) throw new Error('Achievement progress has not been loaded');
        const topology = capturedTopology || this.captureProgressTopology();
        if (!topology.isCurrent() || !topology.matches(state)) throw new Error('Achievement topology source changed');
        const clone = value => JSON.parse(JSON.stringify(value));
        const stagedState = clone(state);
        const events = [];
        let saveRequests = 0;
        const target = {
            get: propertyPath => propertyPath
                ? propertyPath.split('.').reduce((value, key) => value?.[key], stagedState)
                : stagedState,
            set: (propertyPath, value) => {
                if (!propertyPath || ['__proto__', 'constructor', 'prototype']
                    .some(part => propertyPath.includes(part))) return;
                const keys = propertyPath.split('.');
                const last = keys.pop();
                let current = stagedState;
                for (const key of keys) {
                    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
                    current = current[key];
                }
                const oldValue = current[last];
                current[last] = value;
                events.push(clone({ kind: 'state', event: 'stateChanged', data: {
                    path: propertyPath, oldValue, newValue: value, timestamp: preparedNow === undefined ? Date.now() : preparedNow
                } }), clone({ kind: 'state', event: `changed:${propertyPath}`, data: value }));
            },
            save: () => { saveRequests += 1; events.push({ kind: 'save-request' }); }
        };
        if (preparedNow !== undefined) target.achievementNow = preparedNow;
        const staged = {
            definitions: Object.fromEntries(Object.entries(this.definitions).map(([id, definition]) => [id, {
                ...definition, progress: clone(definition.progress || {}), claimed: clone(definition.claimed || {})
            }])),
            tiers: this.tiers,
            pendingClaims: clone(this.pendingClaims),
            events: this.events
                ? { emit: (event, value) => events.push(clone({ kind: 'achievement', event, data: value })) }
                : null,
            checkAchievements: this.checkAchievements,
            saveProgress: this.saveProgress
        };
        topology.bind(stagedState, staged.definitions);
        record.call(staged, data, target);
        staged.checkAchievements(target);
        if (!topology.isCurrent()) throw new Error('Achievement topology source changed');
        const achievements = Object.fromEntries(Object.entries(staged.definitions).map(([id, definition]) => [id, {
            progress: definition.progress || {}, claimed: definition.claimed || {}
        }]));
        return copyDetachedJsonData({ state: stagedState, achievements,
            pendingClaims: staged.pendingClaims, events, saveRequests });
    }

    /** Own only the precomputed progress transition on this original loaded manager. */
    captureHatchProgressPublication() {
        const state = getGameState(), epoch = state.getSaveAdmission?.().epoch;
        if (!this.hasHatchProgressSource(state)) throw new Error('Achievement progress has not been loaded for this source');
        const definitions = this.definitions, ids = Object.keys(definitions), events = this.events;
        const tiers = this.tiers, tierBytes = JSON.stringify(tiers);
        const catalogue = ids.map(id => ({ definition: definitions[id], getProgress: definitions[id].getProgress,
            data: JSON.stringify({ ...definitions[id], progress: undefined, claimed: undefined }) }));
        const slots = ids.flatMap(id => ['progress', 'claimed'].map(key => ({
            owner: definitions[id], key, before: definitions[id][key], beforeBytes: JSON.stringify(definitions[id][key])
        })));
        slots.push({ owner: this, key: 'pendingClaims', before: this.pendingClaims,
            beforeBytes: JSON.stringify(this.pendingClaims) });
        slots.push({ owner: this, key: 'loadedAchievementsBytes', before: this.loadedAchievementsBytes,
            beforeBytes: JSON.stringify(this.loadedAchievementsBytes) });
        let cursor = 0, assigning = false, phase = 'captured', preparedCurrent = () => true;
        const matches = (slot, after) => slot.owner[slot.key] === (after ? slot.after : slot.before) &&
            JSON.stringify(slot.owner[slot.key]) === (after ? slot.afterBytes : slot.beforeBytes);
        const isCurrent = () => {
            try {
                return preparedCurrent() && this.initialized && this.loadedGameState === state && getGameState() === state && window.AchievementSystem === this &&
                    this.loadedAdmissionEpoch === epoch && state.getSaveAdmission?.().epoch === epoch &&
                    this.definitions === definitions && this.events === events &&
                    this.tiers === tiers && JSON.stringify(tiers) === tierBytes &&
                    JSON.stringify(Object.keys(definitions)) === JSON.stringify(ids) &&
                    ids.every((id, index) => definitions[id] === catalogue[index].definition &&
                        definitions[id].getProgress === catalogue[index].getProgress &&
                        JSON.stringify({ ...definitions[id], progress: undefined, claimed: undefined }) === catalogue[index].data) &&
                    slots.every((slot, index) => matches(slot, index < cursor) ||
                        (assigning && index === cursor && matches(slot, true)));
            } catch (error) { return false; }
        };
        return {
            isCurrent,
            isPublished: () => phase === 'published' && isCurrent(),
            prepare: prepared => {
                if (phase !== 'captured' || !isCurrent() || !Array.isArray(prepared?.pendingClaims) ||
                    JSON.stringify(Object.keys(prepared.achievements || {})) !== JSON.stringify(ids)) {
                    throw new Error('Prepared achievement publication is unavailable');
                }
                const clone = value => JSON.parse(JSON.stringify(value));
                for (let index = 0; index < slots.length; index++) {
                    const slot = slots[index];
                    const value = slot.owner === this
                        ? slot.key === 'pendingClaims' ? prepared.pendingClaims : JSON.stringify(prepared.state.achievements || {})
                        : prepared.achievements[ids[Math.floor(index / 2)]][slot.key];
                    slot.after = clone(value); slot.afterBytes = JSON.stringify(slot.after);
                }
                // These ordinary mutable copies are deliberately not aliases of
                // the save graph. Pin them separately before any slot is exposed.
                const nodes = [], seen = new Set();
                const pin = node => {
                    if (!node || typeof node !== 'object' || seen.has(node)) return;
                    seen.add(node);
                    nodes.push({ node, prototype: Object.getPrototypeOf(node), fields: Object.getOwnPropertyDescriptors(node), keys: Reflect.ownKeys(node) });
                    Object.values(node).forEach(pin);
                };
                slots.forEach(slot => pin(slot.after));
                preparedCurrent = () => nodes.every(({ node, prototype, fields, keys }) => {
                    const current = Object.getOwnPropertyDescriptors(node), next = Reflect.ownKeys(node);
                    return Object.isExtensible(node) && Object.getPrototypeOf(node) === prototype && next.length === keys.length &&
                        keys.every((key, index) => key === next[index] && ['value', 'get', 'set', 'enumerable', 'writable', 'configurable']
                            .every(name => Object.is(fields[key][name], current[key]?.[name])));
                });
                if (!isCurrent()) throw new Error('Achievement publication was retired');
                phase = 'prepared';
            },
            publish: () => {
                if (phase !== 'prepared' || !isCurrent()) throw new Error('Achievement publication was retired');
                phase = 'publishing';
                while (cursor < slots.length) {
                    if (!isCurrent()) throw new Error('Achievement publication was retired');
                    const slot = slots[cursor], previous = cursor;
                    assigning = true;
                    try { slot.owner[slot.key] = slot.after; }
                    finally {
                        try { if (matches(slot, true)) cursor += 1; }
                        finally { assigning = false; }
                    }
                    if (cursor === previous) throw new Error('Achievement publication did not complete');
                }
                phase = 'published';
            }
        };
    }

    /**
     * Listen to achievement events
     */
    on(event, callback, context) {
        if (this.events) {
            this.events.on(event, callback, context);
        }
    }

    /**
     * Remove event listener
     */
    off(event, callback, context) {
        if (this.events) {
            this.events.off(event, callback, context);
        }
    }

    /**
     * Reset all achievements (for testing)
     */
    resetAchievements() {
        Object.values(this.definitions).forEach(achievement => {
            achievement.progress = {};
            achievement.claimed = {};
        });

        this.pendingClaims = [];
        getGameState().set('achievements', {});

        devLog('[AchievementSystem] All achievements reset');
    }
}

// Export as singleton
const achievementSystem = new AchievementSystem();

if (typeof window !== 'undefined') {
    window.AchievementSystem = achievementSystem;
}

export default achievementSystem;
export { TIERS, CATEGORIES, ACHIEVEMENT_DEFINITIONS };

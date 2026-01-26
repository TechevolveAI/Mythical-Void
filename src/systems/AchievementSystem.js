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
        getProgress: (state) => {
            const hatchedAt = state.creature?.hatchedAt;
            if (!hatchedAt) return 0;
            const daysSinceHatch = Math.floor((Date.now() - hatchedAt) / (1000 * 60 * 60 * 24));
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
                description: 'Visit all biomes',
                requirement: 8,
                rewards: { coins: 150 }
            },
            PLATINUM: {
                description: 'Achieve 100% map discovery',
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
        name: 'Crystal Conqueror',
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
        name: 'Boss Slayer',
        category: 'COMBAT',
        hidden: false,
        tiers: {
            BRONZE: {
                description: 'Defeat your first boss',
                requirement: 1,
                rewards: { coins: 75 }
            },
            SILVER: {
                description: 'Defeat 3 bosses',
                requirement: 3,
                rewards: { coins: 150 }
            },
            GOLD: {
                description: 'Defeat 10 bosses',
                requirement: 10,
                rewards: { coins: 250, egg: 'uncommon' }
            },
            PLATINUM: {
                description: 'Defeat all bosses without taking damage',
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
            return state.stats?.totalCoinsEarned || state.player?.cosmicCoins || 0;
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
        this.loadProgress();

        this.initialized = true;
        devLog('[AchievementSystem] Initialized with', Object.keys(this.definitions).length, 'achievements');
    }

    /**
     * Load achievement progress from GameState
     */
    loadProgress() {
        const saved = getGameState().get('achievements') || {};

        // Merge saved progress into definitions
        Object.keys(this.definitions).forEach(id => {
            if (saved[id]) {
                this.definitions[id].progress = saved[id].progress || {};
                this.definitions[id].claimed = saved[id].claimed || {};
            } else {
                this.definitions[id].progress = {};
                this.definitions[id].claimed = {};
            }
        });
    }

    /**
     * Save achievement progress to GameState
     */
    saveProgress() {
        const toSave = {};

        Object.keys(this.definitions).forEach(id => {
            toSave[id] = {
                progress: this.definitions[id].progress || {},
                claimed: this.definitions[id].claimed || {}
            };
        });

        getGameState().set('achievements', toSave);
    }

    /**
     * Check all achievements and return newly unlocked ones
     * @returns {Array} Array of newly unlocked achievement tier objects
     */
    checkAchievements() {
        const newUnlocks = [];
        const gameState = getGameState().get();

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
                if (achievement.isSpecialProgress) {
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
                        unlockedAt: Date.now(),
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

                    devLog(`[AchievementSystem] Unlocked: ${achievement.name} (${tierKey})`);
                }
            });
        });

        // Save progress
        if (newUnlocks.length > 0) {
            this.saveProgress();

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
                const hatched = getGameState().get('stats.creaturesHatched') || 0;
                getGameState().set('stats.creaturesHatched', hatched + 1);

                // Track rarity
                if (data.rarity) {
                    const rarityKey = `stats.${data.rarity}Hatched`;
                    const rarityCount = getGameState().get(rarityKey) || 0;
                    getGameState().set(rarityKey, rarityCount + 1);
                }

                // Track species
                if (data.species) {
                    const species = getGameState().get('stats.speciesDiscovered') || [];
                    if (!species.includes(data.species)) {
                        species.push(data.species);
                        getGameState().set('stats.speciesDiscovered', species);
                    }
                }
                break;

            case 'enemy_defeated':
                const enemies = getGameState().get('combat.enemiesDefeated') || 0;
                getGameState().set('combat.enemiesDefeated', enemies + 1);
                break;

            case 'boss_defeated':
                const bosses = getGameState().get('combat.bossesDefeated') || 0;
                getGameState().set('combat.bossesDefeated', bosses + 1);
                break;

            case 'level_entered':
                if (data.levelId) {
                    getGameState().set(`levels.${data.levelId}.entered`, true);
                }
                break;

            case 'level_completed':
                if (data.levelId) {
                    getGameState().set(`levels.${data.levelId}.completed`, true);
                    if (data.noDamage) {
                        getGameState().set(`levels.${data.levelId}.noDamageRun`, true);
                    }
                    if (data.time && data.speedrunThreshold && data.time < data.speedrunThreshold) {
                        getGameState().set(`levels.${data.levelId}.speedrun`, true);
                    }
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

/**
 * AchievementSystem - Simplified achievement system for MVP
 * 8 basic achievements with simple unlocking logic
 */

class AchievementSystem {
    constructor() {
        this.initialized = false;
        this.achievements = {
            firstSteps: {
                id: 'firstSteps',
                name: 'First Steps',
                description: 'Move 100 units',
                icon: '🚶',
                reward: 25,
                unlocked: false,
                condition: (gameState) => gameState.world.currentPosition &&
                    (Math.abs(gameState.world.currentPosition.x - 800) > 50 ||
                     Math.abs(gameState.world.currentPosition.y - 600) > 50)
            },
            flowerFriend: {
                id: 'flowerFriend',
                name: 'Flower Friend',
                description: 'Interact with 5 flowers',
                icon: '🌸',
                reward: 50,
                unlocked: false,
                condition: (gameState) => (gameState.world.discoveredObjects.flowers || 0) >= 5
            },
            levelUp: {
                id: 'levelUp',
                name: 'Growing Strong',
                description: 'Reach level 2',
                icon: '⬆️',
                reward: 75,
                unlocked: false,
                condition: (gameState) => (gameState.creature.level || 1) >= 2
            },
            firstCare: {
                id: 'firstCare',
                name: 'Caring Owner',
                description: 'Care for your creature',
                icon: '❤️',
                reward: 50,
                unlocked: false,
                condition: (gameState) => gameState.creature.care &&
                    (gameState.creature.care.dailyCare.feedCount > 0 ||
                     gameState.creature.care.dailyCare.playCount > 0 ||
                     gameState.creature.care.dailyCare.restCount > 0)
            },
            happyCreature: {
                id: 'happyCreature',
                name: 'Happy Creature',
                description: 'Keep happiness above 80',
                icon: '😊',
                reward: 100,
                unlocked: false,
                condition: (gameState) => (gameState.creature.stats.happiness || 50) >= 80
            },
            explorer: {
                id: 'explorer',
                name: 'Explorer',
                description: 'Discover 10 different areas',
                icon: '🗺️',
                reward: 75,
                unlocked: false,
                condition: (gameState) => (gameState.world.visitedAreas || []).length >= 10
            },
            dedicatedPlayer: {
                id: 'dedicatedPlayer',
                name: 'Dedicated Player',
                description: 'Play for 10 minutes',
                icon: '⏰',
                reward: 100,
                unlocked: false,
                condition: (gameState) => (gameState.player.playTime || 0) >= 600000 // 10 minutes
            },
            creatureLover: {
                id: 'creatureLover',
                name: 'Creature Lover',
                description: 'Maintain a 3-day care streak',
                icon: '💕',
                reward: 150,
                unlocked: false,
                condition: (gameState) => (gameState.creature.care?.careStreak || 0) >= 3
            }
        };
    }

    /**
     * Initialize the achievement system
     */
    initialize() {
        if (this.initialized) return;

        // Load achievement progress from GameState
        const savedAchievements = GameState.get('achievements') || {};
        Object.keys(this.achievements).forEach(achievementId => {
            if (savedAchievements[achievementId]) {
                this.achievements[achievementId].unlocked = savedAchievements[achievementId].unlocked || false;
            }
        });

        this.initialized = true;
        console.log('[AchievementSystem] Initialized with', Object.keys(this.achievements).length, 'achievements');
    }

    /**
     * Check all achievements and unlock any that meet conditions
     */
    checkAchievements() {
        let newUnlocks = [];

        Object.values(this.achievements).forEach(achievement => {
            if (!achievement.unlocked) {
                const gameState = GameState.get();
                if (achievement.condition(gameState)) {
                    achievement.unlocked = true;
                    newUnlocks.push(achievement);

                    // Save to GameState
                    GameState.set(`achievements.${achievement.id}`, {
                        unlocked: true,
                        unlockedAt: Date.now()
                    });

                    console.log(`[AchievementSystem] Unlocked: ${achievement.name}`);
                }
            }
        });

        return newUnlocks;
    }

    /**
     * Get achievement by ID
     */
    getAchievement(id) {
        return this.achievements[id];
    }

    /**
     * Get all achievements
     */
    getAllAchievements() {
        return Object.values(this.achievements);
    }

    /**
     * Get unlocked achievements
     */
    getUnlockedAchievements() {
        return Object.values(this.achievements).filter(a => a.unlocked);
    }

    /**
     * Get locked achievements
     */
    getLockedAchievements() {
        return Object.values(this.achievements).filter(a => !a.unlocked);
    }

    /**
     * Get achievement progress percentage
     */
    getProgressPercentage() {
        const total = Object.keys(this.achievements).length;
        const unlocked = this.getUnlockedAchievements().length;
        return Math.round((unlocked / total) * 100);
    }

    /**
     * Reset all achievements (for testing)
     */
    resetAchievements() {
        Object.values(this.achievements).forEach(achievement => {
            achievement.unlocked = false;
        });
        GameState.set('achievements', {});
        console.log('[AchievementSystem] All achievements reset');
    }
}

// Export for use in other modules
window.AchievementSystem = new AchievementSystem();
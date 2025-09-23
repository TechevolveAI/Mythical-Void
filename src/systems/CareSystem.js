/**
 * CareSystem - High-level interface for creature care mechanics
 * Handles care actions, daily bonuses, and care status management
 */

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

class CareSystem {
    constructor() {
        this.initialized = false;
        this.careActions = {
            feed: {
                name: 'Feed',
                description: 'Give your creature food to increase happiness',
                happinessBonus: 15,
                dailyLimit: 3,
                icon: '🍎',
                cooldown: 0 // No cooldown between individual actions
            },
            play: {
                name: 'Play',
                description: 'Play with your creature to make it happy',
                happinessBonus: 10,
                dailyLimit: 2,
                icon: '🎾',
                cooldown: 0
            },
            rest: {
                name: 'Rest',
                description: 'Let your creature rest and recover',
                happinessBonus: 5,
                dailyLimit: -1, // Unlimited
                icon: '😴',
                cooldown: 30000 // 30 second cooldown between rests
            }
        };

        this.lastRestTime = 0;
    }

    /**
     * Initialize the care system
     */
    initialize() {
        if (this.initialized) return;

        console.log('[CareSystem] Initializing care system...');

        // Set up event listeners for GameState
        getGameState().on('careActionPerformed', (data) => {
            this.onCareActionPerformed(data);
        });

        this.initialized = true;
        console.log('[CareSystem] Care system initialized');
    }

    /**
     * Get current care status
     */
    getCareStatus() {
        return getGameState().getCareStatus();
    }

    /**
     * Check if a care action can be performed
     */
    canPerformAction(actionType) {
        if (!this.careActions[actionType]) return false;

        const status = this.getCareStatus();
        if (!status) return false;

        const action = this.careActions[actionType];

        // Check daily limit
        if (action.dailyLimit > 0) {
            const count = status.dailyCare[`${actionType}Count`];
            if (count >= action.dailyLimit) return false;
        }

        // Check cooldown for rest
        if (actionType === 'rest') {
            const now = Date.now();
            if (now - this.lastRestTime < action.cooldown) return false;
        }

        return true;
    }

    /**
     * Perform a care action with personality-based bonuses
     */
    async performCareAction(actionType, genetics = null) {
        if (!this.canPerformAction(actionType)) {
            return { success: false, reason: 'Action not available' };
        }

        // Calculate personality-based bonus
        const personalityBonus = this.calculatePersonalityBonus(actionType, genetics);
        const baseBonusHappiness = this.careActions[actionType].happinessBonus;
        const totalHappinessBonus = Math.round(baseBonusHappiness * personalityBonus.multiplier);

        const success = getGameState().performCareAction(actionType, totalHappinessBonus);

        if (success) {
            if (actionType === 'rest') {
                this.lastRestTime = Date.now();
            }

            console.log(`care:debug [CareSystem] ${actionType} performed with personality bonus:`, {
                baseBonus: baseBonusHappiness,
                personalityMultiplier: personalityBonus.multiplier.toFixed(2),
                totalBonus: totalHappinessBonus,
                reason: personalityBonus.reason
            });

            return {
                success: true,
                action: actionType,
                happinessBonus: totalHappinessBonus,
                personalityBonus: personalityBonus,
                message: this.getPersonalizedCareMessage(actionType, genetics, personalityBonus)
            };
        }

        return { success: false, reason: 'Action failed' };
    }

    /**
     * Calculate personality-based bonus multiplier for care actions
     */
    calculatePersonalityBonus(actionType, genetics) {
        if (!genetics || !genetics.personality) {
            return { multiplier: 1.0, reason: 'no genetics data' };
        }

        const personality = genetics.personality;
        const carePreferences = personality.carePreferences || {};
        const preference = carePreferences[actionType] || 1.0;

        // Base multiplier from care preferences (0.6x to 1.3x)
        let multiplier = preference;

        // Additional bonuses based on personality traits
        const bonusReasons = [];

        if (personality.core === 'playful' && actionType === 'play') {
            multiplier += 0.2;
            bonusReasons.push('playful nature');
        }

        if (personality.core === 'gentle' && (actionType === 'pet' || actionType === 'clean')) {
            multiplier += 0.15;
            bonusReasons.push('gentle soul');
        }

        if (personality.core === 'energetic' && (actionType === 'play' || actionType === 'feed')) {
            multiplier += 0.15;
            bonusReasons.push('high energy');
        }

        if (personality.core === 'wise' && actionType === 'rest') {
            multiplier += 0.1;
            bonusReasons.push('wisdom values rest');
        }

        if (personality.core === 'curious' && actionType === 'photo') {
            multiplier += 0.2;
            bonusReasons.push('loves capturing discoveries');
        }

        // Cosmic affinity bonuses
        if (genetics.cosmicAffinity) {
            const element = genetics.cosmicAffinity.element;
            const powerLevel = genetics.cosmicAffinity.powerLevel;

            if (element === 'star' && actionType === 'feed') {
                multiplier += 0.1 * powerLevel;
                bonusReasons.push('stellar energy affinity');
            }

            if (element === 'moon' && actionType === 'rest') {
                multiplier += 0.15 * powerLevel;
                bonusReasons.push('lunar cycle connection');
            }

            if (element === 'nebula' && actionType === 'play') {
                multiplier += 0.12 * powerLevel;
                bonusReasons.push('nebula dance affinity');
            }

            if (element === 'crystal' && actionType === 'clean') {
                multiplier += 0.1 * powerLevel;
                bonusReasons.push('crystal resonance cleansing');
            }
        }

        // Apply rarity bonus
        const rarityMultipliers = {
            common: 1.0,
            uncommon: 1.05,
            rare: 1.1,
            legendary: 1.15
        };

        multiplier *= (rarityMultipliers[genetics.rarity] || 1.0);
        if (genetics.rarity !== 'common') {
            bonusReasons.push(`${genetics.rarity} rarity`);
        }

        // Clamp multiplier to reasonable range
        multiplier = Math.max(0.5, Math.min(2.0, multiplier));

        return {
            multiplier,
            reason: bonusReasons.length > 0 ? bonusReasons.join(', ') : 'personality preference',
            basePreference: preference,
            bonuses: bonusReasons
        };
    }

    /**
     * Get personalized care action message
     */
    getPersonalizedCareMessage(actionType, genetics, personalityBonus) {
        if (!genetics) {
            return `Your creature enjoyed the ${actionType}!`;
        }

        const species = genetics.species;
        const personality = genetics.personality.core;
        const rarity = genetics.rarity;

        const messages = {
            feed: {
                high: `Your ${rarity} ${species} absolutely loves these cosmic nutrients! Their ${personality} nature shines through their delight.`,
                medium: `Your ${species} enjoys the meal, especially with their ${personality} personality.`,
                low: `Your ${species} accepts the food, though it's not their favorite activity.`
            },
            play: {
                high: `Your ${species} is overjoyed! This ${actionType} perfectly matches their ${personality} spirit and ${rarity} energy.`,
                medium: `Your ${species} has fun playing, their ${personality} nature coming through.`,
                low: `Your ${species} plays along, though they might prefer other activities.`
            },
            pet: {
                high: `Your ${species} melts into your touch! Their ${personality} soul craves this affection.`,
                medium: `Your ${species} enjoys the gentle attention, purring contentedly.`,
                low: `Your ${species} tolerates the petting, though they seem somewhat indifferent.`
            },
            rest: {
                high: `Your ${species} settles into perfect peaceful sleep, their ${personality} nature finding deep comfort.`,
                medium: `Your ${species} rests comfortably, their ${personality} energy recharging.`,
                low: `Your ${species} rests, though they seem restless and might prefer activity.`
            },
            clean: {
                high: `Your ${species} absolutely loves the cosmic cleansing! Their ${personality} nature appreciates the purity.`,
                medium: `Your ${species} enjoys the refreshing cleaning session.`,
                low: `Your ${species} endures the cleaning, though they don't seem particularly enthusiastic.`
            },
            photo: {
                high: `Your ${species} poses beautifully! Their ${personality} personality loves being captured in this moment.`,
                medium: `Your ${species} poses nicely, their ${personality} nature showing through.`,
                low: `Your ${species} sits still for the photo, though they seem eager to move on.`
            }
        };

        const actionMessages = messages[actionType];
        if (!actionMessages) {
            return `Your ${species} reacted to the ${actionType}!`;
        }

        // Select message based on personality bonus strength
        if (personalityBonus.multiplier >= 1.3) {
            return actionMessages.high;
        } else if (personalityBonus.multiplier >= 1.0) {
            return actionMessages.medium;
        } else {
            return actionMessages.low;
        }
    }

    /**
     * Get daily login bonus information
     */
    getDailyLoginBonus() {
        return getGameState().getDailyLoginBonus();
    }

    /**
     * Claim daily login bonus
     */
    claimDailyLoginBonus() {
        return getGameState().claimDailyLoginBonus();
    }

    /**
     * Get care action information for UI
     */
    getCareActionInfo(actionType) {
        const action = this.careActions[actionType];
        const status = this.getCareStatus();

        if (!action || !status) return null;

        const count = status.dailyCare[`${actionType}Count`];
        const limit = action.dailyLimit;
        const canPerform = this.canPerformAction(actionType);

        return {
            ...action,
            currentCount: count,
            limit: limit,
            remaining: limit > 0 ? Math.max(0, limit - count) : 'unlimited',
            canPerform: canPerform,
            isUnlimited: limit === -1
        };
    }

    /**
     * Get all care actions info for UI
     */
    getAllCareActionsInfo() {
        const actions = {};
        Object.keys(this.careActions).forEach(actionType => {
            actions[actionType] = this.getCareActionInfo(actionType);
        });
        return actions;
    }

    /**
     * Get happiness level description
     */
    getHappinessDescription(happiness) {
        if (happiness >= 80) return { level: 'ecstatic', description: 'Your creature is very happy!', color: '#FFD700' };
        if (happiness >= 65) return { level: 'happy', description: 'Your creature is happy!', color: '#90EE90' };
        if (happiness >= 50) return { level: 'content', description: 'Your creature is content.', color: '#87CEEB' };
        if (happiness >= 35) return { level: 'tired', description: 'Your creature seems tired.', color: '#FFA500' };
        if (happiness >= 20) return { level: 'unhappy', description: 'Your creature is unhappy.', color: '#FF6347' };
        return { level: 'miserable', description: 'Your creature is miserable.', color: '#DC143C' };
    }

    /**
     * Get care streak information
     */
    getCareStreakInfo() {
        const status = this.getCareStatus();
        if (!status) return null;

        const streak = status.careStreak;
        let description = '';
        let reward = '';

        if (streak === 0) {
            description = 'Start caring for your creature daily!';
            reward = 'Begin your care streak';
        } else if (streak < 3) {
            description = `You've cared for your creature for ${streak} day${streak > 1 ? 's' : ''} in a row!`;
            reward = 'Keep it up!';
        } else if (streak < 7) {
            description = `${streak} day care streak! Your creature loves the attention!`;
            reward = 'Small happiness bonus every day';
        } else if (streak < 14) {
            description = `Amazing ${streak} day streak! Your bond is growing stronger!`;
            reward = 'Increased happiness from care actions';
        } else {
            description = `Incredible ${streak} day care streak! You have an unbreakable bond!`;
            reward = 'Maximum happiness bonuses';
        }

        return {
            streak: streak,
            description: description,
            reward: reward,
            isActive: streak > 0
        };
    }

    /**
     * Get care recommendations based on current status
     */
    getCareRecommendations() {
        const status = this.getCareStatus();
        if (!status) return [];

        const recommendations = [];

        // Happiness-based recommendations
        if (status.happiness < 50) {
            recommendations.push({
                type: 'urgent',
                message: 'Your creature is unhappy! Care for it immediately.',
                actions: ['feed', 'play']
            });
        } else if (status.happiness < 80) {
            recommendations.push({
                type: 'normal',
                message: 'Your creature would appreciate some care.',
                actions: ['feed', 'play', 'rest']
            });
        }

        // Daily limit recommendations
        if (status.dailyCare.feedCount < 3) {
            recommendations.push({
                type: 'normal',
                message: `You can feed your creature ${3 - status.dailyCare.feedCount} more time${3 - status.dailyCare.feedCount > 1 ? 's' : ''} today.`,
                actions: ['feed']
            });
        }

        if (status.dailyCare.playCount < 2) {
            recommendations.push({
                type: 'normal',
                message: `You can play with your creature ${2 - status.dailyCare.playCount} more time${2 - status.dailyCare.playCount > 1 ? 's' : ''} today.`,
                actions: ['play']
            });
        }

        // Streak recommendations
        const streakInfo = this.getCareStreakInfo();
        if (streakInfo && streakInfo.streak > 0) {
            recommendations.push({
                type: 'normal',
                message: streakInfo.description,
                actions: ['feed', 'play', 'rest']
            });
        }

        return recommendations;
    }

    /**
     * Handle care action performed event
     */
    onCareActionPerformed(data) {
        console.log(`[CareSystem] Care action performed: ${data.action} (+${data.happinessBonus} happiness)`);

        // Could trigger additional effects here:
        // - Achievement progress
        // - Visual effects
        // - Sound effects
        // - Tutorial progress
    }

    /**
     * Get care statistics for analytics
     */
    getCareStatistics() {
        const status = this.getCareStatus();
        const dailyBonus = this.getDailyLoginBonus();

        if (!status) return null;

        return {
            happiness: status.happiness,
            happinessLevel: status.happinessLevel,
            careStreak: status.careStreak,
            dailyCare: status.dailyCare,
            dailyBonusAvailable: dailyBonus.available,
            dailyBonusStreak: dailyBonus.streak,
            lastCareTime: status.lastCareTime
        };
    }

    /**
     * Reset daily care counters (for testing or admin purposes)
     */
    resetDailyCounters() {
        getGameState().set('creature.care.dailyCare', {
            feedCount: 0,
            playCount: 0,
            restCount: 0,
            lastReset: Date.now()
        });
        console.log('[CareSystem] Daily care counters reset');
    }
}

// Export for use in other modules
window.CareSystem = new CareSystem();

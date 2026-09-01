import {
    getCreatureCareProfile,
    getCreatureCareReaction
} from './CreatureCareVoice.js';
import { getVillageGameplayEffects } from './VillageSettlement.js';

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
                description: 'Share a field ration to steady the creature’s strength',
                happinessBonus: 15,
                dailyLimit: 3,
                icon: '🍎',
                cooldown: 0 // No cooldown between individual actions
            },
            play: {
                name: 'Play',
                description: 'Run a movement exercise chosen for this companion',
                happinessBonus: 10,
                dailyLimit: 2,
                icon: '🎾',
                cooldown: 0
            },
            rest: {
                name: 'Rest',
                description: 'Pause together for a quiet recovery cycle',
                happinessBonus: 5,
                dailyLimit: -1, // Unlimited
                icon: '😴',
                cooldown: 30000 // 30 second cooldown between rests
            },
            pet: {
                name: 'Connect',
                description: 'Share a calm moment with your companion',
                happinessBonus: 8,
                dailyLimit: -1,
                icon: '◇',
                cooldown: 5000
            }
        };

        this.lastActionTimes = {};
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

        // Check action cooldowns (affected by Time Warp ability)
        if (action.cooldown > 0) {
            const now = Date.now();
            let effectiveCooldown = action.cooldown;

            // Apply ability cooldown reduction (e.g., Time Warp: 50% reduction)
            const cooldownReduction = window.SecretAbilityManager?.getSanctuaryModifiers?.()?.cooldownReduction || 1;
            effectiveCooldown = Math.round(effectiveCooldown * cooldownReduction);

            if (now - (this.lastActionTimes[actionType] || 0) < effectiveCooldown) return false;
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
        let totalHappinessBonus = Math.round(baseBonusHappiness * personalityBonus.multiplier);
        let villageBonus = 0;
        let heartCareBonus = 0;

        if (actionType === 'feed') {
            const villageEffects = getVillageGameplayEffects(getGameState());
            villageBonus = villageEffects.feedHappinessBonus;
            heartCareBonus = villageEffects.heartCareBonus;
            totalHappinessBonus += villageBonus;
        }

        // Apply ability bonus (e.g., Gentle Aura: +50% care effectiveness)
        if (window.SecretAbilityManager?.applyCareBonus) {
            totalHappinessBonus = window.SecretAbilityManager.applyCareBonus(totalHappinessBonus);
        }

        const success = getGameState().performCareAction(actionType, totalHappinessBonus);

        if (success) {
            this.lastActionTimes[actionType] = Date.now();
            const careMoment = this.getCareMomentContext(actionType, genetics);

            // Play appropriate sound effect for the care action
            this.playCareSound(actionType);

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
                villageBonus,
                heartCareBonus,
                personalityBonus: personalityBonus,
                careMoment,
                message: this.getPersonalizedCareMessage(
                    actionType,
                    genetics,
                    careMoment
                )
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
    getPersonalizedCareMessage(actionType, genetics, careMoment = null) {
        return getCreatureCareReaction(actionType, genetics, careMoment || {});
    }

    getCareSignal(genetics = null) {
        const profile = getCreatureCareProfile(genetics);
        const status = this.getCareStatus();
        const history = getGameState().get('creature.care.careHistory') || [];
        const recentActions = history
            .slice(-2)
            .map(entry => entry?.action)
            .filter(Boolean);
        const energy = Number(
            getGameState().get('creature.stats.energy')
        );
        let recommendedAction = profile.preferredAction;
        let needLabel = 'NATURAL RHYTHM';
        let reason = profile.observation;

        if (Number.isFinite(energy) && energy <= 35) {
            recommendedAction = 'rest';
            needLabel = 'RECOVERY REQUEST';
            reason = 'Energy is low enough that quiet recovery should come before another activity.';
        } else if (
            recentActions.length === 2 &&
            recentActions.every(action => action === recentActions[0])
        ) {
            recommendedAction = recentActions[0] === profile.secondaryAction
                ? profile.preferredAction
                : profile.secondaryAction;
            needLabel = 'VARIATION REQUEST';
            reason = 'The same care rhythm was repeated; this companion is asking for a different rhythm.';
        } else if (Number(status?.happiness) < 65) {
            needLabel = 'CONNECTION REQUEST';
            reason = 'The creature is calmer and responds best to its natural care rhythm.';
        } else if (Number(status?.happiness) >= 90) {
            needLabel = 'STEADY AGAIN';
            reason = 'The companion is steady; care is optional and never an obligation.';
        }

        return {
            ...profile,
            recommendedAction,
            needLabel,
            reason
        };
    }

    getCareMomentContext(actionType, genetics = null) {
        const history = getGameState().get('creature.care.careHistory') || [];
        const actions = history.map(entry => entry?.action).filter(Boolean);
        let consecutiveActionCount = 0;
        for (let index = actions.length - 1; index >= 0; index -= 1) {
            if (actions[index] !== actionType) break;
            consecutiveActionCount += 1;
        }
        const profile = getCreatureCareProfile(genetics);
        const status = this.getCareStatus();

        return {
            actionCount: actions.filter(action => action === actionType).length,
            consecutiveActionCount,
            isPreferred: profile.preferredAction === actionType,
            happiness: Number(status?.happiness),
            energy: Number(getGameState().get('creature.stats.energy'))
        };
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
    getCareActionInfo(actionType, genetics = null) {
        const action = this.careActions[actionType];
        const status = this.getCareStatus();

        if (!action || !status) return null;

        const count = status.dailyCare[`${actionType}Count`];
        const limit = action.dailyLimit;
        const canPerform = this.canPerformAction(actionType);
        const signal = this.getCareSignal(genetics);

        return {
            ...action,
            currentCount: count,
            limit: limit,
            remaining: limit > 0 ? Math.max(0, limit - count) : 'unlimited',
            canPerform: canPerform,
            isUnlimited: limit === -1,
            isPreferred: signal.preferredAction === actionType,
            isRecommended: signal.recommendedAction === actionType
        };
    }

    /**
     * Get all care actions info for UI
     */
    getAllCareActionsInfo(genetics = null) {
        const actions = {};
        Object.keys(this.careActions).forEach(actionType => {
            actions[actionType] = this.getCareActionInfo(actionType, genetics);
        });
        return actions;
    }

    /**
     * Get happiness level description
     */
    getHappinessDescription(happiness) {
        if (happiness >= 80) return { level: 'resonant', description: 'Companion creature is bright and responsive.', color: '#FFD700' };
        if (happiness >= 65) return { level: 'steady', description: 'Companion creature is steady.', color: '#90EE90' };
        if (happiness >= 50) return { level: 'settled', description: 'Companion creature is settled.', color: '#87CEEB' };
        if (happiness >= 35) return { level: 'quiet', description: 'Companion creature is quiet.', color: '#FFA500' };
        if (happiness >= 20) return { level: 'withdrawn', description: 'Companion is keeping close to the Sanctuary.', color: '#FF8A8A' };
        return { level: 'recovering', description: 'Companion is in a protected recovery cycle.', color: '#C78BFF' };
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
            description = 'No shared care cycle recorded yet.';
            reward = 'Care remains optional';
        } else if (streak < 3) {
            description = `${streak} shared care day${streak > 1 ? 's' : ''} recorded.`;
            reward = 'A small field record is forming';
        } else if (streak < 7) {
            description = `${streak} shared care days have revealed a recognizable rhythm.`;
            reward = 'Care responses become easier to read';
        } else if (streak < 14) {
            description = `${streak} shared care days are logged in the companion record.`;
            reward = 'The bond record holds more context';
        } else {
            description = `${streak} shared care days show a long-running partnership.`;
            reward = 'The complete care rhythm is legible';
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
                type: 'normal',
                message: 'Companion creature is quiet. Choose a care action when you are ready.',
                actions: ['feed', 'play']
            });
        } else if (status.happiness < 80) {
            recommendations.push({
                type: 'normal',
                message: 'A shared care cycle could make the creature’s needs easier to read.',
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
            petCount: 0,
            restCount: 0,
            lastReset: Date.now()
        });
        console.log('[CareSystem] Daily care counters reset');
    }

    /**
     * Play appropriate sound effect for care action
     */
    playCareSound(actionType) {
        if (!window.AudioManager) return;

        try {
            switch (actionType) {
                case 'feed':
                    window.AudioManager.playFeed?.();
                    break;
                case 'play':
                    window.AudioManager.playPlay?.();
                    break;
                case 'pet':
                    window.AudioManager.playPet?.();
                    break;
                case 'rest':
                    // Soft, calming sound for rest
                    window.AudioManager.playButtonClick?.();
                    break;
                default:
                    window.AudioManager.playButtonClick?.();
            }
        } catch (error) {
            console.warn('[CareSystem] Failed to play care sound:', error);
        }
    }
}

// Export for use in other modules
window.CareSystem = new CareSystem();

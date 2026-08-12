/**
 * RerollSystem - Manages creature reroll mechanics
 * Features: One free reroll per hatch, reroll history tracking
 */

class RerollSystem {
    constructor() {
        this.currentRerollState = null;
    }

    /**
     * Initialize reroll tracking for player
     */
    initializeRerollData() {
        return {
            freeRerollsAvailable: 1,  // Always 1 per hatch
            totalRerolls: 0,
            successfulRerolls: 0,      // Rerolls that resulted in better rarity
            rerollHistory: [],         // Last 20 rerolls
            lastRerollTime: null
        };
    }

    /**
     * Start a new hatch session (reset reroll state)
     */
    startHatchSession(creature) {
        this.currentRerollState = {
            originalCreature: creature,
            rerollAvailable: true,
            hasRerolled: false,
            rerolledCreature: null
        };

        console.log('[RerollSystem] New hatch session started, reroll available');
        return this.currentRerollState;
    }

    /**
     * Check if reroll is available
     */
    canReroll() {
        if (!this.currentRerollState) {
            console.warn('[RerollSystem] No active hatch session');
            return false;
        }

        return this.currentRerollState.rerollAvailable && !this.currentRerollState.hasRerolled;
    }

    /**
     * Perform reroll (returns true if allowed)
     */
    executeReroll() {
        if (!this.canReroll()) {
            console.warn('[RerollSystem] Reroll not available');
            return false;
        }

        console.log('[RerollSystem] 🔄 Reroll executed!');

        this.currentRerollState.hasRerolled = true;
        this.currentRerollState.rerollAvailable = false;

        return true;
    }

    /**
     * Set the rerolled creature
     */
    setRerolledCreature(creature) {
        if (!this.currentRerollState) {
            console.warn('[RerollSystem] No active hatch session');
            return;
        }

        this.currentRerollState.rerolledCreature = creature;
        console.log('[RerollSystem] Rerolled creature set:', creature.rarity);
    }

    /**
     * Get the final creature (original or rerolled)
     */
    getFinalCreature() {
        if (!this.currentRerollState) return null;

        if (this.currentRerollState.hasRerolled && this.currentRerollState.rerolledCreature) {
            return this.currentRerollState.rerolledCreature;
        }

        return this.currentRerollState.originalCreature;
    }

    /**
     * Track reroll result for statistics
     */
    trackReroll(originalRarity, newRarity, rerollData) {
        const rarityValues = {
            common: 1,
            uncommon: 2,
            rare: 3,
            epic: 4,
            legendary: 5
        };

        const originalValue = rarityValues[originalRarity] || 0;
        const newValue = rarityValues[newRarity] || 0;
        const wasSuccessful = newValue > originalValue;

        rerollData.totalRerolls++;
        if (wasSuccessful) {
            rerollData.successfulRerolls++;
        }

        rerollData.rerollHistory.push({
            originalRarity,
            newRarity,
            wasSuccessful,
            improvement: newValue - originalValue,
            timestamp: Date.now()
        });

        // Keep only last 20 rerolls
        if (rerollData.rerollHistory.length > 20) {
            rerollData.rerollHistory.shift();
        }

        rerollData.lastRerollTime = Date.now();

        console.log(`[RerollSystem] Tracked reroll: ${originalRarity} → ${newRarity} (${wasSuccessful ? 'Success!' : 'Worse/Same'})`);

        return rerollData;
    }

    /**
     * Get reroll success rate
     */
    getSuccessRate(rerollData) {
        if (!rerollData || rerollData.totalRerolls === 0) return 0;
        return (rerollData.successfulRerolls / rerollData.totalRerolls * 100).toFixed(1);
    }

    /**
     * Get reroll advice based on current rarity
     */
    getRerollAdvice(rarity) {
        const advice = {
            common: {
                recommend: true,
                message: "75% chance of a less common variation.",
                odds: "75% chance to read Uncommon or above."
            },
            uncommon: {
                recommend: true,
                message: "40% chance of a rarer variation.",
                odds: "40% chance to read Rare or above."
            },
            rare: {
                recommend: false,
                message: "25% chance of a rarer variation.",
                odds: "25% chance to read Epic or Legendary."
            },
            epic: {
                recommend: false,
                message: "2% chance of a Legendary variation.",
                odds: "Most rescans will read a more common variation."
            },
            legendary: {
                recommend: false,
                message: "Current reading is the rarest variation.",
                odds: "A rescan cannot improve this classification."
            }
        };

        return advice[rarity] || advice.common;
    }

    /**
     * Format reroll history for display
     */
    formatRerollHistory(rerollData) {
        if (!rerollData || !rerollData.rerollHistory || rerollData.rerollHistory.length === 0) {
            return 'No reroll history yet.';
        }

        const recentRerolls = rerollData.rerollHistory.slice(-5).reverse();
        return recentRerolls.map(r => {
            const arrow = r.wasSuccessful ? '⬆️' : (r.improvement < 0 ? '⬇️' : '➡️');
            return `${arrow} ${r.originalRarity} → ${r.newRarity}`;
        }).join('\n');
    }

    /**
     * Reset current session (call after creature is saved)
     */
    endHatchSession() {
        console.log('[RerollSystem] Hatch session ended');
        this.currentRerollState = null;
    }

    /**
     * Calculate reroll statistics
     */
    calculateStats(rerollData) {
        if (!rerollData || rerollData.totalRerolls === 0) {
            return {
                totalRerolls: 0,
                successRate: 0,
                averageImprovement: 0,
                bestReroll: null
            };
        }

        let totalImprovement = 0;
        let bestReroll = null;
        let maxImprovement = -999;

        rerollData.rerollHistory.forEach(r => {
            totalImprovement += r.improvement;
            if (r.improvement > maxImprovement) {
                maxImprovement = r.improvement;
                bestReroll = `${r.originalRarity} → ${r.newRarity}`;
            }
        });

        return {
            totalRerolls: rerollData.totalRerolls,
            successRate: this.getSuccessRate(rerollData),
            averageImprovement: (totalImprovement / rerollData.rerollHistory.length).toFixed(2),
            bestReroll
        };
    }
}

// Create singleton
window.RerollSystem = RerollSystem;
window.rerollSystem = new RerollSystem();

// Export for Jest testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RerollSystem;
}

console.log('✅ [RerollSystem] Reroll system loaded');

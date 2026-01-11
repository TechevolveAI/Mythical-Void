/**
 * NatureAttunementSystem - Tracks player's connection to nature through interactions
 *
 * Nature Elements:
 * - Flowers: Smell, admire (+1 attunement each)
 * - Crystals: Meditate near, absorb energy (+2 attunement)
 * - Water: Reflect, listen to sounds (+1 attunement)
 * - Trees: Rest under, commune (+2 attunement)
 * - Fauna: Observe wildlife (+1 attunement)
 *
 * Milestones unlock both cosmetic and functional rewards
 */

class NatureAttunementSystem {
    constructor() {
        this.initialized = false;

        // Nature element types and their attunement values
        this.elementTypes = {
            flower: { points: 1, action: 'Smelled a flower', icon: '🌸' },
            crystal: { points: 2, action: 'Absorbed crystal energy', icon: '💎' },
            water: { points: 1, action: 'Listened to water', icon: '💧' },
            tree: { points: 2, action: 'Rested under a tree', icon: '🌳' },
            fauna: { points: 1, action: 'Observed wildlife', icon: '🦋' },
            mushroom: { points: 1, action: 'Examined a mushroom', icon: '🍄' },
            starlight: { points: 3, action: 'Bathed in starlight', icon: '✨' }
        };

        // Milestone definitions with rewards
        this.milestones = [
            {
                level: 1,
                name: 'Nature Curious',
                attunementRequired: 5,
                rewards: {
                    cosmetic: { title: 'Nature Curious', color: '#90EE90' },
                    functional: { statBonusPercent: 2, type: 'happiness' }
                }
            },
            {
                level: 2,
                name: 'Forest Friend',
                attunementRequired: 15,
                rewards: {
                    cosmetic: { auraColor: '#228B22', auraIntensity: 0.1 },
                    functional: { statBonusPercent: 5, type: 'energy' }
                }
            },
            {
                level: 3,
                name: 'Grove Guardian',
                attunementRequired: 35,
                rewards: {
                    cosmetic: { particleEffect: 'nature_sparkles' },
                    functional: { cooldownReduction: 10, type: 'timeSlow' }
                }
            },
            {
                level: 4,
                name: 'Nature Sage',
                attunementRequired: 60,
                rewards: {
                    cosmetic: { titleGlow: true, crownEffect: 'leaf_crown' },
                    functional: { statBonusPercent: 10, type: 'all' }
                }
            },
            {
                level: 5,
                name: 'Primordial Spirit',
                attunementRequired: 100,
                rewards: {
                    cosmetic: { fullAura: 'nature_spirit', titleColor: '#FFD700' },
                    functional: {
                        unlockAbility: 'natureSurge',
                        statBonusPercent: 15,
                        type: 'all'
                    }
                }
            }
        ];

        // Daily interaction limits (prevents grinding)
        this.dailyLimits = {
            flower: 10,
            crystal: 5,
            water: 8,
            tree: 5,
            fauna: 8,
            mushroom: 6,
            starlight: 3
        };

        // Event listeners
        this.eventListeners = new Map();
    }

    /**
     * Initialize the system
     */
    init() {
        if (this.initialized) return;
        console.log('[NatureAttunementSystem] Initializing...');

        // Load saved state from GameState
        this.loadState();

        this.initialized = true;
    }

    /**
     * Load saved attunement state
     */
    loadState() {
        if (!window.GameState) return;

        // Initialize default state if not exists
        if (!window.GameState.get('nature.attunement')) {
            window.GameState.set('nature.attunement', 0);
            window.GameState.set('nature.currentLevel', 0);
            window.GameState.set('nature.interactions', {});
            window.GameState.set('nature.dailyInteractions', {});
            window.GameState.set('nature.lastDailyReset', Date.now());
            window.GameState.set('nature.unlockedRewards', []);
        }

        // Check for daily reset
        this.checkDailyReset();
    }

    /**
     * Check if daily interaction limits should reset
     */
    checkDailyReset() {
        const lastReset = window.GameState?.get('nature.lastDailyReset') || 0;
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (now - lastReset >= oneDayMs) {
            window.GameState?.set('nature.dailyInteractions', {});
            window.GameState?.set('nature.lastDailyReset', now);
            console.log('[NatureAttunementSystem] Daily interaction limits reset');
        }
    }

    /**
     * Get current attunement level
     */
    getAttunement() {
        return window.GameState?.get('nature.attunement') || 0;
    }

    /**
     * Get current milestone level
     */
    getCurrentLevel() {
        return window.GameState?.get('nature.currentLevel') || 0;
    }

    /**
     * Get next milestone
     */
    getNextMilestone() {
        const currentLevel = this.getCurrentLevel();
        if (currentLevel >= this.milestones.length) {
            return null; // Max level reached
        }
        return this.milestones[currentLevel];
    }

    /**
     * Get progress to next milestone (0-1)
     */
    getProgressToNextMilestone() {
        const currentAttunement = this.getAttunement();
        const nextMilestone = this.getNextMilestone();

        if (!nextMilestone) return 1; // Max level

        const currentLevelReq = this.getCurrentLevel() > 0
            ? this.milestones[this.getCurrentLevel() - 1].attunementRequired
            : 0;
        const nextLevelReq = nextMilestone.attunementRequired;

        return Math.min(1, (currentAttunement - currentLevelReq) / (nextLevelReq - currentLevelReq));
    }

    /**
     * Check if daily limit reached for element type
     */
    canInteract(elementType) {
        this.checkDailyReset();

        const dailyInteractions = window.GameState?.get('nature.dailyInteractions') || {};
        const current = dailyInteractions[elementType] || 0;
        const limit = this.dailyLimits[elementType] || 10;

        return current < limit;
    }

    /**
     * Record a nature interaction
     * @param {string} elementType - Type of nature element
     * @param {Phaser.Scene} scene - Scene for visual feedback
     * @param {number} x - X position for effects
     * @param {number} y - Y position for effects
     * @returns {object} Result with points earned and milestone info
     */
    recordInteraction(elementType, scene, x, y) {
        if (!this.elementTypes[elementType]) {
            console.warn(`[NatureAttunementSystem] Unknown element type: ${elementType}`);
            return { success: false };
        }

        // Check daily limit
        if (!this.canInteract(elementType)) {
            return {
                success: false,
                reason: 'daily_limit',
                message: `You've connected with enough ${elementType}s today. Return tomorrow!`
            };
        }

        const element = this.elementTypes[elementType];
        const pointsEarned = element.points;

        // Update attunement points
        const currentAttunement = this.getAttunement();
        const newAttunement = currentAttunement + pointsEarned;
        window.GameState?.set('nature.attunement', newAttunement);

        // Update total interactions
        const interactions = window.GameState?.get('nature.interactions') || {};
        interactions[elementType] = (interactions[elementType] || 0) + 1;
        window.GameState?.set('nature.interactions', interactions);

        // Update daily interactions
        const dailyInteractions = window.GameState?.get('nature.dailyInteractions') || {};
        dailyInteractions[elementType] = (dailyInteractions[elementType] || 0) + 1;
        window.GameState?.set('nature.dailyInteractions', dailyInteractions);

        // Show visual feedback
        if (scene) {
            this.showInteractionFeedback(scene, x, y, element);
        }

        // Check for milestone unlock
        const milestoneResult = this.checkMilestoneUnlock(scene, x, y);

        // Emit interaction event
        this.emit('interaction', {
            elementType,
            pointsEarned,
            totalAttunement: newAttunement,
            dailyRemaining: this.dailyLimits[elementType] - dailyInteractions[elementType]
        });

        // Save state
        window.GameState?.save();

        return {
            success: true,
            pointsEarned,
            totalAttunement: newAttunement,
            milestoneUnlocked: milestoneResult.unlocked,
            milestoneName: milestoneResult.name,
            dailyRemaining: this.dailyLimits[elementType] - dailyInteractions[elementType]
        };
    }

    /**
     * Show visual feedback for nature interaction
     */
    showInteractionFeedback(scene, x, y, element) {
        // Floating text with icon
        const feedbackText = scene.add.text(x, y - 30, `${element.icon} +${element.points}`, {
            fontSize: '18px',
            color: '#90EE90',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(2000);

        scene.tweens.add({
            targets: feedbackText,
            y: y - 80,
            alpha: { from: 1, to: 0 },
            duration: 1500,
            onComplete: () => feedbackText.destroy()
        });

        // Nature sparkle particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst?.(scene, x, y, {
                count: 8,
                color: [0x90EE90, 0x228B22, 0xFFFFFF],
                duration: 1000
            });
        }

        // Play nature sound
        if (window.AudioManager) {
            window.AudioManager.playPet?.(); // Gentle sound for nature interaction
        }
    }

    /**
     * Check if a milestone was unlocked
     */
    checkMilestoneUnlock(scene, x, y) {
        const currentLevel = this.getCurrentLevel();
        const currentAttunement = this.getAttunement();

        // Check if next milestone is reached
        if (currentLevel < this.milestones.length) {
            const nextMilestone = this.milestones[currentLevel];

            if (currentAttunement >= nextMilestone.attunementRequired) {
                // Unlock milestone!
                window.GameState?.set('nature.currentLevel', currentLevel + 1);

                // Store unlocked rewards
                const unlockedRewards = window.GameState?.get('nature.unlockedRewards') || [];
                unlockedRewards.push({
                    level: nextMilestone.level,
                    name: nextMilestone.name,
                    rewards: nextMilestone.rewards,
                    unlockedAt: Date.now()
                });
                window.GameState?.set('nature.unlockedRewards', unlockedRewards);

                // Show celebration
                if (scene) {
                    this.showMilestoneUnlock(scene, nextMilestone, x, y);
                }

                // Emit milestone event
                this.emit('milestoneUnlocked', nextMilestone);

                return { unlocked: true, name: nextMilestone.name, level: nextMilestone.level };
            }
        }

        return { unlocked: false };
    }

    /**
     * Show milestone unlock celebration
     */
    showMilestoneUnlock(scene, milestone, x, y) {
        const { width, height } = scene.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dark overlay
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(3000);

        // Celebration panel
        const panel = scene.add.graphics();
        panel.fillStyle(0x1A4D1A, 0.95);
        panel.fillRoundedRect(centerX - 150, centerY - 100, 300, 200, 15);
        panel.lineStyle(3, 0x90EE90);
        panel.strokeRoundedRect(centerX - 150, centerY - 100, 300, 200, 15);
        panel.setScrollFactor(0);
        panel.setDepth(3001);

        // Title
        const title = scene.add.text(centerX, centerY - 70, 'Nature Milestone!', {
            fontSize: '24px',
            color: '#90EE90',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Milestone name
        const name = scene.add.text(centerX, centerY - 30, `${milestone.name}`, {
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Reward info
        let rewardText = 'Rewards:\n';
        if (milestone.rewards.cosmetic) {
            if (milestone.rewards.cosmetic.title) {
                rewardText += `Title: "${milestone.rewards.cosmetic.title}"\n`;
            }
            if (milestone.rewards.cosmetic.auraColor) {
                rewardText += `Nature Aura unlocked\n`;
            }
            if (milestone.rewards.cosmetic.particleEffect) {
                rewardText += `Nature particles unlocked\n`;
            }
        }
        if (milestone.rewards.functional) {
            if (milestone.rewards.functional.statBonusPercent) {
                const type = milestone.rewards.functional.type;
                rewardText += `+${milestone.rewards.functional.statBonusPercent}% ${type === 'all' ? 'all stats' : type}\n`;
            }
            if (milestone.rewards.functional.cooldownReduction) {
                rewardText += `-${milestone.rewards.functional.cooldownReduction}% cooldowns\n`;
            }
            if (milestone.rewards.functional.unlockAbility) {
                rewardText += `New ability: Nature Surge!\n`;
            }
        }

        const rewards = scene.add.text(centerX, centerY + 30, rewardText, {
            fontSize: '14px',
            color: '#AAFFAA',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Particle celebration
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst?.(scene, centerX, centerY - 80, {
                count: 30,
                color: [0x90EE90, 0x228B22, 0xFFD700],
                duration: 2000
            });
        }

        // Sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement?.();
        }

        // Auto-dismiss after 4 seconds
        scene.time.delayedCall(4000, () => {
            scene.tweens.add({
                targets: [overlay, panel, title, name, rewards],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    panel.destroy();
                    title.destroy();
                    name.destroy();
                    rewards.destroy();
                }
            });
        });
    }

    /**
     * Get all unlocked rewards for applying bonuses
     */
    getUnlockedRewards() {
        return window.GameState?.get('nature.unlockedRewards') || [];
    }

    /**
     * Calculate total stat bonus from nature rewards
     */
    getStatBonus(statType) {
        const rewards = this.getUnlockedRewards();
        let totalBonus = 0;

        rewards.forEach(reward => {
            if (reward.rewards.functional?.statBonusPercent) {
                const bonusType = reward.rewards.functional.type;
                if (bonusType === 'all' || bonusType === statType) {
                    totalBonus += reward.rewards.functional.statBonusPercent;
                }
            }
        });

        return totalBonus;
    }

    /**
     * Check if Nature Surge ability is unlocked
     */
    hasNatureSurge() {
        const rewards = this.getUnlockedRewards();
        return rewards.some(r => r.rewards.functional?.unlockAbility === 'natureSurge');
    }

    /**
     * Get nature interaction statistics
     */
    getStats() {
        return {
            totalAttunement: this.getAttunement(),
            currentLevel: this.getCurrentLevel(),
            nextMilestone: this.getNextMilestone(),
            progressToNext: this.getProgressToNextMilestone(),
            totalInteractions: window.GameState?.get('nature.interactions') || {},
            dailyInteractions: window.GameState?.get('nature.dailyInteractions') || {},
            unlockedRewards: this.getUnlockedRewards()
        };
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[NatureAttunementSystem] Event listener error for ${event}:`, error);
                }
            });
        }
    }
}

// Create singleton and export
const natureAttunementSystem = new NatureAttunementSystem();

if (typeof window !== 'undefined') {
    window.NatureAttunementSystem = natureAttunementSystem;
}

export default natureAttunementSystem;

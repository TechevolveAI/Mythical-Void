/**
 * QuestManager - Handles quests, objectives, and rewards
 * Provides daily quests, biome quests, and creature quests
 */

import projectBeacon from '../config/project-beacon.json';

class QuestManager {
    constructor() {
        this.initialized = false;
        this.activeQuests = [];
        this.completedQuests = [];
        this.questProgress = {};
        this.eventListeners = new Map();

        // Quest templates
        this.questTemplates = this.defineQuestTemplates();
    }

    /**
     * Initialize the quest system
     */
    init() {
        if (this.initialized) return;

        console.log('[QuestManager] Initializing quest system...');

        // Load saved quest state
        this.loadQuestState();

        // Check for daily reset
        this.checkDailyReset();

        // Existing players may already have daily quests, so sync story progression separately.
        this.ensureProjectBeaconQuest({ persist: false });

        // Generate initial quests if none exist
        if (this.activeQuests.length === 0) {
            this.generateDailyQuests();
        }

        // Listen for game events
        this.setupEventListeners();

        this.initialized = true;
        console.log('[QuestManager] Quest system initialized with', this.activeQuests.length, 'active quests');
    }

    /**
     * Define all quest templates
     */
    defineQuestTemplates() {
        return {
            // ==========================================
            // DAILY QUESTS (Reset each day)
            // ==========================================
            daily: [
                {
                    id: 'daily_feed_creature',
                    name: 'Caring Keeper',
                    description: 'Feed your creature 3 times',
                    icon: '🍎',
                    type: 'daily',
                    objective: { type: 'care_action', action: 'feed', target: 3 },
                    rewards: { coins: 50, xp: 25 }
                },
                {
                    id: 'daily_play_creature',
                    name: 'Playtime Fun',
                    description: 'Play with your creature 2 times',
                    icon: '🎾',
                    type: 'daily',
                    objective: { type: 'care_action', action: 'play', target: 2 },
                    rewards: { coins: 40, xp: 20 }
                },
                {
                    id: 'daily_defeat_enemies',
                    name: 'Defender',
                    description: 'Defeat 5 enemies',
                    icon: '⚔️',
                    type: 'daily',
                    objective: { type: 'defeat_enemies', target: 5 },
                    rewards: { coins: 75, xp: 40 }
                },
                {
                    id: 'daily_collect_coins',
                    name: 'Coin Collector',
                    description: 'Collect 100 coins',
                    icon: '🪙',
                    type: 'daily',
                    objective: { type: 'collect_coins', target: 100 },
                    rewards: { coins: 30, xp: 15 }
                },
                {
                    id: 'daily_explore',
                    name: 'Explorer',
                    description: 'Discover 3 collectibles',
                    icon: '🔍',
                    type: 'daily',
                    objective: { type: 'collect_items', target: 3 },
                    rewards: { coins: 60, xp: 30 }
                },
                {
                    id: 'daily_level_up',
                    name: 'Growing Strong',
                    description: 'Gain 50 XP',
                    icon: '⬆️',
                    type: 'daily',
                    objective: { type: 'gain_xp', target: 50 },
                    rewards: { coins: 45, xp: 0 }
                }
            ],

            // ==========================================
            // BIOME QUESTS (Per-biome objectives)
            // ==========================================
            biome: {
                nebula: [
                    {
                        id: 'nebula_defeat_10',
                        name: 'Nebula Guardian',
                        description: 'Defeat 10 enemies in the Nebula',
                        icon: '🌌',
                        type: 'biome',
                        biome: 'nebula',
                        objective: { type: 'defeat_enemies_biome', biome: 'nebula', target: 10 },
                        rewards: { coins: 150, xp: 75 }
                    },
                    {
                        id: 'nebula_collect_crystals',
                        name: 'Crystal Hunter',
                        description: 'Find 5 Nebula Crystals',
                        icon: '💎',
                        type: 'biome',
                        biome: 'nebula',
                        objective: { type: 'collect_biome_item', biome: 'nebula', item: 'crystal', target: 5 },
                        rewards: { coins: 200, xp: 100 }
                    }
                ],
                stellar_reef: [
                    {
                        id: 'stellar_defeat_15',
                        name: 'Reef Protector',
                        description: 'Defeat 15 enemies in the Stellar Reef',
                        icon: '🐠',
                        type: 'biome',
                        biome: 'stellar_reef',
                        objective: { type: 'defeat_enemies_biome', biome: 'stellar_reef', target: 15 },
                        rewards: { coins: 250, xp: 125 }
                    },
                    {
                        id: 'stellar_collect_pearls',
                        name: 'Pearl Diver',
                        description: 'Find 5 Stellar Pearls',
                        icon: '🦪',
                        type: 'biome',
                        biome: 'stellar_reef',
                        objective: { type: 'collect_biome_item', biome: 'stellar_reef', item: 'pearl', target: 5 },
                        rewards: { coins: 300, xp: 150 }
                    }
                ],
                crystal_caves: [
                    {
                        id: 'crystal_defeat_20',
                        name: 'Cave Conqueror',
                        description: 'Defeat 20 enemies in the Crystal Caves',
                        icon: '💎',
                        type: 'biome',
                        biome: 'crystal_caves',
                        objective: { type: 'defeat_enemies_biome', biome: 'crystal_caves', target: 20 },
                        rewards: { coins: 400, xp: 200 }
                    }
                ],
                void_peaks: [
                    {
                        id: 'void_defeat_25',
                        name: 'Peak Climber',
                        description: 'Defeat 25 enemies in the Void Peaks',
                        icon: '⛰️',
                        type: 'biome',
                        biome: 'void_peaks',
                        objective: { type: 'defeat_enemies_biome', biome: 'void_peaks', target: 25 },
                        rewards: { coins: 500, xp: 250 }
                    }
                ],
                aurora_depths: [
                    {
                        id: 'aurora_defeat_30',
                        name: 'Depth Explorer',
                        description: 'Defeat 30 enemies in the Aurora Depths',
                        icon: '🌌',
                        type: 'biome',
                        biome: 'aurora_depths',
                        objective: { type: 'defeat_enemies_biome', biome: 'aurora_depths', target: 30 },
                        rewards: { coins: 750, xp: 400 }
                    }
                ]
            },

            // ==========================================
            // CREATURE QUESTS (Based on creature type/level)
            // ==========================================
            creature: [
                {
                    id: 'creature_reach_level_5',
                    name: 'Rising Star',
                    description: 'Reach creature level 5',
                    icon: '⭐',
                    type: 'creature',
                    objective: { type: 'reach_level', target: 5 },
                    rewards: { coins: 200, xp: 0 },
                    oneTime: true
                },
                {
                    id: 'creature_reach_level_10',
                    name: 'Seasoned Companion',
                    description: 'Reach creature level 10',
                    icon: '🌟',
                    type: 'creature',
                    objective: { type: 'reach_level', target: 10 },
                    rewards: { coins: 500, xp: 0 },
                    oneTime: true
                },
                {
                    id: 'creature_max_happiness',
                    name: 'Pure Joy',
                    description: 'Reach 100% happiness',
                    icon: '😊',
                    type: 'creature',
                    objective: { type: 'reach_happiness', target: 100 },
                    rewards: { coins: 100, xp: 50 },
                    oneTime: true
                },
                {
                    id: 'creature_first_breed',
                    name: 'New Beginnings',
                    description: 'Breed your first creature',
                    icon: '🥚',
                    type: 'creature',
                    objective: { type: 'breed_creature', target: 1 },
                    rewards: { coins: 300, xp: 150 },
                    oneTime: true
                }
            ],

            // ==========================================
            // COLLECTION QUESTS
            // ==========================================
            collection: [
                {
                    id: 'collect_3_creatures',
                    name: 'Growing Family',
                    description: 'Have 3 creatures in your collection',
                    icon: '🐾',
                    type: 'collection',
                    objective: { type: 'collection_size', target: 3 },
                    rewards: { coins: 250, xp: 100 },
                    oneTime: true
                },
                {
                    id: 'collect_rare_creature',
                    name: 'Rare Find',
                    description: 'Obtain a rare or better creature',
                    icon: '✨',
                    type: 'collection',
                    objective: { type: 'obtain_rarity', rarity: 'rare', target: 1 },
                    rewards: { coins: 400, xp: 200 },
                    oneTime: true
                }
            ]
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen to GameState events
        if (window.GameState) {
            window.GameState.on('careActionPerformed', (data) => {
                this.trackProgress('care_action', { action: data.actionType || data.action });
            });

            window.GameState.on('levelUp', (data) => {
                this.trackProgress('reach_level', { level: data.newLevel });
                this.trackProgress('gain_xp', { amount: 100 }); // Level up grants XP progress
            });

            window.GameState.on('breedingCompleted', () => {
                this.trackProgress('breed_creature', { count: 1 });
            });

            window.GameState.on('creatureAddedToCollection', (data) => {
                const creatures = window.GameState.getCreatureCollection() || [];
                this.trackProgress('collection_size', { size: creatures.length });
                if (data.creature?.rarity) {
                    this.trackProgress('obtain_rarity', { rarity: data.creature.rarity });
                }
            });

            window.GameState.on('changed:creature.stats.happiness', (newValue) => {
                this.trackProgress('reach_happiness', { happiness: newValue });
            });

            window.GameState.on('changed:creature.hatched', (hatched) => {
                if (hatched) this.ensureProjectBeaconQuest();
            });
        }

        console.log('[QuestManager] Event listeners set up');
    }

    /**
     * Generate daily quests (pick 3 random daily quests)
     */
    generateDailyQuests() {
        const dailyTemplates = [...this.questTemplates.daily];
        const selectedQuests = [];

        // Pick 3 random daily quests
        for (let i = 0; i < 3 && dailyTemplates.length > 0; i++) {
            const index = Math.floor(Math.random() * dailyTemplates.length);
            const template = dailyTemplates.splice(index, 1)[0];

            selectedQuests.push({
                ...template,
                questId: `${template.id}_${Date.now()}`,
                progress: 0,
                completed: false,
                claimed: false,
                generatedAt: Date.now()
            });
        }

        // Add to active quests
        this.activeQuests = this.activeQuests.filter(q => q.type !== 'daily');
        this.activeQuests.push(...selectedQuests);

        // Also add available biome quests for unlocked biomes
        this.generateBiomeQuests();

        // Add one-time quests that haven't been completed
        this.addOneTimeQuests();

        this.saveQuestState({ persist: true });
        this.emit('questsGenerated', { quests: selectedQuests });

        console.log('[QuestManager] Generated', selectedQuests.length, 'daily quests');
    }

    /**
     * Generate biome quests for unlocked biomes
     */
    generateBiomeQuests() {
        const gates = window.GameState?.getAllGates() || {};

        Object.entries(gates).forEach(([gateId, gateData]) => {
            if (gateData.unlocked) {
                const biome = gateData.biome || gateId;
                const biomeTemplates = this.questTemplates.biome[biome] || [];

                biomeTemplates.forEach(template => {
                    // Check if already active or completed
                    const alreadyActive = this.activeQuests.some(q => q.id === template.id);
                    const alreadyCompleted = this.completedQuests.includes(template.id);

                    if (!alreadyActive && !alreadyCompleted) {
                        this.activeQuests.push({
                            ...template,
                            questId: `${template.id}_${Date.now()}`,
                            progress: 0,
                            completed: false,
                            claimed: false,
                            generatedAt: Date.now()
                        });
                    }
                });
            }
        });
    }

    /**
     * Add one-time quests (creature/collection quests)
     */
    addOneTimeQuests() {
        const oneTimeQuests = [
            ...this.questTemplates.creature,
            ...this.questTemplates.collection
        ].filter(t => t.oneTime);

        oneTimeQuests.forEach(template => {
            const alreadyActive = this.activeQuests.some(q => q.id === template.id);
            const alreadyCompleted = this.completedQuests.includes(template.id);

            if (!alreadyActive && !alreadyCompleted) {
                this.activeQuests.push({
                    ...template,
                    questId: `${template.id}`,
                    progress: 0,
                    completed: false,
                    claimed: false,
                    generatedAt: Date.now()
                });
            }
        });

        this.ensureProjectBeaconQuest({ persist: false });
    }

    /**
     * Keep exactly one sequential Project Beacon field mission active.
     */
    ensureProjectBeaconQuest({ persist = true } = {}) {
        if (!window.GameState?.get('creature.hatched')) return null;

        const activeStoryQuest = this.activeQuests.find(quest => quest.type === 'story');
        if (activeStoryQuest) {
            const currentDefinition = projectBeacon.fieldMissions.find(
                mission => mission.id === activeStoryQuest.id
            );
            if (currentDefinition) {
                let observedSignals = window.GameState.get(
                    'world.livingSignals.observedIds'
                );
                let observedCount = Array.isArray(observedSignals)
                    ? observedSignals.length
                    : 0;
                const isLegacySignalObjective =
                    currentDefinition.id === 'beacon_living_signals' &&
                    activeStoryQuest.objective?.type === 'collect_items';
                if (isLegacySignalObjective) {
                    const signalIds = currentDefinition.objective.signalIds || [];
                    const preservedCount = Math.min(
                        activeStoryQuest.progress || 0,
                        currentDefinition.objective.target
                    );
                    if (preservedCount > observedCount) {
                        observedSignals = signalIds.slice(0, preservedCount);
                        observedCount = observedSignals.length;
                        window.GameState.set('world.livingSignals', {
                            observedIds: observedSignals,
                            lastObservedId: observedSignals[observedSignals.length - 1] || null,
                            lastObservedAt: null
                        });
                    }
                }
                const migratedProgress = currentDefinition.id === 'beacon_living_signals'
                    ? Math.max(activeStoryQuest.progress || 0, observedCount)
                    : activeStoryQuest.progress || 0;

                Object.assign(activeStoryQuest, {
                    ...currentDefinition,
                    questId: activeStoryQuest.questId || currentDefinition.id,
                    progress: Math.min(
                        migratedProgress,
                        currentDefinition.objective.target
                    ),
                    completed: Boolean(
                        activeStoryQuest.completed ||
                        migratedProgress >= currentDefinition.objective.target
                    ),
                    claimed: activeStoryQuest.claimed === true
                });
                window.GameState.set(
                    'story.projectBeacon.currentMission',
                    currentDefinition.id
                );
                if (persist) this.saveQuestState({ persist: true });
            }
            return activeStoryQuest;
        }

        const nextMission = projectBeacon.fieldMissions.find(
            mission => !this.completedQuests.includes(mission.id)
        );

        if (!nextMission) {
            window.GameState.set('story.projectBeacon.currentMission', 'field_sequence_complete');
            if (persist) this.saveQuestState({ persist: true });
            return null;
        }

        const missionAlreadySatisfied = Boolean(
            nextMission.objective.type === 'story_interaction' &&
            nextMission.objective.event === 'field_kit_recovered' &&
            window.GameState.get('story.projectBeacon.fieldKit.recovered')
        );
        const observedSignals = window.GameState.get('world.livingSignals.observedIds');
        const observedSignalProgress = nextMission.objective.type === 'observe_living_signal' &&
            Array.isArray(observedSignals)
            ? Math.min(observedSignals.length, nextMission.objective.target)
            : 0;
        const quest = {
            ...nextMission,
            questId: nextMission.id,
            progress: missionAlreadySatisfied
                ? nextMission.objective.target
                : observedSignalProgress,
            completed: missionAlreadySatisfied ||
                observedSignalProgress >= nextMission.objective.target,
            claimed: false,
            generatedAt: Date.now()
        };

        this.activeQuests.push(quest);
        window.GameState.set('story.projectBeacon.currentMission', nextMission.id);

        if (persist) {
            this.saveQuestState({ persist: true });
            this.emit('questsGenerated', { quests: [quest] });
        }

        return quest;
    }

    /**
     * Track progress for a specific objective type
     */
    trackProgress(objectiveType, data = {}) {
        let questsUpdated = false;
        let milestoneReached = false;
        let storyProgressUpdated = false;

        this.activeQuests.forEach(quest => {
            if (quest.completed || quest.claimed) return;

            const obj = quest.objective;
            let progressIncrement = 0;

            switch (objectiveType) {
                case 'care_action':
                    if (obj.type === 'care_action' && (!obj.action || obj.action === data.action)) {
                        progressIncrement = 1;
                    }
                    break;

                case 'defeat_enemies':
                    if (obj.type === 'defeat_enemies') {
                        progressIncrement = data.count || 1;
                    }
                    if (obj.type === 'defeat_enemies_biome' && obj.biome === data.biome) {
                        progressIncrement = data.count || 1;
                    }
                    break;

                case 'collect_coins':
                    if (obj.type === 'collect_coins') {
                        progressIncrement = data.amount || 0;
                    }
                    break;

                case 'collect_items':
                    if (obj.type === 'collect_items') {
                        progressIncrement = data.count || 1;
                    }
                    if (obj.type === 'collect_biome_item' && obj.biome === data.biome && obj.item === data.item) {
                        progressIncrement = data.count || 1;
                    }
                    break;

                case 'observe_living_signal':
                    if (obj.type === 'observe_living_signal' && data.signalId) {
                        progressIncrement = 1;
                    }
                    break;

                case 'gain_xp':
                    if (obj.type === 'gain_xp') {
                        progressIncrement = data.amount || 0;
                    }
                    break;

                case 'reach_level':
                    if (obj.type === 'reach_level') {
                        quest.progress = data.level || 0;
                        questsUpdated = true;
                    }
                    break;

                case 'reach_happiness':
                    if (obj.type === 'reach_happiness') {
                        quest.progress = data.happiness || 0;
                        questsUpdated = true;
                    }
                    break;

                case 'breed_creature':
                    if (obj.type === 'breed_creature') {
                        progressIncrement = 1;
                    }
                    break;

                case 'collection_size':
                    if (obj.type === 'collection_size') {
                        quest.progress = data.size || 0;
                        questsUpdated = true;
                    }
                    break;

                case 'obtain_rarity':
                    if (obj.type === 'obtain_rarity') {
                        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
                        const targetIndex = rarityOrder.indexOf(obj.rarity);
                        const obtainedIndex = rarityOrder.indexOf(data.rarity);
                        if (obtainedIndex >= targetIndex) {
                            quest.progress = obj.target;
                            questsUpdated = true;
                        }
                    }
                    break;

                case 'landmark_visit':
                    if (obj.type === 'landmark_visit' && obj.landmark === data.landmark) {
                        progressIncrement = 1;
                    }
                    break;

                case 'story_interaction':
                    if (obj.type === 'story_interaction' && obj.event === data.event) {
                        progressIncrement = 1;
                    }
                    break;
            }

            if (progressIncrement > 0) {
                quest.progress = (quest.progress || 0) + progressIncrement;
                questsUpdated = true;
                storyProgressUpdated = storyProgressUpdated || quest.type === 'story';
            }

            // Check completion
            if (quest.progress >= quest.objective.target && !quest.completed) {
                quest.completed = true;
                milestoneReached = true;
                this.emit('questCompleted', { quest });
                console.log(`[QuestManager] Quest completed: ${quest.name}`);
            }
        });

        if (questsUpdated) {
            this.saveQuestState({
                persist: storyProgressUpdated || milestoneReached
            });
            this.emit('questProgressUpdated', { quests: this.activeQuests });
        }
    }

    /**
     * Claim rewards for a completed quest
     */
    claimReward(questId) {
        const quest = this.activeQuests.find(q => q.questId === questId);

        if (!quest) {
            console.warn('[QuestManager] Quest not found:', questId);
            return null;
        }

        if (!quest.completed) {
            console.warn('[QuestManager] Quest not completed:', questId);
            return null;
        }

        if (quest.claimed) {
            console.warn('[QuestManager] Quest already claimed:', questId);
            return null;
        }

        // Mark as claimed
        quest.claimed = true;

        // Grant rewards
        const rewards = quest.rewards || {};

        if (rewards.coins && window.EconomyManager) {
            window.EconomyManager.addCoins(rewards.coins, `quest_${quest.id}`);
        }

        if (rewards.xp && window.GameState) {
            window.GameState.updateCreature({ experience: rewards.xp });
        }

        // Add to completed quests list (for one-time quests)
        if (quest.oneTime) {
            this.completedQuests.push(quest.id);
        }

        // Remove from active quests
        this.activeQuests = this.activeQuests.filter(q => q.questId !== questId);

        if (quest.type === 'story') {
            this.ensureProjectBeaconQuest({ persist: false });
        }

        this.saveQuestState({ persist: true });
        this.emit('questRewardClaimed', { quest, rewards });

        console.log(`[QuestManager] Claimed rewards for: ${quest.name}`, rewards);

        return rewards;
    }

    /**
     * Get all active quests
     */
    getActiveQuests() {
        return this.activeQuests;
    }

    /**
     * Get quests by type
     */
    getQuestsByType(type) {
        return this.activeQuests.filter(q => q.type === type);
    }

    /**
     * Get completed but unclaimed quests
     */
    getClaimableQuests() {
        return this.activeQuests.filter(q => q.completed && !q.claimed);
    }

    /**
     * Check if daily quests need reset
     */
    checkDailyReset() {
        const lastReset = window.GameState?.get('quests.lastDailyReset');
        const today = new Date().toDateString();

        if (lastReset !== today) {
            console.log('[QuestManager] Daily reset triggered');

            // Remove old daily quests
            this.activeQuests = this.activeQuests.filter(q => q.type !== 'daily');

            // Include the reset marker in the same durable save as the new quests.
            window.GameState?.set('quests.lastDailyReset', today);

            // Generate new daily quests
            this.generateDailyQuests();
        }
    }

    /**
     * Save quest state to GameState
     */
    saveQuestState({ persist = false } = {}) {
        if (window.GameState) {
            window.GameState.set('quests.active', this.activeQuests);
            window.GameState.set('quests.completed', this.completedQuests);
            if (persist) {
                window.GameState.save?.();
            }
        }
    }

    /**
     * Load quest state from GameState
     */
    loadQuestState() {
        if (window.GameState) {
            this.activeQuests = window.GameState.get('quests.active') || [];
            this.completedQuests = window.GameState.get('quests.completed') || [];
        }
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
        return () => this.off(event, callback);
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
                    console.error(`[QuestManager] Event listener error for ${event}:`, error);
                }
            });
        }
    }
}

// Create singleton and export
const questManager = new QuestManager();

if (typeof window !== 'undefined') {
    window.QuestManager = questManager;
}

export default questManager;

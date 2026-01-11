/**
 * CreatureAgent - Multi-agent system for autonomous creature behavior
 *
 * Each creature operates as an autonomous AI agent that can:
 * - Make decisions based on personality, mood, and needs
 * - Interact with other creatures in the collection
 * - Perform activities while player is offline
 * - Form relationships and memories
 *
 * @see docs/planning/CREATURE_AGENT_SYSTEM.md for full design
 */

const PERSONALITY_TRAITS = {
    curious: {
        exploreChance: 0.4,
        socialChance: 0.3,
        playChance: 0.2,
        restChance: 0.1
    },
    playful: {
        exploreChance: 0.2,
        socialChance: 0.35,
        playChance: 0.35,
        restChance: 0.1
    },
    gentle: {
        exploreChance: 0.15,
        socialChance: 0.35,
        playChance: 0.2,
        restChance: 0.3
    },
    wise: {
        exploreChance: 0.25,
        socialChance: 0.3,
        playChance: 0.15,
        restChance: 0.3
    },
    energetic: {
        exploreChance: 0.35,
        socialChance: 0.25,
        playChance: 0.3,
        restChance: 0.1
    }
};

const ACTIVITY_TYPES = {
    idle: { energyCost: 0, happinessEffect: 0, socialNeedEffect: 5 },
    sleeping: { energyCost: -20, happinessEffect: 5, socialNeedEffect: 0 },
    playing: { energyCost: 15, happinessEffect: 15, socialNeedEffect: -10 },
    exploring: { energyCost: 20, happinessEffect: 10, socialNeedEffect: 5 },
    socializing: { energyCost: 10, happinessEffect: 20, socialNeedEffect: -25 },
    resting: { energyCost: -10, happinessEffect: 5, socialNeedEffect: 0 },
    foraging: { energyCost: 15, happinessEffect: 5, socialNeedEffect: 5 }
};

const INTERACTION_TYPES = {
    play_together: {
        name: 'Played together',
        icon: '🎮',
        happinessGain: 15,
        familiarityGain: 5,
        affectionGain: 3,
        energyCost: 15,
        requiredEnergy: 30
    },
    rest_together: {
        name: 'Rested together',
        icon: '😴',
        happinessGain: 5,
        familiarityGain: 3,
        affectionGain: 5,
        energyCost: -15,
        requiredEnergy: 0
    },
    explore_together: {
        name: 'Explored together',
        icon: '🔭',
        happinessGain: 12,
        familiarityGain: 8,
        affectionGain: 4,
        energyCost: 20,
        requiredEnergy: 40
    },
    share_meal: {
        name: 'Shared a meal',
        icon: '🍽️',
        happinessGain: 10,
        familiarityGain: 4,
        affectionGain: 6,
        energyCost: 5,
        requiredEnergy: 10
    },
    teach: {
        name: 'Taught a skill',
        icon: '📚',
        happinessGain: 8,
        familiarityGain: 10,
        affectionGain: 7,
        energyCost: 15,
        requiredEnergy: 25,
        requiresElder: true
    }
};

class CreatureAgent {
    constructor() {
        this.enabled = true;
        this.lastSimulationTime = null;
    }

    /**
     * Initialize agent state for a new creature
     * @param {Object} creature - The creature data object
     * @param {string} personality - The creature's personality trait
     * @returns {Object} - Updated creature with agent state
     */
    initializeAgentState(creature, personality = null) {
        if (!creature) return creature;

        const detectedPersonality = personality ||
            creature.personality ||
            this.detectPersonalityFromGenes(creature.genes);

        creature.agent = {
            personality: detectedPersonality,
            mood: 'happy',
            energy: 100,
            socialNeed: 30,

            relationships: {},

            currentActivity: {
                type: 'idle',
                startTime: Date.now(),
                targetLocation: null,
                partner: null
            },

            taskQueue: [],

            memories: [],

            lastUpdate: Date.now()
        };

        console.log(`[CreatureAgent] Initialized agent state for ${creature.name} (${detectedPersonality})`);
        return creature;
    }

    /**
     * Detect personality from genetic traits
     */
    detectPersonalityFromGenes(genes) {
        if (!genes) return 'curious';

        const personality = genes.personality?.core ||
            genes.traits?.personality?.core;

        if (personality && PERSONALITY_TRAITS[personality]) {
            return personality;
        }

        const personalities = Object.keys(PERSONALITY_TRAITS);
        return personalities[Math.floor(Math.random() * personalities.length)];
    }

    /**
     * Ensure a creature has agent state, initializing if needed
     */
    ensureAgentState(creature) {
        if (!creature) return creature;

        if (!creature.agent) {
            return this.initializeAgentState(creature);
        }

        return creature;
    }

    /**
     * Simulate offline activities for all creatures
     * @param {number} offlineMinutes - Minutes the player was away
     * @returns {Object} - Simulation results with events
     */
    simulateOfflineActivities(offlineMinutes) {
        if (!window.GameState) {
            console.warn('[CreatureAgent] GameState not available');
            return { events: [], creatures: [] };
        }

        const creatures = window.GameState.get('creatures') || [];
        const activeCreature = this.getActiveCreatureData();

        const allCreatures = activeCreature ? [activeCreature, ...creatures] : [...creatures];

        allCreatures.forEach(c => this.ensureAgentState(c));

        const events = [];
        const timeSlots = Math.floor(offlineMinutes / 15);
        const maxSlots = Math.min(timeSlots, 96);

        console.log(`[CreatureAgent] Simulating ${offlineMinutes} minutes (${maxSlots} time slots) for ${allCreatures.length} creatures`);

        for (let slot = 0; slot < maxSlots; slot++) {
            const slotTime = Date.now() - ((maxSlots - slot) * 15 * 60 * 1000);

            allCreatures.forEach(creature => {
                if (!creature.agent) return;

                const action = this.decideAction(creature, allCreatures);
                const result = this.executeAction(creature, action, allCreatures, slotTime);

                if (result.notable) {
                    events.push({
                        time: slotTime,
                        timeSlot: slot,
                        creatureId: creature.id,
                        creatureName: creature.name,
                        action: action.type,
                        result: result.summary,
                        icon: result.icon || '✨',
                        details: result.details
                    });
                }

                this.updateCreatureState(creature, result);
            });

            this.resolveInteractions(allCreatures, events, slot, slotTime);
        }

        this.saveCreatureStates(allCreatures, creatures, activeCreature);

        const notableEvents = events.filter(e => e.notable !== false).slice(-10);

        console.log(`[CreatureAgent] Simulation complete. ${events.length} total events, ${notableEvents.length} notable`);

        return {
            events: notableEvents,
            creatures: allCreatures,
            totalSlots: maxSlots,
            offlineMinutes
        };
    }

    /**
     * Get active creature data with agent state
     */
    getActiveCreatureData() {
        if (!window.GameState) return null;

        const name = window.GameState.get('creature.name');
        if (!name) return null;

        return {
            id: 'active_creature',
            name: name,
            genes: window.GameState.get('creature.genes'),
            personality: window.GameState.get('creature.personality'),
            stats: window.GameState.get('creature.stats') || { happiness: 100, energy: 100 },
            lifecycle: window.GameState.get('creature.lifecycle'),
            agent: window.GameState.get('creature.agent'),
            isActive: true
        };
    }

    /**
     * Decide what action a creature should take
     */
    decideAction(creature, allCreatures) {
        const agent = creature.agent;
        if (!agent) return { type: 'idle' };

        const personality = agent.personality || 'curious';
        const traits = PERSONALITY_TRAITS[personality] || PERSONALITY_TRAITS.curious;
        const energy = agent.energy || 50;
        const socialNeed = agent.socialNeed || 50;
        const mood = agent.mood || 'happy';

        if (energy < 20) {
            return { type: 'sleeping' };
        }

        if (socialNeed > 80 && this.hasAvailableCompanion(creature, allCreatures)) {
            return {
                type: 'socializing',
                target: this.findBestCompanion(creature, allCreatures)
            };
        }

        if (mood === 'sad' || mood === 'lonely') {
            if (this.hasAvailableCompanion(creature, allCreatures)) {
                return { type: 'socializing', target: this.findBestCompanion(creature, allCreatures) };
            }
            return { type: 'resting' };
        }

        const roll = Math.random();
        let cumulative = 0;

        cumulative += traits.exploreChance;
        if (roll < cumulative && energy >= 40) {
            return { type: 'exploring' };
        }

        cumulative += traits.socialChance;
        if (roll < cumulative && this.hasAvailableCompanion(creature, allCreatures)) {
            return { type: 'socializing', target: this.findBestCompanion(creature, allCreatures) };
        }

        cumulative += traits.playChance;
        if (roll < cumulative && energy >= 30) {
            return { type: 'playing' };
        }

        cumulative += traits.restChance;
        if (roll < cumulative) {
            return { type: 'resting' };
        }

        return { type: 'idle' };
    }

    /**
     * Execute an action and return results
     */
    executeAction(creature, action, allCreatures, timestamp) {
        const activityConfig = ACTIVITY_TYPES[action.type] || ACTIVITY_TYPES.idle;
        const result = {
            notable: false,
            summary: '',
            icon: '✨',
            details: {},
            stateChanges: {
                energy: activityConfig.energyCost,
                happiness: activityConfig.happinessEffect,
                socialNeed: activityConfig.socialNeedEffect
            }
        };

        switch (action.type) {
            case 'exploring':
                result.notable = Math.random() < 0.15;
                if (result.notable) {
                    const discoveries = [
                        { item: 'Cosmic Crystal', icon: '💎' },
                        { item: 'Stardust', icon: '✨' },
                        { item: 'Ancient Rune', icon: '🔮' },
                        { item: 'Glowing Mushroom', icon: '🍄' }
                    ];
                    const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];
                    result.summary = `Found ${discovery.item}!`;
                    result.icon = discovery.icon;
                    result.details = { discovered: discovery.item };
                    result.stateChanges.happiness += 10;
                }
                break;

            case 'playing':
                result.notable = Math.random() < 0.1;
                if (result.notable) {
                    result.summary = 'Had a great time playing!';
                    result.icon = '🎮';
                    result.stateChanges.happiness += 5;
                }
                break;

            case 'sleeping':
                result.notable = false;
                result.summary = 'Got some rest';
                result.icon = '😴';
                break;

            case 'socializing':
                if (action.target) {
                    result.notable = Math.random() < 0.2;
                    if (result.notable) {
                        result.summary = `Bonded with ${action.target.name}`;
                        result.icon = '💕';
                        result.details = { partner: action.target.id };
                    }
                }
                break;

            case 'resting':
                result.notable = false;
                result.summary = 'Took a peaceful rest';
                result.icon = '🌙';
                break;

            case 'foraging':
                result.notable = Math.random() < 0.2;
                if (result.notable) {
                    result.summary = 'Found some food';
                    result.icon = '🍎';
                }
                break;

            default:
                result.summary = 'Relaxed';
                break;
        }

        creature.agent.currentActivity = {
            type: action.type,
            startTime: timestamp,
            targetLocation: null,
            partner: action.target?.id || null
        };

        return result;
    }

    /**
     * Update creature state based on action results
     */
    updateCreatureState(creature, result) {
        if (!creature.agent) return;

        const changes = result.stateChanges || {};

        creature.agent.energy = Math.max(0, Math.min(100,
            (creature.agent.energy || 50) + (changes.energy || 0)
        ));

        creature.agent.socialNeed = Math.max(0, Math.min(100,
            (creature.agent.socialNeed || 50) + (changes.socialNeed || 0)
        ));

        if (creature.stats) {
            creature.stats.happiness = Math.max(0, Math.min(100,
                (creature.stats.happiness || 50) + (changes.happiness || 0)
            ));
        }

        this.updateMood(creature);

        creature.agent.lastUpdate = Date.now();
    }

    /**
     * Update creature mood based on current state
     */
    updateMood(creature) {
        if (!creature.agent) return;

        const happiness = creature.stats?.happiness || 50;
        const socialNeed = creature.agent.socialNeed || 50;
        const energy = creature.agent.energy || 50;

        if (happiness >= 70 && energy >= 40) {
            creature.agent.mood = 'happy';
        } else if (socialNeed > 80) {
            creature.agent.mood = 'lonely';
        } else if (happiness < 30) {
            creature.agent.mood = 'sad';
        } else if (energy < 20) {
            creature.agent.mood = 'tired';
        } else {
            creature.agent.mood = 'content';
        }
    }

    /**
     * Check if creature has an available companion
     */
    hasAvailableCompanion(creature, allCreatures) {
        return allCreatures.some(c =>
            c.id !== creature.id &&
            c.agent &&
            c.agent.energy >= 20
        );
    }

    /**
     * Find the best companion for a creature
     */
    findBestCompanion(creature, allCreatures) {
        const available = allCreatures.filter(c =>
            c.id !== creature.id &&
            c.agent &&
            c.agent.energy >= 20
        );

        if (available.length === 0) return null;

        const relationships = creature.agent?.relationships || {};

        available.sort((a, b) => {
            const affinityA = relationships[a.id]?.affection || 0;
            const affinityB = relationships[b.id]?.affection || 0;
            return affinityB - affinityA;
        });

        return available[0];
    }

    /**
     * Resolve interactions between creatures
     */
    resolveInteractions(allCreatures, events, slot, slotTime) {
        const socializingCreatures = allCreatures.filter(c =>
            c.agent?.currentActivity?.type === 'socializing' &&
            c.agent?.currentActivity?.partner
        );

        const processedPairs = new Set();

        socializingCreatures.forEach(creature => {
            const partnerId = creature.agent.currentActivity.partner;
            const partner = allCreatures.find(c => c.id === partnerId);

            if (!partner) return;

            const pairKey = [creature.id, partnerId].sort().join('_');
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

            const interactionType = this.determineInteractionType(creature, partner);
            const interaction = INTERACTION_TYPES[interactionType];

            if (!interaction) return;

            this.updateRelationship(creature, partner, interaction);

            if (Math.random() < 0.3) {
                events.push({
                    time: slotTime,
                    timeSlot: slot,
                    creatureId: creature.id,
                    creatureName: creature.name,
                    action: interactionType,
                    result: `${creature.name} & ${partner.name} ${interaction.name.toLowerCase()}`,
                    icon: interaction.icon,
                    details: {
                        partner: partner.id,
                        partnerName: partner.name,
                        interactionType
                    },
                    notable: true
                });
            }
        });
    }

    /**
     * Determine interaction type between two creatures
     */
    determineInteractionType(creature1, creature2) {
        const energy1 = creature1.agent?.energy || 50;
        const energy2 = creature2.agent?.energy || 50;

        if (energy1 < 30 || energy2 < 30) {
            return 'rest_together';
        }

        const stage1 = creature1.lifecycle?.stage;
        const stage2 = creature2.lifecycle?.stage;
        if ((stage1 === 'elder' || stage2 === 'elder') &&
            (stage1 === 'baby' || stage1 === 'juvenile' ||
             stage2 === 'baby' || stage2 === 'juvenile')) {
            return 'teach';
        }

        const p1 = creature1.agent?.personality;
        const p2 = creature2.agent?.personality;

        if (p1 === 'curious' || p2 === 'curious') {
            return 'explore_together';
        }
        if (p1 === 'playful' || p2 === 'playful') {
            return 'play_together';
        }

        const types = ['play_together', 'explore_together', 'share_meal'];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Update relationship between two creatures
     */
    updateRelationship(creature1, creature2, interaction) {
        [creature1, creature2].forEach((c, idx) => {
            const other = idx === 0 ? creature2 : creature1;

            if (!c.agent.relationships) {
                c.agent.relationships = {};
            }

            if (!c.agent.relationships[other.id]) {
                c.agent.relationships[other.id] = {
                    familiarity: 0,
                    affection: 0,
                    lastInteraction: Date.now(),
                    interactionCount: 0,
                    sharedActivities: []
                };
            }

            const rel = c.agent.relationships[other.id];
            rel.familiarity = Math.min(100, rel.familiarity + interaction.familiarityGain);
            rel.affection = Math.min(100, Math.max(-100, rel.affection + interaction.affectionGain));
            rel.lastInteraction = Date.now();
            rel.interactionCount++;

            if (!rel.sharedActivities.includes(interaction.name)) {
                rel.sharedActivities.push(interaction.name);
            }
        });
    }

    /**
     * Save updated creature states back to GameState
     */
    saveCreatureStates(allCreatures, collection, activeCreature) {
        if (!window.GameState) return;

        if (activeCreature) {
            window.GameState.set('creature.agent', activeCreature.agent);
            if (activeCreature.stats) {
                window.GameState.set('creature.stats', activeCreature.stats);
            }
        }

        const updatedCollection = collection.map(c => {
            const updated = allCreatures.find(ac => ac.id === c.id);
            return updated || c;
        });

        window.GameState.set('creatures', updatedCollection);
        window.GameState.save?.();
    }

    /**
     * Get relationship level description
     */
    getRelationshipLevel(familiarity) {
        if (familiarity >= 81) return { level: 'Best Friends', icon: '💕' };
        if (familiarity >= 61) return { level: 'Close Friends', icon: '❤️' };
        if (familiarity >= 41) return { level: 'Friends', icon: '💛' };
        if (familiarity >= 21) return { level: 'Acquaintances', icon: '🤝' };
        return { level: 'Strangers', icon: '👋' };
    }

    /**
     * Get mood icon and description
     */
    getMoodInfo(mood) {
        const moods = {
            happy: { icon: '😊', color: '#00FF00' },
            content: { icon: '😌', color: '#88FF88' },
            tired: { icon: '😴', color: '#88CCFF' },
            lonely: { icon: '😢', color: '#9999FF' },
            sad: { icon: '😞', color: '#8888AA' },
            excited: { icon: '🤩', color: '#FFD700' }
        };
        return moods[mood] || moods.content;
    }

    /**
     * Format offline time for display
     */
    formatOfflineTime(minutes) {
        if (minutes < 60) return `${Math.round(minutes)} minutes`;
        if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
        return `${Math.round(minutes / 1440)} days`;
    }
}

const creatureAgent = new CreatureAgent();

if (typeof window !== 'undefined') {
    window.CreatureAgent = creatureAgent;
    console.log('[CreatureAgent] System initialized');
}

export default creatureAgent;

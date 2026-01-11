/**
 * BirthEventSystem - Handles rare events during creature birth/breeding
 *
 * Features:
 * - Ancient Lineage: Rare mystery creatures with unknown origins
 * - Birth Events: Special occurrences during breeding
 * - Secret Abilities: Unlocked through specific conditions
 */

class BirthEventSystem {
    constructor() {
        // Birth event definitions
        this.birthEvents = {
            // ===== COMMON EVENTS (20% total) =====
            favoredTrait: {
                id: 'favoredTrait',
                name: 'Favored Trait',
                chance: 0.10,
                rarity: 'common',
                effect: { traitBonus: true },
                message: '💜 Inherited a beloved trait!',
                description: 'One trait guaranteed from the stronger parent'
            },
            healthyBirth: {
                id: 'healthyBirth',
                name: 'Healthy Birth',
                chance: 0.10,
                rarity: 'common',
                effect: { statBonus: 0.10 },
                message: '✨ Born with extra vitality!',
                description: '+10% to all starting stats'
            },

            // ===== UNCOMMON EVENTS (8% total) =====
            cosmicBlessing: {
                id: 'cosmicBlessing',
                name: 'Cosmic Blessing',
                chance: 0.05,
                rarity: 'uncommon',
                effect: { cosmicPowerMultiplier: 2.0 },
                message: '🌟 Blessed by the cosmos!',
                description: 'Double cosmic affinity power'
            },
            dualAffinity: {
                id: 'dualAffinity',
                name: 'Dual Affinity',
                chance: 0.03,
                rarity: 'uncommon',
                effect: { dualAffinity: true },
                message: '🔮 Born with dual cosmic affinity!',
                description: 'Inherits BOTH parent affinities'
            },

            // ===== RARE EVENTS (2% total) =====
            mutationJackpot: {
                id: 'mutationJackpot',
                name: 'Mutation Jackpot',
                chance: 0.01,
                rarity: 'rare',
                effect: { guaranteedMutations: 3 },
                message: '🧬 Genetic miracle!',
                description: '3 mutations guaranteed'
            },
            ancestralEcho: {
                id: 'ancestralEcho',
                name: 'Ancestral Echo',
                chance: 0.01,
                rarity: 'rare',
                effect: { ancestralTrait: true },
                message: '👻 Ancestral memories awaken!',
                description: 'Gains a trait from grandparent generation'
            },

            // ===== ULTRA RARE EVENTS (0.5% total) =====
            twinBirth: {
                id: 'twinBirth',
                name: 'Twin Birth',
                chance: 0.002,
                rarity: 'ultraRare',
                effect: { twins: true },
                message: '👶👶 TWINS!',
                description: 'Two offspring instead of one!'
            },
            shinyVariant: {
                id: 'shinyVariant',
                name: 'Shiny Variant',
                chance: 0.002,
                rarity: 'ultraRare',
                effect: { shiny: true, rarityUpgrade: 1 },
                message: '✨ A SHINY was born!',
                description: 'Unique shimmer effect, +1 rarity tier'
            },
            ancientLineage: {
                id: 'ancientLineage',
                name: 'Ancient Lineage',
                chance: 0.001,
                rarity: 'ultraRare',
                effect: { ancientLineage: true },
                message: '🌌 Born with ancient memories...',
                description: 'Mysterious +2-4 generation, special bonuses'
            },

            // ===== LEGENDARY EVENTS (0.1%) =====
            prophecyChild: {
                id: 'prophecyChild',
                name: 'Child of Prophecy',
                chance: 0.001,
                rarity: 'legendary',
                effect: { prophecy: true, legendaryGuarantee: true },
                message: '📜 A child of prophecy!',
                description: 'Legendary rarity guaranteed + unique destiny'
            }
        };

        // Secret abilities that can be unlocked
        this.secretAbilities = {
            // Combat Abilities
            voidStrike: {
                id: 'voidStrike',
                name: 'Void Strike',
                description: 'Phase through enemy defenses',
                unlockCondition: { affinity: 'void', minGeneration: 3 },
                chance: 0.15,
                effect: { damageBonus: 1.5, ignoreDefense: true },
                icon: '🌀'
            },
            crystalShield: {
                id: 'crystalShield',
                name: 'Crystal Shield',
                description: 'Temporary invulnerability',
                unlockCondition: { species: 'crystalElemental', minRarity: 'rare' },
                chance: 0.12,
                effect: { duration: 3000, absorb: 50 },
                icon: '💎'
            },
            novaBlast: {
                id: 'novaBlast',
                name: 'Nova Blast',
                description: 'Powerful area attack',
                unlockCondition: { affinity: 'star', minGeneration: 2 },
                chance: 0.10,
                effect: { aoeRadius: 150, damage: 2.0 },
                icon: '💥'
            },

            // Utility Abilities
            treasureScent: {
                id: 'treasureScent',
                name: 'Treasure Scent',
                description: 'Reveals hidden items on map',
                unlockCondition: { personality: 'curious', hasMutation: 'extra_eyes' },
                chance: 0.20,
                effect: { revealRange: 200 },
                icon: '👃'
            },
            swiftPaws: {
                id: 'swiftPaws',
                name: 'Swift Paws',
                description: '+25% movement speed',
                unlockCondition: { personality: 'energetic', minGeneration: 2 },
                chance: 0.18,
                effect: { speedBonus: 0.25 },
                icon: '⚡'
            },
            gentleAura: {
                id: 'gentleAura',
                name: 'Gentle Aura',
                description: 'Creatures heal faster when nearby',
                unlockCondition: { personality: 'gentle', affinity: 'moon' },
                chance: 0.15,
                effect: { healingBonus: 0.5, range: 100 },
                icon: '💚'
            },

            // Passive Abilities
            cosmicResonance: {
                id: 'cosmicResonance',
                name: 'Cosmic Resonance',
                description: 'Double XP when matching affinity biome',
                unlockCondition: { dualAffinity: true },
                chance: 0.25,
                effect: { xpMultiplier: 2 },
                icon: '🌈'
            },
            bloodlineMemory: {
                id: 'bloodlineMemory',
                name: 'Bloodline Memory',
                description: '+5% stats per generation',
                unlockCondition: { minGeneration: 4 },
                chance: 0.20,
                effect: { statBonusPerGen: 0.05 },
                icon: '🧬'
            },

            // LEGENDARY Abilities
            timeWarp: {
                id: 'timeWarp',
                name: 'Time Warp',
                description: 'Aging and cooldowns reduced 50%',
                unlockCondition: { minGeneration: 5, minRarity: 'legendary' },
                chance: 0.05,
                effect: { ageSpeedMultiplier: 0.5, cooldownMultiplier: 0.5 },
                icon: '⏰'
            },
            cosmicGuardian: {
                id: 'cosmicGuardian',
                name: 'Cosmic Guardian',
                description: 'Immune to negative status effects',
                unlockCondition: { species: 'cosmicGuardian', minGeneration: 3 },
                chance: 0.08,
                effect: { statusImmunity: true },
                icon: '🛡️'
            }
        };

        // Ancient lineage prophecies/lore
        this.ancientProphecies = [
            "Born under the Void Eclipse, this creature carries memories of a forgotten cosmic era...",
            "The stars aligned for this birth - ancient powers stir within...",
            "A soul from the First Generation has returned in new form...",
            "This creature dreams of worlds that existed before time...",
            "The cosmic ancestors smile upon this newborn...",
            "Ancient constellations inscribed upon its essence...",
            "Whispers of primordial power echo in its blood...",
            "A child of the original starfire, reborn anew..."
        ];
    }

    /**
     * Roll for birth events during breeding
     * @param {Object} parent1 - First parent data
     * @param {Object} parent2 - Second parent data
     * @param {string} offspringRarity - Determined offspring rarity
     * @returns {Object} Object containing triggered events and their effects
     */
    rollBirthEvents(parent1, parent2, offspringRarity) {
        const triggeredEvents = [];
        const totalEffects = {
            statBonus: 0,
            cosmicPowerMultiplier: 1,
            guaranteedMutations: 0,
            rarityUpgrade: 0,
            dualAffinity: false,
            twins: false,
            shiny: false,
            ancientLineage: false,
            prophecy: false,
            legendaryGuarantee: false
        };

        // Calculate generation for modifiers
        const maxParentGen = Math.max(parent1?.generation || 1, parent2?.generation || 1);

        Object.values(this.birthEvents).forEach(event => {
            let chance = event.chance;

            // Modify chances based on conditions
            if (maxParentGen >= 3) chance *= 1.2; // Higher gen = more events
            if (maxParentGen >= 4) chance *= 1.3;
            if (offspringRarity === 'epic') chance *= 1.5;
            if (offspringRarity === 'legendary') chance *= 2;

            // Check for dual affinity prerequisite
            if (event.id === 'dualAffinity') {
                const p1Affinity = parent1?.cosmicAffinity?.element || parent1?.genes?.cosmicAffinity?.element;
                const p2Affinity = parent2?.cosmicAffinity?.element || parent2?.genes?.cosmicAffinity?.element;
                if (p1Affinity === p2Affinity) {
                    chance = 0; // Can't have dual affinity if parents have same affinity
                }
            }

            if (Math.random() < chance) {
                triggeredEvents.push({
                    ...event,
                    triggeredAt: Date.now()
                });

                // Accumulate effects
                if (event.effect.statBonus) totalEffects.statBonus += event.effect.statBonus;
                if (event.effect.cosmicPowerMultiplier) totalEffects.cosmicPowerMultiplier *= event.effect.cosmicPowerMultiplier;
                if (event.effect.guaranteedMutations) totalEffects.guaranteedMutations = Math.max(totalEffects.guaranteedMutations, event.effect.guaranteedMutations);
                if (event.effect.rarityUpgrade) totalEffects.rarityUpgrade += event.effect.rarityUpgrade;
                if (event.effect.dualAffinity) totalEffects.dualAffinity = true;
                if (event.effect.twins) totalEffects.twins = true;
                if (event.effect.shiny) totalEffects.shiny = true;
                if (event.effect.ancientLineage) totalEffects.ancientLineage = true;
                if (event.effect.prophecy) totalEffects.prophecy = true;
                if (event.effect.legendaryGuarantee) totalEffects.legendaryGuarantee = true;
            }
        });

        return {
            events: triggeredEvents,
            effects: totalEffects,
            hasRareEvent: triggeredEvents.some(e => ['rare', 'ultraRare', 'legendary'].includes(e.rarity))
        };
    }

    /**
     * Roll for Ancient Lineage on fresh egg hatch (Easter egg)
     * @returns {Object|null} Ancient lineage data or null
     */
    rollAncientLineage() {
        const ANCIENT_LINEAGE_CHANCE = 0.005; // 0.5% chance (1 in 200)

        if (Math.random() < ANCIENT_LINEAGE_CHANCE) {
            const generation = Phaser.Math.Between(2, 5);
            const prophecy = this.ancientProphecies[Math.floor(Math.random() * this.ancientProphecies.length)];

            return {
                triggered: true,
                generation: generation,
                isOffspring: true,
                parentIds: ['ancient_unknown', 'ancient_unknown'],
                offspringBonus: {
                    cosmicPower: 1.0 + (generation * 0.05),
                    description: `🌌 Ancient Lineage (Gen ${generation})`
                },
                hasAncientLineage: true,
                prophecy: prophecy,
                message: '🌌 This creature carries memories from a forgotten age...'
            };
        }

        return null;
    }

    /**
     * Check and unlock secret abilities for a creature
     * @param {Object} creature - Creature data
     * @returns {Array} Array of unlocked abilities
     */
    checkSecretAbilities(creature) {
        const unlockedAbilities = [];
        const existingAbilities = creature.secretAbilities || [];

        Object.values(this.secretAbilities).forEach(ability => {
            // Skip if already has this ability
            if (existingAbilities.some(a => a.id === ability.id)) return;

            // Check unlock conditions
            if (this.meetsAbilityCondition(creature, ability.unlockCondition)) {
                if (Math.random() < ability.chance) {
                    unlockedAbilities.push({
                        ...ability,
                        unlockedAt: Date.now()
                    });
                }
            }
        });

        return unlockedAbilities;
    }

    /**
     * Check if creature meets ability unlock conditions
     */
    meetsAbilityCondition(creature, condition) {
        if (!condition) return false;

        // Check affinity
        if (condition.affinity) {
            const creatureAffinity = creature.cosmicAffinity?.element ||
                                     creature.genes?.cosmicAffinity?.element;
            if (creatureAffinity !== condition.affinity) return false;
        }

        // Check minimum generation
        if (condition.minGeneration) {
            if ((creature.generation || 1) < condition.minGeneration) return false;
        }

        // Check species
        if (condition.species) {
            const creatureSpecies = creature.species || creature.genes?.species;
            if (creatureSpecies !== condition.species) return false;
        }

        // Check minimum rarity
        if (condition.minRarity) {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const creatureRarityIdx = rarities.indexOf(creature.rarity || creature.genes?.rarity || 'common');
            const minRarityIdx = rarities.indexOf(condition.minRarity);
            if (creatureRarityIdx < minRarityIdx) return false;
        }

        // Check personality
        if (condition.personality) {
            const creaturePersonality = creature.personality?.core || creature.personality;
            if (creaturePersonality !== condition.personality) return false;
        }

        // Check for specific mutation
        if (condition.hasMutation) {
            const mutations = creature.genes?.traits?.features?.wackyMutations || [];
            if (!mutations.some(m => m.type === condition.hasMutation)) return false;
        }

        // Check dual affinity
        if (condition.dualAffinity) {
            if (!creature.hasDualAffinity) return false;
        }

        return true;
    }

    /**
     * Apply birth event effects to offspring data
     * @param {Object} offspringData - The offspring data to modify
     * @param {Object} birthResult - Result from rollBirthEvents
     * @param {Object} parent1 - First parent
     * @param {Object} parent2 - Second parent
     * @returns {Object} Modified offspring data
     */
    applyBirthEffects(offspringData, birthResult, parent1, parent2) {
        const effects = birthResult.effects;

        // Apply stat bonus
        if (effects.statBonus > 0 && offspringData.stats) {
            const bonus = 1 + effects.statBonus;
            offspringData.stats.happiness = Math.min(100, Math.round(offspringData.stats.happiness * bonus));
            offspringData.stats.energy = Math.min(100, Math.round(offspringData.stats.energy * bonus));
            offspringData.stats.health = Math.min(100, Math.round(offspringData.stats.health * bonus));
        }

        // Apply cosmic power multiplier
        if (effects.cosmicPowerMultiplier > 1 && offspringData.offspringBonus) {
            offspringData.offspringBonus.cosmicPower *= effects.cosmicPowerMultiplier;
        }

        // Apply rarity upgrade
        if (effects.rarityUpgrade > 0) {
            const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            const currentIdx = rarities.indexOf(offspringData.rarity || 'common');
            const newIdx = Math.min(currentIdx + effects.rarityUpgrade, rarities.length - 1);
            offspringData.rarity = rarities[newIdx];
        }

        // Apply dual affinity
        if (effects.dualAffinity) {
            const p1Affinity = parent1?.cosmicAffinity?.element || parent1?.genes?.cosmicAffinity?.element;
            const p2Affinity = parent2?.cosmicAffinity?.element || parent2?.genes?.cosmicAffinity?.element;

            if (p1Affinity && p2Affinity && p1Affinity !== p2Affinity) {
                offspringData.dualAffinity = {
                    primary: p1Affinity,
                    secondary: p2Affinity
                };
                offspringData.hasDualAffinity = true;
            }
        }

        // Apply shiny
        if (effects.shiny) {
            offspringData.isShiny = true;
            offspringData.visualEffects = offspringData.visualEffects || [];
            offspringData.visualEffects.push('shiny_sparkle');
        }

        // Apply legendary guarantee
        if (effects.legendaryGuarantee) {
            offspringData.rarity = 'legendary';
        }

        // Store triggered events
        offspringData.birthEvents = birthResult.events.map(e => ({
            id: e.id,
            name: e.name,
            message: e.message,
            rarity: e.rarity,
            triggeredAt: e.triggeredAt
        }));

        return offspringData;
    }

    /**
     * Generate Ancient Lineage parent cards for profile display
     */
    getAncientLineageDisplay() {
        return {
            emoji: '✨',
            title: 'Ancient Ancestor',
            subtitle: 'Origins Unknown',
            color: '#9B59B6',
            particleEffect: 'cosmic_shimmer'
        };
    }

    /**
     * Get display info for a birth event
     */
    getBirthEventDisplay(eventId) {
        const event = this.birthEvents[eventId];
        if (!event) return null;

        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00AA00',
            rare: '#0066FF',
            ultraRare: '#AA00AA',
            legendary: '#FFD700'
        };

        return {
            ...event,
            color: rarityColors[event.rarity] || '#FFFFFF'
        };
    }
}

// Create singleton and export
window.BirthEventSystem = window.BirthEventSystem || new BirthEventSystem();

export default BirthEventSystem;

/**
 * DevTools - Development utilities for testing
 *
 * Usage from browser console:
 *   DevTools.ageCreature('adult')     - Age active creature to adult
 *   DevTools.ageAllToAdult()          - Age all creatures in collection to adult
 *   DevTools.addTestCreature()        - Add a random adult creature for breeding
 *   DevTools.setCreatureStage(0, 'baby') - Set specific creature's stage
 *   DevTools.listCreatures()          - Show all creatures in collection
 *   DevTools.skipDay(7)               - Skip forward N days
 */

class DevTools {
    constructor() {
        this.enabled = import.meta.env.DEV;
    }

    /**
     * Age the active creature to a specific stage
     * @param {string} targetStage - 'baby', 'juvenile', 'adult', 'elder'
     */
    ageCreature(targetStage = 'adult') {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const stageDays = {
            baby: 0,
            juvenile: 1,
            adult: 3,
            elder: 10
        };

        const daysNeeded = stageDays[targetStage] || 3;
        const newBirthDate = Date.now() - (daysNeeded * 24 * 60 * 60 * 1000);

        // Update active creature slot
        const lifecycle = window.GameState?.get('creature.lifecycle') || {};
        lifecycle.birthDate = newBirthDate;
        lifecycle.stage = targetStage;
        lifecycle.lastStageChange = Date.now();

        window.GameState?.set('creature.lifecycle', lifecycle);

        // ALSO update the creature in the collection (critical for FusionPod eligibility)
        const creatures = window.GameState?.get('creatures') || [];
        const activeIndex = window.GameState?.get('activeCreatureIndex') || 0;
        if (creatures[activeIndex]) {
            if (!creatures[activeIndex].lifecycle) {
                creatures[activeIndex].lifecycle = { evolutionHistory: [] };
            }
            creatures[activeIndex].lifecycle.birthDate = newBirthDate;
            creatures[activeIndex].lifecycle.stage = targetStage;
            creatures[activeIndex].lifecycle.lastStageChange = Date.now();
            window.GameState?.set('creatures', creatures);
        }

        window.GameState?.save?.();

        console.log(`✅ [DevTools] Active creature aged to ${targetStage} (birthDate set to ${daysNeeded} days ago)`);
        console.log(`✅ [DevTools] Updated both active slot AND collection index ${activeIndex}`);
        return { stage: targetStage, birthDate: new Date(newBirthDate).toISOString() };
    }

    /**
     * Age all creatures in collection to adult stage
     */
    ageAllToAdult() {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const creatures = window.GameState?.get('creatures') || [];
        const adultBirthDate = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago

        creatures.forEach((creature, index) => {
            if (creature.lifecycle) {
                creature.lifecycle.birthDate = adultBirthDate;
                creature.lifecycle.stage = 'adult';
                creature.lifecycle.lastStageChange = Date.now();
            } else {
                creature.lifecycle = {
                    birthDate: adultBirthDate,
                    stage: 'adult',
                    lastStageChange: Date.now(),
                    evolutionHistory: []
                };
            }
        });

        window.GameState?.set('creatures', creatures);

        // Also age active creature
        this.ageCreature('adult');

        console.log(`✅ [DevTools] All ${creatures.length} creatures aged to adult`);
        return creatures.map(c => ({ name: c.name, stage: c.lifecycle?.stage }));
    }

    /**
     * Add a test creature to collection (instant adult for breeding)
     */
    addTestCreature(name = null) {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const testNames = ['Stardust', 'Moonglow', 'Nebulite', 'Voidling', 'Cosmix', 'Sparkle'];
        const testName = name || testNames[Math.floor(Math.random() * testNames.length)] + Math.floor(Math.random() * 100);

        // Generate random genes
        let genes = null;
        if (window.CreatureGenetics) {
            genes = window.CreatureGenetics.generateCreature({ rarity: 'rare' });
        }

        const adultBirthDate = Date.now() - (3 * 24 * 60 * 60 * 1000);

        const testCreature = {
            id: `test_creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: testName,
            genes: genes,
            dna: genes,
            personality: 'playful',
            personalityState: null,
            stats: { happiness: 100, energy: 100, health: 100 },
            level: 5,
            experience: 500,
            textureName: null,
            hatchTime: adultBirthDate,
            lifecycle: {
                birthDate: adultBirthDate,
                stage: 'adult',
                lastStageChange: Date.now(),
                evolutionHistory: []
            },
            cosmicAffinity: genes?.cosmicAffinity || { element: 'star', power: 50 },
            rarity: genes?.rarity || 'rare',
            addedAt: Date.now(),
            generation: 1
        };

        const added = window.GameState?.addCreatureToCollection?.(testCreature);

        if (added) {
            console.log(`✅ [DevTools] Added test creature: ${testName} (adult, rare)`);
            return testCreature;
        } else {
            console.error('❌ [DevTools] Failed to add creature (collection might be full)');
            return null;
        }
    }

    /**
     * Set a specific creature's stage by collection index
     */
    setCreatureStage(index, stage) {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const creatures = window.GameState?.get('creatures') || [];

        if (index < 0 || index >= creatures.length) {
            console.error(`❌ [DevTools] Invalid index ${index}. Collection has ${creatures.length} creatures.`);
            return;
        }

        const stageDays = {
            baby: 0,
            juvenile: 1,
            adult: 3,
            elder: 10
        };

        const daysNeeded = stageDays[stage] || 0;
        const newBirthDate = Date.now() - (daysNeeded * 24 * 60 * 60 * 1000);

        if (!creatures[index].lifecycle) {
            creatures[index].lifecycle = { evolutionHistory: [] };
        }

        creatures[index].lifecycle.birthDate = newBirthDate;
        creatures[index].lifecycle.stage = stage;
        creatures[index].lifecycle.lastStageChange = Date.now();

        window.GameState?.set('creatures', creatures);
        window.GameState?.save?.();

        console.log(`✅ [DevTools] Creature ${index} (${creatures[index].name}) set to ${stage}`);
        return { name: creatures[index].name, stage };
    }

    /**
     * List all creatures in collection with their stages
     */
    listCreatures() {
        const creatures = window.GameState?.get('creatures') || [];
        const activeCreature = {
            name: window.GameState?.get('creature.name'),
            stage: window.GameState?.get('creature.lifecycle.stage') || 'unknown'
        };

        console.log('\n📋 [DevTools] Creature Collection:');
        console.log('─'.repeat(50));
        console.log(`Active: ${activeCreature.name} (${activeCreature.stage})`);
        console.log('─'.repeat(50));

        if (creatures.length === 0) {
            console.log('  No creatures in collection');
        } else {
            creatures.forEach((c, i) => {
                const stage = c.lifecycle?.stage || 'unknown';
                const gen = c.generation || 1;
                const rarity = c.rarity || 'common';
                console.log(`  [${i}] ${c.name} - ${stage} | Gen ${gen} | ${rarity}`);
            });
        }
        console.log('─'.repeat(50));
        console.log(`Total in collection: ${creatures.length}/8`);

        return { active: activeCreature, collection: creatures };
    }

    /**
     * Skip forward N days (affects all creature ages)
     */
    skipDays(days = 1) {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const msToSubtract = days * 24 * 60 * 60 * 1000;

        // Update active creature
        const lifecycle = window.GameState?.get('creature.lifecycle');
        if (lifecycle) {
            lifecycle.birthDate -= msToSubtract;
            window.GameState?.set('creature.lifecycle', lifecycle);
        }

        // Update collection creatures
        const creatures = window.GameState?.get('creatures') || [];
        creatures.forEach(c => {
            if (c.lifecycle) {
                c.lifecycle.birthDate -= msToSubtract;
            }
            if (c.hatchTime) {
                c.hatchTime -= msToSubtract;
            }
        });
        window.GameState?.set('creatures', creatures);
        window.GameState?.save?.();

        console.log(`✅ [DevTools] Skipped ${days} day(s) forward. Creatures are now ${days} day(s) older.`);

        // Trigger lifecycle check
        if (window.CreatureLifecycle) {
            window.CreatureLifecycle.checkEvolution?.();
        }

        return { daysskipped: days };
    }

    /**
     * Quick setup for breeding test - adds 2 adult creatures
     */
    setupBreedingTest() {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        console.log('🧪 [DevTools] Setting up breeding test environment...');

        // Age active creature to adult
        this.ageCreature('adult');

        // Check current collection
        const creatures = window.GameState?.get('creatures') || [];

        if (creatures.length < 1) {
            // Add test creature if collection is empty
            this.addTestCreature('TestMate1');
        }

        // Age all to adult
        this.ageAllToAdult();

        // List final state
        this.listCreatures();

        console.log('\n✅ [DevTools] Breeding test ready!');
        console.log('   - Open Breeding Shrine to test');
        console.log('   - All creatures are now adults');

        return true;
    }

    /**
     * Simulate being offline for a given duration to test welcome back feature
     * @param {number} hours - Hours to simulate being offline
     */
    simulateOffline(hours = 2) {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        const msAgo = hours * 60 * 60 * 1000;
        const fakeLastActivity = Date.now() - msAgo;

        window.GameState?.set('session.lastActivityTime', fakeLastActivity);
        window.GameState?.save?.();

        console.log(`✅ [DevTools] Simulated ${hours} hours offline`);
        console.log('   - Reload the page to see the Welcome Back screen');
        console.log(`   - Last activity set to: ${new Date(fakeLastActivity).toLocaleString()}`);

        return { hoursOffline: hours, lastActivity: new Date(fakeLastActivity).toISOString() };
    }

    /**
     * Trigger the welcome back screen immediately (for testing)
     */
    showWelcomeBack() {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        if (!window.CreatureAgent) {
            console.error('❌ [DevTools] CreatureAgent not available');
            return;
        }

        // Generate some test events
        const testEvents = [
            {
                time: Date.now() - 3600000,
                creatureName: window.GameState?.get('creature.name') || 'Your creature',
                action: 'exploring',
                result: 'Found 3 Cosmic Crystals!',
                icon: '💎',
                notable: true
            },
            {
                time: Date.now() - 7200000,
                creatureName: window.GameState?.get('creature.name') || 'Your creature',
                action: 'playing',
                result: 'Had a great time playing!',
                icon: '🎮',
                notable: true
            },
            {
                time: Date.now() - 10800000,
                creatureName: 'A friend',
                action: 'socializing',
                result: 'Made a new friend!',
                icon: '💕',
                notable: true
            }
        ];

        // Get the current scene
        const game = window.mythicalGame;
        if (!game) {
            console.error('❌ [DevTools] Game not available');
            return;
        }

        const currentScene = game.scene.getScenes(true)[0];
        if (currentScene) {
            currentScene.scene.stop();
            currentScene.scene.start('WelcomeBackScene', {
                events: testEvents,
                offlineMinutes: 180, // 3 hours
                returnScene: 'GameScene'
            });
            console.log('✅ [DevTools] Showing Welcome Back screen with test events');
        }

        return testEvents;
    }

    /**
     * Run creature simulation manually (useful for debugging)
     * @param {number} minutes - Minutes to simulate
     */
    runSimulation(minutes = 60) {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        if (!window.CreatureAgent) {
            console.error('❌ [DevTools] CreatureAgent not available');
            return;
        }

        console.log(`🔄 [DevTools] Running ${minutes} minute simulation...`);
        const results = window.CreatureAgent.simulateOfflineActivities(minutes);

        console.log('\\n📋 [DevTools] Simulation Results:');
        console.log('─'.repeat(50));
        console.log(`Time simulated: ${minutes} minutes`);
        console.log(`Total events: ${results.events.length}`);

        if (results.events.length > 0) {
            console.log('\\nNotable events:');
            results.events.forEach((event, idx) => {
                console.log(`  ${event.icon} ${event.creatureName}: ${event.result}`);
            });
        } else {
            console.log('  No notable events occurred');
        }
        console.log('─'.repeat(50));

        return results;
    }

    /**
     * Initialize agent state for all creatures
     */
    initAgentStates() {
        if (!this.enabled) {
            console.warn('[DevTools] Only available in development mode');
            return;
        }

        if (!window.CreatureAgent) {
            console.error('❌ [DevTools] CreatureAgent not available');
            return;
        }

        const creatures = window.GameState?.get('creatures') || [];

        creatures.forEach((creature, idx) => {
            window.CreatureAgent.ensureAgentState(creature);
            console.log(`✅ Initialized agent state for ${creature.name}`);
        });

        window.GameState?.set('creatures', creatures);

        // Also initialize active creature
        const activeAgent = window.GameState?.get('creature.agent');
        if (!activeAgent) {
            const personality = window.GameState?.get('creature.personality');
            const newAgent = window.CreatureAgent.initializeAgentState({}, personality);
            window.GameState?.set('creature.agent', newAgent.agent);
            console.log('✅ Initialized agent state for active creature');
        }

        window.GameState?.save?.();
        console.log(`\\n✅ [DevTools] Agent states initialized for ${creatures.length + 1} creatures`);

        return { count: creatures.length + 1 };
    }

    /**
     * Show help
     */
    help() {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║                     DevTools Commands                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  DevTools.ageCreature('adult')                                 ║
║    → Age active creature to specified stage                    ║
║                                                                ║
║  DevTools.ageAllToAdult()                                      ║
║    → Age ALL creatures to adult stage                          ║
║                                                                ║
║  DevTools.addTestCreature('Name')                              ║
║    → Add a random adult creature for breeding                  ║
║                                                                ║
║  DevTools.setCreatureStage(0, 'elder')                         ║
║    → Set creature at index 0 to elder stage                    ║
║                                                                ║
║  DevTools.listCreatures()                                      ║
║    → List all creatures and their stages                       ║
║                                                                ║
║  DevTools.skipDays(7)                                          ║
║    → Skip forward 7 days (ages all creatures)                  ║
║                                                                ║
║  DevTools.setupBreedingTest()                                  ║
║    → Quick setup: 2 adult creatures ready to breed             ║
║                                                                ║
║  DevTools.simulateOffline(2)                                   ║
║    → Simulate 2 hours offline (reload to test)                 ║
║                                                                ║
║  DevTools.showWelcomeBack()                                    ║
║    → Show Welcome Back screen with test events                 ║
║                                                                ║
║  DevTools.runSimulation(60)                                    ║
║    → Run 60-minute creature simulation                         ║
║                                                                ║
║  DevTools.initAgentStates()                                    ║
║    → Initialize AI agent state for all creatures               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
        `);
    }
}

// Create singleton and expose globally
const devTools = new DevTools();

if (typeof window !== 'undefined') {
    window.DevTools = devTools;

    // Log availability in dev mode
    if (import.meta.env.DEV) {
        console.log('🔧 DevTools available! Type DevTools.help() for commands');
    }
}

export default devTools;

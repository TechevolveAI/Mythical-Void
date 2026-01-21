/**
 * SoulPhraseGenerator - Generates unique, poetic soul phrases for creatures
 *
 * Combines personality core, cosmic affinity, and poetic elements to create
 * 1,250+ unique soul phrases that feel crafted, not templated.
 *
 * Formula: [Nature] + [Action] + [Poetic Element]
 */

import { devLog } from '../utils/devLogger.js';

class SoulPhraseGenerator {
    constructor() {
        this.initialized = false;
        this.phraseConfig = null;
    }

    /**
     * Initialize with phrase configuration
     */
    async initialize(config = null) {
        if (this.initialized) return;

        if (config) {
            this.phraseConfig = config;
        } else {
            // Use default embedded config
            this.phraseConfig = this.getDefaultConfig();
        }

        this.initialized = true;
        devLog('[SoulPhraseGenerator] Initialized with',
            Object.keys(this.phraseConfig.natures).length, 'personality types,',
            Object.keys(this.phraseConfig.actions).length, 'affinity types,',
            this.phraseConfig.poeticElements.length, 'poetic elements'
        );
    }

    /**
     * Generate a unique soul phrase for a creature
     * @param {string} personalityCore - curious, playful, gentle, wise, energetic
     * @param {string} cosmicAffinity - star, moon, nebula, crystal, void
     * @param {string} rarity - common, uncommon, rare, epic, legendary
     * @returns {object} { phrase, nature, action, element }
     */
    generate(personalityCore, cosmicAffinity, rarity = 'common') {
        if (!this.initialized) {
            this.initialize();
        }

        const nature = this.selectNature(personalityCore, rarity);
        const action = this.selectAction(cosmicAffinity, rarity);
        const element = this.selectPoeticElement(rarity);

        // Construct the phrase
        const phrase = `${nature} ${action} ${element}`;

        devLog('[SoulPhraseGenerator] Generated:', phrase);

        return {
            phrase,
            nature,
            action,
            element,
            personalityCore,
            cosmicAffinity
        };
    }

    /**
     * Select a nature phrase based on personality core
     */
    selectNature(personalityCore, rarity) {
        const natures = this.phraseConfig.natures[personalityCore] || this.phraseConfig.natures.curious;

        // Higher rarities get access to more poetic/rare nature phrases
        const rarityIndex = this.getRarityIndex(rarity);
        const availableNatures = natures.slice(0, Math.min(natures.length, 3 + rarityIndex * 2));

        return this.randomFrom(availableNatures);
    }

    /**
     * Select an action phrase based on cosmic affinity
     */
    selectAction(cosmicAffinity, rarity) {
        const actions = this.phraseConfig.actions[cosmicAffinity] || this.phraseConfig.actions.star;

        const rarityIndex = this.getRarityIndex(rarity);
        const availableActions = actions.slice(0, Math.min(actions.length, 3 + rarityIndex * 2));

        return this.randomFrom(availableActions);
    }

    /**
     * Select a poetic element (the ending flourish)
     */
    selectPoeticElement(rarity) {
        const elements = this.phraseConfig.poeticElements;

        // Higher rarities can access the full pool including rare elements
        const rarityIndex = this.getRarityIndex(rarity);
        const poolSize = Math.min(elements.length, 20 + rarityIndex * 10);
        const availableElements = elements.slice(0, poolSize);

        return this.randomFrom(availableElements);
    }

    /**
     * Get rarity as numeric index for calculations
     */
    getRarityIndex(rarity) {
        const rarities = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
        return rarities[rarity] || 0;
    }

    /**
     * Random selection from array
     */
    randomFrom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Generate a short title based on personality (for UI badges)
     */
    generateTitle(personalityCore) {
        const titles = this.phraseConfig.titles[personalityCore] || ['Soul'];
        return this.randomFrom(titles);
    }

    /**
     * Get the emoji for a cosmic affinity
     */
    getAffinityEmoji(cosmicAffinity) {
        const emojis = {
            star: '☀️',
            moon: '🌙',
            nebula: '🌌',
            crystal: '💎',
            void: '🌑'
        };
        return emojis[cosmicAffinity] || '✨';
    }

    /**
     * Get display name for cosmic affinity
     */
    getAffinityName(cosmicAffinity) {
        const names = {
            star: 'Star Soul',
            moon: 'Moon Soul',
            nebula: 'Nebula Soul',
            crystal: 'Crystal Soul',
            void: 'Void Soul'
        };
        return names[cosmicAffinity] || 'Cosmic Soul';
    }

    /**
     * Default phrase configuration
     */
    getDefaultConfig() {
        return {
            // Nature phrases by personality core (ordered common → rare)
            natures: {
                curious: [
                    'A restless seeker who',
                    'An eternal questioner who',
                    'A wandering spirit who',
                    'A boundless explorer who',
                    'An insatiable dreamer who',
                    'A truth-hunter who',
                    'An unquiet soul who',
                    'A mystery-chaser who'
                ],
                playful: [
                    'A mischievous spark who',
                    'A joyful trickster who',
                    'A dancing soul who',
                    'A wild heart who',
                    'An untamed spirit who',
                    'A chaos-weaver who',
                    'A laughter-bringer who',
                    'A wonder-maker who'
                ],
                gentle: [
                    'A tender heart who',
                    'A peaceful guardian who',
                    'A soft whisper who',
                    'A quiet blessing who',
                    'A healing presence who',
                    'A serene wanderer who',
                    'A comfort-giver who',
                    'A kindness-keeper who'
                ],
                wise: [
                    'An ancient knowing who',
                    'A patient watcher who',
                    'A deep thinker who',
                    'A silent sage who',
                    'A truth-keeper who',
                    'A star-reader who',
                    'A fate-weaver who',
                    'A memory-holder who'
                ],
                energetic: [
                    'A blazing comet who',
                    'An untamed force who',
                    'A wild flame who',
                    'A storm-born spirit who',
                    'A lightning soul who',
                    'A chaos-dancer who',
                    'A fury-blessed who',
                    'An unstoppable tide who'
                ]
            },

            // Action phrases by cosmic affinity (ordered common → rare)
            actions: {
                star: [
                    'chases starlight',
                    'follows the dawn',
                    'gathers scattered light',
                    'burns with inner fire',
                    'ignites the darkness',
                    'carries the sun\'s memory',
                    'speaks to distant suns',
                    'weaves golden threads'
                ],
                moon: [
                    'dances with shadows',
                    'walks twilight paths',
                    'dreams in silver',
                    'guards the night\'s secrets',
                    'reflects hidden truths',
                    'whispers to the tides',
                    'knows the dark\'s comfort',
                    'embraces the unseen'
                ],
                nebula: [
                    'weaves cosmic threads',
                    'breathes stardust',
                    'paints the void',
                    'shapes unborn worlds',
                    'carries creation\'s spark',
                    'drifts between realities',
                    'holds infinite colors',
                    'births new possibilities'
                ],
                crystal: [
                    'shapes destiny',
                    'reflects inner truth',
                    'grows from within',
                    'channels ancient power',
                    'resonates with the earth',
                    'holds time in stillness',
                    'focuses scattered light',
                    'remembers every touch'
                ],
                void: [
                    'embraces the mystery',
                    'transcends all boundaries',
                    'knows the depths',
                    'walks between worlds',
                    'carries infinite silence',
                    'touches the unknowable',
                    'holds space for becoming',
                    'transforms through darkness'
                ]
            },

            // Poetic elements (endings) - ordered common → rare
            poeticElements: [
                // Common (accessible to all)
                'through forgotten paths',
                'beneath ancient skies',
                'in the space between moments',
                'where light meets shadow',
                'until the world remembers',
                'across endless horizons',
                'through whispered dreams',
                'in the hush of dawn',
                'where others fear to wonder',
                'through veils of time',
                'in the breath of stars',
                'across sleeping mountains',
                'through crystalline silence',
                'where echoes are born',
                'in the heart of stillness',
                'through gardens of light',
                'where hope takes root',
                'in the dance of seasons',
                'through doors left ajar',
                'where stories begin',

                // Uncommon+ (20-30)
                'until galaxies remember their names',
                'in the pause between heartbeats',
                'where forgotten gods once walked',
                'through the dreams of sleeping worlds',
                'in the space where time forgets',
                'across the bridges of twilight',
                'where the impossible blooms',
                'through the songs of ancient winds',
                'in the library of unwritten futures',
                'where shadows learn to hope',

                // Rare+ (30-40)
                'until the void learns to sing',
                'in the garden of extinct stars',
                'where reality holds its breath',
                'through the memories of unmade choices',
                'in the echo of the first word',
                'where dimensions kiss and part',
                'through the tapestry of what-might-be',
                'in the cathedral of collapsed time',
                'where entropy dreams of order',
                'through the fog of genesis',

                // Epic+ (40-50)
                'until existence questions itself',
                'in the heartbeat of dying suns',
                'where consciousness first stirred',
                'through the wound between worlds',
                'in the silence after everything',
                'where meaning waits to be discovered',
                'through the architecture of fate',
                'in the nursery of black holes',
                'where the multiverse draws breath',
                'through the grammar of creation'
            ],

            // Short titles for badges
            titles: {
                curious: ['Seeker', 'Explorer', 'Wanderer', 'Questioner', 'Dreamer'],
                playful: ['Trickster', 'Dancer', 'Spark', 'Joy-bringer', 'Wild One'],
                gentle: ['Guardian', 'Healer', 'Peacekeeper', 'Tender Heart', 'Blessing'],
                wise: ['Sage', 'Watcher', 'Oracle', 'Elder Soul', 'Truth-keeper'],
                energetic: ['Storm', 'Comet', 'Wildfire', 'Thunder', 'Force']
            }
        };
    }
}

// Create singleton instance
const soulPhraseGenerator = new SoulPhraseGenerator();

// Export for module systems
export default soulPhraseGenerator;

// Expose globally
if (typeof window !== 'undefined') {
    window.SoulPhraseGenerator = soulPhraseGenerator;
}

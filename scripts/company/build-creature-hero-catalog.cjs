const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'public/marketing/creature-hero-catalog.json');
const TOTAL_HATCHES = 1000;
const HERO_CREATURES = 72;
const SEED = 0x4D595448;

const phaserStub = {
    Math: { Between: min => min, FloatBetween: min => min },
    Display: {
        Color: {
            ValueToColor: () => ({ r: 255, g: 255, b: 255 }),
            GetColor: (r, g, b) => (r << 16) | (g << 8) | b
        }
    },
    BlendModes: { ADD: 'ADD' }
};

global.Phaser = phaserStub;
global.window = {
    Phaser: phaserStub,
    GameState: { emit: () => {}, get: () => null, set: () => {} }
};

const CreatureGenetics = require('../../src/systems/CreatureGenetics.js');

function loadCreatureDNA() {
    const source = fs.readFileSync(
        path.join(ROOT, 'src/systems/CreatureDNA.js'),
        'utf8'
    ).replace('export default CreatureDNA;', 'module.exports = CreatureDNA;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: global.window,
        console: { log: () => {}, warn: () => {}, error: console.error },
        Math,
        Date
    };
    vm.runInNewContext(source, sandbox, { filename: 'CreatureDNA.js' });
    return sandbox.module.exports;
}

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function hex(value) {
    return `#${Number(value || 0).toString(16).padStart(6, '0').slice(-6).toUpperCase()}`;
}

function normalizeCreature(genes, dna, index) {
    const features = genes.traits.features;
    const colors = genes.traits.colorGenome;
    return {
        catalogId: `MV-${String(index + 1).padStart(4, '0')}`,
        geneticId: genes.id,
        species: genes.species,
        rarity: genes.rarity,
        geneBody: genes.traits.bodyShape.type,
        body: dna.bodyArchetype,
        head: dna.headArchetype,
        hybrid: dna.hybridTag,
        aura: dna.elementalAura,
        personality: genes.personality.core,
        affinity: genes.cosmicAffinity.element,
        wings: features.wings.type,
        eyeSize: features.eyes.size,
        marking: features.markings.pattern,
        mutations: features.wackyMutations.map(item => `${item.type}:${item.variant}`),
        specialFeatures: features.specialFeatures.map(item => `${item.type}:${item.variant}`),
        shiny: genes.isShiny,
        shinyType: genes.shinyType,
        colors: {
            body: hex(colors.primary),
            head: hex(colors.head),
            wings: hex(colors.secondary),
            eyes: hex(features.eyes.color),
            markings: hex(colors.markings),
            feet: hex(colors.feet)
        }
    };
}

function traitKeys(creature) {
    return [
        `species:${creature.species}`,
        `rarity:${creature.rarity}`,
        `geneBody:${creature.geneBody}`,
        `body:${creature.body}`,
        `head:${creature.head}`,
        `hybrid:${creature.hybrid}`,
        `aura:${creature.aura}`,
        `personality:${creature.personality}`,
        `affinity:${creature.affinity}`,
        `wings:${creature.wings}`,
        `marking:${creature.marking}`,
        `combo:${creature.species}:${creature.body}:${creature.head}:${creature.affinity}`,
        ...creature.mutations.map(value => `mutation:${value.split(':')[0]}`),
        ...creature.specialFeatures.map(value => `feature:${value.split(':')[0]}`),
        ...(creature.shiny ? ['variant:shiny'] : [])
    ];
}

function selectHeroCreatures(candidates) {
    const selected = [];
    const counts = new Map();
    const rarityTargets = {
        common: 12,
        uncommon: 14,
        rare: 15,
        epic: 15,
        legendary: 16
    };

    while (selected.length < HERO_CREATURES) {
        let best = null;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
            if (candidate.selected) continue;
            const rarityCount = counts.get(`rarity:${candidate.rarity}`) || 0;
            if (rarityCount >= rarityTargets[candidate.rarity]) continue;

            const keys = traitKeys(candidate);
            const novelty = keys.reduce((score, key) => {
                const seen = counts.get(key) || 0;
                const weight = key.startsWith('combo:') ? 5
                    : key.startsWith('mutation:') ? 4
                        : key.startsWith('feature:') ? 3
                            : key.startsWith('species:') || key.startsWith('head:') ? 2.5
                                : 1.5;
                return score + (weight / (1 + seen));
            }, 0);
            const rareDetail = candidate.mutations.length * 1.5
                + candidate.specialFeatures.length
                + (candidate.shiny ? 2 : 0);
            const score = novelty + rareDetail;
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }

        if (!best) throw new Error('Unable to satisfy hero diversity targets');
        best.selected = true;
        selected.push(best);
        traitKeys(best).forEach(key => counts.set(key, (counts.get(key) || 0) + 1));
    }

    return selected.map(({ selected: _selected, ...creature }) => creature);
}

function frequency(items, key) {
    return items.reduce((result, item) => {
        const value = item[key];
        result[value] = (result[value] || 0) + 1;
        return result;
    }, {});
}

const originalRandom = Math.random;
const originalLog = console.log;
Math.random = mulberry32(SEED);
console.log = () => {};

try {
    const genetics = new CreatureGenetics();
    const CreatureDNA = loadCreatureDNA();
    const dna = new CreatureDNA();
    genetics.initialize();
    dna.initialize();

    const rarityCycle = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const candidates = Array.from({ length: TOTAL_HATCHES }, (_, index) => {
        const genes = genetics.generateCreatureGenetics(rarityCycle[index % rarityCycle.length]);
        const dnaProfile = dna.generateDNA({ forcedRarity: genes.rarity });
        genes.id = `hero-${String(index + 1).padStart(4, '0')}`;
        return normalizeCreature(genes, dnaProfile, index);
    });
    const selected = selectHeroCreatures(candidates);
    const manifest = {
        schemaVersion: 1,
        generatedBy: 'CreatureGenetics + CreatureDNA',
        deterministicSeed: `0x${SEED.toString(16).toUpperCase()}`,
        totalHatches: TOTAL_HATCHES,
        selectedForHero: selected.length,
        selectionNote: 'Curated for breadth across the real genetics system; not a probability sample.',
        coverage: {
            species: frequency(selected, 'species'),
            rarity: frequency(selected, 'rarity'),
            geneBodies: frequency(selected, 'geneBody'),
            bodies: frequency(selected, 'body'),
            heads: frequency(selected, 'head'),
            affinities: frequency(selected, 'affinity'),
            auras: frequency(selected, 'aura'),
            personalities: frequency(selected, 'personality'),
            shiny: selected.filter(item => item.shiny).length,
            mutated: selected.filter(item => item.mutations.length > 0).length
        },
        creatures: selected
    };

    fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
    originalLog(JSON.stringify({ output: OUTPUT, ...manifest.coverage }, null, 2));
} finally {
    Math.random = originalRandom;
    console.log = originalLog;
}

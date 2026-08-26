#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const output = path.join(
    root,
    'public/press/gameplay/real-creature-showcase/source-profiles.json'
);
const seed = 0x5245414C;
const candidateCount = 1000;
const selectedCount = 12;
const rarityTargets = Object.freeze({
    common: 2,
    uncommon: 2,
    rare: 3,
    epic: 3,
    legendary: 2
});

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
        path.join(root, 'src/systems/CreatureDNA.js'),
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

function mulberry32(initialSeed) {
    let currentSeed = initialSeed;
    return function random() {
        let value = currentSeed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function hex(value) {
    return `#${Number(value || 0).toString(16).padStart(6, '0').slice(-6).toUpperCase()}`;
}

function displayWords(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalize(genes, dna, index) {
    const features = genes.traits.features;
    const colors = genes.traits.colorGenome;
    return {
        id: `MV-${String(index + 1).padStart(4, '0')}`,
        species: genes.species,
        speciesLabel: displayWords(genes.species),
        rarity: genes.rarity,
        geneBody: genes.traits.bodyShape.type,
        body: dna.bodyArchetype,
        head: dna.headArchetype,
        hybrid: dna.hybridTag,
        aura: dna.elementalAura,
        personality: genes.personality.core,
        affinity: genes.cosmicAffinity.element,
        mutations: features.wackyMutations.map(item => ({
            type: item.type,
            variant: item.variant
        })),
        specialFeatures: features.specialFeatures.map(item => ({
            type: item.type,
            variant: item.variant
        })),
        shiny: genes.isShiny,
        shinyType: genes.shinyType,
        colors: {
            primary: hex(colors.primary),
            secondary: hex(colors.secondary),
            accent: hex(colors.accent)
        }
    };
}

function featureKeys(profile) {
    return [
        `species:${profile.species}`,
        `geneBody:${profile.geneBody}`,
        `body:${profile.body}`,
        `head:${profile.head}`,
        `aura:${profile.aura}`,
        `personality:${profile.personality}`,
        `affinity:${profile.affinity}`,
        `hybrid:${profile.hybrid}`,
        ...profile.mutations.map(item => `mutation:${item.type}`),
        ...profile.specialFeatures.map(item => `feature:${item.type}`),
        ...(profile.shiny ? ['variant:shiny'] : [])
    ];
}

function noveltyScore(profile, counts) {
    const weights = {
        species: 42,
        geneBody: 14,
        body: 22,
        head: 16,
        aura: 10,
        personality: 8,
        affinity: 12,
        hybrid: 7,
        mutation: 11,
        feature: 6,
        variant: 5
    };
    return featureKeys(profile).reduce((score, key) => {
        const group = key.split(':')[0];
        const seen = counts.get(key) || 0;
        return score + ((weights[group] || 3) / (1 + (seen * 3)));
    }, 0);
}

function selectProfiles(candidates) {
    const selected = [];
    const counts = new Map();
    const rarityCounts = new Map();

    while (selected.length < selectedCount) {
        let best = null;
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            if (candidate.selected) continue;
            const rarityCount = rarityCounts.get(candidate.profile.rarity) || 0;
            if (rarityCount >= rarityTargets[candidate.profile.rarity]) continue;
            const score = noveltyScore(candidate.profile, counts);
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        if (!best) throw new Error('Unable to satisfy the real-creature showcase targets');
        best.selected = true;
        selected.push(best);
        featureKeys(best.profile).forEach(key => {
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        rarityCounts.set(
            best.profile.rarity,
            (rarityCounts.get(best.profile.rarity) || 0) + 1
        );
    }

    return selected;
}

function frequency(items, selector) {
    return items.reduce((result, item) => {
        const key = selector(item);
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}

const originalRandom = Math.random;
const originalLog = console.log;
Math.random = mulberry32(seed);
console.log = () => {};

try {
    const genetics = new CreatureGenetics();
    const CreatureDNA = loadCreatureDNA();
    const dnaSystem = new CreatureDNA();
    genetics.initialize();
    dnaSystem.initialize();
    const rarityCycle = Object.keys(rarityTargets);
    const candidates = Array.from({ length: candidateCount }, (_, index) => {
        const rarity = rarityCycle[index % rarityCycle.length];
        const genes = genetics.generateCreatureGenetics(rarity);
        const dna = dnaSystem.generateDNA({ forcedRarity: rarity });
        genes.id = `showcase-${String(index + 1).padStart(4, '0')}`;
        genes.generatedAt = 0;
        genes.metadata.generationTime = 0;
        dna.id = `showcase-dna-${String(index + 1).padStart(4, '0')}`;
        dna.generatedAt = 0;
        return { index, genes, dna, profile: normalize(genes, dna, index) };
    });
    const selected = selectProfiles(candidates);
    const profiles = selected.map(({ genes, dna, profile }) => ({
        ...profile,
        genes,
        dna
    }));
    const manifest = {
        schemaVersion: 1,
        state: 'deterministic_real_engine_profiles_ready_for_renderer_capture',
        generatedBy: 'CreatureGenetics + CreatureDNA',
        deterministicSeed: `0x${seed.toString(16).toUpperCase()}`,
        candidatesExplored: candidateCount,
        profilesSelected: profiles.length,
        selectionNote: 'Selected for visible breadth across deliberately balanced rarity runs; this is not a probability sample or an absolute uniqueness claim.',
        coverage: {
            species: frequency(profiles, item => item.species),
            rarity: frequency(profiles, item => item.rarity),
            geneBodies: frequency(profiles, item => item.geneBody),
            bodies: frequency(profiles, item => item.body),
            heads: frequency(profiles, item => item.head),
            affinities: frequency(profiles, item => item.affinity),
            auras: frequency(profiles, item => item.aura),
            personalities: frequency(profiles, item => item.personality),
            mutated: profiles.filter(item => item.mutations.length > 0).length,
            shiny: profiles.filter(item => item.shiny).length
        },
        profiles
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
    originalLog(JSON.stringify({ output, ...manifest.coverage }, null, 2));
} finally {
    Math.random = originalRandom;
    console.log = originalLog;
}

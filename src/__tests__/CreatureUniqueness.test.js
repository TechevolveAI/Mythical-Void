const fs = require('fs');
const path = require('path');
const vm = require('vm');

const phaserStub = {
    Math: {
        Between: min => min,
        FloatBetween: min => min
    },
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
    GameState: { emit: jest.fn() }
};

const CreatureGenetics = require('../systems/CreatureGenetics.js');

function loadCreatureDNA() {
    const source = fs.readFileSync(
        path.join(__dirname, '../systems/CreatureDNA.js'),
        'utf8'
    ).replace('export default CreatureDNA;', 'module.exports = CreatureDNA;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: global.window,
        console,
        Math,
        Date
    };
    vm.runInNewContext(source, sandbox, { filename: 'CreatureDNA.js' });
    return sandbox.module.exports;
}

const CreatureDNA = loadCreatureDNA();

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function frequency(values, selector) {
    return values.reduce((counts, value) => {
        const key = selector(value);
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
}

describe('creature uniqueness production contract', () => {
    test('10,000 seeded hatches retain intended variety without identity collisions', () => {
        const randomSpy = jest.spyOn(Math, 'random')
            .mockImplementation(mulberry32(0x4D595448));
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const geneticsSystem = new CreatureGenetics();
        const dnaSystem = new CreatureDNA();
        geneticsSystem.initialize();
        dnaSystem.initialize();

        const hatches = Array.from({ length: 10000 }, () => {
            const genes = geneticsSystem.generateCreatureGenetics();
            const dna = dnaSystem.generateDNA({ forcedRarity: genes.rarity });
            return { genes, dna };
        });

        randomSpy.mockRestore();
        logSpy.mockRestore();

        const ids = new Set(hatches.map(({ genes }) => genes.id));
        const species = frequency(hatches, ({ genes }) => genes.species);
        const rarities = frequency(hatches, ({ genes }) => genes.rarity);
        const bodyForms = new Set(
            hatches.map(({ genes }) => genes.traits.bodyShape.type)
        );
        const mutationTypes = new Set(
            hatches.flatMap(({ genes }) => (
                genes.traits.features.wackyMutations.map(mutation => mutation.type)
            ))
        );
        const geneticPhenotypes = new Set(hatches.map(({ genes }) => JSON.stringify({
            species: genes.species,
            body: genes.traits.bodyShape.type,
            colors: genes.traits.colorGenome,
            eyes: genes.traits.features.eyes,
            wings: genes.traits.features.wings,
            markings: genes.traits.features.markings,
            features: genes.traits.features.specialFeatures,
            mutations: genes.traits.features.wackyMutations,
            shiny: genes.shinyType
        })));
        const dnaVisuals = new Set(hatches.map(({ dna }) => [
            dna.bodyArchetype,
            dna.headArchetype,
            dna.hybridTag,
            dna.elementalAura
        ].join(':')));
        const mutated = hatches.filter(({ genes }) => (
            genes.traits.features.wackyMutations.length > 0
        )).length;
        const shiny = hatches.filter(({ genes }) => genes.isShiny).length;

        expect(ids.size).toBe(hatches.length);
        expect(geneticPhenotypes.size).toBeGreaterThan(9900);
        expect(dnaVisuals.size).toBeGreaterThan(700);
        expect(bodyForms.size).toBe(11);
        expect(mutationTypes.size).toBe(20);
        expect(mutated / hatches.length).toBeGreaterThan(0.23);
        expect(mutated / hatches.length).toBeLessThan(0.33);
        expect(shiny / hatches.length).toBeGreaterThan(0.08);
        expect(shiny / hatches.length).toBeLessThan(0.12);

        expect(species.stellarWyrm / hatches.length).toBeCloseTo(0.20, 1);
        expect(species.crystalDrake / hatches.length).toBeCloseTo(0.20, 1);
        expect(species.crystalElemental / hatches.length).toBeCloseTo(0.08, 1);
        expect(rarities.common / hatches.length).toBeCloseTo(0.45, 1);
        expect(rarities.legendary / hatches.length).toBeCloseTo(0.03, 1);
    });

    test('the hatch renderer and portrait handoff use the same canonical identity', () => {
        const hatchSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );
        const graphicsSource = fs.readFileSync(
            path.join(__dirname, '../systems/GraphicsEngine.js'),
            'utf8'
        );
        const soulSource = fs.readFileSync(
            path.join(__dirname, '../scenes/SoulRevealScene.js'),
            'utf8'
        );
        const archiveSource = fs.readFileSync(
            path.join(__dirname, '../systems/CompanionIdentityArchive.js'),
            'utf8'
        );

        expect(hatchSource).toContain('this.creatureGenetics\n                );');
        expect(hatchSource.indexOf('this.beginLivingPortraitPrewarm();')).toBeLessThan(
            hatchSource.indexOf('this.saveCreatureGenetics();')
        );
        expect(hatchSource).toContain("source: 'post_hatch'");
        expect(graphicsSource).toContain('geneticsOverride = null');
        expect(graphicsSource).toContain('this.renderWackyMutations(');
        expect(graphicsSource).toContain('this.addEnhancedMarkings(');
        expect(soulSource).toContain("const dna = window.GameState?.get('creature.dna')");
        expect(soulSource).toContain('referenceImage: this.portraitReferenceImage');
        expect(archiveSource).not.toContain('imageUrl: imageUrl || authoredStudyUrl');
    });
});

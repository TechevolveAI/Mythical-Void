const fs = require('fs');
const path = require('path');
const { BreedingEngine } = require('../systems/BreedingEngine.js');

const traitKeys = [
    'bodyShape',
    'eyeColor',
    'pattern',
    'horns',
    'tail',
    'earShape',
    'maneLength'
];

function legacyCreature(id, overrides = {}) {
    return {
        id,
        name: id,
        rarity: 'rare',
        genes: {
            id: `genes_${id}`,
            species: 'crystalElemental',
            rarity: 'rare',
            cosmicAffinity: { element: 'crystal' },
            personality: { core: 'curious' },
            traits: {
                bodyShape: { type: 'serpentine', intensity: 0.6 },
                colorGenome: {
                    primary: 0x205c48,
                    secondary: 0x4ba378,
                    accent: 0xffc857
                },
                features: {
                    eyes: { size: 'medium', color: 0x228b22, glow: 0.8 },
                    markings: { pattern: 'stripes', intensity: 0.7 },
                    wackyMutations: []
                }
            },
            ...overrides
        }
    };
}

function expectValidGenome(engine, genes) {
    expect(Object.keys(genes)).toEqual(traitKeys);
    traitKeys.forEach(traitKey => {
        const valid = Object.keys(engine.traitDefinitions[traitKey].variations);
        expect(genes[traitKey]).toHaveLength(2);
        genes[traitKey].forEach(allele => expect(valid).toContain(allele));
    });
}

describe('BreedingEngine stable lineage continuity', () => {
    let engine;

    beforeEach(() => {
        engine = new BreedingEngine();
    });

    test('derives the same complete genome for a legacy hatch-born creature', () => {
        const creature = legacyCreature('legacy_signal_23');

        const first = engine.resolveCreatureGenes(creature);
        for (let index = 0; index < 20; index += 1) Math.random();
        const second = engine.resolveCreatureGenes(JSON.parse(JSON.stringify(creature)));

        expect(second).toEqual(first);
        expectValidGenome(engine, first);
        expect(first.bodyShape).toContain('slender');
        expect(first.eyeColor).toContain('green');
        expect(first.pattern).toContain('striped');
    });

    test('preserves stored alleles instead of regenerating a parent identity', () => {
        const stored = {
            bodyShape: ['normal', 'stocky'],
            eyeColor: ['amber', 'violet'],
            pattern: ['solid', 'spotted'],
            horns: ['large', 'none'],
            tail: ['long', 'medium'],
            earShape: ['pointed', 'rounded'],
            maneLength: ['long', 'short']
        };
        const creature = legacyCreature('stored_parent', {
            mendelianGenes: stored
        });

        expect(engine.resolveCreatureGenes(creature)).toEqual(
            Object.fromEntries(Object.entries(stored).map(([key, alleles]) => [
                key,
                [...alleles].sort()
            ]))
        );
    });

    test('tracks one real allele from each parent through two generations', () => {
        const parent1 = engine.resolveCreatureGenes(legacyCreature('parent_one'));
        const parent2 = engine.resolveCreatureGenes(legacyCreature('parent_two', {
            species: 'voidStalker',
            traits: {
                bodyShape: { type: 'sturdy', intensity: 0.7 },
                colorGenome: { primary: 0x31064f, secondary: 0x6d21a8 },
                features: {
                    eyes: { size: 'large', color: 0x8a2be2, glow: 0.9 },
                    markings: { pattern: 'spots', intensity: 0.8 },
                    wackyMutations: []
                }
            }
        }));

        const generation2 = engine.breedCreaturesWithLineage(parent1, parent2);
        expectValidGenome(engine, generation2.genes);
        traitKeys.forEach(traitKey => {
            const record = generation2.inheritance[traitKey];
            expect(parent1[traitKey]).toContain(record.parent1Allele);
            expect(parent2[traitKey]).toContain(record.parent2Allele);
            expect(generation2.genes[traitKey]).toEqual(
                [record.parent1Allele, record.parent2Allele].sort()
            );
        });

        const parent3 = engine.resolveCreatureGenes(legacyCreature('parent_three'));
        const generation3 = engine.breedCreaturesWithLineage(
            generation2.genes,
            parent3
        );
        expectValidGenome(engine, generation3.genes);
        traitKeys.forEach(traitKey => {
            expect(generation2.genes[traitKey]).toContain(
                generation3.inheritance[traitKey].parent1Allele
            );
            expect(parent3[traitKey]).toContain(
                generation3.inheritance[traitKey].parent2Allele
            );
        });
    });

    test('passes the actual child rarity into mutation inheritance', () => {
        const inheritWackyMutations = jest.fn(() => [{ type: 'crystal_growth' }]);
        window.CreatureGenetics = { inheritWackyMutations };

        const visuals = engine.getVisualConfigFromPhenotype(
            engine.getPhenotype(engine.resolveCreatureGenes(legacyCreature('mutation_parent'))),
            {
                parent1: legacyCreature('m1').genes,
                parent2: legacyCreature('m2').genes
            },
            'legendary'
        );

        expect(inheritWackyMutations).toHaveBeenCalledWith([], [], 'legendary');
        expect(visuals.inheritedMutations).toEqual([{ type: 'crystal_growth' }]);
    });

    test('binds stable genomes into hatch, local Fusion, and server Fusion', () => {
        const hatch = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );
        const fusion = fs.readFileSync(
            path.join(__dirname, '../scenes/FusionPodScene.js'),
            'utf8'
        );
        const server = fs.readFileSync(
            path.join(__dirname, '../../supabase/functions/execute-fusion/index.ts'),
            'utf8'
        );

        expect(hatch).toContain('this.attachMendelianGenome();');
        expect(hatch).toContain('this.creatureGenetics.mendelianGenes =');
        expect(fusion).toContain('breedCreaturesWithLineage');
        expect(fusion).not.toContain('genes?.mendelianGenes ||\n                        window.BreedingEngine?.generateInitialGenes()');
        expect(server).toContain('function resolveMendelian(parent: JsonObject)');
        expect(server).toContain('const phenotype = phenotypeFor(mendelianGenes);');
        expect(server).toContain('wackyMutations: inheritedMutations');
        expect(server).not.toContain("bodyShape: ['balanced', 'compact']");
        expect(server).not.toContain("eyeColor: ['cosmicBlue', 'violet']");
    });
});

const { BreedingEngine } = require('../systems/BreedingEngine.js');
const { FusionAuthority } = require('../systems/FusionAuthority.js');

describe('Fusion inheritance with an explicit random source', () => {
    const engine = new BreedingEngine();
    const authority = new FusionAuthority();
    const parents = [
        { id: 'fictional-owned', genes: { id: 'fictional-owned-genes', species: 'nebulaSprite' } },
        { id: 'fictional-visitor', genes: { id: 'fictional-visitor-genes', species: 'crystalDrake' } }
    ];
    test('replays exact inheritance without changing ambient randomness or either parent', () => {
        const before = JSON.stringify(parents);
        const ambient = jest.spyOn(Math, 'random').mockImplementation(() => { throw Error('ambient random forbidden'); });
        try {
            const first = engine.breedCreaturesWithLineage(...parents, { random: authority.createSeededRandom('fixture-a') });
            const replay = engine.breedCreaturesWithLineage(...parents, { random: authority.createSeededRandom('fixture-a') });
            expect(replay).toEqual(first);
            expect(Math.random).toBe(ambient);
            expect(ambient).not.toHaveBeenCalled();
            expect(JSON.stringify(parents)).toBe(before);
            const resolved = parents.map(parent => engine.resolveCreatureGenes(parent));
            for (const [trait, inheritance] of Object.entries(first.inheritance)) {
                expect(resolved[0][trait]).toContain(inheritance.parent1Allele);
                expect(resolved[1][trait]).toContain(inheritance.parent2Allele);
                expect(first.genes[trait]).toEqual([inheritance.parent1Allele, inheritance.parent2Allele].sort());
            }
        } finally { ambient.mockRestore(); }
    });
    test('existing two-argument calls retain the default random source', () => {
        const ambient = jest.spyOn(Math, 'random').mockReturnValue(0.25);
        try {
            const legacy = engine.breedCreaturesWithLineage(...parents);
            expect(ambient).toHaveBeenCalledTimes(14);
            expect(legacy).toEqual(engine.breedCreaturesWithLineage(...parents, { random: () => 0.25 }));
        } finally { ambient.mockRestore(); }
    });
    test.each([NaN, Infinity, -0.001, 1, 1.01])('refuses an invalid random sample %s', value => {
        expect(() => engine.breedCreaturesWithLineage(...parents, { random: () => value })).toThrow('breeding_random_out_of_range');
    });
    test('refuses a non-callable source before resolving parents', () => {
        expect(() => engine.breedCreaturesWithLineage(...parents, { random: null })).toThrow('breeding_random_required');
    });
    test('a source failure does not leave a global random override behind', () => {
        const original = Math.random;
        expect(() => engine.breedCreaturesWithLineage(...parents, { random() { throw Error('fictional failure'); } }))
            .toThrow('fictional failure');
        expect(Math.random).toBe(original);
    });
});

const { loadModule } = require('../test-support/endingRigFixture.cjs');
const { createFusionOffspringDraft: draft } = loadModule('../systems/FusionOffspringDraft.js', 'createFusionOffspringDraft');

describe('existing Fusion hatch draft, without allocating or saving anything', () => {
    const genes = { id: 'synthetic-genes', cosmicAffinity: { element: 'moon' }, traits: { pattern: 'spotted' } };
    const options = () => ({ genes, offspringData: { creatureId: 'synthetic-child', generation: 3,
        rarity: 'epic', parentIds: ['synthetic-parent-a', 'synthetic-parent-b'] }, name: 'Fictional child',
    textureName: 'synthetic-texture', now: 1000 });

    test('keeps identity, both genetic aliases, baby progression and existing default fields', () => {
        expect(draft(options())).toEqual({ id: 'synthetic-child', name: 'Fictional child', genes, dna: genes,
            personality: null, personalityState: null, stats: { happiness: 100, energy: 100, health: 100 },
            level: 1, experience: 0, textureName: 'synthetic-texture', hatchTime: 1000,
            lifecycle: { birthDate: 1000, stage: 'baby', lastStageChange: 1000, evolutionHistory: [] },
            cosmicAffinity: genes.cosmicAffinity, rarity: 'epic', addedAt: 1000, isOffspring: true,
            generation: 3, parentIds: ['synthetic-parent-a', 'synthetic-parent-b'], offspringBonus: null,
            birthEvents: [], secretAbilities: [], isShiny: false, hasDualAffinity: false, dualAffinity: null });
    });

    test('keeps existing source references until the transaction owner clones the draft', () => {
        const input = options(), result = draft(input);
        expect(result.genes).toBe(input.genes);
        expect(result.dna).toBe(result.genes);
        expect(result.parentIds).toBe(input.offspringData.parentIds);
        expect(result.cosmicAffinity).toBe(input.genes.cosmicAffinity);
        expect(result.lineage).toBeUndefined();
    });

    test('preserves special birth effects supplied by the existing Pod', () => {
        const input = options();
        Object.assign(input.offspringData, { offspringBonus: { cosmicPower: 1.2 },
            birthEvents: [{ id: 'fictional-event' }], secretAbilities: ['fictional-ability'],
            isShiny: true, hasDualAffinity: true, dualAffinity: ['moon', 'sun'] });
        const before = JSON.stringify(input), result = draft(input);
        for (const key of ['offspringBonus', 'birthEvents', 'secretAbilities', 'isShiny', 'hasDualAffinity', 'dualAffinity']) {
            expect(result[key]).toBe(input.offspringData[key]);
        }
        expect(JSON.stringify(input)).toBe(before);
    });

    test.each([1, 2])('retains twin %i fields and the current absence of single-only flags', index => {
        const input = options();
        input.twin = { index, siblingId: 'synthetic-sibling', siblingName: 'Fictional sibling' };
        input.offspringData.isShiny = true;
        const result = draft(input);
        expect(result).toMatchObject({ isTwin: true, twinIndex: index,
            twinSiblingId: 'synthetic-sibling', twinSiblingName: 'Fictional sibling' });
        for (const key of ['isShiny', 'hasDualAffinity', 'dualAffinity']) expect(Object.hasOwn(result, key)).toBe(false);
    });

    test('allocates fresh stats, lifecycle and default arrays per child, without using ambient time/randomness', () => {
        const clock = jest.spyOn(Date, 'now').mockImplementation(() => { throw Error('NO_CLOCK'); });
        const random = jest.spyOn(Math, 'random').mockImplementation(() => { throw Error('NO_RANDOM'); });
        try {
            const a = draft(options()), b = draft(options());
            for (const key of ['stats', 'lifecycle', 'birthEvents', 'secretAbilities']) expect(a[key]).not.toBe(b[key]);
            a.lifecycle.evolutionHistory.push({ stage: 'adult' });
            expect(b.lifecycle.evolutionHistory).toEqual([]);
            expect(clock).not.toHaveBeenCalled();
            expect(random).not.toHaveBeenCalled();
        } finally { clock.mockRestore(); random.mockRestore(); }
    });
});

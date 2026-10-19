const { BreedingEngine } = require('../systems/BreedingEngine.js');

describe('breeding visual inheritance dependency', () => {
    test('ordinary callers retain the current mutation-inheritance path', () => {
        const engine = new BreedingEngine(), mutations = [{ type: 'extra_eyes', inherited: true }];
        const inherit = jest.spyOn(engine, 'inheritMutationsFromParents').mockReturnValue(mutations);
        const parents = { parent1: { traits: {} }, parent2: { traits: {} } };
        const visual = engine.getVisualConfigFromPhenotype({ horns: 'large', eyeColor: 'green' }, parents, 'epic');
        expect(inherit).toHaveBeenCalledWith(parents, 'epic');
        expect(visual.inheritedMutations).toBe(mutations);
        expect(visual.headMods.horns).toEqual({ type: 'spiral', size: 1.0 });
    });

    test('an explicit inheritance callback bypasses all legacy global mutation lookup', () => {
        const engine = new BreedingEngine();
        jest.spyOn(engine, 'inheritMutationsFromParents').mockImplementation(() => { throw Error('legacy inheritance forbidden'); });
        const parents = { parent1: { traits: {} }, parent2: { traits: {} } };
        const mutations = [{ type: 'crystal_growth', inherited: true }];
        const inheritMutations = jest.fn(() => mutations);
        const visual = engine.getVisualConfigFromPhenotype({ horns: 'large' }, parents, 'rare', { inheritMutations });
        expect(inheritMutations).toHaveBeenCalledWith(parents, 'rare');
        expect(visual.inheritedMutations).toBe(mutations);
        expect(engine.inheritMutationsFromParents).not.toHaveBeenCalled();
    });

    test.each([false, 'inherit', 42, {}])('refuses an invalid explicit inheritance callback %s', inheritMutations => {
        const engine = new BreedingEngine();
        expect(() => engine.getVisualConfigFromPhenotype({}, null, 'common', { inheritMutations }))
            .toThrow('breeding_visual_inheritance_required');
    });

    test.each([null, {}, 'mutations'])('refuses malformed inherited mutations %s', output => {
        const engine = new BreedingEngine();
        expect(() => engine.getVisualConfigFromPhenotype({}, null, 'common', { inheritMutations: () => output }))
            .toThrow('breeding_visual_mutations_invalid');
    });
});

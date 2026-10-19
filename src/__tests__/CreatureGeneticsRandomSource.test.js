const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const { FusionAuthority } = require('../systems/FusionAuthority.js');

const source = fs.readFileSync(path.join(__dirname, '../systems/CreatureGenetics.js'), 'utf8');
const authority = new FusionAuthority();
const randomFor = seed => authority.createSeededRandom(seed);
const json = value => JSON.parse(JSON.stringify(value));

function fixture({ seed = 'synthetic-visual-seed', explicit = true, uuid = true } = {}) {
    const ambient = jest.fn(explicit ? () => { throw Error('ambient random forbidden'); } : randomFor(seed));
    const math = Object.create(Math);
    math.random = ambient;
    math.seedrandom = jest.fn();
    class Clock extends Date { static now() { return 1000000; } }
    const context = { module: { exports: {} }, window: { GameState: { emit: jest.fn() } },
        Math: math, Date: Clock, console: { log() {}, warn() {} },
        crypto: uuid ? { randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') } : {} };
    vm.runInNewContext(source, context);
    const random = jest.fn(randomFor(seed));
    const create = () => new context.module.exports(explicit ? { random } : undefined);
    return { generator: create(), create, Class: context.module.exports, random, ambient, math, context };
}

describe('visual genetics with an isolated random source', () => {
    const species = Object.keys(fixture().generator.speciesTemplates);
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    test.each(species.flatMap(kind => rarities.map(rarity => [kind, rarity])))(
        '%s / %s uses the existing full profile recipe with no ambient random calls', (kind, rarity) => {
            const seed = `synthetic:${kind}:${rarity}`;
            const first = fixture({ seed }), replay = fixture({ seed });
            expect(first.generator.speciesTemplates).toHaveProperty(kind);
            first.generator.selectSpecies = replay.generator.selectSpecies = () => kind;
            const a = first.generator.generateCreatureGenetics(rarity);
            const b = replay.generator.generateCreatureGenetics(rarity);
            expect(json(a)).toEqual(json(b));
            expect(first.random).toHaveBeenCalled();
            expect(first.ambient).not.toHaveBeenCalled();
            expect(a.species).toBe(kind);
            expect(a.traits.features).toHaveProperty('wackyMutations');
            expect(a.traits.features).toHaveProperty('markings');
            expect(a.traits.colorGenome.primary).toEqual(expect.any(Number));
            expect(a.traits.bodyShape.type).toEqual(expect.any(String));
            expect(a.personality.core).toEqual(expect.any(String));
            expect(a.cosmicAffinity.element).toEqual(expect.any(String));
        }
    );

    test.each([true, false])('legacy and explicit sources produce the same profile and random draw count (UUID available: %s)', uuid => {
        const legacy = fixture({ explicit: false, uuid }), isolated = fixture({ uuid });
        for (const rarity of rarities) {
            expect(json(legacy.generator.generateCreatureGenetics(rarity)))
                .toEqual(json(isolated.generator.generateCreatureGenetics(rarity)));
        }
        expect(legacy.ambient.mock.calls.length).toBe(isolated.random.mock.calls.length);
        expect(isolated.ambient).not.toHaveBeenCalled();
    });

    test('default instances still resolve the active legacy random scope at call time', () => {
        const f = fixture({ explicit: false });
        const firstScope = jest.fn(() => 0.25), secondScope = jest.fn(() => 0.75);
        f.math.random = firstScope;
        expect(f.generator.sampleRandom()).toBe(0.25);
        f.math.random = secondScope;
        expect(f.generator.sampleRandom()).toBe(0.75);
        expect(firstScope).toHaveBeenCalledTimes(1);
        expect(secondScope).toHaveBeenCalledTimes(1);
    });

    test.each([NaN, Infinity, -0.001, 1, 1.001, null, '0.5'])(
        'rejects an invalid explicit sample %s instead of building partial visual data', value => {
            const f = fixture();
            const generator = new f.Class({ random: () => value });
            expect(() => generator.generateCreatureGenetics('rare')).toThrow('genetics_random_out_of_range');
            expect(f.context.window.GameState.emit).not.toHaveBeenCalled();
        }
    );

    test.each([0, false, 'seed', {}])('rejects a non-callable explicit source %s', random => {
        const f = fixture();
        expect(() => new f.Class({ random })).toThrow('genetics_random_required');
    });

    test('does not mix an explicit source with legacy global seeding', () => {
        const f = fixture();
        expect(() => f.generator.generateCreatureGenetics(1234)).toThrow('genetics_explicit_random_with_legacy_seed');
        expect(f.math.seedrandom).not.toHaveBeenCalled();
        expect(f.random).not.toHaveBeenCalled();
    });

    test('preserves the legacy seed entry point for existing callers', () => {
        const f = fixture({ explicit: false });
        f.generator.generateCreatureGenetics(1234);
        expect(f.math.seedrandom).toHaveBeenCalledWith(1234);
    });

    test('interleaving independent generators cannot consume each other\'s streams', () => {
        const a = fixture({ seed: 'synthetic-a' }), b = fixture({ seed: 'synthetic-b' });
        const baseline = fixture({ seed: 'synthetic-a' });
        const first = a.generator.generateCreatureGenetics('epic');
        b.generator.generateCreatureGenetics('common');
        b.generator.generateCreatureGenetics('legendary');
        const second = a.generator.generateCreatureGenetics('rare');
        expect(json(first)).toEqual(json(baseline.generator.generateCreatureGenetics('epic')));
        expect(json(second)).toEqual(json(baseline.generator.generateCreatureGenetics('rare')));
        expect(a.ambient).not.toHaveBeenCalled(); expect(b.ambient).not.toHaveBeenCalled();
    });

    test('mutation inheritance uses the isolated stream and never changes its parents', () => {
        const f = fixture(), replay = fixture();
        const parents = [
            [{ type: 'crystal_growth', variant: 'small', dominance: 0.9, intensity: 0.6 }],
            [{ type: 'extra_eyes', variant: 'paired', dominance: 0.8, intensity: 0.5 }]
        ];
        const before = json(parents);
        expect(json(f.generator.inheritWackyMutations(...parents, 'legendary')))
            .toEqual(json(replay.generator.inheritWackyMutations(...parents, 'legendary')));
        expect(parents).toEqual(before);
        expect(f.ambient).not.toHaveBeenCalled();
    });

    test('source failure propagates without replacing any global random function', () => {
        const f = fixture(), original = Math.random, local = f.math.random;
        const generator = new f.Class({ random() { throw Error('synthetic stream failure'); } });
        expect(() => generator.generateCreatureGenetics('epic')).toThrow('synthetic stream failure');
        expect(Math.random).toBe(original);
        expect(f.math.random).toBe(local);
    });

    test('every ambient random call in this class is confined to the default-source adapter', () => {
        const body = parse(source, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
        const adapter = body.body.body.find(node => node.key?.name === 'sampleRandom');
        const ambientCalls = [];
        const walk = node => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' &&
                node.callee.object?.name === 'Math' && node.callee.property?.name === 'random') ambientCalls.push(node);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(walk);
                else if (value && typeof value === 'object') walk(value);
            }
        };
        walk(body);
        expect(ambientCalls).toHaveLength(1);
        expect(ambientCalls[0].start).toBeGreaterThan(adapter.start);
        expect(ambientCalls[0].end).toBeLessThan(adapter.end);
    });
});

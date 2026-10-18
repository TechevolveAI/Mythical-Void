const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FusionAuthority } = require('../systems/FusionAuthority.js');

const source = fs.readFileSync(path.join(__dirname, '../systems/CreatureGenetics.js'), 'utf8');
const authority = new FusionAuthority();
const copy = value => JSON.parse(JSON.stringify(value));

function fixture(seed = 'fictional-creation') {
    const forbidden = label => jest.fn(() => { throw Error(`AMBIENT_${label}_FORBIDDEN`); });
    const math = Object.create(Math);
    math.random = forbidden('RANDOM');
    math.seedrandom = forbidden('SEED');
    class Clock extends Date { static now() { throw Error('AMBIENT_TIME_FORBIDDEN'); } }
    const context = { module: { exports: {} }, window: {}, Math: math, Date: Clock,
        crypto: { randomUUID: forbidden('ID') }, console: { log: forbidden('LOG'), warn: forbidden('WARN') } };
    vm.runInNewContext(source, context);
    Object.defineProperty(context.window, 'GameState', { get() { throw Error('AMBIENT_STATE_FORBIDDEN'); } });
    const creation = { now: jest.fn(() => 1000000), nextGeneticId: jest.fn(() => 'fictional-genes-reserved'), emit: jest.fn() };
    const random = jest.fn(authority.createSeededRandom(seed));
    const Class = context.module.exports;
    return { context, Class, creation, random, generator: new Class({ random, creation }) };
}

describe('visual genetics with explicit creation services', () => {
    const species = Object.keys(fixture().generator.speciesTemplates);
    test.each(species.flatMap(kind => ['common', 'uncommon', 'rare', 'epic', 'legendary'].map(rarity => [kind, rarity])))(
        '%s / %s uses reserved identity/time and collected events without ambient services', (kind, rarity) => {
            const first = fixture(`fictional:${kind}:${rarity}`), replay = fixture(`fictional:${kind}:${rarity}`);
            first.generator.selectSpecies = replay.generator.selectSpecies = () => kind;
            first.generator.initialize(); replay.generator.initialize();
            const a = first.generator.generateCreatureGenetics(rarity), b = replay.generator.generateCreatureGenetics(rarity);
            expect(copy(a)).toEqual(copy(b));
            expect(a).toMatchObject({ id: 'fictional-genes-reserved', generatedAt: 1000000, species: kind, rarity });
            expect(a.metadata.generationTime).toBe(0);
            expect(Array.isArray(a.traits.features.wackyMutations)).toBe(true);
            expect(a.traits.colorGenome.primary).toEqual(expect.any(Number));
            expect(copy(first.creation.emit.mock.calls)).toEqual(copy(replay.creation.emit.mock.calls));
            expect(first.creation.emit).toHaveBeenCalledWith('genetics/system_initialized', { timestamp: 1000000, systemReady: true });
            expect(first.creation.emit).toHaveBeenCalledWith('telemetry/creature_generated', expect.objectContaining({ timestamp: 1000000 }));
            expect(first.creation.nextGeneticId).toHaveBeenCalledTimes(1);
            expect(first.context.Math.random).not.toHaveBeenCalled();
            expect(first.context.crypto.randomUUID).not.toHaveBeenCalled();
            expect(first.context.console.log).not.toHaveBeenCalled();
        }
    );

    test.each([false, 1, [], {}, { now() {} },
        { now() {}, nextGeneticId() {}, emit: true },
        { now() {}, nextGeneticId() {}, emit() {}, extra: true }])('rejects incomplete creation services %j', creation => {
        const f = fixture();
        expect(() => new f.Class({ random: f.random, creation })).toThrow('genetics_creation_required');
        expect(f.random).not.toHaveBeenCalled();
    });

    test('creation services require an explicit random source', () => {
        const f = fixture();
        expect(() => new f.Class({ creation: f.creation })).toThrow('genetics_creation_random_required');
    });

    test.each([NaN, Infinity, -1, 0.5, '1000', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid supplied time %s', value => {
        const f = fixture(); f.creation.now.mockReturnValue(value);
        expect(() => f.generator.generateCreatureGenetics('rare')).toThrow('genetics_creation_time_invalid');
        expect(f.creation.emit).not.toHaveBeenCalled();
    });

    test.each(['', 'fictional bad id', 'x'.repeat(129), 42, null])('rejects invalid reserved identity %s', value => {
        const f = fixture(); f.creation.nextGeneticId.mockReturnValue(value);
        expect(() => f.generator.generateCreatureGenetics('rare')).toThrow('genetics_creation_id_invalid');
        expect(f.creation.emit).not.toHaveBeenCalled();
    });

    test('does not generate two profiles with the same reserved identity on one instance', () => {
        const f = fixture();
        f.generator.generateCreatureGenetics('rare');
        f.creation.emit.mockClear();
        expect(() => f.generator.generateCreatureGenetics('epic')).toThrow('genetics_creation_id_reused');
        expect(f.creation.emit).not.toHaveBeenCalled();
    });

    test('copies the service references rather than following later replacements on the options object', () => {
        const f = fixture();
        const originalEmit = f.creation.emit;
        f.creation.emit = () => { throw Error('replaced service'); };
        f.creation.now = () => { throw Error('replaced service'); };
        f.creation.nextGeneticId = () => { throw Error('replaced service'); };
        expect(f.generator.generateCreatureGenetics('common').id).toBe('fictional-genes-reserved');
        expect(originalEmit).toHaveBeenCalled();
    });

    test('mutation inheritance uses the same isolated generator without touching either parent', () => {
        const f = fixture();
        const parents = [[{ type: 'crystal_growth', variant: 'small', dominance: 0.9, intensity: 0.6 }],
            [{ type: 'extra_eyes', variant: 'paired', dominance: 0.8, intensity: 0.5 }]];
        const before = copy(parents);
        expect(Array.isArray(f.generator.inheritWackyMutations(...parents, 'epic'))).toBe(true);
        expect(parents).toEqual(before);
        expect(f.creation.emit).not.toHaveBeenCalled();
        expect(f.context.Math.random).not.toHaveBeenCalled();
    });
});

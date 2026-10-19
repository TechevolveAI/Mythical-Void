const { loadModule } = require('../test-support/endingRigFixture.cjs');
const { BreedingEngine } = require('../systems/BreedingEngine.js');
const { resolveBreedingAppearance, drawBreedingAppendages } = loadModule('../systems/BreedingAppearance.js',
    'resolveBreedingAppearance, drawBreedingAppendages');
const engine = new BreedingEngine();
const visual = () => engine.getVisualConfigFromPhenotype({ bodyShape: 'stocky', horns: 'large',
    earShape: 'pointed', maneLength: 'long', tail: 'long', pattern: 'striped', eyeColor: 'green' },
null, 'rare', { inheritMutations: () => [] });
const graphics = () => Object.fromEntries(['fillStyle', 'lineStyle', 'beginPath', 'moveTo', 'lineTo',
    'closePath', 'fillPath', 'strokePath', 'fillTriangle', 'fillCircle', 'fillEllipse'].map(name => [name, jest.fn()]));
const paint = { tailShadow: 0x123456, tail: 0x234567, headShadow: 0x345678, accent: 0x456789 };

describe('existing Mendelian appearance mapping', () => {
    test('reads all seven existing mappings without altering the input', () => {
        const input = visual(), before = JSON.stringify(input);
        const resolved = resolveBreedingAppearance(input, 'adult');
        expect(resolved).toEqual({ growth: 1, scaleX: 1.2, scaleY: 0.9, eyeColor: input.eyeColor,
            markings: { pattern: 'stripes', intensity: 0.7 }, tailLength: 1, ears: 'pointed',
            maneLength: 1, horns: { type: 'spiral', size: 1 } });
        resolved.horns.size = 0.2;
        resolved.markings.intensity = 0.2;
        expect(JSON.stringify(input)).toBe(before);
    });

    test.each([['baby', 0, 1.05], ['juvenile', 0.45, 1.09], ['youngling', 0.45, 1.09],
        ['adult', 1, 1.2], ['elder', 1, 1.2]])('%s preserves gradual proportions and appendage growth', (stage, growth, scaleX) => {
        const resolved = resolveBreedingAppearance(visual(), stage);
        expect(resolved.growth).toBe(growth);
        expect(resolved.scaleX).toBeCloseTo(scaleX);
    });

    test.each([undefined, null, false, 5, [], {}, { inheritedMutations: [] }])('absent or unrecognised mapping stays on the ordinary path: %s', input => {
        expect(resolveBreedingAppearance(input, 'adult')).toBeNull();
    });

    test('keeps valid black eyes and honours explicitly absent horns and solid markings', () => {
        expect(resolveBreedingAppearance({ eyeColor: 0, headMods: { horns: { type: 'none', size: 0 } },
            bodyMods: { pattern: { type: 'solid', intensity: 1 } } }, 'adult'))
            .toMatchObject({ eyeColor: 0, horns: { type: 'none', size: 0 }, markings: { pattern: 'none', intensity: 0 } });
    });

    test.each([NaN, Infinity, -1, 0x1000000, 'red'])('ignores invalid eye colour: %s', eyeColor => {
        expect(resolveBreedingAppearance({ eyeColor }, 'adult')).toBeNull();
    });

    test('malformed scales, types and lengths cannot reach drawing commands', () => {
        expect(resolveBreedingAppearance({ eyeColor: 0x123456,
            headMods: { ears: { type: 'large' }, mane: { type: 'flowing', length: Infinity },
                horns: { type: 'spiral', size: -4 } },
            bodyMods: { shape: { scaleX: NaN, scaleY: 100 }, tail: { type: 'flowing', length: '1' },
                pattern: { type: 'grid' } } }, 'adult')).toEqual({ growth: 1, scaleX: 1, scaleY: 1,
            eyeColor: 0x123456, markings: null, tailLength: null, ears: null, maneLength: null, horns: null });
    });

    test('baby appendages are not drawn over the existing hatchling', () => {
        const g = graphics();
        drawBreedingAppendages(g, { x: 100, y: 100 }, paint, { scale: 0.6 }, resolveBreedingAppearance(visual(), 'baby'), 'baby_blob');
        for (const method of Object.values(g)) expect(method).not.toHaveBeenCalled();
    });

    test.each(['fish', 'serpentine', 'avian', 'quadruped', 'elder_quadruped', 'transitional_avian'])(
        '%s keeps its single authored tail', family => {
            const g = graphics(), resolved = resolveBreedingAppearance({ bodyMods: { tail: engine.mapTailTrait('long') } }, 'adult');
            drawBreedingAppendages(g, { x: 100, y: 100 }, paint, { scale: 1 }, resolved, family);
            expect(g.beginPath).not.toHaveBeenCalled();
        }
    );

    test.each(['rounded', 'pointed'])('%s sensory fins and attached material use finite primitive commands', ears => {
        const g = graphics(), input = visual();
        input.headMods.ears = engine.mapEarsTrait(ears);
        const resolved = resolveBreedingAppearance(input, 'juvenile'), before = JSON.stringify(resolved);
        drawBreedingAppendages(g, { x: 100, y: 100 }, paint, { scale: 0.8, headSizeMultiplier: 1.3 }, resolved, 'balanced');
        expect(g.fillTriangle).toHaveBeenCalled();
        expect(g.fillPath).toHaveBeenCalledTimes(1);
        expect(g.strokePath).toHaveBeenCalledTimes(1);
        for (const method of Object.values(g)) for (const args of method.mock.calls) {
            for (const value of args) expect(Number.isFinite(value)).toBe(true);
        }
        expect(JSON.stringify(resolved)).toBe(before);
    });
});

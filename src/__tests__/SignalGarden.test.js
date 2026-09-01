const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSignalGarden() {
    const filePath = path.join(__dirname, '../systems/SignalGarden.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                SIGNAL_GARDEN_STAGES,
                getSignalGardenDayKey,
                normalizeSignalGardenState,
                tendSignalGarden
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Number,
        Object,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Signal Garden', () => {
    const {
        getSignalGardenDayKey,
        normalizeSignalGardenState,
        tendSignalGarden
    } = loadSignalGarden();

    test('advances from seed to bloom over three different UTC days', () => {
        const first = tendSignalGarden({}, Date.parse('2026-07-27T23:58:00Z'));
        const second = tendSignalGarden(first.state, Date.parse('2026-07-28T00:02:00Z'));
        const third = tendSignalGarden(second.state, Date.parse('2026-07-29T12:00:00Z'));

        expect(first).toEqual(expect.objectContaining({
            success: true,
            stage: 'sprout',
            isNewStage: true,
            companionLine: 'A tiny light leans toward your companion.'
        }));
        expect(second.stage).toBe('bud');
        expect(second.companionLine).toBe('The sprout answers the memories you restored.');
        expect(third.stage).toBe('bloom');
        expect(third.companionLine).toBe('It blooms in colors neither world made alone.');
        expect(third.state.tendCount).toBe(3);
        expect(third.state.bloomedAt).toBe(Date.parse('2026-07-29T12:00:00Z'));
    });

    test('allows only one saved tending action per UTC day', () => {
        const first = tendSignalGarden({}, Date.parse('2026-07-27T08:00:00Z'));
        const repeated = tendSignalGarden(first.state, Date.parse('2026-07-27T20:00:00Z'));

        expect(repeated.success).toBe(false);
        expect(repeated.state.tendCount).toBe(1);
        expect(repeated.message).toContain('Come back tomorrow');
    });

    test('keeps a mature bloom alive while daily tending continues', () => {
        const mature = {
            stage: 'bloom',
            tendCount: 6,
            lastTendedDay: '2026-07-26',
            plantedAt: 100,
            bloomedAt: 300
        };
        const result = tendSignalGarden(mature, Date.parse('2026-07-27T09:00:00Z'));

        expect(result.stage).toBe('bloom');
        expect(result.isNewStage).toBe(false);
        expect(result.companionLine).toBe('The bloom brightens when you arrive together.');
        expect(result.state.plantedAt).toBe(100);
        expect(result.state.bloomedAt).toBe(300);
    });

    test('normalizes missing and malformed save fields', () => {
        expect(normalizeSignalGardenState({
            stage: 'unknown',
            tendCount: '2.9',
            lastTendedAt: 'bad',
            plantedAt: null
        })).toEqual({
            stage: 'bud',
            tendCount: 2,
            lastTendedDay: null,
            lastTendedAt: null,
            plantedAt: null,
            bloomedAt: null
        });
        expect(getSignalGardenDayKey(Date.parse('2026-12-31T23:59:00Z'))).toBe('2026-12-31');
    });
});

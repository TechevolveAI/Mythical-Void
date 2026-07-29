const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLivingSignalSurvey() {
    const filePath = path.join(__dirname, '../systems/LivingSignalSurvey.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                LIVING_SIGNAL_DEFINITIONS,
                getLivingSignalDefinition,
                normalizeLivingSignalState,
                observeLivingSignal
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Number,
        Object,
        Array,
        Set
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Living Signal survey', () => {
    const {
        LIVING_SIGNAL_DEFINITIONS,
        normalizeLivingSignalState,
        observeLivingSignal
    } = loadLivingSignalSurvey();

    test('defines three authored, spatially distinct first-contact encounters', () => {
        expect(LIVING_SIGNAL_DEFINITIONS).toHaveLength(3);
        expect(new Set(LIVING_SIGNAL_DEFINITIONS.map(signal => signal.id)).size).toBe(3);
        LIVING_SIGNAL_DEFINITIONS.forEach(signal => {
            expect(signal.name.length).toBeGreaterThan(5);
            expect(signal.response.length).toBeGreaterThan(35);
            expect(signal.companionLine.length).toBeGreaterThan(15);
            expect(signal.fieldNote.length).toBeGreaterThan(30);
            expect(signal.position).toEqual(expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number)
            }));
        });
    });

    test('records each observation once and reports completion on the third', () => {
        const first = observeLivingSignal({}, 'echo_bloom', 100);
        const second = observeLivingSignal(first.state, 'memory_stone', 200);
        const third = observeLivingSignal(second.state, 'rootlight', 300);

        expect(first).toEqual(expect.objectContaining({
            success: true,
            progress: 1,
            total: 3,
            completed: false
        }));
        expect(second.progress).toBe(2);
        expect(third.completed).toBe(true);
        expect(third.state).toEqual({
            observedIds: ['echo_bloom', 'memory_stone', 'rootlight'],
            lastObservedId: 'rootlight',
            lastObservedAt: 300
        });
    });

    test('rejects duplicate and unknown observations without changing progress', () => {
        const first = observeLivingSignal({}, 'echo_bloom', 100);
        const duplicate = observeLivingSignal(first.state, 'echo_bloom', 200);
        const unknown = observeLivingSignal(first.state, 'not_a_signal', 300);

        expect(duplicate.success).toBe(false);
        expect(duplicate.progress).toBe(1);
        expect(unknown.success).toBe(false);
        expect(unknown.progress).toBe(1);
    });

    test('normalizes malformed save data and removes duplicate IDs', () => {
        expect(normalizeLivingSignalState({
            observedIds: ['echo_bloom', 'unknown', 'echo_bloom'],
            lastObservedId: 'unknown',
            lastObservedAt: 'bad'
        })).toEqual({
            observedIds: ['echo_bloom'],
            lastObservedId: null,
            lastObservedAt: null
        });
    });
});

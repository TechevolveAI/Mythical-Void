const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCurrentAtmosphere() {
    const filePath = path.join(
        __dirname,
        '../systems/CurrentAtmosphere.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${source}
        module.exports = {
            CURRENT_ATMOSPHERE_SCHEMA_VERSION,
            getCurrentAtmosphereProjection
        };`;
    const DOMAIN = {
        CURRENT_NODE_STATES: {
            LIVING: 'living',
            FADING: 'fading',
            SEVERED: 'severed',
            RESTORED: 'restored'
        },
        CURRENT_ARRIVAL_CLASSIFICATIONS: {
            QUIET: 'quiet',
            CARE_RESONANCE: 'care_resonance',
            EXTRACTION_TRACE: 'extraction_trace',
            MIXED_TRACE: 'mixed_trace'
        },
        CURRENT_REGION_DEFINITIONS: [
            { id: 'mythical_forest' },
            { id: 'crystal_caves' },
            { id: 'stellar_reef' },
            { id: 'void_peaks' },
            { id: 'aurora_depths' },
            { id: 'current_heart' }
        ]
    };
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Object,
        Set,
        Number,
        Math,
        window: undefined
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return {
        ...sandbox.module.exports,
        ...DOMAIN
    };
}

function createSnapshot(nodeState, classification = 'quiet', overrides = {}) {
    return {
        definition: {
            id: 'stellar_reef',
            privateField: 'must-not-escape'
        },
        projection: {
            nodeState,
            vitality: 55,
            privateField: 'must-not-escape'
        },
        arrivalConsequence: {
            classification,
            privateField: 'must-not-escape'
        },
        playerName: 'must-not-escape',
        ...overrides
    };
}

describe('Current atmosphere projection', () => {
    const {
        CURRENT_ATMOSPHERE_SCHEMA_VERSION,
        CURRENT_NODE_STATES,
        CURRENT_ARRIVAL_CLASSIFICATIONS,
        CURRENT_REGION_DEFINITIONS,
        getCurrentAtmosphereProjection
    } = loadCurrentAtmosphere();

    test('turns ecological recovery into progressively richer ambience', () => {
        const states = [
            CURRENT_NODE_STATES.SEVERED,
            CURRENT_NODE_STATES.FADING,
            CURRENT_NODE_STATES.LIVING,
            CURRENT_NODE_STATES.RESTORED
        ];
        const projections = states.map(state => (
            getCurrentAtmosphereProjection(createSnapshot(state))
        ));

        expect(projections.map(item => item.schemaVersion)).toEqual(
            states.map(() => CURRENT_ATMOSPHERE_SCHEMA_VERSION)
        );
        expect(projections.map(item => item.lifeFormCount)).toEqual([
            1, 3, 6, 10
        ]);
        expect(projections.map(item => item.moteCount)).toEqual([
            2, 6, 12, 18
        ]);
        expect(projections.map(item => item.scarCount)).toEqual([
            5, 3, 1, 0
        ]);
        expect(projections.map(item => item.motionDurationMs)).toEqual([
            5200, 4400, 3400, 2600
        ]);
    });

    test('makes care, extraction, and mixed upstream choices perceptible', () => {
        const care = getCurrentAtmosphereProjection(createSnapshot(
            CURRENT_NODE_STATES.LIVING,
            CURRENT_ARRIVAL_CLASSIFICATIONS.CARE_RESONANCE
        ));
        const extraction = getCurrentAtmosphereProjection(createSnapshot(
            CURRENT_NODE_STATES.LIVING,
            CURRENT_ARRIVAL_CLASSIFICATIONS.EXTRACTION_TRACE
        ));
        const mixed = getCurrentAtmosphereProjection(createSnapshot(
            CURRENT_NODE_STATES.LIVING,
            CURRENT_ARRIVAL_CLASSIFICATIONS.MIXED_TRACE
        ));

        expect(care.lifeFormCount).toBeGreaterThan(extraction.lifeFormCount);
        expect(care.scarCount).toBeLessThan(extraction.scarCount);
        expect(care.soundscape.cueId).toBe('current_life');
        expect(extraction.soundscape.cueId).toBe('current_fracture');
        expect(mixed.soundscape.cueId).toBe('current_crosscurrent');
        expect(extraction.traceLabel).toContain('EXTRACTION');
    });

    test('supports every campaign region without retaining arbitrary data', () => {
        CURRENT_REGION_DEFINITIONS.forEach(definition => {
            const snapshot = createSnapshot(
                CURRENT_NODE_STATES.FADING,
                CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET,
                { definition }
            );
            const first = getCurrentAtmosphereProjection(snapshot);
            const second = getCurrentAtmosphereProjection(snapshot);
            const serialized = JSON.stringify(first);

            expect(first).toEqual(second);
            expect(first.regionId).toBe(definition.id);
            expect(first.lifeFormCount).toBeGreaterThanOrEqual(0);
            expect(first.lifeFormCount).toBeLessThanOrEqual(12);
            expect(first.moteCount).toBeLessThanOrEqual(24);
            expect(first.scarCount).toBeLessThanOrEqual(8);
            expect(first.soundscape.intervalMs).toBeGreaterThanOrEqual(3500);
            expect(serialized).not.toContain('must-not-escape');
        });
    });

    test('uses safe bounded fallbacks for malformed snapshots', () => {
        const projection = getCurrentAtmosphereProjection({
            definition: { id: 'player-home-address' },
            projection: {
                nodeState: 'invented',
                vitality: 9000
            },
            arrivalConsequence: {
                classification: 'invented'
            }
        });

        expect(projection.regionId).toBe('unknown');
        expect(projection.nodeState).toBe(CURRENT_NODE_STATES.FADING);
        expect(projection.arrivalClassification).toBe(
            CURRENT_ARRIVAL_CLASSIFICATIONS.QUIET
        );
        expect(projection.vitality).toBe(100);
    });
});

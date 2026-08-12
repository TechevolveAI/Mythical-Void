const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadExpeditionDiagnostics() {
    const filePath = path.join(
        __dirname,
        '../systems/ExpeditionDiagnostics.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getShipReconstructionSnapshot } from './ShipReconstruction.js';",
            'const getShipReconstructionSnapshot = GET_RECONSTRUCTION;'
        )
        .replace(
            "import { getCurrentRegionSnapshot } from './CurrentEcology.js';",
            'const getCurrentRegionSnapshot = GET_CURRENT_REGION;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                EXPEDITION_DIAGNOSTICS_SCHEMA_VERSION,
                EXPEDITION_DIAGNOSTIC_DEFINITIONS,
                getExpeditionDiagnosticSnapshot
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_RECONSTRUCTION: gameState => ({
            state: {
                completedStepIds: gameState?.completedStepIds || []
            }
        }),
        GET_CURRENT_REGION: gameState => gameState?.regionSnapshot || null,
        Object,
        Array,
        Set,
        Math,
        Number,
        String,
        Boolean
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Wanderer-77 expedition diagnostics', () => {
    const { getExpeditionDiagnosticSnapshot } =
        loadExpeditionDiagnostics();

    test('keeps diagnostics offline until propulsion control is installed', () => {
        const snapshot = getExpeditionDiagnosticSnapshot(
            { completedStepIds: ['living_power_lattice'] },
            'mythical_forest'
        );

        expect(snapshot).toEqual(expect.objectContaining({
            available: false,
            routeAvailable: false,
            statusLabel: 'WANDERER-77 DIAGNOSTICS OFFLINE',
            decisionCue: 'INSTALL CRYSTAL CORE AT WANDERER-77'
        }));
        expect(Array.from(snapshot.lines)).toEqual([
            'ROUTE // INSTALL CRYSTAL CORE',
            'CURRENT // INSTALL RESONANCE HULL',
            'STELLAR // INSTALL AURORA REACTOR'
        ]);
    });

    test('turns Crystal Core repair into a route decision without claiming ecology data', () => {
        const snapshot = getExpeditionDiagnosticSnapshot(
            {
                completedStepIds: [
                    'living_power_lattice',
                    'propulsion_control'
                ]
            },
            'crystal_caves'
        );

        expect(snapshot).toEqual(expect.objectContaining({
            available: true,
            routeRisk: 'severe',
            hazardLabel: 'RESONANCE SPIKES',
            ecologyAvailable: false,
            forecastAvailable: false,
            statusLabel: 'WANDERER-77 LOCAL SCAN // NO SIGNAL SENT'
        }));
        expect(snapshot.lines[0]).toBe('ROUTE // ECHO TUNNELS NARROW');
        expect(snapshot.lines[1]).toBe('CURRENT // INSTALL RESONANCE HULL');
    });

    test('reads saved Current condition only after resonance hull calibration', () => {
        const snapshot = getExpeditionDiagnosticSnapshot(
            {
                completedStepIds: [
                    'living_power_lattice',
                    'propulsion_control',
                    'sealed_return_vector',
                    'resonance_hull'
                ],
                regionSnapshot: {
                    projection: {
                        nodeState: 'severed',
                        label: 'SEVERED',
                        vitality: 18
                    },
                    arrivalConsequence: {
                        classification: 'extraction_trace',
                        presentation: { label: 'EXTRACTION TRACE' }
                    }
                }
            },
            'void_peaks'
        );

        expect(snapshot.current).toEqual({
            nodeState: 'severed',
            vitality: 18,
            arrivalClassification: 'extraction_trace'
        });
        expect(snapshot.lines[1]).toBe(
            'CURRENT // SEVERED 18% // EXTRACTION TRACE'
        );
        expect(snapshot.decisionCue).toBe('PRIORITY // CURRENT DISTRESS');
    });

    test('adds a bounded local stellar forecast after the Aurora Reactor', () => {
        const snapshot = getExpeditionDiagnosticSnapshot(
            {
                completedStepIds: [
                    'living_power_lattice',
                    'propulsion_control',
                    'sealed_return_vector',
                    'resonance_hull',
                    'uplink_hold'
                ],
                regionSnapshot: {
                    projection: {
                        nodeState: 'fading',
                        label: 'FADING',
                        vitality: 31
                    }
                }
            },
            'aurora_depths',
            {
                weather: {
                    solarActivity: 'active',
                    cosmicEnergy: 170,
                    auroraActive: true,
                    arbitraryProviderPayload: 'discarded'
                }
            }
        );

        expect(snapshot.lines[2]).toBe('STELLAR // ACTIVE // AURORA');
        expect(snapshot.weather).toEqual({
            available: true,
            activity: 'active',
            activityLabel: 'ACTIVE',
            cosmicEnergy: 100,
            auroraActive: true
        });
        expect(JSON.stringify(snapshot)).not.toContain(
            'arbitraryProviderPayload'
        );
    });

    test('marks the local model verified only after black-box recovery', () => {
        const snapshot = getExpeditionDiagnosticSnapshot(
            {
                completedStepIds: [
                    'living_power_lattice',
                    'propulsion_control',
                    'sealed_return_vector',
                    'resonance_hull',
                    'uplink_hold',
                    'black_box_recovery'
                ],
                regionSnapshot: {
                    projection: {
                        nodeState: 'restored',
                        label: 'RESTORED',
                        vitality: 88
                    }
                }
            },
            'final_void'
        );

        expect(snapshot.verified).toBe(true);
        expect(snapshot.statusLabel).toBe(
            'WANDERER-77 LOCAL SCAN // VERIFIED'
        );
        expect(snapshot.decisionCue).toBe(
            'CAUTION // EXTREME ROUTE'
        );
    });

    test('does not create diagnostics for the Sanctuary or unknown routes', () => {
        expect(
            getExpeditionDiagnosticSnapshot({}, 'main')
        ).toEqual(expect.objectContaining({
            available: false,
            reason: 'not_expedition',
            lines: []
        }));
    });
});

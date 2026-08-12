const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadShipReconstruction() {
    const filePath = path.join(
        __dirname,
        '../systems/ShipReconstruction.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                SHIP_RECONSTRUCTION_SCHEMA_VERSION,
                SHIP_FIELD_SUPPORT_SCHEMA_VERSION,
                SHIP_RECONSTRUCTION_STEPS,
                createInitialShipReconstructionState,
                createInitialShipFieldSupportState,
                normalizeShipReconstructionState,
                normalizeShipFieldSupportState,
                getCapabilitiesForReconstruction,
                getShipFieldSupportSnapshot,
                getShipReconstructionSnapshot,
                formatShipReconstructionObjective,
                installShipReconstructionStep,
                serviceCompanionAtPoweredBerth
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    collected = ['forest_core'],
    reconstruction = {},
    fieldSupport = {},
    levelsCompleted = 1,
    health = 100,
    energy = 100
} = {}) {
    const state = {
        stats: { levelsCompleted },
        creature: {
            name: 'Nova',
            genes: { id: 'creature_nova_23' },
            stats: {
                health,
                energy,
                happiness: 80
            }
        },
        hubWorld: {
            shipParts: { collected }
        },
        story: {
            projectBeacon: {
                fieldKit: { recovered: true },
                shipReconstruction: reconstruction,
                shipFieldSupport: fieldSupport,
                shipCapabilities: {}
            }
        }
    };
    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] ||= {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn()
    };
}

describe('ShipReconstruction', () => {
    const {
        SHIP_RECONSTRUCTION_STEPS,
        normalizeShipReconstructionState,
        getShipReconstructionSnapshot,
        installShipReconstructionStep,
        normalizeShipFieldSupportState,
        serviceCompanionAtPoweredBerth
    } = loadShipReconstruction();

    test('maps the existing expedition order to six explicit repairs', () => {
        expect(SHIP_RECONSTRUCTION_STEPS.map(step => step.partId)).toEqual([
            'forest_core',
            'crystal_core',
            'dimensional_drive',
            'hull_plating',
            'aurora_reactor',
            'command_module'
        ]);

        const snapshot = getShipReconstructionSnapshot(createGameState());
        expect(snapshot.readyStep.id).toBe('living_power_lattice');
        expect(snapshot.completedCount).toBe(0);
        expect(snapshot.finalVoidReady).toBe(false);
        expect(snapshot.transmissionStatus).toBe('not_sent');
        expect(snapshot.departureStatus).toBe('deferred');
        expect(snapshot.travelStatus).toBe('undecided');
    });

    test('requires five installed systems before revealing the Final Void', () => {
        const collected = SHIP_RECONSTRUCTION_STEPS
            .slice(0, 5)
            .map(step => step.partId);
        const recoveredOnly = getShipReconstructionSnapshot(
            createGameState({ collected })
        );
        expect(recoveredOnly.finalVoidReady).toBe(false);

        const installed = getShipReconstructionSnapshot(
            createGameState({
                collected,
                reconstruction: {
                    completedStepIds: SHIP_RECONSTRUCTION_STEPS
                        .slice(0, 5)
                        .map(step => step.id)
                }
            })
        );
        expect(installed.finalVoidReady).toBe(true);
        expect(installed.complete).toBe(false);
        expect(installed.nextStep.id).toBe('black_box_recovery');
    });

    test('installs one recovered system and only its capabilities', () => {
        const gameState = createGameState();
        const result = installShipReconstructionStep(
            gameState,
            'living_power_lattice',
            { occurredAt: '2026-07-31T23:00:00.000Z' }
        );

        expect(result.changed).toBe(true);
        expect(result.reason).toBe('system_installed');
        expect(gameState.get(
            'story.projectBeacon.shipCapabilities'
        )).toEqual({
            schemaVersion: 1,
            stealthDescent: 'damaged',
            secureReturnVector: 'unavailable',
            manualLanding: 'unavailable',
            blackBoxProof: 'missing',
            passengerCapacity: 1,
            creatureLifeSupport: 'prototype_required',
            longRangeUplink: 'offline'
        });
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('requires both the recovered part and the prior installation', () => {
        const gameState = createGameState({
            collected: ['forest_core', 'dimensional_drive']
        });
        const skipped = installShipReconstructionStep(
            gameState,
            'sealed_return_vector'
        );
        expect(skipped.changed).toBe(false);
        expect(skipped.reason).toBe('prior_step_required');

        installShipReconstructionStep(
            gameState,
            'living_power_lattice'
        );
        const missing = installShipReconstructionStep(
            gameState,
            'propulsion_control'
        );
        expect(missing.changed).toBe(false);
        expect(missing.reason).toBe('ship_part_required');
    });

    test('completes reconstruction without implying launch or consent', () => {
        const gameState = createGameState({
            collected: SHIP_RECONSTRUCTION_STEPS.map(
                step => step.partId
            )
        });
        let result;
        SHIP_RECONSTRUCTION_STEPS.forEach(step => {
            result = installShipReconstructionStep(
                gameState,
                step.id,
                { save: false }
            );
        });

        expect(result.reason).toBe('reconstruction_complete');
        expect(result.snapshot.complete).toBe(true);
        expect(result.snapshot.capabilities).toEqual({
            schemaVersion: 1,
            stealthDescent: 'repaired',
            secureReturnVector: 'sealed',
            manualLanding: 'available',
            blackBoxProof: 'recovered',
            passengerCapacity: 1,
            creatureLifeSupport: 'prototype_required',
            longRangeUplink: 'held_exposure_risk'
        });
        expect(result.snapshot.transmissionStatus).toBe('not_sent');
        expect(result.snapshot.departureStatus).toBe('deferred');
        expect(result.snapshot.travelStatus).toBe('undecided');
    });

    test('normalizes imported state to contiguous, bounded facts', () => {
        const normalized = normalizeShipReconstructionState({
            completedStepIds: [
                'living_power_lattice',
                'sealed_return_vector',
                'unknown'
            ],
            arbitraryPlayerText: 'do not retain',
            history: [{
                operationId: 'Install Forest 23',
                stepId: 'living_power_lattice',
                partId: 'wrong',
                occurredAt: '2026-07-31T23:00:00.000Z',
                privateNote: 'remove this'
            }]
        });

        expect(normalized.completedStepIds).toEqual([
            'living_power_lattice'
        ]);
        expect(normalized.history).toEqual([{
            operationId: 'install_forest_23',
            type: 'ship_system_installed',
            stepId: 'living_power_lattice',
            partId: 'forest_core',
            occurredAt: '2026-07-31T23:00:00.000Z'
        }]);
        expect(JSON.stringify(normalized)).not.toContain('privateNote');
        expect(JSON.stringify(normalized)).not.toContain(
            'arbitraryPlayerText'
        );
    });

    test('is idempotent when an installation is replayed', () => {
        const gameState = createGameState();
        installShipReconstructionStep(
            gameState,
            'living_power_lattice'
        );
        const replay = installShipReconstructionStep(
            gameState,
            'living_power_lattice'
        );

        expect(replay.changed).toBe(false);
        expect(replay.reason).toBe('already_installed');
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('powers one bounded companion service per completed expedition', () => {
        const gameState = createGameState({
            reconstruction: {
                completedStepIds: ['living_power_lattice']
            },
            levelsCompleted: 2,
            health: 55,
            energy: 35
        });
        const result = serviceCompanionAtPoweredBerth(
            gameState,
            { occurredAt: '2026-07-31T23:23:00.000Z' }
        );

        expect(result.changed).toBe(true);
        expect(result.energyRestored).toBe(50);
        expect(result.healthRestored).toBe(30);
        expect(gameState.get('creature.stats.energy')).toBe(85);
        expect(gameState.get('creature.stats.health')).toBe(85);
        expect(
            gameState.get(
                'story.projectBeacon.shipFieldSupport.lastServicedLevel'
            )
        ).toBe(2);
        expect(result.snapshot.fieldSupport.status).toBe('SERVICED');
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('does not consume service when stable or replay a used milestone', () => {
        const stableState = createGameState({
            reconstruction: {
                completedStepIds: ['living_power_lattice']
            }
        });
        expect(
            serviceCompanionAtPoweredBerth(stableState).reason
        ).toBe('companion_stable');
        expect(stableState.save).not.toHaveBeenCalled();

        const usedState = createGameState({
            reconstruction: {
                completedStepIds: ['living_power_lattice']
            },
            fieldSupport: {
                lastServicedLevel: 1,
                serviceCount: 1
            },
            levelsCompleted: 1,
            health: 50,
            energy: 50
        });
        expect(
            serviceCompanionAtPoweredBerth(usedState).reason
        ).toBe('expedition_service_used');
        expect(usedState.save).not.toHaveBeenCalled();
    });

    test('requires the living power lattice and sanitizes service receipts', () => {
        const offline = createGameState({
            reconstruction: {},
            health: 40,
            energy: 40
        });
        expect(
            serviceCompanionAtPoweredBerth(offline).reason
        ).toBe('powered_berth_required');

        const normalized = normalizeShipFieldSupportState({
            lastServicedLevel: 1,
            history: [{
                operationId: 'Berth Nova 23',
                companionId: 'Nova Person',
                levelMilestone: 2,
                energyRestored: 500,
                healthRestored: 500,
                occurredAt: '2026-07-31T23:23:00.000Z',
                playerNote: 'remove this'
            }]
        });
        expect(normalized.history).toEqual([{
            operationId: 'berth_nova_23',
            type: 'powered_berth_service',
            companionId: 'nova_person',
            levelMilestone: 2,
            energyRestored: 50,
            healthRestored: 30,
            occurredAt: '2026-07-31T23:23:00.000Z'
        }]);
        expect(normalized.lastServicedLevel).toBe(2);
        expect(JSON.stringify(normalized)).not.toContain('playerNote');
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCreatureAgency() {
    const profilePath = path.join(
        __dirname,
        '../systems/CreaturePowerProfile.js'
    );
    const agencyPath = path.join(__dirname, '../systems/CreatureAgency.js');
    const profileSource = fs.readFileSync(profilePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const agencySource = fs.readFileSync(agencyPath, 'utf8')
        .replace(
            /import \{[\s\S]*?\} from '\.\/CreaturePowerProfile\.js';/,
            ''
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${profileSource}
        ${agencySource}
        module.exports = {
            CREATURE_AGENCY_SCHEMA_VERSION,
            AUTONOMOUS_RESCUE_BOND_XP,
            AUTONOMOUS_HIGH_POWER_BOND_XP,
            normalizeCreatureAgencyHistory,
            getCreatureAgencySnapshot,
            attemptAutonomousRescue,
            attemptAutonomousHighPowerRescue
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: {},
        Date,
        Object,
        Array,
        Set,
        Number,
        String,
        Math
    };

    vm.runInNewContext(script, sandbox, { filename: agencyPath });
    return sandbox.module.exports;
}

function createGameState({
    creatureId = 'nova_23',
    affinity = 'star',
    bondLevel = 2,
    bondExperience = 50,
    levelsCompleted = 0,
    newGamePlusCount = 0
} = {}) {
    const state = {
        game: {
            newGamePlusCount
        },
        stats: {
            levelsCompleted
        },
        story: {
            projectBeacon: {
                highPowerReveals: []
            }
        },
        creature: {
            id: creatureId,
            name: 'Nova',
            genes: {
                id: creatureId,
                cosmicAffinity: {
                    element: affinity,
                    powerLevel: 0.8
                }
            },
            bond: {
                level: bondLevel,
                experience: bondExperience,
                totalInteractions: 3,
                abilitySlots: {
                    slot1: true,
                    slot2: false,
                    slot3: false
                }
            },
            powerHistory: [],
            agencyHistory: []
        }
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath
                .split('.')
                .reduce((value, key) => value?.[key], state);
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('CreatureAgency', () => {
    const {
        AUTONOMOUS_RESCUE_BOND_XP,
        AUTONOMOUS_HIGH_POWER_BOND_XP,
        getCreatureAgencySnapshot,
        attemptAutonomousRescue,
        attemptAutonomousHighPowerRescue
    } = loadCreatureAgency();

    test('records one self-directed rescue with power and relationship evidence', () => {
        const gameState = createGameState();
        const result = attemptAutonomousRescue(gameState, {
            levelId: 'mythical_forest_1',
            occurredAt: '2026-07-30T18:30:00.000Z'
        });

        expect(result).toEqual(expect.objectContaining({
            changed: true,
            duplicate: false
        }));
        expect(result.decision).toEqual(expect.objectContaining({
            creatureId: 'nova_23',
            type: 'autonomous_rescue',
            trigger: 'lethal_fall',
            powerId: 'solar_shelter',
            relationshipSignal: 'protective_trust'
        }));
        expect(gameState.state.creature.agencyHistory).toHaveLength(1);
        expect(gameState.state.creature.powerHistory).toEqual([
            expect.objectContaining({
                powerId: 'solar_shelter',
                outcome: 'expedition_loss_prevented'
            })
        ]);
        expect(gameState.state.creature.bond.experience).toBe(
            50 + AUTONOMOUS_RESCUE_BOND_XP
        );
        expect(gameState.state.creature.bond.autonomousRescues).toBe(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'creatureAgencyChanged',
            expect.objectContaining({ changed: true })
        );
    });

    test('does not grant repeat rescues for the same creature and expedition', () => {
        const gameState = createGameState();
        const first = attemptAutonomousRescue(gameState, {
            levelId: 'mythical_forest_1'
        });
        const duplicate = attemptAutonomousRescue(gameState, {
            levelId: 'mythical_forest_1'
        });

        expect(first.changed).toBe(true);
        expect(duplicate).toEqual(expect.objectContaining({
            changed: false,
            duplicate: true
        }));
        expect(gameState.state.creature.agencyHistory).toHaveLength(1);
        expect(gameState.state.creature.powerHistory).toHaveLength(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('keeps decisions isolated by stable creature identity', () => {
        const novaState = createGameState({ creatureId: 'nova_23' });
        const lunaState = createGameState({
            creatureId: 'luna_23',
            affinity: 'moon'
        });

        const nova = attemptAutonomousRescue(novaState, {
            levelId: 'crystal_caves_1'
        });
        const luna = attemptAutonomousRescue(lunaState, {
            levelId: 'crystal_caves_1'
        });

        expect(nova.decision.decisionId).toContain('nova_23');
        expect(luna.decision.decisionId).toContain('luna_23');
        expect(nova.decision.powerId).toBe('solar_shelter');
        expect(luna.decision.powerId).toBe('dream_shield');
    });

    test('supports non-mutating visual previews', () => {
        const gameState = createGameState();
        const result = attemptAutonomousRescue(gameState, {
            levelId: 'preview',
            commit: false
        });

        expect(result).toEqual(expect.objectContaining({
            changed: true,
            preview: true
        }));
        expect(getCreatureAgencySnapshot(gameState).history).toHaveLength(0);
        expect(gameState.state.creature.powerHistory).toHaveLength(0);
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('can unlock the partnership move through earned rescue trust', () => {
        const gameState = createGameState({
            bondLevel: 4,
            bondExperience: 195
        });
        const result = attemptAutonomousRescue(gameState, {
            levelId: 'void_peaks_1'
        });

        expect(gameState.state.creature.bond.level).toBe(5);
        expect(gameState.state.creature.bond.abilitySlots.slot2).toBe(true);
        expect(result.partnershipUnlocked).toBe(true);
        expect(result.profile.partnershipMove.unlocked).toBe(true);
    });

    test('does not expose the authored high-power rescue before five expeditions', () => {
        const gameState = createGameState({
            bondLevel: 1,
            levelsCompleted: 4
        });

        const result = attemptAutonomousHighPowerRescue(gameState);

        expect(result).toEqual(expect.objectContaining({
            changed: false,
            duplicate: false,
            reason: 'shared_journey_not_ready'
        }));
        expect(gameState.state.creature.agencyHistory).toHaveLength(0);
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test.each([
        ['star', 'daybreak_event'],
        ['moon', 'stillnight_event'],
        ['nebula', 'skyfold_event'],
        ['crystal', 'worldglass_event'],
        ['void', 'horizon_lock_event']
    ])(
        'records the %s world-scale rescue as witnessed portable history',
        (affinity, powerId) => {
            const gameState = createGameState({
                affinity,
                bondLevel: 1,
                bondExperience: 40,
                levelsCompleted: 5
            });

            const result = attemptAutonomousHighPowerRescue(gameState, {
                occurredAt: '2026-07-30T20:23:00.000Z'
            });

            expect(result).toEqual(expect.objectContaining({
                changed: true,
                duplicate: false
            }));
            expect(result.decision).toEqual(expect.objectContaining({
                type: 'high_power_rescue',
                powerId,
                affinity,
                magnitude: 'extreme',
                outcome: 'living_network_stabilized',
                relationshipSignal: 'world_protective_trust',
                witnessScope: 'five_living_systems',
                earthVisibility: 'city_scale_detectable'
            }));
            expect(gameState.state.creature.powerHistory).toEqual([
                expect.objectContaining({
                    powerId,
                    magnitude: 'extreme',
                    outcome: 'living_network_stabilized'
                })
            ]);
            expect(
                gameState.state.story.projectBeacon.highPowerReveals
            ).toEqual([
                expect.objectContaining({
                    powerId,
                    witnessScope: 'five_living_systems',
                    earthVisibility: 'city_scale_detectable'
                })
            ]);
            expect(gameState.state.creature.bond.experience).toBe(
                40 + AUTONOMOUS_HIGH_POWER_BOND_XP
            );
            expect(gameState.state.creature.bond.highPowerRescues).toBe(1);
            expect(gameState.save).toHaveBeenCalledTimes(1);
            expect(gameState.emit).toHaveBeenCalledWith(
                'creatureHighPowerWitnessed',
                expect.objectContaining({ changed: true })
            );
        }
    );

    test('deduplicates one campaign run but permits a New Game+ witness record', () => {
        const gameState = createGameState({ levelsCompleted: 5 });
        const first = attemptAutonomousHighPowerRescue(gameState);
        const duplicate = attemptAutonomousHighPowerRescue(gameState);

        expect(first.changed).toBe(true);
        expect(duplicate).toEqual(expect.objectContaining({
            changed: false,
            duplicate: true
        }));

        gameState.state.game.newGamePlusCount = 1;
        const replay = attemptAutonomousHighPowerRescue(gameState);
        expect(replay.changed).toBe(true);
        expect(replay.decision.decisionId).toContain('run_1');
        expect(gameState.state.creature.agencyHistory).toHaveLength(2);
        expect(
            gameState.state.story.projectBeacon.highPowerReveals
        ).toHaveLength(2);
    });

    test('supports a non-mutating high-power visual preview before readiness', () => {
        const gameState = createGameState({ levelsCompleted: 0 });
        const result = attemptAutonomousHighPowerRescue(gameState, {
            commit: false
        });

        expect(result).toEqual(expect.objectContaining({
            changed: true,
            preview: true
        }));
        expect(gameState.state.creature.agencyHistory).toHaveLength(0);
        expect(
            gameState.state.story.projectBeacon.highPowerReveals
        ).toHaveLength(0);
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('portable creature records include the agency ledger', () => {
        const gameStateSource = fs.readFileSync(
            path.join(__dirname, '../systems/GameState.js'),
            'utf8'
        );

        expect(gameStateSource).toContain("'agencyHistory',");
        expect(gameStateSource).toContain('agencyHistory: []');
        expect(gameStateSource).toContain(
            "agencyHistory: this.get('creature.agencyHistory') || []"
        );
    });
});

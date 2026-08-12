const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPowerProfile() {
    const filePath = path.join(__dirname, '../systems/CreaturePowerProfile.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ');
    const script = `${source}
        module.exports = {
            CREATURE_POWER_PROFILE_SCHEMA_VERSION,
            CREATURE_POWER_DEFINITIONS,
            getCreatureAffinity,
            buildCreaturePowerProfile,
            recordCreaturePowerEvent
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Date,
        Object,
        Array,
        Set,
        Number,
        String,
        Math
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    affinity = 'nebula',
    powerLevel = 0.75,
    bondLevel = 6,
    levelsCompleted = 0
} = {}) {
    const state = {
        stats: {
            levelsCompleted
        },
        creature: {
            genes: {
                id: `creature_${affinity}_23`,
                cosmicAffinity: {
                    element: affinity,
                    powerLevel
                }
            },
            bond: {
                level: bondLevel
            },
            powerHistory: []
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

describe('CreaturePowerProfile', () => {
    const {
        CREATURE_POWER_DEFINITIONS,
        buildCreaturePowerProfile,
        recordCreaturePowerEvent
    } = loadPowerProfile();

    test.each(Object.keys(CREATURE_POWER_DEFINITIONS))(
        '%s creatures retain extreme potential',
        affinity => {
            const profile = buildCreaturePowerProfile(createGameState({ affinity }));

            expect(profile.affinity).toBe(affinity);
            expect(profile.magnitudeClass).toBe('extreme');
            expect(profile.potentialOutput).toBe(100);
            expect(profile.affinityPower.id).toEqual(expect.any(String));
            expect(profile.protectiveResponse.id).toEqual(expect.any(String));
            expect(profile.operatingDoctrine.strengthReduced).toBe(false);
        }
    );

    test('Earth requires restraint because use is detectable, not because power is reduced', () => {
        const profile = buildCreaturePowerProfile(createGameState({
            affinity: 'void',
            powerLevel: 1,
            bondLevel: 12
        }), {
            context: 'earth'
        });

        expect(profile.operatingDoctrine).toEqual(expect.objectContaining({
            strengthReduced: false,
            restraintRequired: true,
            detectionRisk: 'extreme'
        }));
        expect(profile.partnershipMove.unlocked).toBe(true);
        expect(profile.highPowerReveal.unlocked).toBe(true);
    });

    test('supports legacy saves that stored the creature under genetics', () => {
        const gameState = createGameState();
        gameState.state.creature.genetics = {
            id: 'legacy_crystal_23',
            cosmicAffinity: {
                element: 'crystal',
                powerLevel: 0.9
            }
        };
        delete gameState.state.creature.genes;

        const profile = buildCreaturePowerProfile(gameState);

        expect(profile.creatureId).toBe('legacy_crystal_23');
        expect(profile.affinity).toBe('crystal');
        expect(profile.affinityPower.id).toBe('crystal_sense');
    });

    test('the shared expedition journey unlocks late powers before Final Void', () => {
        const early = buildCreaturePowerProfile(createGameState({
            bondLevel: 1,
            levelsCompleted: 2
        }));
        const trusted = buildCreaturePowerProfile(createGameState({
            bondLevel: 1,
            levelsCompleted: 3
        }));
        const finaleReady = buildCreaturePowerProfile(createGameState({
            bondLevel: 1,
            levelsCompleted: 5
        }));

        expect(early.partnershipMove.unlocked).toBe(false);
        expect(early.highPowerReveal.unlocked).toBe(false);
        expect(trusted.partnershipMove.unlocked).toBe(true);
        expect(trusted.relationshipState).toBe('trusting');
        expect(finaleReady.highPowerReveal.unlocked).toBe(true);
        expect(finaleReady.relationshipState).toBe('synchronized');
        expect(finaleReady.expeditionsCompleted).toBe(5);
    });

    test('records each witnessed power event once and keeps it save-backed', () => {
        const gameState = createGameState({ affinity: 'crystal' });
        const first = recordCreaturePowerEvent(gameState, {
            eventId: 'forest_knot_response',
            powerId: 'crystal_sense',
            magnitude: 'major',
            occurredAt: '2026-07-30T15:00:00.000Z'
        });
        const duplicate = recordCreaturePowerEvent(gameState, {
            eventId: 'forest_knot_response',
            powerId: 'crystal_sense'
        });

        expect(first).toEqual(expect.objectContaining({
            eventId: 'forest_knot_response',
            powerId: 'crystal_sense',
            affinity: 'crystal',
            magnitude: 'major'
        }));
        expect(duplicate).toEqual(first);
        expect(gameState.state.creature.powerHistory).toHaveLength(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(gameState.emit).toHaveBeenCalledWith(
            'creaturePowerWitnessed',
            first
        );
    });

    test('the first expedition invokes the profile and records the witnessed power', () => {
        const levelSource = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(levelSource).toContain('buildCreaturePowerProfile');
        expect(levelSource).toContain('recordCreaturePowerEvent');
        expect(levelSource).toContain("eventId: 'forest_knot_response'");
        expect(levelSource).toContain('showFirstExpeditionPowerResponse');
        expect(gameSource).toContain(
            "expeditionDrillPreview === 'power-mobile'"
        );
    });
});

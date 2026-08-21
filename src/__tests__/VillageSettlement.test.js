const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadVillageSettlement() {
    const filePath = path.join(__dirname, '../systems/VillageSettlement.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getFendCommunitySnapshot } from './FendCommunity.js';",
            'const getFendCommunitySnapshot = GET_FEND_COMMUNITY_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                VILLAGE_SCHEMA_VERSION,
                VILLAGE_PRODUCTION_CAP_MS,
                VILLAGE_BUILDING_ARTWORK,
                VILLAGE_RESOURCE_DEFINITIONS,
                VILLAGE_PLOTS,
                VILLAGE_BUILDING_DEFINITIONS,
                normalizeVillageState,
                getVillageGameplayEffects,
                getVillageWorldGuidance,
                getVillageUnlock,
                markVillageGuidanceSeen,
                getVillageCreatureRoster,
                getCreatureWorkProfile,
                initializeVillageSettlement,
                reconcileVillageState,
                reconcileVillageSettlement,
                getVillageSnapshot,
                placeVillageBuilding,
                assignCreatureToVillageBuilding
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_FEND_COMMUNITY_SNAPSHOT: gameState => ({
            stage: (gameState.get('world.fendCommunity.builtProjectIds') || []).length
        }),
        Date,
        JSON,
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

function createGameState({ stage = 1, village = {}, creature = null } = {}) {
    const activeCreature = creature || {
        id: 'companion_nova',
        name: 'Nova',
        genes: {
            personality: { primary: 'curious' },
            cosmicAffinity: { element: 'nebula' }
        },
        stats: { happiness: 92, energy: 90 }
    };
    const state = {
        world: {
            fendCommunity: {
                builtProjectIds: Array.from(
                    { length: stage },
                    (_, index) => `stage_${index}`
                )
            },
            village
        },
        creature: {
            ...activeCreature,
            hatched: true
        },
        creatures: [activeCreature],
        activeCreatureIndex: 0,
        maxCreatures: 8
    };
    return {
        state,
        get(pathName) {
            return pathName.split('.').reduce((value, key) => value?.[key], state);
        },
        set: jest.fn((pathName, value) => {
            const keys = pathName.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        getActiveCreature: () => activeCreature,
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('Village settlement phase one', () => {
    const village = loadVillageSettlement();

    test('unlocks after a companion is hatched, before First Light Shelter exists', () => {
        const gameState = createGameState({ stage: 0 });
        const snapshot = village.initializeVillageSettlement(gameState, {
            now: 1000
        });

        expect(snapshot.unlock.unlocked).toBe(true);
        expect(snapshot.resources).toEqual({ wood: 72, stone: 52, food: 30 });
        expect(snapshot.state.starterSuppliesClaimed).toBe(true);
    });

    test('grants one starter stockpile without duplicating it on later loads', () => {
        const gameState = createGameState();
        const first = village.initializeVillageSettlement(gameState, {
            now: 1000
        });
        const second = village.initializeVillageSettlement(gameState, {
            now: 2000
        });

        expect(first.resources).toEqual({ wood: 72, stone: 52, food: 30 });
        expect(second.resources).toEqual(first.resources);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(second.state.history.filter(entry => entry.type === 'village_founded')).toHaveLength(1);
    });

    test('records Village Heart guidance once without altering settlement resources', () => {
        const gameState = createGameState();
        village.initializeVillageSettlement(gameState, { now: 1000 });

        const result = village.markVillageGuidanceSeen(gameState);

        expect(result.state.guidanceSeen).toBe(true);
        expect(result.resources).toEqual({ wood: 72, stone: 52, food: 30 });
        expect(gameState.save).toHaveBeenCalledTimes(2);
    });

    test('spends resources and creates one deterministic construction per plot', () => {
        const gameState = createGameState();
        village.initializeVillageSettlement(gameState, { now: 1000 });
        const result = village.placeVillageBuilding(gameState, {
            definitionId: 'forager_hut',
            plotId: 'root_01',
            now: 2000
        });

        expect(result.changed).toBe(true);
        expect(result.snapshot.resources).toEqual({ wood: 54, stone: 44, food: 30 });
        expect(result.snapshot.buildings[0]).toEqual(expect.objectContaining({
            id: 'village:forager_hut:root_01',
            status: 'constructing'
        }));

        const occupied = village.placeVillageBuilding(gameState, {
            definitionId: 'sawmill',
            plotId: 'root_01',
            now: 3000
        });
        expect(occupied).toEqual(expect.objectContaining({
            changed: false,
            reason: 'plot_occupied'
        }));
    });

    test('completes construction, invites a creature, and produces supplies', () => {
        const gameState = createGameState();
        village.initializeVillageSettlement(gameState, { now: 1000 });
        const placed = village.placeVillageBuilding(gameState, {
            definitionId: 'forager_hut',
            plotId: 'root_01',
            now: 2000
        });
        village.reconcileVillageSettlement(gameState, {
            now: 10000
        });
        const assigned = village.assignCreatureToVillageBuilding(gameState, {
            buildingId: placed.buildingId,
            creatureId: 'companion_nova',
            now: 11000
        });
        const produced = village.reconcileVillageSettlement(gameState, {
            now: 131000
        });

        expect(assigned.changed).toBe(true);
        expect(assigned.snapshot.buildings[0].workProfile.matches).toEqual(
            expect.arrayContaining(['curious', 'nebula'])
        );
        expect(assigned.snapshot.buildings[0].workProfile.multiplier).toBe(1.4);
        expect(assigned.snapshot.productionRates.food).toBe(3);
        expect(produced.resources.food).toBe(36);
        expect(produced.lifetimeProduced.food).toBe(6);
        expect(produced.buildings[0].totalProduced).toBe(6);
    });

    test('requires the three producer structures before the workshop', () => {
        const gameState = createGameState();
        village.initializeVillageSettlement(gameState, { now: 1000 });
        const workshop = village.getVillageSnapshot(gameState).definitions.find(
            definition => definition.id === 'workshop'
        );

        expect(workshop.placement.available).toBe(false);
        expect(Array.from(workshop.placement.missingPrerequisites)).toEqual([
            'forager_hut',
            'sawmill',
            'current_masonry'
        ]);
    });

    test('normalization rejects duplicate definitions and occupied plots', () => {
        const normalized = village.normalizeVillageState({
            resources: { wood: -10, stone: 7.8, food: '4' },
            buildings: [
                { definitionId: 'forager_hut', plotId: 'root_01', status: 'complete' },
                { definitionId: 'forager_hut', plotId: 'root_02', status: 'complete' },
                { definitionId: 'sawmill', plotId: 'root_01', status: 'complete' },
                { definitionId: 'unknown', plotId: 'root_03', status: 'complete' }
            ]
        });

        expect(normalized.resources).toEqual({ wood: 0, stone: 7, food: 4 });
        expect(normalized.buildings).toHaveLength(1);
        expect(normalized.buildings[0].definitionId).toBe('forager_hut');
    });

    test('completed structures activate distinct cross-game effects and habitat capacity', () => {
        const completeBuilding = (definitionId, plotId) => ({
            definitionId,
            plotId,
            status: 'complete',
            startedAt: 1,
            completesAt: 2,
            completedAt: 2
        });
        const gameState = createGameState({
            village: {
                starterSuppliesClaimed: true,
                buildings: [
                    {
                        ...completeBuilding('forager_hut', 'root_01'),
                        assignedCreatureId: 'companion_nova'
                    },
                    {
                        ...completeBuilding('sawmill', 'root_02'),
                        assignedCreatureId: 'companion_ember'
                    },
                    {
                        ...completeBuilding('current_masonry', 'root_03'),
                        assignedCreatureId: 'companion_lumen'
                    },
                    completeBuilding('habitat', 'root_04'),
                    completeBuilding('workshop', 'root_05')
                ]
            }
        });

        village.initializeVillageSettlement(gameState, { now: 1000 });

        expect(village.getVillageGameplayEffects(gameState)).toEqual({
            feedHappinessBonus: 5,
            victoryCoinBonus: 10,
            guardCharges: 1,
            creatureCapacityBonus: 2,
            maxEnergyBonus: 1,
            activeBuildingIds: [
                'forager_hut',
                'sawmill',
                'current_masonry',
                'habitat',
                'workshop'
            ]
        });
        expect(gameState.get('maxCreatures')).toBe(10);
        const phase = village.getVillageSnapshot(gameState).phase;
        expect(phase.complete).toBe(true);
        expect(phase.title).toBe('PHASE ONE SETTLEMENT ONLINE');
    });

    test('world guidance prioritizes construction, staffing, building, then completion', () => {
        const forager = village.VILLAGE_BUILDING_DEFINITIONS[0];
        const sawmill = village.VILLAGE_BUILDING_DEFINITIONS[1];
        const snapshot = {
            buildings: [{
                status: 'constructing',
                definition: forager,
                creature: null
            }],
            definitions: []
        };

        expect(village.getVillageWorldGuidance(snapshot)).toBe(
            '0/5 RESTORED · FORAGE GROWING'
        );
        snapshot.buildings[0].status = 'complete';
        expect(village.getVillageWorldGuidance(snapshot)).toBe(
            '1/5 RESTORED · INVITE A HELPER'
        );
        snapshot.buildings[0].creature = { id: 'nova' };
        snapshot.definitions = [{
            ...sawmill,
            placement: { available: true }
        }];
        expect(village.getVillageWorldGuidance(snapshot)).toBe(
            '1/5 RESTORED · BUILD SAWMILL'
        );
        snapshot.buildings = village.VILLAGE_BUILDING_DEFINITIONS.map(definition => ({
            status: 'complete',
            definition,
            creature: definition.production ? { id: definition.id } : null
        }));
        snapshot.definitions = [];
        expect(village.getVillageWorldGuidance(snapshot)).toBe('SETTLEMENT ONLINE');
    });
});

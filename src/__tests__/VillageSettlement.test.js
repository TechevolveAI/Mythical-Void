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
                VILLAGE_GROWTH_PROFILES,
                VILLAGE_COMMUNITY_MOMENT_DEFINITIONS,
                VILLAGE_HEART_DECISION_DEFINITIONS,
                normalizeVillageState,
                getVillageGameplayEffects,
                getVillageSupportSummary,
                getVillageHeartValues,
                getVillageWorldState,
                getVillageGrowthProfile,
                getVillageWorldGuidance,
                getVillageUnlock,
                markVillageGuidanceSeen,
                getVillageCreatureRoster,
                getCreatureWorkProfile,
                initializeVillageSettlement,
                reconcileVillageState,
                reconcileVillageSettlement,
                getVillageHomeProfile,
                getVillageResidentRoutinePlan,
                getVillageCommunityMoments,
                getVillageCommunityMoment,
                getVillageHeartDecisionState,
                getVillageHeartMemory,
                getVillageWorkerCheckIn,
                getVillageResidentProposal,
                getVillageReturnRitual,
                getVillageSnapshot,
                placeVillageBuilding,
                assignCreatureToVillageBuilding,
                resolveVillageHeartDecision
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

function createGameState({
    stage = 1,
    village = {},
    creature = null,
    creatures = null
} = {}) {
    const activeCreature = creature || creatures?.[0] || {
        id: 'companion_nova',
        name: 'Nova',
        genes: {
            personality: { primary: 'curious' },
            cosmicAffinity: { element: 'nebula' }
        },
        stats: { happiness: 92, energy: 90 }
    };
    const roster = creatures || [activeCreature];
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
        creatures: roster,
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

    test('summarizes active building effects in plain player-facing language', () => {
        const summary = village.getVillageSupportSummary({
            feedHappinessBonus: 7,
            victoryCoinBonus: 10,
            guardCharges: 1,
            creatureCapacityBonus: 2,
            maxEnergyBonus: 2,
            heartReadinessEnergyBonus: 1
        });

        expect(summary.map(effect => effect.id)).toEqual([
            'feeding_happiness',
            'victory_coins',
            'blocked_hits',
            'creature_homes',
            'expedition_energy'
        ]);
        expect(summary.find(effect => effect.id === 'blocked_hits')).toEqual(
            expect.objectContaining({
                context: 'expedition',
                effect: '1 INCOMING HIT IS BLOCKED',
                compact: 'BLOCK 1 HIT'
            })
        );
        expect(summary.find(effect => effect.id === 'creature_homes').effect).toBe(
            'ROOM FOR 2 MORE CREATURES'
        );
        expect(summary.find(effect => effect.id === 'expedition_energy')).toEqual(
            expect.objectContaining({
                source: 'WORKSHOP + VILLAGE HEART',
                effect: 'START WITH 2 EXTRA ENERGY'
            })
        );
    });

    test('turns the next building into a named resident proposal', () => {
        const gameState = createGameState();
        const snapshot = village.initializeVillageSettlement(gameState, { now: 1000 });
        const proposal = village.getVillageResidentProposal(snapshot);

        expect(proposal).toEqual(expect.objectContaining({
            definitionId: 'forager_hut',
            speakerId: 'companion_nova',
            speakerName: 'Nova',
            title: 'MARK A SAFE FOOD PATH',
            available: true
        }));
        expect(proposal.request).toContain('grows back');
        expect(proposal.promise).toContain('tomorrow');
        expect(snapshot.residentProposal).toEqual(proposal);
    });

    test('turns an expedition return into a resident-led Sanctuary ritual', () => {
        const gameState = createGameState();
        const snapshot = village.initializeVillageSettlement(gameState, { now: 1000 });
        const ritual = village.getVillageReturnRitual(snapshot, {
            id: 'beacon_debrief_1',
            levelId: 'mythicalForest',
            shipPartId: 'navigation_core',
            completedAt: '2026-08-22T12:00:00.000Z'
        });

        expect(ritual).toEqual(expect.objectContaining({
            id: 'beacon_debrief_1',
            levelId: 'mythicalForest',
            levelLabel: 'MYTHICAL FOREST',
            outcome: 'NAVIGATION CORE RECOVERED',
            worldChange: '0/5 ROOTS RESTORED · CURRENT PATHS HOLD'
        }));
        expect(ritual.line).toContain('Nova meets you at the Heart');
        expect(ritual.line).toContain('counts who returned before what they carried');
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

    test('derives one world-native next action and visible growth tier', () => {
        const gameState = createGameState();
        const founded = village.initializeVillageSettlement(gameState, { now: 1000 });
        expect(founded.worldState).toEqual(expect.objectContaining({
            restored: 0,
            growthTier: 0,
            growthLabel: 'AWAKENED ROOT',
            nextAction: expect.objectContaining({
                type: 'build',
                plotId: 'root_01',
                definitionId: 'forager_hut',
                label: 'BUILD FORAGE'
            })
        }));

        const placed = village.placeVillageBuilding(gameState, {
            definitionId: 'forager_hut',
            plotId: 'root_01',
            now: 2000
        });
        expect(placed.snapshot.worldState.nextAction).toEqual(
            expect.objectContaining({
                type: 'construction',
                plotId: 'root_01'
            })
        );

        const complete = village.reconcileVillageSettlement(gameState, {
            now: 2000 + 8000
        });
        expect(complete.worldState).toEqual(expect.objectContaining({
            restored: 1,
            growthTier: 1,
            growthLabel: 'FIRST ROOT',
            nextAction: expect.objectContaining({
                type: 'assign',
                plotId: 'root_01',
                definitionId: 'forager_hut'
            })
        }));

        const noSupplies = createGameState({
            village: {
                starterSuppliesClaimed: true,
                resources: { wood: 0, stone: 0, food: 0 }
            }
        });
        const waiting = village.getVillageSnapshot(noSupplies);
        expect(waiting.worldState.nextAction).toEqual(expect.objectContaining({
            type: 'supplies',
            definitionId: 'forager_hut',
            label: 'GATHER 18 WOOD'
        }));
        expect(village.getVillageWorldGuidance(waiting)).toBe(
            '0/5 RESTORED · GATHER 18 WOOD'
        );
    });

    test('defines perceptible world identities for every settlement growth tier', () => {
        expect(village.VILLAGE_GROWTH_PROFILES).toHaveLength(5);
        expect(village.VILLAGE_GROWTH_PROFILES.map(profile => profile.worldIdentity)).toEqual([
            'signal_seed',
            'first_shelter',
            'shared_crossing',
            'resident_commons',
            'current_canopy'
        ]);
        expect(village.getVillageGrowthProfile(-1)).toEqual(expect.objectContaining({
            tier: 0,
            gatheringCapacity: 0
        }));
        expect(village.getVillageGrowthProfile(4)).toEqual(expect.objectContaining({
            tier: 4,
            label: 'SHARED SANCTUARY',
            canopyCount: 5,
            gatheringCapacity: 4
        }));
        expect(village.getVillageGrowthProfile(99).tier).toBe(4);
        expect(village.getVillageGrowthProfile(2.9).tier).toBe(2);
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
            heartCareBonus: 0,
            heartReadinessEnergyBonus: 0,
            heartValues: { care: 0, readiness: 0 },
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

    test('every structure exposes a concise world purpose language', () => {
        const expected = {
            forager_hut: ['FEED +5', 'renewing_food'],
            sawmill: ['WIN +10', 'repair_value'],
            current_masonry: ['BLOCK 1 HIT', 'current_guard'],
            habitat: ['2 SAFE HOMES', 'shared_home'],
            workshop: ['ENERGY +1', 'shared_energy']
        };

        expect(village.VILLAGE_BUILDING_DEFINITIONS.map(definition => ({
            id: definition.id,
            worldActionLabel: definition.worldActionLabel,
            purposeGlyph: definition.purposeGlyph
        }))).toEqual(Object.entries(expected).map(([id, values]) => ({
            id,
            worldActionLabel: values[0],
            purposeGlyph: values[1]
        })));
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
            '1/5 RESTORED · INVITE HELP AT FORAGE'
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

    test('every producer has an authored visible worker routine', () => {
        const producers = village.VILLAGE_BUILDING_DEFINITIONS.filter(
            definition => definition.production
        );

        expect(producers).toHaveLength(4);
        producers.forEach(definition => {
            expect(definition.workerRoutine).toEqual(expect.objectContaining({
                cue: expect.any(String),
                carriedResource: expect.any(String),
                emotionalPurpose: expect.any(String)
            }));
            expect(definition.workerRoutine.cue.length).toBeGreaterThan(8);
            expect(definition.workerRoutine.emotionalPurpose.length).toBeGreaterThan(16);
        });
    });

    test('the Habitat prioritizes companions who are physically home', () => {
        const definitions = new Map(
            village.VILLAGE_BUILDING_DEFINITIONS.map(definition => [definition.id, definition])
        );
        const buildings = [
            {
                definitionId: 'forager_hut',
                definition: definitions.get('forager_hut'),
                status: 'complete',
                assignedCreatureId: 'nova'
            },
            {
                definitionId: 'habitat',
                definition: definitions.get('habitat'),
                plotId: 'root_04',
                status: 'complete'
            }
        ];
        const home = village.getVillageHomeProfile(buildings, [
            { id: 'nova', name: 'Nova' },
            { id: 'ember', name: 'Ember' },
            { id: 'lumen', name: 'Lumen' }
        ]);

        expect(home).toEqual(expect.objectContaining({
            unlocked: true,
            capacity: 2,
            plotId: 'root_04',
            presentCount: 2,
            helpingCount: 0
        }));
        expect(home.residents).toEqual([
            expect.objectContaining({ name: 'Ember', atWork: false }),
            expect.objectContaining({ name: 'Lumen', atWork: false })
        ]);

        const everyoneHelping = village.getVillageHomeProfile([
            buildings[0],
            {
                definitionId: 'sawmill',
                definition: definitions.get('sawmill'),
                status: 'complete',
                assignedCreatureId: 'ember'
            },
            buildings[1]
        ], [
            { id: 'nova', name: 'Nova' },
            { id: 'ember', name: 'Ember' }
        ]);
        expect(everyoneHelping).toEqual(expect.objectContaining({
            capacity: 2,
            presentCount: 0,
            helpingCount: 2
        }));
        expect(everyoneHelping.residents.every(resident => resident.atWork)).toBe(true);
    });

    test('resident routines assign one coherent world location per companion', () => {
        const definitions = new Map(
            village.VILLAGE_BUILDING_DEFINITIONS.map(definition => [definition.id, definition])
        );
        const routines = village.getVillageResidentRoutinePlan({
            worldState: { growthTier: 3 },
            home: {
                plotId: 'root_04',
                residents: [
                    { id: 'nova', name: 'Nova', atWork: false },
                    { id: 'ember', name: 'Ember', atWork: false },
                    {
                        id: 'lumen',
                        name: 'Lumen',
                        atWork: true,
                        workBuildingId: 'current_masonry',
                        workLabel: 'MASONRY'
                    }
                ]
            },
            buildings: [{
                definitionId: 'current_masonry',
                definition: definitions.get('current_masonry')
            }]
        });

        expect(routines).toEqual([
            expect.objectContaining({
                residentId: 'nova',
                location: 'commons',
                route: 'home_to_commons'
            }),
            expect.objectContaining({
                residentId: 'ember',
                location: 'home',
                route: 'resting_at_home'
            }),
            expect.objectContaining({
                residentId: 'lumen',
                location: 'work',
                route: 'building_to_heart',
                activity: 'LISTENS FOR SAFE STONE'
            })
        ]);
        expect(new Set(routines.map(routine => routine.residentId)).size).toBe(3);
    });

    test('community moments require real distinct assigned companions', () => {
        const definitions = new Map(
            village.VILLAGE_BUILDING_DEFINITIONS.map(definition => [definition.id, definition])
        );
        const staffed = (definitionId, plotId, id, name) => ({
            definitionId,
            definition: definitions.get(definitionId),
            plotId,
            status: 'complete',
            assignedCreatureId: id,
            creature: { id, name }
        });
        const moments = village.getVillageCommunityMoments({
            buildings: [
                staffed('forager_hut', 'root_01', 'nova', 'Nova'),
                staffed('sawmill', 'root_02', 'ember', 'Ember'),
                staffed('current_masonry', 'root_03', 'lumen', 'Lumen'),
                {
                    definitionId: 'habitat',
                    definition: definitions.get('habitat'),
                    plotId: 'root_04',
                    status: 'complete',
                    creature: null
                }
            ]
        });

        expect(moments.map(moment => moment.id)).toEqual([
            'safe_paths',
            'fallen_timber',
            'return_home'
        ]);
        expect(moments[0]).toEqual(expect.objectContaining({
            participantNames: ['Nova', 'Lumen'],
            sharedValue: 'TAKE ONLY WHAT RETURNS'
        }));
        expect(village.getVillageCommunityMoment({ communityMoments: moments }, { cycle: 4 }).id)
            .toBe('fallen_timber');

        const duplicate = village.getVillageCommunityMoments({
            buildings: [
                staffed('forager_hut', 'root_01', 'nova', 'Nova'),
                staffed('current_masonry', 'root_03', 'nova', 'Nova')
            ]
        });
        expect(duplicate).toHaveLength(0);
    });

    test('Heart Decisions unlock from real structures and reject duplicate resolution', () => {
        const nova = { id: 'nova', name: 'Nova' };
        const lumen = { id: 'lumen', name: 'Lumen' };
        const complete = (definitionId, plotId, assignedCreatureId) => ({
            definitionId,
            plotId,
            status: 'complete',
            startedAt: 1,
            completesAt: 2,
            completedAt: 2,
            assignedCreatureId
        });
        const gameState = createGameState({
            creatures: [nova, lumen],
            village: {
                starterSuppliesClaimed: true,
                buildings: [
                    complete('sawmill', 'root_01', 'nova'),
                    complete('current_masonry', 'root_02', 'lumen')
                ]
            }
        });

        const before = village.getVillageSnapshot(gameState);
        expect(before.heartDecision.active).toEqual(expect.objectContaining({
            id: 'storm_path',
            participantNames: ['Nova', 'Lumen']
        }));

        const result = village.resolveVillageHeartDecision(gameState, {
            decisionId: 'storm_path',
            optionId: 'current_first',
            now: 5000
        });
        expect(result).toEqual(expect.objectContaining({
            changed: true,
            reason: 'heart_decision_resolved'
        }));
        expect(result.snapshot.heartDecision.values).toEqual({ care: 1, readiness: 0 });
        expect(result.snapshot.state.heartDecisions).toEqual([{
            decisionId: 'storm_path',
            optionId: 'current_first',
            occurredAt: 5000,
            participantCreatureIds: ['nova', 'lumen'],
            participantNames: ['Nova', 'Lumen']
        }]);
        expect(result.snapshot.heartDecision.completed[0]).toEqual(
            expect.objectContaining({
                speakerName: 'Nova',
                participantNames: ['Nova', 'Lumen'],
                followUpLine: expect.stringContaining('Current is moving again')
            })
        );
        expect(village.getVillageHeartMemory(result.snapshot)).toEqual(
            expect.objectContaining({
                decisionId: 'storm_path',
                optionId: 'current_first',
                value: 'care',
                speakerName: 'Nova',
                participantNames: ['Nova', 'Lumen']
            })
        );
        const movedState = gameState.get('world.village');
        gameState.set('world.village', {
            ...movedState,
            buildings: movedState.buildings.map(building => ({
                ...building,
                assignedCreatureId: null
            }))
        });
        const rememberedAfterMove = village.getVillageHeartMemory(
            village.getVillageSnapshot(gameState)
        );
        expect(rememberedAfterMove).toEqual(expect.objectContaining({
            speakerName: 'Nova',
            participantNames: ['Nova', 'Lumen']
        }));
        expect(village.getVillageWorkerCheckIn(result.snapshot, {
            creatureId: 'nova'
        })).toEqual(expect.objectContaining({
            name: 'Nova',
            definitionId: 'sawmill',
            roleLabel: 'SHAPER',
            routineCue: 'SHAPES FALLEN TIMBER',
            line: expect.stringContaining('No living tree had to fall'),
            impact: 'VICTORY · +10 COINS',
            memory: expect.objectContaining({
                decisionId: 'storm_path',
                optionId: 'current_first',
                value: 'care'
            })
        }));
        expect(village.getVillageWorkerCheckIn(result.snapshot, {
            creatureId: 'unknown'
        })).toBeNull();

        const duplicate = village.resolveVillageHeartDecision(gameState, {
            decisionId: 'storm_path',
            optionId: 'field_braces',
            now: 6000
        });
        expect(duplicate).toEqual(expect.objectContaining({
            changed: false,
            reason: 'decision_unavailable'
        }));
    });

    test('two remembered values strengthen existing care or expedition support', () => {
        const complete = (definitionId, plotId) => ({
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
                heartDecisions: [
                    { decisionId: 'storm_path', optionId: 'current_first', occurredAt: 3 },
                    { decisionId: 'shared_harvest', optionId: 'welcome_table', occurredAt: 4 },
                    { decisionId: 'unknown_tool', optionId: 'wanderer_trial', occurredAt: 5 },
                    { decisionId: 'storm_path', optionId: 'field_braces', occurredAt: 6 },
                    { decisionId: 'bad', optionId: 'bad', occurredAt: 7 }
                ],
                buildings: [
                    complete('forager_hut', 'root_01'),
                    complete('workshop', 'root_02')
                ]
            }
        });

        const effects = village.getVillageGameplayEffects(gameState);
        expect(effects).toEqual(expect.objectContaining({
            feedHappinessBonus: 7,
            maxEnergyBonus: 1,
            heartCareBonus: 2,
            heartReadinessEnergyBonus: 0,
            heartValues: { care: 2, readiness: 1 }
        }));
        expect(village.normalizeVillageState(gameState.get('world.village')).heartDecisions)
            .toHaveLength(3);
        expect(village.normalizeVillageState({
            heartDecisions: [{
                decisionId: 'storm_path',
                optionId: 'current_first',
                occurredAt: 8
            }]
        }).heartDecisions[0]).toEqual({
            decisionId: 'storm_path',
            optionId: 'current_first',
            occurredAt: 8,
            participantCreatureIds: [],
            participantNames: []
        });

        const readinessState = createGameState({
            village: {
                starterSuppliesClaimed: true,
                heartDecisions: [
                    { decisionId: 'storm_path', optionId: 'field_braces', occurredAt: 3 },
                    { decisionId: 'shared_harvest', optionId: 'trail_rations', occurredAt: 4 }
                ],
                buildings: [
                    complete('forager_hut', 'root_01'),
                    complete('workshop', 'root_02')
                ]
            }
        });
        expect(village.getVillageGameplayEffects(readinessState)).toEqual(
            expect.objectContaining({
                feedHappinessBonus: 5,
                maxEnergyBonus: 2,
                heartCareBonus: 0,
                heartReadinessEnergyBonus: 1,
                heartValues: { care: 0, readiness: 2 }
            })
        );
    });
});

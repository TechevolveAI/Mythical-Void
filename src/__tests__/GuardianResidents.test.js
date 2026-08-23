const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGuardianResidents() {
    const filePath = path.join(__dirname, '../systems/GuardianResidents.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { getGuardianOutcomeSnapshot } from './GuardianOutcomes.js';",
            'const getGuardianOutcomeSnapshot = GET_GUARDIAN_OUTCOME_SNAPSHOT;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                GUARDIAN_ROUTINE_RECOVERY_MS,
                GUARDIAN_SYNERGY_ASSISTS,
                GUARDIAN_RESIDENT_DEFINITIONS,
                GUARDIAN_SOCIAL_EXCHANGES,
                formatGuardianRoutineRecovery,
                normalizeGuardianResidentState,
                getGuardianResidentsSnapshot,
                getActiveGuardianTeamSupport,
                createGuardianExpeditionDebrief,
                recordGuardianExpedition,
                recordGuardianActivity,
                recordGuardianRescue,
                assistGuardianRoutine,
                interactWithGuardianResident
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        GET_GUARDIAN_OUTCOME_SNAPSHOT: gameState => {
            const legacyIds = gameState.get(
                'world.guardianResidents.rescuedIds'
            ) || [];
            const elderResolved = legacyIds.includes('elder_treant') ||
                gameState.get('levels.mythicalForest.completed') === true;
            return {
                sanctuaryPresences: elderResolved
                    ? [{ guardianId: 'elder_treant' }]
                    : []
            };
        },
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
    levels = {},
    guardianResidents = {},
    creatureName = 'Kira'
} = {}) {
    const state = {
        levels,
        world: { guardianResidents },
        creature: { name: creatureName }
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
                current[key] ||= {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('GuardianResidents', () => {
    const {
        GUARDIAN_ROUTINE_RECOVERY_MS,
        GUARDIAN_SYNERGY_ASSISTS,
        GUARDIAN_RESIDENT_DEFINITIONS,
        GUARDIAN_SOCIAL_EXCHANGES,
        formatGuardianRoutineRecovery,
        normalizeGuardianResidentState,
        getGuardianResidentsSnapshot,
        getActiveGuardianTeamSupport,
        createGuardianExpeditionDebrief,
        recordGuardianExpedition,
        recordGuardianActivity,
        recordGuardianRescue,
        assistGuardianRoutine,
        interactWithGuardianResident
    } = loadGuardianResidents();

    test('uses a short, readable recovery cadence for repeatable care', () => {
        expect(GUARDIAN_ROUTINE_RECOVERY_MS).toBe(77000);
        expect(formatGuardianRoutineRecovery(GUARDIAN_ROUTINE_RECOVERY_MS)).toBe('1:17');
        expect(formatGuardianRoutineRecovery(23000)).toBe('23s');
        expect(formatGuardianRoutineRecovery(0)).toBe('READY');
    });

    test('retains authored Guardian relationships for regional ally compatibility', () => {
        expect(GUARDIAN_RESIDENT_DEFINITIONS).toHaveLength(6);
        expect(new Set(
            GUARDIAN_RESIDENT_DEFINITIONS.map(entry => entry.levelId)
        ).size).toBe(6);
        expect(new Set(
            GUARDIAN_RESIDENT_DEFINITIONS.map(entry => entry.kind)
        ).size).toBe(6);
        GUARDIAN_RESIDENT_DEFINITIONS.forEach(guardian => {
            expect(guardian.dialogue.length).toBeGreaterThanOrEqual(3);
            expect(guardian.rescueMemory.length).toBeGreaterThan(30);
            expect(guardian.futureAbility.length).toBeGreaterThan(3);
            expect(guardian.routineCue.length).toBeGreaterThan(5);
            expect(guardian.ambientLines).toHaveLength(3);
            guardian.ambientLines.forEach(line => {
                expect(line.length).toBeGreaterThan(15);
                expect(line.length).toBeLessThan(60);
            });
            expect(guardian.routineCare.action.length).toBeGreaterThan(6);
            expect(guardian.routineCare.prompt.length).toBeGreaterThan(30);
            expect(guardian.routineCare.worldFeedback.length).toBeGreaterThan(30);
            expect(guardian.routineCare.steps).toHaveLength(3);
            guardian.routineCare.steps.forEach(step => {
                expect(step.action.length).toBeGreaterThan(8);
                expect(step.feedback.length).toBeGreaterThan(25);
            });
            expect(guardian.routineCare.responses).toHaveLength(2);
            expect(guardian.task.objective.length).toBeGreaterThan(20);
            expect(guardian.teamAbility.summary.length).toBeGreaterThan(20);
            expect(guardian.synergy.name.length).toBeGreaterThan(5);
            expect(guardian.synergy.memory.length).toBeGreaterThan(40);
            expect(guardian.synergy.summary.length).toBeGreaterThan(30);
            expect(Object.keys(guardian.synergy.modifiers)).toHaveLength(1);
        });
        const stepActions = GUARDIAN_RESIDENT_DEFINITIONS.flatMap(
            guardian => guardian.routineCare.steps.map(step => step.action)
        );
        expect(new Set(stepActions).size).toBe(stepActions.length);
        const ambientLines = GUARDIAN_RESIDENT_DEFINITIONS.flatMap(
            guardian => guardian.ambientLines
        );
        expect(new Set(ambientLines).size).toBe(ambientLines.length);
    });

    test('keeps authored social relationships for legacy Guardian ally saves', () => {
        const guardianIds = new Set(
            GUARDIAN_RESIDENT_DEFINITIONS.map(guardian => guardian.id)
        );
        const socialGuardianIds = new Set();
        const socialLines = [];

        expect(GUARDIAN_SOCIAL_EXCHANGES).toHaveLength(4);
        GUARDIAN_SOCIAL_EXCHANGES.forEach(exchange => {
            expect(exchange.guardianIds).toHaveLength(2);
            expect(exchange.variants).toHaveLength(3);
            exchange.guardianIds.forEach(id => {
                expect(guardianIds.has(id)).toBe(true);
                socialGuardianIds.add(id);
            });
            exchange.variants.forEach(variant => {
                exchange.guardianIds.forEach(id => {
                    expect(variant[id].length).toBeGreaterThan(25);
                    expect(variant[id].length).toBeLessThan(100);
                    socialLines.push(variant[id]);
                });
            });
        });
        expect(socialGuardianIds).toEqual(guardianIds);
        expect(new Set(socialLines).size).toBe(socialLines.length);
    });

    test('backfills only the Elder Treant Heart presence from completed levels', () => {
        const gameState = createGameState({
            levels: {
                mythicalForest: { completed: true },
                cosmicReef: { completed: true },
                voidPeaks: { completed: false }
            }
        });
        const snapshot = getGuardianResidentsSnapshot(gameState);

        expect(snapshot.state.rescuedIds).toEqual(['elder_treant']);
        expect(snapshot.rescuedResidents.map(entry => entry.name)).toEqual([
            'Elder Treant'
        ]);
    });

    test('records a rescue once at shared level completion and remains idempotent', () => {
        const gameState = createGameState();
        const first = recordGuardianRescue(gameState, 'auroraDepths', {
            rescuedAt: '2026-08-06T12:00:00.000Z'
        });
        const duplicate = recordGuardianRescue(gameState, 'auroraDepths', {
            rescuedAt: '2026-08-06T12:05:00.000Z'
        });

        expect(first.changed).toBe(true);
        expect(first.guardian.id).toBe('shadow_phoenix');
        expect(duplicate.changed).toBe(false);
        expect(gameState.state.world.guardianResidents.rescueHistory).toHaveLength(1);
        expect(gameState.emit).toHaveBeenCalledTimes(1);
        expect(gameState.save).toHaveBeenCalledTimes(2);
    });

    test('reveals rescue memory first, then offers a cooperative task', () => {
        const gameState = createGameState({
            levels: { crystalCaves: { completed: true } },
            guardianResidents: { rescuedIds: ['crystal_golem'] }
        });
        const first = interactWithGuardianResident(gameState, 'crystal_golem', {
            occurredAt: '2026-08-06T12:10:00.000Z'
        });
        const second = interactWithGuardianResident(gameState, 'crystal_golem', {
            occurredAt: '2026-08-06T12:11:00.000Z'
        });

        expect(first.reason).toBe('guardian_first_meeting');
        expect(first.message).toContain('false pulse');
        expect(second.reason).toBe('guardian_task_accepted');
        expect(second.message).toContain('Current');
        expect(second.resident.interactionCount).toBe(2);
        expect(gameState.state.world.guardianResidents.metIds).toEqual([
            'crystal_golem'
        ]);
    });

    test('requires post-acceptance evidence, unlocks an ability, and selects one ally', () => {
        const gameState = createGameState({
            levels: {
                mythicalForest: { completed: true },
                cosmicReef: { completed: true }
            }
        });
        interactWithGuardianResident(gameState, 'elder_treant');
        const accepted = interactWithGuardianResident(gameState, 'elder_treant');
        expect(accepted.reason).toBe('guardian_task_accepted');
        expect(accepted.resident.taskProgress.progress).toBe(0);

        recordGuardianActivity(gameState, 'gardenVisits');
        const completed = interactWithGuardianResident(gameState, 'elder_treant');
        expect(completed.reason).toBe('guardian_task_completed');
        expect(completed.resident.teamAbilityUnlocked).toBe(true);
        expect(completed.resident.activeTeam).toBe(true);
        expect(getActiveGuardianTeamSupport(gameState)).toMatchObject({
            guardianId: 'elder_treant',
            kind: 'treant',
            artwork: '/game/guardians/elder-treant.webp',
            textureKey: 'guardian-resident-elder-treant',
            color: 0x3F7D44,
            accent: 0xB7E36D,
            abilityId: 'root_bridge',
            activationLine: expect.stringContaining('roots'),
            guardCharges: 1
        });

        gameState.state.world.guardianResidents = normalizeGuardianResidentState({
            ...gameState.state.world.guardianResidents,
            rescuedIds: ['elder_treant', 'nyxvoral'],
            metIds: ['elder_treant', 'nyxvoral'],
            acceptedTaskIds: ['elder_treant', 'nyxvoral'],
            completedTaskIds: ['elder_treant', 'nyxvoral'],
            activeTeamGuardianId: 'elder_treant'
        });
        const selected = interactWithGuardianResident(gameState, 'nyxvoral');
        expect(selected.reason).toBe('guardian_team_selected');
        expect(getActiveGuardianTeamSupport(gameState)).toMatchObject({
            guardianId: 'nyxvoral',
            abilityId: 'current_passage',
            speedMultiplier: 1.08
        });
    });

    test('records bounded campfire and target evidence for guardian tasks', () => {
        const gameState = createGameState({
            levels: { voidPeaks: { completed: true } }
        });
        gameState.state.world.guardianResidents = normalizeGuardianResidentState({
            rescuedIds: ['cosmic_titan'],
            metIds: ['cosmic_titan'],
            acceptedTaskIds: ['cosmic_titan']
        });
        const result = recordGuardianActivity(gameState, 'targetHits', {
            amount: 3,
            occurredAt: '2026-08-06T12:20:00.000Z'
        });

        expect(result.current).toBe(3);
        expect(result.snapshot.state.activityEvidence.targetHits).toBe(3);
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(recordGuardianActivity(gameState, 'unknown')).toBe(null);
    });

    test('persists one active ally expedition and consumes its personalized debrief once', () => {
        const gameState = createGameState({
            levels: { mythicalForest: { completed: true } },
            guardianResidents: {
                rescuedIds: ['elder_treant'],
                metIds: ['elder_treant'],
                interactions: { elder_treant: 3 },
                acceptedTaskIds: ['elder_treant'],
                completedTaskIds: ['elder_treant'],
                activeTeamGuardianId: 'elder_treant'
            }
        });
        const completedAt = '2026-08-10T20:23:00.000Z';
        const recorded = recordGuardianExpedition(gameState, {
            levelId: 'crystalCaves',
            interventionCount: 1,
            noDamage: false,
            completedAt
        });

        expect(recorded).toMatchObject({
            changed: true,
            reason: 'guardian_expedition_recorded',
            entry: {
                guardianId: 'elder_treant',
                levelId: 'crystalCaves',
                interventionCount: 1,
                debriefedAt: null
            }
        });
        expect(recorded.resident).toMatchObject({
            expeditionCount: 1,
            expeditionDebriefReady: true
        });

        const debrief = interactWithGuardianResident(
            gameState,
            'elder_treant',
            { occurredAt: '2026-08-10T20:24:00.000Z' }
        );
        expect(debrief.reason).toBe('guardian_expedition_debrief');
        expect(debrief.message).toContain('Kira');
        expect(debrief.message).toContain('Crystal Caves');
        expect(debrief.message).toContain('roots caught the path');
        expect(debrief.state.pendingExpeditionDebrief).toBe(null);
        expect(debrief.state.expeditionHistory[0].debriefedAt).toBe(
            '2026-08-10T20:24:00.000Z'
        );

        const returnVisit = interactWithGuardianResident(
            gameState,
            'elder_treant',
            { occurredAt: '2026-08-10T20:25:00.000Z' }
        );
        expect(returnVisit.reason).toBe('guardian_return_visit');
    });

    test('turns completed guardian trust into ongoing Sanctuary stewardship', () => {
        const gameState = createGameState({
            levels: { mythicalForest: { completed: true } },
            guardianResidents: {
                rescuedIds: ['elder_treant'],
                metIds: ['elder_treant'],
                acceptedTaskIds: ['elder_treant'],
                completedTaskIds: ['elder_treant'],
                activeTeamGuardianId: 'elder_treant'
            }
        });

        const first = assistGuardianRoutine(gameState, 'elder_treant', {
            occurredAt: '2026-08-06T14:00:00.000Z'
        });
        const second = assistGuardianRoutine(gameState, 'elder_treant', {
            occurredAt: '2026-08-06T14:02:00.000Z'
        });

        expect(first.reason).toBe('guardian_routine_assisted');
        expect(first.message).not.toBe(second.message);
        expect(second.resident.routineAssistCount).toBe(2);
        expect(second.snapshot.supportedResidentCount).toBe(1);
        expect(second.snapshot.routineAssistCount).toBe(2);
        expect(gameState.state.world.guardianResidents.routineHistory).toEqual([
            { id: 'elder_treant', assistedAt: '2026-08-06T14:00:00.000Z' },
            { id: 'elder_treant', assistedAt: '2026-08-06T14:02:00.000Z' }
        ]);
    });

    test('makes care available after meeting, before expedition ability unlock', () => {
        const gameState = createGameState({
            levels: { cosmicReef: { completed: true } },
            guardianResidents: { rescuedIds: ['nyxvoral'] }
        });
        interactWithGuardianResident(gameState, 'nyxvoral', {
            occurredAt: '2026-08-06T15:00:00.000Z'
        });
        const result = assistGuardianRoutine(gameState, 'nyxvoral', {
            occurredAt: '2026-08-06T15:00:10.000Z'
        });

        expect(result.changed).toBe(true);
        expect(result.reason).toBe('guardian_routine_assisted');
        expect(result.resident.teamAbilityUnlocked).toBe(false);
        expect(result.resident.routineStatus).toBe('recovering');
        expect(result.resident.routineWaitMs).toBe(GUARDIAN_ROUTINE_RECOVERY_MS);
    });

    test('requires a first guardian meeting before routine assistance', () => {
        const gameState = createGameState({
            levels: { cosmicReef: { completed: true } },
            guardianResidents: { rescuedIds: ['nyxvoral'] }
        });
        const result = assistGuardianRoutine(gameState, 'nyxvoral');

        expect(result.changed).toBe(false);
        expect(result.reason).toBe('guardian_trust_required');
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('blocks repeated menu taps until the guardian routine recovers', () => {
        const gameState = createGameState({
            levels: { mythicalForest: { completed: true } },
            guardianResidents: {
                rescuedIds: ['elder_treant'],
                metIds: ['elder_treant']
            }
        });
        assistGuardianRoutine(gameState, 'elder_treant', {
            occurredAt: '2026-08-06T16:00:00.000Z'
        });
        const blocked = assistGuardianRoutine(gameState, 'elder_treant', {
            occurredAt: '2026-08-06T16:00:23.000Z'
        });

        expect(blocked.changed).toBe(false);
        expect(blocked.reason).toBe('guardian_routine_recovering');
        expect(blocked.message).toContain('54s');
        expect(blocked.resident.routineAssistCount).toBe(1);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('three acts of care unlock an authored memory and stronger expedition synergy', () => {
        const gameState = createGameState({
            levels: { mythicalForest: { completed: true } },
            guardianResidents: {
                rescuedIds: ['elder_treant'],
                metIds: ['elder_treant'],
                acceptedTaskIds: ['elder_treant'],
                completedTaskIds: ['elder_treant'],
                activeTeamGuardianId: 'elder_treant'
            }
        });

        const results = Array.from(
            { length: GUARDIAN_SYNERGY_ASSISTS },
            (_, index) => assistGuardianRoutine(gameState, 'elder_treant', {
                occurredAt: new Date(Date.UTC(2026, 7, 6, 17, index * 2)).toISOString()
            })
        );
        const milestone = results.at(-1);

        expect(milestone.reason).toBe('guardian_synergy_unlocked');
        expect(milestone.message).toContain('danger passed');
        expect(milestone.resident).toMatchObject({
            synergyUnlocked: true,
            trustProgress: 3,
            trustTarget: 3
        });
        expect(milestone.snapshot.synergyCount).toBe(1);
        expect(getActiveGuardianTeamSupport(gameState)).toMatchObject({
            synergyUnlocked: true,
            synergyName: 'Rootbound Trust',
            guardCharges: 2
        });
        expect(gameState.emit).toHaveBeenLastCalledWith(
            'guardianResidentChanged',
            expect.objectContaining({ type: 'guardian_synergy_unlocked' })
        );
    });

    test('does not record care evidence before the matching guardian task is active', () => {
        const gameState = createGameState({
            levels: { mythicalForest: { completed: true } }
        });
        const result = recordGuardianActivity(gameState, 'gardenVisits');

        expect(result.changed).toBe(false);
        expect(result.reason).toBe('guardian_task_inactive');
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('prioritizes ready guardian work for the existing mission log', () => {
        const gameState = createGameState({
            levels: {
                mythicalForest: { completed: true },
                voidPeaks: { completed: true }
            }
        });
        gameState.state.world.guardianResidents = normalizeGuardianResidentState({
            rescuedIds: ['elder_treant', 'cosmic_titan'],
            metIds: ['elder_treant', 'cosmic_titan'],
            acceptedTaskIds: ['elder_treant', 'cosmic_titan'],
            taskBaselines: { elder_treant: 0, cosmic_titan: 0 },
            activityEvidence: { gardenVisits: 0, targetHits: 3 }
        });

        const snapshot = getGuardianResidentsSnapshot(gameState);
        expect(snapshot.taskFocusResident.id).toBe('cosmic_titan');
        expect(snapshot.taskFocusResident.taskStatus).toBe('ready');
    });

    test('normalizes unknown state into a bounded portable save contract', () => {
        const state = normalizeGuardianResidentState({
            rescuedIds: ['unknown', 'cosmic_titan', 'cosmic_titan'],
            metIds: ['void_empress', 'cosmic_titan'],
            interactions: { cosmic_titan: 100000, unknown: 2 },
            acceptedTaskIds: ['cosmic_titan', 'unknown'],
            completedTaskIds: ['unknown'],
            taskBaselines: { cosmic_titan: 100000 },
            activityEvidence: {
                gardenVisits: 23,
                campfireRests: -2,
                targetHits: 100000
            },
            routineAssists: { cosmic_titan: 100000, unknown: 4 },
            routineHistory: [
                { id: 'unknown', assistedAt: 'now' },
                { id: 'cosmic_titan', assistedAt: '2026-08-06T12:00:00.000Z' }
            ],
            activeTeamGuardianId: 'cosmic_titan',
            lastInteractionId: 'unknown',
            lastInteractionAt: '2026-08-06T12:00:00.000Z',
            prompt: 'must not persist dialogue or player data'
        });

        expect(state.rescuedIds).toEqual(['cosmic_titan']);
        expect(state.metIds).toEqual(['cosmic_titan']);
        expect(state.interactions.cosmic_titan).toBe(999);
        expect(state.taskBaselines.cosmic_titan).toBe(9999);
        expect(state.activityEvidence).toEqual({
            gardenVisits: 23,
            campfireRests: 0,
            targetHits: 9999
        });
        expect(state.routineAssists).toEqual({ cosmic_titan: 999 });
        expect(state.routineHistory).toEqual([
            { id: 'cosmic_titan', assistedAt: '2026-08-06T12:00:00.000Z' }
        ]);
        expect(state.activeTeamGuardianId).toBe(null);
        expect(state.lastInteractionId).toBe(null);
        expect(JSON.stringify(state)).not.toContain('prompt');
        expect(JSON.stringify(state)).not.toContain('player');
    });
});

/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

// Execute the real pure dependencies without importing unrelated scene/provider code.
function loadHelpers(fileName, exportedNames, bindings = {}, selectedNames = null) {
    const filename = path.join(__dirname, '../systems', fileName);
    const source = fs.readFileSync(filename, 'utf8');
    const declarations = parse(source, { sourceType: 'module' }).program.body
        .map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node)
        .filter(node => node && ['FunctionDeclaration', 'VariableDeclaration'].includes(node.type))
        .filter(node => !selectedNames || (node.type === 'FunctionDeclaration'
            ? selectedNames.includes(node.id.name)
            : node.declarations.every(declaration => selectedNames.includes(declaration.id.name))));
    return vm.runInNewContext(
        declarations.map(node => source.slice(node.start, node.end)).join('\n') +
            `\n;({ ${exportedNames.join(', ')} });`,
        bindings,
        { filename }
    );
}

const reconstruction = loadHelpers('ShipReconstruction.js', [
    'SHIP_RECONSTRUCTION_STEPS', 'getShipReconstructionSnapshot'
]);
const legacy = loadHelpers('CampaignLegacy.js', ['CAMPAIGN_INTENTS'], {}, ['CAMPAIGN_INTENTS']);
const guide = loadHelpers('CampaignJourneyGuide.js', [
    'CAMPAIGN_ROUTE', 'getCampaignJourneyStep', 'getCampaignPrerequisiteState',
    'getCampaignRoute', 'getCampaignFinaleRecovery'
], { ...reconstruction, ...legacy });

function createState({ completed = [], unlocked = [], checkpoint = null, values: extraValues = {} } = {}) {
    const values = {
        'story.projectBeacon.expeditionCheckpoint': checkpoint
    };
    const route = [
        ['mythicalForest', 'mythical_forest'],
        ['crystalCaves', 'crystal_caves'],
        ['cosmicReef', 'stellar_reef'],
        ['voidPeaks', 'void_peaks'],
        ['auroraDepths', 'aurora_depths'],
        ['finalVoid', 'final_void']
    ];
    route.forEach(([levelId, gateId]) => {
        values[`levels.${levelId}.completed`] = completed.includes(levelId);
        values[`hubWorld.gates.${gateId}`] = {
            unlocked: unlocked.includes(gateId)
        };
    });
    Object.assign(values, extraValues);
    return { values, get: jest.fn(key => values[key]), set: jest.fn(), save: jest.fn(), emit: jest.fn() };
}

describe('campaign journey guide', () => {
    const {
        CAMPAIGN_ROUTE,
        getCampaignJourneyStep,
        getCampaignPrerequisiteState,
        getCampaignRoute
    } = guide;

    test('defines every playable route in the intended campaign order', () => {
        expect(Array.from(CAMPAIGN_ROUTE, route => route.gateId)).toEqual([
            'mythical_forest',
            'crystal_caves',
            'stellar_reef',
            'void_peaks',
            'aurora_depths',
            'final_void'
        ]);
    });

    test('advances to the first incomplete unlocked expedition', () => {
        const state = createState({
            completed: ['mythicalForest', 'crystalCaves'],
            unlocked: ['mythical_forest', 'crystal_caves', 'stellar_reef']
        });
        expect(getCampaignJourneyStep(state)).toEqual(expect.objectContaining({
            gateId: 'stellar_reef',
            status: 'ready',
            title: 'Next mission: Stellar Reef'
        }));
    });

    test('resolves canonical campaign identity independently of completion order', () => {
        expect(getCampaignRoute('auroraDepths')).toEqual(expect.objectContaining({
            gateId: 'aurora_depths',
            completionNumber: 5,
            debriefId: 'beacon_debrief_5'
        }));
    });

    test('reports every missing earlier expedition for a discovered later route', () => {
        const state = createState({
            completed: ['mythicalForest', 'auroraDepths'],
            unlocked: ['mythical_forest', 'aurora_depths']
        });
        const prerequisites = getCampaignPrerequisiteState(
            state,
            'aurora_depths'
        );

        expect(prerequisites.prerequisitesMet).toBe(false);
        expect(Array.from(
            prerequisites.missingPrerequisites,
            route => route.levelStateId
        )).toEqual(['crystalCaves', 'cosmicReef', 'voidPeaks']);
        expect(getCampaignJourneyStep(state)).toEqual(expect.objectContaining({
            gateId: 'crystal_caves',
            status: 'locked'
        }));
    });

    test('prioritizes a saved expedition checkpoint', () => {
        const state = createState({
            completed: ['mythicalForest'],
            unlocked: ['mythical_forest', 'crystal_caves'],
            checkpoint: {
                sceneKey: 'CrystalCavesLevel',
                label: 'Living Chamber'
            }
        });
        expect(getCampaignJourneyStep(state)).toEqual(expect.objectContaining({
            gateId: 'crystal_caves',
            status: 'resume',
            action: 'Rejoin at Living Chamber.'
        }));
    });

    test('ignores a stale checkpoint that skips canonical prerequisites', () => {
        const state = createState({
            completed: ['mythicalForest'],
            unlocked: ['mythical_forest', 'aurora_depths'],
            checkpoint: {
                sceneKey: 'AuroraDepthsLevel',
                label: 'Aurora Prism'
            }
        });

        expect(getCampaignJourneyStep(state)).toEqual(expect.objectContaining({
            gateId: 'crystal_caves',
            status: 'locked'
        }));
    });

    test('six route completions alone do not report a finished campaign', () => {
        const state = createState({
            completed: [
                'mythicalForest',
                'crystalCaves',
                'cosmicReef',
                'voidPeaks',
                'auroraDepths',
                'finalVoid'
            ]
        });
        expect(getCampaignJourneyStep(state)).toEqual(expect.objectContaining({
            gateId: null,
            status: 'repair'
        }));
    });
});

describe('returning-player finale recovery', () => {
    const { getCampaignJourneyStep, getCampaignFinaleRecovery, CAMPAIGN_ROUTE } = guide;
    const { SHIP_RECONSTRUCTION_STEPS } = reconstruction;
    const installedSteps = SHIP_RECONSTRUCTION_STEPS.map(step => step.id);
    const firstFiveRepairs = { completedStepIds: installedSteps.slice(0, 5) };
    const completedAt = '2026-09-17T12:00:00.000Z';

    function returningState(values = {}, checkpoint = null) {
        return createState({
            completed: CAMPAIGN_ROUTE.map(route => route.levelStateId),
            unlocked: CAMPAIGN_ROUTE.map(route => route.gateId),
            checkpoint,
            values: {
                'story.projectBeacon.fieldKit.recovered': true,
                'story.projectBeacon.shipReconstruction': { completedStepIds: installedSteps },
                'hubWorld.shipParts.collected': SHIP_RECONSTRUCTION_STEPS.map(step => step.partId),
                'hubWorld.shipParts.finalBossUnlocked': true,
                'hubWorld.shipCompletionCutsceneShown': true,
                ...values
            }
        });
    }

    test.each([undefined, false, 'true'])('does not infer final victory from parts or ending records (%s)', finalVictory => {
        const state = returningState({
            'levels.finalVoid.completed': finalVictory,
            'story.projectBeacon.finale.priority': 'prepare_homecoming',
            'story.projectBeacon.finale.epilogueSeen': true
        });
        expect(getCampaignFinaleRecovery(state)).toBeNull();
        expect(getCampaignJourneyStep(state)).toMatchObject({ status: 'ready', levelStateId: 'finalVoid' });
    });

    test('recovered Command Module, uplink, and unlock flags do not substitute for installation', () => {
        const state = returningState({
            'story.projectBeacon.shipReconstruction': firstFiveRepairs,
            'story.projectBeacon.uplinkRestored': true,
            'story.projectBeacon.shipCapabilities': { blackBoxProof: 'recovered' }
        });
        const recovery = getCampaignFinaleRecovery(state);
        expect(recovery).toMatchObject({
            status: 'repair', sceneKey: 'GameScene', label: 'Wanderer-77',
            gateId: null, levelStateId: null, repairStepId: 'black_box_recovery', priority: null,
            action: 'Complete the Command Module installation at Wanderer-77.'
        });
        expect(getCampaignJourneyStep(state)).toEqual(recovery);
    });

    test('a non-contiguous or timestamp-only repair ledger still needs its first missing system', () => {
        const state = returningState({
            'story.projectBeacon.shipReconstruction': {
                completedStepIds: ['black_box_recovery'], completedAt
            },
            'story.projectBeacon.finale.priority': 'prepare_first_contact'
        });
        expect(getCampaignFinaleRecovery(state)).toMatchObject({
            status: 'repair', repairStepId: 'living_power_lattice', priority: 'prepare_first_contact'
        });
    });

    test('uses production reconstruction normalization for history-only installations', () => {
        const state = returningState({
            'story.projectBeacon.shipReconstruction': {
                history: installedSteps.map(stepId => ({
                    stepId, operationId: `install:${stepId}`, occurredAt: completedAt
                }))
            },
            'story.projectBeacon.fieldKit.recovered': false,
            'hubWorld.shipParts.collected': []
        });
        expect(getCampaignFinaleRecovery(state)).toMatchObject({
            status: 'ending', endingPhase: 'choice', sceneKey: 'VictoryScene', priority: null
        });
    });

    test.each([undefined, null, 'unknown', 'earth', 'void'])(
        'requires a canonical priority instead of accepting an invalid finale priority (%s)', priority => {
            const state = returningState({
                'story.projectBeacon.finale.priority': priority,
                'story.projectBeacon.finale.epilogueSeen': true
            });
            expect(getCampaignFinaleRecovery(state)).toMatchObject({
                status: 'ending', endingPhase: 'choice', sceneKey: 'VictoryScene', priority: null
            });
            expect(getCampaignJourneyStep(state)).toEqual(getCampaignFinaleRecovery(state));
        }
    );

    test.each(legacy.CAMPAIGN_INTENTS)('%s is selected, not complete, until its epilogue is seen', priority => {
        [undefined, false, 'true'].forEach(epilogueSeen => {
            const state = returningState({
                'story.projectBeacon.finale.priority': priority,
                'story.projectBeacon.finale.epilogueSeen': epilogueSeen,
                'story.projectBeacon.finale.epilogueCompletedAt': completedAt
            });
            expect(getCampaignFinaleRecovery(state)).toMatchObject({
                status: 'ending', endingPhase: 'epilogue', priority, sceneKey: 'VictoryScene'
            });
            expect(getCampaignJourneyStep(state)).toEqual(getCampaignFinaleRecovery(state));
        });
        const completed = returningState({
            'story.projectBeacon.finale.priority': priority,
            'story.projectBeacon.finale.epilogueSeen': true
        });
        expect(getCampaignFinaleRecovery(completed)).toBeNull();
        expect(getCampaignJourneyStep(completed).status).toBe('complete');
    });

    test.each([
        ['earth', 'prepare_homecoming'], ['void', 'remain_and_defend']
    ])('honors the existing %s legacy mapping without restarting completed endings', (choice, priority) => {
        const legacyFields = {
            'story.projectBeacon.endingChoice': choice,
            'story.projectBeacon.endingEpilogueCompletedAt': completedAt
        };
        [undefined, false, 'true'].forEach(seen => {
            expect(getCampaignFinaleRecovery(returningState({
                ...legacyFields, 'story.projectBeacon.endingEpilogueSeen': seen
            }))).toMatchObject({ status: 'ending', endingPhase: 'epilogue', priority });
        });
        const completed = returningState({
            ...legacyFields,
            'story.projectBeacon.endingEpilogueSeen': true,
            'story.projectBeacon.shipReconstruction': undefined
        });
        expect(getCampaignFinaleRecovery(completed)).toBeNull();
        expect(getCampaignJourneyStep(completed).status).toBe('complete');
    });

    test('canonical priority wins over legacy choice and legacy epilogue truth remains valid', () => {
        const values = {
            'story.projectBeacon.finale.priority': 'prepare_first_contact',
            'story.projectBeacon.endingChoice': 'earth'
        };
        expect(getCampaignFinaleRecovery(returningState(values))).toMatchObject({
            status: 'ending', endingPhase: 'epilogue', priority: 'prepare_first_contact'
        });
        expect(getCampaignFinaleRecovery(returningState({
            ...values, 'story.projectBeacon.endingEpilogueSeen': true
        }))).toBeNull();
    });

    test('unknown legacy choices and lone epilogue flags cannot suppress recovery', () => {
        expect(getCampaignFinaleRecovery(returningState({
            'story.projectBeacon.endingChoice': 'unknown',
            'story.projectBeacon.endingEpilogueSeen': true
        }))).toMatchObject({ status: 'ending', endingPhase: 'choice', priority: null });
    });

    test.each([
        ['repair', { 'story.projectBeacon.shipReconstruction': firstFiveRepairs }],
        ['ending', {}],
        ['ending', { 'story.projectBeacon.finale.priority': 'remain_and_defend' }],
        ['complete', {
            'story.projectBeacon.finale.priority': 'remain_and_defend',
            'story.projectBeacon.finale.epilogueSeen': true
        }]
    ])('stale final checkpoints cannot replace post-boss %s guidance or mutate the save', (status, values) => {
        const state = returningState(values, { sceneKey: 'FinalVoidLevel', label: 'Trust Marker' });
        const before = JSON.stringify(state.values);
        getCampaignFinaleRecovery(state);
        expect(getCampaignJourneyStep(state)).toMatchObject({ status, gateId: null, levelStateId: null });
        expect(JSON.stringify(state.values)).toBe(before);
        expect(state.set).not.toHaveBeenCalled();
        expect(state.save).not.toHaveBeenCalled();
        expect(state.emit).not.toHaveBeenCalled();
    });
});

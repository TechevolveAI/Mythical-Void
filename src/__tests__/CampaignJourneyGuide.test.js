const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGuide() {
    const filePath = path.join(__dirname, '../systems/CampaignJourneyGuide.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            /export \{[\s\S]*?\};/,
            'module.exports = { CAMPAIGN_ROUTE, getCampaignJourneyStep, getCampaignPrerequisiteState, getCampaignRoute };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Object,
        Array,
        String
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createState({ completed = [], unlocked = [], checkpoint = null } = {}) {
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
    return { get: jest.fn(key => values[key]) };
}

describe('campaign journey guide', () => {
    const {
        CAMPAIGN_ROUTE,
        getCampaignJourneyStep,
        getCampaignPrerequisiteState,
        getCampaignRoute
    } = loadGuide();

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

    test('reports campaign restoration only after all six routes', () => {
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
            status: 'complete'
        }));
    });
});

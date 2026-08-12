const fs = require('fs');
const path = require('path');
const vm = require('vm');
const projectBeacon = require('../config/project-beacon.json');

function loadStoryHelpers() {
    const filePath = path.join(__dirname, '../systems/ProjectBeaconStory.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import projectBeacon from '../config/project-beacon.json';",
            'const projectBeacon = PROJECT_BEACON;'
        )
        .replace(
            "import { getCurrentEcologySnapshot } from './CurrentEcology.js';",
            'const getCurrentEcologySnapshot = () => ({ summary: {' +
                "status: 'UNMAPPED', vitality: 0, observedSignals: 0, restoredRegions: 0, totalRegions: 6" +
            '} });'
        )
        .replace(
            "import {\n    formatFendCommunityObjective,\n    getFendCommunitySnapshot\n} from './FendCommunity.js';",
            'const formatFendCommunityObjective = () => "";\n' +
            'const getFendCommunitySnapshot = () => ({ complete: false });'
        )
        .replace(
            "import {\n    formatFendResidentObjective,\n    getFendResidentsSnapshot\n} from './FendResidents.js';",
            'const formatFendResidentObjective = () => "";\n' +
            'const getFendResidentsSnapshot = () => ({ complete: false });'
        )
        .replace(
            "import { getGuardianResidentsSnapshot } from './GuardianResidents.js';",
            'const getGuardianResidentsSnapshot = () => ({ rescuedCount: 0, totalResidents: 6 });'
        )
        .replace(
            "import {\n    formatFendCultureObjective,\n    getFendCultureSnapshot\n} from './FendCulture.js';",
            'const formatFendCultureObjective = () => "";\n' +
            'const getFendCultureSnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatCompanionConsentObjective,\n    getCompanionConsentSnapshot\n} from './CompanionConsent.js';",
            'const formatCompanionConsentObjective = () => "";\n' +
            'const getCompanionConsentSnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatCompanionEarthMemoryObjective,\n    getCompanionEarthMemorySnapshot\n} from './CompanionEarthMemory.js';",
            'const formatCompanionEarthMemoryObjective = () => "";\n' +
            'const getCompanionEarthMemorySnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatSenseiMemoryObjective,\n    getSenseiMemorySnapshot\n} from './SenseiMemory.js';",
            'const formatSenseiMemoryObjective = () => "";\n' +
            'const getSenseiMemorySnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatShipEvidenceObjective,\n    getShipEvidenceSnapshot\n} from './ShipEvidence.js';",
            'const formatShipEvidenceObjective = () => "";\n' +
            'const getShipEvidenceSnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatShipReconstructionObjective,\n    getShipReconstructionSnapshot\n} from './ShipReconstruction.js';",
            'const formatShipReconstructionObjective = () => "";\n' +
            'const getShipReconstructionSnapshot = () => ({ ready: false, complete: false });'
        )
        .replace(
            "import {\n    formatProtectedReturnObjective,\n    getProtectedReturnSnapshot\n} from './ProtectedReturnProtocol.js';",
            'const formatProtectedReturnObjective = () => "";\n' +
            'const getProtectedReturnSnapshot = () => ({ available: false, complete: false });'
        )
        .replace(
            "import {\n    formatCurrentVeilObjective,\n    getCurrentVeilSnapshot\n} from './CurrentVeilMission.js';",
            'const formatCurrentVeilObjective = () => "";\n' +
            'const getCurrentVeilSnapshot = () => ({ available: false, active: false, verificationReady: false, complete: false });'
        )
        .replace(
            "import {\n    formatRemainAndDefendObjective,\n    getRemainAndDefendSnapshot\n} from './RemainAndDefendCampaign.js';",
            'const formatRemainAndDefendObjective = () => "";\n' +
            'const getRemainAndDefendSnapshot = () => ({ unlocked: false, complete: false, councilReady: false, completedCount: 0, totalPhases: 8, phases: [] });'
        )
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = {
            getProjectBeaconDebrief,
            queueProjectBeaconDebrief,
            unlockProjectBeaconMilestone,
            getNextProjectBeaconDebrief,
            acknowledgeProjectBeaconDebrief
        };`;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        PROJECT_BEACON: projectBeacon,
        Date,
        Array
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState() {
    const state = {
        story: {
            projectBeacon: {
                pendingDebriefs: [],
                debriefsSeen: []
            }
        },
        hubWorld: {
            gates: {
                crystal_caves: { unlocked: false, unlockCost: 500 },
                stellar_reef: { unlocked: false, unlockCost: 500 },
                void_peaks: { unlocked: false, unlockCost: 1000 },
                aurora_depths: { unlocked: false, unlockCost: 750 }
            }
        }
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce((value, key) => value?.[key], state);
        },
        set(propertyPath, value) {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        },
        save: jest.fn()
    };
}

describe('Project Beacon campaign debrief state', () => {
    const {
        queueProjectBeaconDebrief,
        unlockProjectBeaconMilestone,
        getNextProjectBeaconDebrief,
        acknowledgeProjectBeaconDebrief
    } = loadStoryHelpers();

    test('queues revelations by canonical level ID rather than completion order', () => {
        const gameState = createGameState();

        const queued = queueProjectBeaconDebrief(gameState, {
            completionNumber: 1,
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating',
            completedAt: '2026-07-26T20:00:00.000Z'
        });
        const duplicate = queueProjectBeaconDebrief(gameState, {
            completionNumber: 1,
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating'
        });

        expect(queued).toEqual({
            id: 'beacon_debrief_4',
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating',
            completedAt: '2026-07-26T20:00:00.000Z'
        });
        expect(duplicate).toBeNull();
        expect(getNextProjectBeaconDebrief(gameState)).toEqual(expect.objectContaining({
            id: 'beacon_debrief_4',
            completionNumber: 4,
            levelId: 'voidPeaks',
            shipPartId: 'hull_plating'
        }));
    });

    test('acknowledges a debrief once and never queues it again', () => {
        const gameState = createGameState();
        queueProjectBeaconDebrief(gameState, {
            completionNumber: 2,
            levelId: 'cosmicReef',
            shipPartId: 'dimensional_drive'
        });

        expect(acknowledgeProjectBeaconDebrief(gameState, 'beacon_debrief_3')).toBe(true);
        expect(gameState.get('story.projectBeacon.pendingDebriefs')).toEqual([]);
        expect(gameState.get('story.projectBeacon.debriefsSeen')).toEqual([
            'beacon_debrief_3'
        ]);
        expect(gameState.save).toHaveBeenCalledTimes(1);

        expect(queueProjectBeaconDebrief(gameState, {
            completionNumber: 2,
            levelId: 'cosmicReef',
            shipPartId: 'dimensional_drive'
        })).toBeNull();
        expect(acknowledgeProjectBeaconDebrief(gameState, 'beacon_debrief_3')).toBe(false);
    });

    test('unlocks the next expedition at each approved campaign milestone', () => {
        const gameState = createGameState();

        const result = unlockProjectBeaconMilestone(
            gameState,
            'mythicalForest'
        );

        expect(result).toEqual({
            gateId: 'crystal_caves',
            label: 'Crystal Caves',
            newlyUnlocked: true
        });
        expect(gameState.get('hubWorld.gates.crystal_caves')).toEqual({
            unlocked: true,
            unlockCost: 500
        });
        expect(gameState.get('story.projectBeacon.lastRouteUnlocked')).toEqual(
            expect.objectContaining({
                gateId: 'crystal_caves',
                label: 'Crystal Caves',
                levelId: 'mythicalForest',
                completionNumber: 1
            })
        );
    });

    test('preserves an existing canonical unlock and ignores the final completion milestone', () => {
        const gameState = createGameState();
        gameState.set('hubWorld.gates.crystal_caves.unlocked', true);

        expect(unlockProjectBeaconMilestone(gameState, 'mythicalForest')).toEqual({
            gateId: 'crystal_caves',
            label: 'Crystal Caves',
            newlyUnlocked: false
        });
        expect(unlockProjectBeaconMilestone(gameState, 'auroraDepths')).toBeNull();
        expect(gameState.get('story.projectBeacon.lastRouteUnlocked')).toBeUndefined();
    });

    test('does not unlock a milestone when canonical prerequisites are missing', () => {
        const gameState = createGameState();
        gameState.getCampaignGateAccess = jest.fn(() => ({
            prerequisitesMet: false,
            nextRequiredRoute: {
                gateId: 'mythical_forest',
                levelStateId: 'mythicalForest',
                label: 'Mythical Forest'
            }
        }));

        expect(unlockProjectBeaconMilestone(gameState, 'crystalCaves')).toEqual({
            gateId: 'stellar_reef',
            label: 'Stellar Reef',
            newlyUnlocked: false,
            blocked: true,
            requiredRoute: expect.objectContaining({
                levelStateId: 'mythicalForest'
            })
        });
        expect(gameState.get('hubWorld.gates.stellar_reef.unlocked')).toBe(false);
    });

    test('ignores completion numbers beyond the approved pre-final arc', () => {
        const gameState = createGameState();

        expect(queueProjectBeaconDebrief(gameState, {
            completionNumber: 6,
            levelId: 'finalVoid',
            shipPartId: 'command_module'
        })).toBeNull();
        expect(getNextProjectBeaconDebrief(gameState)).toBeNull();
    });

    test('skips an invalid queued entry without hiding later valid debriefs', () => {
        const gameState = createGameState();
        gameState.set('story.projectBeacon.pendingDebriefs', [
            { id: 'unknown_debrief' },
            {
                id: 'beacon_debrief_3',
                levelId: 'cosmicReef',
                shipPartId: 'dimensional_drive'
            }
        ]);

        expect(getNextProjectBeaconDebrief(gameState)).toEqual(expect.objectContaining({
            id: 'beacon_debrief_3',
            completionNumber: 3
        }));
    });

    test('keeps the local preview route isolated from save state', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const hubSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );
        const previewBlock = gameSource.match(
            /if \(isLocalPreview && testDebrief >= 1[\s\S]*?\/\/ Handle page unload/
        )?.[0] || '';

        expect(previewBlock).toContain("game.scene.start('HubWorldScene', {");
        expect(previewBlock).toContain(
            "urlParams.get('previewSize') === 'mobile'"
        );
        expect(previewBlock).not.toContain('GameState.set');
        expect(hubSource).toContain('isPreview: true');
        expect(hubSource).toContain('if (!debrief.isPreview)');
        expect(hubSource).toContain('NEXT EXPEDITION:');
        expect(hubSource).toContain('SANCTUARY RETURN:');
        expect(hubSource).toContain('COMPANION RECORD');
        expect(hubSource).toContain('`INSTALL ${partName.toUpperCase()}`');
        expect(hubSource).toContain("this.scene.start('GameScene', {");
        expect(hubSource).toContain('shipReconstructionHandoff: true');
        expect(hubSource).toContain(
            'shipReconstructionNextGateLabel:'
        );
        expect(hubSource).toContain('focusProjectBeaconNextRoute(debrief)');
        expect(hubSource).toContain('NEW ROUTE OPEN // ${gate.data.name.toUpperCase()}');
    });
});

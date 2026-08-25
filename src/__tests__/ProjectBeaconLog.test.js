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
            'const getCurrentEcologySnapshot = GET_CURRENT_ECOLOGY_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatFendCommunityObjective,\n    getFendCommunitySnapshot\n} from './FendCommunity.js';",
            'const formatFendCommunityObjective = FORMAT_FEND_COMMUNITY_OBJECTIVE;\n' +
            'const getFendCommunitySnapshot = GET_FEND_COMMUNITY_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatFendResidentObjective,\n    getFendResidentsSnapshot\n} from './FendResidents.js';",
            'const formatFendResidentObjective = FORMAT_FEND_RESIDENT_OBJECTIVE;\n' +
            'const getFendResidentsSnapshot = GET_FEND_RESIDENTS_SNAPSHOT;'
        )
        .replace(
            "import { getGuardianResidentsSnapshot } from './GuardianResidents.js';",
            'const getGuardianResidentsSnapshot = GET_GUARDIAN_RESIDENTS_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatFendCultureObjective,\n    getFendCultureSnapshot\n} from './FendCulture.js';",
            'const formatFendCultureObjective = FORMAT_FEND_CULTURE_OBJECTIVE;\n' +
            'const getFendCultureSnapshot = GET_FEND_CULTURE_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatCompanionConsentObjective,\n    getCompanionConsentSnapshot\n} from './CompanionConsent.js';",
            'const formatCompanionConsentObjective = FORMAT_COMPANION_CONSENT_OBJECTIVE;\n' +
            'const getCompanionConsentSnapshot = GET_COMPANION_CONSENT_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatCompanionEarthMemoryObjective,\n    getCompanionEarthMemorySnapshot\n} from './CompanionEarthMemory.js';",
            'const formatCompanionEarthMemoryObjective = FORMAT_COMPANION_EARTH_MEMORY_OBJECTIVE;\n' +
            'const getCompanionEarthMemorySnapshot = GET_COMPANION_EARTH_MEMORY_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatSenseiMemoryObjective,\n    getSenseiMemorySnapshot\n} from './SenseiMemory.js';",
            'const formatSenseiMemoryObjective = FORMAT_SENSEI_MEMORY_OBJECTIVE;\n' +
            'const getSenseiMemorySnapshot = GET_SENSEI_MEMORY_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatShipEvidenceObjective,\n    getShipEvidenceSnapshot\n} from './ShipEvidence.js';",
            'const formatShipEvidenceObjective = FORMAT_SHIP_EVIDENCE_OBJECTIVE;\n' +
            'const getShipEvidenceSnapshot = GET_SHIP_EVIDENCE_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatShipReconstructionObjective,\n    getShipReconstructionSnapshot\n} from './ShipReconstruction.js';",
            'const formatShipReconstructionObjective = FORMAT_SHIP_RECONSTRUCTION_OBJECTIVE;\n' +
            'const getShipReconstructionSnapshot = GET_SHIP_RECONSTRUCTION_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatProtectedReturnObjective,\n    getProtectedReturnSnapshot\n} from './ProtectedReturnProtocol.js';",
            'const formatProtectedReturnObjective = FORMAT_PROTECTED_RETURN_OBJECTIVE;\n' +
            'const getProtectedReturnSnapshot = GET_PROTECTED_RETURN_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatCurrentVeilObjective,\n    getCurrentVeilSnapshot\n} from './CurrentVeilMission.js';",
            'const formatCurrentVeilObjective = FORMAT_CURRENT_VEIL_OBJECTIVE;\n' +
            'const getCurrentVeilSnapshot = GET_CURRENT_VEIL_SNAPSHOT;'
        )
        .replace(
            "import {\n    formatRemainAndDefendObjective,\n    getRemainAndDefendSnapshot\n} from './RemainAndDefendCampaign.js';",
            'const formatRemainAndDefendObjective = FORMAT_REMAIN_AND_DEFEND_OBJECTIVE;\n' +
            'const getRemainAndDefendSnapshot = GET_REMAIN_AND_DEFEND_SNAPSHOT;'
        )
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = { getProjectBeaconLog };
    `;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        PROJECT_BEACON: projectBeacon,
        GET_CURRENT_ECOLOGY_SNAPSHOT: gameState => {
            const restoredRegionIds = gameState?.get?.(
                'world.currentEcology.restoredRegionIds'
            ) || [];
            return {
                summary: {
                    awareness: 'unmapped',
                    awarenessLabel: 'UNMAPPED',
                    networkStatus: restoredRegionIds.length > 0
                        ? 'recovering'
                        : 'strained',
                    networkStatusLabel: restoredRegionIds.length > 0
                        ? 'RECOVERING'
                        : 'STRAINED',
                    vitality: restoredRegionIds.length > 0 ? 38 : 24,
                    observedSignals: 0,
                    totalSignals: 3,
                    restoredCount: restoredRegionIds.length,
                    totalRegions: 6,
                    restoredRegionIds
                }
            };
        },
        GET_FEND_COMMUNITY_SNAPSHOT: gameState => ({
            stage: gameState?.get?.('test.fendComplete') ? 4 : 0,
            totalStages: 4,
            state: {
                builtProjectIds: [],
                contributionHistory: []
            },
            nextProject: {
                id: 'trailhead_shelter',
                label: 'FIRST LIGHT SHELTER',
                ready: false
            },
            support: {
                maxHealthBonus: 0,
                maxEnergyBonus: 0,
                guardCharges: 0,
                commonsNetwork: false
            },
            complete: gameState?.get?.('test.fendComplete') === true
        }),
        FORMAT_FEND_COMMUNITY_OBJECTIVE: () => (
            'FIRST LIGHT SHELTER: 0/1 garden tends.'
        ),
        GET_FEND_RESIDENTS_SNAPSHOT: gameState => ({
            state: {
                metResidentIds: [],
                completedRequestIds: []
            },
            activeResident: null,
            nextResident: null,
            metCount: gameState?.get?.('test.fendComplete') ? 4 : 0,
            completedCount:
                gameState?.get?.('test.fendComplete') ? 4 : 0,
            totalResidents: 4,
            complete: gameState?.get?.('test.fendComplete') === true
        }),
        GET_GUARDIAN_RESIDENTS_SNAPSHOT: gameState => {
            const rescuedCount = Number(
                gameState?.get?.('test.guardianCount')
            ) || 0;
            return {
                state: { rescuedIds: [] },
                residents: [],
                rescuedResidents: [],
                rescuedCount,
                totalResidents: 6
            };
        },
        FORMAT_FEND_RESIDENT_OBJECTIVE: () => (
            'Complete the next Fend community project.'
        ),
        GET_FEND_CULTURE_SNAPSHOT: gameState => ({
            ready: false,
            complete:
                gameState?.get?.('test.fendComplete') === true,
            selectedPriority:
                gameState?.get?.('test.fendComplete')
                    ? { id: 'restoration', shortLabel: 'RESTORE FIRST' }
                    : null,
            state: {
                firstListening: {
                    status: 'locked',
                    selectedPriority: null
                }
            }
        }),
        FORMAT_FEND_CULTURE_OBJECTIVE: () => (
            'Complete the Living Commons and answer every resident request.'
        ),
        GET_COMPANION_CONSENT_SNAPSHOT: gameState => ({
            ready: false,
            complete:
                gameState?.get?.('test.fendComplete') === true,
            reviewedCount: 0,
            totalTopics: 3,
            record: {
                travelStatus: 'not_yet_asked',
                willingPassenger: null
            }
        }),
        FORMAT_COMPANION_CONSENT_OBJECTIVE: () => (
            'Review Earth boundaries at Wanderer-77: 0/3.'
        ),
        GET_COMPANION_EARTH_MEMORY_SNAPSHOT: gameState => {
            const status = gameState?.get?.('test.earthMemoryStatus');
            return {
                ready: status === 'ready',
                complete: status === 'shared',
                selectedMemory: status === 'shared'
                    ? {
                        id: 'ocean_after_storm',
                        title: 'THE OCEAN AFTER A STORM'
                    }
                    : null
            };
        },
        FORMAT_COMPANION_EARTH_MEMORY_OBJECTIVE: snapshot => (
            snapshot.complete
                ? 'Earth memory shared. No invitation or transmission was made.'
                : 'Return to Wanderer-77. Your companion has an Earth question.'
        ),
        GET_SENSEI_MEMORY_SNAPSHOT: gameState => {
            const ready = gameState?.get?.(
                'story.projectBeacon.senseiMemoryReady'
            ) === true;
            return {
                ready,
                complete: false,
                recalledCount: 0,
                totalMemories: 3,
                nextMemory: ready
                    ? { id: 'begin_with_your_footing', title: 'THE DOJO FLOOR' }
                    : null,
                state: {
                    recalledMemoryIds: [],
                    lesson: {
                        id: 'centering_stance',
                        status: 'locked',
                        practiceCount: 0
                    }
                },
                lesson: {
                    id: 'centering_stance',
                    status: 'locked',
                    practiceCount: 0,
                    unlocked: false
                }
            };
        },
        FORMAT_SENSEI_MEMORY_OBJECTIVE: () => (
            'Review THE DOJO FLOOR at Wanderer-77.'
        ),
        GET_SHIP_EVIDENCE_SNAPSHOT: () => ({
            ready: false,
            complete: false,
            reviewedCount: 0,
            totalSections: 3,
            nextSection: null
        }),
        FORMAT_SHIP_EVIDENCE_OBJECTIVE: () => (
            'Recover the field kit and complete the first expedition.'
        ),
        GET_SHIP_RECONSTRUCTION_SNAPSHOT: () => ({
            ready: false,
            complete: false,
            completedCount: 0,
            totalSteps: 6,
            readyStep: null
        }),
        FORMAT_SHIP_RECONSTRUCTION_OBJECTIVE: () => (
            'Recover the first Wanderer-77 system.'
        ),
        GET_PROTECTED_RETURN_SNAPSHOT: gameState => {
            const protocol = gameState?.get?.(
                'story.projectBeacon.protectedReturnProtocol'
            ) || {};
            const completedStepIds = Array.isArray(
                protocol.completedStepIds
            ) ? protocol.completedStepIds : [];
            const available = gameState?.get?.(
                'story.projectBeacon.shipArchive.complete'
            ) === true;
            return {
                available,
                ready: available && completedStepIds.length < 4,
                complete: completedStepIds.length === 4,
                completedCount: completedStepIds.length,
                totalSteps: 4,
                nextStep: completedStepIds.length < 4
                    ? { label: 'SURVIVAL PROOF' }
                    : null,
                state: { completedStepIds }
            };
        },
        FORMAT_PROTECTED_RETURN_OBJECTIVE: snapshot => (
            snapshot.complete
                ? 'Protected return packet sealed. No transmission sent.'
                : `Apply the next safeguard: ${snapshot.completedCount}/4.`
        ),
        GET_CURRENT_VEIL_SNAPSHOT: gameState => {
            const value = gameState?.get?.(
                'world.currentVeilMission'
            ) || {};
            const stabilizedAnchorIds = Array.isArray(
                value.stabilizedAnchorIds
            ) ? value.stabilizedAnchorIds : [];
            const protocolSteps = gameState?.get?.(
                'story.projectBeacon.protectedReturnProtocol.completedStepIds'
            ) || [];
            const prerequisitesMet =
                Array.isArray(protocolSteps) &&
                protocolSteps.length === 4;
            const status = value.status || 'not_started';
            return {
                prerequisitesMet,
                available:
                    prerequisitesMet && status === 'not_started',
                active: status === 'active',
                verificationReady:
                    status === 'verification_ready',
                complete: status === 'complete',
                stabilizedCount: stabilizedAnchorIds.length,
                totalAnchors: 3,
                nextAnchor: status === 'active'
                    ? { title: 'TRAILHEAD ROOT' }
                    : null,
                state: {
                    status,
                    stabilizedAnchorIds
                }
            };
        },
        FORMAT_CURRENT_VEIL_OBJECTIVE: snapshot => (
            snapshot.complete
                ? 'Route inference blocked. No transmission sent.'
                : 'Complete the Quiet Current field work.'
        ),
        GET_REMAIN_AND_DEFEND_SNAPSHOT: gameState => {
            const unlocked =
                gameState?.get?.('test.remainUnlocked') === true;
            const status = gameState?.get?.('test.remainStatus')
                || (unlocked ? 'active' : 'locked');
            const complete = status === 'complete';
            const councilReady = status === 'council_ready';
            return {
                unlocked,
                status,
                complete,
                councilReady,
                priority: gameState?.get?.(
                    'story.projectBeacon.finale.priority'
                ) || null,
                completedCount: complete ? 8 : councilReady ? 7 : 3,
                totalPhases: 8,
                progressPercent: complete ? 100 : councilReady ? 88 : 38,
                currentPhase: {
                    id: councilReady
                        ? 'commons_council'
                        : 'companion_boundaries',
                    label: councilReady
                        ? 'COMMONS COUNCIL'
                        : 'RECORD BOUNDARIES',
                    objective: councilReady
                        ? 'Return to the Living Commons.'
                        : 'Review companion boundaries.'
                },
                phases: [],
                state: {
                    status: complete ? 'complete' : 'not_started'
                }
            };
        },
        FORMAT_REMAIN_AND_DEFEND_OBJECTIVE: snapshot => (
            snapshot.complete
                ? 'The Fend can defend together.'
                : snapshot.currentPhase.objective
        ),
        Date,
        Array,
        Set,
        Math,
        Number,
        Boolean
    };

    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(overrides = {}) {
    const state = {
        creature: {
            name: 'Luma',
            bond: { level: 3 }
        },
        quests: {
            completed: []
        },
        story: {
            projectBeacon: {
                currentMission: null,
                pendingDebriefs: [],
                debriefsSeen: [],
                lastRouteUnlocked: null,
                uplinkRestored: false,
                finale: {
                    priority: null
                }
            }
        },
        hubWorld: {
            shipParts: {
                collected: []
            }
        },
        ...overrides
    };

    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce((value, key) => value?.[key], state);
        }
    };
}

describe('Project Beacon mission log', () => {
    const { getProjectBeaconLog } = loadStoryHelpers();
    const fieldMissionIds = projectBeacon.fieldMissions.map(mission => mission.id);
    const allSystemIds = projectBeacon.shipSystems.map(system => system.id);

    test('starts with a care-first directive and hides future reports', () => {
        const log = getProjectBeaconLog(createGameState());

        expect(log.phase).toBe('FIRST CONTACT');
        expect(log.directive).toBe('Establish Trust');
        expect(log.ship).toEqual(projectBeacon.ship);
        expect(log.companion).toEqual({
            name: 'Luma',
            bondLevel: 3,
            autonomousRescues: 0,
            highPowerReveals: 0,
            lineageRecords: 0
        });
        expect(log.priority).toBeNull();
        expect(log.trustEvidence).toBeNull();
        expect(log.recoveredSystems).toBe(0);
        expect(log.currentEcology).toEqual(expect.objectContaining({
            networkStatus: 'strained',
            restoredCount: 0,
            totalRegions: 6
        }));
        expect(log.systems.every(system => system.recovered === false)).toBe(true);
        expect(log.reports.every(report => report.status === 'locked')).toBe(true);
        expect(log.reports.every(report => report.finding === null)).toBe(true);
        expect(JSON.stringify(log.reports)).not.toMatch(/protecting home|signal could also reveal/i);
    });

    test('routes an available personal memory back to Wanderer-77', () => {
        const gameState = createGameState();
        gameState.state.quests.completed = [...fieldMissionIds];
        gameState.state.story.projectBeacon.senseiMemoryReady = true;
        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe('PERSONAL ARCHIVE // MEMORY 1 OF 3');
        expect(log.directive).toBe('Return to Wanderer-77.');
        expect(log.directiveDetail).toContain('THE DOJO FLOOR');
        expect(log.senseiMemory.ready).toBe(true);
    });

    test('routes the post-council Earth question back to Wanderer-77', () => {
        const gameState = createGameState({
            quests: {
                completed: [...fieldMissionIds]
            },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [],
                    debriefsSeen: [],
                    uplinkRestored: true,
                    finale: { priority: 'prepare_homecoming' }
                }
            },
            test: {
                remainUnlocked: true,
                remainStatus: 'complete',
                earthMemoryStatus: 'ready'
            }
        });
        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe('TWO WORLDS // EARTH QUESTION');
        expect(log.directive).toBe(
            'Return to Wanderer-77 with your companion.'
        );
        expect(log.directiveDetail).toContain('Earth question');
        expect(log.companionEarthMemory.ready).toBe(true);
    });

    test('summarizes recovered systems and only reveals earned field reports', () => {
        const gameState = createGameState({
            creature: {
                name: 'Luma',
                bond: { level: 5 }
            },
            quests: {
                completed: fieldMissionIds
            },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [{ id: 'beacon_debrief_2' }],
                    debriefsSeen: ['beacon_debrief_1'],
                    lastRouteUnlocked: {
                        gateId: 'stellar_reef',
                        label: 'Stellar Reef'
                    },
                    uplinkRestored: false,
                    finale: { priority: null }
                }
            },
            hubWorld: {
                shipParts: {
                    collected: ['forest_core', 'crystal_core']
                }
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe('RECOVERY // 2 OF 5');
        expect(log.directive).toBe('Continue to Stellar Reef.');
        expect(log.recoveredSystems).toBe(2);
        expect(log.systems.filter(system => system.recovered).map(system => system.id)).toEqual([
            'forest_core',
            'crystal_core'
        ]);
        expect(log.reports.map(report => report.status)).toEqual([
            'reviewed',
            'new',
            'locked',
            'locked',
            'locked'
        ]);
        expect(log.latestReport.id).toBe('beacon_debrief_2');
        expect(log.reports[2].finding).toBeNull();
    });

    test('keeps self-directed companion interventions in the trust record', () => {
        const gameState = createGameState({
            creature: {
                name: 'Luma',
                bond: { level: 4 },
                agencyHistory: [
                    {
                        decisionId: 'rescue:luma:mythical_forest_1:lethal_fall',
                        type: 'autonomous_rescue'
                    },
                    {
                        decisionId: 'observe:luma:root_current',
                        type: 'autonomous_action'
                    }
                ]
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.companion.autonomousRescues).toBe(1);
    });

    test('surfaces world-scale rescue evidence and Earth visibility risk', () => {
        const gameState = createGameState({
            creature: {
                name: 'Luma',
                bond: { level: 6 },
                agencyHistory: [{
                    decisionId: 'high_power:luma:run_0:final_void_1',
                    type: 'high_power_rescue',
                    powerId: 'skyfold_event',
                    affinity: 'nebula'
                }]
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.companion.highPowerReveals).toBe(1);
        expect(log.trustEvidence).toEqual({
            type: 'world_scale_rescue',
            powerId: 'skyfold_event',
            affinity: 'nebula',
            magnitude: 'extreme',
            outcome: 'living_network_stabilized',
            witnessScope: 'five_living_systems',
            earthVisibility: 'city_scale_detectable'
        });
    });

    test('surfaces completed Fusion Pod lineages as mission history', () => {
        const gameState = createGameState({
            breedingShrine: {
                breedingHistory: [
                    { operationId: 'fusion_1', offspringCount: 1 },
                    { operationId: 'fusion_2', offspringCount: 2 }
                ]
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.companion.lineageRecords).toBe(3);
    });

    test.each([
        {
            label: 'all pre-final systems',
            collected: allSystemIds,
            uplinkRestored: false,
            priority: null,
            phase: 'FINAL SIGNAL LOCATED',
            directive: 'Enter the Final Void.'
        },
        {
            label: 'complete ship before restoration',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: false,
            priority: null,
            phase: 'BEACON READY',
            directive: 'Return to Wanderer-77.'
        },
        {
            label: 'restored beacon before choice',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: true,
            priority: null,
            phase: 'PRIORITY PENDING',
            directive: 'Choose what Wanderer-77 prepares first.'
        },
        {
            label: 'recorded priority',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: true,
            priority: 'prepare_homecoming',
            phase: 'FEND RECOVERY // 0 OF 4',
            directive: 'Prepare FIRST LIGHT SHELTER.'
        }
    ])('$label produces the correct spoiler-safe status', ({
        collected,
        uplinkRestored,
        priority,
        phase,
        directive
    }) => {
        const gameState = createGameState({
            quests: { completed: fieldMissionIds },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [],
                    debriefsSeen: projectBeacon.campaignDebriefs.map(report => report.id),
                    lastRouteUnlocked: null,
                    uplinkRestored,
                    finale: { priority }
                }
            },
            hubWorld: {
                shipParts: { collected }
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe(phase);
        expect(log.directive).toBe(directive);
        expect(log.priority).toBe(priority);
    });

    test.each([
        {
            status: 'active',
            phase: 'REMAIN AND DEFEND // 3 OF 8',
            directive: 'RECORD BOUNDARIES'
        },
        {
            status: 'council_ready',
            phase: 'REMAIN AND DEFEND // COMMONS COUNCIL',
            directive: 'Hold the recovery council.'
        },
        {
            status: 'complete',
            phase: 'REMAIN AND DEFEND // COMPLETE',
            directive: 'The Fend can defend together.'
        }
    ])('uses the canonical recovery chapter for $status', ({
        status,
        phase,
        directive
    }) => {
        const gameState = createGameState({
            test: {
                remainUnlocked: true,
                remainStatus: status
            },
            quests: { completed: fieldMissionIds },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [],
                    debriefsSeen: [],
                    uplinkRestored: true,
                    finale: { priority: 'remain_and_defend' }
                }
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe(phase);
        expect(log.directive).toBe(directive);
        expect(log.remainAndDefend.status).toBe(status);
    });

    test.each([
        {
            status: 'not_started',
            anchors: [],
            phase: 'FEND CONSEQUENCE // QUIET CURRENT',
            directive: 'Speak with Ilyra at the Fend Commons.'
        },
        {
            status: 'active',
            anchors: ['root_echo'],
            phase: 'QUIET CURRENT // 1 OF 3',
            directive: 'Stabilize TRAILHEAD ROOT.'
        },
        {
            status: 'verification_ready',
            anchors: ['root_echo', 'well_echo', 'relay_echo'],
            phase: 'QUIET CURRENT // VERIFY',
            directive: 'Return to Wanderer-77.'
        },
        {
            status: 'complete',
            anchors: ['root_echo', 'well_echo', 'relay_echo'],
            phase: 'QUIET CURRENT // VERIFIED',
            directive: 'Continue defending the Fend.'
        }
    ])('surfaces Quiet Current state $status after the sealed protocol', ({
        status,
        anchors,
        phase,
        directive
    }) => {
        const gameState = createGameState({
            test: { fendComplete: true },
            quests: { completed: fieldMissionIds },
            story: {
                projectBeacon: {
                    currentMission: 'field_sequence_complete',
                    pendingDebriefs: [],
                    debriefsSeen: [],
                    uplinkRestored: true,
                    finale: { priority: 'remain_and_defend' },
                    shipArchive: { complete: true },
                    protectedReturnProtocol: {
                        completedStepIds: [
                            'survival_packet',
                            'route_quarantine',
                            'living_witness_seal',
                            'uplink_hold'
                        ]
                    }
                }
            },
            world: {
                currentVeilMission: {
                    status,
                    stabilizedAnchorIds: anchors
                }
            },
            hubWorld: {
                shipParts: {
                    collected: [...allSystemIds, 'command_module']
                }
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe(phase);
        expect(log.directive).toBe(directive);
        expect(log.currentVeil.state.status).toBe(status);
    });

    test('integrates a responsive, lifecycle-managed log into the game menu', () => {
        const menuSource = fs.readFileSync(
            path.join(__dirname, '../ui/HamburgerMenu.js'),
            'utf8'
        );
        const modalSource = fs.readFileSync(
            path.join(__dirname, '../ui/ProjectBeaconLogModal.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const sceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(menuSource).toContain("label: 'Beacon Log'");
        expect(menuSource).toContain('this.showBeaconLog()');
        expect(menuSource).toContain('this.beaconLogModal?.destroy()');
        expect(modalSource).toContain("width < 600");
        expect(modalSource).toContain("this.activeTab === 'archive'");
        expect(modalSource).toContain('getProjectBeaconLog(this.getGameState())');
        expect(modalSource).toContain("'CURRENT NETWORK'");
        expect(modalSource).toContain('log.currentEcology.vitality');
        expect(modalSource).toContain('contentWidth,\n                sanctuaryCommunity');
        expect(modalSource).toContain('contentWidth,\n            sanctuaryCommunity');
        expect(modalSource).toContain('CHOSE TO INTERVENE');
        expect(modalSource).toContain('LINEAGES STABILIZED');
        expect(modalSource).toContain('EXTREME POWER WITNESSED');
        expect(modalSource).toContain('detectable across a city');
        expect(modalSource).toContain('FLIGHT ${log.ship.flightNumber}');
        expect(modalSource).toContain('log.ship.livery.forEach');
        expect(modalSource).toContain("this.scene.input.keyboard?.once('keydown-ESC'");
        expect(gameSource).toContain(
            "['mission', 'recovery', 'archive', 'memory'].includes("
        );
        expect(gameSource).toContain('beaconLogPreview: testBeaconLog');
        expect(sceneSource).toContain('createBeaconLogPreview()');
        expect(hatchingSource).toContain("previewParams.has('testBeaconLog')");
    });
});

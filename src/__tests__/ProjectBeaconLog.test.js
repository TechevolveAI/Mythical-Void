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
        .replace(/export function /g, 'function ');
    const script = `${transformed}
        module.exports = { getProjectBeaconLog };
    `;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        PROJECT_BEACON: projectBeacon,
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
                endingChoice: null
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
        expect(log.companion).toEqual({ name: 'Luma', bondLevel: 3 });
        expect(log.recoveredSystems).toBe(0);
        expect(log.systems.every(system => system.recovered === false)).toBe(true);
        expect(log.reports.every(report => report.status === 'locked')).toBe(true);
        expect(log.reports.every(report => report.finding === null)).toBe(true);
        expect(JSON.stringify(log.reports)).not.toMatch(/protecting home|signal could also reveal/i);
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
                    endingChoice: null
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

    test.each([
        {
            label: 'all pre-final systems',
            collected: allSystemIds,
            uplinkRestored: false,
            endingChoice: null,
            phase: 'FINAL SIGNAL LOCATED',
            directive: 'Enter the Final Void.'
        },
        {
            label: 'complete ship before restoration',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: false,
            endingChoice: null,
            phase: 'BEACON READY',
            directive: 'Return to Wanderer-7.'
        },
        {
            label: 'restored beacon before choice',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: true,
            endingChoice: null,
            phase: 'DECISION PENDING',
            directive: 'Face the Project Beacon choice.'
        },
        {
            label: 'recorded ending',
            collected: [...allSystemIds, 'command_module'],
            uplinkRestored: true,
            endingChoice: 'earth',
            phase: 'MISSION ROUTE RECORDED',
            directive: 'Project Beacon remembers your choice.'
        }
    ])('$label produces the correct spoiler-safe status', ({
        collected,
        uplinkRestored,
        endingChoice,
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
                    endingChoice
                }
            },
            hubWorld: {
                shipParts: { collected }
            }
        });

        const log = getProjectBeaconLog(gameState);

        expect(log.phase).toBe(phase);
        expect(log.directive).toBe(directive);
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
        expect(modalSource).toContain("this.scene.input.keyboard?.once('keydown-ESC'");
        expect(gameSource).toContain("['mission', 'archive'].includes(testBeaconLog)");
        expect(gameSource).toContain('beaconLogPreview: testBeaconLog');
        expect(sceneSource).toContain('createBeaconLogPreview()');
        expect(hatchingSource).toContain("previewParams.has('testBeaconLog')");
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHubWorldScene(sceneWindow = {}) {
    const filePath = path.join(__dirname, '../scenes/HubWorldScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import Phaser from 'phaser';$/m, '')
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/ProjectBeaconStory\.js';/,
            'const acknowledgeProjectBeaconDebrief = () => {};\n' +
            'const getNextProjectBeaconDebrief = () => null;\n' +
            'const getProjectBeaconDebrief = () => null;\n' +
            'const getProjectBeaconFirstExpeditionHandoff = () => null;'
        )
        .replace(
            "import { getExpeditionDiagnosticSnapshot } from '../systems/ExpeditionDiagnostics.js';",
            'const getExpeditionDiagnosticSnapshot = () => ({ available: false, lines: [] });'
        )
        .replace(
            "import { getShipReconstructionSnapshot } from '../systems/ShipReconstruction.js';",
            'const getShipReconstructionSnapshot = () => ({ finalVoidReady: false, steps: [] });'
        )
        .replace('export default class HubWorldScene', 'class HubWorldScene')
        .concat('\nmodule.exports = HubWorldScene;\n');

    class PhaserScene {
        constructor(config) {
            this.scene = { key: config?.key };
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        Object,
        Array,
        Math,
        Number,
        String,
        Boolean,
        Set,
        URLSearchParams
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('HubWorldScene gate grid', () => {
    let HubWorldScene;

    beforeAll(() => {
        HubWorldScene = loadHubWorldScene();
    });

    test('focuses the newly opened route after the final pending field log', () => {
        const scene = new HubWorldScene();
        const notice = {
            y: 74,
            setOrigin: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis(),
            setAlpha: jest.fn().mockReturnThis(),
            destroy: jest.fn()
        };
        scene.dims = { width: 390, height: 844, isMobile: true };
        scene.gates = [
            { id: 'mythical_forest', data: { unlocked: true, name: 'Mythical Forest' } },
            { id: 'crystal_caves', data: { unlocked: true, name: 'Crystal Caves' } }
        ];
        scene.selectGate = jest.fn();
        scene.add = { text: jest.fn(() => notice) };
        scene.tweens = { add: jest.fn() };
        scene.time = { delayedCall: jest.fn() };

        expect(scene.focusProjectBeaconNextRoute({
            nextGate: { id: 'crystal_caves' }
        })).toBe(true);
        expect(scene.selectGate).toHaveBeenCalledWith(1);
        expect(scene.add.text).toHaveBeenCalledWith(
            195,
            74,
            'NEW ROUTE OPEN // CRYSTAL CAVES',
            expect.any(Object)
        );
        expect(scene.time.delayedCall).toHaveBeenCalledWith(
            2400,
            expect.any(Function)
        );
    });

    test('fits seven gates above the mobile details panel in two rows', () => {
        const scene = new HubWorldScene();
        scene.dims = {
            width: 390,
            height: 844,
            centerY: 844 * 0.22,
            isMobile: true
        };

        const layout = scene.getGateGridLayout(7);
        const finalRowCenter = layout.startY + layout.gateHeight + layout.gapY;
        const finalLabelBottom = finalRowCenter + layout.gateSize + 30;
        const detailsPanelTop = 844 - 280 + 20;

        expect(layout.gatesPerRow).toBe(4);
        expect(layout.gateSize).toBe(30);
        expect(layout.gateWidth * 4 + layout.gapX * 3).toBeLessThanOrEqual(390);
        expect(finalLabelBottom).toBeLessThan(detailsPanelTop);
    });

    test('uses two compact rows for the six-gate pre-final state', () => {
        const scene = new HubWorldScene();
        scene.dims = {
            width: 390,
            height: 844,
            centerY: 844 * 0.22,
            isMobile: true
        };

        const layout = scene.getGateGridLayout(6);
        const rowCount = Math.ceil(6 / layout.gatesPerRow);

        expect(layout.gatesPerRow).toBe(3);
        expect(rowCount).toBe(2);
        expect(layout.gateWidth * 3 + layout.gapX * 2).toBeLessThanOrEqual(390);
    });

    test('centers a smaller early-game set in two columns', () => {
        const scene = new HubWorldScene();
        scene.dims = {
            width: 1280,
            height: 720,
            centerY: 180,
            isMobile: false
        };

        expect(scene.getGateGridLayout(4)).toEqual({
            gatesPerRow: 2,
            gateWidth: 110,
            gateHeight: 120,
            gapX: 32,
            gapY: 16,
            startY: 330,
            gateSize: 45
        });
    });

    test('keeps the complete desktop state to two rows', () => {
        const scene = new HubWorldScene();
        scene.dims = {
            width: 1280,
            height: 720,
            centerY: 180,
            isMobile: false
        };

        const layout = scene.getGateGridLayout(7);

        expect(layout.gatesPerRow).toBe(4);
        expect(Math.ceil(7 / layout.gatesPerRow)).toBe(2);
        expect(layout.gateWidth * 4 + layout.gapX * 3).toBeLessThan(1280);
    });

    test('keeps gate status concise so it cannot collide with the action', () => {
        const hubSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );

        expect(hubSource).toContain(
            "info += '\\nRoute discovered • Ready to open'"
        );
        expect(hubSource).toContain(
            'this.actionButton = this.add.graphics().setPosition(actionBtnX, actionBtnY)'
        );
        expect(hubSource).toContain(
            'this.actionButton.fillRoundedRect(-60, -25, 120, 50, 10)'
        );
    });
});

describe('persistent expedition resume presentation', () => {
    function createResumeWindow(overrides = {}) {
        const checkpoint = {
            version: 1,
            sceneKey: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            checkpointId: 'forest_anchor_3',
            checkpointIndex: 2,
            x: 5300,
            y: 1000,
            savedAt: Date.now(),
            ...overrides.checkpoint
        };
        const values = {
            'story.projectBeacon.expeditionCheckpoint': checkpoint,
            'levels.mythicalForest.completed': false,
            ...overrides.values
        };
        return {
            GameState: {
                get: jest.fn(pathName => values[pathName]),
                set: jest.fn((pathName, value) => {
                    values[pathName] = value;
                }),
                save: jest.fn()
            }
        };
    }

    test('matches a durable checkpoint only to its unfinished gate', () => {
        const sceneWindow = createResumeWindow();
        const HubWorldScene = loadHubWorldScene(sceneWindow);
        const scene = new HubWorldScene();

        expect(scene.getExpeditionResumeForGate('mythical_forest')).toEqual({
            gateId: 'mythical_forest',
            sceneKey: 'MythicalForestLevel',
            checkpointId: 'forest_anchor_3',
            label: 'Guardian Approach',
            current: 3,
            total: 3
        });
        expect(scene.getExpeditionResumeForGate('crystal_caves')).toBeNull();
    });

    test('rejects mismatched signal IDs and clears completed checkpoints', () => {
        const mismatchedWindow = createResumeWindow({
            checkpoint: { checkpointId: 'forest_anchor_unknown' }
        });
        const MismatchedHub = loadHubWorldScene(mismatchedWindow);
        expect(
            new MismatchedHub().getExpeditionResumeForGate('mythical_forest')
        ).toBeNull();

        const completedWindow = createResumeWindow({
            values: { 'levels.mythicalForest.completed': true }
        });
        const CompletedHub = loadHubWorldScene(completedWindow);
        const completedScene = new CompletedHub();

        expect(completedScene.clearCompletedExpeditionCheckpoint()).toBe(true);
        expect(completedWindow.GameState.set).toHaveBeenCalledWith(
            'story.projectBeacon.expeditionCheckpoint',
            null
        );
        expect(completedWindow.GameState.save).toHaveBeenCalledTimes(1);
        expect(
            completedScene.getExpeditionResumeForGate('mythical_forest')
        ).toBeNull();
    });

    test('changes the selected gate status and command to resume', () => {
        const sceneWindow = createResumeWindow();
        const HubWorldScene = loadHubWorldScene(sceneWindow);
        const scene = new HubWorldScene();
        const actionButton = {
            clear: jest.fn(),
            fillStyle: jest.fn(),
            fillRoundedRect: jest.fn(),
            lineStyle: jest.fn(),
            strokeRoundedRect: jest.fn()
        };
        scene.infoText = { setText: jest.fn() };
        scene.actionLabel = { setText: jest.fn() };
        scene.actionButton = actionButton;

        scene.updateInfoPanel({
            id: 'mythical_forest',
            data: {
                name: 'Mythical Forest',
                unlocked: true,
                visits: 1,
                inDevelopment: false
            },
            config: { icon: 'FOREST' }
        });

        expect(scene.infoText.setText).toHaveBeenCalledWith(
            'FOREST Mythical Forest\nBeacon 3/3 • Guardian Approach'
        );
        expect(scene.actionLabel.setText).toHaveBeenCalledWith('RESUME');
    });

    test('all expedition briefings present restored Beacon state without another modal', () => {
        const levelFiles = [
            'MythicalForestLevel.js',
            'CrystalCavesLevel.js',
            'ReefLevel.js',
            'VoidPeaksLevel.js',
            'AuroraDepthsLevel.js',
            'FinalVoidLevel.js'
        ];

        levelFiles.forEach(fileName => {
            const source = fs.readFileSync(
                path.join(__dirname, '../scenes/levels', fileName),
                'utf8'
            );
            expect(source).toContain('this.getExpeditionResumePresentation()');
            expect(source).toContain('RESUME EXPEDITION');
            expect(source).toContain('link restored');
        });
    });
});

describe('complete Hub preview route', () => {
    test('is local-only and passes preview state instead of changing GameState', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const hubSource = fs.readFileSync(path.join(__dirname, '../scenes/HubWorldScene.js'), 'utf8');
        const hatchingSource = fs.readFileSync(path.join(__dirname, '../scenes/HatchingScene.js'), 'utf8');
        const previewBlock = gameSource.match(
            /const testHub =[\s\S]*?if \(isLocalPreview && testDebrief/
        )?.[0] || '';

        expect(previewBlock).toContain(
            "'diagnostics'"
        );
        expect(previewBlock).toContain('progressionPreview: testHub');
        expect(previewBlock).toContain("urlParams.get('previewSize') === 'mobile'");
        expect(previewBlock).not.toContain('GameState.set');
        expect(hubSource).toContain("['complete', 'finalApproach'].includes(");
        expect(hubSource).toContain("this.progressionPreview === 'firstRoute'");
        expect(hubSource).toContain("this.progressionPreview === 'routeMap'");
        expect(hubSource).toContain("this.progressionPreview === 'checkpoint'");
        expect(hubSource).toContain("this.progressionPreview === 'diagnostics'");
        expect(hubSource).toContain("this.progressionPreview === 'finalApproach'");
        expect(hatchingSource).toContain("previewParams.has('testHub')");
    });
});

describe('first-expedition Hub handoff', () => {
    function createWindow(overrides = {}) {
        const values = {
            'story.projectBeacon.firstExpeditionPromptSeen': false,
            'story.projectBeacon.fieldKit.recovered': true,
            'world.livingSignals.observedIds': [
                'echo_bloom',
                'memory_stone',
                'rootlight'
            ],
            'levels.mythicalForest': {
                entered: false,
                visited: false,
                completed: false
            },
            ...overrides
        };
        return {
            GameState: {
                get: jest.fn(pathName => values[pathName])
            }
        };
    }

    test('offers the route after the Sanctuary sequence is complete', () => {
        const HubWorldScene = loadHubWorldScene(createWindow());
        const scene = new HubWorldScene();

        expect(scene.shouldShowFirstExpeditionInvitation()).toBe(true);
    });

    test('does not repeat after dismissal or after entering the forest', () => {
        const seenSceneClass = loadHubWorldScene(createWindow({
            'story.projectBeacon.firstExpeditionPromptSeen': true
        }));
        const enteredSceneClass = loadHubWorldScene(createWindow({
            'levels.mythicalForest': {
                entered: true,
                visited: true,
                completed: false
            }
        }));

        expect(
            new seenSceneClass().shouldShowFirstExpeditionInvitation()
        ).toBe(false);
        expect(
            new enteredSceneClass().shouldShowFirstExpeditionInvitation()
        ).toBe(false);
    });

    test('keeps the first-route preview forced and non-mutating', () => {
        const HubWorldScene = loadHubWorldScene({});
        const scene = new HubWorldScene();
        scene.progressionPreview = 'firstRoute';

        expect(scene.shouldShowFirstExpeditionInvitation()).toBe(true);

        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );
        expect(source).toContain(
            "this.progressionPreview !== 'firstRoute'"
        );
        expect(source).toContain(
            "'story.projectBeacon.firstExpeditionPromptSeen'"
        );
        expect(source).toContain(
            "gate => gate.id === 'mythical_forest'"
        );
    });
});

describe('permanent route-map Hub handoff', () => {
    test('recognizes a purchased route independently of the coin balance', () => {
        const sceneWindow = {
            GameState: {
                get: jest.fn(pathName => {
                    if (pathName === 'hubWorld.mapsOwned') {
                        return ['stellar_reef'];
                    }
                    if (pathName === 'player.cosmicCoins') {
                        return 0;
                    }
                    return undefined;
                })
            }
        };
        const HubWorldScene = loadHubWorldScene(sceneWindow);
        const scene = new HubWorldScene();

        expect(scene.hasRouteMap('stellar_reef')).toBe(true);
        expect(scene.hasRouteMap('void_peaks')).toBe(false);
    });

    test('provides a non-mutating route-map preview for visual QA', () => {
        const HubWorldScene = loadHubWorldScene({});
        const scene = new HubWorldScene();
        scene.progressionPreview = 'routeMap';

        expect(scene.hasRouteMap('stellar_reef')).toBe(true);
        expect(scene.hasRouteMap('void_peaks')).toBe(false);

        const hubSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );
        expect(hubSource).toContain(
            "? { success: true, method: 'preview' }"
        );
        expect(hubSource).toContain(
            "if (result.method !== 'preview')"
        );
    });

    test('offers owned maps as free activation only after campaign prerequisites', () => {
        const hubSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HubWorldScene.js'),
            'utf8'
        );

        expect(hubSource).toContain(
            'const prerequisitesMet = campaignAccess?.prerequisitesMet !== false'
        );
        expect(hubSource).toContain(
            'const canUnlock = prerequisitesMet && shipRequirementsMet'
        );
        expect(hubSource).toContain(
            'Complete ${campaignAccess.nextRequiredRoute.label} first'
        );
    });
});

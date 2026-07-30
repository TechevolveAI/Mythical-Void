const fs = require('fs');
const path = require('path');
const vm = require('vm');
const projectBeacon = require('../config/project-beacon.json');

function loadOnboardingManager(sceneWindow) {
    const filePath = path.join(__dirname, '../systems/OnboardingManager.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { devLog } from '../utils/devLogger.js';",
            'const devLog = () => {};'
        )
        .replace(
            'export default onboardingManager;',
            'module.exports = { OnboardingManager, onboardingManager };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Date,
        Promise
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports.OnboardingManager;
}

function loadQuestTracker(sceneWindow) {
    const filePath = path.join(__dirname, '../systems/ui/QuestTracker.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace('export default class QuestTracker', 'class QuestTracker')
        .concat('\nmodule.exports = QuestTracker;\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadCreatureRadialMenu(sceneWindow = {}) {
    const filePath = path.join(__dirname, '../ui/CreatureRadialMenu.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { devLog } from '../utils/devLogger.js';",
            'const devLog = () => {};'
        )
        .replace('export default class CreatureRadialMenu', 'class CreatureRadialMenu')
        .concat('\nmodule.exports = CreatureRadialMenu;\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        localStorage: sceneWindow.localStorage || {
            getItem: jest.fn(() => null)
        }
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadCarePanelManager(sceneWindow) {
    const filePath = path.join(__dirname, '../systems/ui/CarePanelManager.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace("import Phaser from 'phaser';", '')
        .replace('export default CarePanelManager;', 'module.exports = CarePanelManager;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('first-session Project Beacon mission loop', () => {
    test('keeps daily and NASA popups out of the first sanctuary visit', async () => {
        const state = {
            tutorial: {
                controlsSeen: false,
                crashStorySeen: false
            },
            session: {
                lastDailyShown: null
            }
        };
        const sceneWindow = {
            GameState: {
                get: jest.fn(propertyPath => (
                    propertyPath.split('.').reduce((value, key) => value?.[key], state)
                )),
                getDailyLoginBonus: jest.fn(() => ({ available: true }))
            },
            NASAContentSystem: {
                shouldShowDailyContent: jest.fn(() => true)
            }
        };
        const OnboardingManager = loadOnboardingManager(sceneWindow);
        const manager = new OnboardingManager();
        manager.initialize({});
        manager.processQueue = jest.fn(async () => {});

        await manager.startOnboardingFlow();

        expect(manager.popupQueue.map(popup => popup.id)).toEqual([
            'crash_story',
            'controls'
        ]);
        expect(manager.flowContext).toEqual({
            firstSanctuaryVisit: true,
            queuedPopupIds: ['crash_story', 'controls']
        });
    });

    test('marks the crash story seen only after the player dismisses it', () => {
        let dismissStory;
        const onComplete = jest.fn();
        const gameState = {
            set: jest.fn(),
            save: jest.fn()
        };
        const sceneWindow = { GameState: gameState };
        const OnboardingManager = loadOnboardingManager(sceneWindow);
        const manager = new OnboardingManager();
        manager.initialize({
            showShipMemoriesWithCallback: jest.fn(callback => {
                dismissStory = callback;
            })
        });

        manager.showCrashStory(onComplete);

        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        dismissStory();

        expect(gameState.set).toHaveBeenCalledWith(
            'tutorial.crashStorySeen',
            true
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test('frames controls as the handoff into sanctuary agency', () => {
        const controlsSource = fs.readFileSync(
            path.join(__dirname, '../ui/ControlsTutorialOverlay.js'),
            'utf8'
        );

        expect(controlsSource).toContain(
            'PROJECT BEACON // FIELD CONTROLS'
        );
        expect(controlsSource).toContain('START FIELDWORK');
        expect(controlsSource).toContain(
            "const isMobile = width < 600 ||"
        );
        expect(controlsSource).toContain(
            'Tap companion: Care, Chat, Profile.'
        );
        expect(controlsSource).toContain(
            "fontSize: isMobile ? '17px' : '30px'"
        );
        expect(controlsSource).not.toContain('Attack enemies');
    });

    test('provides a non-mutating field-controls preview route', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(gameSource).toContain("urlParams.has('testControls')");
        expect(gameSource).toContain('controlsPreview: true');
        expect(gameSceneSource).toContain(
            'this.controlsTutorial.show({ force: true });'
        );
        expect(hatchingSource).toContain(
            "previewParams.has('testControls')"
        );
    });

    test('does not activate Sanctuary decoration QA when its parameter is absent', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "const hasSanctuaryDecorPreview = urlParams.has('testSanctuaryDecor');"
        );
        expect(gameSource).toMatch(
            /isLocalPreview &&\s*hasSanctuaryDecorPreview &&\s*Number\.isFinite\(testSanctuaryDecor\)/
        );
    });

    test('preserves daily and NASA content for returning sessions', async () => {
        const state = {
            tutorial: {
                controlsSeen: true,
                crashStorySeen: true
            },
            session: {
                lastDailyShown: null
            }
        };
        const sceneWindow = {
            GameState: {
                get: jest.fn(propertyPath => (
                    propertyPath.split('.').reduce((value, key) => value?.[key], state)
                )),
                getDailyLoginBonus: jest.fn(() => ({ available: true }))
            },
            NASAContentSystem: {
                shouldShowDailyContent: jest.fn(() => true)
            }
        };
        const OnboardingManager = loadOnboardingManager(sceneWindow);
        const manager = new OnboardingManager();
        manager.initialize({});
        manager.processQueue = jest.fn(async () => {});

        await manager.startOnboardingFlow();

        expect(manager.popupQueue.map(popup => popup.id)).toEqual([
            'daily_greeting',
            'nasa_content'
        ]);
        expect(manager.flowContext.firstSanctuaryVisit).toBe(false);
    });

    test('auto-claims story missions but leaves ordinary quests player-claimed', () => {
        const callbacks = {};
        const questManager = {
            on: jest.fn((event, callback) => {
                callbacks[event] = callback;
                return jest.fn();
            }),
            getQuestsByType: jest.fn(() => [])
        };
        const QuestTracker = loadQuestTracker({ QuestManager: questManager });
        const tracker = new QuestTracker({
            time: { delayedCall: jest.fn() }
        });
        tracker.updateQuestDisplay = jest.fn();
        tracker.showQuestCompleteNotification = jest.fn();
        tracker.claimQuest = jest.fn();

        tracker.setupEventListeners();
        const storyQuest = {
            id: 'beacon_first_contact',
            questId: 'beacon_first_contact',
            type: 'story'
        };
        const dailyQuest = {
            id: 'daily_feed',
            questId: 'daily_feed_1',
            type: 'daily'
        };

        callbacks.questCompleted({ quest: storyQuest });
        callbacks.questCompleted({ quest: dailyQuest });

        expect(tracker.claimQuest).toHaveBeenCalledTimes(1);
        expect(tracker.claimQuest).toHaveBeenCalledWith(storyQuest, {
            showRewardAnimation: false
        });
    });

    test('briefs the next story mission after a completed mission advances', () => {
        const callbacks = {};
        const nextQuest = {
            id: 'beacon_field_kit',
            type: 'story'
        };
        const delayedCall = jest.fn();
        const questManager = {
            on: jest.fn((event, callback) => {
                callbacks[event] = callback;
                return jest.fn();
            }),
            getQuestsByType: jest.fn(() => [nextQuest])
        };
        const QuestTracker = loadQuestTracker({ QuestManager: questManager });
        const tracker = new QuestTracker({
            time: { delayedCall }
        });
        tracker.updateQuestDisplay = jest.fn();
        tracker.showStoryMissionBriefing = jest.fn();
        tracker.setupEventListeners();

        callbacks.questRewardClaimed({
            quest: { id: 'beacon_first_contact', type: 'story' }
        });

        expect(delayedCall).toHaveBeenCalledWith(4500, expect.any(Function));
        delayedCall.mock.calls[0][1]();
        expect(tracker.showStoryMissionBriefing).toHaveBeenCalledWith(nextQuest);
    });

    test('waits for the field-kit story moment before briefing the next mission', () => {
        const callbacks = {};
        const timers = [];
        const nextQuest = {
            id: 'beacon_living_signals',
            type: 'story',
            completed: false,
            claimed: false
        };
        const delayedCall = jest.fn((delay, callback) => {
            const timer = { remove: jest.fn() };
            timers.push({ delay, callback, timer });
            return timer;
        });
        const questManager = {
            on: jest.fn((event, callback) => {
                callbacks[event] = callback;
                return jest.fn();
            }),
            getQuestsByType: jest.fn(() => [nextQuest])
        };
        const QuestTracker = loadQuestTracker({ QuestManager: questManager });
        const scene = {
            isFieldKitModalOpen: true,
            time: { delayedCall }
        };
        const tracker = new QuestTracker(scene);
        tracker.updateQuestDisplay = jest.fn();
        tracker.showStoryMissionBriefing = jest.fn();
        tracker.setupEventListeners();

        callbacks.questRewardClaimed({
            quest: { id: 'beacon_field_kit', type: 'story' }
        });
        expect(timers[0].delay).toBe(4500);

        timers[0].callback();
        expect(tracker.showStoryMissionBriefing).not.toHaveBeenCalled();
        expect(timers[1].delay).toBe(350);

        scene.isFieldKitModalOpen = false;
        timers[1].callback();

        expect(tracker.showStoryMissionBriefing).toHaveBeenCalledWith(nextQuest);
    });

    test('drops a queued briefing if its mission is no longer active', () => {
        const timers = [];
        const questManager = {
            getQuestsByType: jest.fn(() => [{
                id: 'beacon_world_gate',
                type: 'story',
                completed: false,
                claimed: false
            }])
        };
        const QuestTracker = loadQuestTracker({ QuestManager: questManager });
        const tracker = new QuestTracker({
            time: {
                delayedCall: jest.fn((delay, callback) => {
                    timers.push(callback);
                    return { remove: jest.fn() };
                })
            }
        });
        tracker.showStoryMissionBriefing = jest.fn();

        tracker.scheduleStoryMissionBriefing({
            id: 'beacon_living_signals',
            type: 'story'
        });
        timers[0]();

        expect(tracker.showStoryMissionBriefing).not.toHaveBeenCalled();
    });

    test('reconciles an already-completed story mission from an older save', () => {
        const completedQuest = {
            id: 'beacon_field_kit',
            questId: 'beacon_field_kit',
            type: 'story',
            completed: true,
            claimed: false
        };
        const questManager = {
            getQuestsByType: jest.fn(() => [completedQuest])
        };
        const QuestTracker = loadQuestTracker({ QuestManager: questManager });
        const tracker = new QuestTracker({});
        tracker.claimQuest = jest.fn();

        tracker.advanceCompletedStoryQuest();

        expect(tracker.claimQuest).toHaveBeenCalledWith(completedQuest, {
            showRewardAnimation: false
        });
    });

    test('makes Care a direct companion action for touch players', () => {
        const CreatureRadialMenu = loadCreatureRadialMenu();
        const menu = new CreatureRadialMenu({});
        const careAction = menu.menuItems.find(item => item.id === 'care');
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );

        expect(menu.menuItems).toHaveLength(5);
        expect(menu.menuItems.find(item => item.id === 'ai_art')).toBeUndefined();
        expect(careAction).toEqual(expect.objectContaining({
            icon: '💖',
            label: 'Care'
        }));
        expect(gameSceneSource).toContain("case 'care':");
        expect(gameSceneSource).toContain('this.toggleCarePanel();');
    });

    test('only offers AI Art when optional API features are enabled', () => {
        const CreatureRadialMenu = loadCreatureRadialMenu({
            APIConfig: {
                isEnabled: jest.fn(() => true)
            },
            CloudSaveManager: {
                isAgeGroupEligible: jest.fn(() => true)
            },
            localStorage: {
                getItem: jest.fn(() => 'age_18_plus')
            }
        });
        const menu = new CreatureRadialMenu({});

        expect(menu.menuItems).toHaveLength(6);
        expect(menu.menuItems.find(item => item.id === 'ai_art')).toEqual(
            expect.objectContaining({
                icon: '🎨',
                label: 'AI Art'
            })
        );
        expect(menu.menuItems.map(item => item.angle)).toEqual([
            -90, -30, 30, 90, 150, 210
        ]);
    });

    test('keeps external portrait generation off for under-16 profiles', () => {
        const CreatureRadialMenu = loadCreatureRadialMenu({
            APIConfig: {
                isEnabled: jest.fn(() => true)
            },
            CloudSaveManager: {
                isAgeGroupEligible: jest.fn(() => false)
            },
            localStorage: {
                getItem: jest.fn(() => 'age_13_15')
            }
        });
        const menu = new CreatureRadialMenu({});

        expect(menu.menuItems.find(item => item.id === 'ai_art')).toBeUndefined();
    });

    test('keeps the radial menu inside a narrow camera view', () => {
        const CreatureRadialMenu = loadCreatureRadialMenu();
        const menu = new CreatureRadialMenu({
            scale: { width: 390 },
            cameras: {
                main: {
                    zoom: 1,
                    worldView: {
                        left: 350,
                        right: 740,
                        top: 0,
                        bottom: 844,
                        width: 390,
                        height: 844
                    }
                }
            }
        });

        const center = menu.getMenuCenter(650, 400);

        expect(menu.radius).toBe(74);
        expect(center.x).toBeLessThan(600);
        expect(center.x - 350 + menu.labelRadius + 38).toBeLessThanOrEqual(390);
        expect(center.y).toBe(400);
    });

    test('provides authored, platform-specific guidance for every field mission', () => {
        projectBeacon.fieldMissions.forEach(mission => {
            expect(mission.briefing.length).toBeGreaterThan(30);
            expect(mission.fieldNote.length).toBeGreaterThan(20);
            expect(mission.guidanceDesktop.length).toBeGreaterThan(15);
            expect(mission.guidanceMobile.length).toBeGreaterThan(15);
        });

        expect(projectBeacon.fieldMissions[0].guidanceMobile).toMatch(/Tap your companion/i);
        expect(projectBeacon.fieldMissions[0].fieldNote).toMatch(/Sensei/i);
    });

    test('keeps the opening care instructions aligned with keyboard controls', () => {
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const tutorialSource = fs.readFileSync(
            path.join(__dirname, '../systems/TutorialSystem.js'),
            'utf8'
        );
        const accessibilitySource = fs.readFileSync(
            path.join(__dirname, '../systems/UXEnhancements.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');

        expect(projectBeacon.fieldMissions[0].guidanceDesktop).toMatch(
            /Press TAB, then choose Feed or Play/i
        );
        expect(gameSceneSource).toContain('this.carePanelManager?.init();');
        expect(gameSceneSource).toContain(
            'this.careKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);'
        );
        expect(gameSceneSource).toContain(
            'this.playKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);'
        );
        expect(gameSceneSource).not.toContain("this.input.keyboard?.on('keydown-TAB'");
        expect(tutorialSource).toMatch(/TAB to open Care Corner/);
        expect(accessibilitySource).toContain('<dt>F / Y / R</dt>');
        expect(accessibilitySource).toContain('<dt>C</dt><dd>Switch creatures</dd>');
        expect(accessibilitySource).toContain('<dt>T</dt><dd>Chat with creature</dd>');
        expect(gameSource).toContain("urlParams.get('testCare') === 'panel'");
        expect(gameSource).toContain('if (!game.isBooted)');
        expect(gameSceneSource).toContain('this.createCarePanelPreview();');
    });

    test('opens and closes the initialized Care Corner without duplicate cleanup', () => {
        const sceneWindow = { UXEnhancements: { announce: jest.fn() } };
        const CarePanelManager = loadCarePanelManager(sceneWindow);
        const createElement = () => {
            const handlers = {};
            return {
                active: true,
                visible: true,
                handlers,
                setOrigin: jest.fn().mockReturnThis(),
                setScrollFactor: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                setVisible: jest.fn(function setVisible(visible) {
                    this.visible = visible;
                    return this;
                }),
                setInteractive: jest.fn().mockReturnThis(),
                setText: jest.fn().mockReturnThis(),
                setTintFill: jest.fn().mockReturnThis(),
                on: jest.fn(function on(event, callback) {
                    handlers[event] = callback;
                    return this;
                }),
                removeAllListeners: jest.fn(),
                destroy: jest.fn()
            };
        };
        const scene = {
            scale: { width: 1280, height: 720 },
            textures: { exists: jest.fn(() => true) },
            add: {
                image: jest.fn(createElement),
                text: jest.fn(createElement),
                zone: jest.fn(createElement)
            }
        };
        const careSystem = {
            getAllCareActionsInfo: jest.fn(() => ({
                feed: { icon: 'F', name: 'Feed', currentCount: 0, limit: 3, canPerform: true },
                play: { icon: 'P', name: 'Play', currentCount: 0, limit: 2, canPerform: true },
                rest: {
                    icon: 'R',
                    name: 'Rest',
                    currentCount: 0,
                    limit: -1,
                    isUnlimited: true,
                    canPerform: true
                }
            })),
            getCareStatus: jest.fn(() => ({
                dailyCare: { feedCount: 0, playCount: 0, restCount: 0 }
            }))
        };
        const manager = new CarePanelManager(scene, { careSystem });

        manager.init();
        manager.togglePanel();

        expect(manager.panelVisible).toBe(true);
        expect(manager.panelElements).toHaveLength(12);
        const closeButton = manager.panelElements[2];
        closeButton.handlers.pointerdown();
        expect(manager.panelVisible).toBe(false);

        const trackedElements = [...manager.panelElements];
        manager.destroy();
        trackedElements.forEach(element => {
            expect(element.destroy).toHaveBeenCalledTimes(1);
        });

        careSystem.getAllCareActionsInfo.mockReturnValue({
            feed: null,
            play: { icon: 'P', name: 'Play', currentCount: 0, limit: 2, canPerform: true },
            rest: null
        });
        const partialManager = new CarePanelManager(scene, { careSystem });
        expect(() => partialManager.init()).not.toThrow();
        expect(Object.keys(partialManager.careButtons)).toEqual(['play']);
        partialManager.destroy();
    });

    test('keeps the mission briefing preview local and non-mutating', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const sceneSource = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
        const previewBlock = sceneSource.match(
            /createMissionBriefingPreview\(\) \{[\s\S]*?\n    \}\n\n    initializeLifecycleTracking/
        )?.[0] || '';

        expect(gameSource).toContain("urlParams.get('testMissionBriefing')");
        expect(gameSource).toContain('missionBriefingPreview: testMissionBriefing');
        expect(previewBlock).toContain('showStoryMissionBriefing');
        expect(previewBlock).not.toContain('GameState');
        expect(previewBlock).not.toContain('QuestManager');
    });
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPlatformerLevelScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/PlatformerLevelScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const bossConfigs = require('../config/bosses.json');
    const transformed = source
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/ProjectBeaconStory\.js';/,
            'const queueProjectBeaconDebrief = window.queueProjectBeaconDebrief;\n' +
            'const unlockProjectBeaconMilestone = window.unlockProjectBeaconMilestone;'
        )
        .replace(
            /import \{\s*CENTERING_STANCE_DURATION_MS,[\s\S]*?\} from '\.\.\/systems\/SenseiMemory\.js';/,
            'const CENTERING_STANCE_DURATION_MS = 1250;\n' +
            'const getSenseiMemorySnapshot = () => ({ lesson: { status: "locked" } });\n' +
            'const recordCenteringStancePractice = () => ({ changed: false });'
        )
        .replace(
            "import bossConfigs from '../config/bosses.json';",
            'const bossConfigs = BOSS_CONFIG;'
        )
        .replace(
            "import { getCurrentRegionActionPresentation, recordCurrentRegionRestoration } from '../systems/CurrentEcology.js';",
            'const getCurrentRegionActionPresentation = () => null;\n' +
            'const recordCurrentRegionRestoration = window.recordCurrentRegionRestoration;'
        )
        .replace(
            "import { companionMediaService } from '../systems/CompanionMediaService.js';",
            'const companionMediaService = window.CompanionMediaService || {};'
        )
        .replace(
            "import { getVillageGameplayEffects, getVillageSupportSummary } from '../systems/VillageSettlement.js';",
            'const getVillageGameplayEffects = () => ({ maxEnergyBonus: 0, guardCharges: 0, victoryCoinBonus: 0 });\n' +
            'const getVillageSupportSummary = () => [];'
        )
        .replace(/^import .*$/gm, '')
        .replace(/export default PlatformerLevelScene;/, 'module.exports = PlatformerLevelScene;');

    class PhaserScene {
        constructor(config) {
            this.scene = { key: config?.key || 'PlatformerLevel' };
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        BOSS_CONFIG: bossConfigs,
        Phaser: { Scene: PhaserScene },
        Date,
        Math,
        JSON,
        Object,
        Array,
        Number,
        String,
        Boolean,
        RegExp,
        Set,
        Promise
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(initialState) {
    const state = JSON.parse(JSON.stringify(initialState));

    const get = jest.fn((propertyPath) => {
        return propertyPath.split('.').reduce((value, key) => value?.[key], state);
    });
    const set = jest.fn((propertyPath, value) => {
        const keys = propertyPath.split('.');
        const finalKey = keys.pop();
        const target = keys.reduce((current, key) => {
            current[key] = current[key] || {};
            return current[key];
        }, state);
        target[finalKey] = value;
    });

    return {
        state,
        get,
        set,
        save: jest.fn(),
        emit: jest.fn(),
        syncCanonicalCampaignGates: jest.fn()
    };
}

describe('PlatformerLevelScene completion progression', () => {
    let sceneWindow;
    let PlatformerLevelScene;
    let gameState;

    beforeEach(() => {
        sceneWindow = {
            queueProjectBeaconDebrief: jest.fn(),
            unlockProjectBeaconMilestone: jest.fn((_gameState, levelId) => (
                levelId === 'mythicalForest'
                    ? {
                        gateId: 'crystal_caves',
                        label: 'Crystal Caves',
                        newlyUnlocked: true
                    }
                    : null
            )),
            recordCurrentRegionRestoration: jest.fn(() => ({
                changed: true,
                regionId: 'aurora_depths',
                regionLabel: 'Aurora Depths',
                beforeVitality: 30,
                afterVitality: 80,
                summary: {
                    vitality: 38,
                    restoredCount: 1,
                    totalRegions: 6,
                    networkStatus: 'recovering'
                }
            }))
        };
        PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
        gameState = createGameState({
            stats: {
                levelsCompleted: 0,
                coinsCollected: 0
            },
            story: {
                projectBeacon: {
                    pendingDebriefs: [],
                    debriefsSeen: [],
                    expeditionCheckpoint: {
                        version: 1,
                        sceneKey: 'AuroraDepthsLevel',
                        levelId: 'aurora_depths_1',
                        checkpointId: 'aurora_prism_3',
                        checkpointIndex: 2,
                        x: 3680,
                        y: 770,
                        savedAt: Date.now()
                    }
                }
            },
            levels: {
                auroraDepths: {
                    entered: true,
                    completed: false,
                    bestTime: null
                }
            },
            creature: {
                bond: {
                    level: 1,
                    experience: 45,
                    levelsCompleted: 0,
                    totalInteractions: 0,
                    abilitySlots: {
                        slot1: true,
                        slot2: false,
                        slot3: false
                    }
                }
            },
            hubWorld: {
                shipParts: {
                    collected: []
                }
            },
            player: {
                cosmicCoins: 25
            }
        });

        sceneWindow.GameState = gameState;
        sceneWindow.ThoughtBubbleSystem = {
            recordSuccess: jest.fn()
        };
        sceneWindow.InventoryManager = {
            addShipPart: jest.fn((partId) => {
                const collected = gameState.get('hubWorld.shipParts.collected');
                if (collected.includes(partId)) {
                    return false;
                }
                gameState.set('hubWorld.shipParts.collected', [...collected, partId]);
                return true;
            })
        };
        sceneWindow.AchievementSystem = {
            recordEvent: jest.fn((eventName, data) => {
                if (eventName === 'level_completed') {
                    gameState.set(`levels.${data.levelId}.completed`, true);
                    if (data.noDamage) {
                        gameState.set(`levels.${data.levelId}.noDamageRun`, true);
                    }
                }
            })
        };
        sceneWindow.EconomyManager = {
            addCoins: jest.fn((amount) => {
                const newBalance = gameState.get('player.cosmicCoins') + amount;
                gameState.set('player.cosmicCoins', newBalance);
                const coinsCollected = gameState.get('stats.coinsCollected') || 0;
                gameState.set('stats.coinsCollected', coinsCollected + amount);
                return newBalance;
            })
        };
        sceneWindow.ProjectBeaconFieldKit = {
            installProjectBeaconKatanaUpgrade: jest.fn((state, upgradeId) => ({
                changed: true,
                upgrade: {
                    id: upgradeId,
                    name: upgradeId === 'aurora_guard'
                        ? 'Aurora Guard'
                        : 'Resonant Edge'
                }
            }))
        };
        sceneWindow.GuardianResidents = {
            recordGuardianRescue: jest.fn(() => ({
                changed: true,
                guardian: {
                    id: 'shadow_phoenix',
                    name: 'Aurora Phoenix',
                    role: 'Sky Sentinel',
                    routine: 'Surveys the Sanctuary sky',
                    futureAbility: 'Aurora Lift'
                }
            }))
        };
    });

    test('records reward, badge state, unique completion stats, and bond progress once per run', () => {
        const scene = new PlatformerLevelScene({
            key: 'AuroraDepthsLevel',
            levelId: 'aurora_depths_1'
        });
        scene.physics = { pause: jest.fn() };
        scene.player = { setVelocity: jest.fn() };
        scene.hidePlatformerMobileControls = jest.fn();
        scene.levelStartTime = Date.now() - 1000;
        scene.damageTaken = 0;

        const firstResult = scene.completeLevelProgression({
            achievementLevelId: 'auroraDepths',
            shipPartId: 'aurora_reactor',
            katanaUpgradeId: 'aurora_guard',
            speedrunThreshold: 300000
        });
        const secondResult = scene.completeLevelProgression({
            achievementLevelId: 'auroraDepths',
            shipPartId: 'aurora_reactor',
            katanaUpgradeId: 'aurora_guard',
            speedrunThreshold: 300000
        });

        expect(secondResult).toBe(firstResult);
        expect(firstResult).toEqual(expect.objectContaining({
            levelId: 'auroraDepths',
            shipPartId: 'aurora_reactor',
            shipPartAwarded: true,
            katanaUpgradeId: 'aurora_guard',
            katanaUpgradeAwarded: true,
            katanaUpgrade: expect.objectContaining({
                name: 'Aurora Guard'
            }),
            nextGateId: null,
            nextGateUnlocked: false,
            currentEcology: {
                changed: true,
                regionId: 'aurora_depths',
                regionLabel: 'Aurora Depths',
                beforeVitality: 30,
                afterVitality: 80,
                networkVitality: 38,
                restoredCount: 1,
                totalRegions: 6,
                networkStatus: 'recovering'
            },
            guardianResident: {
                id: 'shadow_phoenix',
                name: 'Aurora Phoenix',
                newlyRescued: true,
                role: 'Sky Sentinel',
                routine: 'Surveys the Sanctuary sky',
                futureAbility: 'Aurora Lift'
            },
            firstCompletion: true,
            noDamage: true,
            coinsAwarded: 1000
        }));
        expect(sceneWindow.EconomyManager.addCoins).toHaveBeenCalledTimes(1);
        expect(sceneWindow.EconomyManager.addCoins).toHaveBeenCalledWith(
            1000,
            'boss_victory:auroraDepths'
        );
        expect(gameState.get('player.cosmicCoins')).toBe(1025);
        expect(gameState.get('stats.coinsCollected')).toBe(1000);
        expect(sceneWindow.InventoryManager.addShipPart).toHaveBeenCalledTimes(1);
        expect(
            sceneWindow.ProjectBeaconFieldKit.installProjectBeaconKatanaUpgrade
        ).toHaveBeenCalledWith(
            gameState,
            'aurora_guard',
            { save: false }
        );
        expect(sceneWindow.recordCurrentRegionRestoration).toHaveBeenCalledWith(
            gameState,
            'auroraDepths',
            { save: false }
        );
        expect(sceneWindow.GuardianResidents.recordGuardianRescue)
            .toHaveBeenCalledWith(gameState, 'auroraDepths', { save: false });
        expect(scene.getGuardianSanctuaryArrivalCopy()).toBe(
            'SANCTUARY ARRIVAL // Aurora Phoenix\n' +
            'Sky Sentinel // Surveys the Sanctuary sky'
        );
        expect(scene.getGuardianSanctuaryArrivalCopy({ compact: true })).toBe(
            'Aurora Phoenix -> SANCTUARY // Sky Sentinel'
        );
        expect(sceneWindow.AchievementSystem.recordEvent).toHaveBeenCalledTimes(1);
        expect(sceneWindow.AchievementSystem.recordEvent).toHaveBeenCalledWith(
            'level_completed',
            expect.objectContaining({
                levelId: 'auroraDepths',
                noDamage: true,
                speedrunThreshold: 300000
            })
        );
        expect(gameState.get('levels.auroraDepths.completed')).toBe(true);
        expect(
            gameState.get('story.projectBeacon.expeditionCheckpoint')
        ).toBeNull();
        expect(gameState.get('levels.auroraDepths.bestTime')).toEqual(expect.any(Number));
        expect(gameState.get('stats.levelsCompleted')).toBe(1);
        expect(sceneWindow.queueProjectBeaconDebrief).toHaveBeenCalledWith(
            gameState,
            expect.objectContaining({
                levelId: 'auroraDepths',
                shipPartId: 'aurora_reactor'
            })
        );
        expect(
            sceneWindow.queueProjectBeaconDebrief.mock.calls[0][1]
        ).not.toHaveProperty('completionNumber');
        expect(sceneWindow.unlockProjectBeaconMilestone).toHaveBeenCalledWith(
            gameState,
            'auroraDepths'
        );
        expect(gameState.syncCanonicalCampaignGates).toHaveBeenCalledTimes(1);
        expect(gameState.get('creature.bond')).toEqual(expect.objectContaining({
            level: 2,
            experience: 55,
            levelsCompleted: 1,
            totalInteractions: 1
        }));
        expect(gameState.emit).toHaveBeenCalledWith('bondLevelUp', { level: 2 });
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(sceneWindow.ThoughtBubbleSystem.recordSuccess).toHaveBeenCalledWith('aurora_depths_1');
        expect(scene.physics.pause).toHaveBeenCalledTimes(1);
        expect(scene.player.setVelocity).toHaveBeenCalledWith(0, 0);
        expect(scene.hidePlatformerMobileControls).toHaveBeenCalledTimes(1);
        expect(scene.levelCompletionActive).toBe(true);
    });

    test('binds one keyboard return route for completion screens', () => {
        const scene = new PlatformerLevelScene({
            key: 'CrystalCavesLevel',
            levelId: 'crystal_caves_1'
        });
        scene.physics = { pause: jest.fn() };
        const returnAction = jest.fn();
        const listeners = new Map();
        sceneWindow.addEventListener = jest.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        });
        sceneWindow.removeEventListener = jest.fn();

        scene.bindLevelCompletionReturn(returnAction);
        const firstHandler = listeners.get('keydown');
        scene.bindLevelCompletionReturn(returnAction);
        const secondHandler = listeners.get('keydown');

        expect(scene.physics.pause).toHaveBeenCalledTimes(1);
        expect(sceneWindow.removeEventListener).toHaveBeenCalledWith(
            'keydown',
            firstHandler
        );

        const ignoredEvent = { key: 'x', preventDefault: jest.fn() };
        secondHandler(ignoredEvent);
        expect(returnAction).not.toHaveBeenCalled();

        const returnEvent = { key: 'Enter', preventDefault: jest.fn() };
        secondHandler(returnEvent);
        expect(returnEvent.preventDefault).toHaveBeenCalled();
        expect(returnAction).toHaveBeenCalledTimes(1);
    });

    test('does not unlock another route when replaying a completed level', () => {
        gameState.set('levels.auroraDepths.completed', true);
        gameState.set('stats.levelsCompleted', 1);

        const scene = new PlatformerLevelScene({
            key: 'AuroraDepthsLevel',
            levelId: 'aurora_depths_1'
        });
        const result = scene.completeLevelProgression({
            achievementLevelId: 'auroraDepths',
            shipPartId: 'aurora_reactor'
        });

        expect(sceneWindow.unlockProjectBeaconMilestone).not.toHaveBeenCalled();
        expect(sceneWindow.queueProjectBeaconDebrief).not.toHaveBeenCalled();
        expect(gameState.syncCanonicalCampaignGates).not.toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({
            firstCompletion: false,
            nextGateId: null,
            nextGateUnlocked: false,
            coinsAwarded: 1000
        }));
        expect(sceneWindow.EconomyManager.addCoins).toHaveBeenCalledWith(
            1000,
            'boss_victory:auroraDepths'
        );
    });

    test('unlocks the next milestone from the completed canonical level ID', () => {
        const scene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1'
        });

        const result = scene.completeLevelProgression({
            achievementLevelId: 'mythicalForest',
            shipPartId: 'forest_core'
        });

        expect(sceneWindow.queueProjectBeaconDebrief).toHaveBeenCalledWith(
            gameState,
            {
                levelId: 'mythicalForest',
                shipPartId: 'forest_core'
            }
        );
        expect(sceneWindow.unlockProjectBeaconMilestone).toHaveBeenCalledWith(
            gameState,
            'mythicalForest'
        );
        expect(result).toEqual(expect.objectContaining({
            nextGateId: 'crystal_caves',
            nextGateUnlocked: true
        }));
    });

    test('falls back to GameState when optional progression managers are unavailable', () => {
        sceneWindow.InventoryManager = null;
        sceneWindow.AchievementSystem = null;
        sceneWindow.EconomyManager = null;

        const scene = new PlatformerLevelScene({
            key: 'AuroraDepthsLevel',
            levelId: 'aurora_depths_1'
        });
        scene.levelStartTime = Date.now() - 1000;
        scene.damageTaken = 2;

        scene.completeLevelProgression({
            achievementLevelId: 'auroraDepths',
            shipPartId: 'aurora_reactor',
            speedrunThreshold: 300000
        });

        expect(gameState.get('hubWorld.shipParts.collected')).toEqual(['aurora_reactor']);
        expect(gameState.get('levels.auroraDepths.completed')).toBe(true);
        expect(gameState.get('levels.auroraDepths.noDamageRun')).toBeUndefined();
        expect(gameState.get('levels.auroraDepths.speedrun')).toBe(true);
        expect(gameState.get('player.cosmicCoins')).toBe(1025);
        expect(gameState.get('stats.coinsCollected')).toBe(1000);
    });

    test('preserves campaign progress when achievement processing fails', () => {
        sceneWindow.AchievementSystem.recordEvent.mockImplementation(() => {
            throw new Error('achievement fixture failed');
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const scene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1'
        });
        scene.levelStartTime = Date.now() - 1000;
        scene.damageTaken = 0;

        const result = scene.completeLevelProgression({
            achievementLevelId: 'mythicalForest',
            shipPartId: 'forest_core'
        });

        expect(result).toEqual(expect.objectContaining({
            firstCompletion: true,
            nextGateId: 'crystal_caves',
            nextGateUnlocked: true
        }));
        expect(gameState.get('levels.mythicalForest.completed')).toBe(true);
        expect(gameState.get('hubWorld.shipParts.collected')).toContain('forest_core');
        expect(gameState.get('stats.levelsCompleted')).toBe(1);
        expect(sceneWindow.queueProjectBeaconDebrief).toHaveBeenCalledWith(
            gameState,
            expect.objectContaining({ levelId: 'mythicalForest' })
        );
        expect(sceneWindow.unlockProjectBeaconMilestone).toHaveBeenCalledWith(
            gameState,
            'mythicalForest'
        );
        expect(gameState.save).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            '[PlatformerLevel] Achievement processing failed after level completion:',
            expect.any(Error)
        );
    });

    test('grants every configured boss reward and both collectible bonuses', () => {
        const rewards = [
            ['crystalCaves', 2, 700],
            ['cosmicReef', 0, 750],
            ['auroraDepths', 0, 1000],
            ['mythicalForest', 3, 900],
            ['voidPeaks', 0, 1500],
            ['finalVoid', 0, 2500]
        ];

        rewards.forEach(([achievementLevelId, rewardBonusCount, expectedCoins]) => {
            const scene = new PlatformerLevelScene({
                key: `${achievementLevelId}Scene`,
                levelId: achievementLevelId
            });
            const result = scene.completeLevelProgression({
                achievementLevelId,
                rewardBonusCount
            });

            expect(result.coinsAwarded).toBe(expectedCoins);
        });

        expect(sceneWindow.EconomyManager.addCoins.mock.calls).toEqual(
            rewards.map(([levelId, , coins]) => [
                coins,
                `boss_victory:${levelId}`
            ])
        );
    });

    test('keeps level modal geometry inside desktop and mobile viewports', () => {
        const scene = new PlatformerLevelScene();

        scene.cameras = { main: { width: 1280, height: 720 } };
        const desktop = scene.getLevelModalLayout({ maxWidth: 520, maxHeight: 480 });
        expect(desktop).toEqual(expect.objectContaining({
            isCompact: false,
            panelWidth: 520,
            panelHeight: 480,
            panelX: 380,
            panelY: 120,
            contentWidth: 440
        }));
        expect(desktop.y(240)).toBe(360);
        expect(desktop.font(30, 24)).toBe('30px');

        scene.cameras = { main: { width: 390, height: 844 } };
        const mobile = scene.getLevelModalLayout({ maxWidth: 520, maxHeight: 480 });
        expect(mobile.isCompact).toBe(true);
        expect(mobile.panelX).toBeGreaterThanOrEqual(0);
        expect(mobile.panelY).toBeGreaterThanOrEqual(0);
        expect(mobile.panelX + mobile.panelWidth).toBeLessThanOrEqual(390);
        expect(mobile.panelY + mobile.panelHeight).toBeLessThanOrEqual(844);
        expect(mobile.contentWidth).toBeLessThan(mobile.panelWidth);
        expect(mobile.font(30, 24)).toBe('24px');
        expect(mobile.buttonPadding).toEqual({ x: 16, y: 10 });
    });

    test('shrinks tall modals to a short viewport without crossing its edges', () => {
        const scene = new PlatformerLevelScene();
        scene.cameras = { main: { width: 844, height: 390 } };

        const layout = scene.getLevelModalLayout({ maxWidth: 520, maxHeight: 480 });

        expect(layout.isCompact).toBe(true);
        expect(layout.panelY).toBeGreaterThanOrEqual(0);
        expect(layout.panelY + layout.panelHeight).toBeLessThanOrEqual(390);
        expect(layout.y(480)).toBeCloseTo(layout.panelY + layout.panelHeight);
    });
});

describe('local level-entry preview route', () => {
    test('starts previews explicitly and prevents entry achievements', () => {
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const hatchingSource = fs.readFileSync(path.join(__dirname, '../scenes/HatchingScene.js'), 'utf8');
        const levelFiles = [
            'CrystalCavesLevel.js',
            'ReefLevel.js',
            'MythicalForestLevel.js',
            'VoidPeaksLevel.js',
            'AuroraDepthsLevel.js',
            'FinalVoidLevel.js'
        ];

        expect(gameSource).toContain("urlParams.get('testLevelEntry')");
        expect(gameSource).toMatch(
            /game\.scene\.start\(sceneName,\s*\{\s*entryPreview: true,\s*forceMobileControls,\s*katanaPreview,\s*platformerPreviewSize:/
        );
        expect(hatchingSource).toContain("previewParams.has('testLevelEntry')");

        levelFiles.forEach((fileName) => {
            const source = fs.readFileSync(path.join(__dirname, '../scenes/levels', fileName), 'utf8');
            expect(source).toContain('this.bindLevelCompletionReturn(');
            expect(source).toContain('this.levelCompletionActive');
            if (fileName === 'FinalVoidLevel.js') {
                expect(source).toMatch(
                    /!this\.entryPreview &&\s*!this\.resultPreview &&\s*window\.AchievementSystem\?\.recordEvent/
                );
            } else {
                expect(source).toContain(
                    'if (!this.entryPreview && window.AchievementSystem?.recordEvent)'
                );
            }
        });
    });
});

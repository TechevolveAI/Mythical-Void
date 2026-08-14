const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPlatformerLevelScene(sceneWindow = {}) {
    const filePath = path.join(__dirname, '../scenes/PlatformerLevelScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            /import \{[\s\S]*?\} from '\.\.\/systems\/ProjectBeaconStory\.js';/,
            'const queueProjectBeaconDebrief = () => null;\n' +
            'const unlockProjectBeaconMilestone = () => null;'
        )
        .replace(
            /import \{\s*CENTERING_STANCE_DURATION_MS,[\s\S]*?\} from '\.\.\/systems\/SenseiMemory\.js';/,
            'const CENTERING_STANCE_DURATION_MS = 1250;\n' +
            'const getSenseiMemorySnapshot = () => ({ lesson: { status: "locked" } });\n' +
            'const recordCenteringStancePractice = () => ({ changed: false });'
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
        Phaser: { Scene: PhaserScene },
        Date,
        Math,
        Set,
        Promise
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('first expedition rescue loop', () => {
    test('batches Forest ambient lights into a bounded mobile render budget', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('this.forestAmbientLayers = [];');
        expect(source).toContain('const pointsPerLayer = 10;');
        expect(source).toContain('for (let layerIndex = 0; layerIndex < 3; layerIndex += 1)');
        expect(source).toContain('this.forestFoliageLayer = this.add.graphics().setDepth(35);');
        expect(source).toContain('const foliageGlow = this.forestFoliageLayer;');
        expect(source).toContain('targets: this.forestFoliageLayer');
        expect(source).toContain('3 + ((treeIndex * 7 + i * 5) % 3)');
        expect(source).toContain('this.createBioluminescentOrbs(');
        expect(source).toContain('this.tweens?.killTweensOf?.(layer);');
        expect(source).not.toContain('this.magicMotes.push(');
    });

    test('creates subclass level content exactly once per scene run', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1'
        });
        scene.createLevelContent = jest.fn();

        expect(scene.createLevelSpecificContentOnce()).toBe(true);
        expect(scene.createLevelSpecificContentOnce()).toBe(false);
        expect(scene.createLevelContent).toHaveBeenCalledTimes(1);
    });

    test('Forest and Aurora entry dismissals use the idempotent content hook', () => {
        const levels = ['MythicalForestLevel.js', 'AuroraDepthsLevel.js'];

        levels.forEach(fileName => {
            const source = fs.readFileSync(
                path.join(__dirname, '../scenes/levels', fileName),
                'utf8'
            );
            const startLevel = source.match(
                /startLevel\(\)\s*\{([\s\S]*?)\n    \}/
            )?.[1] || '';

            expect(startLevel).toContain('this.createLevelSpecificContentOnce()');
            expect(startLevel).not.toContain('this.createLevelContent()');
        });
    });

    test('restores health, energy, input, and position at an activated beacon', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'MythicalForestLevel' });
        scene.checkpointPosition = { x: 1770, y: 1000 };
        scene.health = 0;
        scene.crystalEnergy = 0;
        scene.isPlayerDead = true;
        scene.player = {
            setPosition: jest.fn(),
            setVelocity: jest.fn(),
            setAlpha: jest.fn(),
            setScale: jest.fn(),
            clearTint: jest.fn(),
            body: { enable: false }
        };
        scene.input = { keyboard: { enabled: false } };
        scene.physics = { resume: jest.fn() };
        scene.time = { delayedCall: jest.fn() };
        scene.clearDeathScreen = jest.fn();
        scene.updateHealthDisplay = jest.fn();
        scene.updateEnergyDisplay = jest.fn();
        scene.startInvincibilityFlash = jest.fn();
        scene.showFloatingText = jest.fn();
        scene.showPlatformerMobileControls = jest.fn();

        scene.retryFromCheckpoint();

        expect(scene.player.setPosition).toHaveBeenCalledWith(1770, 1000);
        expect(scene.health).toBe(scene.maxHealth);
        expect(scene.crystalEnergy).toBe(scene.maxCrystalEnergy);
        expect(scene.isPlayerDead).toBe(false);
        expect(scene.input.keyboard.enabled).toBe(true);
        expect(scene.player.body.enable).toBe(true);
        expect(scene.physics.resume).toHaveBeenCalledTimes(1);
        expect(scene.showPlatformerMobileControls).toHaveBeenCalledTimes(1);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'PROJECT BEACON LINK RESTORED',
            1770,
            940,
            '#8FE3CF'
        );
    });

    test('lets the companion prevent one otherwise lethal expedition fall', () => {
        const agencyResult = {
            changed: true,
            decision: {
                powerName: 'Solar Shelter'
            },
            profile: {
                color: 0xFFD54F
            }
        };
        const sceneWindow = {
            GameState: {},
            CreatureAgency: {
                attemptAutonomousRescue: jest.fn(() => agencyResult)
            }
        };
        const PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
        const scene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1'
        });
        scene.health = 1;
        scene.isRespawning = false;
        scene.updateHealthDisplay = jest.fn();
        scene.respawnAtCheckpoint = jest.fn(() => {
            scene.isRespawning = false;
        });
        scene.showAutonomousRescueMoment = jest.fn();
        scene.onPlayerDeath = jest.fn();

        scene.onPitFall();

        expect(
            sceneWindow.CreatureAgency.attemptAutonomousRescue
        ).toHaveBeenCalledWith(sceneWindow.GameState, {
            levelId: 'mythical_forest_1',
            trigger: 'lethal_fall',
            commit: true
        });
        expect(scene.health).toBe(1);
        expect(scene.damageTaken).toBe(1);
        expect(scene.respawnAtCheckpoint).toHaveBeenCalledTimes(1);
        expect(scene.showAutonomousRescueMoment).toHaveBeenCalledWith(
            agencyResult
        );
        expect(scene.onPlayerDeath).not.toHaveBeenCalled();
    });

    test('persists and restores a versioned Project Beacon route checkpoint', () => {
        const state = {
            story: {
                projectBeacon: {
                    expeditionCheckpoint: null
                }
            }
        };
        const gameState = {
            get: jest.fn(path => path.split('.').reduce(
                (value, key) => value?.[key],
                state
            )),
            set: jest.fn((path, value) => {
                state.story.projectBeacon.expeditionCheckpoint = value;
            }),
            save: jest.fn()
        };
        const PlatformerLevelScene = loadPlatformerLevelScene({ GameState: gameState });
        const firstScene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            levelWidth: 8000,
            levelHeight: 1200
        });

        firstScene.setCheckpoint(1770, 1000, {
            persist: true,
            checkpointId: 'forest_anchor_1',
            checkpointIndex: 0
        });

        expect(state.story.projectBeacon.expeditionCheckpoint).toEqual({
            version: 1,
            sceneKey: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            checkpointId: 'forest_anchor_1',
            checkpointIndex: 0,
            x: 1770,
            y: 1000,
            savedAt: expect.any(Number)
        });
        expect(gameState.save).toHaveBeenCalledTimes(1);

        const resumedScene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            levelWidth: 8000,
            levelHeight: 1200
        });
        resumedScene.player = {
            setPosition: jest.fn(),
            setVelocity: jest.fn()
        };
        resumedScene.restoreExpeditionRouteState = jest.fn(() => true);

        expect(resumedScene.restorePersistedExpeditionCheckpoint()).toBe(true);
        expect(resumedScene.restoreExpeditionRouteState).toHaveBeenCalledWith(
            expect.objectContaining({ checkpointId: 'forest_anchor_1' })
        );
        expect(resumedScene.player.setPosition).toHaveBeenCalledWith(1770, 1000);
        expect(resumedScene.checkpointPosition).toEqual({
            x: 1770,
            y: 1000,
            id: 'forest_anchor_1',
            index: 0
        });
        expect(resumedScene.checkpointResumeApplied).toBe(true);
    });

    test('exposes the restored signal name for the expedition briefing', () => {
        const checkpoint = {
            version: 1,
            sceneKey: 'MythicalForestLevel',
            levelId: 'mythical_forest_1',
            checkpointId: 'forest_anchor_2',
            checkpointIndex: 1,
            x: 3570,
            y: 1000,
            savedAt: Date.now()
        };
        const PlatformerLevelScene = loadPlatformerLevelScene({
            GameState: {
                get: jest.fn(pathName => {
                    if (
                        pathName ===
                        'story.projectBeacon.expeditionCheckpoint'
                    ) {
                        return checkpoint;
                    }
                    return false;
                })
            }
        });
        const scene = new PlatformerLevelScene({
            key: 'MythicalForestLevel',
            levelId: 'mythical_forest_1'
        });
        scene.checkpointResumeApplied = true;

        expect(scene.getExpeditionResumePresentation()).toEqual({
            checkpointId: 'forest_anchor_2',
            label: 'Crown Path',
            current: 2,
            total: 3
        });
    });

    test('restores only the contiguous route signals through the saved anchor', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ReefLevel' });
        const signals = Array.from({ length: 3 }, (_, index) => ({
            id: `reef_waypoint_${index + 1}`,
            activated: false,
            zone: { destroy: jest.fn() },
            label: { setColor: jest.fn() }
        }));
        const drawSignal = jest.fn();

        const restored = scene.restoreExpeditionRouteSignals({
            checkpointId: 'reef_waypoint_2',
            checkpointIndex: 1
        }, {
            signals,
            countProperty: 'beaconAnchorsActivated',
            readyProperty: 'reefRouteAligned',
            drawSignal
        });

        expect(restored).toBe(true);
        expect(signals.map(signal => signal.activated)).toEqual([true, true, false]);
        expect(scene.beaconAnchorsActivated).toBe(2);
        expect(scene.reefRouteAligned).toBe(false);
        expect(drawSignal).toHaveBeenCalledTimes(2);
        expect(signals[0].zone).toBeNull();
        expect(signals[1].zone).toBeNull();
        expect(signals[2].zone).not.toBeNull();
    });

    test('all six expeditions persist stable route signals and restore gate state', () => {
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

            expect(source).toContain('persist: true');
            expect(source).toContain('checkpointId:');
            expect(source).toContain('checkpointIndex:');
            expect(source).toContain('restoreExpeditionRouteState(resume)');
            expect(source).toContain('readyProperty:');
        });
    });

    test('provides a local QA route through the production checkpoint restore path', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "urlParams.get('testCheckpointResume')"
        );
        expect(gameSource).toContain(
            "sceneKey: 'MythicalForestLevel'"
        );
        expect(gameSource).toContain(
            "'story.projectBeacon.expeditionCheckpoint'"
        );
        expect(gameSource).toContain('game.scene.start(preview.sceneKey)');
        expect(gameSource).not.toContain(
            "game.scene.start(preview.sceneKey, { checkpointResumePreview: true })"
        );
    });

    test('disables invisible touch targets and restores them with the controls', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'MythicalForestLevel' });
        const control = {
            input: { enabled: true },
            setAlpha: jest.fn()
        };
        scene.isMobile = true;
        scene.mobileControlElements = [control];

        scene.hidePlatformerMobileControls();

        expect(control.setAlpha).toHaveBeenLastCalledWith(0);
        expect(control.input.enabled).toBe(false);
        expect(scene.platformerControlsVisible).toBe(false);

        scene.showPlatformerMobileControls();

        expect(control.setAlpha).toHaveBeenLastCalledWith(1);
        expect(control.input.enabled).toBe(true);
        expect(scene.platformerControlsVisible).toBe(true);
    });

    test('places three authored Beacon anchors across Mythical Forest', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain("id: 'forest_anchor_1'");
        expect(source).toContain("id: 'forest_anchor_2'");
        expect(source).toContain("id: 'forest_anchor_3'");
        expect(source).toContain('x: 1770');
        expect(source).toContain('x: 3570');
        expect(source).toContain('x: 5300');
        expect(source).toContain("activationSupportIds: ['forest-ground-3']");
        expect(source).toContain("activationSupportIds: ['forest-ground-5']");
        expect(source).toContain("activationSupportIds: ['forest-ground-6']");
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain('this.createTraversalLandingGuide(');
        expect(source).toContain('this.retireTraversalLandingGuide(checkpoint);');
        expect(source).toContain(
            'this.setCheckpoint(supportCheckpoint.x, supportCheckpoint.y, {'
        );
        expect(source).toContain('checkpointId: checkpoint.id');
        expect(source).toContain('PROJECT BEACON ANCHOR ${anchorNumber}/3');
    });

    test('keeps Beacon anchors local and ordered while gating the guardian on alignment', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const checkpoints = source.match(
            /createBeaconCheckpoints\(\)\s*\{([\s\S]*?)\n    \}\n\n    drawBeaconCheckpoint/
        )?.[1] || '';
        const bossArena = source.match(
            /createBossArena\(\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Start the Elder/
        )?.[1] || '';

        expect(checkpoints).toContain('this.createObjectiveTriggerZone(');
        expect(checkpoints).toContain('{ width: 150, height: 280 }');
        expect(checkpoints).toContain('this.refreshForestRouteReadability();');
        expect(source).toContain('this.canActivateOrderedRouteSignal(');
        expect(source).toContain('this.beaconAnchorsActivated++');
        expect(source).toContain('this.forestRouteAligned = true');
        expect(bossArena).toContain('if (!this.forestRouteAligned)');
        expect(bossArena).toContain('Align the Beacon anchors.');
        expect(bossArena).toContain('const guardianGateX = 5520;');
        expect(bossArena).toContain('this.levelHeight / 2');
        expect(bossArena).not.toContain('triggerZone.destroy()');
        expect(source).toContain('this.bossTriggerZone?.destroy?.()');
    });

    test('keeps live forest objectives visible without covering compact combat', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('getForestObjectiveText()');
        expect(source).toContain(
            'this.isMobile || width <= 480 || height < 620'
        );
        expect(source).toContain(
            'isShortLandscape ? 76 : 72'
        );
        expect(source).toContain('FOLLOW THE CURRENT →');
        expect(source).toContain('ROUTE ${current}/3 // ${nextAnchor}');
        expect(source).toContain('STRIKE THE PURPLE CORRUPTION');
        expect(source).toContain('OPTIONAL // STAR FRAGMENTS ${this.starFragmentsCollected}/${this.totalStarFragments}');
        expect(source).toContain(
            '!(this.isCompactObjectiveHUD && this.bossFightActive)'
        );
    });

    test('keeps authored void gaps physical and restores touch controls after entry', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const createPlatforms = source.match(
            /createPlatforms\(\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';
        const startLevel = source.match(
            /startLevel\([^)]*\)\s*\{([\s\S]*?)\n    \}/
        )?.[1] || '';

        expect(createPlatforms).toContain('this.physics.add.staticGroup()');
        expect(createPlatforms).not.toContain('super.createPlatforms');
        expect(startLevel).toContain('this.showPlatformerMobileControls()');
    });

    test('runs a save-backed, input-verified field drill before first combat', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const drillSource = fs.readFileSync(
            path.join(__dirname, '../systems/FirstExpeditionDrill.js'),
            'utf8'
        );

        expect(source).toContain('startFirstExpeditionDrill');
        expect(source).toContain("advanceFirstExpeditionDrill('move')");
        expect(source).toContain("advanceFirstExpeditionDrill('jump')");
        expect(source).toContain("advanceFirstExpeditionDrill('melee')");
        expect(drillSource).toContain('EARTH-FORGED FIELD KATANA');
        expect(drillSource).toContain('TAP JUMP (UP ARROW)');
        expect(drillSource).toContain('TAP KATANA (CROSSED BLADES)');
        expect(source).toContain("answers the astronaut's katana stance");
        expect(source).toContain('KATANA STRIKE // HOLD THE STANCE');
        expect(source).toContain('!drill.katanaStrikePending');
        expect(source).toContain('this.time.delayedCall(220');
        expect(source).toContain('const knotInRange = Boolean(');
        expect(source).toContain(
            'targetXOverride: knotInRange ? drillKnot.x : null'
        );
        expect(source).toContain(
            'targetYOverride: knotInRange ? drillKnot.y : null'
        );
        expect(source).toContain("step.action === 'move' ? 'joystick' : step.action");
        expect(source).toContain('this.showMobileControlCoach?.(');
        expect(source).toContain('POWER WITNESSED');
        expect(source).toContain(
            'companionName: getFirstExpeditionCompanionName('
        );
        expect(source).toContain('window.GameState.save?.()');
    });

    test('uses the named companion throughout the first expedition framing', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain(
            '"${companionName} hears a living path through the roots"'
        );
        expect(source).toContain(
            '`${companionName}: "Rootway locked. We can return here."`'
        );
        expect(source).toContain(
            '`${companionName}: "The Current is stronger. Keep going."`'
        );
        expect(source).toContain(
            '`${companionName}: "The guardian hears us. Stay close."`'
        );
        expect(source).toContain(
            "`${companionName} answers the astronaut's katana stance with `"
        );
        expect(source).toContain(
            '!this.firstExpeditionDrill?.panelVisible'
        );
    });

    test('keeps the first guardian rescue shorter than later endurance fights', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('this.bossMaxHealth = 12;');
        expect(source).toContain('STRIKE PURPLE CORRUPTION // FREE THE GUARDIAN');
        expect(source).toContain('ELDER TREANT RESTORED');
        expect(source).toContain('ELDER TREANT // TRAPPED');
        expect(source).toContain(
            'VOID CORRUPTION // ${corruptionRemaining}/${this.bossMaxHealth}'
        );
        expect(source).toContain('VOID CORRUPTION // CLEARED');
        expect(source).toContain('`CORRUPTION -${finalAmount}`');
    });

    test('holds each guardian attack lock through its full hazard window', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const attackSource = source.match(
            /executeBossAttack\(attackType\)\s*\{([\s\S]*?)\n    \}\n\n    showBossAttackInstruction/
        )?.[1] || '';

        expect(source).toContain('root_slam: 1700');
        expect(source).toContain('vine_whip: 1500');
        expect(source).toContain('spore_cloud: 3600');
        expect(source).toContain('nature_fury: 4800');
        expect(attackSource).toContain(
            'FOREST_GUARDIAN_ATTACK_WINDOWS[attackType]'
        );
        expect(attackSource).toContain('this.boss.isAttacking = true');
        expect(attackSource).toContain(
            'pacing.windup + attackWindow + pacing.recovery'
        );
        expect(attackSource).toContain('this.boss.isAttacking = false');
    });

    test('names the safe response for every first-guardian hazard', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('ROOTS RISING // JUMP');
        expect(source).toContain('VINE WHIP // MOVE BEHIND IT');
        expect(source).toContain('SPORE CLOUD // LEAVE THE CIRCLE');
        expect(source).toContain('FALLING LEAVES // KEEP MOVING');
        expect(source).toContain('showBossAttackInstruction(');
        expect(source).toContain(
            'STRIKE PURPLE CORRUPTION // FREE THE GUARDIAN'
        );
    });

    test('makes the first forest entry keyboard accessible and single-fire', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );
        const entrySource = source.match(
            /showLevelEntry\(\)\s*\{([\s\S]*?)\n    \}\n\n    clearLevelEntryKeyHandler/
        )?.[1] || '';

        expect(entrySource).toContain("['Enter', ' '].includes(event.key)");
        expect(entrySource).toContain(
            "window.addEventListener('keydown', this.levelEntryKeyHandler)"
        );
        expect(entrySource).toContain('if (this.levelEntryDismissing)');
        expect(entrySource).toContain('this.levelEntryDismissing = true');
        expect(entrySource).toContain('enterBtn.disableInteractive()');
        expect(entrySource).toContain('overlay.disableInteractive()');
        expect(source).toMatch(
            /shutdown\(\)[\s\S]*this\.clearLevelEntryKeyHandler\(\)/
        );
    });

    test('supports a non-mutating touch-control preview for mobile QA', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "const expeditionDrillPreview = urlParams.get('testExpeditionDrill')"
        );
        expect(gameSource).toContain("'power-mobile'");
        expect(gameSource).toContain('forceMobileControls');
        expect(gameSource).toContain("companionNamePreview: 'Nova'");
        expect(platformerSource).toContain(
            'if (this.forceMobileControls)'
        );
        expect(gameSource).toContain("'checkpoint', 'restart', 'agency'");
        expect(gameSource).toContain(
            "urlParams.get('forceMobileControls') === '1'"
        );
        expect(platformerSource).toContain(
            "this.recoveryPreview === 'agency'"
        );
        expect(platformerSource).toMatch(
            /this\.recoveryPreview === 'agency'[\s\S]*this\.showPlatformerMobileControls\(\)/
        );
    });

    test('defines a dedicated parallax palette for Mythical Forest', () => {
        const biomes = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/biomes.json'),
            'utf8'
        ));

        expect(biomes.mythical_forest).toBeDefined();
        expect(biomes.mythical_forest.id).toBe('mythical_forest');
        expect(biomes.mythical_forest.layers.nebulaBackground).toBeDefined();
        expect(biomes.mythical_forest.layers.crystalFlora.bioluminescence).toBe(true);
    });

    test('frames the first guardian encounter as rescue rather than killing', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('Free the guardian and recover the Forest Core');
        expect(source).toContain('STRIKE PURPLE CORRUPTION // FREE THE GUARDIAN');
        expect(source).toContain('THE GUARDIAN IS IN PAIN');
        expect(source).toContain('ELDER TREANT RESTORED');
        expect(source).toContain("Guardian's Gift: Forest Core");
        expect(source).not.toContain(
            'showDamageNumber(this.boss.x, this.boss.y - 80, amount, false)'
        );
        expect(source).not.toContain('ELDER TREANT DEFEATED');
    });

    test('keeps boss and guardian QA routes local to development', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(gameSource).toContain('if (isLocalPreview && testBoss)');
        expect(gameSource).toContain('bossAttackPreview: [');
        expect(gameSource).toContain("urlParams.get('testAttack')");
        expect(gameSource).toContain('platformerPreviewSize:');
        expect(gameSource).toContain("urlParams.get('previewSize') === 'mobile'");
        expect(hatchingSource).toMatch(
            /if \(\s*isLocalPreview &&\s*\([\s\S]*previewParams\.has\('testBoss'\)/
        );
    });

    test('preserves the responsive corruption bar layout after boss damage', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(source).toContain('this.bossBarLayout = { barX, barY, barWidth, barHeight }');
        expect(source).toContain('const layout = this.bossBarLayout ||');
        expect(source).toContain('const barY = isMobileLayout ? 118 : 55');
        expect(source).toContain('barWidth = barWidth ?? layout.barWidth');
        expect(source).not.toContain('barWidth = barWidth || 350');
    });
});

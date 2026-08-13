const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCENES_DIR = path.join(__dirname, '../scenes');

function read(relativePath) {
    return fs.readFileSync(path.join(SCENES_DIR, relativePath), 'utf8');
}

function loadPlatformerLevelScene() {
    const filePath = path.join(SCENES_DIR, 'PlatformerLevelScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
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
        .replace(
            /export default PlatformerLevelScene;/,
            'module.exports = PlatformerLevelScene;'
        );

    class PhaserScene {
        constructor(config) {
            this.scene = { key: config?.key || 'PlatformerLevel' };
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        window: {},
        Phaser: {
            Scene: PhaserScene,
            Math: {
                Clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
                Distance: {
                    Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
                }
            }
        },
        Date,
        Math,
        Set,
        Promise,
        Number,
        Array,
        Object
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('campaign traversal quality contracts', () => {
    test('authored movement survives a scene reset', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'TraversalTest',
            movement: {
                gravityY: 150,
                playerSpeed: 220,
                jumpVelocity: -460,
                playerAcceleration: 0.22,
                playerDeceleration: 0.68,
                coyoteTime: 150,
                jumpBufferTime: 150
            }
        });

        scene.playerSpeed = 1;
        scene.jumpVelocity = -1;
        scene.applyMovementProfile();

        expect(scene.gravityY).toBe(150);
        expect(scene.playerSpeed).toBe(220);
        expect(scene.jumpVelocity).toBe(-460);
        expect(scene.playerAcceleration).toBe(0.22);
        expect(scene.coyoteTime).toBe(150);
    });

    test('vertical joystick input is exposed only for two-axis levels', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const createThumb = () => ({
            clear: jest.fn(),
            fillStyle: jest.fn(),
            fillCircle: jest.fn(),
            lineStyle: jest.fn(),
            strokeCircle: jest.fn(),
            fillTriangle: jest.fn()
        });
        const scene = new PlatformerLevelScene({ key: 'TwoAxisInputTest' });
        scene.joystickCenterX = 100;
        scene.joystickCenterY = 100;
        scene.joystickMaxDistance = 100;
        scene.joystickThumbRadius = 20;
        scene.joystickThumb = createThumb();

        scene.updateJoystick({ x: 100, y: 0 });
        expect(scene.virtualJoystickY).toBe(0);

        scene.usesVerticalJoystick = true;
        scene.updateJoystick({ x: 100, y: 0 });
        expect(scene.virtualJoystickX).toBeCloseTo(0, 5);
        expect(scene.virtualJoystickY).toBe(-1);
    });

    test('Cosmic Reef keeps shared recovery while adding deliberate mobile descent', () => {
        const source = read('levels/ReefLevel.js');
        const updateBody = source.match(
            /update\(time, delta\)\s*\{([\s\S]*?)\n    \}\n\n    \/\*\*/
        )?.[1] || '';

        expect(source).toContain('this.usesVerticalJoystick = true;');
        expect(source).toContain('this.virtualJoystickY < -0.2');
        expect(source).toContain('this.virtualJoystickY > 0.2');
        expect(source).toContain('Down is deliberate descent in the Reef');
        expect(updateBody).toContain('super.update(time, delta);');
        expect(updateBody).not.toContain('this.handleMovement();');
        expect(updateBody).not.toContain('this.handleJump();');
    });

    test('stomps and side contact are classified consistently', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'CombatContactTest' });
        const enemy = {
            active: true,
            body: { center: { y: 200 }, top: 175, height: 50 }
        };

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 150 },
                bottom: 180,
                velocity: { y: 80 }
            }
        }, enemy)).toBe('stomp');

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 205 },
                bottom: 235,
                velocity: { y: 0 }
            }
        }, enemy)).toBe('contact');
    });

    test('a fast low-frame descent still resolves as a stomp after deep overlap', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'SweptStompTest' });
        const enemy = {
            active: true,
            body: {
                center: { y: 200 },
                top: 175,
                height: 50,
                prev: { y: 175 }
            }
        };

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 195 },
                bottom: 225,
                height: 60,
                prev: { y: 95 },
                velocity: { y: 760 }
            }
        }, enemy)).toBe('stomp');
    });

    test('collision normals preserve edge stomps but upward contact remains harmful', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ContactNormalTest' });
        const enemy = {
            active: true,
            body: {
                center: { y: 200 },
                top: 175,
                height: 50,
                touching: { up: true }
            }
        };

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 190 },
                bottom: 220,
                height: 60,
                velocity: { y: 120 },
                touching: { down: true }
            }
        }, enemy)).toBe('stomp');

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 150 },
                bottom: 180,
                height: 60,
                prev: { y: 120 },
                velocity: { y: -220 },
                touching: { down: true }
            }
        }, enemy)).toBe('contact');
    });

    test('a side collision does not become a stomp because bodies overlap deeply', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'SideContactTest' });
        const enemy = {
            active: true,
            body: {
                center: { y: 200 },
                top: 175,
                height: 50,
                prev: { y: 175 },
                touching: { up: false }
            }
        };

        expect(scene.classifyEnemyContact({
            body: {
                center: { y: 205 },
                bottom: 235,
                height: 60,
                prev: { y: 175 },
                velocity: { y: 15 },
                touching: { down: false }
            }
        }, enemy)).toBe('contact');
    });

    test('armored enemy stomps apply the authored damage once per contact', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ArmoredStompTest' });
        const player = {
            active: true,
            x: 100,
            y: 130,
            body: {
                center: { y: 150 },
                bottom: 180,
                velocity: { y: 80 }
            },
            setVelocityY: jest.fn()
        };
        const enemy = {
            active: true,
            x: 100,
            y: 200,
            health: 3,
            stompDamage: 1,
            body: { center: { y: 200 }, top: 175, height: 50 }
        };
        scene.time = { now: 1000 };
        scene.jumpVelocity = -460;
        scene.damageEnemy = jest.fn(target => {
            target.health -= 1;
            return true;
        });
        scene.showFloatingText = jest.fn();

        expect(scene.resolveEnemyContact(player, enemy)).toBe('stomp');
        expect(scene.damageEnemy).toHaveBeenCalledWith(enemy, 1);
        expect(player.setVelocityY).toHaveBeenCalledWith(-285.2);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'STOMP · 2 HITS LEFT',
            100,
            164,
            '#F2C94C'
        );

        expect(scene.resolveEnemyContact(player, enemy)).toBe('ignored');
        expect(scene.damageEnemy).toHaveBeenCalledTimes(1);
    });

    test('a decisive stomp reports that the enemy was cleared', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ClearStompTest' });
        const player = {
            active: true,
            body: {
                center: { y: 150 },
                bottom: 180,
                velocity: { y: 80 }
            },
            setVelocityY: jest.fn()
        };
        const enemy = {
            active: true,
            x: 100,
            y: 200,
            health: 1,
            body: { center: { y: 200 }, top: 175, height: 50 }
        };
        scene.time = { now: 1000 };
        scene.jumpVelocity = -460;
        scene.damageEnemy = jest.fn(target => {
            target.health = 0;
            target.active = false;
            return true;
        });
        scene.showFloatingText = jest.fn();

        expect(scene.resolveEnemyContact(player, enemy)).toBe('stomp');
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'STOMP CLEAR',
            100,
            164,
            '#8FE3CF'
        );
    });

    test('an immune stomp reports that no damage landed', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'BlockedStompTest' });
        const player = {
            active: true,
            body: {
                center: { y: 150 },
                bottom: 180,
                velocity: { y: 80 }
            },
            setVelocityY: jest.fn()
        };
        const enemy = {
            active: true,
            x: 100,
            y: 200,
            health: 1,
            body: { center: { y: 200 }, top: 175, height: 50 }
        };
        scene.time = { now: 1000 };
        scene.jumpVelocity = -460;
        scene.damageEnemy = jest.fn(() => false);
        scene.showFloatingText = jest.fn();

        expect(scene.resolveEnemyContact(player, enemy)).toBe('stomp');
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'STOMP BLOCKED',
            100,
            164,
            '#FF6B6B'
        );
    });

    test('the physics world includes fall space before pit recovery', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('this.levelHeight + this.pitRecoveryDepth');
        expect(source).toContain('this.pitRecoveryDepth - 60');
        expect(source).not.toContain('const fallThreshold = this.levelHeight + 200');
    });

    test('runtime platform traversal identifies reachable and disconnected targets', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'TraversalGraphTest',
            movement: {
                gravityY: 500,
                playerSpeed: 200,
                jumpVelocity: -450
            }
        });
        scene.levelHeight = 800;
        scene.player = { x: 100, body: { bottom: 750 } };
        scene.platforms = {
            getChildren: () => [
                { body: { left: 0, right: 400, top: 750, bottom: 830 } },
                { body: { left: 520, right: 700, top: 620, bottom: 648 } },
                { body: { left: 1200, right: 1400, top: 400, bottom: 428 } }
            ]
        };

        const audit = scene.getPlatformTraversalAudit({
            targets: [
                { id: 'reachable_signal', x: 600, y: 620 },
                { id: 'disconnected_gate', x: 1300, y: 400 }
            ]
        });

        expect(audit.platformCount).toBe(3);
        expect(audit.reachablePlatformCount).toBe(2);
        expect(audit.targets[0].reachable).toBe(true);
        expect(audit.unreachableTargets).toEqual(['disconnected_gate']);
    });

    test.each([
        'levels/MythicalForestLevel.js',
        'levels/CrystalCavesLevel.js',
        'levels/ReefLevel.js',
        'levels/VoidPeaksLevel.js',
        'levels/AuroraDepthsLevel.js',
        'levels/FinalVoidLevel.js'
    ])('%s uses localized objective triggers', (relativePath) => {
        const source = read(relativePath);

        expect(source).toContain('this.createObjectiveTriggerZone(');
    });

    test('Forest has deterministic connector geometry and forward boss staging', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain('const branchLength = 96 +');
        expect(source).toContain('{ x1: 3000, x2: 3260');
        expect(source).toContain('{ x1: 3260, x2: 3500');
        expect(source).toContain('{ x1: 3800, x2: 4050');
        expect(source).toContain('{ x1: 4050, x2: 4300');
        expect(source).toContain("const spawnX = this.testMode ? width / 2 + 200 : 5900;");
    });

    test('Forest names and closes both route-critical bridge handoffs', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain("id: 'forest-tree-3-handoff'");
        expect(source).toContain('x1: 2100');
        expect(source).toContain("id: 'forest-guardian-handoff'");
        expect(source).toContain('x2: 5200');
        expect(source).toContain(
            'branchPlatform.traversalId = `forest-tree-${treeIndex + 1}-branch-${i + 1}`;'
        );
    });

    test('Forest batches static scenery and enemy trails for mobile rendering', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain('this.forestTreeStructureLayer = this.add.graphics()');
        expect(source).toContain('this.forestBridgeLayer = this.add.graphics()');
        expect(source).toContain('startForestEnemyTrailRenderer()');
        expect(source).toContain('sprite.forestTrail = sprite.forestTrail.slice(-3);');
        expect(source).not.toContain('const branch = this.add.graphics();');
        expect(source).not.toContain('const shadow = this.add.graphics();');
    });

    test('Crystal Caves stages the objective and guardian in forward order', () => {
        const source = read('levels/CrystalCavesLevel.js');

        expect(source).toContain('const coreX = 4850;');
        expect(source).toContain('const spawnX = 5250;');
        expect(source).toContain('this.createCrystalPowerWell(5150');
        expect(source).toContain('this.createCrystalPillar(5325');
        expect(source).toContain('this.createStalactite(5375');
        expect(source).toContain("platform.traversalId = id;");
        expect(source).toContain("id: 'caves-core-lift'");
        expect(source).toContain("destinationId: 'caves-core-refuge'");
    });

    test('Stellar Reef spawns above its opening floating platform', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain('createPlayer() {');
        expect(source).toContain('this.player.setPosition(200, this.levelHeight - 290);');
        expect(source).toContain('this.player.setVelocity(0, 0);');
    });

    test('Stellar Reef offers a finite resource detour that rejoins the route', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain("title: 'STAR TRENCH'");
        expect(source).toContain("rewardLabel: 'FREE SUPER BLAST'");
        expect(source).toContain("returnLabel: 'ASCENT CURRENT ↑ // SIGNAL ROUTE →'");
        expect(source).toContain('this.freeSpecialAttackCharges += 1;');
        expect(source).toContain('createAbyssAscentCurrent()');
        expect(source).toContain('this.player.setVelocityY(Math.min(this.player.body.velocity.y, -185))');
        expect(source).toContain(
            "{ x: 1750, y: this.levelHeight - 225, optionalRouteId: 'reef_star_trench' }"
        );
        expect(source).toContain(
            "{ x: 2250, y: this.levelHeight - 220, optionalRouteId: 'reef_star_trench' }"
        );
        expect(source).toContain('this.virtualJumpQueued;');
        expect(source).toContain('this.virtualJumpQueued = false;');
    });

    test('Void Peaks separates recovery islands and rewards Relic Ridge', () => {
        const source = read('levels/VoidPeaksLevel.js');

        expect(source).toContain('const relicRidge = [');
        expect(source).toContain("title: 'RELIC RIDGE'");
        expect(source).toContain("rewardLabel: 'RIDGE GUARD // 1 HIT'");
        expect(source).toContain("returnLabel: 'WARNING LINE →'");
        expect(source).toContain("this.grantOptionalRouteGuard('RIDGE GUARD', 1);");
        expect(source).toContain('{ x: 620, width: 360 }');
        expect(source).toContain("[2730, 300, 'peaks_relic_ridge']");
        expect(source).toContain("[3000, 235, 'peaks_relic_ridge']");
        expect(source).toContain("onOptionalSelected: () => this.selectPeakRoute('optional')");
        expect(source).toContain('peakFragmentMask: this.peakCollectedFragmentMask');
        expect(source).toContain('restorePeakRouteState(resume.routeState');
        expect(source).toContain('this.retireCollectedPeakFragments();');
        expect(source).toContain("const fragments = [...(this.collectibles?.getChildren?.() || [])]");
        expect(source).toContain('onOptionalRouteGuardConsumed()');
        expect(source).toContain('createPeakReturnCurrents()');
        expect(source).toContain("'RETURN CURRENT\\nTO WARNING LINE ↑'");
        expect(source).toContain("lowerRecoveryIsland.traversalLinks = ['peak-warning-lower']");
        expect(source).toContain("summitRecoveryIsland.traversalLinks = ['peak-warning-summit']");
        expect(source).toContain('const inLaunchBand = body.bottom >= current.bottom - 90;');
        expect(source).toContain('if (!grounded || !inLaunchBand) return false;');
        expect(source).toContain('if (now - current.lastLiftAt < 650) return false;');
        expect(source).toContain('calculateBallisticLaunchVelocity({');
        expect(source).toContain('rise: current.bottom - current.top + 80');
        expect(source).toContain('this.player.setVelocityY(launchVelocity)');
        expect(source).toContain('platform.traversalId = id;');
    });

    test('optional route progress grants its reward exactly once and retires the marker', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'OptionalRouteTest' });
        const marker = {
            setText: jest.fn(),
            setColor: jest.fn(),
            setAlpha: jest.fn()
        };
        const onComplete = jest.fn();
        scene.showFloatingText = jest.fn();
        scene.player = { x: 100, y: 200 };

        scene.registerOptionalRouteReward({
            id: 'test_route',
            title: 'TEST ROUTE',
            required: 2,
            rewardLabel: 'TEST GUARD',
            marker,
            returnLabel: 'RETURN RIGHT',
            onComplete
        });

        expect(marker.setText).toHaveBeenLastCalledWith(
            'TEST ROUTE // 0/2\nREWARD: TEST GUARD'
        );
        expect(scene.recordOptionalRouteProgress('test_route')).toBe(true);
        expect(onComplete).not.toHaveBeenCalled();
        expect(scene.getOptionalRouteStatusText('test_route')).toBe(
            'TEST ROUTE // 1/2'
        );

        expect(scene.recordOptionalRouteProgress('test_route')).toBe(true);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(marker.setText).toHaveBeenLastCalledWith(
            'TEST ROUTE COMPLETE\nTEST GUARD EARNED\nRETURN RIGHT'
        );
        expect(scene.getOptionalRouteStatusText('test_route')).toBe(
            'TEST GUARD // EARNED'
        );

        expect(scene.recordOptionalRouteProgress('test_route')).toBe(false);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test('route rewards cannot be collected from the unchosen branch', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RouteRewardGateTest' });
        scene.showFloatingText = jest.fn();
        scene.optionalRouteRewards = new Map();
        scene.player = { x: 150, y: 360 };
        const onComplete = jest.fn();

        const route = scene.registerOptionalRouteReward({
            id: 'gated_route',
            title: 'HIGH BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainLabel: 'LOW ROUTE',
                mainTradeoff: 'DIRECT',
                challengeLabel: 'HIGH ROUTE',
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 }
            },
            onComplete
        });

        expect(scene.updateOptionalRouteChoices()).toBe(true);
        expect(route.choice.selectedPath).toBe('main');
        expect(scene.recordOptionalRouteProgress('gated_route')).toBe(false);
        expect(route.progress).toBe(0);
        expect(onComplete).not.toHaveBeenCalled();
    });

    test('touching a reward inside its optional zone records the branch first', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RouteRewardEntryTest' });
        scene.showFloatingText = jest.fn();
        scene.optionalRouteRewards = new Map();
        scene.player = { x: 150, y: 100 };

        const route = scene.registerOptionalRouteReward({
            id: 'pickup_route',
            title: 'HIGH BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 }
            }
        });

        expect(scene.recordOptionalRouteProgress('pickup_route')).toBe(true);
        expect(route.choice.selectedPath).toBe('optional');
        expect(route.completed).toBe(true);
    });

    test('an optional route guard absorbs one non-pit hit', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'OptionalGuardTest' });
        scene.player = { x: 100, y: 200 };
        scene.health = 4;
        scene.showFloatingText = jest.fn();

        expect(scene.grantOptionalRouteGuard('RIDGE GUARD', 1)).toBe(1);
        scene.takeDamage(1);

        expect(scene.health).toBe(4);
        expect(scene.optionalRouteGuardCharges).toBe(0);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'RIDGE GUARD · 0 LEFT',
            100,
            140,
            '#F2C94C'
        );
    });

    test('guardian gates expose locked requirements and visibly become ready', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'GuardianGateTest' });
        const visual = {
            active: true,
            clear: jest.fn(),
            fillStyle: jest.fn(),
            fillCircle: jest.fn(),
            lineStyle: jest.fn(),
            strokeCircle: jest.fn(),
            destroy: jest.fn()
        };
        const label = {
            active: true,
            setText: jest.fn(),
            setColor: jest.fn(),
            destroy: jest.fn()
        };
        let ready = false;
        scene.add = {
            graphics: jest.fn(() => ({
                ...visual,
                setDepth: jest.fn(() => visual)
            })),
            text: jest.fn(() => ({
                ...label,
                setOrigin: jest.fn(() => ({
                    ...label,
                    setDepth: jest.fn(() => label)
                }))
            }))
        };

        scene.createGuardianGateState({
            x: 500,
            y: 600,
            title: 'TEST GATE',
            getStatus: () => 'RESTORE 3 SIGNALS',
            isReady: () => ready
        });
        expect(scene.guardianGateState.status).toBe('RESTORE 3 SIGNALS');
        expect(scene.guardianGateState.ready).toBe(false);

        ready = true;
        expect(scene.refreshGuardianGateState()).toBe(true);
        expect(scene.guardianGateState.status).toBe('READY // ENTER');
        expect(scene.guardianGateState.ready).toBe(true);

        scene.clearGuardianGateState();
        expect(scene.guardianGateState).toBeNull();
    });

    test.each([
        ['levels/MythicalForestLevel.js', "title: 'ELDER GROVE'"],
        ['levels/CrystalCavesLevel.js', "title: 'CRYSTAL CORE'"],
        ['levels/ReefLevel.js', "title: 'STELLAR PASSAGE'"],
        ['levels/VoidPeaksLevel.js', "title: 'TITAN PASS'"],
        ['levels/AuroraDepthsLevel.js', "title: 'PHOENIX SHIELD'"],
        ['levels/FinalVoidLevel.js', "title: 'EMPRESS SEAL'"]
    ])('%s has a visible, stateful guardian entrance', (relativePath, title) => {
        const source = read(relativePath);

        expect(source).toContain('this.createGuardianGateState({');
        expect(source).toContain(title);
        expect(source).toContain('this.beginGuardianEncounter({');
    });

    test('Aurora Depths rewards the Quiet Light route at the guardian', () => {
        const source = read('levels/AuroraDepthsLevel.js');

        expect(source).toContain('const quietLightRoute = [');
        expect(source).toContain("'aurora-heart-launch'");
        expect(source).toContain("'aurora-quiet-step-1'");
        expect(source).toContain("'aurora-quiet-step-3'");
        expect(source).toContain("{ id: 'aurora_prism_2', x: 2520, y: 580");
        expect(source).toContain("id: 'aurora_quiet_light_shelter'");
        expect(source).toContain('optional: true');
        expect(source).toContain("mainLabel: 'SHADOW CURRENT →'");
        expect(source).toContain(
            "mainTradeoff: 'DIRECT // NEXT PHOENIX HIT +2'"
        );
        expect(source).toContain(
            "challengeLabel: 'HIGH JUMPS + CURRENT SHELTER'"
        );
        expect(source).toContain("id: 'aurora_quiet_light'");
        expect(source).toContain("rewardLabel: 'QUIET LIGHT WARD // 1 HIT'");
        expect(source).toContain("this.grantOptionalRouteGuard('QUIET LIGHT WARD', 1)");
        expect(source).toContain("this.selectAuroraRoute('shadow_current')");
        expect(source).toContain('const routeBonus = this.consumeCurrentCharge();');
        expect(source).toContain('this.currentChargeAuraTween?.remove?.();');
        expect(source).not.toContain('this.activateShield();');
    });

    test('Forest canopy traversal earns a persistent one-hit guard', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain("id: 'forest_canopy_run'");
        expect(source).toContain("rewardLabel: 'CANOPY GUARD // 1 HIT'");
        expect(source).toContain("optionalRouteId: 'forest_canopy_run'");
        expect(source).toContain("this.grantOptionalRouteGuard('CANOPY GUARD', 1)");
        expect(source).toContain("this.getOptionalRouteStatusText(");
        expect(source).toContain("onMainSelected: () => this.selectForestRoute('main')");
        expect(source).toContain("onOptionalSelected: () => this.selectForestRoute('optional')");
        expect(source).toContain('forestFragmentMask: this.forestCollectedFragmentMask');
        expect(source).toContain('canopyGuardCharges: this.forestRouteChoice === \'optional\'');
        expect(source).toContain('restoreForestRouteState(resume.routeState');
        expect(source).toContain('this.retireCollectedForestFragments();');
        expect(source).toContain('this.refreshPersistedExpeditionRouteState();');
        expect(source).toContain('onOptionalRouteGuardConsumed()');
        expect(source).toContain('!this.recordOptionalRouteProgress(fragmentData.optionalRouteId');
        expect(source.indexOf('!this.recordOptionalRouteProgress(fragmentData.optionalRouteId'))
            .toBeLessThan(source.indexOf('this.forestCollectedFragmentMask |= fragmentBit'));
        expect(source).toContain('forestFragmentBonusAwarded: this.forestFragmentBonusAwarded === true');
    });

    test('Crystal Spider Walk is a persistent, mutually exclusive chamber route', () => {
        const source = read('levels/CrystalCavesLevel.js');

        expect(source).toContain("id: 'caves_secret_slide'");
        expect(source).toContain("title: 'SPIDER WALK'");
        expect(source).toContain("rewardLabel: 'CRYSTAL WARD // 1 HIT'");
        expect(source).toContain("shield.optionalRouteId = 'caves_secret_slide'");
        expect(source).toContain("onMainSelected: () => this.selectCrystalChamberRoute('main')");
        expect(source).toContain("onOptionalSelected: () => this.selectCrystalChamberRoute('optional')");
        expect(source).toContain("'CALM THE CRYSTAL SPIDER FIRST'");
        expect(source).toContain('restoreCrystalChamberRoute(resume.routeState');
        expect(source).toContain('crystalWardGuardCharges');
        expect(source).toContain("this.grantOptionalRouteGuard('CRYSTAL WARD', 1)");
        expect(source).not.toContain('this.activateShield();');
    });

    test('Final Void rewards the Trust Bridge with one reliable rescue', () => {
        const source = read('levels/FinalVoidLevel.js');

        expect(source).toContain('const groundIslands = [');
        expect(source).toContain('const mainRiftRoute = [');
        expect(source).toContain('const trustBridgeRoute = [');
        expect(source).toContain("'final-rift-step-1'");
        expect(source).toContain("'final-rift-step-4'");
        expect(source).toContain("mainLabel: 'LOW RIFT CROSSING →'");
        expect(source).toContain("mainTradeoff: 'SHORT JUMPS // RIFT DAMAGE'");
        expect(source).toContain(
            "challengeLabel: 'HIGH CLIMB // EARN 1 RESCUE'"
        );
        expect(source).toContain("{ x: 930, width: 120, label: 'JUMP THE RIFT →' }");
        expect(source).toContain("{ x: 1720, width: 490, label: 'CHOOSE YOUR CROSSING' }");
        expect(source).not.toContain(
            "this.createPlatform(0, groundY, this.levelWidth, 80, 'solid');"
        );
        expect(source).toContain("id: 'final_trust_bridge'");
        expect(source).toContain("rewardLabel: 'BOND RESERVE // 1 RESCUE'");
        expect(source).toContain('onComplete: () => this.activateBondReserve()');
        expect(source).toContain("onOptionalSelected: () => this.selectFinalRoute('optional')");
        expect(source).toContain('trustBridgeCompleted: route?.completed === true');
        expect(source).toContain('restoreFinalRouteState(resume.routeState');
        expect(source).toContain('this.clearBondReservePickup();');
        expect(source).toContain('this.refreshPersistedExpeditionRouteState();');
        expect(source).toContain('incomingDamage = Math.max(0, this.health - 1);');
        expect(source).toContain('this.bondReserveEcho?.destroy?.();');
    });

    test.each([
        [
            'levels/MythicalForestLevel.js',
            "id: 'forest_canopy_run'",
            "mainLabel: 'MID-BRANCH CROSSING →'",
            "mainTradeoff: 'STEADY // CRAWLER PATROLS'",
            "challengeLabel: 'HIGH CLIMB + 2 FRAGMENTS'"
        ],
        [
            'levels/CrystalCavesLevel.js',
            "id: 'caves_secret_slide'",
            "mainLabel: 'LOWER PASSAGE →'",
            "mainTradeoff: 'SHORT // ARMORED CRAWLER'",
            "challengeLabel: 'SPIDER + CRYSTAL SLIDE'"
        ],
        [
            'levels/ReefLevel.js',
            "id: 'reef_star_trench'",
            "mainLabel: 'SIGNAL CURRENT →'",
            "mainTradeoff: 'FAST // ENEMY PATROLS'",
            "challengeLabel: 'DEEP WATER + 2 RELICS'"
        ],
        [
            'levels/VoidPeaksLevel.js',
            "id: 'peaks_relic_ridge'",
            "mainLabel: 'WARNING LINE →'",
            "mainTradeoff: 'LOWER // VOID GEYSERS'",
            "challengeLabel: 'HIGH CLIMB + 2 RELICS'"
        ],
        [
            'levels/AuroraDepthsLevel.js',
            "id: 'aurora_quiet_light'",
            "mainLabel: 'SHADOW CURRENT →'",
            "mainTradeoff: 'DIRECT // NEXT PHOENIX HIT +2'",
            "challengeLabel: 'HIGH JUMPS + CURRENT SHELTER'"
        ],
        [
            'levels/FinalVoidLevel.js',
            "id: 'final_trust_bridge'",
            "mainLabel: 'LOW RIFT CROSSING →'",
            "mainTradeoff: 'SHORT JUMPS // RIFT DAMAGE'",
            "challengeLabel: 'HIGH CLIMB // EARN 1 RESCUE'"
        ]
    ])('%s declares a readable two-path choice', (
        relativePath,
        id,
        mainLabel,
        mainTradeoff,
        challengeLabel
    ) => {
        const source = read(relativePath);

        expect(source).toContain(id);
        expect(source).toContain('choice: {');
        expect(source).toContain(mainLabel);
        expect(source).toContain(mainTradeoff);
        expect(source).toContain(challengeLabel);
        expect(source).toContain('mainMarker:');
        expect(source).toContain('mainZone: {');
        expect(source).toContain('optionalZone: {');
        expect(source).toContain('rejoinZone: {');
    });

    test('the shared route-choice contract is lightweight and lifecycle-safe', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('normalizeOptionalRouteChoice(choice)');
        expect(source).toContain('updateOptionalRouteChoices()');
        expect(source).toContain('this.updateOptionalRouteChoices();');
        expect(source).toContain('route.onMainSelected?.(route);');
        expect(source).toContain('route.onOptionalSelected?.(route);');
        expect(source).toContain('this.optionalRouteRewards?.clear?.();');
        expect(source).toContain("recordEvent?.('route_choice_entered'");
        expect(source).toContain("recordEvent?.('route_choice_rejoined'");
        expect(source).not.toContain('physics.add.overlap(this.player, choice');
    });

    test('guardian entry is one atomic encounter with a transient safe stance', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'GuardianEntryTest',
            levelWidth: 1800,
            levelHeight: 800
        });
        const started = jest.fn(() => {
            scene.bossFightActive = true;
        });
        scene.time = { now: 1234 };
        scene.player = {
            setVelocity: jest.fn()
        };
        scene.setCheckpoint = jest.fn((x, y) => {
            scene.checkpointPosition = { x, y };
        });
        scene.resetJoystick = jest.fn();
        scene.clearVirtualJumpInput = jest.fn();
        scene.clearGuardianGateState = jest.fn();

        expect(scene.beginGuardianEncounter({
            id: 'test_guardian',
            title: 'TEST GUARDIAN',
            checkpoint: { x: 1200, y: 620 },
            start: started
        })).toBe(true);
        expect(scene.guardianEncounter).toMatchObject({
            id: 'test_guardian',
            title: 'TEST GUARDIAN',
            checkpoint: { x: 1200, y: 620 },
            active: true,
            startedAt: 1234
        });
        expect(scene.setCheckpoint).toHaveBeenCalledWith(1200, 620);
        expect(scene.player.setVelocity).toHaveBeenCalledWith(0, 0);
        expect(scene.clearGuardianGateState).toHaveBeenCalledTimes(1);
        expect(started).toHaveBeenCalledTimes(1);
        expect(started.mock.invocationCallOrder[0]).toBeLessThan(
            scene.clearGuardianGateState.mock.invocationCallOrder[0]
        );

        expect(scene.beginGuardianEncounter({
            id: 'duplicate',
            checkpoint: { x: 1000, y: 620 },
            start: started
        })).toBe(false);
        expect(started).toHaveBeenCalledTimes(1);
    });

    test('guardian entry rejects invalid recovery positions before consuming a gate', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'GuardianEntryValidationTest',
            levelWidth: 1800,
            levelHeight: 800
        });
        const started = jest.fn();

        expect(scene.beginGuardianEncounter({
            id: 'test_guardian',
            checkpoint: { x: 1900, y: 620 },
            start: started
        })).toBe(false);
        expect(scene.guardianEncounter).toBeNull();
        expect(started).not.toHaveBeenCalled();
    });

    test('guardian entry keeps the gate and prior checkpoint when startup fails', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'GuardianEntryRollbackTest',
            levelWidth: 1800,
            levelHeight: 800
        });
        scene.time = { now: 1234 };
        scene.player = { setVelocity: jest.fn() };
        scene.checkpointPosition = {
            x: 700,
            y: 620,
            id: 'route_signal_2',
            index: 1
        };
        scene.setCheckpoint = jest.fn((x, y) => {
            scene.checkpointPosition = { x, y };
        });
        scene.clearGuardianGateState = jest.fn();

        expect(() => scene.beginGuardianEncounter({
            id: 'test_guardian',
            checkpoint: { x: 1200, y: 620 },
            start: () => {
                scene.bossFightActive = true;
                throw new Error('guardian startup failed');
            }
        })).toThrow('guardian startup failed');
        expect(scene.guardianEncounter).toBeNull();
        expect(scene.bossFightActive).toBe(false);
        expect(scene.checkpointPosition).toEqual({
            x: 700,
            y: 620,
            id: 'route_signal_2',
            index: 1
        });
        expect(scene.clearGuardianGateState).not.toHaveBeenCalled();
    });

    test('guardian entry rejects a callback that never activates combat', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({
            key: 'GuardianEntryNoopTest',
            levelWidth: 1800,
            levelHeight: 800
        });
        scene.time = { now: 1234 };
        scene.player = { setVelocity: jest.fn() };
        scene.checkpointPosition = { x: 700, y: 620 };
        scene.setCheckpoint = jest.fn((x, y) => {
            scene.checkpointPosition = { x, y };
        });
        scene.clearGuardianGateState = jest.fn();

        expect(scene.beginGuardianEncounter({
            id: 'test_guardian',
            checkpoint: { x: 1200, y: 620 },
            start: jest.fn()
        })).toBe(false);
        expect(scene.guardianEncounter).toBeNull();
        expect(scene.checkpointPosition).toEqual({ x: 700, y: 620 });
        expect(scene.clearGuardianGateState).not.toHaveBeenCalled();
    });

    test.each([
        ['levels/MythicalForestLevel.js', "id: 'elder_treant'"],
        ['levels/CrystalCavesLevel.js', "id: 'crystal_golem'"],
        ['levels/ReefLevel.js', "id: 'nyxvoral'"],
        ['levels/VoidPeaksLevel.js', "id: 'cosmic_titan'"],
        ['levels/AuroraDepthsLevel.js', "id: 'shadow_phoenix'"],
        ['levels/FinalVoidLevel.js', "id: 'void_empress'"]
    ])('%s enters its guardian through the shared recovery contract', (
        relativePath,
        guardianId
    ) => {
        const source = read(relativePath);

        expect(source).toContain('this.beginGuardianEncounter({');
        expect(source).toContain(guardianId);
        expect(source).toContain('checkpoint: {');
        expect(source).toContain('start: () => this.startBossFight()');
        expect(source).toContain('const guardianEntered = this.beginGuardianEncounter({');
    });

    test('Reef inherits shared safety and route updates from the platformer loop', () => {
        const reefSource = read('levels/ReefLevel.js');
        const platformerSource = read('PlatformerLevelScene.js');

        expect(reefSource).toContain('super.update(time, delta);');
        expect(platformerSource).toContain('this.checkFallOutOfBounds();');
        expect(platformerSource).toContain('this.updateOptionalRouteChoices();');
    });

    test.each([
        ['levels/AuroraDepthsLevel.js', 'createAuroraSentinels', 'auroraSentinel'],
        ['levels/FinalVoidLevel.js', 'createVoidEchoSentinels', 'voidEchoSentinel']
    ])('%s has authored combat between its route signals', (
        relativePath,
        factoryName,
        enemyType
    ) => {
        const source = read(relativePath);

        expect(source).toContain(`this.${factoryName}();`);
        expect(source).toContain('const encounters = [');
        expect(source).toContain(`enemyType: '${enemyType}'`);
        expect(source).toContain('health: 1');
        expect(source).toContain('health: 2');
        expect(source).toContain('health: 3');
        expect(source).toContain("instructionText: 'GOLD MARK // STOMP OR STRIKE'");
    });

    test('shared sentinels use the universal combat and patrol contracts', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('createPatrolSentinels(encounters, {');
        expect(source).toContain('this.configureEnemyCombat(sentinel, {');
        expect(source).toContain('updatePatrolEnemyMovement()');
        expect(source).toContain('this.updatePatrolEnemyMovement();');
    });

    test('the shared route contract identifies the next objective without blocking input', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('canActivateOrderedRouteSignal(signal, signals, activatedCount');
        expect(source).toContain('refreshOrderedRouteSignals(signals, activatedCount');
        expect(source).toContain("nextSignal?.label?.text || fallbackLabel");
        expect(source).toContain('`NEXT → ${nextLabel}`');
    });

    test('ordered route guidance reports useful direction and range', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RouteCompassTest' });
        scene.player = { x: 200, y: 900 };
        const signals = [
            { index: 0, x: 1250, y: 700, activated: false },
            { index: 1, x: 3150, y: 420, activated: false }
        ];

        expect(scene.setOrderedRouteGuidance(signals, 0)).toBe(true);
        expect(scene.getOrderedRouteCompassText()).toBe(
            'SIGNAL RIGHT + UP // 1050m'
        );

        scene.player = { x: 1180, y: 700 };
        expect(scene.getOrderedRouteCompassText()).toBe('SIGNAL CLOSE // 50m');
    });

    test('ordered route guidance supports level-specific completion properties', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RoutePropertyTest' });
        scene.player = { x: 1000, y: 500 };
        const signals = [
            { index: 0, x: 900, y: 500, aligned: true },
            { index: 1, x: 1500, y: 300, aligned: false }
        ];

        scene.setOrderedRouteGuidance(signals, 1, {
            activeProperty: 'aligned'
        });

        expect(scene.getNextOrderedRouteSignal()).toBe(signals[1]);
        expect(scene.getOrderedRouteCompassText()).toBe(
            'SIGNAL RIGHT + UP // 550m'
        );
    });

    test('shared route choices announce an optional branch and its rejoin once', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RouteChoiceTest' });
        scene.showFloatingText = jest.fn();
        scene.optionalRouteRewards = new Map();
        scene.routeChoiceSequence = 0;
        scene.player = { x: 150, y: 100 };

        const route = scene.registerOptionalRouteReward({
            id: 'test_branch',
            title: 'HIGH BRANCH',
            rewardLabel: 'ONE GUARD',
            returnLabel: 'SIGNAL ROUTE →',
            choice: {
                mainLabel: 'LOW ROUTE',
                mainTradeoff: 'FASTER // ENEMIES',
                challengeLabel: 'MORE JUMPS // SAFER',
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 }
            }
        });

        expect(scene.updateOptionalRouteChoices()).toBe(true);
        expect(route.choice.selectedPath).toBe('optional');
        expect(route.choice.optionalEntered).toBe(true);
        expect(route.choice.sequence).toBe(1);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'HIGH BRANCH // MORE JUMPS // SAFER',
            150,
            30,
            '#F2C94C'
        );

        expect(scene.updateOptionalRouteChoices()).toBe(false);
        scene.player = { x: 150, y: 360 };
        expect(scene.updateOptionalRouteChoices()).toBe(false);
        expect(route.choice.mainEntered).toBe(false);

        scene.player = { x: 550, y: 250 };
        expect(scene.updateOptionalRouteChoices()).toBe(true);
        expect(route.choice.rejoined).toBe(true);
        expect(scene.showFloatingText).toHaveBeenLastCalledWith(
            'BACK ON ROUTE // SIGNAL ROUTE →',
            550,
            180,
            '#8FE3CF'
        );
        expect(scene.updateOptionalRouteChoices()).toBe(false);
    });

    test('shared route choices distinguish the direct path without a rejoin message', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'MainRouteChoiceTest' });
        scene.showFloatingText = jest.fn();
        scene.optionalRouteRewards = new Map();
        scene.player = { x: 160, y: 360 };

        const route = scene.registerOptionalRouteReward({
            id: 'test_main',
            title: 'HIGH BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainLabel: 'LOW ROUTE',
                mainTradeoff: 'FASTER // ENEMIES',
                challengeLabel: 'MORE JUMPS // SAFER',
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 }
            }
        });

        expect(scene.updateOptionalRouteChoices()).toBe(true);
        expect(route.choice.selectedPath).toBe('main');
        expect(route.choice.mainEntered).toBe(true);
        expect(route.choice.optionalEntered).toBe(false);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'LOW ROUTE // FASTER // ENEMIES',
            160,
            290,
            '#8FE3CF'
        );

        scene.player = { x: 550, y: 250 };
        expect(scene.updateOptionalRouteChoices()).toBe(false);
        expect(route.choice.rejoined).toBe(false);
    });

    test('invalid route choice geometry degrades to the existing reward contract', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'InvalidRouteChoiceTest' });
        scene.optionalRouteRewards = new Map();

        const route = scene.registerOptionalRouteReward({
            id: 'invalid_branch',
            title: 'BROKEN BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainZone: { left: 0, right: 100, top: 0 },
                optionalZone: { left: 0, right: 100, top: 0, bottom: 100 },
                rejoinZone: { left: 200, right: 300, top: 0, bottom: 100 }
            }
        });

        expect(route.choice).toBeNull();
    });

    test('platformer action pointers have a shared all-path release contract', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ActionReleaseTest' });
        const release = jest.fn();

        scene.actionButtonPointers.add('7');
        scene.actionButtonReleases.set('7', release);
        scene.virtualJumpPressed = true;

        expect(scene.releasePlatformerActionButton(7)).toBe(true);
        expect(release).toHaveBeenCalledTimes(1);
        expect(scene.actionButtonPointers.has('7')).toBe(false);
        expect(scene.releasePlatformerActionButton(7)).toBe(false);

        scene.virtualJumpPressed = true;
        scene.releaseAllPlatformerActionButtons();
        expect(scene.virtualJumpPressed).toBe(false);
    });

    test('a short mobile jump tap survives pointer release until one gameplay frame', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'JumpTapBufferTest' });
        scene.jumpKey = { isDown: false };
        scene.cursors = { up: { isDown: false } };
        scene.wasdKeys = { W: { isDown: false } };
        scene.isGrounded = true;
        scene.canJump = true;
        scene.lastGroundedTime = 900;
        scene.executeJump = jest.fn(() => scene.clearVirtualJumpInput());

        scene.queueVirtualJumpInput();
        scene.releaseVirtualJumpInput();

        expect(scene.virtualJumpPressed).toBe(false);
        expect(scene.virtualJumpQueued).toBe(true);

        scene.handleJump(1000);

        expect(scene.executeJump).toHaveBeenCalledTimes(1);
        expect(scene.virtualJumpQueued).toBe(false);
    });

    test('cancellation clears any queued mobile jump edge', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'JumpTapCancelTest' });

        scene.queueVirtualJumpInput();
        scene.releaseAllPlatformerActionButtons();

        expect(scene.virtualJumpPressed).toBe(false);
        expect(scene.virtualJumpQueued).toBe(false);
    });

    test.each([
        'levels/ReefLevel.js',
        'levels/VoidPeaksLevel.js',
        'levels/AuroraDepthsLevel.js',
        'levels/FinalVoidLevel.js'
    ])('%s enforces readable objective order', relativePath => {
        const source = read(relativePath);

        expect(source).toContain('this.canActivateOrderedRouteSignal(');
        expect(source).toContain('this.refreshOrderedRouteSignals(');
        expect(source).toContain('this.getOrderedRouteCompassText()');
    });

    test('Stellar Reef visibly links its spawn to the first drift signal', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain('this.createOpeningSignalCurrent();');
        expect(source).toContain('DRIFT SIGNAL 01  →');
        expect(source).toContain('visual.lineTo(1250, 700);');
        expect(source).toContain('this.retireOpeningSignalCurrent();');
        expect(source).toContain("current.label?.setText?.('DRIFT SIGNAL LINKED')");
    });

    test('release smoke completes every campaign route instead of checking only its opening', () => {
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smoke).toContain('audit?.flow?.strandingSupportCount !== 0');
        expect(smoke).toContain('smokeVoidPeaksReturnCurrents(session)');
        expect(smoke).toContain('smokeCrystalCoreLift(session)');
        expect(smoke).toContain("target.id === 'crystal_core'");
        expect(smoke).toContain("'caves-core-refuge'");
        expect(smoke).toContain('cavesFlowFailed');
        expect(smoke).toContain("id: 'peak-return-lower'");
        expect(smoke).toContain("id: 'peak-return-summit'");
        expect(smoke).toContain('current.lastLiftAt = Number.NEGATIVE_INFINITY;');
        expect(smoke).toContain("route === 'finalVoid'");
        expect(smoke).toContain('Number(audit?.flow?.requiredJumpCount) < 4');
        expect(smoke).toContain('audit?.flow?.comfortPassed !== true');
        expect(smoke).toContain("route === 'auroraDepths'");
        expect(smoke).toContain('optionalComfortPassed !== true');
        expect(smoke).toContain('uncomfortableOptionalTargetIds');
        expect(smoke).toContain("route === 'mythicalForest'");
        expect(smoke).toContain('forestFlowFailed');
        expect(smoke).toContain('smokeFinalVoidRiftCrossing(session)');
        expect(smoke).toContain("'final-rift-step-1'");
        expect(smoke).toContain("'final-rift-step-4'");
        expect(smoke).toContain('smokeAuroraQuietLightClimb(session)');
        expect(smoke).toContain("'aurora-heart-launch'");
        expect(smoke).toContain("'aurora-quiet-step-3'");
        expect(smoke).toContain('smokeForestForwardHandoffs(session)');
        expect(smoke).toContain("'forest-tree-3-handoff'");
        expect(smoke).toContain("'forest-guardian-handoff'");

        expect(smoke).toContain('for (let signalIndex = 1; signalIndex < 3; signalIndex += 1)');
        expect(smoke).toContain("mythicalForest: 'forestRouteAligned'");
        expect(smoke).toContain("crystalCaves: 'caveRouteAligned'");
        expect(smoke).toContain("reef: 'reefRouteAligned'");
        expect(smoke).toContain("voidPeaks: 'creatureNetworkReached'");
        expect(smoke).toContain("auroraDepths: 'uplinkRiskUnderstood'");
        expect(smoke).toContain("finalVoid: 'finalSignalReady'");
        expect(smoke).toContain('remainingZones: signals.filter');
        expect(smoke).toContain('emphasizedSignals: signals.filter');
        expect(smoke).toContain('accepted an out-of-order route signal');
        expect(smoke).toContain("'story.projectBeacon.expeditionCheckpoint'");
        expect(smoke).toContain('persistedCheckpoint?.sceneKey !== sceneName');
        expect(smoke).toContain("'auroraDepths',\n            'finalVoid'");
        expect(smoke).toContain(
            "['mythicalForest', 'auroraDepths', 'finalVoid'].includes(route)"
        );
        expect(smoke).toContain("enemy?.combatRole === 'armored'");
        expect(smoke).toContain('scene.player.setVelocity?.(0, 680)');
        expect(smoke).toContain('message: `${sceneName} live stomp collision`');
        expect(smoke).toContain('state.displayCount > 475');
        expect(smoke).toContain('renderStability.endCount > renderStability.startCount + 8');
        expect(smoke).toContain('state.ambientRendering?.layerCount !== 9');
        expect(smoke).toContain('state.ambientRendering?.pointCount !== 194');
        expect(smoke).toContain('scene.performSpecialAttack();');
        expect(smoke).toContain(
            'guardianBlast.healthAfter !== guardianBlast.healthBefore - 3'
        );
        expect(smoke).toContain(
            '`${sceneName} Super Blast did not damage its guardian predictably: `'
        );
        expect(smoke).toContain(
            'liveStomp.enemyHealthAfter !== liveStomp.enemyHealthBefore - 1'
        );
        expect(smoke).toContain(
            'liveStomp.playerHealthAfter !== liveStomp.playerHealthBefore'
        );
        expect(smoke).toContain('`${sceneName} optional route entry`');
        expect(smoke).toContain('`${sceneName} optional route rejoin`');
        expect(smoke).toContain("optionalEntry.selectedPath !== 'optional'");
        expect(smoke).toContain('choicePresentation.optionalMarker.includes');
        expect(smoke).toContain('routeChoice = {');
        expect(smoke).toContain('presentation: choicePresentation');
        expect(smoke).toContain('rejectedOptionalPickup,');
        expect(smoke).toContain(
            "combatFeedback.armoredAfter === 1 ? '' : 'S'"
        );
        expect(smoke).toContain("auroraDepths: 'aurora_quiet_light'");
        expect(smoke).toContain("finalVoid: 'final_trust_bridge'");
        expect(smoke).toContain('optional protection did not absorb one hit');
        expect(smoke).toContain('did not restore its optional reward');
        expect(smoke).toContain('respawned a consumed optional reward');
        expect(smoke).toContain('scene.auditTraversalTopology();');
        expect(smoke).toContain('Aurora direct route zone selection');
        expect(smoke).toContain('Aurora Quiet Light pickup collision');
        expect(smoke).toContain('Aurora charge returned after reload');
        expect(smoke).toContain('Aurora Quiet Light returned after reload');
    });

    test('runtime checkpoints retain the same authored identity persisted for reload recovery', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain("? { id: options.checkpointId }");
        expect(source).toContain("? { index: checkpointIndex }");
        expect(source).toContain('id: resume.checkpointId');
        expect(source).toContain('index: Number(resume.checkpointIndex)');
        expect(source).toContain('sanitizeExpeditionRouteState(routeState)');
        expect(source).toContain('checkpoint.routeState = sanitizedRouteState;');
        expect(source).toContain('refreshPersistedExpeditionRouteState()');
    });

    test('release gate checks static topology and Aurora route recovery', () => {
        const releaseSmoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/run-browser-smoke.js'),
            'utf8'
        );

        expect(releaseSmoke).toContain("SMOKE_MODE: 'traversal-topology'");
        expect(releaseSmoke).toContain("SMOKE_MODE: 'aurora-route-journey'");
        expect(releaseSmoke).toContain('traversal-topology: ${error.message}');
        expect(releaseSmoke).toContain('aurora-route-journey: ${error.message}');
    });
});

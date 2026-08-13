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

    test.each([
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

    test('Crystal Caves stages the objective and guardian in forward order', () => {
        const source = read('levels/CrystalCavesLevel.js');

        expect(source).toContain('const coreX = 4850;');
        expect(source).toContain('const spawnX = 5250;');
        expect(source).toContain('this.createCrystalPowerWell(5150');
        expect(source).toContain('this.createCrystalPillar(5325');
        expect(source).toContain('this.createStalactite(5375');
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
        expect(source).toContain('this.clearGuardianGateState();');
    });

    test('Aurora Depths offers safety for taking the Quiet Light route', () => {
        const source = read('levels/AuroraDepthsLevel.js');

        expect(source).toContain('const quietLightRoute = [');
        expect(source).toContain('QUIET LIGHT / HIGH ROUTE');
        expect(source).toContain('SHADOW CURRENT / DIRECT ROUTE');
        expect(source).toContain("'QUIET LIGHT // 15 SECOND SHELTER'");
        expect(source).toContain('this.activateShield();');
    });

    test('Final Void rewards the Trust Bridge with one reliable rescue', () => {
        const source = read('levels/FinalVoidLevel.js');

        expect(source).toContain('const trustBridgeRoute = [');
        expect(source).toContain('TRUST BRIDGE / HIGH ROUTE');
        expect(source).toContain('VOID FRACTURE / DIRECT ROUTE');
        expect(source).toContain('incomingDamage = Math.max(0, this.health - 1);');
        expect(source).toContain('this.bondReserveEcho?.destroy?.();');
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

    test('release smoke completes every later-level route instead of checking only its opening', () => {
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smoke).toContain('for (let signalIndex = 1; signalIndex < 3; signalIndex += 1)');
        expect(smoke).toContain("reef: 'reefRouteAligned'");
        expect(smoke).toContain("voidPeaks: 'creatureNetworkReached'");
        expect(smoke).toContain("auroraDepths: 'uplinkRiskUnderstood'");
        expect(smoke).toContain("finalVoid: 'finalSignalReady'");
        expect(smoke).toContain('remainingZones: signals.filter');
        expect(smoke).toContain('emphasizedSignals: signals.filter');
        expect(smoke).toContain('accepted an out-of-order route signal');
        expect(smoke).toContain("'story.projectBeacon.expeditionCheckpoint'");
        expect(smoke).toContain('persistedCheckpoint?.sceneKey !== sceneName');
    });

    test('runtime checkpoints retain the same authored identity persisted for reload recovery', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain("? { id: options.checkpointId }");
        expect(source).toContain("? { index: checkpointIndex }");
        expect(source).toContain('id: resume.checkpointId');
        expect(source).toContain('index: Number(resume.checkpointIndex)');
    });
});

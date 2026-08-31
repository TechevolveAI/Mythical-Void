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
    test('campaign objective HUD only rerasterizes when state changes', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'ObjectiveHudBudgetTest' });
        let objective = 'SIGNAL 1/3';
        scene.campaignObjectiveTextProvider = () => objective;
        scene.objectiveDisplay = {
            active: true,
            text: objective,
            visible: true,
            setText: jest.fn(function setText(text) {
                this.text = text;
                return this;
            }),
            setVisible: jest.fn(function setVisible(visible) {
                this.visible = visible;
                return this;
            })
        };

        expect(scene.syncCampaignObjectiveDisplay()).toBe(false);
        expect(scene.objectiveDisplay.setText).not.toHaveBeenCalled();
        expect(scene.objectiveDisplay.setVisible).not.toHaveBeenCalled();
        expect(scene.campaignObjectiveTextureRevision).toBeUndefined();

        objective = 'SIGNAL 2/3';
        expect(scene.syncCampaignObjectiveDisplay()).toBe(true);
        expect(scene.objectiveDisplay.setText).toHaveBeenCalledTimes(1);
        expect(scene.objectiveDisplay.text).toBe('SIGNAL 2/3');
        expect(scene.campaignObjectiveTextureRevision).toBe(1);

        expect(scene.syncCampaignObjectiveDisplay({ visible: false })).toBe(true);
        expect(scene.objectiveDisplay.setText).toHaveBeenCalledTimes(1);
        expect(scene.objectiveDisplay.setVisible).toHaveBeenCalledWith(false);

        expect(scene.syncCampaignObjectiveDisplay({
            visible: false,
            force: true
        })).toBe(true);
        expect(scene.objectiveDisplay.setText).toHaveBeenCalledTimes(2);
        expect(scene.campaignObjectiveTextureRevision).toBe(2);

        expect(read('PlatformerLevelScene.js')).toContain(
            'visible: this.objectiveDisplay.visible'
        );
        expect(read('../../scripts/smoke-secondary-journeys.js')).toContain(
            'objectiveHudRendering?.rebuildsDuringSample > 2'
        );
        expect(read('../../scripts/smoke-secondary-journeys.js')).toContain(
            '!Number.isFinite('
        );
    });

    test('all campaign levels use the shared objective HUD render budget', () => {
        [
            'levels/MythicalForestLevel.js',
            'levels/CrystalCavesLevel.js',
            'levels/ReefLevel.js',
            'levels/VoidPeaksLevel.js',
            'levels/AuroraDepthsLevel.js',
            'levels/FinalVoidLevel.js'
        ].forEach(relativePath => {
            const source = read(relativePath);
            expect(source).toContain('this.syncCampaignObjectiveDisplay({');
            expect(source).not.toMatch(/objectiveDisplay.*setText/);
        });
    });

    test('release smoke waits for steady authored runtime state', () => {
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(smoke).toContain(
            "message: 'Forest authored enemies settled on their supports'"
        );
        expect(smoke).toContain('enemy.body.bottom - support.body.top');
        expect(smoke).toContain('timeoutMs: 3500');
        expect(smoke).toContain(
            'entry effects retired within render budget'
        );
        expect(smoke).toContain('timeoutMs: 4500');
    });

    test('route-choice smoke stages a settled landing before reading the choice', () => {
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(smoke).toContain(
            'support.body.top - scene.player.body.bottom'
        );
        expect(smoke).toContain('scene.player.body.blocked.down = true;');
        expect(smoke).toContain('scene.player.body.touching.down = true;');
        expect(smoke).toContain('scene.updateOptionalRouteChoices?.();');
        expect(smoke).toContain("message: 'Desktop no-touch Sanctuary reload'");
        expect(smoke).toContain('waitForRemoval = false');
        expect(smoke).toContain('waitForRemoval: true');
    });

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

    test('mobile joystick retains a native drag fallback with symmetric cleanup', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('this.platformerTouchStartHandler = (event) => {');
        expect(source).toContain('this.platformerTouchMoveHandler = (event) => {');
        expect(source).toContain('this.joystickTouchIdentifier =');
        expect(source).toContain('nativeTouchIdentifier !== null');
        expect(source).toContain("candidate.identifier === this.joystickTouchIdentifier");
        expect(source).toContain("touch.identifier === this.joystickTouchIdentifier");
        expect(source).toContain("addEventListener('touchstart', this.platformerTouchStartHandler");
        expect(source).toContain("removeEventListener('touchstart', this.platformerTouchStartHandler, true)");
        expect(source).toContain("addEventListener('touchmove', this.platformerTouchMoveHandler");
        expect(source).toContain("removeEventListener('touchmove', this.platformerTouchMoveHandler, true)");
        expect(source).toContain("addEventListener('touchcancel', this.platformerTouchEndHandler");
        expect(source).toContain("removeEventListener('touchcancel', this.platformerTouchEndHandler)");
        expect(source).toContain('(touch.clientX - bounds.left) *');
        expect(source).toContain('(touch.clientY - bounds.top) *');
        expect(source).toContain('const jumpTarget = this.mobileControlTargets?.jump;');
        expect(source).toContain('this.platformerControlsVisible &&');
        expect(source).toContain('this.queueVirtualJumpInput();');
    });

    test('every dark campaign biome renders a stable high-contrast landing rim', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'PlatformReadabilityTest' });
        const relativeLuminance = color => {
            const channels = [16, 8, 0].map(shift => (
                (color >> shift) & 0xFF
            ) / 255);
            return channels.reduce(
                (total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index],
                0
            );
        };

        [
            'crystal_caves',
            'stellar_reef',
            'void_peaks',
            'aurora_depths',
            'final_void'
        ].forEach(biomeId => {
            scene.biomeId = biomeId;
            const colors = scene.getPlatformColors();
            expect(colors.edge).toEqual(expect.any(Number));
            expect(relativeLuminance(colors.edge))
                .toBeGreaterThan(relativeLuminance(colors.base) + 0.2);
        });

        const source = read('PlatformerLevelScene.js');
        expect(source).toContain('graphics.strokeRoundedRect(');
        expect(source).toContain('colors.edge || colors.crystal');
        expect(source).toContain('without adding display objects or animation');
    });

    test('the visible Current prompt and node share proximity-gated input', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'CurrentInteractionTest' });
        const prompt = {
            input: { enabled: false },
            setVisible: jest.fn()
        };
        const zone = { input: { enabled: false } };
        scene.currentEcologyNode = {
            x: 100,
            y: 100,
            prompt,
            zone
        };
        scene.player = { x: 100, y: 100 };
        scene.showCurrentEcologyModal = jest.fn();

        scene.updateCurrentEcologyNodeProximity();
        expect(scene.currentEcologyPlayerNearby).toBe(true);
        expect(prompt.setVisible).toHaveBeenLastCalledWith(true);
        expect(prompt.input.enabled).toBe(true);
        expect(zone.input.enabled).toBe(true);
        expect(scene.requestCurrentEcologyInteraction()).toBe(true);
        expect(scene.showCurrentEcologyModal).toHaveBeenCalledTimes(1);

        scene.player.x = 400;
        scene.updateCurrentEcologyNodeProximity();
        expect(scene.currentEcologyPlayerNearby).toBe(false);
        expect(prompt.setVisible).toHaveBeenLastCalledWith(false);
        expect(prompt.input.enabled).toBe(false);
        expect(zone.input.enabled).toBe(false);
        expect(scene.requestCurrentEcologyInteraction()).toBe(false);
        expect(scene.showCurrentEcologyModal).toHaveBeenCalledTimes(1);
    });

    test('ground contact cannot trigger anti-stuck movement while a real wedge still recovers', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'AntiStuckTest' });
        const setPosition = jest.fn();
        const setVelocity = jest.fn();
        scene.player = {
            x: 320,
            y: 1091,
            body: {
                velocity: { x: 0, y: 0 },
                blocked: { down: true, left: false, right: false },
                embedded: true
            },
            setPosition,
            setVelocity
        };
        scene.time = { delayedCall: jest.fn() };

        for (let frame = 0; frame < 60; frame += 1) {
            scene.checkAndFixStuckPlayer();
        }

        expect(setPosition).not.toHaveBeenCalled();
        expect(scene.stuckFrameCount).toBe(0);

        scene.player.body.blocked.left = true;
        for (let frame = 0; frame < 31; frame += 1) {
            scene.checkAndFixStuckPlayer();
        }

        expect(setPosition).toHaveBeenCalledTimes(1);
        expect(setPosition).toHaveBeenCalledWith(370, 991);
        expect(setVelocity).toHaveBeenCalledWith(100, -100);
    });

    test('route enemy retirement disposes owned timers and attack artifacts atomically', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'EnemyRuntimeTest' });
        const timerA = { remove: jest.fn() };
        const timerB = { remove: jest.fn() };
        const artifact = { destroy: jest.fn() };
        const cue = { destroy: jest.fn() };
        const label = { destroy: jest.fn() };
        const graphics = { destroy: jest.fn() };
        const enemy = {
            active: true,
            combatCue: cue,
            instructionLabel: label,
            graphics,
            destroy: jest.fn()
        };
        scene.tweens = { killTweensOf: jest.fn() };

        scene.trackEnemyTimer(enemy, timerA);
        scene.trackEnemyTimer(enemy, timerB);
        scene.trackEnemyArtifact(enemy, artifact);
        const retirement = scene.retireRouteEnemies([enemy]);

        expect(retirement).toEqual({
            enemyCount: 1,
            timerCount: 2,
            artifactCount: 1
        });
        expect(timerA.remove).toHaveBeenCalledWith(false);
        expect(timerB.remove).toHaveBeenCalledWith(false);
        expect(artifact.destroy).toHaveBeenCalledTimes(1);
        expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(artifact);
        expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(enemy);
        expect(cue.destroy).toHaveBeenCalledTimes(1);
        expect(label.destroy).toHaveBeenCalledTimes(1);
        expect(graphics.destroy).toHaveBeenCalledTimes(1);
        expect(enemy.destroy).toHaveBeenCalledTimes(1);
        expect(scene.enemyRuntimeDisposalTotals).toEqual({
            timerCount: 2,
            artifactCount: 1
        });
    });

    test('all guardian handoffs share route-enemy cleanup and transient AI owns its timers', () => {
        [
            'levels/MythicalForestLevel.js',
            'levels/CrystalCavesLevel.js',
            'levels/ReefLevel.js',
            'levels/VoidPeaksLevel.js',
            'levels/AuroraDepthsLevel.js',
            'levels/FinalVoidLevel.js'
        ].forEach(relativePath => {
            expect(read(relativePath)).toContain(
                'this.retireRouteEnemies(patrols)'
            );
        });

        const forest = read('levels/MythicalForestLevel.js');
        const caves = read('levels/CrystalCavesLevel.js');
        expect((forest.match(/this\.trackEnemyTimer\(/g) || []).length)
            .toBeGreaterThanOrEqual(2);
        expect(forest).toContain('this.forestEnemyAISchedulerActive = true;');
        expect(forest).toContain('this.forestEnemyAISchedulerActive = false;');
        expect((caves.match(/this\.trackEnemyTimer\(/g) || []).length).toBe(2);
        expect(caves).toContain('startCaveEnemyAIScheduler()');
        expect(caves).toContain('updateCaveEnemyActivation(force = false)');
        expect(caves).toContain('updateCaveEnemyAI(time, force = false)');
        expect(caves).toContain('setCaveEnemyRenderAttached(enemy, attached)');
        expect(caves).toContain('enemy.body.enable = false;');
        expect(caves).toContain('enemy.body.enable = true;');
        expect(caves).toContain('this.spiderAttackTimer.paused = !nextState;');
        expect(caves).toContain('this.spiderWebSprayTimer.paused = !nextState;');
        expect(caves).not.toContain('callback: () => this.updateBatPatrol(bat)');
        expect(caves).not.toContain('callback: () => this.updateCrawlerPatrol(crawler)');
        expect(caves).not.toContain('callback: () => this.updateCrystalSpiderAI()');
        expect(forest).toContain('this.trackEnemyArtifact(sprite, projectile);');
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

    test('enemy stomp profiles match authored damage instead of raw health', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'StompProfileTest' });

        expect(scene.getEnemyStompProfile({
            health: 2,
            maxHealth: 2
        })).toEqual({
            stompable: true,
            damagePerStomp: 2,
            stompsRemaining: 1,
            totalStomps: 1,
            blocked: false
        });
        expect(scene.getEnemyStompProfile({
            health: 1,
            maxHealth: 2
        })).toEqual({
            stompable: true,
            damagePerStomp: 2,
            stompsRemaining: 1,
            totalStomps: 1,
            blocked: false
        });
        expect(scene.getEnemyStompProfile({
            health: 4,
            maxHealth: 5,
            stompDamage: 1
        })).toEqual({
            stompable: true,
            damagePerStomp: 1,
            stompsRemaining: 4,
            totalStomps: 5,
            blocked: false
        });
        expect(scene.getEnemyStompProfile({
            health: 3,
            maxHealth: 5,
            stompDamage: 2
        })).toEqual({
            stompable: true,
            damagePerStomp: 2,
            stompsRemaining: 2,
            totalStomps: 3,
            blocked: false
        });
        expect(scene.getEnemyStompProfile({
            health: 3,
            maxHealth: 3,
            stompable: false
        })).toEqual({
            stompable: false,
            damagePerStomp: 3,
            stompsRemaining: null,
            totalStomps: null,
            blocked: false
        });
    });

    test('combat pips advertise and decrement the top hits still required', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'CombatPipTest' });
        const cue = {
            active: true,
            clear: jest.fn(),
            lineStyle: jest.fn(),
            lineBetween: jest.fn(),
            setAlpha: jest.fn(),
            fillStyle: jest.fn(),
            fillRect: jest.fn()
        };
        const enemy = {
            health: 5,
            maxHealth: 5,
            stompDamage: 1,
            stompable: true,
            combatCue: cue
        };

        scene.drawEnemyCombatCue(enemy);
        expect(cue.fillRect).toHaveBeenCalledTimes(5);

        cue.fillRect.mockClear();
        cue.fillStyle.mockClear();
        enemy.health = 4;
        scene.drawEnemyCombatCue(enemy);
        expect(cue.fillRect).toHaveBeenCalledTimes(5);
        expect(cue.fillStyle.mock.calls.filter(([, alpha]) => alpha === 0.95)).toHaveLength(4);
        expect(scene.getEnemyStompFeedback(enemy)).toEqual({
            text: 'STOMP · 4 HITS LEFT',
            color: '#F2C94C'
        });

        cue.fillRect.mockClear();
        cue.fillStyle.mockClear();
        enemy.health = 2;
        enemy.maxHealth = 2;
        enemy.stompDamage = 2;
        scene.drawEnemyCombatCue(enemy);
        expect(cue.fillRect).toHaveBeenCalledTimes(1);
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
        expect(source).toContain("activationSupportIds: ['forest-ground-3']");
        expect(source).toContain("activationSupportIds: ['forest-ground-5']");
        expect(source).toContain("activationSupportIds: ['forest-ground-6']");
    });

    test('Forest batches static scenery and enemy trails for mobile rendering', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain('this.forestTreeStructureLayer = this.add.graphics()');
        expect(source).toContain('this.forestFoliageLayer = this.add.graphics()');
        expect(source).toContain('targets: this.forestFoliageLayer');
        expect(source).toContain('this.forestBridgeLayer = this.add.graphics()');
        expect(source).toContain('detachForestPhysicsSupport(platform)');
        expect(source).toContain('platform.forestPhysicsOnly = true;');
        expect(source).toContain('this.children.remove(platform);');
        expect(source).toContain('this.detachForestPhysicsSupport(platformZone);');
        expect(source).toContain('this.detachForestPhysicsSupport(branchPlatform);');
        expect(source).toContain('this.detachForestPhysicsSupport(bridgeZone);');
        expect(source).toContain('startForestEnemyTrailRenderer()');
        expect(source).toContain('delay: this.isMobile ? 180 : 100');
        expect(source).toContain('sprite.x < view.left - 120');
        expect(source).toContain('sprite.forestTrail = sprite.forestTrail.slice(-3);');
        expect(source).toContain('this.forestEnemyOverlap = this.physics.add.overlap(');
        expect(source).toContain('(_player, enemy) => this.handleEnemyCollision(enemy)');
        expect(source).not.toContain('this.physics.add.overlap(this.player, sprite');
        expect(source).toContain('startForestEnemyAIScheduler()');
        expect(source).toContain('if (this.forestEnemyAISchedulerActive) this.updateForestEnemyAI();');
        expect(source).toContain('updateForestEnemyActivation()');
        expect(source).toContain('getForestEnemyActivationBounds()');
        expect(source).toContain('isForestEnemyReadyForSuspension(enemy)');
        expect(source).toContain('enemy.forestSettledForStreaming = true;');
        expect(source).toContain('const shouldStayActive = inWindow ||');
        expect(source).toContain('const horizontalMargin = this.isMobile ? 520 : 800;');
        expect(source).toContain('const verticalMargin = this.isMobile ? 280 : 420;');
        expect(source).toContain('enemy.body.enable = false;');
        expect(source).toContain('enemy.body.enable = true;');
        expect(source).toContain('const enemies = this.forestProximityEnemies || [];');
        expect(source).toContain('candidate => candidate !== enemy');
        expect(source).toContain('const actionBudget = this.isMobile ? 3 : 5;');
        expect(source).toContain('actionCount < actionBudget');
        expect(source).toContain('this.forestEnemyAICursor + scannedCount');
        expect(source).toContain('updateForestEnemyMotion(time)');
        expect(source).toContain('sprite.forestNextAiAt = now + sprite.forestAiInterval');
        expect(source).toContain('sprite.setVelocityX(sprite.direction * sprite.speed);');
        expect(source).not.toContain('sprite.x += sprite.direction * sprite.speed');
        expect(source).toContain('const FOREST_GROUND_SECTIONS = Object.freeze([');
        expect(source).toContain('FOREST_GROUND_SECTIONS.forEach(section => {');
        expect(source).toContain('.filter(section => Number.isFinite(section.enemyX))');
        expect(source).toContain('sprite.forestSupportId = support?.id || null;');
        expect(source).toContain('const supportedX = Phaser.Math.Clamp(');
        expect(source).toContain('sprite.setVelocityX(atSupportEdge ? 0 : direction * sprite.speed);');
        expect(source).not.toContain('{ x: 700, y: this.levelHeight - 150 }');
        expect(source).toContain('this.forestFoliageLayer.setAlpha(0.82);');
        expect(source).toContain('layer.fillStyle(color, this.isMobile ? 0.72 : 0.6);');
        expect(source).toContain('shouldAnimateForestDecorations()');
        expect(source).toContain('{ depth: 84, animate: animateRouteDecorations }');
        expect(source).toContain('sprite.setAngle(index * 18);');
        expect(source).toContain('this.forestArenaAmbientLayer = ambient;');
        expect(source).toContain('this.forestArenaAmbientTimer = this.time.addEvent({');
        expect(source).toContain("'forestArenaAmbientLayer'");
        expect(source).toMatch(
            /ensureForestCoinLayer\(\)[\s\S]*if \(!this\.isMobile\) \{[\s\S]*this\.forestCoinLayerTween/
        );
        expect(source).not.toContain('callback: () => this.updateVoidSpriteAI(sprite)');
        expect(source).not.toContain('targets: sprite,\n            y: y + 15');
        expect(source).toContain('if (!this.isMobile) {');
        expect(source).toContain('ensureForestCoinLayer()');
        expect(source).toContain('updateForestCoinPickups()');
        expect(source).toContain('x >= body.left - pickupPadding');
        expect(source).toContain('this.collectForestCoin(pickup, { redraw: false })');
        expect(source).not.toContain('this.forestCoinPickupGroup');
        expect(source).not.toContain('this.forestCoinPickupOverlap');
        expect(source).toContain('redrawForestCoinLayer()');
        expect(source).not.toContain('const branch = this.add.graphics();');
        expect(source).not.toContain('const shadow = this.add.graphics();');
        expect(source).toContain('setForestEnemyRenderAttached(enemy, attached)');
        expect(source).toContain(
            'this.setForestEnemyRenderAttached(enemy, false);'
        );
        expect(source).toContain(
            'this.setForestEnemyRenderAttached(enemy, true);'
        );
        expect(source).toContain(
            'enemy.body.blocked?.down || enemy.body.touching?.down'
        );
        expect(source).toContain(
            'Boolean(target) && target.active !== false'
        );

        const smokeSource = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smokeSource).toContain(
            "message: 'Forest shared enemy scheduler advance'"
        );
        expect(smokeSource).toContain('crawlerVelocityX');
        expect(smokeSource).toContain('crawlerNextDelay');
        expect(smokeSource).toContain(
            'target.forestNextAiAt = Number.POSITIVE_INFINITY;'
        );
        expect(smokeSource).toContain(
            'scene.updateForestEnemyActivation?.(true);'
        );
        expect(smokeSource).toContain('renderAttachedEnemyCount');
        expect(smokeSource).toContain('renderAttachedCueCount');
        expect(smokeSource).toContain('sleepingDetachedCount');
        expect(smokeSource).toContain('displayCount: 150');
        expect(smokeSource).toContain('state.displayCount > 150');
        expect(smokeSource).toContain('physicsOnlySupportCount !== 73');
        expect(smokeSource).toContain('physicsOnlySupportDisplayCount !== 0');
    });

    test('shared biome rendering batches ambient fields and uses a phone tier', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../systems/ParallaxBiome.js'),
            'utf8'
        );

        expect(source).toContain("this.performanceTier = scene?.detectMobile?.() ? 'mobile' : 'desktop';");
        expect(source).toContain("this.performanceTier === 'mobile'");
        expect(source).toContain("const wispCount = this.performanceTier === 'mobile' ? 3 : 5;");
        expect(source).toContain("const maxStarFields = this.performanceTier === 'mobile' ? 2 : 4;");
        expect(source).toContain("? Math.min(2, layer.count)");
        expect(source).toContain("const maxFloraFields = this.performanceTier === 'mobile' ? 1 : 3;");
        expect(source).toContain("type: 'starField'");
        expect(source).toContain("type: 'floraField'");
        expect(source).toContain('shouldAnimateAmbientFields()');
        expect(source).toContain('shouldUseContinuousAmbientEmitters()');
        expect(source).toContain("return this.performanceTier !== 'mobile'");
        expect(source).toContain("type: 'dustField'");
        expect(source).toContain('layer.animate && this.shouldAnimateAmbientFields()');
        expect(source).toContain('this.config.effects.enableTwinkling &&');
        expect(source).toContain('this.config.effects.enableGentleFloat &&');
        expect(source).toContain("Mobile tier skips post shader");
        expect(source).toContain('this.scene?.tweens?.killTweensOf?.(layer.object);');

        const smokeSource = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smokeSource).toContain('sharedAmbientFieldTweenCount');
        expect(smokeSource).toContain('framePacing.particleProcessors.length !== 0');
        expect(smokeSource).toContain("framePacing.performanceTier === 'mobile'");
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
        expect(source).toContain("activationSupportIds: ['caves-echo-upper']");
        expect(source).toContain("activationSupportIds: ['caves-grove-step']");
        expect(source).toContain("activationSupportIds: ['caves-guardian-left']");
        expect(source).toContain("fallbackLabel: 'FOLLOW THE BEACON ANCHORS'");
        expect(source).toContain('this.isPlayerGroundedOnTraversalSupport(');
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
    });

    test('Crystal Caves batches route coins without collectible physics bodies', () => {
        const source = read('levels/CrystalCavesLevel.js');

        expect(source).toContain('ensureCaveCoinLayer()');
        expect(source).toContain('redrawCaveCoinLayer()');
        expect(source).toContain('updateCaveCoinPickups()');
        expect(source).toContain('this.collectCaveCoin(pickup, { redraw: false })');
        expect(source).toContain('redrawCaveCrystalField()');
        expect(source).toContain('this.caveCrystalField.push(crystal);');
        expect(source).toContain('!Number.isFinite(crystal.lastDrawnAlpha)');
        expect(source).toContain('this.caveParallaxLayers.push(graphics);');
        expect(source).toContain("graphics.caveAmbientRole = 'brokenLantern';");
        expect(source).toContain("graphics.caveAmbientRole = 'minerSkeleton';");
        expect(source).toContain('if (!this.isMobile) {');
        expect(source).not.toContain("const coin = this.collectibles.create(x, y, textureKey);");
        expect(source).not.toContain('targets: coin,');

        const smokeSource = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smokeSource).toContain('caveAmbientRendering');
        expect(smokeSource).toContain('parallaxLayerCount !== 2');
        expect(smokeSource).toContain('storyDecorationTweenCount !== 0');
        expect(smokeSource).toContain('coinLayerTweenCount !== 0');
    });

    test('Stellar Reef batches ambient fields and bounds reusable cosmic dust', () => {
        const source = read('levels/ReefLevel.js');
        const smokeSource = read('../../scripts/smoke-secondary-journeys.js');

        expect(source).toContain('for (let layerIndex = 0; layerIndex < 2; layerIndex += 1)');
        expect(source).toContain('this.voidRifts.push(riftLayer);');
        expect(source).toContain('this.cosmicDustParticles.length >= particleLimit');
        expect(source).toContain('shouldAnimateReefDecorations()');
        expect(source).toContain('updateCosmicDust(delta)');
        expect(source).toContain('targets: [...allElements, entryParticles].filter(Boolean)');
        expect(source).toContain('detachReefPhysicsBody(body)');
        expect(source).toContain('this.children.remove(body);');
        expect(source).toContain('startReefEnemyAIScheduler()');
        expect(source).toContain('updateReefEnemyActivation(force = false)');
        expect(source).toContain('updateReefEnemyAI(time)');
        expect(source).toContain('setReefEnemyRenderAttached(enemy, attached)');
        expect(source).toContain('this.reefTrailParticles.length >= particleLimit');
        expect(source).toContain('updatePlayerCosmicTrail(delta)');
        expect(source).not.toContain('targets: trail');
        expect(source).not.toContain('this.nebulaParticles.push(wisp);');
        expect(source).not.toContain('this.voidRifts.push(rift);');
        expect(smokeSource).toContain('state.reefEnemyRuntime?.scheduledEnemyCount !== 8');
        expect(smokeSource).toContain('state.reefEnemyRuntime?.physicsOnlyBodyCount !== 34');
        expect(smokeSource).toContain('state.reefEnemyRuntime?.physicsOnlyDisplayCount !== 0');
        expect(smokeSource).toContain('async function smokeReefTrailBudget(session)');
        expect(smokeSource).toContain('result.peak.particleCount !== 8');
        expect(smokeSource).toContain('result.peak.tweenDelta !== 0');
        expect(smokeSource).toContain('displayCount: 150');
        expect(smokeSource).toContain('activeTweenCount: 16');
    });

    test('Void Peaks batches stars and bounds ember redraws by viewport movement', () => {
        const source = read('levels/VoidPeaksLevel.js');
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(source).toContain('this.peakStarField = Array.from({ length: 35 }');
        expect(source).toContain('this.peakStarLayer = this.add.graphics()');
        expect(source).toContain('this.peakEmbers = Array.from({ length: 18 }');
        expect(source).toContain('drawPeakEmbers(time)');
        expect(source).toContain('this.drawPeakEmbers(0, true);');
        expect(source).toContain('const redrawDistance = Math.max(180, (right - left) * 0.45);');
        expect(source).toContain('const renderTime = compactViewport ? 0 : now;');
        expect(source).toContain('ember.x < left - 140 || ember.x > right + 140');
        expect(source).toContain('this.peakEmberDrawCount += 1;');
        expect(source).toContain('this.peakEmberLayer.fillCircle(');
        expect(source).toMatch(
            /createStarFragments\(\)[\s\S]*if \(animateRouteDecorations\) \{[\s\S]*targets: fragment,/
        );
        expect(source).toMatch(
            /this\.collectibles\.add\(fragment\);\s*fragment\.body\.setAllowGravity\(false\);\s*fragment\.body\.setVelocity\(0, 0\);/
        );
        expect(source).toMatch(
            /createPeakRouteChoiceMarkers\(\)[\s\S]*if \(this\.shouldAnimatePeakRouteDecorations\(\)\) \{[\s\S]*targets: \[spine, relicRoute\]/
        );
        expect(source).toContain('updatePeakEnemyPatrols(time)');
        expect(source).toContain('this.peakEnemyPatrolNextAt = now + (this.isMobile ? 80 : 40);');
        expect(source).toContain('startPeakEnemyScheduler()');
        expect(source).toContain('updatePeakEnemyActivation(force = false)');
        expect(source).toContain('setPeakEnemyRenderAttached(enemy, attached)');
        expect(source).toContain('getRuntimePatrolEnemies()');
        expect(source).toContain('this.peakProximityEnemies');
        expect(source).toContain('return this.updatePeakEnemyPatrols(this.time?.now);');
        expect(source).toContain('enemy.patrolSpeed');
        expect(source).toContain('const toastY = isMobileLayout');
        expect(source).toContain('y: toastY - 20');
        expect(source).not.toContain('targets: ember,');
        expect(smoke).toContain('state.peakEnemyRuntime?.scheduledEnemyCount !== 8');
        expect(smoke).toContain('state.peakEnemyRuntime?.proximityActiveCount > 3');
        expect(smoke).toContain('state.peakEnemyRuntime?.runtimePatrolCount !==');
        expect(smoke).toContain('guardianEntry.peakEnemyAISchedulerActive !== false');
        expect(smoke).toContain('smokePeakEnemyActivationWindow(session)');
        expect(smoke).toContain('Peaks enemy activation did not wake before contact');
        expect(smoke).toContain('Peaks enemy activation did not suspend after departure');
        expect(smoke).toMatch(
            /voidPeaks: Object\.freeze\(\{[\s\S]*displayCount: 165,[\s\S]*activeTweenCount: 10,/
        );
    });

    test('Aurora Depths streams patrols and keeps mobile route cues static', () => {
        const source = read('levels/AuroraDepthsLevel.js');
        const platformerSource = read('PlatformerLevelScene.js');
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(platformerSource).toContain('getRuntimePatrolEnemies()');
        expect(platformerSource).toContain('const enemies = this.getRuntimePatrolEnemies();');
        expect(source).toContain('startAuroraEnemyScheduler()');
        expect(source).toContain('updateAuroraEnemyActivation(force = false)');
        expect(source).toContain('setAuroraEnemyRenderAttached(enemy, attached)');
        expect(source).toContain('getRuntimePatrolEnemies()');
        expect(source).toContain('this.auroraProximityEnemies');
        expect(source).toContain('this.isMobile ? 80 : 40');
        expect(source).toContain('shouldAnimateAuroraDecorations()');
        expect(source).toMatch(
            /createQuietLightRoute\(\)[\s\S]*if \(this\.shouldAnimateAuroraDecorations\(\)\) \{[\s\S]*targets: route,/
        );
        expect(source).toMatch(
            /createAuroraFragments\(\)[\s\S]*if \(this\.shouldAnimateAuroraDecorations\(\)\) \{[\s\S]*targets: fragmentTargets,/
        );
        expect(source).toContain('{ animate: this.shouldAnimateAuroraDecorations() }');
        expect(smoke).toContain('state.auroraEnemyRuntime?.scheduledEnemyCount !== 8');
        expect(smoke).toContain('state.auroraEnemyRuntime?.proximityActiveCount > 3');
        expect(smoke).toContain('state.auroraEnemyRuntime?.runtimePatrolCount !==');
        expect(smoke).toContain('guardianEntry.auroraEnemyAISchedulerActive !== false');
        expect(smoke).toContain('framePacing.auroraRuntime?.patrolUpdatesDuringSample > 28');
        expect(smoke).toContain('smokeAuroraEnemyActivationWindow(session)');
        expect(smoke).toContain('Aurora enemy activation did not wake before contact');
        expect(smoke).toContain('Aurora enemy activation did not suspend after departure');
        expect(smoke).toContain("'depth:105:visible'");
        expect(smoke).toContain("'depth:179:visible'");
        expect(smoke).toContain('displayCount: 160');
        expect(smoke).toContain('activeTweenCount: 15');
    });

    test('shared route guidance resets before the first invalid contact', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source.match(/this\.routeHintUntil = 0;/g)?.length).toBeGreaterThanOrEqual(2);
        expect(source).toContain('now >= (Number(this.routeHintUntil) || 0)');
    });

    test('shared transport settlement is stricter than route-trigger coyote time', () => {
        const source = read('PlatformerLevelScene.js');
        const settlement = source.slice(
            source.indexOf('isPlayerSettledOnTraversalSupport(ids, {'),
            source.indexOf('\n    isPlayerCommittedToRouteChoice', source.indexOf(
                'isPlayerSettledOnTraversalSupport(ids, {'
            ))
        );

        expect(settlement).toContain('horizontalInset = 8');
        expect(settlement).toContain('surfaceTolerance = 7');
        expect(settlement).toContain('body.velocity?.y < -1');
        expect(settlement).toContain('Math.abs(body.bottom - support.body.top) <= surfaceTolerance');
        expect(source).toContain(
            'this.isPlayerGroundedOnTraversalSupport(supportIds);'
        );
    });

    test('shared route choices use the physics body rather than padded artwork', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain(
            'this.player?.body?.center?.x ?? this.player?.x'
        );
        expect(source).toContain(
            'this.player?.body?.center?.y ?? this.player?.y'
        );
    });

    test('Stellar Reef spawns above its opening floating platform', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain('createPlayer() {');
        expect(source).toContain('this.player.setPosition(200, this.levelHeight - 290);');
        expect(source).toContain('this.player.setVelocity(0, 0);');
    });

    test('Mythical Forest spawns above its authored first ground section', () => {
        const platformer = read('PlatformerLevelScene.js');
        const forest = read('levels/MythicalForestLevel.js');
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(platformer).toContain('getPlayerSpawnGroundTopY()');
        expect(platformer).toContain('const groundTopY = this.getPlayerSpawnGroundTopY();');
        expect(forest).toMatch(
            /getPlayerSpawnGroundTopY\(\)\s*\{\s*return this\.levelHeight - 100;/
        );
        expect(smoke).toContain("scene?.getTraversalSupport?.('forest-ground-1')");
        expect(smoke).toContain('playerGrounded &&');
    });

    test('Stellar Reef offers a finite resource detour that rejoins the route', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain("title: 'STAR TRENCH'");
        expect(source).toContain("rewardLabel: 'FREE SUPER BLAST'");
        expect(source).toContain(
            "mainTradeoff: 'FAST + PATROLS\\nEARNS: NEXT KATANA HIT +2'"
        );
        expect(source).toContain(
            "challengeLabel: 'DEEP WATER + 2 RELICS'"
        );
        expect(source).toContain("returnLabel: 'STAR TRENCH RETURN ↑ // DRIFT ROUTE →'");
        expect(source).toContain('this.freeSpecialAttackCharges += 1;');
        expect(source).toContain('createAbyssAscentCurrent()');
        expect(source).toContain('this.activeReefAscentCurrent = {');
        expect(source).toContain(
            'body.bottom < current.bottom - 180'
        );
        expect(source).toContain('activateReefAscentCurrent(current, mode');
        expect(source).toContain('updateReefAscentCurrentGuidance()');
        expect(read('PlatformerLevelScene.js')).toContain(
            'isPlayerSettledOnTraversalSupport(ids, {'
        );
        expect(source).toContain(
            'this.isPlayerSettledOnTraversalSupport(active.destinationId)'
        );
        expect(source).toContain("phase: 'lift'");
        expect(source).toContain("active.phase = 'settle'");
        expect(source).toContain("id: 'reef_star_trench'");
        expect(source).toContain('optional: true');
        expect(source).toContain("activationSupportIds: ['reef-trench-3']");
        expect(source).toContain("destinationId: 'reef-drive-step'");
        expect(source).toContain(
            "{ x: 1750, y: this.levelHeight - 225, optionalRouteId: 'reef_star_trench' }"
        );
        expect(source).toContain(
            "{ x: 2250, y: this.levelHeight - 220, optionalRouteId: 'reef_star_trench' }"
        );
        expect(source).toContain('this.virtualJumpQueued;');
        expect(source).toContain('this.virtualJumpQueued = false;');
    });

    test('Stellar Reef uses eight support-authored combat beats', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain('const REEF_ENCOUNTER_PLAN = Object.freeze([');
        [
            'opening-phase-lesson',
            'drift-relay-clear',
            'main-current-charge',
            'star-trench-wraith',
            'drive-approach-phase',
            'traveler-relay-charge',
            'passage-bridge-clear',
            'guardian-current-wraith'
        ].forEach(beat => expect(source).toContain(`beat: '${beat}'`));
        expect(source).toContain('this.createReefEncounterRhythm();');
        expect(source).toContain('resolveReefEncounterPlacement(encounter)');
        expect(source).toContain('enemy.encounterSupportId = encounter.supportId;');
        expect(source).toContain('enemy.encounterAirborne = true;');
        expect(source).not.toContain('this.spawnVoidSpores();');
        expect(source).not.toContain('this.spawnPlasmaDarts();');
        expect(source).not.toContain('this.spawnPhaseDrifters();');
        expect(source).not.toContain('this.spawnLureWraiths();');
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
        expect(source).toContain('const PEAK_ENCOUNTER_PLAN = Object.freeze([');
        expect(source).toContain("beat: 'opening-clear'");
        expect(source).toContain("beat: 'warning-line-guard'");
        expect(source).toContain("beat: 'titan-overlook'");
        expect(source).toContain("supportId: 'peak-opening-step'");
        expect(source).toContain(
            "[300, groundY - 145, 210, 'solid', 'peak-opening-step']"
        );
        expect(source).toContain(
            "[600, groundY - 245, 180, 'solid', 'peak-opening-rise']"
        );
        expect(source).toContain(
            "[980, groundY - 150, 460, 'solid', 'peak-lower-relay-overlook']"
        );
        expect(source).toContain("supportId: 'peak-floor-summit'");
        expect(source).toContain("supportId: 'peak-titan-overlook'");
        expect(source).toContain("lane: 'main'");
        expect(source).not.toContain("lane: 'optional'");
        expect(source).toContain('enemy.encounterBeat = encounter.beat;');
        expect(source).toContain('enemy.encounterSupportId = encounter.supportId;');
        expect(source).toContain(
            "role: encounter.health >= 3 ? 'armored' : 'stompable'"
        );
        expect(source).toContain('retirePeakPatrolsForTitan()');
        expect(source).toContain('this.retireRouteEnemies(patrols);');
        expect(source).toContain('this.retirePeakPatrolsForTitan();');
        expect(source).toContain("mainLabel: 'LOW WARNING LINE →'");
        expect(source).toContain(
            "mainTradeoff: 'SHORT + RISKY\\nEARNS: TITAN SURGE // 1 FREE BLAST'"
        );
        expect(source).toContain(
            "challengeLabel: 'HIGH RIDGE // 2 RELICS, FEWER GUARDS'"
        );
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
        expect(source).toContain('rise: current.bottom - current.top - 20');
        expect(source).toContain('this.player.setVelocityY(Math.max(launchVelocity, -470))');
        expect(source).toContain('this.activePeakReturnCurrent = {');
        expect(source).toContain('updatePeakReturnCurrentGuidance()');
        expect(source).toContain('this.isPlayerSettledOnTraversalSupport(active.destinationId)');
        expect(source).toContain('this.player.setVelocityX(correction)');
        expect(source).toContain("phase: 'lift'");
        expect(source).toContain("active.phase = 'settle'");
        expect(source).toContain('if (this.isPlayerDead || this.isRespawning)');
        expect(source).toContain('platform.traversalId = id;');
        expect(source).toContain("arrivalGround.traversalId = 'peak-ground-arrival'");
        expect(source).toContain("lowerRelayGround.traversalId = 'peak-ground-lower-relay'");
        expect(source).toContain("titanGround.traversalId = 'peak-ground-titan-pass'");
        expect(source).toContain("'peak-lower-relay-overlook'");
        expect(source).toContain("'peak-summit-relay'");
        expect(source).toContain("'peak-relic-ridge-1'");
        expect(source).toContain("'peak-relic-ridge-4'");
        expect(source).toContain("gate.traversalId = 'peak-titan-gate'");
        expect(source).toContain("mainSupportIds: [");
        expect(source).toContain("optionalSupportIds: ['peak-relic-ridge-1']");
        expect(source).toContain("rejoinSupportIds: ['peak-summit-relay']");
        expect(source).toContain("this.createTraversalLandingGuide(\n                    relay.activationSupportIds[0]");
        expect(source).toContain("checkpoint: this.getTraversalSupportCheckpoint(");
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

        expect(source).toContain('const AURORA_ENCOUNTER_PLAN = Object.freeze([');
        expect(source).toContain("beat: 'opening-clear'");
        expect(source).toContain("beat: 'shadow-current-entry'");
        expect(source).toContain("beat: 'phoenix-overlook-armor'");
        expect(source).toContain("supportId: 'aurora-opening-step'");
        expect(source).toContain("supportId: 'aurora-ground-3'");
        expect(source).toContain("supportId: 'aurora-phoenix-overlook'");
        expect(source).toContain("lane: 'main'");
        expect(source).not.toContain("lane: 'optional'");
        expect(source).toContain('enemy.encounterBeat = encounter.beat;');
        expect(source).toContain('enemy.encounterLane = encounter.lane;');
        expect(source).toContain('enemy.encounterSupportId = encounter.supportId;');
        expect(source).toContain('retireAuroraPatrolsForPhoenix()');
        expect(source).toContain('this.retireRouteEnemies(patrols);');
        expect(source).toContain('this.retireAuroraPatrolsForPhoenix();');
        expect(source).toContain('const quietLightRoute = [');
        expect(source).toContain("'aurora-heart-launch'");
        expect(source).toContain("'aurora-quiet-step-1'");
        expect(source).toContain("'aurora-quiet-step-3'");
        expect(source).toContain("id: 'aurora_prism_2'");
        expect(source).toContain("activationSupportIds: ['aurora-heart-launch']");
        expect(source).toContain("activationSupportIds: ['aurora-quiet-step-3']");
        expect(source).toContain("activationSupportIds: ['aurora-phoenix-gate']");
        expect(source).toContain("recoveryGround.forEach(([x, width, id]) => {");
        expect(source).not.toContain('recoveryFloor.traversalId');
        expect(source).toContain("id: 'aurora_quiet_light_shelter'");
        expect(source).toContain('optional: true');
        expect(source).toContain("mainLabel: 'SHADOW CURRENT →'");
        expect(source).toContain(
            "mainTradeoff: 'SHORTER // 2 GUARDS // YOUR NEXT HIT +2'"
        );
        expect(source).toContain(
            "challengeLabel: 'HIGH JUMPS // 1-HIT WARD // FEWER GUARDS'"
        );
        expect(source).toContain("id: 'aurora_quiet_light'");
        expect(source).toContain('claimQuietLightPickup(shelter = this.optionalRoutePickup)');
        expect(source).toContain("rewardLabel: 'QUIET LIGHT WARD // 1 HIT'");
        expect(source).toContain("this.grantOptionalRouteGuard('QUIET LIGHT WARD', 1)");
        expect(source).toContain("this.selectAuroraRoute('shadow_current')");
        expect(source).toContain('LAND + ALIGN');
        expect(source).toContain('this.phoenixLandingGuide = this.createTraversalLandingGuide(');
        expect(source).toContain(
            "!this.isPlayerGroundedOnTraversalSupport('aurora-quiet-step-3')"
        );
        expect(source).toContain('const routeBonus = this.consumeCurrentCharge();');
        expect(source).toContain('this.currentChargeAuraTween?.remove?.();');
        expect(source).toContain(
            "'CURRENT CHARGE // YOUR NEXT HIT +2 DAMAGE'"
        );
        expect(source).toContain(
            "'DIRECT ROUTE // YOUR NEXT HIT +2 DAMAGE'"
        );
        expect(source).not.toContain('PHOENIX HITS HARDER');
        expect(source).not.toContain('NEXT PHOENIX HIT +2');
        expect(source).not.toContain('this.activateShield();');
        const smoke = read('../../scripts/smoke-secondary-journeys.js');
        expect(smoke).toContain(
            "scene.selectAuroraRoute('shadow_current')"
        );
        expect(smoke).toContain('route impact contradicted its promise');
    });

    test('Forest canopy traversal earns a persistent one-hit guard', () => {
        const source = read('levels/MythicalForestLevel.js');

        expect(source).toContain("id: 'forest_canopy_run'");
        expect(source).toContain("rewardLabel: 'CANOPY GUARD // 1 HIT'");
        expect(source).toContain("optionalRouteId: 'forest_canopy_run'");
        expect(source).toContain(
            "x: 2700,\n                y: this.levelHeight - 100 - 800 - 30,\n                hint: 'Tree 4 peak'"
        );
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
        const platformerSource = read('PlatformerLevelScene.js');
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(source).toContain('const CAVE_ENCOUNTER_PLAN = Object.freeze([');
        expect(source).toContain("beat: 'opening-stomp-lesson'");
        expect(source).toContain("beat: 'lower-passage-armor'");
        expect(source).toContain("beat: 'spider-walk-miniboss'");
        expect(source).toContain("beat: 'guardian-approach-armor'");
        expect(source).toContain("supportId: 'caves-ground-entry'");
        expect(source).toContain("supportId: 'caves-lower-2'");
        expect(source).toContain("supportId: 'caves-spider-arena'");
        expect(source).toContain("supportId: 'caves-guardian-approach'");
        expect(source).toContain("lane: 'main'");
        expect(source).toContain("lane: 'optional'");
        expect(source).toContain('enemy.encounterAirborne = true;');
        expect(source).toContain('enemy.encounterBeat = encounter.beat;');
        expect(source).toContain(
            "role: health >= 3 ? 'armored' : 'stompable'"
        );
        expect(source).toContain("id: 'caves_secret_slide'");
        expect(source).toContain("title: 'SPIDER WALK'");
        expect(source).toContain("rewardLabel: 'CRYSTAL WARD // 1 HIT'");
        expect(source).toContain("shield.optionalRouteId = 'caves_secret_slide'");
        expect(source).toContain("onMainSelected: () => this.selectCrystalChamberRoute('main')");
        expect(source).toContain("onOptionalSelected: () => this.selectCrystalChamberRoute('optional')");
        expect(source).toContain(
            "mainTradeoff: 'SHORT // ARMORED CRAWLER\\nEARNS: CRYSTAL FOCUS // NEXT SHOT x2'"
        );
        expect(source).toContain(
            "challengeLabel: 'SPIDER + SLIDE // EARN 1-HIT WARD'"
        );
        expect(source).toContain("'CALM THE CRYSTAL SPIDER FIRST'");
        expect(source).toContain('restoreCrystalChamberRoute(resume.routeState');
        expect(source).toContain('crystalWardGuardCharges');
        expect(source).toContain('crystalFocusReady');
        expect(source).toContain('onNextRangedDamageConsumed()');
        expect(source).toContain('shouldAnimateCrystalRouteDecorations()');
        expect(source).toContain('{ depth: 84, animate: animateRouteDecorations }');
        expect(source).toContain('!this.bossFightActive');
        expect(source).toContain("this.grantOptionalRouteGuard('CRYSTAL WARD', 1)");
        expect(source).not.toContain('this.activateShield();');
        expect(platformerSource).toContain(
            'this.onNextRangedDamageConsumed?.(rangedDamage);'
        );
        expect(smoke).toContain('lower passage selection');
        expect(smoke).toContain('CRYSTAL FOCUS x2 READY');
        expect(smoke).toContain(
            'The Spider Walk must be proven from an independent clean scene'
        );
        expect(smoke).toContain(
            'kept offscreen cave guidance animating on mobile'
        );
        expect(smoke).toContain("'caves-chamber-bridge'");
    });

    test('Final Void rewards the Trust Bridge with one reliable rescue', () => {
        const source = read('levels/FinalVoidLevel.js');

        expect(source).toContain('const FINAL_ENCOUNTER_PLAN = Object.freeze([');
        expect(source).toContain("beat: 'opening-echo-clear'");
        expect(source).toContain("beat: 'return-approach-armor'");
        expect(source).toContain("beat: 'low-rift-clear'");
        expect(source).toContain("beat: 'trust-bridge-guard'");
        expect(source).toContain("beat: 'empress-seal-armor'");
        expect(source).toContain("supportId: 'final-opening-rise'");
        expect(source).toContain("supportId: 'final-rift-step-3'");
        expect(source).toContain("supportId: 'final-trust-bridge-2'");
        expect(source).toContain("supportId: 'final-empress-gate'");
        expect(source).toContain("lane: 'main'");
        expect(source).toContain("lane: 'optional'");
        expect(source).toContain('airborne: true');
        expect(source).toContain('enemy.encounterBeat = encounter.beat;');
        expect(source).toContain('enemy.encounterLane = encounter.lane;');
        expect(source).toContain('enemy.encounterSupportId = encounter.supportId;');
        expect(source).toContain('retireFinalPatrolsForEmpress()');
        expect(source).toContain('this.retireFinalPatrolsForEmpress();');
        expect(source).toContain('const groundIslands = [');
        expect(source).toContain('const mainRiftRoute = [');
        expect(source).toContain('const trustBridgeRoute = [');
        expect(source).toContain("'final-rift-step-1'");
        expect(source).toContain("'final-rift-step-4'");
        expect(source).toContain(
            "[1650, groundY - 100, 180, 'final-rift-step-1']"
        );
        expect(source).toContain(
            "[1850, groundY - 190, 190, 'final-rift-step-2']"
        );
        expect(source).toContain(
            "[2180, groundY - 150, 260, 'final-rift-step-4']"
        );
        expect(source).toContain("mainLabel: 'LOW RIFT CROSSING →'");
        expect(source).toContain(
            "mainTradeoff: 'SHORT JUMPS // RIFT DAMAGE + 2 GUARDS'"
        );
        expect(source).toContain(
            "challengeLabel: 'HIGH CLIMB + 1 GUARD // EARN RESCUE'"
        );
        expect(source).toContain("{ x: 930, width: 120, label: 'JUMP THE RIFT →' }");
        expect(source).toContain("{ x: 1720, width: 490, label: 'CHOOSE YOUR CROSSING' }");
        expect(source).not.toContain(
            "this.createPlatform(0, groundY, this.levelWidth, 80, 'solid');"
        );
        expect(source).toContain("id: 'final_trust_bridge'");
        expect(source).toContain('claimBondReservePickup(reserve = this.optionalRoutePickup)');
        expect(source).toContain("mainSupportIds: ['final-rift-step-1']");
        expect(source).toContain("optionalSupportIds: ['final-trust-bridge-1']");
        expect(source).toContain("rejoinSupportIds: ['final-rift-step-4']");
        expect(source).toContain("activationSupportIds: ['final-opening-step']");
        expect(source).toContain("activationSupportIds: ['final-return-route']");
        expect(source).toContain("activationSupportIds: ['final-rift-step-4']");
        expect(source).toContain("activationSupportIds: ['final-empress-gate']");
        expect(source).toContain('this.isPlayerGroundedOnTraversalSupport(');
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain("rewardLabel: 'BOND RESERVE // 1 RESCUE'");
        expect(source).toContain('onComplete: () => this.activateBondReserve()');
        expect(source).toContain("onOptionalSelected: () => this.selectFinalRoute('optional')");
        expect(source).toContain('trustBridgeCompleted: route?.completed === true');
        expect(source).toContain('restoreFinalRouteState(resume.routeState');
        expect(source).toContain('this.clearBondReservePickup();');
        expect(source).toContain('this.refreshPersistedExpeditionRouteState();');
        expect(source).toContain('incomingDamage = Math.max(0, this.health - 1);');
        expect(source).toContain('this.bondReserveEcho?.destroy?.();');
        expect(source).toContain('shouldAnimateFinalRouteDecorations()');
        expect(source).toContain('{ animate: animateRouteDecorations }');

        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smoke).toContain(
            "mainRouteEffect.finalRouteChoice !== 'main'"
        );
        expect(smoke).toContain(
            'low crossing failed to lock out its optional rescue'
        );
        expect(smoke).toContain(
            'Trust Bridge must be proven from an independent clean scene'
        );
        expect(smoke).toContain(
            'kept offscreen route decorations animating on mobile'
        );
        expect(smoke).toContain("'depth:115:visible'");
        expect(smoke).toContain("'depth:179:visible'");
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
            "mainTradeoff: 'SHORT // ARMORED CRAWLER\\nEARNS: CRYSTAL FOCUS // NEXT SHOT x2'",
            "challengeLabel: 'SPIDER + SLIDE // EARN 1-HIT WARD'"
        ],
        [
            'levels/ReefLevel.js',
            "id: 'reef_star_trench'",
            "mainLabel: 'CURRENT BOOST →'",
            "mainTradeoff: 'FAST + PATROLS\\nEARNS: NEXT KATANA HIT +2'",
            "challengeLabel: 'DEEP WATER + 2 RELICS'"
        ],
        [
            'levels/VoidPeaksLevel.js',
            "id: 'peaks_relic_ridge'",
            "mainLabel: 'LOW WARNING LINE →'",
            "mainTradeoff: 'SHORT + RISKY\\nEARNS: TITAN SURGE // 1 FREE BLAST'",
            "challengeLabel: 'HIGH RIDGE // 2 RELICS, FEWER GUARDS'"
        ],
        [
            'levels/AuroraDepthsLevel.js',
            "id: 'aurora_quiet_light'",
            "mainLabel: 'SHADOW CURRENT →'",
            "mainTradeoff: 'SHORTER // 2 GUARDS // YOUR NEXT HIT +2'",
            "challengeLabel: 'HIGH JUMPS // 1-HIT WARD // FEWER GUARDS'"
        ],
        [
            'levels/FinalVoidLevel.js',
            "id: 'final_trust_bridge'",
            "mainLabel: 'LOW RIFT CROSSING →'",
            "mainTradeoff: 'SHORT JUMPS // RIFT DAMAGE + 2 GUARDS'",
            "challengeLabel: 'HIGH CLIMB + 1 GUARD // EARN RESCUE'"
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

    test.each([
        [
            'levels/MythicalForestLevel.js',
            "mainSupportIds: ['forest-bridge-4']",
            "optionalSupportIds: ['forest-tree-4-branch-6']",
            "rejoinSupportIds: ['forest-bridge-10']"
        ],
        [
            'levels/CrystalCavesLevel.js',
            "mainSupportIds: ['caves-lower-2']",
            "optionalSupportIds: ['caves-spider-2']",
            "rejoinSupportIds: ['caves-grove-step']"
        ],
        [
            'levels/ReefLevel.js',
            "mainSupportIds: ['reef-current-bridge']",
            "optionalSupportIds: ['reef-trench-1']",
            "rejoinSupportIds: ['reef-drive-step']"
        ],
        [
            'levels/VoidPeaksLevel.js',
            "'peak-main-handoff'",
            "optionalSupportIds: ['peak-relic-ridge-1']",
            "rejoinSupportIds: ['peak-summit-relay']"
        ],
        [
            'levels/AuroraDepthsLevel.js',
            "mainSupportIds: ['aurora-ground-3']",
            "optionalSupportIds: ['aurora-quiet-step-1']",
            "'aurora-sky-rejoin'"
        ],
        [
            'levels/FinalVoidLevel.js',
            "mainSupportIds: ['final-rift-step-1']",
            "optionalSupportIds: ['final-trust-bridge-1']",
            "rejoinSupportIds: ['final-rift-step-4']"
        ]
    ])('%s binds each route lane to authored supports', (
        relativePath,
        mainSupport,
        optionalSupport,
        rejoinSupport
    ) => {
        const source = read(relativePath);

        expect(source).toContain(mainSupport);
        expect(source).toContain(optionalSupport);
        expect(source).toContain(rejoinSupport);
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
        expect(
            source.includes('checkpoint: {') ||
            source.includes('checkpoint: this.getTraversalSupportCheckpoint(') ||
            (
                source.includes('const checkpoint = this.getTraversalSupportCheckpoint(') &&
                source.includes('checkpoint,\n                start: () => this.startBossFight()')
            )
        ).toBe(true);
        expect(source).toContain('start: () => this.startBossFight()');
        expect(source).toContain('const guardianEntered = this.beginGuardianEncounter({');
    });

    test.each([
        [
            'levels/MythicalForestLevel.js',
            'retireForestPatrolsForElder()',
            'this.retireForestPatrolsForElder();'
        ],
        [
            'levels/CrystalCavesLevel.js',
            'retireCavePatrolsForGolem()',
            'this.retireCavePatrolsForGolem();'
        ],
        [
            'levels/ReefLevel.js',
            'retireReefPatrolsForNyxvoral()',
            'this.retireReefPatrolsForNyxvoral();'
        ],
        [
            'levels/VoidPeaksLevel.js',
            'retirePeakPatrolsForTitan()',
            'this.retirePeakPatrolsForTitan();'
        ],
        [
            'levels/AuroraDepthsLevel.js',
            'retireAuroraPatrolsForPhoenix()',
            'this.retireAuroraPatrolsForPhoenix();'
        ],
        [
            'levels/FinalVoidLevel.js',
            'retireFinalPatrolsForEmpress()',
            'this.retireFinalPatrolsForEmpress();'
        ]
    ])('%s retires route combat before its guardian begins', (
        relativePath,
        methodDeclaration,
        methodCall
    ) => {
        const source = read(relativePath);
        const platformerSource = read('PlatformerLevelScene.js');

        expect(source).toContain(methodDeclaration);
        expect(source).toContain(methodCall);
        expect(source).toContain('this.retireRouteEnemies(patrols);');
        expect(platformerSource).toContain('this.disposeEnemyRuntime(enemy);');
        expect(platformerSource).toContain('enemy?.combatCue?.destroy?.();');
        expect(platformerSource).toContain('enemy?.instructionLabel?.destroy?.();');
        expect(platformerSource).toContain('enemy?.destroy?.();');
    });

    test('Reef inherits shared safety and route updates from the platformer loop', () => {
        const reefSource = read('levels/ReefLevel.js');
        const platformerSource = read('PlatformerLevelScene.js');

        expect(reefSource).toContain('super.update(time, delta);');
        expect(platformerSource).toContain('this.checkFallOutOfBounds();');
        expect(platformerSource).toContain('this.updateOptionalRouteChoices();');
    });

    test.each([
        [
            'levels/AuroraDepthsLevel.js',
            'createAuroraSentinels',
            'auroraSentinel',
            'const encounters = AURORA_ENCOUNTER_PLAN.map('
        ],
        [
            'levels/FinalVoidLevel.js',
            'createVoidEchoSentinels',
            'voidEchoSentinel',
            'const encounters = FINAL_ENCOUNTER_PLAN.map('
        ]
    ])('%s has authored combat between its route signals', (
        relativePath,
        factoryName,
        enemyType,
        encounterDeclaration
    ) => {
        const source = read(relativePath);

        expect(source).toContain(`this.${factoryName}();`);
        expect(source).toContain(encounterDeclaration);
        expect(source).toContain(`enemyType: '${enemyType}'`);
        expect(source).toContain('health: 1');
        expect(source).toContain('health: 2');
        expect(source).toContain('health: 3');
        expect(source).toContain('instructionText: null');
    });

    test('shared sentinels use the universal combat and patrol contracts', () => {
        const source = read('PlatformerLevelScene.js');

        expect(source).toContain('createPatrolSentinels(encounters, {');
        expect(source).toContain('this.configureEnemyCombat(sentinel, {');
        expect(source).toContain('const airborne = encounter.airborne === true;');
        expect(source).toContain('sentinel.body.setAllowGravity(false);');
        expect(source).toContain("role: airborne ? 'flyer'");
        expect(source).toContain('updatePatrolEnemyMovement()');
        expect(source).toContain('this.updatePatrolEnemyMovement();');
        expect(source).toContain('getRuntimePatrolEnemies()');
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
            'CLUE RIGHT + UP // 1050m'
        );

        scene.player = { x: 1180, y: 700 };
        expect(scene.getOrderedRouteCompassText()).toBe('CLUE CLOSE // 50m');
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
            'CLUE RIGHT + UP // 550m'
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

    test('shared route choices can require a grounded named support', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'SupportRouteChoiceTest' });
        scene.showFloatingText = jest.fn();
        scene.optionalRouteRewards = new Map();
        scene.isGrounded = true;
        scene.player = {
            x: 150,
            y: 100,
            body: {
                left: 135,
                right: 165,
                bottom: 120,
                velocity: { y: 0 },
                blocked: { down: true },
                touching: { down: false }
            }
        };
        scene.platforms = {
            getChildren: () => [{
                traversalId: 'named-branch',
                body: { left: 100, right: 200, top: 120 }
            }]
        };

        const route = scene.registerOptionalRouteReward({
            id: 'support_branch',
            title: 'NAMED BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                optionalSupportIds: ['named-branch'],
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 }
            }
        });

        scene.player.body.velocity.y = -80;
        expect(scene.updateOptionalRouteChoices()).toBe(false);
        expect(scene.recordOptionalRouteProgress('support_branch')).toBe(false);
        expect(route.progress).toBe(0);
        expect(route.choice.selectedPath).toBeNull();

        scene.player.body.velocity.y = 0;
        expect(scene.updateOptionalRouteChoices()).toBe(true);
        expect(route.choice.selectedPath).toBe('optional');
        expect(route.choice.optionalSupportIds).toEqual(['named-branch']);
    });

    test('route topology audits every named main, optional, and rejoin landing', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'RouteSupportAuditTest' });
        scene.optionalRouteRewards = new Map();
        scene.platforms = {
            getChildren: () => [
                {
                    traversalId: 'main-landing',
                    x: 150,
                    body: {
                        enable: true,
                        left: 100,
                        right: 200,
                        top: 350,
                        bottom: 380
                    }
                },
                {
                    traversalId: 'optional-landing',
                    x: 150,
                    body: {
                        enable: true,
                        left: 100,
                        right: 200,
                        top: 150,
                        bottom: 180
                    }
                },
                {
                    traversalId: 'rejoin-landing',
                    x: 550,
                    body: {
                        enable: true,
                        left: 500,
                        right: 600,
                        top: 250,
                        bottom: 280
                    }
                }
            ]
        };
        scene.registerOptionalRouteReward({
            id: 'audited_branch',
            title: 'AUDITED BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 },
                mainSupportIds: ['main-landing'],
                optionalSupportIds: ['optional-landing'],
                rejoinSupportIds: ['rejoin-landing']
            }
        });

        const audit = scene.auditOptionalRouteChoiceSupports();

        expect(audit.passed).toBe(true);
        expect(audit.auditedRouteCount).toBe(1);
        expect(audit.routes[0].lanes.map(lane => lane.lane)).toEqual([
            'main',
            'optional',
            'rejoin'
        ]);
        expect(audit.routes[0].lanes.every(lane => lane.passed)).toBe(true);
    });

    test('route topology rejects missing, disabled, and misplaced named landings', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'BrokenRouteSupportAuditTest' });
        scene.optionalRouteRewards = new Map();
        scene.platforms = {
            getChildren: () => [
                {
                    traversalId: 'disabled-main',
                    x: 150,
                    body: {
                        enable: false,
                        left: 100,
                        right: 200,
                        top: 350,
                        bottom: 380
                    }
                },
                {
                    traversalId: 'misplaced-optional',
                    x: 450,
                    body: {
                        enable: true,
                        left: 400,
                        right: 500,
                        top: 150,
                        bottom: 180
                    }
                },
                {
                    traversalId: 'invalid-rejoin',
                    x: 550,
                    body: {
                        enable: true,
                        left: 500,
                        right: 600,
                        top: Number.NaN,
                        bottom: 280
                    }
                }
            ]
        };
        scene.registerOptionalRouteReward({
            id: 'broken_branch',
            title: 'BROKEN BRANCH',
            rewardLabel: 'ONE GUARD',
            choice: {
                mainZone: { left: 100, right: 200, top: 300, bottom: 450 },
                optionalZone: { left: 100, right: 200, top: 50, bottom: 200 },
                rejoinZone: { left: 500, right: 600, top: 100, bottom: 400 },
                mainSupportIds: ['disabled-main'],
                optionalSupportIds: ['misplaced-optional'],
                rejoinSupportIds: ['missing-rejoin', 'invalid-rejoin']
            }
        });

        const audit = scene.auditOptionalRouteChoiceSupports();
        const lanes = Object.fromEntries(
            audit.routes[0].lanes.map(lane => [lane.lane, lane])
        );

        expect(audit.passed).toBe(false);
        expect(lanes.main.missingSupportIds).toEqual(['disabled-main']);
        expect(lanes.optional.outsideZoneSupportIds).toEqual([
            'misplaced-optional'
        ]);
        expect(lanes.rejoin.missingSupportIds).toEqual(['missing-rejoin']);
        expect(lanes.rejoin.invalidGeometrySupportIds).toEqual([
            'invalid-rejoin'
        ]);
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

    test('a queued mobile jump survives a slow grounded cooldown frame', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'JumpCooldownBufferTest' });
        scene.jumpKey = { isDown: false };
        scene.cursors = { up: { isDown: false } };
        scene.wasdKeys = { W: { isDown: false } };
        scene.isGrounded = true;
        scene.canJump = false;
        scene.lastGroundedTime = 1000;
        scene.executeJump = jest.fn(() => {
            scene.jumpBufferPressed = false;
            scene.jumpBufferFramesRemaining = 0;
            scene.clearVirtualJumpInput();
        });

        scene.queueVirtualJumpInput();
        scene.releaseVirtualJumpInput();
        scene.handleJump(1000);

        expect(scene.executeJump).not.toHaveBeenCalled();
        expect(scene.jumpBufferPressed).toBe(true);
        expect(scene.virtualJumpQueued).toBe(false);

        scene.canJump = true;
        scene.handleJump(1300);

        expect(scene.executeJump).toHaveBeenCalledTimes(1);
        expect(scene.jumpBufferPressed).toBe(false);
        expect(scene.jumpBufferFramesRemaining).toBe(0);
    });

    test('a queued mobile jump survives a low-FPS platform seam settle', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'JumpSeamBufferTest' });
        scene.jumpKey = { isDown: false };
        scene.cursors = { up: { isDown: false } };
        scene.wasdKeys = { W: { isDown: false } };
        scene.player = {
            body: {
                blocked: { down: false },
                touching: { down: false },
                velocity: { y: 25 }
            }
        };
        scene.isGrounded = false;
        scene.canJump = true;
        scene.lastGroundedTime = 0;
        scene.executeJump = jest.fn(() => {
            scene.jumpBufferPressed = false;
            scene.jumpBufferFramesRemaining = 0;
            scene.clearVirtualJumpInput();
        });

        scene.queueVirtualJumpInput();
        scene.releaseVirtualJumpInput();
        scene.handleJump(1000);
        for (let frame = 1; frame <= 7; frame += 1) {
            scene.handleJump(1000 + frame * 200);
        }

        expect(scene.executeJump).not.toHaveBeenCalled();
        expect(scene.jumpBufferFramesRemaining).toBe(1);

        scene.isGrounded = true;
        scene.player.body.blocked.down = true;
        scene.handleJump(2600);

        expect(scene.executeJump).toHaveBeenCalledTimes(1);
        expect(scene.jumpBufferPressed).toBe(false);
    });

    test('cancellation clears any queued mobile jump edge', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene();
        const scene = new PlatformerLevelScene({ key: 'JumpTapCancelTest' });

        scene.queueVirtualJumpInput();
        scene.releaseAllPlatformerActionButtons();

        expect(scene.virtualJumpPressed).toBe(false);
        expect(scene.virtualJumpQueued).toBe(false);
        expect(scene.jumpBufferPressed).toBe(false);
        expect(scene.jumpBufferFramesRemaining).toBe(0);
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
        const shared = read('PlatformerLevelScene.js');

        expect(source).toContain('this.createOpeningSignalCurrent();');
        expect(source).toContain('DRIFT MARKER 01  →');
        expect(source).toContain('x: 335');
        expect(source).toContain('[departureCue.x, departureCue.y]');
        expect(source).toContain('const isMobile = this.isMobile || (');
        expect(source).toContain('JOYSTICK MOVES + DIVES');
        expect(source).toContain('↑ BUTTON SWIMS UP');
        expect(source).toContain('visual.lineTo(destinationX, destinationY);');
        expect(source).toContain('this.retireOpeningSignalCurrent();');
        expect(source).toContain("current.label?.setText?.('DRIFT MARKER LINKED')");
        expect(shared).toContain("supportId: 'reef-opening-3'");
        expect(shared).toContain('this.getTraversalSupportCheckpoint?.(');
        expect(shared).toContain('supportTop + 5');

        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smoke).toContain('currentEcologyPlacement');
        expect(smoke).toContain("supportId !== 'reef-opening-3'");
        expect(smoke).toContain('spawnDistance < 450');
        expect(smoke).toContain('departureCueX > 360');
    });

    test('Final Void keeps the optional Current Heart beyond its first bond signal', () => {
        const shared = read('PlatformerLevelScene.js');
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(shared).toContain("supportId: 'final-return-approach'");
        expect(shared).toContain('x: 1230');
        expect(smoke).toContain('spawnDistance < 850');
        expect(smoke).toContain(
            'placed the Current Heart inside its opening viewport'
        );
    });

    test('shared landing dust uses one bounded tween per compact particle', () => {
        const source = read('../systems/FXLibrary.js');
        const landingDust = source.match(
            /landingDust\(scene, x, y, options = \{\}\) \{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Create individual dust particle/
        );

        expect(landingDust).not.toBeNull();
        expect(landingDust[1]).toContain('compactViewport ? 3 : 20');
        expect(landingDust[1]).toContain("particle.fxRole = 'landingDust';");
        expect(landingDust[1]).toContain(
            'this.activeEffects.delete(effectId);'
        );
        expect(landingDust[1]).toContain('scene,');
        expect(
            landingDust[1].match(/scene\.tweens\.add\(/g)
        ).toHaveLength(1);

        const stopEffect = source.match(
            /stopEffect\(effectId\) \{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Clean up all active effects/
        );
        expect(stopEffect).not.toBeNull();
        expect(stopEffect[1]).toContain(
            'effect.scene?.tweens?.killTweensOf?.(particle);'
        );

        const dustParticle = source.match(
            /createDustParticle\(scene, x, y, options\) \{([\s\S]*?)\n    \}\n\n    \/\*\*/
        );
        expect(dustParticle).not.toBeNull();
        expect(dustParticle[1]).toContain(
            "const textureKey = 'fx_landing_dust_particle';"
        );
        expect(dustParticle[1]).toContain(
            'const particle = scene.add.image(x, y, textureKey);'
        );
        expect(dustParticle[1]).not.toContain('scene.add.graphics()');

        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );
        expect(smoke).toContain('landingDustTweenCount');
        expect(smoke).toContain('landingDustOrphanTweenCount');
        expect(smoke).toContain('displayTypeCounts');
        expect(smoke).toContain('visibleDisplayTypeCounts');
        expect(smoke).toContain('hiddenDisplayTypeCounts');
        expect(smoke).toContain('activeTweenCount: 12');
        expect(smoke).toContain(
            'leaked landing feedback work after settlement'
        );
    });

    test('Stellar Reef binds every required waypoint to a distinct relay support', () => {
        const source = read('levels/ReefLevel.js');

        expect(source).toContain("activationSupportIds: ['reef-drift-relay']");
        expect(source).toContain("activationSupportIds: ['reef-traveler-relay']");
        expect(source).toContain("activationSupportIds: ['reef-passage-vector']");
        expect(source).toContain('this.getTraversalSupportCheckpoint(');
        expect(source).toContain('this.retireTraversalLandingGuide(anchor);');
    });

    test('release smoke completes every campaign route instead of checking only its opening', () => {
        const smoke = fs.readFileSync(
            path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
            'utf8'
        );

        expect(smoke).toContain('audit?.flow?.strandingSupportCount !== 0');
        expect(smoke).toContain('smokeVoidPeaksReturnCurrents(session)');
        expect(smoke).toContain('smokeCrystalCoreLift(session)');
        expect(smoke).toContain('smokeReefAscentCurrent(session)');
        expect(smoke).toContain("'reef-drive-step'");
        expect(smoke).toContain("reefDriveFlow?.pathSupportIds?.at?.(-1) !== 'reef-drive-relic'");
        expect(smoke).toContain("target.id === 'reef_star_trench'");
        expect(smoke).toContain("target.id === 'reef_waypoint_1'");
        expect(smoke).toContain("target.id === 'reef_waypoint_2'");
        expect(smoke).toContain("target.id === 'reef_waypoint_3'");
        expect(smoke).toContain("'reef-drift-relay'");
        expect(smoke).toContain("'reef-traveler-relay'");
        expect(smoke).toContain("'reef-passage-vector'");
        expect(smoke).toContain('reefWaypointSupports');
        expect(smoke).toContain('smokeReefForwardCurrents(session)');
        expect(smoke).toContain('reefForwardCurrents');
        expect(smoke).toContain('Number(audit?.flow?.backtrackDistance) !== 0');
        expect(smoke).toContain('reefFlowFailed');
        expect(smoke).toContain("target.id === 'crystal_core'");
        expect(smoke).toContain("'caves-core-refuge'");
        expect(smoke).toContain('cavesFlowFailed');
        expect(smoke).toContain("target.id === 'caves_anchor_1'");
        expect(smoke).toContain("target.id === 'caves_anchor_2'");
        expect(smoke).toContain("target.id === 'caves_anchor_3'");
        expect(smoke).toContain("'caves-echo-upper'");
        expect(smoke).toContain("'caves-grove-step'");
        expect(smoke).toContain("'caves-guardian-left'");
        expect(smoke).toContain('peaksFlowFailed');
        expect(smoke).toContain("target.id === 'peaks_relay_1'");
        expect(smoke).toContain("'peak-lower-relay-overlook'");
        expect(smoke).toContain("'peak-warning-lower'");
        expect(smoke).toContain("'peak-summit-relay'");
        expect(smoke).toContain("'peak-titan-gate'");
        expect(smoke).toContain("id: 'peak-return-lower'");
        expect(smoke).toContain("id: 'peak-return-summit'");
        expect(smoke).toContain('current.lastLiftAt = Number.NEGATIVE_INFINITY;');
        expect(smoke).toContain('guidanceActive: scene.activePeakReturnCurrent?.id === current.id');
        expect(smoke).toContain('destabilized after landing');
        expect(smoke).toContain('state.encounterRhythm?.count < 8');
        expect(smoke).toContain('state.encounterRhythm.unsupported.length > 0');
        expect(smoke).toContain('has no deliberate encounter rhythm');
        expect(smoke).toContain("route === 'crystalCaves'");
        expect(smoke).toContain('state.encounterRhythm.clearCount < 3');
        expect(smoke).toContain('state.encounterRhythm.optionalCount < 1');
        expect(smoke).toContain("route === 'finalVoid'");
        expect(smoke).toContain('Number(audit?.flow?.requiredJumpCount) < 4');
        expect(smoke).toContain("target.id === 'final_bond_1'");
        expect(smoke).toContain("target.id === 'final_bond_2'");
        expect(smoke).toContain("target.id === 'final_bond_3'");
        expect(smoke).toContain("target.id === 'empress_seal'");
        expect(smoke).toContain("'final-opening-step'");
        expect(smoke).toContain("'final-return-route'");
        expect(smoke).toContain("'final-empress-gate'");
        expect(smoke).toContain('audit?.flow?.comfortPassed !== true');
        expect(smoke).toContain("route === 'auroraDepths'");
        expect(smoke).toContain('optionalComfortPassed !== true');
        expect(smoke).toContain('uncomfortableOptionalTargetIds');
        expect(smoke).toContain("route === 'mythicalForest'");
        expect(smoke).toContain('forestFlowFailed');
        expect(smoke).toContain('smokeFinalVoidRiftCrossing(session)');
        expect(smoke).toContain("'final-rift-step-1'");
        expect(smoke).toContain("'final-rift-step-4'");
        expect(smoke).toContain(
            "supportId === 'final-rift-step-4' ? 3200 : 1900"
        );
        expect(smoke).toContain('smokeAuroraQuietLightClimb(session)');
        expect(smoke).toContain("'aurora-heart-launch'");
        expect(smoke).toContain("'aurora-quiet-step-3'");
        expect(smoke).toContain('smokeForestForwardHandoffs(session)');
        expect(smoke).toContain("'forest-tree-3-handoff'");
        expect(smoke).toContain('forestAnchorSupports');
        expect(smoke).toContain("scene?.checkpointAnchors?.[${index}]");
        expect(smoke).toContain("target.id === 'forest_anchor_1'");
        expect(smoke).toContain("target.id === 'forest_anchor_2'");
        expect(smoke).toContain("target.id === 'forest_anchor_3'");
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
        expect(smoke).toContain('const CAMPAIGN_MOBILE_RENDER_BUDGETS = Object.freeze({');
        expect(smoke).toContain('state.displayCount > 150');
        expect(smoke).toContain(
            'framePacing.displayCount > renderBudget.displayCount'
        );
        expect(smoke).toContain(
            'framePacing.activeTweenCount > renderBudget.activeTweenCount'
        );
        expect(smoke).toContain('framePacing.postPipelineCount !== 0');
        expect(smoke).toContain(
            'framePacing.performanceTier !== renderBudget.performanceTier'
        );
        expect(smoke).toContain(
            "SMOKE_CASE !== 'all' && framePacing.p95FrameMs > 100"
        );
        expect(smoke).toContain('!framePacing.forestEnemyOverlapActive');
        expect(smoke).toContain('framePacing.parallaxLayers?.nebula !== 3');
        expect(smoke).toContain('framePacing.parallaxLayers?.starField !== 2');
        expect(smoke).toContain('framePacing.parallaxLayers?.rock !== 2');
        expect(smoke).toContain('framePacing.parallaxLayers?.floraField !== 1');
        expect(smoke).toContain(
            'Number(stagedOptional.progress) >= optionalIndex + 1'
        );
        expect(smoke).toContain('renderStability.endCount > renderStability.startCount + 8');
        expect(smoke).toContain('state.ambientRendering?.layerCount !== 1');
        expect(smoke).toContain('state.ambientRendering?.pointCount !== 164');
        expect(smoke).toContain('smokeCaveBatchedCoinPickup(session)');
        expect(smoke).toContain('state.caveCoinRendering?.physicsCoinCount !== 0');
        expect(smoke).toContain('state.caveCrystalRendering?.layerCount !== 1');
        expect(smoke).toContain('state.caveEnemyRuntime?.scheduledEnemyCount !== 8');
        expect(smoke).toContain('state.caveEnemyRuntime?.individualTimerCount !== 2');
        expect(smoke).toContain('state.caveEnemyRuntime?.proximityActiveCount > 3');
        expect(smoke).toContain('state.caveEnemyRuntime?.sleepingEnemyCount < 5');
        expect(smoke).toContain('state.caveEnemyRuntime?.spiderTimersPaused !== true');
        expect(smoke).toContain('state.caveEnemyRuntime?.batMotionTweenCount !== 0');
        expect(smoke).toContain('displayCount: 185');
        expect(smoke).toContain('activeTweenCount: 12');
        expect(smoke).toContain('state.reefAmbientRendering?.nebulaLayerCount !== 2');
        expect(smoke).toContain('state.reefAmbientRendering?.dustParticleCount > 6');
        expect(smoke).toContain('state.reefAmbientRendering?.decorativeTweenCount !== 0');
        expect(smoke).toContain('state.peaksAmbientRendering?.starCount !== 35');
        expect(smoke).toContain('state.peaksAmbientRendering?.emberLayerCount !== 1');
        expect(smoke).toContain('framePacing.peaksRuntime?.emberRedrawsDuringSample > 4');
        expect(smoke).toContain('framePacing.peaksRuntime?.patrolUpdatesDuringSample > 28');
        expect(smoke).toContain('did not keep Peaks runtime work bounded');
        expect(smoke).toContain('activeTweenCount: 15');
        expect(smoke).toContain('state.auroraAmbientRendering?.shadowCurrentLabelCount !== 3');
        expect(smoke).toContain('state.auroraAmbientRendering?.shadowPulseTweenCount !== 1');
        expect(smoke).toContain('state.auroraAmbientRendering?.fragmentPulseTweenCount !== 0');
        expect(smoke).toContain('state.auroraAmbientRendering?.landingGuideTweenCount !== 0');
        expect(smoke).toContain('did not keep Aurora hazards readable and batched');
        expect(smoke).toContain('smokeForestBatchedCoinPickup(session)');
        expect(smoke).toContain('state.coinRendering?.legacyVisualCount !== 0');
        expect(smoke).toContain('state.coinRendering?.pickupBodyCount !== 0');
        expect(smoke).toContain('state.forestEnemyRuntime?.scheduledEnemyCount !== 23');
        expect(smoke).toContain('state.forestEnemyRuntime?.individualTimerCount !== 0');
        expect(smoke).toContain('smokeForestEnemyActivationWindow(session)');
        expect(smoke).toContain('Forest enemy activation did not wake before contact');
        expect(smoke).toContain('Forest enemy activation did not suspend after departure');
        expect(smoke).toContain('state.forestEnemyRuntime?.proximityActiveCount > 10');
        expect(smoke).toContain('state.forestEnemyRuntime?.sleepingEnemyCount < 13');
        expect(smoke).toContain('state.forestEnemyRuntime?.sleepingEnemyCount !== 23');
        expect(smoke).toContain('state.forestEnemyRuntime?.enabledBodyCount !==');
        expect(smoke).toContain('state.forestEnemyRuntime?.groundEnemySupportIds?.length !== 5');
        expect(smoke).toContain('state.forestEnemyRuntime?.unsupportedGroundEnemyIds?.length !== 0');
        expect(smoke).toContain('unsupportedGroundEnemyIds');
        expect(smoke).toContain('groundEnemySupportIds');
        expect(smoke).toContain('state.forestEnemyRuntime?.airborneMotionTweenCount !== 0');
        expect(smoke).toContain(
            'state.forestDecorationRendering?.starFragmentTweenCount !== 0'
        );
        expect(smoke).toContain(
            'state.forestDecorationRendering?.landingGuideTweenCount !== 0'
        );
        expect(smoke).toContain(
            'state.forestDecorationRendering?.arenaParticleTweenCount !== 0'
        );
        expect(smoke).toContain(
            'state.forestDecorationRendering?.arenaAmbientLayerCount !== 1'
        );
        expect(smoke).toContain('smokeForestSharedEnemyScheduler(session)');
        expect(smoke).toContain('Forest shared enemy scheduler did not advance patrol AI');
        expect(smoke).toContain('Forest grouped coin did not resolve exactly once');
        expect(smoke).toContain('activeTouchIdentifier = nextTouchIdentifier;');
        expect(smoke).toContain('nextTouchIdentifier += 1;');
        expect(smoke).toContain('id: activeTouchIdentifier');
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
        expect(smoke).toContain('smokeDeclaredRouteChoiceSupports(');
        expect(smoke).toContain('routeChoiceRuntime?.passed !== true');
        expect(smoke).toContain('const checkpointBefore = scene.checkpointPosition');
        expect(smoke).toContain(
            'JSON.stringify(outOfOrderGuard.checkpointAfter) !=='
        );
        expect(smoke).toContain(
            'JSON.stringify(airborneRejected.checkpointAfter) !=='
        );
        expect(smoke).toContain('choice.mainSupportIds[0]');
        expect(smoke).toContain('choice.optionalSupportIds[0]');
        expect(smoke).toContain('routeState.choice.rejoinSupportIds[0]');
        expect(smoke).toContain('Aurora direct route zone selection');
        expect(smoke).toContain('Aurora Quiet Light pickup collision');
        expect(smoke).toContain('Aurora charge returned after reload');
        expect(smoke).toContain('Aurora Quiet Light returned after reload');
    });

    test('keeps the Peaks opening clear and proves both route rewards independently', () => {
        const base = read('PlatformerLevelScene.js');
        const smoke = read('../../scripts/smoke-secondary-journeys.js');

        expect(base).toContain("supportId: 'peak-ridge-approach'");
        expect(smoke).toContain(
            "state.currentEcologyPlacement?.supportId !==\n                'peak-ridge-approach'"
        );
        expect(smoke).toContain(
            "route === 'voidPeaks' &&\n        (state.canvasWidth <= 480"
        );
        expect(smoke).toContain("'depth:120:visible'");
        expect(smoke).toContain("'depth:130:visible'");
        expect(smoke).toContain(
            "message: `${sceneName} low warning line selection`"
        );
        expect(smoke).toContain('optionalFragmentsRemaining !== 0');
        expect(smoke).toContain('persistedCharges !== 0');
        expect(smoke).toContain(
            'choosing the low line intentionally retires its relics'
        );
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

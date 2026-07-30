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
        console,
        window: sceneWindow,
        Phaser: {
            Scene: PhaserScene,
            Math: {
                Distance: {
                    Between: (x1, y1, x2, y2) => Math.hypot(
                        x2 - x1,
                        y2 - y1
                    )
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

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadReefLevel(sceneWindow = {}) {
    const filePath = path.join(__dirname, '../scenes/levels/ReefLevel.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            "import PlatformerLevelScene from '../PlatformerLevelScene.js';",
            'const PlatformerLevelScene = class { constructor(config) { this.sceneConfig = config; } };'
        )
        .replace('export default ReefLevel;', 'module.exports = ReefLevel;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: {
            Math: {
                Distance: {
                    Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
                }
            }
        },
        Date,
        Math,
        Number
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGraphics() {
    return {
        fillStyle: jest.fn().mockReturnThis(),
        fillCircle: jest.fn().mockReturnThis(),
        fillTriangle: jest.fn().mockReturnThis(),
        lineStyle: jest.fn().mockReturnThis(),
        beginPath: jest.fn().mockReturnThis(),
        arc: jest.fn().mockReturnThis(),
        strokePath: jest.fn().mockReturnThis(),
        setPosition: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(),
        setRotation: jest.fn().mockReturnThis(),
        destroy: jest.fn()
    };
}

describe('creature-tech katana combat progression', () => {
    test('Resonant Edge increases melee damage and effective reach', () => {
        const sceneWindow = {
            AudioManager: {
                playAttack: jest.fn()
            }
        };
        const PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
        const scene = new PlatformerLevelScene({ key: 'CrystalCavesLevel' });
        const enemy = { x: 230, y: 100 };

        scene.player = {
            x: 100,
            y: 100,
            facingRight: true
        };
        scene.katanaCombatProfile = {
            upgradeIds: ['crystal_edge'],
            meleeDamage: 3,
            enemyMeleeRange: 85,
            bossMeleeRange: 95,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4,
            guardCharges: 0
        };
        scene.enemies = {
            getChildren: jest.fn(() => [enemy])
        };
        scene.boss = {
            active: true,
            x: 240,
            y: 100
        };
        scene.damageEnemy = jest.fn();
        scene.damageBoss = jest.fn();
        scene.add = {
            graphics: jest.fn(createGraphics)
        };
        scene.tweens = {
            add: jest.fn()
        };

        scene.performAttack();

        expect(scene.damageEnemy).toHaveBeenCalledWith(enemy, 3);
        expect(scene.damageBoss).toHaveBeenCalledWith(3);
        expect(scene.add.graphics.mock.results[0].value.fillStyle)
            .toHaveBeenCalledWith(0x66C7D4, 0.8);
        expect(scene.add.graphics.mock.results[1].value.lineStyle)
            .toHaveBeenCalledWith(4, 0x8FE3CF, 1);
    });

    test('lets the astronaut own the katana visual without changing hit logic', () => {
        const PlatformerLevelScene = loadPlatformerLevelScene({});
        const scene = new PlatformerLevelScene({ key: 'VoidPeaksLevel' });
        const enemy = { x: 225, y: 100 };
        const astronautFollower = {
            performKatanaStrike: jest.fn(() => true)
        };

        scene.player = {
            x: 100,
            y: 100,
            facingRight: true
        };
        scene.astronautFollower = astronautFollower;
        scene.katanaCombatProfile = {
            meleeDamage: 3,
            enemyMeleeRange: 85,
            bossMeleeRange: 95,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4
        };
        scene.enemies = {
            getChildren: jest.fn(() => [enemy])
        };
        scene.damageEnemy = jest.fn();
        scene.add = {
            graphics: jest.fn(createGraphics)
        };
        scene.tweens = {
            add: jest.fn()
        };

        scene.performAttack();

        expect(astronautFollower.performKatanaStrike).toHaveBeenCalledWith({
            facingRight: true,
            targetX: 150,
            targetY: 100,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4
        });
        expect(scene.add.graphics).not.toHaveBeenCalled();
        expect(scene.damageEnemy).toHaveBeenCalledWith(enemy, 3);
    });

    test('Aurora Guard absorbs one direct hit but never hides pit damage', () => {
        const sceneWindow = {
            FXLibrary: {
                stardustBurst: jest.fn()
            },
            AudioManager: {
                playAchievement: jest.fn(),
                playError: jest.fn()
            }
        };
        const PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
        const scene = new PlatformerLevelScene({ key: 'AuroraDepthsLevel' });

        scene.player = {
            x: 400,
            y: 300,
            facingRight: true,
            setVelocity: jest.fn(),
            setTint: jest.fn(),
            clearTint: jest.fn()
        };
        scene.health = 4;
        scene.maxHealth = 4;
        scene.hasShield = false;
        scene.isInvincible = false;
        scene.isPlayerDead = false;
        scene.auroraGuardCharges = 1;
        scene.updateKatanaUpgradeDisplay = jest.fn();
        scene.updateHealthDisplay = jest.fn();
        scene.showFloatingText = jest.fn();
        scene.startInvincibilityFlash = jest.fn();
        scene.time = {
            delayedCall: jest.fn()
        };

        scene.takeDamage(1);

        expect(scene.health).toBe(4);
        expect(scene.damageTaken).toBeUndefined();
        expect(scene.auroraGuardCharges).toBe(0);
        expect(scene.showFloatingText).toHaveBeenCalledWith(
            'AURORA GUARD',
            400,
            245,
            '#D9B8FF'
        );

        scene.auroraGuardCharges = 1;
        scene.takeDamage(1, true);

        expect(scene.health).toBe(3);
        expect(scene.damageTaken).toBe(1);
        expect(scene.auroraGuardCharges).toBe(1);
    });

    test('shows both installed upgrades and remaining guard charges in the HUD', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(source).toContain('RESONANT EDGE  +1');
        expect(source).toContain('AURORA GUARD  ${this.auroraGuardCharges}');
        expect(source).toContain('layout.menu.x + 42');
        expect(source).toContain(
            "['crystal', 'aurora', 'full'].includes("
        );
        expect(gameSource).toContain('katanaPreview');
        expect(gameSource).toContain('testMode: true');
        expect(
            fs.readFileSync(
                path.join(__dirname, '../scenes/levels/ReefLevel.js'),
                'utf8'
            )
        ).toContain('reefAmplified: true');
    });

    test('carries Resonant Edge damage, reach, and colors into the Stellar Reef', () => {
        const sceneWindow = {
            AudioManager: {
                playAttack: jest.fn()
            }
        };
        const ReefLevel = loadReefLevel(sceneWindow);
        const scene = new ReefLevel();
        const enemy = { active: true, x: 230, y: 100 };
        const attackGraphics = createGraphics();

        scene.player = {
            x: 100,
            y: 100,
            facingRight: true
        };
        scene.katanaCombatProfile = {
            upgradeIds: ['crystal_edge'],
            meleeDamage: 3,
            enemyMeleeRange: 85,
            bossMeleeRange: 95,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4
        };
        scene.enemies = {
            children: {
                each: callback => callback(enemy)
            }
        };
        scene.bossFightActive = true;
        scene.bossBody = {
            x: 300,
            y: 100
        };
        scene.damageEnemy = jest.fn();
        scene.damageBoss = jest.fn();
        scene.add = {
            graphics: jest.fn(() => attackGraphics)
        };
        scene.tweens = {
            add: jest.fn()
        };

        scene.performAttack();

        expect(scene.damageEnemy).toHaveBeenCalledWith(enemy, 3);
        expect(scene.damageBoss).toHaveBeenCalledWith(3);
        expect(attackGraphics.fillStyle).toHaveBeenCalledWith(0x66C7D4, 0.6);
        expect(attackGraphics.lineStyle).toHaveBeenCalledWith(5, 0x8FE3CF, 1);
    });

    test('routes shared ranged combat to a level-specific guardian hitbox', () => {
        const sceneWindow = {
            AudioManager: {
                playBossProjectile: jest.fn()
            }
        };
        const PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
        const scene = new PlatformerLevelScene({ key: 'ReefLevel' });
        const decorativeBoss = { active: true };
        const guardianHitbox = { active: true, x: 500, y: 100 };

        scene.boss = decorativeBoss;
        scene.bossBody = guardianHitbox;
        expect(scene.getBossCombatTarget()).toBe(guardianHitbox);

        const projectile = {
            ...createGraphics(),
            active: true,
            x: 100,
            y: 90
        };
        scene.player = {
            x: 100,
            y: 100,
            facingRight: true
        };
        scene.nextRangedDamageMultiplier = 1;
        scene.enemies = null;
        scene.add = {
            graphics: jest.fn(() => projectile)
        };
        scene.physics = {
            add: {
                existing: jest.fn(target => {
                    target.body = {
                        setAllowGravity: jest.fn(),
                        setSize: jest.fn(),
                        setVelocityX: jest.fn()
                    };
                }),
                overlap: jest.fn()
            }
        };
        const trailInterval = { remove: jest.fn() };
        scene.time = {
            addEvent: jest.fn(() => trailInterval),
            delayedCall: jest.fn()
        };
        scene.tweens = {
            add: jest.fn()
        };
        scene.createProjectileImpact = jest.fn();
        scene.damageBoss = jest.fn();

        scene.performRangedAttack();

        expect(scene.physics.add.overlap).toHaveBeenCalledWith(
            projectile,
            guardianHitbox,
            expect.any(Function)
        );
        const collision = scene.physics.add.overlap.mock.calls[0][2];
        collision(projectile);
        expect(scene.damageBoss).toHaveBeenCalledWith(1);
        expect(scene.createProjectileImpact).toHaveBeenCalledWith(100, 90);

        guardianHitbox.active = false;
        expect(scene.getBossCombatTarget()).toBe(decorativeBoss);

        decorativeBoss.active = false;
        expect(scene.getBossCombatTarget()).toBeNull();
    });
});

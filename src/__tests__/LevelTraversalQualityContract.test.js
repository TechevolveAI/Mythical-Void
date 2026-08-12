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
});

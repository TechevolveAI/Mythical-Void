const fs = require('fs');
const path = require('path');
const vm = require('vm');

const levelPath = path.join(
    __dirname,
    '../scenes/levels/CrystalCavesLevel.js'
);
const gamePath = path.join(__dirname, '../game.js');

function readLevel() {
    return fs.readFileSync(levelPath, 'utf8');
}

function loadLevelClass() {
    const transformed = readLevel()
        .replace(
            "import PlatformerLevelScene from '../PlatformerLevelScene.js';",
            'const PlatformerLevelScene = class { constructor(config) { this.sceneConfig = config; } };'
        )
        .replace(
            /import \{\s*buildCreaturePowerProfile,[\s\S]*?\} from '\.\.\/\.\.\/systems\/CreaturePowerProfile\.js';/,
            'const buildCreaturePowerProfile = () => ({ affinityPower: { id: "radiant_pulse", name: "Radiant Pulse" }, color: 0xFFD54F });\n' +
            'const recordCreaturePowerEvent = () => ({ changed: true });'
        )
        .replace(
            "import { calculateBallisticLaunchVelocity } from '../../systems/TraversalTopology.js';",
            'const calculateBallisticLaunchVelocity = () => -748;'
        )
        .replace('export default CrystalCavesLevel;', 'module.exports = CrystalCavesLevel;');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {},
        Phaser: { Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } },
        Date,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: levelPath });
    return sandbox.module.exports;
}

describe('Crystal Caves living-mineral pass', () => {
    test('is opt-in and locally previewable without changing the normal route', () => {
        const source = readLevel();
        const gameSource = fs.readFileSync(gamePath, 'utf8');

        expect(source).toContain(
            'this.livingMineralPassEnabled = data?.livingMineralPass === true'
        );
        expect(source).toContain('if (this.livingMineralPassEnabled) {');
        expect(gameSource).toContain("urlParams.get('livingMineralPass') === '1'");
        expect(gameSource).toContain("sceneName === 'CrystalCavesLevel'");
    });

    test('uses the approved stability language on three existing safe supports', () => {
        const source = readLevel();

        expect(source).toContain('stable: Object.freeze({ color: 0x38BFD2');
        expect(source).toContain('warning: Object.freeze({ color: 0xF2B84B');
        expect(source).toContain('fractured: Object.freeze({ color: 0xC24AC8');
        expect(source).toContain('restored: Object.freeze({ color: 0xCFFFEF');
        expect(source).toContain("id: 'caves-tutorial-1'");
        expect(source).toContain("id: 'caves-tutorial-2'");
        expect(source).toContain("id: 'caves-tutorial-rise'");
    });

    test('fractures a surface once, restores collision, and never retriggers it', () => {
        const CrystalCavesLevel = loadLevelClass();
        const scene = new CrystalCavesLevel();
        const scheduled = [];
        const surface = {
            support: {
                x: 100,
                body: { enable: true, top: 80 },
                setAlpha: jest.fn()
            },
            visual: { active: true },
            state: 'stable',
            warningMs: 700,
            fracturedMs: 460,
            triggered: false,
            completed: false
        };
        scene.getCompanionName = () => 'Nova';
        scene.showFloatingText = jest.fn();
        scene.drawLivingMineralSurface = jest.fn();
        scene.scheduleLivingMineralStep = (delay, callback) => {
            scheduled.push({ delay, callback });
        };

        expect(scene.triggerLivingMineralSurface(surface)).toBe(true);
        expect(surface.state).toBe('warning');
        expect(scene.triggerLivingMineralSurface(surface)).toBe(false);
        expect(scheduled.map(step => step.delay)).toEqual([700, 1160]);

        scheduled[0].callback();
        expect(surface.state).toBe('fractured');
        expect(surface.support.body.enable).toBe(false);

        scheduled[1].callback();
        expect(surface.state).toBe('restored');
        expect(surface.support.body.enable).toBe(true);
        expect(surface.completed).toBe(true);
    });

    test('gives the carrier a visible warning pause before reversing', () => {
        const CrystalCavesLevel = loadLevelClass();
        const scene = new CrystalCavesLevel();
        const sprite = {
            active: true,
            x: 3440,
            body: { enable: true },
            setVelocityX: jest.fn(),
            setTint: jest.fn(),
            clearTint: jest.fn()
        };
        scene.livingMineralCarrier = {
            sprite,
            minX: 3200,
            maxX: 3440,
            direction: 1,
            speed: 46,
            warningUntil: 0,
            waiting: false
        };

        scene.updateLivingMineralCarrier(1000);
        expect(scene.livingMineralCarrier.waiting).toBe(true);
        expect(scene.livingMineralCarrier.warningUntil).toBe(1520);
        expect(sprite.setVelocityX).toHaveBeenCalledWith(0);

        scene.updateLivingMineralCarrier(1519);
        expect(sprite.clearTint).not.toHaveBeenCalled();
        scene.updateLivingMineralCarrier(1520);
        expect(scene.livingMineralCarrier.direction).toBe(-1);
        expect(sprite.setVelocityX).toHaveBeenLastCalledWith(-46);
        expect(sprite.clearTint).toHaveBeenCalled();
    });

    test('keeps the first objective, route choice, consequence, and reward plain', () => {
        const source = readLevel();

        expect(source).toContain('Watch the crystal colour. Follow the blue light.');
        expect(source).toContain('BLUE IS SAFE // AMBER MEANS MOVE');
        expect(source).toContain('LOW ROAD // SAFER');
        expect(source).toContain('HIGH ROAD // RIFT STALKER // EXTRA SHIELD');
        expect(source).toContain('"It is hurt, not empty."');
        expect(source).toContain('THE LIVING LIFT WAKES');
        expect(source).toContain('CRYSTAL SHIELD // BLOCKS THE NEXT 2 HITS');
        expect(source).toContain("reward?.id !== 'crystal_shield'");
    });

    test('teardown removes timers, overlays, carrier collider, and carrier sprite', () => {
        const source = readLevel();
        const shutdown = source.match(
            /shutdown\(\)\s*\{([\s\S]*?)\n        \/\/ Stop ambient audio/
        )?.[1] || '';

        expect(shutdown).toContain('this.livingMineralTimers.forEach');
        expect(shutdown).toContain('surface.support.body.enable = true');
        expect(shutdown).toContain('surface?.visual?.destroy?.()');
        expect(shutdown).toContain('removeCollider');
        expect(shutdown).toContain('this.livingMineralCarrier?.sprite?.destroy?.()');
    });
});

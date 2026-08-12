const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPlatformerLevelScene(sceneWindow) {
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

function createDisplayObject() {
    const handlers = {};
    const display = {
        handlers,
        fillStyle: jest.fn(() => display),
        fillRect: jest.fn(() => display),
        fillRoundedRect: jest.fn(() => display),
        fillCircle: jest.fn(() => display),
        lineStyle: jest.fn(() => display),
        lineBetween: jest.fn(() => display),
        strokeCircle: jest.fn(() => display),
        strokeRoundedRect: jest.fn(() => display),
        setOrigin: jest.fn(() => display),
        setScrollFactor: jest.fn(() => display),
        setDepth: jest.fn(() => display),
        setInteractive: jest.fn(() => display),
        setColor: jest.fn(() => display),
        setStyle: jest.fn(() => display),
        on: jest.fn((eventName, callback) => {
            handlers[eventName] = callback;
            return display;
        }),
        removeAllListeners: jest.fn(),
        destroy: jest.fn()
    };
    return display;
}

function createRecoveryScene({ checkpoint = true } = {}) {
    const listeners = new Map();
    const sceneWindow = {
        GameState: {
            get: jest.fn(() => 'Luma')
        },
        addEventListener: jest.fn((eventName, callback) => {
            listeners.set(eventName, callback);
        }),
        removeEventListener: jest.fn((eventName, callback) => {
            if (listeners.get(eventName) === callback) {
                listeners.delete(eventName);
            }
        })
    };
    const PlatformerLevelScene = loadPlatformerLevelScene(sceneWindow);
    const scene = new PlatformerLevelScene({ key: 'RecoveryTest' });
    const textCalls = [];

    scene.cameras = { main: { width: 390, height: 844 } };
    scene.add = {
        graphics: jest.fn(() => createDisplayObject()),
        text: jest.fn((x, y, text) => {
            textCalls.push(text);
            return createDisplayObject();
        })
    };
    scene.checkpointPosition = checkpoint ? { x: 900, y: 640 } : null;
    scene.retryFromCheckpoint = jest.fn();
    scene.restartLevel = jest.fn();
    scene.returnToSanctuary = jest.fn();

    return { scene, sceneWindow, listeners, textCalls };
}

describe('companion-led expedition recovery', () => {
    test('presents warm checkpoint recovery and supports Enter', () => {
        const { scene, sceneWindow, listeners, textCalls } = createRecoveryScene({
            checkpoint: true
        });

        scene.showDeathScreen();

        expect(textCalls).toContain('PROJECT BEACON // BOND RECOVERY');
        expect(textCalls).toContain('THE BOND HOLDS');
        expect(textCalls).toContain('CONTINUE FROM BEACON');
        expect(textCalls.join(' ')).toMatch(/Luma stayed beside the beacon/i);
        expect(textCalls.join(' ')).toMatch(/returning to your stance/i);

        const keyHandler = listeners.get('keydown');
        const event = { key: 'Enter', preventDefault: jest.fn() };
        keyHandler(event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(scene.retryFromCheckpoint).toHaveBeenCalledTimes(1);
        expect(scene.restartLevel).not.toHaveBeenCalled();

        scene.clearDeathScreen();
        expect(sceneWindow.removeEventListener).toHaveBeenCalledWith(
            'keydown',
            keyHandler
        );
        expect(listeners.has('keydown')).toBe(false);
    });

    test('keeps recovery UI above guardian combat HUDs', () => {
        const { scene } = createRecoveryScene({ checkpoint: true });

        scene.showDeathScreen();

        const overlay = scene.add.graphics.mock.results[0].value;
        const panel = scene.add.graphics.mock.results[1].value;
        const title = scene.add.text.mock.results[1].value;
        expect(overlay.setDepth).toHaveBeenCalledWith(6000);
        expect(panel.setDepth).toHaveBeenCalledWith(6001);
        expect(title.setDepth).toHaveBeenCalledWith(6003);
    });

    test('uses a full restart at the trailhead and lets Escape return home', () => {
        const { scene, listeners, textCalls } = createRecoveryScene({
            checkpoint: false
        });

        scene.showDeathScreen();

        expect(textCalls).toContain('RESTART EXPEDITION');
        expect(textCalls.join(' ')).toMatch(/waiting at the trailhead/i);
        const keyHandler = listeners.get('keydown');

        keyHandler({ key: ' ', preventDefault: jest.fn() });
        keyHandler({ key: 'Escape' });

        expect(scene.restartLevel).toHaveBeenCalledTimes(1);
        expect(scene.retryFromCheckpoint).not.toHaveBeenCalled();
        expect(scene.returnToSanctuary).toHaveBeenCalledTimes(1);
    });

    test('provides an isolated local preview and removes the punitive copy', () => {
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const hatchingSource = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(platformerSource).not.toContain("'YOU FELL'");
        expect(platformerSource).toContain("recoveryPreview === 'checkpoint'");
        expect(platformerSource).toContain(
            'LETHAL FALL PREVENTED  //  1 HEART HELD'
        );
        expect(platformerSource).toContain(
            'this.recoveryInputLockedUntil = this.time.now + 550'
        );
        expect(platformerSource).toContain('this.resetJoystick();');
        expect(platformerSource).toMatch(
            /shutdown\(\)[\s\S]*removeEventListener\('keydown', this\.deathKeyHandler\)/
        );
        expect(gameSource).toContain(
            "['checkpoint', 'restart', 'agency'].includes(testRecovery)"
        );
        expect(gameSource).toContain('recoveryPreview: testRecovery');
        expect(hatchingSource).toContain("previewParams.has('testRecovery')");
    });
});

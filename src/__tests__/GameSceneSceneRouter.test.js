const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);

function createPhaserStub() {
    class PhaserScene {
        constructor(config) {
            this.config = config;
        }
    }

    return {
        Scene: PhaserScene,
        Math: {
            Distance: {
                Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
            },
            Angle: {
                Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1)
            }
        }
    };
}

function createGameStateMock(overrides = {}) {
    return {
        get: jest.fn((key) => overrides[key]),
        set: jest.fn(),
        save: jest.fn(),
        emit: jest.fn(),
        getBreedingShrineStatus: jest.fn(() => ({ unlocked: false }))
    };
}

function loadGameSceneClass(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/GameScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import .*$/gm, '')
        .replace(/import\.meta\.env\.DEV/g, 'false')
        .replace(/export default GameScene;/, 'module.exports = GameScene;');

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Object,
        Array,
        Number,
        String,
        Boolean,
        RegExp,
        Promise
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createSceneInstance(GameScene, sceneWindow, options = {}) {
    const sceneManager = {
        isActive: jest.fn().mockReturnValue(false)
    };

    const sceneRouter = {
        pauseAndLaunchScene: jest.fn(),
        launchScene: jest.fn(),
        startScene: jest.fn(),
        playSound: jest.fn(),
        showLoading: jest.fn()
    };

    const scene = new GameScene();

    scene.scene = sceneManager;
    scene.sceneRouter = sceneRouter;
    scene.time = {
        delayedCall: jest.fn((delay, callback) => {
            if (typeof callback === 'function') {
                callback();
            }
            return { delay };
        })
    };
    scene.showInteractionHint = jest.fn();
    scene.scale = { width: 800, height: 600 };
    scene.player = { x: 120, y: 180 };
    scene.cameras = {
        main: {
            flash: jest.fn(),
            fadeOut: jest.fn(),
            shake: jest.fn(),
            once: jest.fn((event, callback) => {
                if (typeof callback === 'function') {
                    callback();
                }
            })
        }
    };
    scene.add = {
        graphics: jest.fn(() => ({
            fillStyle: jest.fn().mockReturnThis(),
            fillRect: jest.fn().mockReturnThis(),
            fillRoundedRect: jest.fn().mockReturnThis(),
            lineStyle: jest.fn().mockReturnThis(),
            strokeRoundedRect: jest.fn().mockReturnThis(),
            setScrollFactor: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis(),
            destroy: jest.fn(),
            clear: jest.fn().mockReturnThis()
        })),
        text: jest.fn(() => ({
            setOrigin: jest.fn().mockReturnThis(),
            setScrollFactor: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis(),
            setInteractive: jest.fn().mockReturnThis(),
            on: jest.fn().mockReturnThis(),
            setAlpha: jest.fn().mockReturnThis(),
            setStyle: jest.fn().mockReturnThis(),
            setColor: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis(),
            destroy: jest.fn(),
            setText: jest.fn().mockReturnThis(),
            setVisible: jest.fn().mockReturnThis()
        }))
    };
    scene.tweens = {
        add: jest.fn(({ onComplete } = {}) => {
            if (typeof onComplete === 'function') {
                onComplete();
            }
            return { stop: jest.fn() };
        }),
        killTweensOf: jest.fn(),
        timeScale: 1
    };

    sceneWindow.GameState = createGameStateMock(options.gameState);
    sceneWindow.AudioManager = {
        playButtonClick: jest.fn(),
        playVisionReveal: jest.fn(),
        playPurchase: jest.fn(),
        playError: jest.fn()
    };
    sceneWindow.UXEnhancements = {
        showLoading: jest.fn(),
        hideLoading: jest.fn()
    };

    return { scene, sceneManager, sceneRouter };
}

describe('GameScene scene router', () => {
    let sceneWindow;
    let GameScene;

    beforeAll(() => {
        sceneWindow = {
            Phaser: createPhaserStub()
        };
        sceneWindow.window = sceneWindow;
        GameScene = loadGameSceneClass(sceneWindow);
    });

    beforeEach(() => {
        sceneWindow.GameState = createGameStateMock();
        sceneWindow.AudioManager = {
            playButtonClick: jest.fn(),
            playVisionReveal: jest.fn(),
            playPurchase: jest.fn(),
            playError: jest.fn()
        };
        sceneWindow.UXEnhancements = {
            showLoading: jest.fn(),
            hideLoading: jest.fn()
        };
    });

    test('retains local UI helpers used after HUD extraction', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        const oldParticle = { destroy: jest.fn() };
        const emitter = {
            setScrollFactor: jest.fn().mockReturnThis(),
            setDepth: jest.fn().mockReturnThis()
        };
        const togglePanel = jest.fn();

        scene.floatingParticles = [oldParticle];
        scene.textures = { exists: jest.fn(() => true) };
        scene.add.particles = jest.fn(() => emitter);
        scene.carePanelManager = { togglePanel };

        scene.createFloatingParticles();
        scene.toggleCarePanel();

        expect(oldParticle.destroy).toHaveBeenCalledTimes(1);
        expect(scene.textures.exists).toHaveBeenCalledWith('magicalSparkle');
        expect(scene.add.particles).toHaveBeenCalledWith(
            0,
            0,
            'magicalSparkle',
            expect.objectContaining({ frequency: 600, blendMode: 'ADD' })
        );
        expect(scene.floatingParticles).toEqual([emitter]);
        expect(togglePanel).toHaveBeenCalledTimes(1);
    });

    test('provides a non-saving Shop return smoke route', () => {
        expect(gameSource).toContain("urlParams.get('testMapRecovery') === 'shop'");
        expect(gameSource).toContain(
            "game.scene.start('GameScene', { mapRecoveryPreview: true })"
        );
    });

    test('keeps interaction hints safe during partial scene shutdown', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        scene.showInteractionHint = GameScene.prototype.showInteractionHint.bind(scene);

        expect(() => scene.hideInteractionHint()).not.toThrow();
        expect(() => scene.showInteractionHint('Care for your companion')).not.toThrow();

        scene.interactionText = {
            active: true,
            setText: jest.fn(),
            setVisible: jest.fn()
        };
        scene.showInteractionHint('Care for your companion');

        expect(scene.interactionText.setText).toHaveBeenCalledWith('Care for your companion');
        expect(scene.interactionText.setVisible).toHaveBeenCalledWith(true);
        expect(scene.time.delayedCall).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    test('routes overlay and hub transitions through the scene manager', () => {
        const { scene, sceneRouter } = createSceneInstance(GameScene, sceneWindow, {
            gameState: {
                'creature.secretAbilities': ['blink']
            }
        });

        scene.openInventory();
        scene.openShop();
        scene.openCreatureProfile();
        scene.openAbilitiesOverlay();
        scene.openHubWorld();

        expect(sceneRouter.pauseAndLaunchScene).toHaveBeenNthCalledWith(
            1,
            'InventoryScene',
            undefined,
            { loadingMessage: 'Opening Inventory...', sound: 'buttonClick' }
        );
        expect(sceneRouter.pauseAndLaunchScene).toHaveBeenNthCalledWith(
            2,
            'ShopScene',
            undefined,
            { loadingMessage: 'Opening Cosmic Shop...', sound: 'buttonClick' }
        );
        expect(sceneRouter.launchScene).toHaveBeenNthCalledWith(
            1,
            'CreatureProfileScene',
            undefined,
            { bringToTop: true }
        );
        expect(sceneRouter.launchScene).toHaveBeenNthCalledWith(
            2,
            'AbilitySelectionScene',
            undefined,
            { bringToTop: true }
        );
        expect(sceneRouter.startScene).toHaveBeenCalledWith(
            'HubWorldScene',
            undefined,
            { loadingMessage: 'Traveling to Hub World...', sound: 'buttonClick' }
        );
    });

    test('blocks Fusion Pod until the shrine is unlocked', () => {
        const { scene, sceneRouter } = createSceneInstance(GameScene, sceneWindow);
        sceneWindow.GameState.getBreedingShrineStatus
            .mockReturnValueOnce({ unlocked: false })
            .mockReturnValueOnce({ unlocked: true });

        scene.openFusionPod();

        expect(scene.showInteractionHint).toHaveBeenCalledWith(expect.stringContaining('Level 5'));
        expect(sceneRouter.pauseAndLaunchScene).not.toHaveBeenCalled();

        scene.openFusionPod();

        expect(sceneRouter.pauseAndLaunchScene).toHaveBeenCalledWith(
            'FusionPodScene',
            undefined,
            { loadingMessage: 'Opening Fusion Pod...', sound: 'buttonClick' }
        );
    });

    test('keeps the legacy Breeding Shrine route pointed at the Fusion Pod', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        const fusionSpy = jest.spyOn(scene, 'openFusionPod').mockReturnValue('opened');

        expect(scene.openBreedingShrine()).toBe('opened');
        expect(fusionSpy).toHaveBeenCalledTimes(1);
    });

    test('restores movement, physics, and input when returning from an overlay', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        const resetKeys = jest.fn();

        scene.joystickX = 0.8;
        scene.joystickY = -0.4;
        scene.player = { setVelocity: jest.fn() };
        scene.physics = { resume: jest.fn() };
        scene.input = {
            enabled: false,
            keyboard: {
                enabled: false,
                resetKeys
            }
        };

        scene.handleSceneResume();

        expect(scene.joystickX).toBe(0);
        expect(scene.joystickY).toBe(0);
        expect(scene.player.setVelocity).toHaveBeenCalledWith(0, 0);
        expect(scene.physics.resume).toHaveBeenCalledTimes(1);
        expect(scene.input.enabled).toBe(true);
        expect(scene.input.keyboard.enabled).toBe(true);
        expect(resetKeys).toHaveBeenCalledTimes(1);
        expect(sceneWindow.UXEnhancements.hideLoading).toHaveBeenCalledTimes(1);
    });

    test('throttles map position persistence while movement stays responsive', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        const updateWorldExploration = jest.fn();
        let savedPosition = { x: 0, y: 0 };

        sceneWindow.GameState.get.mockImplementation((path) => (
            path === 'world.currentPosition' ? savedPosition : undefined
        ));
        sceneWindow.GameState.updateWorldExploration = updateWorldExploration;
        scene.positionText = { setText: jest.fn() };
        scene.player = { x: 100, y: 100 };

        scene.updatePositionDisplay(1000);
        expect(updateWorldExploration).toHaveBeenCalledWith({ x: 100, y: 100 });

        savedPosition = { x: 100, y: 100 };
        scene.player = { x: 160, y: 100 };
        scene.updatePositionDisplay(1200);
        expect(updateWorldExploration).toHaveBeenCalledTimes(1);

        scene.updatePositionDisplay(1500);
        expect(updateWorldExploration).toHaveBeenLastCalledWith({ x: 160, y: 100 });
        expect(updateWorldExploration).toHaveBeenCalledTimes(2);
        expect(scene.time.delayedCall).not.toHaveBeenCalled();
    });

    test('shows the ability hint instead of launching the selector when none are equipped', () => {
        const { scene, sceneRouter } = createSceneInstance(GameScene, sceneWindow, {
            gameState: {
                'creature.secretAbilities': []
            }
        });

        scene.openAbilitiesOverlay();

        expect(scene.showInteractionHint).toHaveBeenCalledWith(
            '✨ No abilities unlocked yet. Bond with your creature!'
        );
        expect(sceneRouter.launchScene).not.toHaveBeenCalled();
    });

    test('dispatches radial menu commands to the matching router methods', () => {
        const { scene } = createSceneInstance(GameScene, sceneWindow);
        const profileSpy = jest.spyOn(scene, 'openCreatureProfile').mockImplementation(() => {});
        const abilitiesSpy = jest.spyOn(scene, 'openAbilitiesOverlay').mockImplementation(() => {});

        scene.handleRadialMenuSelect('profile');
        scene.handleRadialMenuSelect('abilities');

        expect(profileSpy).toHaveBeenCalledTimes(1);
        expect(abilitiesSpy).toHaveBeenCalledTimes(1);
    });
});

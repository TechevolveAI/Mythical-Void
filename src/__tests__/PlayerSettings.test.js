const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadAudioManager(sceneWindow, storage) {
    const filePath = path.join(__dirname, '../systems/AudioManager.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source.replace(
        /\/\/ Export as singleton[\s\S]*export default audioManager;/,
        'module.exports = AudioManager;'
    );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: sceneWindow,
        localStorage: storage,
        document: {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        },
        console,
        Map,
        Math,
        Number,
        Promise,
        setTimeout,
        clearTimeout
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function loadFeedbackManager(sceneWindow, navigatorValue = {}) {
    const filePath = path.join(__dirname, '../systems/FeedbackManager.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source.replace(
        /\/\/ Create singleton instance[\s\S]*export default feedbackManager;/,
        'module.exports = FeedbackManager;'
    );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: sceneWindow,
        navigator: navigatorValue,
        console,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('player settings persistence', () => {
    test('AudioManager loads saved volume preferences and mute state', () => {
        const values = {
            'settings.audioMuted': true,
            'settings.volume.master': 0.4,
            'settings.volume.music': 0.3,
            'settings.volume.sfx': 0.6
        };
        const gameState = {
            get: jest.fn(pathName => values[pathName]),
            set: jest.fn(),
            save: jest.fn()
        };
        const storage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn()
        };
        const AudioManager = loadAudioManager({ GameState: gameState }, storage);
        const manager = new AudioManager();
        manager.generateCommonSounds = jest.fn();
        manager.setupMobileAudioUnlock = jest.fn();

        manager.initialize();

        expect(manager.isMuted()).toBe(true);
        expect(manager.getVolumes()).toEqual({
            master: 0.4,
            music: 0.3,
            sfx: 0.6
        });
    });

    test('volume and mute controls persist and update active music gain', () => {
        const gameState = {
            get: jest.fn(),
            set: jest.fn(),
            save: jest.fn()
        };
        const storage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn()
        };
        const AudioManager = loadAudioManager({ GameState: gameState }, storage);
        const manager = new AudioManager();
        const ramp = jest.fn();
        manager.audioContext = { currentTime: 10 };
        manager.musicNodes = {
            gainNode: {
                gain: { linearRampToValueAtTime: ramp }
            }
        };
        manager.musicPlaying = true;

        manager.setMasterVolume(0.5);
        manager.setMusicVolume(0.4);
        manager.setSFXVolume(0.3);
        manager.toggleMute();

        expect(gameState.set).toHaveBeenCalledWith('settings.volume.master', 0.5);
        expect(gameState.set).toHaveBeenCalledWith('settings.volume.music', 0.4);
        expect(gameState.set).toHaveBeenCalledWith('settings.volume.sfx', 0.3);
        expect(gameState.set).toHaveBeenCalledWith('settings.audioMuted', true);
        expect(gameState.save).toHaveBeenCalledTimes(4);
        expect(storage.setItem).toHaveBeenCalledWith('audioMasterVolume', '0.5');
        expect(storage.setItem).toHaveBeenCalledWith('audioMusicVolume', '0.4');
        expect(storage.setItem).toHaveBeenCalledWith('audioSFXVolume', '0.3');
        expect(ramp).toHaveBeenLastCalledWith(0, 10.1);
    });

    test('FeedbackManager saves haptic and screen-shake changes immediately', () => {
        const gameState = {
            get: jest.fn(pathName => pathName === 'settings.reducedMotion'
                ? false
                : true),
            set: jest.fn(),
            save: jest.fn()
        };
        const FeedbackManager = loadFeedbackManager(
            { GameState: gameState },
            { vibrate: jest.fn() }
        );
        const manager = new FeedbackManager();
        manager.init();

        manager.toggleHaptic();
        manager.toggleScreenShake();
        manager.toggleReducedMotion();

        expect(gameState.set).toHaveBeenCalledWith('settings.hapticEnabled', false);
        expect(gameState.set).toHaveBeenCalledWith('settings.screenShakeEnabled', false);
        expect(gameState.set).toHaveBeenCalledWith('settings.reducedMotion', true);
        expect(gameState.save).toHaveBeenCalledTimes(3);
    });

    test('reduced motion suppresses direct camera shake and flash effects', () => {
        const gameState = {
            get: jest.fn(pathName => pathName === 'settings.reducedMotion'
                ? false
                : true),
            set: jest.fn(),
            save: jest.fn()
        };
        const FeedbackManager = loadFeedbackManager(
            { GameState: gameState },
            { vibrate: jest.fn() }
        );
        const manager = new FeedbackManager();
        const shake = jest.fn();
        const flash = jest.fn();
        const scene = { cameras: { main: { shake, flash } } };
        manager.init();

        expect(manager.cameraShake(scene, 300, 0.02)).toBe(true);
        expect(manager.cameraFlash(scene, 300, 255, 255, 255)).toBe(true);
        manager.toggleReducedMotion();
        expect(manager.cameraShake(scene, 300, 0.02)).toBe(false);
        expect(manager.cameraFlash(scene, 300, 255, 255, 255)).toBe(false);

        expect(shake).toHaveBeenCalledTimes(1);
        expect(flash).toHaveBeenCalledTimes(1);
        expect(manager.getSettings().reducedMotionEnabled).toBe(true);
    });

    test('routes scene-level flashes and shakes through the preference manager', () => {
        const sceneRoot = path.join(__dirname, '../scenes');
        const sceneFiles = [];
        const collectFiles = directory => {
            fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
                const entryPath = path.join(directory, entry.name);
                if (entry.isDirectory()) collectFiles(entryPath);
                if (entry.isFile() && entry.name.endsWith('.js')) {
                    sceneFiles.push(entryPath);
                }
            });
        };
        collectFiles(sceneRoot);
        const sceneSource = sceneFiles
            .map(filePath => fs.readFileSync(filePath, 'utf8'))
            .join('\n');

        expect(sceneSource).not.toContain('this.cameras.main.shake(');
        expect(sceneSource).not.toContain('this.cameras.main.flash(');
        expect(
            sceneSource.match(/FeedbackManager\?\.cameraShake/g)?.length || 0
        ).toBeGreaterThanOrEqual(20);
        expect(
            sceneSource.match(/FeedbackManager\?\.cameraFlash/g)?.length || 0
        ).toBeGreaterThanOrEqual(20);
    });

    test('ships the settings surface while guarding cheat tools to development builds', () => {
        const menuSource = fs.readFileSync(
            path.join(__dirname, '../ui/HamburgerMenu.js'),
            'utf8'
        );
        const modalSource = fs.readFileSync(
            path.join(__dirname, '../ui/SettingsModal.js'),
            'utf8'
        );
        const gameSource = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const sceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );

        expect(menuSource).toContain("label: 'Settings'");
        expect(menuSource).toMatch(
            /if \(import\.meta\.env\.DEV\) \{[\s\S]*label: 'Developer Hacks'/
        );
        expect(menuSource).toContain('this.settingsModal?.destroy()');
        expect(menuSource).not.toContain("backgroundColor: '#333355'");
        expect(modalSource).toContain('setMasterVolume');
        expect(modalSource).toContain('setMusicVolume');
        expect(modalSource).toContain('setSFXVolume');
        expect(modalSource).toContain('toggleScreenShake');
        expect(modalSource).toContain('toggleHaptic');
        expect(modalSource).toContain('Reduced flashes and motion');
        expect(modalSource).toContain('toggleReducedMotion');
        expect(modalSource).toContain(
            '{ disabled: feedbackSettings.reducedMotionEnabled }'
        );
        expect(modalSource).toContain('this.scene.physics.pause()');
        expect(modalSource).toContain('this.scene.physics?.resume?.()');
        expect(modalSource).toContain('panelBlocker.setInteractive()');
        expect(gameSource).toContain("urlParams.has('testSettings')");
        expect(gameSource).toContain('settingsPreview: true');
        expect(sceneSource).toContain('createSettingsPreview()');
        expect(sceneSource).toContain('reducedMotionEnabled: false');
        expect(sceneSource).toContain('toggleReducedMotion()');
    });
});

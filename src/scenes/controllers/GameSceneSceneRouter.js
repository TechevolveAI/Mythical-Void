const AUDIO_METHODS = {
    buttonClick: 'playButtonClick',
    visionReveal: 'playVisionReveal',
    purchase: 'playPurchase'
};

export default class GameSceneSceneRouter {
    constructor(gameScene) {
        this.gameScene = gameScene;
    }

    get sceneManager() {
        const manager = this.gameScene?.scene;
        if (!manager) {
            throw new Error('GameSceneSceneRouter requires an active scene');
        }
        return manager;
    }

    playSound(action) {
        if (!action) {
            return;
        }

        const audioManager = window.AudioManager;
        const methodName = AUDIO_METHODS[action];

        if (!audioManager || !methodName || typeof audioManager[methodName] !== 'function') {
            return;
        }

        audioManager[methodName]();
    }

    showLoading(message) {
        if (!message) {
            return;
        }

        window.UXEnhancements?.showLoading?.(message);
    }

    launchScene(sceneKey, data = undefined, options = {}) {
        const {
            bringToTop = false,
            loadingMessage = null,
            sound = null
        } = options;

        this.playSound(sound);
        this.showLoading(loadingMessage);

        const manager = this.sceneManager;
        manager.launch(sceneKey, data);

        if (bringToTop) {
            manager.bringToTop(sceneKey);
        }
    }

    pauseAndLaunchScene(sceneKey, data = undefined, options = {}) {
        const {
            bringToTop = false,
            loadingMessage = null,
            sound = null
        } = options;

        this.playSound(sound);
        this.showLoading(loadingMessage);

        const manager = this.sceneManager;
        manager.pause();
        manager.launch(sceneKey, data);

        if (bringToTop) {
            manager.bringToTop(sceneKey);
        }
    }

    startScene(sceneKey, data = undefined, options = {}) {
        const {
            loadingMessage = null,
            sound = null
        } = options;

        this.playSound(sound);
        this.showLoading(loadingMessage);

        this.sceneManager.start(sceneKey, data);
    }
}

const AUDIO_METHODS = {
    buttonClick: 'playButtonClick',
    visionReveal: 'playVisionReveal',
    purchase: 'playPurchase'
};

export default class GameSceneSceneRouter {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.pendingTransitions = new Map();
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

    isSceneRegistered(sceneKey) {
        const manager = this.gameScene?.game?.scene;
        return Boolean(
            manager?.keys?.[sceneKey] ||
            manager?.scenes?.some?.(
                scene => scene?.sys?.settings?.key === sceneKey
            )
        );
    }

    runWhenReady(sceneKey, transition, options = {}) {
        const {
            loadingMessage = null,
            sound = null
        } = options;

        if (this.pendingTransitions.has(sceneKey)) {
            return this.pendingTransitions.get(sceneKey);
        }

        this.playSound(sound);
        this.showLoading(loadingMessage);

        const executeTransition = () => {
            transition();
            return true;
        };
        const loader = window.SceneLoader;

        if (!loader?.loadScene || this.isSceneRegistered(sceneKey)) {
            try {
                return Promise.resolve(executeTransition());
            } catch (error) {
                console.error(`[SceneRouter] Failed to open ${sceneKey}:`, error);
                window.UXEnhancements?.hideLoading?.();
                return Promise.resolve(false);
            }
        }

        const pending = loader.loadScene(this.gameScene.game, sceneKey)
            .then(loaded => {
                if (!loaded) {
                    throw new Error(`${sceneKey} could not be loaded`);
                }
                return executeTransition();
            })
            .catch(error => {
                console.error(`[SceneRouter] Failed to open ${sceneKey}:`, error);
                window.UXEnhancements?.hideLoading?.();
                return false;
            })
            .finally(() => {
                this.pendingTransitions.delete(sceneKey);
            });

        this.pendingTransitions.set(sceneKey, pending);
        return pending;
    }

    launchScene(sceneKey, data = undefined, options = {}) {
        const {
            bringToTop = false
        } = options;

        return this.runWhenReady(sceneKey, () => {
            const manager = this.sceneManager;
            manager.launch(sceneKey, data);

            if (bringToTop) {
                manager.bringToTop(sceneKey);
            }
        }, options);
    }

    pauseAndLaunchScene(sceneKey, data = undefined, options = {}) {
        const {
            bringToTop = false
        } = options;

        return this.runWhenReady(sceneKey, () => {
            const manager = this.sceneManager;
            manager.pause();
            manager.launch(sceneKey, data);

            if (bringToTop) {
                manager.bringToTop(sceneKey);
            }
        }, options);
    }

    startScene(sceneKey, data = undefined, options = {}) {
        return this.runWhenReady(
            sceneKey,
            () => this.sceneManager.start(sceneKey, data),
            options
        );
    }
}

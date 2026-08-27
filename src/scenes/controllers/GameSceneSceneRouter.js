const AUDIO_METHODS = {
    buttonClick: 'playButtonClick',
    visionReveal: 'playVisionReveal',
    purchase: 'playPurchase'
};

export default class GameSceneSceneRouter {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.pendingTransitions = new Map();
        this.activeTransition = null;
        this.managedDestinationScenes = new Set();
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

    isSourceSceneReady() {
        const sceneKey = this.gameScene?.sys?.settings?.key;
        const manager = this.gameScene?.game?.scene;
        if (
            !sceneKey ||
            typeof manager?.isActive !== 'function' ||
            typeof manager?.isPaused !== 'function'
        ) {
            return true;
        }
        return manager.isActive(sceneKey) && !manager.isPaused(sceneKey);
    }

    hasManagedDestinationOpen() {
        const manager = this.gameScene?.game?.scene;
        if (!manager) return false;
        return [...this.managedDestinationScenes].some(sceneKey => (
            manager.isActive?.(sceneKey) || manager.isPaused?.(sceneKey)
        ));
    }

    runWhenReady(sceneKey, transition, options = {}) {
        const {
            loadingMessage = null,
            sound = null
        } = options;

        const existing = this.pendingTransitions.get(sceneKey);
        if (existing) {
            return existing;
        }
        if (
            this.activeTransition ||
            !this.isSourceSceneReady() ||
            this.hasManagedDestinationOpen()
        ) {
            return Promise.resolve(false);
        }

        this.playSound(sound);
        this.showLoading(loadingMessage);

        const executeTransition = () => {
            transition();
            this.managedDestinationScenes.add(sceneKey);
            return true;
        };
        const loader = window.SceneLoader;
        let operation;

        if (!loader?.loadScene || this.isSceneRegistered(sceneKey)) {
            try {
                operation = Promise.resolve(executeTransition());
            } catch (error) {
                console.error(`[SceneRouter] Failed to open ${sceneKey}:`, error);
                window.UXEnhancements?.hideLoading?.();
                operation = Promise.resolve(false);
            }
        } else {
            operation = loader.loadScene(this.gameScene.game, sceneKey)
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
                });
        }

        let pending;
        pending = operation.finally(() => {
            if (this.pendingTransitions.get(sceneKey) === pending) {
                this.pendingTransitions.delete(sceneKey);
            }
            if (this.activeTransition?.promise === pending) {
                this.activeTransition = null;
            }
        });
        this.pendingTransitions.set(sceneKey, pending);
        this.activeTransition = { sceneKey, promise: pending };
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

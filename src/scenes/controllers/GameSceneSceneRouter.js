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

        try { audioManager[methodName](); }
        catch { console.warn('[SceneRouter] Optional sound feedback unavailable'); }
    }

    showLoading(message, owner = null) {
        if (!message) {
            return;
        }

        try { window.UXEnhancements?.showLoading?.(message, owner); }
        catch { console.warn('[SceneRouter] Optional loading presentation unavailable'); }
    }

    hideLoading(owner) {
        try { window.UXEnhancements?.hideLoading?.(owner); }
        catch { console.warn('[SceneRouter] Optional loading cleanup unavailable'); }
    }

    bringDestinationToTop(manager, sceneKey) {
        try { manager.bringToTop(sceneKey); }
        catch { console.warn('[SceneRouter] Optional scene ordering unavailable'); }
    }

    holdThroughQueueFrame(attempt) {
        const frames = this.gameScene?.game?.events;
        const lifecycle = this.gameScene?.events;
        if (typeof frames?.once !== 'function' || typeof frames?.off !== 'function') return;
        const release = () => {
            frames.off('poststep', release);
            lifecycle?.off?.('shutdown', release);
            lifecycle?.off?.('destroy', release);
            attempt.release = null;
            if (this.activeTransition === attempt) this.activeTransition = null;
        };
        attempt.release = release;
        frames.once('poststep', release);
        lifecycle?.once?.('shutdown', release);
        lifecycle?.once?.('destroy', release);
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
        if (
            !this.gameScene ||
            this.gameScene._isShuttingDown ||
            this.gameScene._finaleTransitionPending ||
            (this.gameScene.sceneRouter && this.gameScene.sceneRouter !== this)
        ) {
            return false;
        }
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

        if (!this.isSourceSceneReady()) {
            return Promise.resolve(false);
        }
        const existing = this.pendingTransitions.get(sceneKey);
        if (existing) {
            return existing;
        }
        if (
            this.activeTransition ||
            this.hasManagedDestinationOpen()
        ) {
            return Promise.resolve(false);
        }

        // Publish admission before feedback, loaders or queue calls can reenter.
        let settle;
        const operation = new Promise(resolve => { settle = resolve; });
        const attempt = { sceneKey, promise: null, release: null };
        const pending = operation.finally(() => {
            if (this.pendingTransitions.get(sceneKey) === pending) this.pendingTransitions.delete(sceneKey);
            if (this.activeTransition === attempt && !attempt.release) this.activeTransition = null;
        });
        attempt.promise = pending;
        this.pendingTransitions.set(sceneKey, pending);
        this.activeTransition = attempt;

        const executeTransition = () => {
            // A lazy load may outlive the source scene or its finale handoff.
            if (this.activeTransition !== attempt || !this.isSourceSceneReady() || this.hasManagedDestinationOpen()) {
                if (loadingMessage && (!this.gameScene?.sceneRouter || this.gameScene.sceneRouter === this)) {
                    this.hideLoading(attempt);
                }
                return false;
            }
            transition();
            this.managedDestinationScenes.add(sceneKey);
            // ScenePlugin queues work; a resolved request is not a processed frame.
            this.holdThroughQueueFrame(attempt);
            return true;
        };
        const fail = error => {
            console.error(`[SceneRouter] Failed to open ${sceneKey}:`, error);
            this.hideLoading(attempt);
            settle(false);
        };

        try {
            this.playSound(sound);
            this.showLoading(loadingMessage, attempt);
            const loader = window.SceneLoader;
            if (!loader?.loadScene || this.isSceneRegistered(sceneKey)) {
                settle(executeTransition());
            } else {
                Promise.resolve(loader.loadScene(this.gameScene.game, sceneKey)).then(loaded => {
                    if (!loaded) {
                        throw new Error(`${sceneKey} could not be loaded`);
                    }
                    return executeTransition();
                }).then(settle, fail);
            }
        } catch (error) { fail(error); }
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
                this.bringDestinationToTop(manager, sceneKey);
            }
        }, options);
    }

    pauseAndLaunchScene(sceneKey, data = undefined, options = {}) {
        const {
            bringToTop = false
        } = options;

        return this.runWhenReady(sceneKey, () => {
            const source = this.gameScene;
            const manager = this.sceneManager;
            try {
                manager.pause();
                manager.launch(sceneKey, data);
            } catch (error) {
                // Resume the owned source even if its pause is still in Phaser's queue.
                if (this.gameScene === source && source.scene === manager && !source._isShuttingDown &&
                    !source._finaleTransitionPending && (!source.sceneRouter || source.sceneRouter === this)) {
                    try { manager.resume?.(); }
                    catch { console.warn('[SceneRouter] Source resume request unavailable'); }
                }
                throw error;
            }
            if (bringToTop) this.bringDestinationToTop(manager, sceneKey);
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

/**
 * Pauses gameplay while the browser tab is hidden without disturbing scenes
 * that were already paused by menus, modals, or scene transitions.
 */
export default class PageVisibilityController {
    constructor(options = {}) {
        this.game = options.game || null;
        this.documentRef = options.documentRef
            || (typeof document !== 'undefined' ? document : null);
        this.onHidden = options.onHidden || null;
        this.logger = options.logger || console;
        this.visibilityPausedScenes = new Set();
        this.attached = false;
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    attach() {
        if (this.attached || !this.documentRef?.addEventListener) {
            return false;
        }

        this.documentRef.addEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        this.attached = true;
        return true;
    }

    detach() {
        if (this.attached && this.documentRef?.removeEventListener) {
            this.documentRef.removeEventListener(
                'visibilitychange',
                this.handleVisibilityChange
            );
        }

        this.attached = false;
        this.visibilityPausedScenes.clear();
    }

    handleVisibilityChange() {
        if (this.documentRef?.hidden) {
            this.pauseRunningScenes();
            this.runHiddenCallback();
            return;
        }

        this.resumeVisibilityPausedScenes();
    }

    pauseRunningScenes() {
        const sceneManager = this.game?.scene;
        if (typeof sceneManager?.getScenes !== 'function') {
            return;
        }

        this.visibilityPausedScenes.clear();

        let activeScenes = [];
        try {
            activeScenes = sceneManager.getScenes(true) || [];
        } catch (error) {
            this.logger.warn('[PageVisibility] Could not inspect active scenes:', error);
            return;
        }

        activeScenes.forEach((scene) => {
            try {
                if (
                    scene?.scene?.isActive?.()
                    && !scene.scene.isPaused?.()
                ) {
                    scene.scene.pause();
                    this.visibilityPausedScenes.add(scene);
                }
            } catch (error) {
                this.logger.warn('[PageVisibility] Could not pause scene:', error);
            }
        });
    }

    resumeVisibilityPausedScenes() {
        const scenesToResume = Array.from(this.visibilityPausedScenes);
        this.visibilityPausedScenes.clear();

        scenesToResume.forEach((scene) => {
            try {
                if (scene?.scene?.isPaused?.()) {
                    scene.scene.resume();
                }
            } catch (error) {
                this.logger.warn('[PageVisibility] Could not resume scene:', error);
            }
        });
    }

    runHiddenCallback() {
        if (typeof this.onHidden !== 'function') {
            return;
        }

        try {
            this.onHidden();
        } catch (error) {
            this.logger.warn('[PageVisibility] Hidden-state callback failed:', error);
        }
    }
}

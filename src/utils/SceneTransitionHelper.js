/**
 * SceneTransitionHelper - small utilities for safe scene transitions
 *
 * Keeps common stop/pause/resume/topmost operations in one place so scenes
 * can stay focused on their own flow logic.
 */

export default class SceneTransitionHelper {
    static getSceneManager(scene) {
        return scene?.scene || scene?.game?.scene || null;
    }

    static getCurrentSceneKey(scene) {
        return scene?.sys?.settings?.key || scene?.scene?.key || null;
    }

    static isSceneActive(scene, sceneKey) {
        const manager = this.getSceneManager(scene);
        if (!manager || !sceneKey || typeof manager.isActive !== 'function') {
            return false;
        }

        try {
            return !!manager.isActive(sceneKey);
        } catch (error) {
            return false;
        }
    }

    static stopScene(scene, sceneKey = null) {
        const manager = this.getSceneManager(scene);
        if (!manager || typeof manager.stop !== 'function') {
            return false;
        }

        try {
            if (sceneKey) {
                manager.stop(sceneKey);
            } else {
                manager.stop();
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    static stopScenes(scene, sceneKeys = []) {
        let stoppedAny = false;
        sceneKeys.forEach(sceneKey => {
            stoppedAny = this.stopScene(scene, sceneKey) || stoppedAny;
        });
        return stoppedAny;
    }

    static stopActiveScenes(scene, sceneKeys = []) {
        let stoppedAny = false;
        sceneKeys.forEach(sceneKey => {
            if (this.isSceneActive(scene, sceneKey)) {
                stoppedAny = this.stopScene(scene, sceneKey) || stoppedAny;
            }
        });
        return stoppedAny;
    }

    static pauseScene(scene, sceneKey = null) {
        const manager = this.getSceneManager(scene);
        if (!manager || typeof manager.pause !== 'function') {
            return false;
        }

        try {
            if (sceneKey) {
                manager.pause(sceneKey);
            } else {
                manager.pause();
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    static pauseActiveScenes(scene, sceneKeys = []) {
        let pausedAny = false;
        sceneKeys.forEach(sceneKey => {
            if (this.isSceneActive(scene, sceneKey)) {
                pausedAny = this.pauseScene(scene, sceneKey) || pausedAny;
            }
        });
        return pausedAny;
    }

    static resumeScene(scene, sceneKey = null) {
        const manager = this.getSceneManager(scene);
        if (!manager || typeof manager.resume !== 'function') {
            return false;
        }

        try {
            if (sceneKey) {
                manager.resume(sceneKey);
            } else {
                manager.resume();
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    static bringToTop(scene, sceneKey = null) {
        const manager = this.getSceneManager(scene);
        if (!manager || typeof manager.bringToTop !== 'function') {
            return false;
        }

        const targetKey = sceneKey || this.getCurrentSceneKey(scene);

        try {
            if (targetKey) {
                manager.bringToTop(targetKey);
            } else {
                manager.bringToTop();
            }
            return true;
        } catch (error) {
            return false;
        }
    }
}

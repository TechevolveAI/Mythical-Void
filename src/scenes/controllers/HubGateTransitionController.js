const LEVEL_SCENES = Object.freeze({
    crystal_caves: 'CrystalCavesLevel', stellar_reef: 'ReefLevel',
    mythical_forest: 'MythicalForestLevel', void_peaks: 'VoidPeaksLevel',
    aurora_depths: 'AuroraDepthsLevel', final_void: 'FinalVoidLevel'
});

export default class HubGateTransitionController {
    constructor(scene, mediaService) {
        this.scene = scene;
        this.mediaService = mediaService;
        this.current = null;
    }

    reset() {
        this.retire(this.current, true);
    }

    feedback(action) {
        try {
            const result = action();
            Promise.resolve(result).catch(() => console.warn('[HubGate] Optional presentation unavailable'));
            return result;
        } catch { console.warn('[HubGate] Optional presentation unavailable'); }
    }

    isCurrent(attempt) {
        const scene = this.scene;
        if (!attempt || attempt.retired || this.current !== attempt || scene.gateEntryController !== this ||
            scene._isShuttingDown || scene.scene !== attempt.plugin || window.GameState !== attempt.gameState) return false;
        try {
            const admission = attempt.gameState?.getSaveAdmission?.();
            return admission?.status !== 'held' &&
                (attempt.admissionEpoch === undefined || admission?.epoch === attempt.admissionEpoch);
        } catch { return false; }
    }

    requireCurrent(attempt) {
        if (this.isCurrent(attempt)) return true;
        this.retire(attempt, true);
        return false;
    }

    present(attempt, action) {
        if (this.requireCurrent(attempt)) return this.feedback(action);
    }

    enter(gate) {
        const scene = this.scene;
        if (!gate?.id || scene._isShuttingDown || scene.isTransitioning || scene.isProjectBeaconDebriefOpen) return false;
        if (gate.data?.inDevelopment) { scene.showComingSoonModal(gate); return false; }

        const gameState = window.GameState;
        const attempt = { gate, gameState, plugin: scene.scene, camera: scene.cameras?.main,
            admissionEpoch: gameState?.getSaveAdmission?.().epoch, retired: false, started: false,
            fallback: null, timers: new Set(), tweens: new Set(), objects: new Set() };
        attempt.isCurrent = () => this.isCurrent(attempt);
        attempt.keepTween = tween => { attempt.tweens.add(tween); return tween; };
        attempt.keepObject = object => { attempt.objects.add(object); return object; };
        attempt.keepTimer = timer => { attempt.timers.add(timer); return timer; };
        attempt.later = (delay, action) => {
            const timer = scene.time.delayedCall(delay, () => {
                attempt.timers.delete(timer);
                if (!attempt.started) this.present(attempt, action);
            });
            attempt.timers.add(timer);
            return timer;
        };
        this.current = attempt;
        scene.isTransitioning = true;
        scene.gateTransitionStarted = false;
        if (!this.requireCurrent(attempt)) return false;

        try {
            const entryResult = scene.progressionPreview ? { success: true } : gameState?.enterGate(gate.id);
            if (!this.requireCurrent(attempt)) return false;
            if (entryResult && entryResult.success !== true) {
                this.retire(attempt, false);
                scene.showUnlockConfirmation(gate);
                return false;
            }

            // Arm the independent path before any optional media, loading or FX call.
            attempt.fallback = setTimeout(() => this.begin(gate, attempt), 1800);
            scene.gateTransitionFallback = attempt.fallback;
            const resume = this.present(attempt, () => scene.getExpeditionResumeForGate(gate.id));
            if (gate.id === 'mythical_forest') {
                this.present(attempt, () => (window.CompanionMediaService || this.mediaService)?.prepareCinematic?.(scene, {
                    momentId: 'first_forest_arrival', stage: gameState?.get?.('creature.lifecycle.stage') || 'baby'
                }));
            }
            if (!this.requireCurrent(attempt)) return false;
            this.feedback(() => attempt.later(800, () => this.showLoading(attempt,
                resume ? `Reconnecting at ${resume.label}...` : `Traveling to ${gate.data?.name || gate.id}...`
            )));
            this.present(attempt, () => scene.playCinematicGateEntry(gate, attempt));
            return true;
        } catch (error) {
            this.retire(attempt, true);
            throw error;
        }
    }

    clearFallback(attempt) {
        if (this.scene.gateTransitionFallback === attempt.fallback) this.scene.gateTransitionFallback = null;
        if (attempt.fallback !== null) clearTimeout(attempt.fallback);
        attempt.fallback = null;
    }

    begin(gate, attempt = this.current) {
        if (!this.requireCurrent(attempt) || attempt.gate !== gate || attempt.started) return false;
        attempt.started = true;
        this.scene.gateTransitionStarted = true;
        this.clearFallback(attempt);
        attempt.timers.forEach(timer => this.feedback(() => timer.remove?.(false)));
        attempt.timers.clear();
        this.loadAndStart(gate, attempt).catch(() => this.fail(attempt));
        return true;
    }

    showLoading(attempt, message) {
        this.present(attempt, () => window.UXEnhancements?.showLoading?.(message, attempt));
    }

    hideLoading(attempt) {
        this.feedback(() => window.UXEnhancements?.hideLoading?.(attempt));
    }

    async loadAndStart(gate, attempt = this.current) {
        if (!this.requireCurrent(attempt) || attempt.gate !== gate) return false;
        const scene = this.scene;
        const sceneName = LEVEL_SCENES[gate.id];
        try {
            if (sceneName) {
                this.showLoading(attempt, `Loading ${gate.data?.name || 'level'}...`);
                if (!this.requireCurrent(attempt)) return false;
                if (window.SceneLoader) {
                    const loaded = await window.SceneLoader.loadScene(scene.game, sceneName);
                    if (!this.requireCurrent(attempt)) return false;
                    if (!loaded) throw new Error(`${sceneName} could not be loaded`);
                } else {
                    const registeredScene = scene.game?.scene?.keys?.[sceneName] ||
                        scene.game?.scene?.scenes?.find?.(item => item?.sys?.settings?.key === sceneName);
                    if (!registeredScene) throw new Error(`${sceneName} is not registered`);
                }
            }
            this.hideLoading(attempt);
            if (!this.requireCurrent(attempt)) return false;
            this.present(attempt, () => scene.clearGateTransitionFx(false));
            if (!this.requireCurrent(attempt)) return false;
            if (sceneName) scene.scene.start(sceneName);
            else scene.scene.start('GameScene', { biome: gate.id === 'main' ? 'nebula' : gate.data?.biome });
            return true;
        } catch (error) {
            if (this.isCurrent(attempt)) {
                console.error('[HubGate] Required scene request failed');
                this.fail(attempt);
            } else this.retire(attempt, true);
            return false;
        }
    }

    fail(attempt) {
        if (!this.requireCurrent(attempt)) return;
        const label = attempt.gate.data?.name || LEVEL_SCENES[attempt.gate.id] || attempt.gate.id;
        this.retire(attempt, true);
        if (!this.current && !this.scene._isShuttingDown) this.feedback(() => this.scene.showLevelLoadError(label));
    }

    retire(attempt = this.current, restoreCamera = false) {
        if (!attempt || attempt.retired) return;
        const scene = this.scene;
        const owned = this.current === attempt;
        attempt.retired = true;
        if (owned) {
            this.current = null;
            scene.isTransitioning = false;
            scene.gateTransitionStarted = false;
        }
        this.clearFallback(attempt);
        attempt.timers.forEach(timer => this.feedback(() => timer.remove?.(false)));
        attempt.tweens.forEach(tween => this.feedback(() => tween.stop?.()));
        attempt.objects.forEach(object => this.feedback(() => object.destroy?.()));
        attempt.timers.clear(); attempt.tweens.clear(); attempt.objects.clear();
        this.hideLoading(attempt);
        if (owned && !this.current) {
            this.feedback(() => scene.clearGateTransitionFx(false));
            if (restoreCamera && !scene._isShuttingDown && scene.cameras?.main === attempt.camera) {
                this.feedback(() => scene.clearGateTransitionFx(true));
            }
        }
    }
}

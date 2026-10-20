/** Runtime-only menu pause. Never changes the scene's saved state or clock rate. */
export default class PlatformerPauseSession {
    constructor(scene) {
        this.scene = scene;
        this.systems = scene.sys;
        this.plugin = scene.scene;
        this.events = scene.events;
        this.physics = scene.physics;
        this.world = scene.physics?.world;
        this.clock = scene.time;
        this.tweens = scene.tweens;
        this.player = scene.player;
        this.playerBody = scene.player?.body;
        this.physicsWasPaused = this.world?.isPaused === true;
        this.resumePhysics = !this.physicsWasPaused;
        this.enforcingPhysics = false;
        this.clockWasPaused = this.clock?.paused === true;
        this.tweenRate = this.tweens?.timeScale;
        this.controlsWereVisible = scene.platformerControlsVisible !== false;
        this.closed = false;
        this.releasePending = false;
        this.release = this.release.bind(this);
        this.retire = () => this.finish(false);
        this.onPhysicsPause = () => {
            if (this.isCurrent() && !this.enforcingPhysics) this.resumePhysics = false;
        };
        this.onPhysicsResume = () => {
            if (!this.isCurrent()) return;
            this.resumePhysics = true;
            this.holdPhysics();
        };
    }

    static open(scene) {
        if (scene.isPlayerDead || scene.levelCompletionActive || scene._returningToHub || scene.sys?.isActive?.() === false) return null;
        if (scene.pauseMenuSession?.isCurrent()) return scene.pauseMenuSession;
        scene.pauseMenuSession?.retire();
        const session = new PlatformerPauseSession(scene);
        scene.pauseMenuSession = session;
        session.events?.once('shutdown', session.retire);
        session.events?.once('destroy', session.retire);
        session.world?.on('pause', session.onPhysicsPause);
        session.world?.on('resume', session.onPhysicsResume);
        try {
            session.holdPhysics();
            if (!session.isCurrent() || scene.isPlayerDead || scene.levelCompletionActive || scene._returningToHub) {
                session.retire(); return null;
            }
            if (session.clock) session.clock.paused = true;
            // Keep the manager's timebase ticking, but freeze tween progress.
            // pauseAll would accumulate a short unrendered interval on resume.
            if (session.tweens) session.tweens.timeScale = 0;
            if (!session.isCurrent() || scene.isPlayerDead || scene.levelCompletionActive || scene._returningToHub) {
                session.retire(); return null;
            }
            return session;
        } catch (error) {
            try { session.release(); } catch { /* Preserve the original opening failure. */ }
            throw error;
        }
    }

    sameScene() {
        const scene = this.scene;
        return scene.sys === this.systems && scene.scene === this.plugin && scene.events === this.events &&
            scene.physics === this.physics && scene.physics?.world === this.world && scene.time === this.clock &&
            scene.tweens === this.tweens && scene.player === this.player && scene.player?.body === this.playerBody;
    }

    holdPhysics() {
        if (this.enforcingPhysics || !this.isCurrent() || this.world?.isPaused === true) return;
        this.enforcingPhysics = true;
        try { this.physics.pause(); }
        finally { this.enforcingPhysics = false; }
    }

    isCurrent() {
        return !this.closed && this.scene.pauseMenuSession === this && this.sameScene();
    }

    release() {
        if (!this.isCurrent()) return this.finish(false);
        if (this.systems?.isPaused?.() || this.systems?.isSleeping?.()) {
            if (!this.releasePending) {
                this.releasePending = true;
                this.events?.once('resume', this.release);
                this.events?.once('wake', this.release);
            }
            return false;
        }
        return this.finish(true);
    }

    finish(restore) {
        if (this.closed) return false;
        const owned = this.isCurrent();
        this.closed = true;
        this.events?.off('shutdown', this.retire);
        this.events?.off('destroy', this.retire);
        this.events?.off('resume', this.release);
        this.events?.off('wake', this.release);
        this.world?.off('pause', this.onPhysicsPause);
        this.world?.off('resume', this.onPhysicsResume);
        if (this.scene.pauseMenuSession === this) this.scene.pauseMenuSession = null;
        const current = () => owned && this.sameScene() && this.scene.pauseMenuSession === null &&
            !this.scene.pauseMenuActive && !this.scene.isPlayerDead && !this.scene.levelCompletionActive &&
            !this.scene._returningToHub && this.systems?.isActive?.() !== false;
        if (!restore || !current()) return false;
        let failed = false, failure;
        const attempt = action => {
            try { action(); } catch (error) { if (!failed) { failed = true; failure = error; } }
        };
        if (this.clock && !this.clockWasPaused) attempt(() => { this.clock.paused = false; });
        if (current() && this.tweens?.timeScale === 0) {
            // Flush elapsed bookkeeping at zero rate if the tab had no frames.
            attempt(() => this.tweens.update());
            if (current() && this.tweens.timeScale === 0) attempt(() => { this.tweens.timeScale = this.tweenRate; });
        }
        if (current() && this.resumePhysics) attempt(() => this.physics.resume());
        if (current() && this.controlsWereVisible) attempt(() => this.scene.showPlatformerMobileControls());
        if (failed) throw failure;
        return current();
    }
}

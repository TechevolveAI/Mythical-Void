import { copyDetachedJsonData as copy } from '../../utils/DetachedJsonData.js';

function businessState(state) {
    const value = copy(state);
    delete value.savedAt;
    if (value.player) { delete value.player.playTime; delete value.player.lastPlayed; }
    if (value.session) delete value.session.sessionStart;
    if (value.creature) delete value.creature.portraits;
    if (value.story) delete value.story.companionMedia;
    value.creatures?.forEach(creature => { if (creature) delete creature.portraits; });
    return JSON.stringify(value);
}

export default class ReefVictorySequence {
    constructor(scene) {
        const state = this.state = window.GameState, cloud = this.cloud = window.CloudSave;
        this.scene = scene; this.phase = 'created'; this.retired = false; this.serial = 0;
        this.root = state.state; this.admission = state.saveAdmission; this.epoch = state.getSaveAdmission().epoch;
        this.key = state.saveKey; this.mode = state.storageMode;
        this.identity = state.getHatchActiveIdentity(); this.creatureId = state.get('creature.id');
        this.cloudEpoch = cloud?.campaignEpoch; this.cloudUser = cloud?.currentUser?.id;
        this.business = businessState(this.root); this.guardianAt = Date.now();
        this.sys = scene.sys; this.plugin = scene.scene; this.clock = scene.time; this.events = scene.events;
        this.input = scene.input; this.keyboard = scene.input?.keyboard; this.physics = scene.physics; this.world = scene.physics?.world;
        this.camera = scene.cameras?.main; this.tweenManager = scene.tweens; this.lifetime = scene.completionSaveLifetime;
        this.player = scene.player; this.playerBody = scene.player?.body;
        this.boss = scene.boss; this.bodyActor = scene.bossBody; this.body = this.bodyActor?.body;
        this.destroyBoss = this.boss?.destroy; this.destroyActor = this.bodyActor?.destroy; this.destroyBody = this.body?.destroy;
        this.encounter = scene.guardianEncounter; this.encounterData = JSON.stringify(copy(this.encounter));
        this.registration = this.sys?.game?.scene; this.getScene = this.registration?.getScene; this.sceneKey = this.sys?.settings?.key;
        this.isActive = this.sys?.isActive;
        this.methods = Object.fromEntries(['showVictoryScreen', 'startSavedReefCompletion', 'scheduleGuardianTransition',
            'cancelGuardianTransition'].map(name => [name, scene[name]]));
        this.timers = new Map(); this.tweens = new Set(); this.artDestructionAttempted = false;
        this.onRetire = () => this.retire();
        scene.reefVictory = this; scene.completionGuardianAt = this.guardianAt;
        this.events.once('shutdown', this.onRetire); this.player.once?.('destroy', this.onRetire);
        this.offAdmission = state.on('saveAdmissionChanged', () => { if (!this.isCurrent()) this.retire(); });
    }

    runtimeCurrent() {
        const s = this.scene, p = this.player, actor = this.bodyActor, state = this.state;
        return !this.retired && s.reefVictory === this && s.completionSaveLifetime === this.lifetime &&
            s.completionGuardianAt === this.guardianAt && window.GameState === state && state.saveAdmission === this.admission &&
            state.getSaveAdmission().epoch === this.epoch && state.getSaveAdmission().status === 'ready' &&
            state.saveKey === this.key && state.storageMode === this.mode && window.CloudSave === this.cloud &&
            this.cloud?.campaignEpoch === this.cloudEpoch && this.cloud?.currentUser?.id === this.cloudUser &&
            state.getHatchActiveIdentity() === this.identity && state.get('creature.id') === this.creatureId &&
            s.sys === this.sys && s.scene === this.plugin && s.events === this.events && s.time === this.clock && s.tweens === this.tweenManager &&
            s.input === this.input && this.input?.keyboard === this.keyboard && s.physics === this.physics && this.physics?.world === this.world &&
            s.cameras?.main === this.camera && s.player === p && p?.active && p.scene === s && p.body === this.playerBody &&
            this.playerBody?.world === this.world && this.playerBody?.gameObject === p &&
            s.boss === this.boss && this.boss?.destroy === this.destroyBoss && s.bossBody === actor &&
            actor?.active && actor.scene === s && actor.body === this.body && actor.destroy === this.destroyActor &&
            this.body?.destroy === this.destroyBody && this.body?.world === this.world && this.body?.gameObject === actor &&
            s.guardianEncounter === this.encounter && JSON.stringify(copy(this.encounter)) === this.encounterData &&
            s.bossDefeated && !s.bossFightActive && !s._returningToHub && this.sys.isActive === this.isActive && this.isActive.call(this.sys) === true &&
            this.sys.scene === s && this.sys.events === this.events && this.sys.settings?.key === this.sceneKey &&
            this.sys.game?.scene === this.registration && this.registration?.getScene === this.getScene &&
            this.getScene?.call(this.registration, this.sceneKey) === s && Object.entries(this.methods).every(([name, method]) => s[name] === method);
    }

    isCurrent() {
        try { return this.runtimeCurrent() && this.state.state === this.root && businessState(this.root) === this.business; }
        catch { return false; }
    }

    requireCurrent() {
        if (this.isCurrent()) return true;
        this.retire(); return false;
    }

    feedback(action) {
        try { const value = action(); try { Promise.prototype.then.call(value, undefined, () => {}); } catch { /* Not a promise. */ } return value; }
        catch { /* Optional effects cannot discard an earned, current result. */ }
    }

    present(action) { if (this.requireCurrent()) return this.feedback(action); }

    later(delay, action) {
        if (!this.requireCurrent()) return null;
        const key = `reef-victory-${++this.serial}`;
        const entry = { active: true, record: null, wall: null }; this.timers.set(key, entry);
        const settle = () => {
            if (!entry.active) return;
            entry.active = false; this.timers.delete(key);
            if (entry.wall != null) window.clearTimeout(entry.wall);
            if (this.requireCurrent()) action();
        };
        try { entry.record = this.methods.scheduleGuardianTransition.call(this.scene, key, delay, settle); } catch { /* Use the owned wall fallback. */ }
        if (!entry.record && entry.active) {
            try { entry.wall = window.setTimeout(settle, delay + 600); } catch { settle(); }
        }
        return entry;
    }

    start() {
        if (this.phase !== 'created' || !this.requireCurrent()) return false;
        this.phase = 'withdrawing';
        this.later(2600, () => this.finish());
        this.later(2200, () => this.releaseVisuals());
        return this.isCurrent();
    }

    fade() {
        const boss = this.boss, owner = boss?.scene, active = boss?.active, proxy = { progress: 0 };
        const start = { alpha: boss?.alpha, scaleX: boss?.scaleX, scaleY: boss?.scaleY }, scale = this.scene.bossTargetScale * 0.9;
        return this.present(() => {
            const tween = this.tweenManager.add({ targets: proxy, progress: 1, duration: 2200, ease: 'Sine.easeInOut',
                onUpdate: () => {
                    if (!this.visualCurrent() || this.artDestructionAttempted || boss.scene !== owner || boss.active !== active) { tween?.stop?.(); return; }
                    boss.alpha = start.alpha + (0.12 - start.alpha) * proxy.progress;
                    boss.scaleX = start.scaleX + (scale - start.scaleX) * proxy.progress;
                    boss.scaleY = start.scaleY + (scale - start.scaleY) * proxy.progress;
                } });
            if (tween) this.tweens.add(tween); return tween;
        });
    }

    visualCurrent() {
        try { return this.runtimeCurrent() && this.state.state === this.root; } catch { return false; }
    }

    fadeUI() {
        const ui = this.scene.bossUI;
        if (!ui) return;
        const owner = ui.scene, active = ui.active, destroy = ui.destroy, from = ui.alpha, proxy = { progress: 0 };
        this.present(() => {
            const tween = this.tweenManager.add({ targets: proxy, progress: 1, duration: 500,
                onUpdate: () => {
                    if (!this.visualCurrent() || this.scene.bossUI !== ui || ui.scene !== owner || ui.active !== active || ui.destroy !== destroy) { tween?.stop?.(); return; }
                    ui.alpha = from * (1 - proxy.progress);
                } });
            if (tween) this.tweens.add(tween);
        });
    }

    releaseVisuals() {
        if (!this.requireCurrent() || this.artDestructionAttempted) return false;
        // Artwork is cosmetic; retain the disabled original physics actor until
        // the completion writer confirms the entire result at the normal phase.
        this.artDestructionAttempted = true;
        if (this.boss.scene === this.scene && this.boss.active) this.feedback(() => this.destroyBoss.call(this.boss));
        return this.isCurrent();
    }

    finish() {
        if (this.phase !== 'withdrawing' || !this.requireCurrent()) return false;
        // A slow frame can dispatch the 2600ms timer before the older 2200ms
        // timer in the same Clock update. Finish all borrowed-art work before
        // pinning the save packet, so refusal Retry retains that exact source.
        if (!this.artDestructionAttempted) this.releaseVisuals();
        if (!this.requireCurrent()) return false;
        this.clearStageWork();
        if (!this.requireCurrent()) return false;
        this.phase = 'completing';
        return this.methods.showVictoryScreen.call(this.scene);
    }

    saved({ isCurrent }) {
        if (this.phase !== 'completing' || typeof isCurrent !== 'function' || !isCurrent() || !this.runtimeCurrent()) return false;
        const s = this.scene, boss = this.boss, actor = this.bodyActor, body = this.body;
        const current = () => isCurrent() && s.reefVictory === this && s.boss === boss && s.bossBody === actor &&
            actor.body === body && actor.scene === s && actor.active && actor.destroy === this.destroyActor &&
            body.world === this.world && body.gameObject === actor && body.destroy === this.destroyBody;
        if (!current()) return false;
        this.phase = 'saved';
        if (!this.artDestructionAttempted && boss.scene === s && boss.active && boss.destroy === this.destroyBoss) {
            this.artDestructionAttempted = true; this.feedback(() => this.destroyBoss.call(boss));
        }
        if (!current()) return false;
        this.feedback(() => this.destroyActor.call(actor));
        if (!isCurrent() || s.reefVictory !== this || s.boss !== boss || s.bossBody !== actor) return false;
        // Only the known native retirement can clear this physical alias.
        if (actor.body !== undefined || actor.scene !== undefined || actor.active !== false) return false;
        s.boss = null; s.bossBody = null;
        this.retire();
        return true;
    }

    retire() {
        if (this.retired) return;
        this.retired = true;
        this.events.off('shutdown', this.onRetire); this.player.off?.('destroy', this.onRetire); this.feedback(() => this.offAdmission?.());
        this.clearStageWork();
    }

    clearStageWork() {
        for (const [key, entry] of this.timers) {
            entry.active = false;
            if (entry.record && this.scene.guardianTransitionGuards?.get(key) === entry.record) this.feedback(() => this.methods.cancelGuardianTransition.call(this.scene, key));
            if (entry.wall != null) this.feedback(() => window.clearTimeout(entry.wall));
        }
        this.timers.clear(); this.tweens.forEach(tween => this.feedback(() => tween.stop())); this.tweens.clear();
    }
}

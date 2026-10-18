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

export default class AuroraVictorySequence {
    constructor(scene) {
        const state = this.state = window.GameState, cloud = this.cloud = window.CloudSave;
        this.scene = scene; this.phase = 'created'; this.retired = false; this.serial = 0;
        this.root = state.state; this.admission = state.saveAdmission; this.epoch = state.getSaveAdmission().epoch;
        this.key = state.saveKey; this.mode = state.storageMode;
        this.identity = state.getHatchActiveIdentity(); this.creatureId = state.get('creature.id');
        this.cloudEpoch = cloud?.campaignEpoch; this.cloudUser = cloud?.currentUser?.id;
        this.business = businessState(this.root);
        this.sys = scene.sys; this.plugin = scene.scene; this.clock = scene.time; this.events = scene.events;
        this.input = scene.input; this.keyboard = scene.input?.keyboard; this.physics = scene.physics; this.world = scene.physics?.world;
        this.camera = scene.cameras?.main; this.tweenManager = scene.tweens; this.lifetime = scene.completionSaveLifetime;
        this.player = scene.player; this.playerBody = scene.player?.body;
        this.boss = scene.boss; this.bodyActor = scene.bossBody; this.body = this.bodyActor?.body;
        this.artBody = this.boss?.body; this.artBodyDestroy = this.artBody?.destroy;
        this.glow = scene.bossGlow; this.glowOwner = this.glow?.scene; this.glowActive = this.glow?.active; this.glowDestroy = this.glow?.destroy;
        this.ownedEffects = new Set(); this.ownedText = null;
        this.destroyBoss = this.boss?.destroy; this.destroyActor = this.bodyActor?.destroy; this.destroyBody = this.body?.destroy;
        this.encounter = scene.guardianEncounter; this.encounterData = JSON.stringify(copy(this.encounter));
        this.registration = this.sys?.game?.scene; this.getScene = this.registration?.getScene; this.sceneKey = this.sys?.settings?.key;
        this.isActive = this.sys?.isActive;
        this.methods = Object.fromEntries(['showBossVictory', 'showLevelComplete', 'getLevelModalLayout', 'startSavedAuroraCompletion', 'scheduleGuardianTransition',
            'cancelGuardianTransition'].map(name => [name, scene[name]]));
        this.timers = new Map(); this.tweens = new Set(); this.artDestructionAttempted = false;
        this.onRetire = () => this.retire();
        scene.auroraVictory = this;
        this.events.once('shutdown', this.onRetire); this.player.once?.('destroy', this.onRetire);
        this.offAdmission = state.on('saveAdmissionChanged', () => { if (!this.isCurrent()) this.retire(); });
    }

    runtimeCurrent() {
        const s = this.scene, p = this.player, actor = this.bodyActor, state = this.state;
        return !this.retired && s.auroraVictory === this && s.completionSaveLifetime === this.lifetime &&
            window.GameState === state && state.saveAdmission === this.admission &&
            state.getSaveAdmission().epoch === this.epoch && state.getSaveAdmission().status === 'ready' &&
            state.saveKey === this.key && state.storageMode === this.mode && window.CloudSave === this.cloud &&
            this.cloud?.campaignEpoch === this.cloudEpoch && this.cloud?.currentUser?.id === this.cloudUser &&
            state.getHatchActiveIdentity() === this.identity && state.get('creature.id') === this.creatureId &&
            s.sys === this.sys && s.scene === this.plugin && s.events === this.events && s.time === this.clock && s.tweens === this.tweenManager &&
            s.input === this.input && this.input?.keyboard === this.keyboard && s.physics === this.physics && this.physics?.world === this.world &&
            s.cameras?.main === this.camera && s.player === p && p?.active && p.scene === s && p.body === this.playerBody &&
            this.playerBody?.world === this.world && this.playerBody?.gameObject === p &&
            s.boss === this.boss && this.boss?.destroy === this.destroyBoss && this.artBindingCurrent() && s.bossBody === actor &&
            actor?.active && actor.scene === s && actor.body === this.body && actor.destroy === this.destroyActor &&
            this.body?.destroy === this.destroyBody && this.body?.world === this.world && this.body?.gameObject === actor &&
            s.guardianEncounter === this.encounter && JSON.stringify(copy(this.encounter)) === this.encounterData &&
            s.bossDefeated && !s.bossFightActive && !s._returningToHub && this.sys.isActive === this.isActive && this.isActive.call(this.sys) === true &&
            this.sys.scene === s && this.sys.events === this.events && this.sys.settings?.key === this.sceneKey &&
            this.sys.game?.scene === this.registration && this.registration?.getScene === this.getScene &&
            this.getScene?.call(this.registration, this.sceneKey) === s && Object.entries(this.methods).every(([name, method]) => s[name] === method);
    }

    isCurrent() {
        try { return this.runtimeCurrent() && (this.savedCurrent ? this.savedCurrent() : this.state.state === this.root && businessState(this.root) === this.business); }
        catch { return false; }
    }

    requireCurrent() {
        if (this.isCurrent()) return true;
        if (this.savedCurrent) return this.unavailable();
        this.retire(); return false;
    }

    feedback(action) {
        try { const value = action(); try { Promise.prototype.then.call(value, undefined, () => {}); } catch { /* Not a promise. */ } return value; }
        catch { /* Optional effects cannot discard an earned, current result. */ }
    }

    present(action) { if (this.requireCurrent()) return this.feedback(action); }

    later(delay, action) {
        if (!this.requireCurrent()) return null;
        const key = `aurora-victory-${++this.serial}`;
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
        this.later(1800, () => this.finish());
        const s = this.scene, boss = this.boss;
        this.present(() => { if (boss.body === this.artBody) this.artBody.enable = false; });
        this.present(() => { this.body.enable = false; });
        this.present(() => boss.setVelocity?.(0, 0));
        this.present(() => this.bodyActor.setVelocity?.(0, 0));
        this.present(() => boss.setTint?.(0xA9F3E4));
        this.present(() => s.bossExposureText?.setText('VOID PRESSURE // CLEARED'));
        this.present(() => window.FeedbackManager?.cameraFlash?.(s, 420, 169, 243, 228));
        this.present(() => window.FeedbackManager?.cameraShake?.(s, 350, 0.012));
        this.present(() => s.showFloatingText('PHOENIX ROUTE STABLE', boss.x || 4400, (boss.y || 550) - 100, '#A9F3E4'));
        const x = boss.x || 4400, y = boss.y || 550;
        for (let i = 0; i < 24; i++) this.later(i * 50, () => this.present(() => {
            const flame = s.add.graphics(); this.ownedEffects.add(flame);
            flame.fillStyle(Math.random() > 0.5 ? 0xA9F3E4 : 0xF2C94C, 1);
            flame.fillCircle(0, 0, 10 + Math.random() * 15);
            flame.setPosition(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 80).setDepth(900);
            this.fadeOwned(flame, { y: flame.y - 100, alpha: 0, scaleX: 0.3, scaleY: 0.3 }, 1000, () => this.destroyOwned(flame));
        }));
        this.fade(); this.fadeUI();
        return this.isCurrent();
    }

    artBindingCurrent() {
        const boss = this.boss;
        return this.artDestructionAttempted ||
            boss?.scene === undefined && boss?.active === false && boss?.body === undefined ||
            boss?.scene === this.scene && boss?.active && boss?.body === this.artBody &&
                this.artBody?.world === this.world && this.artBody?.gameObject === boss && this.artBody?.destroy === this.artBodyDestroy;
    }

    fade() {
        const boss = this.boss, proxy = { progress: 0 }, from = { alpha: boss.alpha, scaleX: boss.scaleX, scaleY: boss.scaleY, y: boss.y };
        return this.present(() => {
            const tween = this.tweenManager.add({ targets: proxy, progress: 1, duration: 1800, ease: 'Sine.easeIn',
                onUpdate: () => {
                    if (!this.visualCurrent() || this.artDestructionAttempted || boss.scene !== this.scene || !boss.active ||
                        boss.body !== this.artBody || this.artBody?.world !== this.world || this.artBody?.gameObject !== boss ||
                        this.artBody?.destroy !== this.artBodyDestroy) { tween?.stop?.(); return; }
                    boss.alpha = from.alpha + (0.2 - from.alpha) * proxy.progress;
                    boss.scaleX = from.scaleX + (0.7 - from.scaleX) * proxy.progress;
                    boss.scaleY = from.scaleY + (0.7 - from.scaleY) * proxy.progress;
                    boss.y = from.y - 120 * proxy.progress;
                } });
            if (tween) this.tweens.add(tween); return tween;
        });
    }

    fadeOwned(actor, fields, duration, after = null) {
        const proxy = { progress: 0 }, from = Object.fromEntries(Object.keys(fields).map(name => [name, actor[name]]));
        this.present(() => {
            const current = () => this.visualCurrent() && this.ownedEffects.has(actor) && actor.scene === this.scene && actor.active;
            const tween = this.tweenManager.add({ targets: proxy, progress: 1, duration,
                onUpdate: () => {
                    if (!current()) { tween?.stop?.(); return; }
                    for (const name of Object.keys(fields)) actor[name] = from[name] + (fields[name] - from[name]) * proxy.progress;
                },
                onComplete: () => { if (current() && after) this.feedback(after); } });
            if (tween) this.tweens.add(tween);
        });
    }

    destroyOwned(actor) {
        this.ownedEffects.delete(actor);
        if (actor?.scene === this.scene && actor.active) this.feedback(() => actor.destroy());
        if (this.ownedText === actor) this.ownedText = null;
    }

    visualCurrent() {
        try { return this.runtimeCurrent() && this.state.state === (this.savedCurrent ? this.savedRoot : this.root); } catch { return false; }
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
        this.artDestructionAttempted = true;
        if (this.boss.scene === this.scene && this.boss.active) this.feedback(() => this.destroyBoss.call(this.boss));
        const glow = this.glow;
        if (this.isCurrent() && this.scene.bossGlow === glow && glow?.scene === this.glowOwner && glow?.active === this.glowActive &&
            glow?.destroy === this.glowDestroy) {
            this.feedback(() => this.glowDestroy?.call(glow));
            if (this.isCurrent() && this.scene.bossGlow === glow && glow?.scene === undefined && glow?.active === false) this.scene.bossGlow = null;
        }
        return this.isCurrent();
    }

    finish() {
        if (this.phase !== 'withdrawing' || !this.requireCurrent()) return false;
        // Retire borrowed artwork before the first packet capture, even when a
        // coarse frame reaches the handoff before its optional tween updates.
        if (!this.artDestructionAttempted) this.releaseVisuals();
        if (!this.requireCurrent()) return false;
        this.phase = 'completing';
        return this.methods.showBossVictory.call(this.scene);
    }

    saved(source) {
        if (this.phase !== 'completing' || typeof source?.isCurrent !== 'function' || !source.isCurrent() || !this.runtimeCurrent()) return false;
        this.savedCurrent = source.isCurrent; this.savedRoot = this.state.state; this.savedUnavailable = source.onUnavailable;
        this.phase = 'saved'; this.scene.auroraReactorFound = true;
        // Mandatory exit is independent of both layout and the victory tween.
        this.later(3000, () => this.finishSaved());
        this.present(() => {
            const { width, contentWidth, y, font } = this.methods.getLevelModalLayout.call(this.scene, { maxWidth: 480, maxHeight: 300 });
            const text = this.ownedText = this.scene.add.text(width / 2, y(150), 'AURORA PHOENIX RESTORED', {
                fontSize: font(32, 24), color: '#FFD700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
                align: 'center', wordWrap: { width: contentWidth }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0).setScale(0.5);
            this.ownedEffects.add(text);
            this.fadeOwned(text, { alpha: 1, scaleX: 1, scaleY: 1 }, 500);
            this.later(2500, () => this.fadeOwned(text, { alpha: 0, scaleX: 0.5, scaleY: 0.5 }, 500));
        });
        return this.isCurrent();
    }

    finishSaved() {
        if (this.phase !== 'saved') return false;
        if (!this.isCurrent()) return this.unavailable();
        this.phase = 'presenting';
        const s = this.scene, actor = this.bodyActor, body = this.body, boss = this.boss;
        const current = () => this.savedCurrent() && s.auroraVictory === this && s.boss === boss && s.bossBody === actor &&
            actor.body === body && actor.scene === s && actor.active && actor.destroy === this.destroyActor &&
            body.world === this.world && body.gameObject === actor && body.destroy === this.destroyBody;
        if (!current()) return this.unavailable();
        this.feedback(() => this.destroyActor.call(actor));
        if (!this.savedCurrent() || s.auroraVictory !== this || s.boss !== boss || s.bossBody !== actor ||
            actor.body !== undefined || actor.scene !== undefined || actor.active !== false) return this.unavailable();
        s.boss = null; s.bossBody = null;
        this.retire();
        try {
            if (this.savedCurrent() && this.methods.showLevelComplete.call(s) === true) return true;
        } catch { /* The original saved attempt can retry presentation only. */ }
        return this.unavailable();
    }

    unavailable() {
        this.retire(); this.feedback(() => this.savedUnavailable?.()); return false;
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
        [...this.ownedEffects].forEach(actor => this.destroyOwned(actor));
    }
}

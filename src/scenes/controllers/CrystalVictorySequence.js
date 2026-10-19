import { copyDetachedJsonData as copy } from '../../utils/DetachedJsonData.js';

const optional = action => { try { action(); } catch { /* Presentation cannot own the progression handoff. */ } };

// No completion packet exists during these story beats. Only normal writer
// accounting and existing media deliveries may change before the first capture.
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

export default class CrystalVictorySequence {
    constructor(scene) {
        this.scene = scene;
        this.phase = 'created'; this.retired = false; this.timers = new Map(); this.tweens = new Set(); this.ownedText = null;
        const state = this.state = window.GameState, cloud = this.cloud = window.CloudSave;
        this.root = state?.state; this.admission = state?.saveAdmission; this.epoch = state?.getSaveAdmission?.().epoch;
        this.cloudEpoch = cloud?.campaignEpoch; this.cloudUser = cloud?.currentUser?.id;
        this.key = state?.saveKey; this.mode = state?.storageMode;
        this.identity = state?.getHatchActiveIdentity?.(); this.creatureId = state?.get?.('creature.id');
        this.business = businessState(this.root); this.guardianAt = Date.now();
        this.lifetime = scene.completionSaveLifetime; this.sys = scene.sys; this.events = scene.events;
        this.plugin = scene.scene; this.clock = scene.time; this.tweenManager = scene.tweens;
        this.input = scene.input; this.keyboard = scene.input?.keyboard; this.physics = scene.physics; this.world = scene.physics?.world;
        this.camera = scene.cameras?.main; this.player = scene.player; this.playerBody = scene.player?.body;
        this.boss = scene.boss; this.bossBody = scene.boss?.body; this.bossDestroy = scene.boss?.destroy; this.bossBodyDestroy = scene.boss?.body?.destroy;
        this.encounter = scene.guardianEncounter; this.encounterData = JSON.stringify(copy(this.encounter));
        this.registration = this.sys?.game?.scene; this.getScene = this.registration?.getScene; this.sceneKey = this.sys?.settings?.key;
        this.isActive = this.sys?.isActive;
        this.methods = Object.fromEntries(['showBossVictory', 'onLevelComplete', 'showCompletionScreen', 'startSavedCrystalCompletion',
            'scheduleGuardianTransition', 'cancelGuardianTransition'].map(name => [name, scene[name]]));
        this.onRetire = () => this.retire();
        scene.crystalVictory = this; scene.completionGuardianAt = this.guardianAt;
        this.events.once('shutdown', this.onRetire);
        this.offAdmission = state?.on?.('saveAdmissionChanged', () => { if (!this.isCurrent()) this.retire(); });
    }

    runtimeCurrent() {
        const s = this.scene, p = this.player, b = this.boss, state = this.state;
        return !this.retired && s.crystalVictory === this && s.completionSaveLifetime === this.lifetime &&
            s.completionGuardianAt === this.guardianAt && window.GameState === state && state?.saveAdmission === this.admission &&
            state?.getSaveAdmission?.().epoch === this.epoch && state?.getSaveAdmission?.().status === 'ready' &&
            state?.saveKey === this.key && state?.storageMode === this.mode && window.CloudSave === this.cloud &&
            this.cloud?.campaignEpoch === this.cloudEpoch && this.cloud?.currentUser?.id === this.cloudUser &&
            state?.getHatchActiveIdentity?.() === this.identity && state?.get?.('creature.id') === this.creatureId &&
            s.sys === this.sys && s.events === this.events && s.scene === this.plugin && s.time === this.clock && s.tweens === this.tweenManager &&
            s.input === this.input && this.input?.keyboard === this.keyboard && s.physics === this.physics && this.physics?.world === this.world &&
            s.cameras?.main === this.camera && s.player === p && p?.active && p.scene === s && p.body === this.playerBody &&
            this.playerBody?.world === this.world && this.playerBody?.gameObject === p && s.boss === b && b?.active && b.scene === s &&
            b.body === this.bossBody && b.destroy === this.bossDestroy && this.bossBody?.destroy === this.bossBodyDestroy &&
            this.bossBody?.world === this.world && this.bossBody?.gameObject === b &&
            s.guardianEncounter === this.encounter && JSON.stringify(copy(this.encounter)) === this.encounterData &&
            this.sys.isActive === this.isActive && this.isActive.call(this.sys) === true && !s._returningToHub &&
            this.sys.scene === s && this.sys.events === this.events && this.sys.settings?.key === this.sceneKey &&
            this.sys.game?.scene === this.registration && this.registration?.getScene === this.getScene &&
            this.getScene?.call(this.registration, this.sceneKey) === s && Object.entries(this.methods).every(([name, method]) => s[name] === method);
    }

    isCurrent() {
        try {
            return this.runtimeCurrent() && (this.savedCurrent ? this.savedCurrent() :
                this.state.state === this.root && businessState(this.root) === this.business);
        } catch { return false; }
    }

    requireCurrent() {
        if (this.isCurrent()) return true;
        this.retire(); return false;
    }

    visualCurrent() {
        try { return this.runtimeCurrent() && this.state.state === (this.savedCurrent ? this.savedRoot : this.root); }
        catch { return false; }
    }

    present(action) { if (this.requireCurrent()) optional(action); }

    later(key, delay, action) {
        if (!this.requireCurrent()) return false;
        const s = this.scene, fullKey = `crystal-victory-${key}`, entry = { active: true, record: null, wall: null };
        this.timers.set(fullKey, entry);
        const settle = () => {
            if (!entry.active) return;
            entry.active = false; this.timers.delete(fullKey);
            if (entry.wall != null) window.clearTimeout(entry.wall);
            if (this.requireCurrent()) action();
        };
        try { entry.record = this.methods.scheduleGuardianTransition.call(s, fullKey, delay, settle); } catch { /* Use the owned wall fallback. */ }
        if (!entry.record && entry.active) {
            try { entry.wall = window.setTimeout(settle, delay + 600); }
            catch { settle(); }
        }
        return true;
    }

    fade(actor, fields, duration, after = null, owns = () => true) {
        if (!actor) return;
        const owner = actor.scene, active = actor.active, destroy = actor.destroy;
        // Frame updates only touch pinned presentation objects. Full business
        // validation happens at stage boundaries, not for every tween property.
        const current = () => this.visualCurrent() && owns() && actor.scene === owner && actor.active === active && actor.destroy === destroy;
        const proxy = { progress: 0 }, from = Object.fromEntries(Object.keys(fields).map(name => [name, actor[name]]));
        this.present(() => {
            const tween = this.tweenManager.add({ targets: proxy, progress: 1, duration,
                onUpdate: () => {
                    if (!current()) { tween?.stop?.(); return; }
                    for (const name of Object.keys(fields)) actor[name] = from[name] + (fields[name] - from[name]) * proxy.progress;
                }, onComplete: () => { if (current()) optional(() => after?.()); } });
            if (tween) this.tweens.add(tween);
        });
    }

    start() {
        if (this.phase !== 'created' || !this.requireCurrent()) return false;
        this.phase = 'restoration';
        this.later('message', 2000, () => this.methods.showBossVictory.call(this.scene));
        const s = this.scene, boss = this.boss;
        this.present(() => boss.setVelocity(0, 0));
        this.present(() => this.bossBody.setAllowGravity(false));
        this.present(() => { this.bossBody.enable = false; });
        this.present(() => boss.setTint(0x8FE3CF));
        this.present(() => s.bossPulseText?.setText('CORRUPTION // BROKEN'));
        this.present(() => window.FeedbackManager?.cameraShake?.(s, 350, 0.01));
        this.present(() => window.FeedbackManager?.cameraFlash?.(s, 450, 143, 227, 207));
        this.present(() => s.showFloatingText('CORRUPTION DEFEATED', boss.x, boss.y - 95, '#8FE3CF'));
        for (let i = 0; i < 6; i++) this.later(`resonance-${i}`, i * 130, () => this.present(() =>
            window.FXLibrary?.stardustBurst(s, boss.x + Math.random() * 80 - 40, boss.y + Math.random() * 80 - 50,
                { count: 12, color: [0x8FE3CF, 0x00FFFF, 0xBFA6FF, 0xFFD700], duration: 1200 })));
        const shell = s.bossCorruptionShell;
        this.present(() => { shell?.destroy?.(); if (s.bossCorruptionShell === shell) s.bossCorruptionShell = null; });
        this.fade(boss, { alpha: 1, scaleX: s.bossTargetScale, scaleY: s.bossTargetScale }, 900, () => boss.clearTint?.());
        for (const [name, duration] of [['bossUI', 500], ['bossOverlay', 1000]]) {
            const actor = s[name];
            this.fade(actor, { alpha: 0 }, duration, () => actor.destroy(), () => s[name] === actor);
        }
        this.fade(this.camera, { zoom: 1 }, 1000);
        return this.isCurrent();
    }

    message() {
        if (this.phase !== 'restoration' || !this.requireCurrent()) return false;
        this.phase = 'message';
        this.later('completion', 3000, () => {
            if (this.phase !== 'message') return;
            this.phase = 'completing'; this.clearText();
            if (this.requireCurrent()) this.methods.onLevelComplete.call(this.scene);
        });
        this.present(() => {
            const { width, height } = this.camera;
            const text = this.ownedText = this.scene.add.text(width / 2, height / 2, 'CORRUPTION DEFEATED\nGUARDIAN FREED', {
                fontSize: width <= 480 ? '24px' : '32px', color: '#8FE3CF', fontStyle: 'bold', stroke: '#000000',
                strokeThickness: 4, align: 'center', wordWrap: { width: width - 50 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0).setScale(0.5);
            this.fade(text, { alpha: 1, scaleX: 1, scaleY: 1 }, 500, null, () => this.ownedText === text);
            this.later('message-fade', 2500, () => this.fade(text, { alpha: 0, scaleX: 0.5, scaleY: 0.5 }, 500,
                null, () => this.ownedText === text));
            for (let i = 0; i < 5; i++) this.later(`celebration-${i}`, i * 300, () => this.present(() =>
                window.FXLibrary?.stardustBurst(this.scene, 100 + Math.random() * Math.max(0, width - 200) + this.camera.scrollX,
                    height / 2, { count: 20, color: [0xFFD700, 0x7B68EE, 0x00FFFF], duration: 2000 })));
        });
        return this.isCurrent();
    }

    saved({ isCurrent }) {
        if (this.phase !== 'completing' || typeof isCurrent !== 'function' || !isCurrent() || !this.runtimeCurrent()) return false;
        this.savedCurrent = isCurrent; this.savedRoot = this.state.state; this.phase = 'saved';
        this.later('rewards', 1500, () => this.methods.showCompletionScreen.call(this.scene));
        this.present(() => window.FeedbackManager?.cameraFlash?.(this.scene, 500, 0, 255, 255));
        const core = this.scene.crystalCore;
        for (let i = 0; i < 5; i++) this.later(`core-${i}`, i * 200, () => this.present(() => {
            if (core && this.scene.crystalCore === core && core.scene === this.scene && core.active) {
                window.FXLibrary?.stardustBurst(this.scene, core.x, core.y,
                    { count: 30, color: [0x00FFFF, 0x7B68EE, 0xE040FB, 0xFFD700], duration: 2000 });
            }
        }));
        return this.isCurrent();
    }

    clearText() {
        const text = this.ownedText; this.ownedText = null;
        if (text?.scene === this.scene && text.active) optional(() => text.destroy());
    }

    retire() {
        if (this.retired) return;
        this.retired = true; this.events.off('shutdown', this.onRetire); optional(() => this.offAdmission?.());
        for (const [key, entry] of this.timers) {
            entry.active = false;
            if (entry.record && this.scene.guardianTransitionGuards?.get(key) === entry.record) optional(() => this.methods.cancelGuardianTransition.call(this.scene, key));
            if (entry.wall != null) optional(() => window.clearTimeout(entry.wall));
        }
        this.timers.clear(); this.tweens.forEach(tween => optional(() => tween.stop())); this.tweens.clear(); this.clearText();
    }
}

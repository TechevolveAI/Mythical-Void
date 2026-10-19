const REEF_CONTROL_TIMER_FIELDS = Object.freeze({
    ai: 'bossAttackTimer', preview: 'bossAttackPreviewTimer', unlock: 'bossAttackUnlockTimer',
    phase: 'bossPhaseTransitionTimer', instruction: 'bossInstructionTimer'
});

export default class ReefGuardianControl {
    constructor(scene) {
        this.scene = scene;
        this.plugin = scene.scene;
        this.boss = scene.boss;
        this.body = scene.bossBody;
        this.player = scene.player;
        this.encounter = scene.guardianEncounter;
        this.retired = false;
        this.timers = new Map();
        this.objects = new Set();
        this.tweens = new Set();
        this.contact = null;
        this.contactRegistration = null;
        this.instructionTween = null;
        this.baseAlpha = scene.reefBossLunge?.alpha ?? this.boss?.alpha ?? 1;
        this.lastAppliedAlpha = this.boss?.alpha;
        this.hitFlash = null;
        this.onRetire = () => this.retire();
        scene.reefGuardianControl = this;
        if (this.isCurrent()) {
            scene.events.once('shutdown', this.onRetire);
            this.actors().forEach(actor => actor.once('destroy', this.onRetire));
        }
    }

    actors() { return [...new Set([this.boss, this.body, this.player].filter(Boolean))]; }

    isCurrent() {
        const scene = this.scene;
        return Boolean(!this.retired && scene.reefGuardianControl === this && scene.scene === this.plugin &&
            scene.boss === this.boss && scene.bossBody === this.body && scene.player === this.player &&
            scene.guardianEncounter === this.encounter && scene.bossFightActive && !scene.bossDefeated &&
            !scene.levelCompletionActive && this.boss?.active && this.body?.active && this.body.body &&
            this.player?.active && this.player.body);
    }

    canAct() {
        return Boolean(this.isCurrent() && !this.scene.isPlayerDead && this.body.body.enable &&
            this.player.body.enable && this.scene.sys?.isActive?.() !== false);
    }

    feedback(action) {
        try {
            const result = action();
            Promise.resolve(result).catch(() => console.warn('[ReefGuardian] Optional battle feedback unavailable'));
            return result;
        } catch { console.warn('[ReefGuardian] Optional battle feedback unavailable'); }
    }

    cancel(key) {
        const record = this.timers.get(key);
        if (!record) return;
        record.active = false;
        this.timers.delete(key);
        const field = REEF_CONTROL_TIMER_FIELDS[key];
        if (this.scene[field] === record.timer) this.scene[field] = null;
        record.timer?.remove(false);
    }

    schedule(key, delay, callback, loop = false) {
        this.cancel(key);
        if (!this.isCurrent()) { this.retire(); return null; }
        const record = { active: true, timer: null };
        const field = REEF_CONTROL_TIMER_FIELDS[key];
        this.timers.set(key, record);
        const dispatch = () => {
            if (!record.active || this.timers.get(key) !== record) return;
            if (!this.isCurrent()) { this.retire(); return; }
            if (!loop) {
                record.active = false;
                this.timers.delete(key);
                if (this.scene[field] === record.timer) this.scene[field] = null;
            }
            callback();
        };
        try {
            record.timer = loop
                ? this.scene.time.addEvent({ delay, callback: dispatch, loop: true })
                : this.scene.time.delayedCall(delay, dispatch);
            this.scene[field] = record.timer;
            return record.timer;
        } catch (error) { this.cancel(key); throw error; }
    }

    after(key, delay, callback) { return this.schedule(key, delay, callback); }
    every(key, delay, callback) { return this.schedule(key, delay, callback, true); }

    afterReady(key, delay, callback) {
        const ready = () => {
            if (!this.canAct()) { this.after(key, 0, ready); return; }
            callback();
        };
        return this.after(key, delay, ready);
    }

    installContact(onHit) {
        this.contact?.destroy();
        this.contact = null;
        this.contactRegistration = null;
        if (!this.isCurrent()) { this.retire(); return null; }
        const registration = {};
        this.contactRegistration = registration;
        const canHit = () => {
            if (this.contactRegistration !== registration) return false;
            if (!this.isCurrent()) { this.retire(); return false; }
            return this.canAct() && this.scene.bossContactDamageArmed && !this.scene.bossContactDamageConsumed;
        };
        try {
            this.contact = this.scene.physics.add.overlap(this.player, this.body, () => {
                if (!canHit()) return;
                this.scene.bossContactDamageConsumed = true;
                this.scene.bossContactDamageArmed = false;
                onHit();
            }, canHit);
            return this.contact;
        } catch (error) { this.retire(); throw error; }
    }

    replaceInstructionTween(tween) {
        this.instructionTween?.stop();
        this.instructionTween = tween;
    }

    paintBossAlpha(alpha = this.baseAlpha) {
        if (!this.isCurrent()) return;
        this.baseAlpha = alpha;
        // A hit can dim the windup, but must never brighten or replace it.
        this.boss.alpha = this.hitFlash ? Math.min(alpha, this.hitFlash.alpha) : alpha;
        this.lastAppliedAlpha = this.boss.alpha;
    }

    flashHit() {
        this.clearHitFlash();
        if (!this.isCurrent()) return null;
        if (this.boss.alpha !== this.lastAppliedAlpha) this.baseAlpha = this.boss.alpha;
        const flash = { alpha: this.baseAlpha, phase: this.scene.bossPhase, retired: false, tween: null };
        this.hitFlash = flash;
        const update = () => {
            if (flash.retired) return;
            if (!this.isCurrent()) { this.retire(); return; }
            if (this.hitFlash !== flash || !this.canAct() || this.scene.bossPhase !== flash.phase) {
                this.clearHitFlash(flash);
                return;
            }
            this.paintBossAlpha();
        };
        try {
            flash.tween = this.scene.tweens.add({
                targets: flash, alpha: 0.3, duration: 80, yoyo: true, repeat: 3,
                onUpdate: update, onComplete: () => this.clearHitFlash(flash)
            });
            return flash.tween;
        } catch (error) { this.clearHitFlash(flash); throw error; }
    }

    clearHitFlash(flash = this.hitFlash) {
        if (!flash || flash.retired) return;
        flash.retired = true;
        const owned = this.hitFlash === flash;
        if (owned) this.hitFlash = null;
        flash.tween?.stop();
        if (owned && this.scene.boss === this.boss && this.boss?.active && this.boss.alpha === this.lastAppliedAlpha) {
            this.boss.alpha = this.baseAlpha;
            this.lastAppliedAlpha = this.boss.alpha;
        }
    }

    retire() {
        if (this.retired) return;
        this.retired = true;
        this.clearHitFlash();
        if (this.scene.reefGuardianControl === this) {
            this.scene.reefGuardianControl = null;
            this.scene.bossContactDamageArmed = false;
        }
        this.scene.events.off('shutdown', this.onRetire);
        this.actors().forEach(actor => actor.off('destroy', this.onRetire));
        [...this.timers.keys()].forEach(key => this.cancel(key));
        this.contact?.destroy();
        this.contact = null;
        this.contactRegistration = null;
        this.instructionTween?.stop();
        this.instructionTween = null;
        this.tweens.forEach(tween => tween.stop());
        this.objects.forEach(object => { if (object.active) object.destroy(); });
        this.tweens.clear(); this.objects.clear();
    }
}

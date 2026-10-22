/** Runtime-only Aurora recovery. Does not replace Phaser time or saved state. */
export default class PhoenixCombatTime {
    static capture(scene, { attackBound = true } = {}) {
        const boss = scene.boss, target = scene.bossBody, player = scene.player;
        const bossBody = boss?.body, targetBody = target?.body, playerBody = player?.body;
        const clock = scene.time, world = scene.physics?.world, tweens = scene.tweens;
        const systems = scene.sys, events = scene.events, plugin = scene.scene;
        const lifetime = scene.phoenixCombatLifetime, attack = scene.phoenixAttackLifetime;
        const phase = scene.bossPhase, encounter = scene.guardianEncounter;
        const isCurrent = () => Boolean(lifetime && clock && world && systems &&
            scene.phoenixCombatLifetime === lifetime && (!attackBound || scene.phoenixAttackLifetime === attack) &&
            scene.boss === boss && boss?.active && boss.body === bossBody && bossBody &&
            scene.bossBody === target && target?.active && target.body === targetBody && targetBody &&
            scene.player === player && player?.active && player.body === playerBody && playerBody &&
            scene.time === clock && scene.physics?.world === world && scene.tweens === tweens &&
            scene.sys === systems && scene.events === events && scene.scene === plugin &&
            scene.bossPhase === phase && scene.guardianEncounter === encounter &&
            bossBody.world === world && targetBody.world === world && playerBody.world === world &&
            scene.bossFightActive && !scene.bossDefeated && !scene.levelCompletionActive && !scene._returningToHub);
        return { boss, target, player, clock, events, isCurrent,
            canAct: () => Boolean(isCurrent() && !scene.isPlayerDead && !scene.pauseMenuActive &&
                !clock.paused && !world.isPaused && systems?.isActive?.() !== false &&
                bossBody.enable && targetBody.enable && playerBody.enable),
            feedback(action) {
                if (!isCurrent()) return;
                try { Promise.resolve(action()).catch(() => {}); }
                catch { /* Optional presentation cannot remove an earned combat opportunity. */ }
            }
        };
    }

    static open(scene, context, duration) {
        if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid Phoenix recovery duration');
        if (!context.isCurrent()) return null;
        scene.phoenixRecoveryWindow?.retire();
        if (!context.isCurrent()) return null;
        const window = new PhoenixCombatTime(scene, context);
        scene.phoenixRecoveryWindow = window;
        try {
            context.events.once('shutdown', window.retire);
            for (const actor of window.actors) actor.once('destroy', window.retire);
            window.timer = context.clock.delayedCall(duration, window.retire);
            if (!window.isCurrent()) { window.retire(); return null; }
            return window;
        } catch (error) { window.retire(); throw error; }
    }

    constructor(scene, context) {
        this.scene = scene;
        this.context = context;
        this.actors = [...new Set([context.boss, context.target, context.player])];
        this.retired = false;
        this.timer = null;
        this.retire = this.retire.bind(this);
    }

    isCurrent() {
        return !this.retired && this.scene.phoenixRecoveryWindow === this && this.context.isCurrent();
    }

    remaining() {
        return this.isCurrent() ? Math.max(0, this.timer?.getRemaining() || 0) : 0;
    }

    retire() {
        if (this.retired) return;
        this.retired = true;
        this.context.events.off('shutdown', this.retire);
        for (const actor of this.actors) actor.off('destroy', this.retire);
        if (this.scene.phoenixRecoveryWindow === this) this.scene.phoenixRecoveryWindow = null;
        this.timer?.remove(false);
        this.timer = null;
    }
}

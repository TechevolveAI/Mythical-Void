/** Native active-time windows for Forest hazards and accepted-hit spacing. */
export default class ForestCombatTime {
    static capture(scene) {
        const boss = scene.boss, player = scene.player;
        const bossBody = boss?.body, playerBody = player?.body;
        const clock = scene.time, world = scene.physics?.world, tweens = scene.tweens;
        const systems = scene.sys, events = scene.events, plugin = scene.scene, phase = scene.bossPhase;
        const isCurrent = () => Boolean(clock && world && systems && events &&
            scene.boss === boss && boss?.active && boss.body === bossBody && bossBody?.world === world &&
            scene.player === player && player?.active && player.body === playerBody && playerBody?.world === world &&
            scene.time === clock && scene.physics?.world === world && scene.tweens === tweens &&
            scene.sys === systems && scene.events === events && scene.scene === plugin && scene.bossPhase === phase &&
            scene.bossFightActive && !scene.bossDefeated && !scene.levelCompletionActive && !scene._returningToHub);
        return { boss, player, clock, tweens, events, isCurrent,
            canAct: () => Boolean(isCurrent() && !scene.isPlayerDead && !scene.pauseMenuActive &&
                !clock.paused && !world.isPaused && systems.isActive?.() !== false &&
                bossBody.enable && playerBody.enable) };
    }

    static open(context, duration) {
        if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid Forest combat duration');
        if (!context.canAct()) return null;
        const window = new ForestCombatTime(context);
        try {
            context.events.once('shutdown', window.retire);
            window.actors.forEach(actor => actor.once?.('destroy', window.retire));
            window.timer = context.clock.addEvent({ delay: duration });
            if (!context.canAct()) { window.retire(); return null; }
            return window;
        } catch (error) { window.retire(); throw error; }
    }

    constructor(context) {
        this.context = context;
        this.actors = [...new Set([context.boss, context.player])];
        this.timer = null;
        this.retired = false;
        this.retire = this.retire.bind(this);
    }

    remaining() {
        return !this.retired && this.context.isCurrent() ? Math.max(0, this.timer?.getRemaining() || 0) : 0;
    }

    retire() {
        if (this.retired) return;
        this.retired = true;
        this.context.events.off('shutdown', this.retire);
        this.actors.forEach(actor => actor.off?.('destroy', this.retire));
        this.timer?.remove(false);
        this.timer = null;
    }
}

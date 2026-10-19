// Rewards are committed by their owners. This queue coordinates presentation only.
export default class SanctuaryNoticeQueue {
    constructor(scene, isBlocked) {
        this.scene = scene;
        this.isBlocked = isBlocked;
        this.pending = [];
        this.active = null;
        this.destroyed = false;
        scene.events.on('postupdate', this.refresh, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    enqueue(owner, key, present, limit = 6) {
        if (this.destroyed || this.active?.entry.key === key ||
            this.pending.some(entry => entry.key === key)) return false;
        if (this.pending.filter(entry => entry.owner === owner).length >= limit) return false;
        this.pending.push({ owner, key, present });
        this.refresh();
        return true;
    }

    refresh() {
        if (this.destroyed || this.scene.sys?.isActive?.() === false) return;
        if (this.isBlocked()) {
            if (this.active) {
                const run = this.active;
                this.active = null;
                run.cleanup?.();
                this.pending.unshift(run.entry);
            }
            return;
        }
        if (this.active || !this.pending.length) return;
        const run = { entry: this.pending.shift(), cleanup: null };
        this.active = run;
        try {
            const cleanup = run.entry.present(() => this.finish(run));
            if (this.active === run) run.cleanup = cleanup;
            else cleanup?.();
        } catch (error) {
            this.active = null;
            throw error;
        }
    }

    finish(run) {
        if (this.active !== run) return;
        this.active = null;
        run.cleanup?.();
        // The next frame starts the next notice, never the same input gesture.
    }

    cancel(owner) {
        this.pending = this.pending.filter(entry => entry.owner !== owner);
        if (this.active?.entry.owner === owner) this.finish(this.active);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.pending = [];
        if (this.active) this.finish(this.active);
        this.scene.events.off('postupdate', this.refresh, this);
        this.scene.events.off('shutdown', this.destroy, this);
    }
}

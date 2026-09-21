// One private exchange. No campaign, storage, provider or Phaser dependencies.
export const GRIP_TIMINGS = Object.freeze({
    ready: 1800, windup: 1200, strike: 280, contact: 180,
    exposed: 2600, recoil: 900, released: Infinity
});

export class TrumptopusEncounter {
    constructor({ minX = 80, maxX = 1000 } = {}) {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX < minX) {
            throw new Error('Invalid encounter bounds');
        }
        this.minX = minX;
        this.maxX = maxX;
        this.state = 'ready';
        this.elapsed = 0;
        this.targetX = minX;
        this.health = 2;
        this.cycle = 0;
        this.contactConsumed = false;
        this.paused = false;
        this.disposed = false;
        this.history = ['ready'];
    }

    enter(state) {
        this.state = state;
        this.elapsed = 0;
        this.history.push(state);
        if (this.history.length > 40) this.history.shift();
    }

    update(delta, playerX) {
        if (this.paused || this.disposed || !Number.isFinite(delta) || delta <= 0) return;
        // Never skip a warning or damage window after a suspended browser frame.
        this.elapsed += Math.min(delta, 50);
        if (this.elapsed < GRIP_TIMINGS[this.state]) return;
        if (this.state === 'ready') {
            if (!Number.isFinite(playerX)) return;
            this.targetX = Math.max(this.minX, Math.min(this.maxX, playerX));
            this.cycle++;
            this.contactConsumed = false;
            this.enter('windup');
        } else if (this.state === 'windup') this.enter('strike');
        else if (this.state === 'strike') this.enter('contact');
        else if (this.state === 'contact') this.enter('exposed');
        else if (this.state === 'exposed') this.enter('recoil');
        else if (this.state === 'recoil') this.enter(this.health === 0 ? 'released' : 'ready');
    }

    hit(amount) {
        if (this.disposed || this.paused || this.state !== 'exposed' || !Number.isFinite(amount) || amount <= 0) return false;
        this.health = Math.max(0, this.health - Math.min(2, amount));
        if (this.health === 0) this.enter('recoil');
        return true;
    }

    consumeContact(overlaps) {
        if (this.disposed || this.paused || this.state !== 'contact' || this.contactConsumed || overlaps !== true) return false;
        this.contactConsumed = true;
        return true;
    }

    setPaused(paused) { this.paused = Boolean(paused); }
    dispose() { this.disposed = true; }

    snapshot() {
        return {
            state: this.state, elapsed: this.elapsed, targetX: this.targetX,
            health: this.health, cycle: this.cycle,
            progress: Math.min(1, this.elapsed / GRIP_TIMINGS[this.state]),
            vulnerable: !this.disposed && !this.paused && this.state === 'exposed',
            routeOpen: !this.disposed && this.state === 'released'
        };
    }
}

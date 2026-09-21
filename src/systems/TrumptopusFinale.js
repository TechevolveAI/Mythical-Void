import { TrumptopusEncounter } from './TrumptopusEncounter.js';

export const TRUMPTOPUS_PHASES = Object.freeze([
    Object.freeze({ id: 'break_the_grip', health: 6, attacks: Object.freeze(['grasp']), introMs: 1800 }),
    Object.freeze({ id: 'moving_causeway', health: 8, attacks: Object.freeze(['sweep', 'grasp']), introMs: 2400 }),
    Object.freeze({ id: 'last_hold', health: 10, attacks: Object.freeze(['closing_grasp', 'sweep', 'grasp']), introMs: 2400 })
]);
const ATTACKS = Object.freeze({
    grasp: { timings: { ready: 1200, windup: 1200, strike: 280, contact: 180, exposed: 2600, recoil: 900 }, damageStates: ['contact'] },
    sweep: { timings: { ready: 1200, windup: 1300, strike: 750, contact: 100, exposed: 2600, recoil: 1000 }, damageStates: ['strike', 'contact'] },
    closing_grasp: { timings: { ready: 1400, windup: 1500, strike: 380, contact: 200, exposed: 2800, recoil: 1100 }, damageStates: ['contact'] }
});

export function resolveTrumptopusCheckpoint(value) {
    if (value?.schemaVersion !== 1 || value?.encounterId !== 'trumptopus' ||
        !Number.isInteger(value.phaseIndex) || value.phaseIndex < 0 || value.phaseIndex >= TRUMPTOPUS_PHASES.length) return 0;
    return value.phaseIndex;
}

// Encounter orchestration only. The caller owns save, reward and presentation policy.
export class TrumptopusFinale {
    constructor({ minX = 80, maxX = 1000, checkpoint = null } = {}) {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX < minX) throw new Error('Invalid finale bounds');
        this.bounds = { minX, maxX };
        this.phaseIndex = resolveTrumptopusCheckpoint(checkpoint);
        this.paused = false;
        this.disposed = false;
        this.cycle = null;
        this.events = [];
        this.defeated = false;
        this.startPhase();
    }

    emit(type) {
        this.events.push({ type, phaseIndex: this.phaseIndex });
        if (this.events.length > 40) this.events.shift();
    }

    drainEvents() { return this.events.splice(0); }

    startPhase() {
        this.cycle?.dispose();
        this.cycle = null;
        this.mode = 'phase_intro';
        this.elapsed = 0;
        this.phaseHealth = TRUMPTOPUS_PHASES[this.phaseIndex].health;
        this.attackIndex = 0;
        this.emit('phase-start');
        if (this.phaseIndex === 1) this.emit('causeway-lift');
        if (this.phaseIndex === 2) this.emit('creature-answer');
    }

    beginAttack() {
        this.cycle?.dispose();
        this.cycle = new TrumptopusEncounter({
            ...this.bounds, ...ATTACKS[this.attack], maxHealth: Math.min(3, this.phaseHealth)
        });
        this.mode = 'combat';
        this.emit('attack-start');
    }

    get attack() {
        const attacks = TRUMPTOPUS_PHASES[this.phaseIndex].attacks;
        return attacks[this.attackIndex % attacks.length];
    }

    get state() { return this.mode === 'combat' ? this.cycle.state : this.mode; }
    get targetX() { return this.cycle?.targetX ?? this.bounds.minX; }
    get health() {
        return this.phaseHealth + TRUMPTOPUS_PHASES.slice(this.phaseIndex + 1).reduce((sum, phase) => sum + phase.health, 0);
    }

    update(delta, playerX) {
        if (this.paused || this.disposed || !Number.isFinite(delta) || delta <= 0 || this.mode === 'aftermath') return;
        const step = Math.min(50, delta);
        if (this.mode === 'phase_intro') {
            this.elapsed += step;
            if (this.elapsed >= TRUMPTOPUS_PHASES[this.phaseIndex].introMs) this.beginAttack();
            return;
        }
        if (this.mode === 'banishment') {
            this.elapsed += step;
            if (this.elapsed >= 2600) {
                this.mode = 'aftermath';
                this.elapsed = 0;
                this.emit('banished');
            }
            return;
        }
        this.cycle.update(step, playerX);
        if (this.cycle.state !== 'released') return;
        if (this.phaseHealth > 0) {
            this.attackIndex++;
            this.beginAttack();
        } else if (this.phaseIndex < TRUMPTOPUS_PHASES.length - 1) {
            this.phaseIndex++;
            this.startPhase();
        } else {
            this.cycle.dispose();
            this.mode = 'banishment';
            this.elapsed = 0;
            this.emit('banishment-start');
        }
    }

    hit(amount) {
        if (this.disposed || this.paused || this.mode !== 'combat') return false;
        const before = this.cycle.health;
        if (!this.cycle.hit(amount)) return false;
        this.phaseHealth = Math.max(0, this.phaseHealth - (before - this.cycle.health));
        this.emit('hit');
        if (this.phaseHealth === 0 && this.phaseIndex === TRUMPTOPUS_PHASES.length - 1) {
            // Completion belongs to the last accepted hit, never a later animation.
            this.defeated = true;
            this.emit('final-strike');
        }
        return true;
    }

    consumeContact(overlaps) {
        return !this.disposed && !this.paused && this.mode === 'combat' && this.cycle.consumeContact(overlaps);
    }

    checkpoint() {
        return { schemaVersion: 1, encounterId: 'trumptopus', phaseIndex: this.phaseIndex };
    }

    retry() {
        if (this.disposed || this.defeated) return false;
        this.paused = false;
        this.startPhase();
        return true;
    }

    setPaused(paused) { this.paused = Boolean(paused); this.cycle?.setPaused(paused); }
    dispose() { this.disposed = true; this.cycle?.dispose(); this.events.length = 0; }

    snapshot() {
        const phase = TRUMPTOPUS_PHASES[this.phaseIndex];
        const cycle = this.cycle?.snapshot();
        return {
            state: this.state, mode: this.mode, attack: this.attack,
            phaseIndex: this.phaseIndex, phaseId: phase.id, phaseHealth: this.phaseHealth,
            phaseMaxHealth: phase.health, health: this.health, maxHealth: 24,
            targetX: this.targetX, elapsed: this.mode === 'combat' ? cycle.elapsed : this.elapsed,
            progress: this.mode === 'combat' ? cycle.progress : Math.min(1, this.elapsed / (this.mode === 'phase_intro' ? phase.introMs : 2600)),
            vulnerable: !this.disposed && !this.paused && this.mode === 'combat' && cycle.vulnerable,
            dangerous: !this.disposed && !this.paused && this.mode === 'combat' && ATTACKS[this.attack].damageStates.includes(cycle.state),
            routeOpen: !this.disposed && this.mode === 'aftermath',
            defeated: this.defeated, completionReady: !this.disposed && this.defeated,
            causewayRaised: this.phaseIndex >= 1, creatureAnswered: this.phaseIndex >= 2
        };
    }
}

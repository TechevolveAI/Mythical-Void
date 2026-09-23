import { TrumptopusEncounter } from './TrumptopusEncounter.js';

// Distances are world pixels; the same route is used at every viewport width.
export const FINAL_VOID_APPROACH = Object.freeze({
    width: 2940, exitX: 2770, catchDepth: 140, settleMs: 1100,
    grips: Object.freeze([
        Object.freeze({id:'first_grip',startX:520,minX:570,maxX:710,gateX:850,bridgeWidth:170,spawnX:220}),
        Object.freeze({id:'crossing_grip',startX:1700,minX:1750,maxX:1890,gateX:2050,bridgeWidth:180,spawnX:1090})
    ]),
    surfaces: Object.freeze([
        Object.freeze({x:0,width:850,dy:0}),
        Object.freeze({x:1020,width:200,dy:0}),
        Object.freeze({x:1370,width:100,dy:-54}),
        Object.freeze({x:1540,width:140,dy:-24}),
        Object.freeze({x:1680,width:370,dy:0}),
        Object.freeze({x:2230,width:180,dy:0}),
        Object.freeze({x:2480,width:460,dy:0})
    ]),
    recoverySteps: Object.freeze([
        Object.freeze({x:1230,width:100,dy:60}),
        Object.freeze({x:1370,width:90,dy:48}),
        Object.freeze({x:1480,width:90,dy:38}),
        Object.freeze({x:1580,width:90,dy:72}),
        Object.freeze({x:2420,width:80,dy:70})
    ])
});

export function validApproachCheckpoint(value) {
    return value?.schemaVersion === 1 && Number.isInteger(value.clearedGrips) &&
        value.clearedGrips >= 0 && value.clearedGrips <= FINAL_VOID_APPROACH.grips.length &&
        typeof value.arrived === 'boolean' && (!value.arrived || value.clearedGrips === FINAL_VOID_APPROACH.grips.length);
}

// Two physical lessons, not switches. Only a countered grab can release a road.
export class FinalVoidApproach {
    constructor(checkpoint = null) {
        if (checkpoint !== null && !validApproachCheckpoint(checkpoint)) throw new Error('Unsupported approach checkpoint');
        this.clearedGrips = checkpoint?.clearedGrips || 0;
        this.arrived = checkpoint?.arrived === true;
        this.mode = 'travel'; this.elapsed = 0; this.grip = null;
        this.paused = false; this.disposed = false;
    }

    get section() { return FINAL_VOID_APPROACH.grips[this.clearedGrips] || null; }
    get state() { return this.mode === 'grip' ? this.grip.state : this.mode; }
    get targetX() { return this.grip?.targetX ?? this.section?.minX ?? FINAL_VOID_APPROACH.exitX; }
    get health() { return this.grip?.health ?? (this.section ? 2 : 0); }
    get spawnX() { return this.clearedGrips === 0 ? 220 : this.clearedGrips === 1 ? 1090 : 2320; }

    update(delta, playerX) {
        if (this.paused || this.disposed || !Number.isFinite(delta) || delta <= 0 || !Number.isFinite(playerX)) return;
        const step = Math.min(50,delta);
        if (this.mode === 'settling') {
            this.elapsed += step;
            if (this.elapsed >= FINAL_VOID_APPROACH.settleMs) {
                this.clearedGrips++; this.mode = 'travel'; this.elapsed = 0;
                this.grip.dispose(); this.grip = null;
            }
        } else if (this.mode === 'grip') {
            this.grip.update(step,playerX);
            if (this.grip.state === 'released') { this.mode = 'settling'; this.elapsed = 0; }
        } else if (this.section && playerX >= this.section.startX) {
            this.grip = new TrumptopusEncounter({...this.section,timings:{ready:1600,windup:1400}});
            this.mode = 'grip';
        }
    }

    hit(amount) { return !this.paused && !this.disposed && this.mode === 'grip' && this.grip.hit(amount); }
    consumeContact(overlaps) { return !this.paused && !this.disposed && this.mode === 'grip' && this.grip.consumeContact(overlaps); }
    setPaused(paused) { this.paused = Boolean(paused); this.grip?.setPaused(paused); }
    dispose() { this.disposed = true; this.grip?.dispose(); }
    arrive(playerX, grounded) {
        if (this.paused || this.disposed || this.section || !Number.isFinite(playerX) || playerX < FINAL_VOID_APPROACH.exitX || grounded !== true) return false;
        this.arrived = true; return true;
    }
    checkpoint() { return {schemaVersion:1,clearedGrips:this.clearedGrips,arrived:this.arrived}; }
    snapshot() {
        const grip = this.grip?.snapshot();
        return {state:this.state,mode:this.mode,elapsed:grip?.elapsed || this.elapsed,targetX:this.targetX,health:this.health,
            progress:this.mode === 'settling' ? Math.min(1,this.elapsed / FINAL_VOID_APPROACH.settleMs) : (grip?.progress || 0),
            vulnerable:!this.paused && !this.disposed && this.mode === 'grip' && grip.vulnerable,
            routeOpen:!this.section,checkpoint:this.checkpoint(),section:this.section};
    }
}

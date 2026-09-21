import bossConfigs from '../config/bosses.json';
import { getGuardianOutcomeSnapshot } from './GuardianOutcomes.js';
import { recordCurrentRegionRestoration } from './CurrentEcology.js';
import { recordRescuedResident } from './RescuedResidents.js';
import { queueProjectBeaconDebrief } from './ProjectBeaconStory.js';
import { validApproachCheckpoint } from './FinalVoidApproach.js';

const RUN_PATH = 'story.projectBeacon.trumptopus';
const OUTCOME_PATH = 'world.antagonistOutcomes.trumptopus';
const durability = new WeakMap();
const clone = value => JSON.parse(JSON.stringify(value));
const read = (state, path) => path.split('.').reduce((value, key) => value?.[key], state);

function write(state, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((target, key) => (target[key] ||= {}), state);
    parent[last] = value;
}

function draftAccess(state) {
    return { get: path => read(state, path), set: (path, value) => write(state, path, value) };
}

function validCount(value, name, maximum = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`Invalid ${name}`);
    return value;
}

export function getTrumptopusRun(gameState) {
    const run = gameState?.get?.(RUN_PATH);
    if (!run) return null;
    if (run.schemaVersion !== 1 || run.encounterId !== 'trumptopus' ||
        !Number.isSafeInteger(run.sequence) || run.sequence < 1 ||
        !Number.isInteger(run.phaseIndex) || run.phaseIndex < 0 || run.phaseIndex > 2 ||
        (run.elapsedMs !== undefined && (!Number.isSafeInteger(run.elapsedMs) || run.elapsedMs < 0)) ||
        (run.damageTaken !== undefined && (!Number.isSafeInteger(run.damageTaken) || run.damageTaken < 0)) ||
        (run.approach !== undefined && !validApproachCheckpoint(run.approach)) ||
        !['fighting', 'won'].includes(run.status) ||
        (run.status === 'won' && (run.receipt?.id !== `trumptopus:${run.sequence}` || run.receipt?.outcome !== 'banished'))) {
        throw new Error('Unsupported Trumptopus progress; existing data was not changed');
    }
    return clone(run);
}

function commit(gameState, state) {
    // Use the existing atomic save/backup boundary. No inventory manager can
    // persist a half-applied reward while this detached state is being built.
    const snapshot = gameState.createSaveSnapshot({ state, updatePlayTime: true });
    gameState.validateSaveDataStructure(snapshot, { requireCoreState: true });
    const prepared = { state, snapshot, serialized: JSON.stringify(snapshot) };
    let persisted = gameState.storageMode !== 'memory';
    try {
        gameState.commitPreparedSave(prepared, { source: 'trumptopus', persist: persisted });
    } catch (error) {
        // Storage denial must not throw away the win or block this session.
        gameState.commitPreparedSave(prepared, { source: 'trumptopus', persist: false });
        persisted = false;
    }
    durability.set(gameState, persisted);
    gameState.emit?.('trumptopusProgressChanged', { sequence: read(state, RUN_PATH).sequence, persisted });
    return persisted;
}

export function beginTrumptopusRun(gameState, { newExpedition = false, withApproach = false } = {}) {
    const previous = getTrumptopusRun(gameState);
    if (previous && (previous.status === 'fighting' || !newExpedition)) return {
        changed: false, run: previous,
        persisted: gameState.storageMode === 'memory' ? false : (durability.get(gameState) ?? null)
    };
    const sequence = validCount((previous?.sequence || 0) + 1, 'expedition sequence');
    const state = clone(gameState.state);
    const run = { schemaVersion: 1, encounterId: 'trumptopus', sequence, phaseIndex: 0,
        elapsedMs: 0, damageTaken: 0, status: 'fighting', receipt: null };
    if (withApproach) run.approach = {schemaVersion:1,clearedGrips:0,arrived:false};
    write(state, RUN_PATH, run);
    return { changed: true, persisted: commit(gameState, state), run: clone(run) };
}

export function checkpointTrumptopusRun(gameState, sequence, phaseIndex, progress = {}) {
    validCount(phaseIndex, 'phase', 2);
    const run = getTrumptopusRun(gameState);
    if (!run || run.sequence !== sequence || run.status !== 'fighting' || phaseIndex < run.phaseIndex) return false;
    if (phaseIndex > run.phaseIndex + 1) throw new Error('Cannot skip a finale phase checkpoint');
    if (phaseIndex > 0 && run.approach && !run.approach.arrived) throw new Error('Complete the approach before the fight');
    const elapsedMs = validCount(progress.elapsedMs ?? run.elapsedMs ?? 0, 'active time');
    const damageTaken = validCount(progress.damageTaken ?? run.damageTaken ?? 0, 'damage');
    if (elapsedMs < (run.elapsedMs || 0) || damageTaken < (run.damageTaken || 0)) throw new Error('Cannot rewind finale progress');
    if (phaseIndex === run.phaseIndex && elapsedMs === (run.elapsedMs || 0) && damageTaken === (run.damageTaken || 0)) return false;
    const state = clone(gameState.state);
    write(state, RUN_PATH, { ...run, phaseIndex, elapsedMs, damageTaken });
    commit(gameState, state);
    return true;
}

export function checkpointTrumptopusApproach(gameState, sequence, approach, progress = {}) {
    if (!validApproachCheckpoint(approach)) throw new Error('Invalid approach checkpoint');
    const run = getTrumptopusRun(gameState);
    if (!run || run.sequence !== sequence || run.status !== 'fighting' || !run.approach || run.phaseIndex !== 0) return false;
    if (approach.clearedGrips < run.approach.clearedGrips || (run.approach.arrived && !approach.arrived)) throw new Error('Cannot rewind the approach');
    if (approach.clearedGrips > run.approach.clearedGrips + 1) throw new Error('Cannot skip an approach checkpoint');
    const elapsedMs = validCount(progress.elapsedMs ?? run.elapsedMs ?? 0,'active time');
    const damageTaken = validCount(progress.damageTaken ?? run.damageTaken ?? 0,'damage');
    if (elapsedMs < (run.elapsedMs || 0) || damageTaken < (run.damageTaken || 0)) throw new Error('Cannot rewind finale progress');
    if (JSON.stringify(approach) === JSON.stringify(run.approach) && elapsedMs === run.elapsedMs && damageTaken === run.damageTaken) return false;
    const state = clone(gameState.state);
    write(state,RUN_PATH,{...run,approach:clone(approach),elapsedMs,damageTaken});
    commit(gameState,state);
    return true;
}

export function recordTrumptopusVictory(gameState, {
    sequence, completedAt = Date.now(), completionMs = 0, damageTaken = 0,
    bonusCoins = 0, inventorySlots = 30
} = {}) {
    const run = getTrumptopusRun(gameState);
    if (!run || run.sequence !== sequence) return { changed: false, reason: 'stale_expedition' };
    if (run.status === 'won') return { changed: false, receipt: run.receipt,
        persisted: gameState.storageMode === 'memory' ? false : (durability.get(gameState) ?? null) };
    if (run.phaseIndex !== 2) return { changed: false, reason: 'final_phase_required' };
    validCount(completedAt, 'completion time'); validCount(completionMs, 'duration');
    validCount(damageTaken, 'damage'); validCount(bonusCoins, 'support coins', 10000);
    validCount(inventorySlots, 'inventory capacity', 1000);
    if (completionMs < (run.elapsedMs || 0) || damageTaken < (run.damageTaken || 0)) throw new Error('Cannot rewind finale progress');
    const state = clone(gameState.state);
    const access = draftAccess(state);
    const now = new Date(completedAt).toISOString();
    const wasCompleted = access.get('levels.finalVoid.completed') === true;

    // Materialize inferred legacy history BEFORE changing finalVoid.completed.
    // New saves therefore do not invent an Empress; old saves do not lose her.
    access.set('world.guardianOutcomes', getGuardianOutcomeSnapshot(access).state);
    const previousOutcome = access.get(OUTCOME_PATH);
    access.set(OUTCOME_PATH, {
        schemaVersion: 1, encounterId: 'trumptopus', levelId: 'finalVoid', outcome: 'banished',
        firstDefeatedAt: previousOutcome?.firstDefeatedAt || now, lastDefeatedAt: now,
        victories: (Number(previousOutcome?.victories) || 0) + 1
    });
    const restoration = recordCurrentRegionRestoration(access, 'finalVoid', { save: false, occurredAt: now, evidence: 'antagonist_banished' });
    const rescued = recordRescuedResident(access, 'finalVoid', { save: false, rescuedAt: now });
    const reward = bossConfigs.voidEmpress.rewards;
    const coins = validCount(reward.baseCoins + bonusCoins, 'victory coins');
    access.set('player.cosmicCoins', (Number(access.get('player.cosmicCoins')) || 0) + coins);
    access.set('stats.coinsCollected', (Number(access.get('stats.coinsCollected')) || 0) + coins);
    const parts = access.get('hubWorld.shipParts.collected') || [];
    const partAwarded = !parts.includes('command_module');
    if (partAwarded) access.set('hubWorld.shipParts.collected', [...parts, 'command_module']);

    const powerup = { ...clone(reward.powerup), quantity: 1, rewardSource: 'boss:trumptopus' };
    const items = access.get('inventory.items') || [];
    const existing = items.find(item => item.id === powerup.id && item.type === 'powerup');
    const queued = !existing && items.length >= inventorySlots;
    if (existing) existing.quantity = (existing.quantity || 1) + 1;
    else if (!queued) items.push({ ...powerup, addedAt: completedAt, slot: items.length });
    else access.set('inventory.pendingBossRewards', [...(access.get('inventory.pendingBossRewards') || []), powerup]);
    access.set('inventory.items', items);
    access.set('levels.finalVoid', {
        ...(access.get('levels.finalVoid') || {}), entered: true, completed: true,
        noDamageRun: access.get('levels.finalVoid.noDamageRun') === true || damageTaken === 0,
        speedrun: access.get('levels.finalVoid.speedrun') === true || completionMs < 360000,
        bestTime: Math.min(access.get('levels.finalVoid.bestTime') || Infinity, completionMs)
    });
    access.set('combat.bossesDefeated', (Number(access.get('combat.bossesDefeated')) || 0) + 1);
    if (!wasCompleted) {
        access.set('stats.levelsCompleted', (Number(access.get('stats.levelsCompleted')) || 0) + 1);
        queueProjectBeaconDebrief(access, { levelId: 'finalVoid', shipPartId: 'command_module', completedAt: now });
    }
    const bond = access.get('creature.bond');
    if (bond) {
        const experience = (bond.experience || 0) + 10;
        const level = Math.floor(experience / 50) + 1;
        access.set('creature.bond', { ...bond, experience, level,
            levelsCompleted: (bond.levelsCompleted || 0) + 1,
            totalInteractions: (bond.totalInteractions || 0) + 1,
            firstInteraction: bond.firstInteraction || completedAt, lastInteraction: completedAt,
            abilitySlots: { ...bond.abilitySlots, slot1: true,
                slot2: level >= 5 || bond.abilitySlots?.slot2 === true,
                slot3: level >= 10 || bond.abilitySlots?.slot3 === true } });
    }
    access.set('story.projectBeacon.expeditionCheckpoint', null);
    const receipt = {
        id: `trumptopus:${sequence}`, outcome: 'banished', completedAt: now,
        completionMs, damageTaken,
        coinsAwarded: coins, partId: 'command_module', partAwarded,
        powerup: { id: powerup.id, name: powerup.name, resultText: powerup.resultText, usageHint: powerup.usageHint, queued },
        rescuedResidentId: rescued.resident.id, residentNewlyRescued: rescued.changed,
        regionRestored: restoration.changed, firstCompletion: !wasCompleted
    };
    access.set(RUN_PATH, { ...run, elapsedMs: completionMs, damageTaken, status: 'won', receipt });
    return { changed: true, persisted: commit(gameState, state), receipt: clone(receipt) };
}

import bossConfigs from '../config/bosses.json';
import { copyDetachedJsonData as copy, freezeDetachedJsonData as freeze } from '../utils/DetachedJsonData.js';
import { addInventoryItem, canAcceptInventoryItem, addGuaranteedInventoryReward, addInventoryShipPart } from '../systems/InventoryRewardTargets.js';
import { calculateCompletionCoinDraft } from './CompletionCoinDraft.js';
import { calculateCompletionThoughtDraft } from './CompletionThoughtDraft.js';
import { calculateCompletionAchievementDraft, continueCompletionGuardianDraft, calculateCompletionGuardianPrefix, continueCompletionLevelDraft } from './CompletionAchievementDraft.js';
import { getCurrentEcologySnapshot, recordCurrentRegionRestoration } from '../systems/CurrentEcology.js';
import { getGuardianOutcomeSnapshot, recordGuardianOutcome } from '../systems/GuardianOutcomes.js';
import { getGuardianResidentsSnapshot, recordGuardianExpedition } from '../systems/GuardianResidents.js';
import { getRescuedResidentSnapshot, recordRescuedResident } from '../systems/RescuedResidents.js';
import { installProjectBeaconKatanaUpgrade } from '../systems/ProjectBeaconFieldKit.js';
import { queueProjectBeaconDebrief, unlockProjectBeaconMilestone } from '../systems/ProjectBeaconStory.js';

const bosses = Object.freeze({ mythicalForest: 'elderTreant', crystalCaves: 'crystalGolem', cosmicReef: 'voidSerpent',
    voidPeaks: 'cosmicTitan', auroraDepths: 'shadowPhoenix', finalVoid: 'voidEmpress' });
const fail = reason => { throw Object.assign(Error(reason), { completionReason: reason }); };
const dto = value => Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));

export function getCompletionRewardData(levelId, bonusCount = 0) {
    const rewards = bossConfigs[bosses[levelId]]?.rewards;
    const count = Number(bonusCount), bonus = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const power = rewards?.powerup;
    return { coins: rewards ? Math.max(0, Number(rewards.baseCoins) || 0) +
        bonus * Math.max(0, Number(rewards.bonusPerRelic || rewards.bonusPerFragment || 0) || 0) : 0,
    powerup: power?.id && power.type === 'powerup' && power.usableInLevel
        ? { ...copy(power), effect: { ...(power.effect || {}) }, quantity: 1, rewardSource: `guardian:${levelId}` } : null };
}

function retainsInput(before, after, domain, path = []) {
    // Existing history readers coerce an explicit null vitality through Number
    // to zero. Appended restoration entries initially omit these fields. Keep
    // that proven rule only; unknown fields or other lossy changes still refuse.
    if (domain === 'currentEcology' && path.length === 3 && path[0] === 'history' && /^\d+$/.test(path[1]) &&
        ['vitalityBefore', 'vitalityAfter'].includes(path[2]) && before === null && after === 0) return true;
    // GameState's initial resident record is v3; the existing resident helper
    // writes v4 while retaining those fields. Do not generalise to future data.
    if (domain === 'rescuedResidents' && path.length === 1 && path[0] === 'schemaVersion' && before === 3 && after === 4) return true;
    if (before === null || typeof before !== 'object') return Object.is(before, after);
    if (!after || typeof after !== 'object' || Array.isArray(before) !== Array.isArray(after)) return false;
    return Object.keys(before).every(key => Object.hasOwn(after, key) && retainsInput(before[key], after[key], domain, [...path, key]));
}

// Complete calculation only. The caller still owns original scene/source
// qualification, mutable cache projections, persistence and presentation.
export function calculateLevelCompletionDraft(snapshot, facts, participants) {
    try {
        if (!participants || typeof participants.isCurrent !== 'function') fail('completion_owner_unavailable');
        const current = () => participants.isCurrent() && ['inventory', 'achievements', 'thought'].every(key => {
            const source = participants[key]; return source === null || (source?.status === 'captured' && source.isCurrent());
        });
        const checkpoint = () => { if (!current()) fail('completion_source_changed'); };
        checkpoint();
        const f = copy({ katanaUpgradeId: null, speedrunThreshold: 0, bondExperience: 10, rewardBonusCount: 0,
            residentCoinBonus: 0, villageCoinBonus: 0, guardianInterventions: 0, guardianRestoredAfter: false,
            guardianRestoredBefore: false, guardianRestoredAt: null, ...facts });
        if (!Object.hasOwn(bosses, f.levelId) || typeof f.sceneLevelId !== 'string' || !f.sceneLevelId ||
            !Number.isSafeInteger(f.now) || f.now < 0 || !Number.isFinite(f.time) || f.time < 0 || typeof f.noDamage !== 'boolean' ||
            !['speedrunThreshold', 'bondExperience', 'rewardBonusCount', 'residentCoinBonus', 'villageCoinBonus', 'guardianInterventions']
                .every(key => typeof f[key] === 'number' && Number.isFinite(f[key])) ||
            (f.shipPartId != null && typeof f.shipPartId !== 'string') || (f.katanaUpgradeId != null && typeof f.katanaUpgradeId !== 'string') ||
            typeof f.guardianRestoredAfter !== 'boolean' || (f.guardianRestoredAfter && !['mythicalForest', 'voidPeaks', 'auroraDepths'].includes(f.levelId)) ||
            typeof f.guardianRestoredBefore !== 'boolean' || (f.guardianRestoredBefore && (!['crystalCaves', 'cosmicReef'].includes(f.levelId) || f.guardianRestoredAfter)) ||
            (f.guardianRestoredAt !== null && (!f.guardianRestoredBefore || !Number.isSafeInteger(f.guardianRestoredAt) || f.guardianRestoredAt < 0 || f.guardianRestoredAt > f.now))) fail('invalid_completion_facts');
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) fail('missing_completion_snapshot');
        const iso = new Date(f.now).toISOString(), timeline = [], notifications = [], legacySaveRequests = [], effects = [];
        const flags = { outcomes: false, guardianResidents: false, rescuedResidents: false, fieldKit: false, ...participants.domains };
        if (Object.values(flags).some(value => typeof value !== 'boolean')) fail('unknown_completion_service_mode');
        const notify = (kind, event, data) => {
            const packet = { kind, event }; if (data !== undefined) packet.data = copy(data);
            notifications.push(packet); timeline.push({ type: 'notification', packet });
        };
        const effect = (kind, name) => { const value = { kind, name }; effects.push(value); timeline.push({ type: 'effect', ...value }); };
        const legacySave = source => { legacySaveRequests.push(source); timeline.push({ type: 'legacy-save-request', source }); };
        const target = {
            state: copy(snapshot),
            get(path) { return path ? path.split('.').reduce((value, key) => value?.[key], this.state) : this.state; },
            set(path, value) {
                const keys = path.split('.');
                if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) fail('invalid_completion_path');
                const last = keys.pop(); let object = this.state;
                for (const key of keys) { if (!object[key] || typeof object[key] !== 'object') object[key] = {}; object = object[key]; }
                const old = object[last]; object[last] = value;
                notify('state', 'stateChanged', dto({ path, oldValue: old, newValue: value, timestamp: f.now }));
                notify('state', `changed:${path}`, value);
            },
            emit: (event, data) => notify('state', event, data)
        };
        for (const name of ['getCampaignGateAccess', 'syncCanonicalCampaignGates']) {
            if (participants.stateMethods?.[name] !== undefined) {
                if (typeof participants.stateMethods[name] !== 'function') fail('unknown_completion_state_method');
                target[name] = participants.stateMethods[name];
            }
        }
        const canonical = (key, read) => {
            const raw = target.get(`world.${key}`), before = raw == null ? null : copy(raw), stateBytes = JSON.stringify(target.state);
            const normalised = read().state;
            if (JSON.stringify(target.state) !== stateBytes || (before !== null && !retainsInput(before, normalised, key))) fail(`unsupported_completion_${key}`);
        };
        canonical('currentEcology', () => getCurrentEcologySnapshot(target));
        if (flags.outcomes || flags.guardianResidents) canonical('guardianOutcomes', () => getGuardianOutcomeSnapshot(target));
        if (flags.guardianResidents) canonical('guardianResidents', () => getGuardianResidentsSnapshot(target, { now: f.now }));
        if (flags.rescuedResidents) canonical('rescuedResidents', () => getRescuedResidentSnapshot(target));
        checkpoint();
        let achievementPlan = null;
        if (f.guardianRestoredBefore && participants.achievements) {
            achievementPlan = calculateCompletionGuardianPrefix(participants.achievements, target.state, f.guardianRestoredAt ?? f.now);
            if (achievementPlan.status !== 'calculated') fail(achievementPlan.reason);
            target.state = copy(achievementPlan.state);
            for (const packet of achievementPlan.events) {
                if (packet.kind === 'save-request') legacySave('guardian-before-achievements');
                else notify(packet.kind, packet.event, packet.data);
            }
        }
        const reward = getCompletionRewardData(f.levelId, f.rewardBonusCount), amount = reward.coins + f.residentCoinBonus + f.villageCoinBonus;
        const coinPlan = calculateCompletionCoinDraft(target.state, { levelId: f.levelId, amount, economyMode: participants.economyMode });
        if (coinPlan.status !== 'calculated') fail(coinPlan.reason);
        const inventoryData = participants.inventory ? copy(participants.inventory.data) : null;
        if (inventoryData && (JSON.stringify(target.get('inventory')) !== JSON.stringify(inventoryData.inventory) ||
            JSON.stringify(target.get('hubWorld.shipParts')) !== JSON.stringify(inventoryData.shipParts))) fail('completion_inventory_input_changed');
        const inventoryTarget = inventoryData ? { inventory: inventoryData.itemsPresent ? target.get('inventory.items') : inventoryData.cache, maxSlots: inventoryData.maxSlots } : null;
        const inventoryEmit = (event, data) => notify('inventory', event, data);
        const itemPorts = { now: () => f.now, persist: () => { target.set('inventory.items', inventoryTarget.inventory); legacySave('inventory'); },
            emit: inventoryEmit, log() {}, warn() {} };
        const completionPath = `levels.${f.levelId}.completed`, wasCompleted = target.get(completionPath) === true;
        target.set('story.projectBeacon.expeditionCheckpoint', null);
        if (participants.thought) {
            const saved = participants.thought.data.saved, present = Object.hasOwn(target.state, 'thoughtContext');
            if (present !== saved.present || (present && JSON.stringify(target.state.thoughtContext) !== JSON.stringify(saved.value))) fail('completion_thought_input_changed');
            const thought = calculateCompletionThoughtDraft(participants.thought, f.sceneLevelId, f.now);
            if (thought.status !== 'calculated') fail(thought.reason);
            target.state.thoughtContext = copy(thought.context);
            for (const packet of thought.notifications) notify(packet.kind, packet.event, packet.data);
        }
        checkpoint();
        for (const write of coinPlan.writes) target.set(write.path, write.value);
        if (coinPlan.event) {
            if (participants.audioAvailable) effect('audio', 'playCoinCollect');
            notify('economy', coinPlan.event.name, coinPlan.event.data);
        }
        let shipPartAwarded = false, bossPowerupAwarded = false, bossPowerupQueued = false;
        if (f.shipPartId) {
            if (inventoryTarget) shipPartAwarded = addInventoryShipPart(f.shipPartId, {
                hasState: () => true, definitions: () => inventoryData.definitions,
                readCollected: () => target.get('hubWorld.shipParts.collected'), writeCollected: value => target.set('hubWorld.shipParts.collected', value),
                persist: () => legacySave('inventory-part'), emit: inventoryEmit,
                notify: () => { if (participants.audioAvailable) effect('audio', 'playAchievement'); }, log() {}, warn() {}
            });
            else {
                const collected = target.get('hubWorld.shipParts.collected') || [];
                if (!Array.isArray(collected)) fail('noncanonical_collected_parts');
                if (!collected.includes(f.shipPartId)) { target.set('hubWorld.shipParts.collected', [...collected, f.shipPartId]); shipPartAwarded = true; }
            }
        }
        if (reward.powerup) {
            if (inventoryTarget) {
                const result = addGuaranteedInventoryReward(reward.powerup, {
                    canAccept: item => canAcceptInventoryItem(inventoryTarget, item), addItem: item => addInventoryItem(inventoryTarget, item, itemPorts),
                    hasState: () => true, readPending: () => target.get('inventory.pendingBossRewards'),
                    writePending: value => target.set('inventory.pendingBossRewards', value), persist: () => legacySave('inventory-inbox'), emit: inventoryEmit
                });
                bossPowerupAwarded = result.accepted === true; bossPowerupQueued = result.queued === true;
            } else {
                const pending = target.get('inventory.pendingBossRewards') || [];
                if (!Array.isArray(pending)) fail('noncanonical_pending_rewards');
                target.set('inventory.pendingBossRewards', [...pending, reward.powerup]); bossPowerupAwarded = true; bossPowerupQueued = true;
            }
        }
        checkpoint();
        const data = { levelId: f.levelId, noDamage: f.noDamage, time: f.time, speedrunThreshold: f.speedrunThreshold };
        const currentRestoration = recordCurrentRegionRestoration(target, f.levelId, { save: false, occurredAt: iso });
        if (currentRestoration?.changed) effect('scene', 'refreshCurrentEcologyNode');
        const outcome = flags.outcomes ? recordGuardianOutcome(target, f.levelId, { save: false, resolvedAt: iso }) : null;
        const expedition = flags.guardianResidents ? recordGuardianExpedition(target, { levelId: f.levelId, noDamage: f.noDamage,
            interventionCount: f.guardianInterventions, completedAt: iso, calculationNow: f.now, save: false }) : null;
        const rescued = flags.rescuedResidents ? recordRescuedResident(target, f.levelId, { save: false, rescuedAt: iso }) : null;
        target.set(completionPath, true);
        if (f.noDamage) target.set(`levels.${f.levelId}.noDamageRun`, true);
        if (f.speedrunThreshold > 0 && f.time < f.speedrunThreshold) target.set(`levels.${f.levelId}.speedrun`, true);
        if (participants.achievements) {
            achievementPlan = f.guardianRestoredBefore
                ? continueCompletionLevelDraft(participants.achievements, achievementPlan, target.state, data, f.now)
                : calculateCompletionAchievementDraft(participants.achievements, target.state, data, f.now);
            if (achievementPlan.status !== 'calculated') fail(achievementPlan.reason);
            target.state = copy(achievementPlan.state);
            for (const packet of achievementPlan.events) {
                if (packet.kind === 'save-request') legacySave('achievements');
                else notify(packet.kind, packet.event, packet.data);
            }
        }
        checkpoint();
        const upgrade = f.katanaUpgradeId && flags.fieldKit ? installProjectBeaconKatanaUpgrade(target, f.katanaUpgradeId, { save: false, installedAt: iso }) : null;
        const best = target.get(`levels.${f.levelId}.bestTime`);
        if (!best || f.time < best) target.set(`levels.${f.levelId}.bestTime`, f.time);
        let nextGate = null;
        if (!wasCompleted) {
            const count = target.get('stats.levelsCompleted') || 0;
            if (typeof count !== 'number' || !Number.isFinite(count)) fail('noncanonical_completed_count');
            target.set('stats.levelsCompleted', count + 1);
            queueProjectBeaconDebrief(target, { levelId: f.levelId, shipPartId: f.shipPartId, completedAt: iso });
            nextGate = unlockProjectBeaconMilestone(target, f.levelId, { unlockedAt: iso });
            target.syncCanonicalCampaignGates?.();
        }
        const bond = target.get('creature.bond');
        if (bond) {
            if (typeof bond !== 'object' || Array.isArray(bond) ||
                ['experience', 'level', 'levelsCompleted', 'totalInteractions'].some(key => bond[key] && (typeof bond[key] !== 'number' || !Number.isFinite(bond[key]))) ||
                (bond.abilitySlots && (typeof bond.abilitySlots !== 'object' || Array.isArray(bond.abilitySlots)))) fail('noncanonical_completion_bond');
            const experience = (bond.experience || 0) + f.bondExperience, level = Math.floor(experience / 50) + 1;
            if (!Number.isFinite(experience) || !Number.isFinite(level)) fail('nonfinite_completion_bond');
            const previousLevel = bond.level || 1;
            target.set('creature.bond', { ...bond, experience, level, levelsCompleted: (bond.levelsCompleted || 0) + 1,
                totalInteractions: (bond.totalInteractions || 0) + 1, firstInteraction: bond.firstInteraction || f.now, lastInteraction: f.now,
                abilitySlots: { slot1: true, ...bond.abilitySlots, slot2: level >= 5 || bond.abilitySlots?.slot2 || false,
                    slot3: level >= 10 || bond.abilitySlots?.slot3 || false } });
            if (level > previousLevel) target.emit('bondLevelUp', { level });
        }
        legacySave('completion');
        if (f.guardianRestoredAfter && participants.achievements) {
            achievementPlan = continueCompletionGuardianDraft(participants.achievements, achievementPlan, target.state, f.now);
            if (achievementPlan.status !== 'calculated') fail(achievementPlan.reason);
            target.state = copy(achievementPlan.state);
            for (const packet of achievementPlan.events) {
                if (packet.kind === 'save-request') legacySave('guardian-achievements');
                else notify(packet.kind, packet.event, packet.data);
            }
        }
        const result = dto({ ...data, shipPartId: f.shipPartId, shipPartAwarded, katanaUpgradeId: f.katanaUpgradeId,
            katanaUpgrade: upgrade?.upgrade || null, katanaUpgradeAwarded: upgrade?.changed === true,
            bossPowerupReward: reward.powerup ? { id: reward.powerup.id, name: reward.powerup.name, icon: reward.powerup.icon,
                description: reward.powerup.description, resultText: reward.powerup.resultText, usageHint: reward.powerup.usageHint,
                awarded: bossPowerupAwarded, queued: bossPowerupQueued } : null,
            coinsAwarded: coinPlan.coinsAwarded, nextGateId: nextGate?.gateId || null, nextGateUnlocked: nextGate?.newlyUnlocked === true,
            currentEcology: currentRestoration ? { changed: currentRestoration.changed, regionId: currentRestoration.regionId,
                regionLabel: currentRestoration.regionLabel, beforeVitality: currentRestoration.beforeVitality, afterVitality: currentRestoration.afterVitality,
                networkVitality: currentRestoration.summary.vitality, restoredCount: currentRestoration.summary.restoredCount,
                totalRegions: currentRestoration.summary.totalRegions, networkStatus: currentRestoration.summary.networkStatus } : null,
            guardianResident: outcome?.definition ? { id: outcome.definition.guardianId, name: outcome.definition.name,
                newlyRescued: outcome.changed, role: outcome.definition.regionRole, routine: null, futureAbility: null } : null,
            guardianOutcome: outcome ? { guardianId: outcome.definition.guardianId, levelId: outcome.definition.levelId,
                name: outcome.definition.name, outcome: outcome.record.outcome, standing: outcome.record.standing,
                sanctuaryPresence: outcome.record.sanctuaryPresence, regionRole: outcome.definition.regionRole, outcomeLine: outcome.definition.outcomeLine, changed: outcome.changed } : null,
            guardianExpedition: expedition?.changed ? { guardianId: expedition.entry.guardianId, levelId: expedition.entry.levelId,
                interventionCount: expedition.entry.interventionCount, noDamage: expedition.entry.noDamage } : null,
            rescuedResident: rescued ? { id: rescued.resident.id, name: rescued.resident.name, newlyRescued: rescued.changed,
                role: rescued.resident.role, kind: rescued.resident.kind, genetics: rescued.resident.genetics, color: rescued.resident.color,
                accent: rescued.resident.accent, releaseLine: rescued.resident.releaseLine, sanctuaryLine: rescued.resident.sanctuaryLine, supportLabel: rescued.resident.supportLabel } : null,
            firstCompletion: !wasCompleted });
        checkpoint();
        const inventoryPresence = inventoryTarget ? { root: Object.hasOwn(target.state, 'inventory'),
            items: Object.hasOwn(target.state.inventory || {}, 'items') } : null;
        const inventoryMode = inventoryTarget ? inventoryPresence.items ? 'canonical' : 'original-empty' : null;
        const inventoryItems = !inventoryTarget ? null : inventoryPresence.items ? target.state.inventory.items : inventoryTarget.inventory;
        if (inventoryTarget && (!Array.isArray(inventoryItems) || (!inventoryPresence.items &&
            (inventoryData.itemsPresent || inventoryItems.length !== 0)))) fail('unsupported_completion_inventory_projection');
        return freeze(copy({ status: 'calculated', state: target.state, result, notifications, effects, timeline, legacySaveRequests,
            projections: { inventoryItems, inventoryPresence, inventoryMode,
                thoughtContext: participants.thought ? target.state.thoughtContext : null,
                achievements: achievementPlan ? { achievements: achievementPlan.achievements, pendingClaims: achievementPlan.pendingClaims } : null,
                quests: target.state.quests || null } }));
    } catch (error) { return Object.freeze({ status: 'unqualified', reason: error.completionReason || 'completion_calculation_unreadable' }); }
}

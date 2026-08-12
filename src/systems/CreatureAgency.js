import {
    buildCreaturePowerProfile,
    recordCreaturePowerEvent
} from './CreaturePowerProfile.js';

export const CREATURE_AGENCY_SCHEMA_VERSION = 1;
export const CREATURE_AGENCY_HISTORY_LIMIT = 24;
export const AUTONOMOUS_RESCUE_BOND_XP = 5;
export const AUTONOMOUS_HIGH_POWER_BOND_XP = 23;

function getAgencyValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function normalizeAgencyIdentifier(value, fallback = null, maxLength = 96) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeAgencyTimestamp(value, fallback = null) {
    if (typeof value !== 'string') return fallback;
    return value.trim().slice(0, 40) || fallback;
}

export function normalizeCreatureAgencyHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const decisionId = normalizeAgencyIdentifier(entry?.decisionId);
            if (!decisionId || seen.has(decisionId)) return null;
            seen.add(decisionId);
            const type = [
                'autonomous_rescue',
                'high_power_rescue'
            ].includes(entry?.type)
                ? entry.type
                : 'autonomous_action';
            return {
                schemaVersion: CREATURE_AGENCY_SCHEMA_VERSION,
                decisionId,
                creatureId: normalizeAgencyIdentifier(
                    entry?.creatureId,
                    'companion'
                ),
                type,
                levelId: normalizeAgencyIdentifier(entry?.levelId, 'unknown'),
                trigger: normalizeAgencyIdentifier(entry?.trigger, 'unknown'),
                powerId: normalizeAgencyIdentifier(entry?.powerId, 'unknown'),
                powerName: typeof entry?.powerName === 'string'
                    ? entry.powerName.trim().slice(0, 80)
                    : 'Protective Response',
                affinity: normalizeAgencyIdentifier(entry?.affinity, 'star', 32),
                magnitude: ['controlled', 'major', 'extreme'].includes(
                    entry?.magnitude
                ) ? entry.magnitude : 'major',
                outcome: normalizeAgencyIdentifier(
                    entry?.outcome,
                    'expedition_loss_prevented'
                ),
                relationshipSignal: type === 'high_power_rescue'
                    ? 'world_protective_trust'
                    : 'protective_trust',
                occurredAt: normalizeAgencyTimestamp(entry?.occurredAt),
                ...(type === 'high_power_rescue'
                    ? {
                        witnessScope: 'five_living_systems',
                        earthVisibility: 'city_scale_detectable'
                    }
                    : {})
            };
        })
        .filter(Boolean)
        .slice(-CREATURE_AGENCY_HISTORY_LIMIT);
}

export function getCreatureAgencySnapshot(gameState) {
    const history = normalizeCreatureAgencyHistory(
        getAgencyValue(gameState, 'creature.agencyHistory', [])
    );
    return {
        schemaVersion: CREATURE_AGENCY_SCHEMA_VERSION,
        history,
        autonomousRescues: history.filter(
            entry => entry.type === 'autonomous_rescue'
        ).length,
        highPowerRescues: history.filter(
            entry => entry.type === 'high_power_rescue'
        ).length
    };
}

function awardAutonomousRescueBond(gameState, occurredAt) {
    const bond = getAgencyValue(gameState, 'creature.bond', {});
    const currentExperience = Math.max(0, Number(bond?.experience) || 0);
    const currentLevel = Math.max(1, Number(bond?.level) || 1);
    const experience = currentExperience + AUTONOMOUS_RESCUE_BOND_XP;
    const level = Math.max(
        currentLevel,
        Math.min(20, Math.floor(experience / 50) + 1)
    );

    gameState.set('creature.bond', {
        ...bond,
        experience,
        level,
        totalInteractions: Math.max(
            0,
            Number(bond?.totalInteractions) || 0
        ) + 1,
        autonomousRescues: Math.max(
            0,
            Number(bond?.autonomousRescues) || 0
        ) + 1,
        firstInteraction: bond?.firstInteraction || occurredAt,
        lastInteraction: occurredAt,
        abilitySlots: {
            slot1: true,
            ...bond?.abilitySlots,
            slot2: level >= 5 || bond?.abilitySlots?.slot2 === true,
            slot3: level >= 10 || bond?.abilitySlots?.slot3 === true
        }
    });
}

function awardAutonomousHighPowerBond(gameState, occurredAt) {
    const bond = getAgencyValue(gameState, 'creature.bond', {});
    const currentExperience = Math.max(0, Number(bond?.experience) || 0);
    const currentLevel = Math.max(1, Number(bond?.level) || 1);
    const experience = currentExperience + AUTONOMOUS_HIGH_POWER_BOND_XP;
    const level = Math.max(
        currentLevel,
        Math.min(20, Math.floor(experience / 50) + 1)
    );

    gameState.set('creature.bond', {
        ...bond,
        experience,
        level,
        totalInteractions: Math.max(
            0,
            Number(bond?.totalInteractions) || 0
        ) + 1,
        highPowerRescues: Math.max(
            0,
            Number(bond?.highPowerRescues) || 0
        ) + 1,
        firstInteraction: bond?.firstInteraction || occurredAt,
        lastInteraction: occurredAt,
        abilitySlots: {
            slot1: true,
            ...bond?.abilitySlots,
            slot2: true,
            slot3: level >= 10 || bond?.abilitySlots?.slot3 === true
        }
    });
}

export function attemptAutonomousRescue(gameState, {
    levelId,
    trigger = 'lethal_fall',
    operationId = null,
    occurredAt = new Date().toISOString(),
    commit = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;

    const profileBefore = buildCreaturePowerProfile(gameState, {
        context: 'fend'
    });
    const creatureId = normalizeAgencyIdentifier(
        getAgencyValue(gameState, 'creature.id', null)
            || profileBefore.creatureId,
        'companion'
    );
    const normalizedLevelId = normalizeAgencyIdentifier(levelId, 'unknown');
    const normalizedTrigger = normalizeAgencyIdentifier(trigger, 'lethal_fall');
    const decisionId = normalizeAgencyIdentifier(
        typeof operationId === 'string'
            ? operationId
            : `rescue:${creatureId}:${normalizedLevelId}:${normalizedTrigger}`,
        `rescue:${creatureId}:${normalizedLevelId}:${normalizedTrigger}`
    );
    const snapshot = getCreatureAgencySnapshot(gameState);
    const duplicate = snapshot.history.find(
        entry => entry.decisionId === decisionId
    );

    if (duplicate) {
        return {
            changed: false,
            duplicate: true,
            decision: duplicate,
            profile: profileBefore,
            snapshot
        };
    }

    const normalizedOccurredAt = normalizeAgencyTimestamp(
        occurredAt,
        new Date().toISOString()
    );
    const decision = {
        schemaVersion: CREATURE_AGENCY_SCHEMA_VERSION,
        decisionId,
        creatureId,
        type: 'autonomous_rescue',
        levelId: normalizedLevelId,
        trigger: normalizedTrigger,
        powerId: profileBefore.protectiveResponse.id,
        powerName: profileBefore.protectiveResponse.name,
        affinity: profileBefore.affinity,
        magnitude: 'major',
        outcome: 'expedition_loss_prevented',
        relationshipSignal: 'protective_trust',
        occurredAt: normalizedOccurredAt
    };

    if (!commit) {
        return {
            changed: true,
            duplicate: false,
            preview: true,
            decision,
            profile: profileBefore,
            snapshot
        };
    }

    const history = [...snapshot.history, decision]
        .slice(-CREATURE_AGENCY_HISTORY_LIMIT);
    gameState.set('creature.agencyHistory', history);
    awardAutonomousRescueBond(gameState, normalizedOccurredAt);
    recordCreaturePowerEvent(gameState, {
        eventId: `agency:${decisionId}`,
        powerId: decision.powerId,
        context: 'fend',
        magnitude: decision.magnitude,
        outcome: decision.outcome,
        occurredAt: normalizedOccurredAt,
        save: false
    });
    gameState.save?.();

    const profile = buildCreaturePowerProfile(gameState, {
        context: 'fend'
    });
    const nextSnapshot = getCreatureAgencySnapshot(gameState);
    const result = {
        changed: true,
        duplicate: false,
        decision,
        profile,
        partnershipUnlocked:
            profileBefore.partnershipMove.unlocked !== true
            && profile.partnershipMove.unlocked === true,
        snapshot: nextSnapshot
    };
    gameState.emit?.('creatureAgencyChanged', result);
    return result;
}

/**
 * Record the authored late-campaign moment where the companion protects the
 * living network without being commanded. Campaign-run identity keeps New
 * Game+ replays distinct while retries within one run remain idempotent.
 */
export function attemptAutonomousHighPowerRescue(gameState, {
    levelId = 'final_void_1',
    trigger = 'five_system_collapse',
    operationId = null,
    occurredAt = new Date().toISOString(),
    commit = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;

    const profileBefore = buildCreaturePowerProfile(gameState, {
        context: 'fend'
    });
    const creatureId = normalizeAgencyIdentifier(
        getAgencyValue(gameState, 'creature.id', null)
            || profileBefore.creatureId,
        'companion'
    );
    const normalizedLevelId = normalizeAgencyIdentifier(levelId, 'final_void_1');
    const normalizedTrigger = normalizeAgencyIdentifier(
        trigger,
        'five_system_collapse'
    );
    const campaignRun = Math.max(
        0,
        Math.floor(
            Number(getAgencyValue(gameState, 'game.newGamePlusCount', 0)) || 0
        )
    );
    const decisionId = normalizeAgencyIdentifier(
        typeof operationId === 'string'
            ? operationId
            : `high_power:${creatureId}:run_${campaignRun}:${normalizedLevelId}:${normalizedTrigger}`,
        `high_power:${creatureId}:run_${campaignRun}:${normalizedLevelId}:${normalizedTrigger}`
    );
    const snapshot = getCreatureAgencySnapshot(gameState);
    const duplicate = snapshot.history.find(
        entry => entry.decisionId === decisionId
    );

    if (duplicate) {
        return {
            changed: false,
            duplicate: true,
            decision: duplicate,
            profile: profileBefore,
            snapshot
        };
    }

    if (commit && profileBefore.highPowerReveal.unlocked !== true) {
        return {
            changed: false,
            duplicate: false,
            reason: 'shared_journey_not_ready',
            profile: profileBefore,
            snapshot
        };
    }

    const normalizedOccurredAt = normalizeAgencyTimestamp(
        occurredAt,
        new Date().toISOString()
    );
    const decision = {
        schemaVersion: CREATURE_AGENCY_SCHEMA_VERSION,
        decisionId,
        creatureId,
        type: 'high_power_rescue',
        levelId: normalizedLevelId,
        trigger: normalizedTrigger,
        powerId: profileBefore.highPowerReveal.id,
        powerName: profileBefore.highPowerReveal.name,
        affinity: profileBefore.affinity,
        magnitude: 'extreme',
        outcome: 'living_network_stabilized',
        relationshipSignal: 'world_protective_trust',
        witnessScope: 'five_living_systems',
        earthVisibility: 'city_scale_detectable',
        occurredAt: normalizedOccurredAt
    };

    if (!commit) {
        return {
            changed: true,
            duplicate: false,
            preview: true,
            decision,
            profile: profileBefore,
            snapshot
        };
    }

    const history = [...snapshot.history, decision]
        .slice(-CREATURE_AGENCY_HISTORY_LIMIT);
    gameState.set('creature.agencyHistory', history);
    awardAutonomousHighPowerBond(gameState, normalizedOccurredAt);
    recordCreaturePowerEvent(gameState, {
        eventId: `agency:${decisionId}`,
        powerId: decision.powerId,
        context: 'fend',
        magnitude: 'extreme',
        outcome: decision.outcome,
        occurredAt: normalizedOccurredAt,
        save: false
    });

    const existingReveals = getAgencyValue(
        gameState,
        'story.projectBeacon.highPowerReveals',
        []
    );
    const reveals = Array.isArray(existingReveals)
        ? existingReveals.filter(entry => entry?.decisionId !== decisionId)
        : [];
    gameState.set('story.projectBeacon.highPowerReveals', [
        ...reveals,
        {
            schemaVersion: CREATURE_AGENCY_SCHEMA_VERSION,
            decisionId,
            creatureId,
            levelId: normalizedLevelId,
            powerId: decision.powerId,
            affinity: decision.affinity,
            magnitude: 'extreme',
            outcome: decision.outcome,
            witnessScope: decision.witnessScope,
            earthVisibility: decision.earthVisibility,
            occurredAt: normalizedOccurredAt
        }
    ].slice(-8));
    gameState.save?.();

    const profile = buildCreaturePowerProfile(gameState, {
        context: 'fend'
    });
    const nextSnapshot = getCreatureAgencySnapshot(gameState);
    const result = {
        changed: true,
        duplicate: false,
        decision,
        profile,
        snapshot: nextSnapshot
    };
    gameState.emit?.('creatureAgencyChanged', result);
    gameState.emit?.('creatureHighPowerWitnessed', result);
    return result;
}

if (typeof window !== 'undefined') {
    window.CreatureAgency = {
        CREATURE_AGENCY_SCHEMA_VERSION,
        getCreatureAgencySnapshot,
        normalizeCreatureAgencyHistory,
        attemptAutonomousRescue,
        attemptAutonomousHighPowerRescue
    };
}

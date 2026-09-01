export const RESCUED_RESIDENTS_SCHEMA_VERSION = 3;

export const RESCUED_RESIDENT_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'bloom',
        levelId: 'mythicalForest',
        name: 'Bloom',
        role: 'Root Forager',
        kind: 'bloom',
        artwork: '/marketing/bloom%202.webp',
        textureKey: 'rescued-resident-bloom-art',
        color: 0xE7A3C7,
        accent: 0x71E6B1,
        releaseLine: 'The cage was blocking the root paths Bloom uses to carry food between shelters.',
        sanctuaryLine: 'I found a clean root cache. I left enough behind for the next traveler.',
        support: Object.freeze({ maxEnergyBonus: 1 }),
        supportLabel: '+1 expedition energy from gathered root supplies',
        preferredBuildingId: 'forager_hut',
        villageTraits: Object.freeze(['curious', 'gentle', 'nebula']),
        contributionLine: 'Maps food paths that regrow before the next visit.'
    }),
    Object.freeze({
        id: 'pebble',
        levelId: 'crystalCaves',
        name: 'Pebble',
        role: 'Shard Finder',
        kind: 'pebble',
        artwork: '/marketing/pebble%202.webp',
        textureKey: 'rescued-resident-pebble-art',
        color: 0xB98A68,
        accent: 0x63E5E8,
        releaseLine: 'Pebble knows which loose crystals are safe to gather and which are still alive.',
        sanctuaryLine: 'This shard was already loose. Taking it did not hurt the cave.',
        support: Object.freeze({ victoryCoinBonus: 3 }),
        supportLabel: '+3 salvage coins after each later expedition',
        preferredBuildingId: 'current_masonry',
        villageTraits: Object.freeze(['wise', 'gentle', 'crystal']),
        contributionLine: 'Finds loose stone without closing a living Current path.'
    }),
    Object.freeze({
        id: 'zephyr',
        levelId: 'cosmicReef',
        name: 'Zephyr',
        role: 'Current Courier',
        kind: 'zephyr',
        artwork: '/marketing/zephyr%202.webp',
        textureKey: 'rescued-resident-zephyr-art',
        color: 0xE98843,
        accent: 0x49E6D3,
        releaseLine: 'Zephyr carried warnings between reef settlements until the broken Current trapped them.',
        sanctuaryLine: 'The quiet route is open. I can carry a warning there before the pressure changes.',
        support: Object.freeze({ speedMultiplier: 1.04 }),
        supportLabel: '+4% expedition movement through mapped passages',
        preferredBuildingId: 'sawmill',
        villageTraits: Object.freeze(['energetic', 'bold', 'star']),
        contributionLine: 'Carries supplies along routes that do not disturb smaller lives.'
    }),
    Object.freeze({
        id: 'wisp',
        levelId: 'voidPeaks',
        name: 'Wisp',
        role: 'Ridge Lookout',
        kind: 'wisp',
        artwork: '/marketing/wisp%202.webp',
        textureKey: 'rescued-resident-wisp-art',
        color: 0x8C77C8,
        accent: 0xF2C14E,
        releaseLine: 'Wisp was contained for warning travelers away from unstable ridge crossings.',
        sanctuaryLine: 'I saw the ridge move before it broke. I will mark the next unsafe crossing.',
        support: Object.freeze({ guardCharges: 1 }),
        supportLabel: '+1 supply guard charge in later expeditions',
        preferredBuildingId: 'current_masonry',
        villageTraits: Object.freeze(['wise', 'bold', 'void']),
        contributionLine: 'Marks unstable crossings before a resident reaches them.'
    }),
    Object.freeze({
        id: 'luna',
        levelId: 'auroraDepths',
        name: 'Luna',
        role: 'Aurora Surveyor',
        kind: 'luna',
        artwork: '/marketing/luna%202.webp',
        textureKey: 'rescued-resident-luna-art',
        color: 0x53A6D8,
        accent: 0xF4D35E,
        releaseLine: 'Luna can read warm sky lanes the extraction instruments register only as waste heat.',
        sanctuaryLine: 'The reactor is stable. There is another presence beyond the mapped sky.',
        support: Object.freeze({ jumpMultiplier: 1.04 }),
        supportLabel: '+4% lift from mapped aurora currents',
        preferredBuildingId: 'workshop',
        villageTraits: Object.freeze(['curious', 'wise', 'star']),
        contributionLine: 'Compares warm sky lanes with the astronaut\'s instruments.'
    }),
    Object.freeze({
        id: 'nova',
        levelId: 'finalVoid',
        name: 'Nova',
        role: 'Memory Keeper',
        kind: 'nova',
        artwork: '/marketing/nova%202.webp',
        textureKey: 'rescued-resident-nova-art',
        color: 0x8FE3CF,
        accent: 0xF2C14E,
        releaseLine: 'Nova kept the names of lives the extraction record reduced to empty coordinates.',
        sanctuaryLine: 'A place survives when its lives remain named. I have added yours beside ours.',
        support: Object.freeze({}),
        supportLabel: 'Preserves the living-world record for the campaign decision',
        preferredBuildingId: 'workshop',
        villageTraits: Object.freeze(['wise', 'gentle', 'nebula']),
        contributionLine: 'Keeps every rescued life named in the shared archive.'
    })
]);

const RESIDENT_BY_LEVEL = new Map(
    RESCUED_RESIDENT_DEFINITIONS.map(resident => [resident.levelId, resident])
);
const RESIDENT_BY_ID = new Map(
    RESCUED_RESIDENT_DEFINITIONS.map(resident => [resident.id, resident])
);

function normalizeTimestamp(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim().slice(0, 40)
        : null;
}

function getLegacyCompletedResidentIds(gameState) {
    return RESCUED_RESIDENT_DEFINITIONS
        .filter(resident => (
            gameState?.get?.(`levels.${resident.levelId}.completed`) === true
        ))
        .map(resident => resident.id);
}

export function normalizeRescuedResidentState(value = {}, {
    completedResidentIds = []
} = {}) {
    const rescuedIds = [...new Set(
        [
            ...(Array.isArray(value.rescuedIds) ? value.rescuedIds : []),
            ...completedResidentIds
        ]
            .filter(id => RESIDENT_BY_ID.has(id))
    )];
    const interactions = {};
    const residency = {};
    const sanctuaryArrivalSeenIds = [...new Set(
        (Array.isArray(value.sanctuaryArrivalSeenIds)
            ? value.sanctuaryArrivalSeenIds
            : [])
            .filter(id => rescuedIds.includes(id))
    )];
    rescuedIds.forEach(id => {
        interactions[id] = Math.max(0, Number(value.interactions?.[id]) || 0);
        const stored = value.residency?.[id];
        residency[id] = {
            status: ['resident', 'guest', 'away'].includes(stored?.status)
                ? stored.status
                : 'resident',
            arrivedAt: normalizeTimestamp(stored?.arrivedAt)
        };
    });
    return {
        schemaVersion: RESCUED_RESIDENTS_SCHEMA_VERSION,
        rescuedIds,
        interactions,
        residency,
        rescueHistory: (Array.isArray(value.rescueHistory)
            ? value.rescueHistory
            : [])
            .filter(entry => RESIDENT_BY_ID.has(entry?.residentId))
            .slice(-RESCUED_RESIDENT_DEFINITIONS.length)
            .map(entry => ({
                residentId: entry.residentId,
                levelId: RESIDENT_BY_ID.get(entry.residentId).levelId,
                rescuedAt: normalizeTimestamp(entry.rescuedAt)
            })),
        sanctuaryArrivalSeenIds,
        lastSanctuaryArrivalId: RESIDENT_BY_ID.has(value.lastSanctuaryArrivalId)
            ? value.lastSanctuaryArrivalId
            : null,
        lastSanctuaryArrivalAt: normalizeTimestamp(value.lastSanctuaryArrivalAt),
        lastInteractionId: RESIDENT_BY_ID.has(value.lastInteractionId)
            ? value.lastInteractionId
            : null,
        lastInteractionAt: normalizeTimestamp(value.lastInteractionAt)
    };
}

export function getRescuedResidentSnapshot(gameState) {
    const state = normalizeRescuedResidentState(
        gameState?.get?.('world.rescuedResidents') || {},
        { completedResidentIds: getLegacyCompletedResidentIds(gameState) }
    );
    const rescued = RESCUED_RESIDENT_DEFINITIONS
        .filter(resident => state.rescuedIds.includes(resident.id))
        .map(resident => ({
            ...resident,
            interactionCount: state.interactions[resident.id] || 0,
            residencyStatus: state.residency[resident.id]?.status || 'resident',
            arrivedAt: state.residency[resident.id]?.arrivedAt || null
        }));
    const support = rescued.reduce((total, resident) => ({
        maxEnergyBonus:
            total.maxEnergyBonus + (resident.support.maxEnergyBonus || 0),
        maxHealthBonus:
            total.maxHealthBonus + (resident.support.maxHealthBonus || 0),
        guardCharges:
            total.guardCharges + (resident.support.guardCharges || 0),
        victoryCoinBonus:
            total.victoryCoinBonus + (resident.support.victoryCoinBonus || 0),
        speedMultiplier:
            total.speedMultiplier * (resident.support.speedMultiplier || 1),
        jumpMultiplier:
            total.jumpMultiplier * (resident.support.jumpMultiplier || 1)
    }), {
        maxEnergyBonus: 0,
        maxHealthBonus: 0,
        guardCharges: 0,
        victoryCoinBonus: 0,
        speedMultiplier: 1,
        jumpMultiplier: 1
    });
    return {
        state,
        residents: RESCUED_RESIDENT_DEFINITIONS.map(resident => ({
            ...resident,
            rescued: state.rescuedIds.includes(resident.id),
            interactionCount: state.interactions[resident.id] || 0,
            residencyStatus: state.residency[resident.id]?.status || null,
            arrivedAt: state.residency[resident.id]?.arrivedAt || null
        })),
        rescued,
        rescuedCount: rescued.length,
        totalResidents: RESCUED_RESIDENT_DEFINITIONS.length,
        support
    };
}

export function recordRescuedResident(gameState, levelId, {
    save = true,
    rescuedAt = new Date().toISOString()
} = {}) {
    const resident = RESIDENT_BY_LEVEL.get(levelId);
    if (!gameState || !resident) return null;
    const state = normalizeRescuedResidentState(
        gameState.get?.('world.rescuedResidents') || {},
        { completedResidentIds: getLegacyCompletedResidentIds(gameState) }
    );
    const changed = !state.rescuedIds.includes(resident.id);
    if (changed) {
        state.rescuedIds.push(resident.id);
        state.interactions[resident.id] = 0;
        state.residency[resident.id] = {
            status: 'resident',
            arrivedAt: normalizeTimestamp(rescuedAt)
        };
        state.rescueHistory.push({
            residentId: resident.id,
            levelId: resident.levelId,
            rescuedAt
        });
        gameState.set('world.rescuedResidents', state);
        if (save) gameState.save?.();
    }
    return {
        changed,
        resident,
        snapshot: getRescuedResidentSnapshot(gameState)
    };
}

export function getPendingRescuedResidentArrival(gameState) {
    const snapshot = getRescuedResidentSnapshot(gameState);
    const seen = new Set(snapshot.state.sanctuaryArrivalSeenIds || []);
    const historyPendingId = snapshot.state.rescueHistory
        .map(entry => entry.residentId)
        .find(id => !seen.has(id));
    // Saves created before resident arrivals have completed levels but no
    // rescue history. Introduce those residents one at a time on later visits
    // instead of silently placing unfamiliar characters in the Sanctuary.
    const pendingId = historyPendingId || snapshot.rescued
        .map(resident => resident.id)
        .find(id => !seen.has(id));
    if (!pendingId) return null;
    return snapshot.rescued.find(resident => resident.id === pendingId) || null;
}

export function acknowledgeRescuedResidentArrival(gameState, residentId, {
    save = true,
    arrivedAt = new Date().toISOString()
} = {}) {
    if (!gameState || !RESIDENT_BY_ID.has(residentId)) {
        return { changed: false, reason: 'unknown_resident' };
    }
    const state = normalizeRescuedResidentState(
        gameState.get?.('world.rescuedResidents') || {},
        { completedResidentIds: getLegacyCompletedResidentIds(gameState) }
    );
    if (!state.rescuedIds.includes(residentId)) {
        return { changed: false, reason: 'resident_not_rescued' };
    }
    const changed = !state.sanctuaryArrivalSeenIds.includes(residentId);
    if (changed) {
        state.sanctuaryArrivalSeenIds.push(residentId);
        state.lastSanctuaryArrivalId = residentId;
        state.lastSanctuaryArrivalAt = normalizeTimestamp(arrivedAt);
        gameState.set('world.rescuedResidents', state);
        if (save) gameState.save?.();
    }
    return {
        changed,
        resident: RESIDENT_BY_ID.get(residentId),
        snapshot: getRescuedResidentSnapshot(gameState)
    };
}

export function interactWithRescuedResident(gameState, residentId, {
    interactedAt = new Date().toISOString()
} = {}) {
    const resident = RESIDENT_BY_ID.get(residentId);
    if (!gameState || !resident) return null;
    const state = normalizeRescuedResidentState(
        gameState.get?.('world.rescuedResidents') || {},
        { completedResidentIds: getLegacyCompletedResidentIds(gameState) }
    );
    if (!state.rescuedIds.includes(residentId)) return null;
    state.interactions[residentId] = (state.interactions[residentId] || 0) + 1;
    state.lastInteractionId = residentId;
    state.lastInteractionAt = interactedAt;
    gameState.set('world.rescuedResidents', state);
    gameState.save?.();
    return {
        resident,
        line: resident.sanctuaryLine,
        supportLabel: resident.supportLabel,
        interactionCount: state.interactions[residentId],
        snapshot: getRescuedResidentSnapshot(gameState)
    };
}

export function getRescuedResidentByLevel(levelId) {
    return RESIDENT_BY_LEVEL.get(levelId) || null;
}

if (typeof window !== 'undefined') {
    window.RescuedResidents = {
        RESCUED_RESIDENTS_SCHEMA_VERSION,
        RESCUED_RESIDENT_DEFINITIONS,
        normalizeRescuedResidentState,
        getRescuedResidentSnapshot,
        recordRescuedResident,
        getPendingRescuedResidentArrival,
        acknowledgeRescuedResidentArrival,
        interactWithRescuedResident,
        getRescuedResidentByLevel
    };
}

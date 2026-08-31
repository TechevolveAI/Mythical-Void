export const FUSION_POD_LANDMARK_SCHEMA_VERSION = 1;

function getList(gameState, path) {
    const value = gameState?.get?.(path);
    return Array.isArray(value) ? value : [];
}

function getCollection(gameState) {
    return gameState?.getCreatureCollection?.() ||
        getList(gameState, 'creatures');
}

function getReadiness(gameState, creature, now) {
    return gameState?.getCreatureFusionReadiness?.(creature, now) || {
        eligible: ['adult', 'elder'].includes(
            String(creature?.lifecycle?.stage || '').toLowerCase()
        )
    };
}

function formatRecharge(milliseconds) {
    const totalMinutes = Math.max(
        1,
        Math.ceil((Number(milliseconds) || 0) / 60000)
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}M`;
    if (minutes === 0) return `${hours}H`;
    return `${hours}H ${minutes}M`;
}

export function getFusionPodLandmarkSnapshot(
    gameState,
    {
        now = Date.now(),
        sharedAvailable = false
    } = {}
) {
    const collection = getCollection(gameState);
    const status = gameState?.getBreedingShrineStatus?.() || {};
    const discovery = gameState?.get?.('breedingShrine.discovery') || {};
    const currentLevel = Math.max(
        1,
        Math.floor(
            Number(status.currentLevel) ||
            Number(gameState?.get?.('creature.level')) ||
            1
        )
    );
    const levelRequirement = Math.max(
        1,
        Math.floor(Number(status.levelRequirement) || 5)
    );
    const adultCount = collection.filter(
        creature => getReadiness(gameState, creature, now).eligible
    ).length;
    const collectionStatus = gameState?.getCollectionStatus?.() || {
        count: collection.length,
        max: Number(gameState?.get?.('maxCreatures')) || 8
    };
    const discovered = discovery.state !== 'dormant' ||
        collection.length >= 2;

    let state = 'dormant';
    let statusLabel = 'TWO CREATURES REQUIRED';
    let interactionLabel = 'Inspect dormant Fusion Pod';
    let tone = 'dormant';

    if (discovered && !status.unlocked) {
        state = 'calibrating';
        statusLabel =
            `FIELD CALIBRATION ${currentLevel}/${levelRequirement}`;
        interactionLabel =
            `Fusion calibration Level ${currentLevel}/${levelRequirement}`;
        tone = 'calibrating';
    } else if (status.unlocked && status.reconciliationPending > 0) {
        state = 'verification_required';
        statusLabel = 'VERIFY PRIOR LINEAGE';
        interactionLabel = 'Verify prior Fusion lineage';
        tone = 'warning';
    } else if (status.unlocked && status.sharedFusionPending) {
        state = 'shared_link_active';
        statusLabel = 'PROTECTED SHARED LINK ACTIVE';
        interactionLabel = 'Review protected Shared Fusion';
        tone = 'warning';
    } else if (status.unlocked && status.cooldownRemaining > 0) {
        state = 'recharging';
        statusLabel =
            `RECHARGING ${formatRecharge(status.cooldownRemaining)}`;
        interactionLabel = 'Review Fusion recharge';
        tone = 'calibrating';
    } else if (
        status.unlocked &&
        Number(collectionStatus.count) >= Number(collectionStatus.max)
    ) {
        state = 'capacity_full';
        statusLabel = 'SANCTUARY CAPACITY FULL';
        interactionLabel = 'Review Fusion capacity';
        tone = 'warning';
    } else if (
        status.unlocked &&
        (adultCount >= 2 || (sharedAvailable && adultCount >= 1))
    ) {
        state = sharedAvailable && adultCount < 2
            ? 'shared_ready'
            : 'ready';
        statusLabel = state === 'shared_ready'
            ? 'PROTECTED LINK READY'
            : 'TWO ADULT CREATURES READY';
        interactionLabel = 'Open Fusion Pod';
        tone = 'ready';
    } else if (status.unlocked) {
        state = 'maturing';
        statusLabel = collection.length < 2
            ? `CREATURES ${collection.length}/2`
            : `ADULT CREATURES ${adultCount}/2`;
        interactionLabel = collection.length < 2
            ? `Fusion needs another companion ${collection.length}/2`
            : `Fusion adult creatures ${adultCount}/2`;
        tone = 'calibrating';
    }

    return {
        schemaVersion: FUSION_POD_LANDMARK_SCHEMA_VERSION,
        state,
        tone,
        discovered,
        unlocked: Boolean(status.unlocked),
        canOpen: Boolean(status.unlocked),
        currentLevel,
        levelRequirement,
        collectionCount: collection.length,
        adultCount,
        sharedAvailable: Boolean(sharedAvailable),
        statusLabel,
        interactionLabel
    };
}

export function formatFusionPodLandmarkObjective(snapshot) {
    if (!snapshot) {
        return 'Locate the dormant Fusion Pod in the Sanctuary.';
    }
    if (snapshot.state === 'dormant') {
        return 'Rescue a second companion to wake the dormant Fend interface.';
    }
    if (snapshot.state === 'calibrating') {
        return `Raise the active companion to field level ${snapshot.levelRequirement}.`;
    }
    if (snapshot.state === 'maturing') {
        return snapshot.collectionCount < 2
            ? 'Rescue another companion. Fusion preserves both parents.'
            : 'Wait until two companion signatures reach adulthood.';
    }
    if (snapshot.state === 'capacity_full') {
        return 'Make Sanctuary capacity before creating a new lineage.';
    }
    if (snapshot.state === 'verification_required') {
        return 'Reconnect Cloud Save and verify the reserved lineage.';
    }
    if (snapshot.state === 'shared_link_active') {
        return 'Return to the Fusion Pod to review the protected shared link.';
    }
    if (snapshot.state === 'recharging') {
        return 'The Fusion Pod is safely recharging.';
    }
    return 'Approach the Fusion Pod in the Sanctuary to compare living signatures.';
}

if (typeof window !== 'undefined') {
    window.FusionPodLandmark = {
        FUSION_POD_LANDMARK_SCHEMA_VERSION,
        getFusionPodLandmarkSnapshot,
        formatFusionPodLandmarkObjective
    };
}

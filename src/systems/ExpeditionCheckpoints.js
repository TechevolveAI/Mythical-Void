// Presentation metadata only. Saved IDs and checkpoint versions stay unchanged.
const EXPEDITION_CHECKPOINTS = Object.freeze([
    {
        gateId: 'mythical_forest', sceneKey: 'MythicalForestLevel',
        levelId: 'mythical_forest_1', levelStateId: 'mythicalForest',
        checkpoints: [
            ['forest_anchor_1', 'Tangled Roots'],
            ['forest_anchor_2', 'Dark Hollow'],
            ['forest_anchor_3', 'Hidden Lives']
        ]
    },
    {
        gateId: 'crystal_caves', sceneKey: 'CrystalCavesLevel',
        levelId: 'crystal_caves_1', levelStateId: 'crystalCaves',
        checkpoints: [
            ['caves_anchor_1', 'Echo Pass'],
            ['caves_anchor_2', 'Living Chamber'],
            ['caves_anchor_3', 'Guardian Threshold']
        ]
    },
    {
        gateId: 'stellar_reef', sceneKey: 'ReefLevel',
        levelId: 'reef_1', levelStateId: 'cosmicReef',
        checkpoints: [
            ['reef_waypoint_1', 'Drift Marker'],
            ['reef_waypoint_2', 'Traveler Relay'],
            ['reef_waypoint_3', 'Passage Vector']
        ]
    },
    {
        gateId: 'void_peaks', sceneKey: 'VoidPeaksLevel',
        levelId: 'void_peaks_1', levelStateId: 'voidPeaks',
        checkpoints: [
            ['peaks_relay_1', 'Lower Relay'],
            ['peaks_relay_2', 'Ridge Relay'],
            ['peaks_relay_3', 'Summit Relay']
        ]
    },
    {
        gateId: 'aurora_depths', sceneKey: 'AuroraDepthsLevel',
        levelId: 'aurora_depths_1', levelStateId: 'auroraDepths',
        checkpoints: [
            ['aurora_prism_1', 'Lower Prism'],
            ['aurora_prism_2', 'Heart Prism'],
            ['aurora_prism_3', 'Sky Prism']
        ]
    },
    {
        gateId: 'final_void', sceneKey: 'FinalVoidLevel',
        levelId: 'final_void_1', levelStateId: 'finalVoid',
        checkpoints: [
            ['final_bond_1', 'Living Systems'],
            ['final_bond_2', 'Return Route'],
            ['final_bond_3', 'Trust Marker']
        ]
    }
].map(definition => Object.freeze({
    ...definition,
    checkpoints: Object.freeze(definition.checkpoints.map(checkpoint => Object.freeze(checkpoint)))
})));

function getExpeditionCheckpointDefinition(identifier) {
    return EXPEDITION_CHECKPOINTS.find(definition =>
        definition.gateId === identifier || definition.sceneKey === identifier
    ) || null;
}

function getExpeditionCheckpointResume(gameState, gateId = null) {
    const checkpoint = gameState?.get?.('story.projectBeacon.expeditionCheckpoint');
    const definition = getExpeditionCheckpointDefinition(checkpoint?.sceneKey);
    const index = Number(checkpoint?.checkpointIndex);
    const place = definition?.checkpoints[index];
    if (
        !definition || (gateId !== null && gateId !== definition.gateId) ||
        ![1, 2].includes(checkpoint?.version) ||
        checkpoint.sceneKey !== definition.sceneKey ||
        checkpoint.levelId !== definition.levelId ||
        !Number.isInteger(index) || !place || place[0] !== checkpoint.checkpointId ||
        gameState?.get?.(`levels.${definition.levelStateId}.completed`) === true
    ) return null;

    // Match the existing numeric-save compatibility; level bounds remain the scene's job.
    if (![checkpoint.x, checkpoint.y].every(value =>
        (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
        Number.isFinite(Number(value)) && Number(value) >= 0
    )) return null;

    const mask = checkpoint.routeSignalMask;
    const validMask = Number.isInteger(mask) && mask >= 0 &&
        mask < (1 << definition.checkpoints.length) && (mask & (1 << index));
    if ((checkpoint.version === 2 || mask !== undefined) && !validMask) return null;

    return {
        gateId: definition.gateId,
        sceneKey: definition.sceneKey,
        checkpointId: place[0],
        label: place[1],
        current: validMask
            ? definition.checkpoints.filter((_, position) => mask & (1 << position)).length
            : index + 1,
        total: definition.checkpoints.length
    };
}

export { getExpeditionCheckpointDefinition, getExpeditionCheckpointResume };

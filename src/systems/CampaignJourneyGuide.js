const CAMPAIGN_ROUTE = Object.freeze([
    Object.freeze({
        gateId: 'mythical_forest',
        sceneKey: 'MythicalForestLevel',
        levelStateId: 'mythicalForest',
        completionNumber: 1,
        debriefId: 'beacon_debrief_1',
        label: 'Mythical Forest',
        action: 'Follow the living Current and rescue the Elder guardian.'
    }),
    Object.freeze({
        gateId: 'crystal_caves',
        sceneKey: 'CrystalCavesLevel',
        levelStateId: 'crystalCaves',
        completionNumber: 2,
        debriefId: 'beacon_debrief_2',
        label: 'Crystal Caves',
        action: 'Trace the shared scar beneath the crystal systems.'
    }),
    Object.freeze({
        gateId: 'stellar_reef',
        sceneKey: 'ReefLevel',
        levelStateId: 'cosmicReef',
        completionNumber: 3,
        debriefId: 'beacon_debrief_3',
        label: 'Stellar Reef',
        action: 'Restore the reef route and answer the traveller calls.'
    }),
    Object.freeze({
        gateId: 'void_peaks',
        sceneKey: 'VoidPeaksLevel',
        levelStateId: 'voidPeaks',
        completionNumber: 4,
        debriefId: 'beacon_debrief_4',
        label: 'Void Peaks',
        action: 'Cross the relays and reach the summit warning.'
    }),
    Object.freeze({
        gateId: 'aurora_depths',
        sceneKey: 'AuroraDepthsLevel',
        levelStateId: 'auroraDepths',
        completionNumber: 5,
        debriefId: 'beacon_debrief_5',
        label: 'Aurora Depths',
        action: 'Reconnect the prisms and restore the Beacon uplink.'
    }),
    Object.freeze({
        gateId: 'final_void',
        sceneKey: 'FinalVoidLevel',
        levelStateId: 'finalVoid',
        completionNumber: 6,
        debriefId: null,
        label: 'The Final Void',
        action: 'Enter the Current heart and recover the Command Module.'
    })
]);

function read(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function getCampaignRoute(identifier) {
    return CAMPAIGN_ROUTE.find(route => (
        route.gateId === identifier ||
        route.levelStateId === identifier ||
        route.sceneKey === identifier
    )) || null;
}

function getCampaignPrerequisiteState(gameState, identifier) {
    const routeIndex = CAMPAIGN_ROUTE.findIndex(route => (
        route.gateId === identifier ||
        route.levelStateId === identifier ||
        route.sceneKey === identifier
    ));
    if (routeIndex < 0) {
        return {
            knownRoute: false,
            prerequisitesMet: false,
            missingPrerequisites: [],
            nextRequiredRoute: null
        };
    }

    const missingPrerequisites = CAMPAIGN_ROUTE
        .slice(0, routeIndex)
        .filter(route => (
            read(gameState, `levels.${route.levelStateId}.completed`, false) !== true
        ));
    return {
        knownRoute: true,
        prerequisitesMet: missingPrerequisites.length === 0,
        missingPrerequisites,
        nextRequiredRoute: missingPrerequisites[0] || null
    };
}

function getCampaignJourneyStep(gameState) {
    const activeCheckpoint = read(
        gameState,
        'story.projectBeacon.expeditionCheckpoint'
    );
    if (activeCheckpoint?.sceneKey) {
        const checkpointRoute = CAMPAIGN_ROUTE.find(
            route => route.sceneKey === activeCheckpoint.sceneKey ||
                route.levelStateId === activeCheckpoint.levelStateId ||
                `levels.${route.levelStateId}` === activeCheckpoint.levelStatePath ||
                route.gateId === activeCheckpoint.gateId
        );
        const checkpointPrerequisites = checkpointRoute
            ? getCampaignPrerequisiteState(gameState, checkpointRoute.gateId)
            : null;
        if (checkpointRoute && checkpointPrerequisites.prerequisitesMet) {
            return {
                ...checkpointRoute,
                status: 'resume',
                title: `Resume ${checkpointRoute.label}`,
                action: `Rejoin at ${activeCheckpoint.label || 'the last Beacon anchor'}.`
            };
        }
    }

    const nextRoute = CAMPAIGN_ROUTE.find(route => (
        read(gameState, `levels.${route.levelStateId}.completed`, false) !== true
    ));

    if (!nextRoute) {
        return {
            gateId: null,
            levelStateId: null,
            label: 'Wanderer-77',
            status: 'complete',
            title: 'Campaign restored',
            action: 'Review the final mission record and your protected return choices.'
        };
    }

    const gate = read(gameState, `hubWorld.gates.${nextRoute.gateId}`, {});
    const prerequisiteState = getCampaignPrerequisiteState(
        gameState,
        nextRoute.gateId
    );
    const unlocked = (
        gate?.unlocked === true || nextRoute.gateId === 'mythical_forest'
    ) && prerequisiteState.prerequisitesMet;
    return {
        ...nextRoute,
        status: unlocked ? 'ready' : 'locked',
        title: unlocked ? `Next mission: ${nextRoute.label}` : `Route pending: ${nextRoute.label}`,
        action: unlocked
            ? nextRoute.action
            : prerequisiteState.nextRequiredRoute
                ? `Complete ${prerequisiteState.nextRequiredRoute.label} first.`
                : 'Complete the current expedition and review its Project Beacon debrief.'
    };
}

export {
    CAMPAIGN_ROUTE,
    getCampaignJourneyStep,
    getCampaignPrerequisiteState,
    getCampaignRoute
};

import projectBeacon from '../config/project-beacon.json';

function getList(gameState, path) {
    const value = gameState?.get(path);
    return Array.isArray(value) ? value : [];
}

export function getProjectBeaconDebrief(debriefId) {
    return projectBeacon.campaignDebriefs.find(debrief => debrief.id === debriefId) || null;
}

export function getProjectBeaconFirstExpeditionHandoff() {
    return projectBeacon.firstExpeditionHandoff || null;
}

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

/**
 * Build a spoiler-safe, player-facing snapshot of the current campaign.
 * Locked reports expose only their sequence number; their story text remains hidden.
 */
export function getProjectBeaconLog(gameState) {
    const completedQuestIds = getList(gameState, 'quests.completed');
    const collectedPartIds = getList(gameState, 'hubWorld.shipParts.collected');
    const seenDebriefIds = getList(gameState, 'story.projectBeacon.debriefsSeen');
    const pendingDebriefs = getList(gameState, 'story.projectBeacon.pendingDebriefs');
    const pendingDebriefIds = new Set(pendingDebriefs.map(entry => entry?.id).filter(Boolean));
    const currentMissionId = getValue(
        gameState,
        'story.projectBeacon.currentMission',
        null
    );
    const currentMission = projectBeacon.fieldMissions.find(
        mission => mission.id === currentMissionId
    ) || (
        currentMissionId === 'field_sequence_complete'
            ? null
            : projectBeacon.fieldMissions.find(
                mission => !completedQuestIds.includes(mission.id)
            ) || null
    );
    const systems = (projectBeacon.shipSystems || []).map(system => ({
        ...system,
        recovered: collectedPartIds.includes(system.id)
    }));
    const recoveredSystems = systems.filter(system => system.recovered).length;
    const commandModuleRecovered = collectedPartIds.includes('command_module');
    const uplinkRestored = Boolean(
        getValue(gameState, 'story.projectBeacon.uplinkRestored', false)
    );
    const endingChoice = getValue(
        gameState,
        'story.projectBeacon.endingChoice',
        null
    );
    const route = getValue(
        gameState,
        'story.projectBeacon.lastRouteUnlocked',
        null
    );
    const companionName = getValue(gameState, 'creature.name', 'Your companion');
    const bondLevel = Math.max(
        1,
        Number(getValue(gameState, 'creature.bond.level', 1)) || 1
    );

    let phase = 'FIRST CONTACT';
    let directive = currentMission
        ? currentMission.name
        : 'Follow the Rootlight route into the Mythical Forest.';
    let directiveDetail = currentMission
        ? currentMission.description
        : 'Your companion knows a path beyond the crash site.';

    if (!currentMission && recoveredSystems > 0 && recoveredSystems < systems.length) {
        phase = `RECOVERY // ${recoveredSystems} OF ${systems.length}`;
        directive = route?.label
            ? `Continue to ${route.label}.`
            : 'Recover the next Wanderer-7 system.';
        directiveDetail = 'Restore the guardian, protect the living network, and bring the ship system home.';
    } else if (!currentMission && recoveredSystems === systems.length && !commandModuleRecovered) {
        phase = 'FINAL SIGNAL LOCATED';
        directive = 'Enter the Final Void.';
        directiveDetail = 'Five living systems are aligned. Reach the source without breaking the bond network.';
    } else if (!currentMission && commandModuleRecovered && !uplinkRestored) {
        phase = 'BEACON READY';
        directive = 'Return to Wanderer-7.';
        directiveDetail = 'The ship is complete. The responsibility of Project Beacon now belongs to you.';
    } else if (!currentMission && uplinkRestored && !endingChoice) {
        phase = 'DECISION PENDING';
        directive = 'Face the Project Beacon choice.';
        directiveDetail = 'No signal leaves until you decide what the restored beacon should carry.';
    } else if (!currentMission && endingChoice) {
        phase = 'MISSION ROUTE RECORDED';
        directive = 'Project Beacon remembers your choice.';
        directiveDetail = 'Your companion remains beside you as the next chapter begins.';
    }

    const reports = projectBeacon.campaignDebriefs.map(debrief => {
        const seen = seenDebriefIds.includes(debrief.id);
        const pending = pendingDebriefIds.has(debrief.id);
        return {
            id: debrief.id,
            completionNumber: debrief.completionNumber,
            status: seen ? 'reviewed' : pending ? 'new' : 'locked',
            title: seen || pending ? debrief.title : `FIELD REPORT ${debrief.completionNumber}`,
            finding: seen || pending ? debrief.finding : null,
            companionMoment: seen || pending ? debrief.companionMoment : null,
            fieldNote: seen || pending ? debrief.fieldNote : null,
            icon: seen || pending ? debrief.icon : '·'
        };
    });
    const latestReport = [...reports].reverse().find(
        report => report.status !== 'locked'
    ) || null;

    return {
        title: projectBeacon.title,
        year: projectBeacon.year,
        phase,
        directive,
        directiveDetail,
        currentMission,
        companion: {
            name: companionName,
            bondLevel
        },
        systems,
        recoveredSystems,
        totalSystems: systems.length,
        commandModuleRecovered,
        uplinkRestored,
        endingChoice,
        reports,
        latestReport
    };
}

export function queueProjectBeaconDebrief(gameState, {
    completionNumber,
    levelId,
    shipPartId,
    completedAt = new Date().toISOString()
} = {}) {
    const debrief = projectBeacon.campaignDebriefs.find(
        entry => entry.completionNumber === completionNumber
    );

    if (!gameState || !debrief) {
        return null;
    }

    const pending = getList(gameState, 'story.projectBeacon.pendingDebriefs');
    const seen = getList(gameState, 'story.projectBeacon.debriefsSeen');
    if (seen.includes(debrief.id) || pending.some(entry => entry.id === debrief.id)) {
        return null;
    }

    const queuedDebrief = {
        id: debrief.id,
        levelId: levelId || null,
        shipPartId: shipPartId || null,
        completedAt
    };

    gameState.set('story.projectBeacon.pendingDebriefs', [...pending, queuedDebrief]);
    return queuedDebrief;
}

export function unlockProjectBeaconMilestone(gameState, completionNumber) {
    const debrief = projectBeacon.campaignDebriefs.find(
        entry => entry.completionNumber === completionNumber
    );
    const nextGate = debrief?.nextGate;
    if (!gameState || !nextGate?.id) {
        return null;
    }

    const gatePath = `hubWorld.gates.${nextGate.id}`;
    const gate = gameState.get(gatePath);
    if (!gate) {
        return null;
    }

    const newlyUnlocked = gate.unlocked !== true;
    if (newlyUnlocked) {
        gameState.set(gatePath, {
            ...gate,
            unlocked: true
        });
        gameState.set('story.projectBeacon.lastRouteUnlocked', {
            gateId: nextGate.id,
            label: nextGate.label,
            completionNumber,
            unlockedAt: new Date().toISOString()
        });
    }

    return {
        gateId: nextGate.id,
        label: nextGate.label,
        newlyUnlocked
    };
}

export function getNextProjectBeaconDebrief(gameState) {
    const pending = getList(gameState, 'story.projectBeacon.pendingDebriefs');
    if (pending.length === 0) {
        return null;
    }

    const queued = pending.find(entry => getProjectBeaconDebrief(entry.id));
    if (!queued) {
        return null;
    }
    const debrief = getProjectBeaconDebrief(queued.id);
    return { ...queued, ...debrief };
}

export function acknowledgeProjectBeaconDebrief(gameState, debriefId) {
    if (!gameState || !debriefId) {
        return false;
    }

    const pending = getList(gameState, 'story.projectBeacon.pendingDebriefs');
    const seen = getList(gameState, 'story.projectBeacon.debriefsSeen');
    const wasPending = pending.some(entry => entry.id === debriefId);
    if (!wasPending) {
        return false;
    }

    gameState.set(
        'story.projectBeacon.pendingDebriefs',
        pending.filter(entry => entry.id !== debriefId)
    );
    gameState.set(
        'story.projectBeacon.debriefsSeen',
        seen.includes(debriefId) ? seen : [...seen, debriefId]
    );
    gameState.save?.();
    return true;
}

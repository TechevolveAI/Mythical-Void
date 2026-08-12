import projectBeacon from '../config/project-beacon.json';
import { getCurrentEcologySnapshot } from './CurrentEcology.js';
import {
    formatFendCommunityObjective,
    getFendCommunitySnapshot
} from './FendCommunity.js';
import {
    formatFendResidentObjective,
    getFendResidentsSnapshot
} from './FendResidents.js';
import { getGuardianResidentsSnapshot } from './GuardianResidents.js';
import {
    formatFendCultureObjective,
    getFendCultureSnapshot
} from './FendCulture.js';
import {
    formatCompanionConsentObjective,
    getCompanionConsentSnapshot
} from './CompanionConsent.js';
import {
    formatCompanionEarthMemoryObjective,
    getCompanionEarthMemorySnapshot
} from './CompanionEarthMemory.js';
import {
    formatSenseiMemoryObjective,
    getSenseiMemorySnapshot
} from './SenseiMemory.js';
import {
    formatShipEvidenceObjective,
    getShipEvidenceSnapshot
} from './ShipEvidence.js';
import {
    formatShipReconstructionObjective,
    getShipReconstructionSnapshot
} from './ShipReconstruction.js';
import {
    formatProtectedReturnObjective,
    getProtectedReturnSnapshot
} from './ProtectedReturnProtocol.js';
import {
    formatCurrentVeilObjective,
    getCurrentVeilSnapshot
} from './CurrentVeilMission.js';
import {
    formatRemainAndDefendObjective,
    getRemainAndDefendSnapshot
} from './RemainAndDefendCampaign.js';

const CAMPAIGN_DEBRIEF_NUMBER_BY_LEVEL = Object.freeze({
    mythicalForest: 1,
    crystalCaves: 2,
    cosmicReef: 3,
    voidPeaks: 4,
    auroraDepths: 5
});

function resolveCampaignCompletionNumber(levelId, fallback = null) {
    return CAMPAIGN_DEBRIEF_NUMBER_BY_LEVEL[levelId] || fallback;
}

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
    const legacyEndingChoice = getValue(
        gameState,
        'story.projectBeacon.endingChoice',
        null
    );
    const priority = getValue(
        gameState,
        'story.projectBeacon.finale.priority',
        legacyEndingChoice === 'earth'
            ? 'prepare_homecoming'
            : legacyEndingChoice === 'void'
                ? 'remain_and_defend'
                : null
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
    const agencyHistory = getList(
        gameState,
        'creature.agencyHistory'
    );
    const autonomousRescues = agencyHistory.filter(
        entry => entry?.type === 'autonomous_rescue'
    ).length;
    const highPowerReveals = agencyHistory.filter(
        entry => entry?.type === 'high_power_rescue'
    );
    const latestHighPowerReveal = highPowerReveals[
        highPowerReveals.length - 1
    ] || null;
    const lineageRecords = getList(
        gameState,
        'breedingShrine.breedingHistory'
    ).reduce(
        (total, entry) => total + Math.max(0, Number(entry?.offspringCount) || 0),
        0
    );
    const currentEcology = getCurrentEcologySnapshot(gameState).summary;
    const fendCommunity = getFendCommunitySnapshot(gameState);
    const fendResidents = getFendResidentsSnapshot(gameState);
    const guardianResidents = getGuardianResidentsSnapshot(gameState);
    const fendCulture = getFendCultureSnapshot(gameState);
    const companionConsent = getCompanionConsentSnapshot(gameState);
    const companionEarthMemory = getCompanionEarthMemorySnapshot(gameState);
    const senseiMemory = getSenseiMemorySnapshot(gameState);
    const shipReconstruction =
        getShipReconstructionSnapshot(gameState);
    const shipEvidence = getShipEvidenceSnapshot(gameState);
    const protectedReturn = getProtectedReturnSnapshot(gameState);
    const currentVeil = getCurrentVeilSnapshot(gameState);
    const remainAndDefend = getRemainAndDefendSnapshot(gameState);

    let phase = 'FIRST CONTACT';
    let directive = currentMission
        ? currentMission.name
        : 'Follow the Rootlight route into the Mythical Forest.';
    let directiveDetail = currentMission
        ? currentMission.description
        : 'Your companion knows a path beyond the crash site.';

    if (!currentMission && senseiMemory.ready) {
        phase = `PERSONAL ARCHIVE // MEMORY ${senseiMemory.recalledCount + 1} OF ${senseiMemory.totalMemories}`;
        directive = 'Return to Wanderer-77.';
        directiveDetail = formatSenseiMemoryObjective(senseiMemory);
    } else if (!currentMission && shipReconstruction.ready) {
        phase =
            `SHIP RECONSTRUCTION // ${shipReconstruction.completedCount + 1} OF ${shipReconstruction.totalSteps}`;
        directive = 'Return to Wanderer-77.';
        directiveDetail = formatShipReconstructionObjective(
            shipReconstruction
        );
    } else if (!currentMission && shipEvidence.ready) {
        phase = `SHIP ARCHIVE // REVIEW ${shipEvidence.reviewedCount + 1} OF ${shipEvidence.totalSections}`;
        directive = 'Return to Wanderer-77.';
        directiveDetail = formatShipEvidenceObjective(shipEvidence);
    } else if (!currentMission && recoveredSystems > 0 && recoveredSystems < systems.length) {
        phase = `RECOVERY // ${recoveredSystems} OF ${systems.length}`;
        directive = route?.label
            ? `Continue to ${route.label}.`
            : 'Recover the next Wanderer-77 system.';
        directiveDetail = 'Restore the guardian, protect the living network, and bring the ship system home.';
    } else if (!currentMission && recoveredSystems === systems.length && !commandModuleRecovered) {
        phase = 'FINAL SIGNAL LOCATED';
        directive = 'Enter the Final Void.';
        directiveDetail = 'Five living systems are aligned. Reach the source without breaking the bond network.';
    } else if (!currentMission && commandModuleRecovered && !uplinkRestored) {
        phase = 'BEACON READY';
        directive = 'Return to Wanderer-77.';
        directiveDetail = 'The ship is complete. The responsibility of Project Beacon now belongs to you.';
    } else if (!currentMission && uplinkRestored && !priority) {
        phase = 'PRIORITY PENDING';
        directive = 'Choose what Wanderer-77 prepares first.';
        directiveDetail = 'Coordinates are protected and departure is deferred. No signal leaves the Fend.';
    } else if (!currentMission && priority) {
        const priorityLabels = {
            remain_and_defend: 'Defend First',
            prepare_homecoming: 'Prepare Homecoming',
            prepare_first_contact: 'Prepare Honest Contact'
        };
        phase = 'CAMPAIGN PRIORITY RECORDED';
        directive = priorityLabels[priority] || 'Remain and Defend';
        directiveDetail = 'Recovery comes first. The return vector remains sealed and no contact has been attempted.';
        if (!fendResidents.complete) {
            const resident = fendResidents.activeResident
                || fendResidents.nextResident;
            if (resident?.available) {
                phase = `FEND TRUST // ${fendResidents.completedCount} OF ${fendResidents.totalResidents}`;
                directive = resident.active
                    ? resident.request.title
                    : `Speak with ${resident.name}, ${resident.role}.`;
                directiveDetail = formatFendResidentObjective(fendResidents);
            } else if (!fendCommunity.complete) {
                phase = `FEND RECOVERY // ${fendCommunity.stage} OF ${fendCommunity.totalStages}`;
                directive = fendCommunity.nextProject?.ready
                    ? `Build ${fendCommunity.nextProject.label}.`
                    : `Prepare ${fendCommunity.nextProject?.label || 'the Living Commons'}.`;
                directiveDetail = formatFendCommunityObjective(fendCommunity);
            }
        } else if (fendCulture.ready) {
            phase = 'FEND COMMONS // FIRST LISTENING';
            directive = 'Return to the Living Commons.';
            directiveDetail = formatFendCultureObjective(fendCulture);
        } else if (companionConsent.ready) {
            phase = `EARTH BOUNDARIES // ${companionConsent.reviewedCount} OF ${companionConsent.totalTopics}`;
            directive = 'Return to Wanderer-77 with your companion.';
            directiveDetail = formatCompanionConsentObjective(
                companionConsent
            );
        } else if (protectedReturn.available && !protectedReturn.complete) {
            phase = `RETURN PROTOCOL // ${protectedReturn.completedCount} OF ${protectedReturn.totalSteps}`;
            directive = 'Return to Wanderer-77.';
            directiveDetail = formatProtectedReturnObjective(
                protectedReturn
            );
        } else if (currentVeil.available) {
            phase = 'FEND CONSEQUENCE // QUIET CURRENT';
            directive = 'Speak with Ilyra at the Fend Commons.';
            directiveDetail = formatCurrentVeilObjective(currentVeil);
        } else if (currentVeil.active) {
            phase = `QUIET CURRENT // ${currentVeil.stabilizedCount} OF ${currentVeil.totalAnchors}`;
            directive = currentVeil.nextAnchor
                ? `Stabilize ${currentVeil.nextAnchor.title}.`
                : 'Continue the Quiet Current field work.';
            directiveDetail = formatCurrentVeilObjective(currentVeil);
        } else if (currentVeil.verificationReady) {
            phase = 'QUIET CURRENT // VERIFY';
            directive = 'Return to Wanderer-77.';
            directiveDetail = formatCurrentVeilObjective(currentVeil);
        } else if (currentVeil.complete) {
            phase = 'QUIET CURRENT // VERIFIED';
            directive = 'Continue defending the Fend.';
            directiveDetail = formatCurrentVeilObjective(currentVeil);
        } else if (protectedReturn.complete) {
            phase = 'RETURN PROTOCOL // SEALED';
            directive = 'Continue defending the Fend.';
            directiveDetail = formatProtectedReturnObjective(
                protectedReturn
            );
        }
    }

    if (!currentMission && remainAndDefend.unlocked) {
        if (remainAndDefend.complete) {
            phase = 'REMAIN AND DEFEND // COMPLETE';
            directive = 'The Fend can defend together.';
        } else if (remainAndDefend.councilReady) {
            phase = 'REMAIN AND DEFEND // COMMONS COUNCIL';
            directive = 'Hold the recovery council.';
        } else {
            phase =
                `REMAIN AND DEFEND // ${remainAndDefend.completedCount} OF ` +
                `${remainAndDefend.totalPhases}`;
            directive =
                remainAndDefend.currentPhase?.label || 'Continue recovery.';
        }
        directiveDetail = formatRemainAndDefendObjective(remainAndDefend);
    }

    if (!currentMission && companionEarthMemory.ready) {
        phase = 'TWO WORLDS // EARTH QUESTION';
        directive = 'Return to Wanderer-77 with your companion.';
        directiveDetail = formatCompanionEarthMemoryObjective(
            companionEarthMemory
        );
    } else if (!currentMission && companionEarthMemory.complete) {
        phase = 'TWO WORLDS // MEMORY SHARED';
        directive = companionEarthMemory.selectedMemory?.title
            || 'Earth is no longer an abstraction.';
        directiveDetail = formatCompanionEarthMemoryObjective(
            companionEarthMemory
        );
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
        ship: projectBeacon.ship,
        phase,
        directive,
        directiveDetail,
        currentMission,
        companion: {
            name: companionName,
            bondLevel,
            autonomousRescues,
            highPowerReveals: highPowerReveals.length,
            lineageRecords
        },
        trustEvidence: latestHighPowerReveal
            ? {
                type: 'world_scale_rescue',
                powerId: latestHighPowerReveal.powerId || 'unknown',
                affinity: latestHighPowerReveal.affinity || 'unknown',
                magnitude: 'extreme',
                outcome: 'living_network_stabilized',
                witnessScope: 'five_living_systems',
                earthVisibility: 'city_scale_detectable'
            }
            : null,
        systems,
        recoveredSystems,
        totalSystems: systems.length,
        commandModuleRecovered,
        uplinkRestored,
        priority,
        currentEcology,
        fendCommunity,
        fendResidents,
        guardianResidents,
        fendCulture,
        companionConsent,
        companionEarthMemory,
        senseiMemory,
        shipEvidence,
        shipReconstruction,
        protectedReturn,
        currentVeil,
        remainAndDefend,
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
    const canonicalCompletionNumber = resolveCampaignCompletionNumber(
        levelId,
        completionNumber
    );
    const debrief = projectBeacon.campaignDebriefs.find(
        entry => entry.completionNumber === canonicalCompletionNumber
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

export function unlockProjectBeaconMilestone(gameState, levelIdOrCompletionNumber) {
    const levelId = typeof levelIdOrCompletionNumber === 'string'
        ? levelIdOrCompletionNumber
        : null;
    const completionNumber = resolveCampaignCompletionNumber(
        levelId,
        levelIdOrCompletionNumber
    );
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

    const access = gameState.getCampaignGateAccess?.(nextGate.id);
    if (access && !access.prerequisitesMet) {
        return {
            gateId: nextGate.id,
            label: nextGate.label,
            newlyUnlocked: false,
            blocked: true,
            requiredRoute: access.nextRequiredRoute
        };
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
            levelId,
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

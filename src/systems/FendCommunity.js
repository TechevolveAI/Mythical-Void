import { getCurrentEcologySnapshot } from './CurrentEcology.js';
import { normalizeSignalGardenState } from './SignalGarden.js';

export const FEND_COMMUNITY_SCHEMA_VERSION = 1;

export const FEND_COMMUNITY_PROJECTS = Object.freeze([
    Object.freeze({
        id: 'trailhead_shelter',
        label: 'FIRST LIGHT SHELTER',
        shortLabel: 'SHELTER',
        description: 'A safe trailhead for creatures displaced by the damaged Current.',
        supportLine: '+1 expedition heart',
        requirements: Object.freeze({
            gardenTends: 1,
            restoredRegions: 1
        })
    }),
    Object.freeze({
        id: 'current_well',
        label: 'CURRENT WELL',
        shortLabel: 'WELL',
        description: 'Loose energy is guided back into the living network.',
        supportLine: '+1 expedition crystal charge',
        requirements: Object.freeze({
            gardenTends: 2,
            restoredRegions: 3,
            careActions: 1
        })
    }),
    Object.freeze({
        id: 'wayfinder_relay',
        label: 'WAYFINDER RELAY',
        shortLabel: 'RELAY',
        description: 'The settlement can warn expeditions and hold a route open.',
        supportLine: 'One Fend Relay guard per expedition',
        requirements: Object.freeze({
            gardenTends: 3,
            restoredRegions: 5,
            observedSignals: 3
        })
    }),
    Object.freeze({
        id: 'living_commons',
        label: 'LIVING COMMONS',
        shortLabel: 'COMMONS',
        description: 'A shared home built around the Current, not on top of it.',
        supportLine: 'The Fend community network is established',
        requirements: Object.freeze({
            restoredRegions: 6,
            highPowerRescues: 1,
            uplinkRestored: true
        })
    })
]);

const PROJECT_BY_ID = new Map(
    FEND_COMMUNITY_PROJECTS.map(project => [project.id, project])
);
const MAX_CONTRIBUTION_HISTORY = 12;

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
}

function normalizeIdentifier(value, maxLength = 96) {
    if (typeof value !== 'string') return null;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeContributionHistory(value) {
    if (!Array.isArray(value)) return [];

    const seen = new Set();
    return value
        .map(entry => {
            const projectId = PROJECT_BY_ID.has(entry?.projectId)
                ? entry.projectId
                : null;
            const operationId = normalizeIdentifier(entry?.operationId);
            if (!projectId || !operationId || seen.has(operationId)) return null;
            seen.add(operationId);
            return {
                operationId,
                projectId,
                contributedAt: normalizeTimestamp(entry?.contributedAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_CONTRIBUTION_HISTORY);
}

export function normalizeFendCommunityState(state = {}) {
    const requestedIds = Array.isArray(state?.builtProjectIds)
        ? new Set(state.builtProjectIds.filter(id => PROJECT_BY_ID.has(id)))
        : new Set();
    const builtProjectIds = [];

    // Community projects are an ordered physical settlement, so a later stage
    // cannot exist without every earlier structure.
    for (const project of FEND_COMMUNITY_PROJECTS) {
        if (!requestedIds.has(project.id)) break;
        builtProjectIds.push(project.id);
    }

    const history = normalizeContributionHistory(state?.contributionHistory)
        .filter(entry => builtProjectIds.includes(entry.projectId));
    const firstContribution = history[0]?.contributedAt || null;
    const lastContribution = history[history.length - 1]?.contributedAt || null;

    return {
        schemaVersion: FEND_COMMUNITY_SCHEMA_VERSION,
        builtProjectIds,
        contributionHistory: history,
        foundedAt: normalizeTimestamp(state?.foundedAt) || firstContribution,
        lastContributionAt:
            normalizeTimestamp(state?.lastContributionAt) || lastContribution
    };
}

function countHighPowerRescues(gameState) {
    const agencyHistory = gameState?.get?.('creature.agencyHistory');
    const storyReveals = gameState?.get?.('story.projectBeacon.highPowerReveals');
    const agencyCount = Array.isArray(agencyHistory)
        ? agencyHistory.filter(entry => entry?.type === 'high_power_rescue').length
        : 0;
    const storyCount = Array.isArray(storyReveals) ? storyReveals.length : 0;
    return Math.max(agencyCount, storyCount);
}

export function getFendCommunityEvidence(gameState) {
    const garden = normalizeSignalGardenState(
        gameState?.get?.('world.signalGarden') || {}
    );
    const ecology = getCurrentEcologySnapshot(gameState).summary;

    return {
        gardenTends: garden.tendCount,
        restoredRegions: ecology.restoredCount,
        careActions: ecology.careActions,
        observedSignals: ecology.observedSignals,
        highPowerRescues: countHighPowerRescues(gameState),
        uplinkRestored:
            gameState?.get?.('story.projectBeacon.uplinkRestored') === true
    };
}

function compareRequirement(actual, required) {
    if (typeof required === 'boolean') return actual === required;
    return Number(actual) >= required;
}

function getMissingRequirements(project, evidence) {
    if (!project) return [];
    return Object.entries(project.requirements)
        .filter(([key, required]) => !compareRequirement(evidence[key], required))
        .map(([key, required]) => ({
            key,
            required,
            current: evidence[key]
        }));
}

function getSupportProfile(stage) {
    return {
        maxHealthBonus: stage >= 1 ? 1 : 0,
        maxEnergyBonus: stage >= 2 ? 1 : 0,
        guardCharges: stage >= 3 ? 1 : 0,
        commonsNetwork: stage >= 4
    };
}

export function getFendCommunitySnapshot(gameState) {
    const state = normalizeFendCommunityState(
        gameState?.get?.('world.fendCommunity') || {}
    );
    const evidence = getFendCommunityEvidence(gameState);
    const stage = state.builtProjectIds.length;
    const nextProject = FEND_COMMUNITY_PROJECTS[stage] || null;
    const missingRequirements = getMissingRequirements(nextProject, evidence);

    return {
        state,
        stage,
        totalStages: FEND_COMMUNITY_PROJECTS.length,
        builtProjects: state.builtProjectIds
            .map(projectId => PROJECT_BY_ID.get(projectId))
            .filter(Boolean),
        nextProject: nextProject
            ? {
                ...nextProject,
                ready: missingRequirements.length === 0,
                missingRequirements
            }
            : null,
        evidence,
        support: getSupportProfile(stage),
        complete: stage === FEND_COMMUNITY_PROJECTS.length
    };
}

export function formatFendCommunityObjective(snapshot) {
    const nextProject = snapshot?.nextProject;
    if (!nextProject) {
        return 'The Living Commons is established. The Fend can answer together.';
    }
    if (nextProject.ready) {
        return `${nextProject.label} is ready. Contribute at the Signal Garden.`;
    }

    const requirementLabels = {
        gardenTends: 'garden tends',
        restoredRegions: 'restored regions',
        careActions: 'care actions',
        observedSignals: 'living signals',
        highPowerRescues: 'creature rescue witnessed',
        uplinkRestored: 'Wanderer-77 uplink held'
    };
    const nextRequirement = nextProject.missingRequirements[0];
    if (typeof nextRequirement.required === 'boolean') {
        return `${nextProject.label}: ${requirementLabels[nextRequirement.key]}.`;
    }
    return `${nextProject.label}: ${nextRequirement.current}/${nextRequirement.required} ${requirementLabels[nextRequirement.key]}.`;
}

export function advanceFendCommunityProject(gameState, {
    contributedAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;

    const snapshot = getFendCommunitySnapshot(gameState);
    const project = snapshot.nextProject;
    if (!project) {
        return {
            changed: false,
            reason: 'community_complete',
            snapshot
        };
    }
    if (!project.ready) {
        return {
            changed: false,
            reason: 'requirements_missing',
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(
        operationId || `community:${project.id}`
    );
    const duplicate = snapshot.state.contributionHistory.some(
        entry => entry.operationId === normalizedOperationId
    );
    if (duplicate) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            snapshot
        };
    }

    const timestamp = normalizeTimestamp(contributedAt)
        || new Date().toISOString();
    const state = normalizeFendCommunityState({
        ...snapshot.state,
        builtProjectIds: [
            ...snapshot.state.builtProjectIds,
            project.id
        ],
        contributionHistory: [
            ...snapshot.state.contributionHistory,
            {
                operationId: normalizedOperationId,
                projectId: project.id,
                contributedAt: timestamp
            }
        ],
        foundedAt: snapshot.state.foundedAt || timestamp,
        lastContributionAt: timestamp
    });
    gameState.set('world.fendCommunity', state);
    if (save) gameState.save?.();
    gameState.emit?.('fendCommunityChanged', {
        type: 'project_completed',
        projectId: project.id,
        stage: state.builtProjectIds.length,
        contributedAt: timestamp
    });

    return {
        changed: true,
        reason: 'project_completed',
        project,
        state,
        snapshot: getFendCommunitySnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.FendCommunity = {
        FEND_COMMUNITY_SCHEMA_VERSION,
        FEND_COMMUNITY_PROJECTS,
        normalizeFendCommunityState,
        getFendCommunityEvidence,
        getFendCommunitySnapshot,
        formatFendCommunityObjective,
        advanceFendCommunityProject
    };
}

import { getCurrentEcologySnapshot } from './CurrentEcology.js';
import {
    formatFendCommunityObjective,
    getFendCommunitySnapshot
} from './FendCommunity.js';
import {
    formatFendResidentObjective,
    getFendResidentsSnapshot
} from './FendResidents.js';
import {
    formatFendCultureObjective,
    getFendCultureSnapshot
} from './FendCulture.js';
import {
    formatCompanionConsentObjective,
    getCompanionConsentSnapshot
} from './CompanionConsent.js';
import {
    formatSenseiMemoryObjective,
    getSenseiMemorySnapshot
} from './SenseiMemory.js';
import {
    formatShipEvidenceObjective,
    getShipEvidenceSnapshot
} from './ShipEvidence.js';
import {
    formatProtectedReturnObjective,
    getProtectedReturnSnapshot
} from './ProtectedReturnProtocol.js';
import {
    formatCurrentVeilObjective,
    getCurrentVeilSnapshot
} from './CurrentVeilMission.js';

export const REMAIN_AND_DEFEND_SCHEMA_VERSION = 1;

const CAMPAIGN_PRIORITIES = new Set([
    'remain_and_defend',
    'prepare_homecoming',
    'prepare_first_contact'
]);
const MAX_HISTORY = 4;

export const REMAIN_AND_DEFEND_PHASES = Object.freeze([
    Object.freeze({
        id: 'hold_the_line',
        number: 1,
        label: 'HOLD THE LINE',
        summary:
            'Keep the return route sealed while the six living regions recover.'
    }),
    Object.freeze({
        id: 'community_recovery',
        number: 2,
        label: 'BUILD WITH THE FEND',
        summary:
            'Build the Living Commons and answer every resident request.'
    }),
    Object.freeze({
        id: 'first_listening',
        number: 3,
        label: 'THE FIRST LISTENING',
        summary:
            'Let the Commons choose what recovery work begins first.'
    }),
    Object.freeze({
        id: 'companion_boundaries',
        number: 4,
        label: 'RECORD BOUNDARIES',
        summary:
            'Agree what Earth may learn and preserve the companion\'s veto.'
    }),
    Object.freeze({
        id: 'earth_archive',
        number: 5,
        label: 'PRESERVE THE EARTH RECORD',
        summary:
            'Recover the Sensei memories and separate survival proof from ownership.'
    }),
    Object.freeze({
        id: 'protected_return',
        number: 6,
        label: 'SEAL THE RETURN',
        summary:
            'Build a return packet that proves survival without revealing the Fend.'
    }),
    Object.freeze({
        id: 'quiet_current',
        number: 7,
        label: 'QUIET THE CURRENT',
        summary:
            'Mask the Current echo that could lead Earth back through the route.'
    }),
    Object.freeze({
        id: 'commons_council',
        number: 8,
        label: 'COMMONS COUNCIL',
        summary:
            'Confirm that the Fend can defend together before any homecoming begins.'
    })
]);

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

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const operationId = normalizeIdentifier(entry?.operationId);
            if (!operationId || seen.has(operationId)) return null;
            seen.add(operationId);
            return {
                operationId,
                type: 'chapter_completed',
                priority: CAMPAIGN_PRIORITIES.has(entry?.priority)
                    ? entry.priority
                    : 'remain_and_defend',
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

export function normalizeRemainAndDefendState(state = {}) {
    const history = normalizeHistory(state?.history);
    const completion = history[history.length - 1] || null;
    const complete = state?.status === 'complete' || Boolean(completion);

    return {
        schemaVersion: REMAIN_AND_DEFEND_SCHEMA_VERSION,
        status: complete ? 'complete' : 'not_started',
        completedAt: complete
            ? normalizeTimestamp(state?.completedAt)
                || completion?.occurredAt
                || null
            : null,
        completionOperationId: complete
            ? normalizeIdentifier(state?.completionOperationId)
                || completion?.operationId
                || null
            : null,
        priorityAtCompletion: complete
            ? (
                CAMPAIGN_PRIORITIES.has(state?.priorityAtCompletion)
                    ? state.priorityAtCompletion
                    : completion?.priority || 'remain_and_defend'
            )
            : null,
        history
    };
}

function formatCommunityRecoveryObjective(community, residents) {
    const resident = residents.activeResident || residents.nextResident;
    if (resident?.available) {
        return formatFendResidentObjective(residents);
    }
    return formatFendCommunityObjective(community);
}

function createPhaseSnapshots(context, chapterComplete) {
    const phaseCompletion = {
        hold_the_line:
            context.unlocked &&
            context.currentEcology.restoredCount >=
                context.currentEcology.totalRegions,
        community_recovery:
            context.community.complete && context.residents.complete,
        first_listening: context.culture.complete,
        companion_boundaries: context.consent.complete,
        earth_archive:
            context.senseiMemory.complete && context.shipEvidence.complete,
        protected_return: context.protectedReturn.complete,
        quiet_current: context.currentVeil.complete,
        commons_council: chapterComplete
    };
    const objectives = {
        hold_the_line: context.unlocked
            ? (
                phaseCompletion.hold_the_line
                    ? 'All six living regions are restored. The return route remains sealed.'
                    : `Restore the Current: ${context.currentEcology.restoredCount}/${context.currentEcology.totalRegions} regions.`
            )
            : 'Restore Wanderer-77, protect the coordinates, and choose what comes first.',
        community_recovery: formatCommunityRecoveryObjective(
            context.community,
            context.residents
        ),
        first_listening: formatFendCultureObjective(context.culture),
        companion_boundaries: formatCompanionConsentObjective(context.consent),
        earth_archive: !context.senseiMemory.complete
            ? formatSenseiMemoryObjective(context.senseiMemory)
            : formatShipEvidenceObjective(context.shipEvidence),
        protected_return: formatProtectedReturnObjective(
            context.protectedReturn
        ),
        quiet_current: formatCurrentVeilObjective(context.currentVeil),
        commons_council: chapterComplete
            ? 'Remain and Defend is complete. Homecoming remains a future, consent-led mission.'
            : 'Return to the Living Commons and hold the recovery council.'
    };

    let blocked = false;
    return REMAIN_AND_DEFEND_PHASES.map(phase => {
        const complete = phaseCompletion[phase.id] === true;
        let status = 'locked';
        if (!blocked && complete) {
            status = 'complete';
        } else if (!blocked) {
            status = 'current';
            blocked = true;
        }
        return {
            ...phase,
            complete,
            status,
            objective: objectives[phase.id]
        };
    });
}

export function getRemainAndDefendSnapshot(gameState) {
    const state = normalizeRemainAndDefendState(
        gameState?.get?.('story.projectBeacon.remainAndDefend') || {}
    );
    const priority = gameState?.get?.('story.projectBeacon.finale.priority');
    const uplinkRestored =
        gameState?.get?.('story.projectBeacon.uplinkRestored') === true;
    const currentEcology = getCurrentEcologySnapshot(gameState).summary;
    const community = getFendCommunitySnapshot(gameState);
    const residents = getFendResidentsSnapshot(gameState);
    const culture = getFendCultureSnapshot(gameState);
    const consent = getCompanionConsentSnapshot(gameState);
    const senseiMemory = getSenseiMemorySnapshot(gameState);
    const shipEvidence = getShipEvidenceSnapshot(gameState);
    const protectedReturn = getProtectedReturnSnapshot(gameState);
    const currentVeil = getCurrentVeilSnapshot(gameState);
    const unlocked =
        uplinkRestored && CAMPAIGN_PRIORITIES.has(priority);
    const context = {
        unlocked,
        currentEcology,
        community,
        residents,
        culture,
        consent,
        senseiMemory,
        shipEvidence,
        protectedReturn,
        currentVeil
    };
    const phases = createPhaseSnapshots(
        context,
        state.status === 'complete'
    );
    const prerequisitePhases = phases.filter(
        phase => phase.id !== 'commons_council'
    );
    const councilReady =
        unlocked && prerequisitePhases.every(phase => phase.complete);
    const currentPhase = phases.find(
        phase => phase.status === 'current'
    ) || phases[phases.length - 1];
    const completedCount = phases.filter(
        phase => phase.status === 'complete'
    ).length;

    return {
        state,
        unlocked,
        status: state.status === 'complete'
            ? 'complete'
            : councilReady
                ? 'council_ready'
                : unlocked
                    ? 'active'
                    : 'locked',
        priority: CAMPAIGN_PRIORITIES.has(priority) ? priority : null,
        phases,
        currentPhase,
        councilReady,
        complete: state.status === 'complete',
        completedCount,
        totalPhases: REMAIN_AND_DEFEND_PHASES.length,
        progressPercent: Math.round(
            (completedCount / REMAIN_AND_DEFEND_PHASES.length) * 100
        ),
        context
    };
}

export function formatRemainAndDefendObjective(snapshot) {
    if (snapshot?.complete) {
        return 'The Fend can defend together. Homecoming remains protected and unattempted.';
    }
    if (snapshot?.councilReady) {
        return 'Return to the Living Commons and hold the recovery council.';
    }
    if (snapshot?.unlocked && snapshot.currentPhase) {
        return snapshot.currentPhase.objective;
    }
    return 'Complete Project Beacon and choose what recovery work comes first.';
}

export function completeRemainAndDefendCampaign(gameState, {
    occurredAt = new Date().toISOString(),
    operationId = 'remain_and_defend:commons_council',
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getRemainAndDefendSnapshot(gameState);
    if (snapshot.complete) {
        return {
            changed: false,
            reason: 'chapter_complete',
            snapshot
        };
    }
    if (!snapshot.councilReady) {
        return {
            changed: false,
            reason: 'prerequisites_missing',
            snapshot
        };
    }

    const normalizedOperationId = normalizeIdentifier(operationId);
    if (!normalizedOperationId) {
        return {
            changed: false,
            reason: 'invalid_operation',
            snapshot
        };
    }
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const entry = {
        operationId: normalizedOperationId,
        type: 'chapter_completed',
        priority: snapshot.priority || 'remain_and_defend',
        occurredAt: timestamp
    };
    const state = normalizeRemainAndDefendState({
        ...snapshot.state,
        status: 'complete',
        completedAt: timestamp,
        completionOperationId: normalizedOperationId,
        priorityAtCompletion: entry.priority,
        history: [...snapshot.state.history, entry]
    });
    gameState.set('story.projectBeacon.remainAndDefend', state);
    if (save) gameState.save?.();
    gameState.emit?.('remainAndDefendChanged', {
        type: 'chapter_completed',
        priority: entry.priority,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: 'chapter_completed',
        state,
        snapshot: getRemainAndDefendSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.RemainAndDefendCampaign = {
        REMAIN_AND_DEFEND_SCHEMA_VERSION,
        REMAIN_AND_DEFEND_PHASES,
        normalizeRemainAndDefendState,
        getRemainAndDefendSnapshot,
        formatRemainAndDefendObjective,
        completeRemainAndDefendCampaign
    };
}

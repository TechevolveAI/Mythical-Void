import projectBeacon from '../config/project-beacon.json';
import { getCompanionConsentSnapshot } from './CompanionConsent.js';
import { getCurrentEcologySnapshot } from './CurrentEcology.js';

export const SHIP_ARCHIVE_SCHEMA_VERSION = 1;

export const SHIP_ARCHIVE_SECTIONS = Object.freeze([
    Object.freeze({
        id: 'systems',
        order: 1,
        label: 'SHIP',
        title: 'RETURN SYSTEMS',
        summary: 'What Wanderer-77 can do, what remains damaged, and what must stay sealed.'
    }),
    Object.freeze({
        id: 'evidence',
        order: 2,
        label: 'EVIDENCE',
        title: 'WHAT THE MISSION CAN PROVE',
        summary: 'Verified findings are separated from protected lives and locations.'
    }),
    Object.freeze({
        id: 'boundaries',
        order: 3,
        label: 'BOUNDARIES',
        title: 'WHAT DOES NOT LEAVE THE FEND',
        summary: 'A return capability is not permission to disclose, depart, or carry a passenger.'
    })
]);

const SECTION_BY_ID = new Map(
    SHIP_ARCHIVE_SECTIONS.map(section => [section.id, section])
);
const MAX_HISTORY = 18;

function normalizeIdentifier(value, fallback = null, maxLength = 96) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().slice(0, 40);
    return normalized || null;
}

function getValue(gameState, path, fallback = null) {
    const value = gameState?.get?.(path);
    return value === undefined || value === null ? fallback : value;
}

function getList(gameState, path) {
    const value = getValue(gameState, path, []);
    return Array.isArray(value) ? value : [];
}

function getActiveCompanionId(gameState) {
    return normalizeIdentifier(
        getValue(gameState, 'creature.genes.id', null)
            || getValue(gameState, 'creature.id', null)
            || getValue(gameState, 'creature.name', null),
        'active_companion'
    );
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map(entry => {
            const sectionId = SECTION_BY_ID.has(entry?.sectionId)
                ? entry.sectionId
                : null;
            const operationId = normalizeIdentifier(entry?.operationId);
            if (!sectionId || !operationId || seen.has(operationId)) {
                return null;
            }
            seen.add(operationId);
            return {
                operationId,
                type: 'section_reviewed',
                sectionId,
                companionId: normalizeIdentifier(entry?.companionId),
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

export function createInitialShipArchiveState() {
    return {
        schemaVersion: SHIP_ARCHIVE_SCHEMA_VERSION,
        reviewedSectionIds: [],
        firstReviewedAt: null,
        completedAt: null,
        history: []
    };
}

export function normalizeShipArchiveState(state = {}) {
    const history = normalizeHistory(state?.history);
    const reviewed = new Set(
        Array.isArray(state?.reviewedSectionIds)
            ? state.reviewedSectionIds.filter(id => SECTION_BY_ID.has(id))
            : []
    );
    history.forEach(entry => reviewed.add(entry.sectionId));
    const reviewedSectionIds = [];
    for (const section of SHIP_ARCHIVE_SECTIONS) {
        if (!reviewed.has(section.id)) break;
        reviewedSectionIds.push(section.id);
    }
    const complete =
        reviewedSectionIds.length === SHIP_ARCHIVE_SECTIONS.length;

    return {
        schemaVersion: SHIP_ARCHIVE_SCHEMA_VERSION,
        reviewedSectionIds,
        firstReviewedAt:
            normalizeTimestamp(state?.firstReviewedAt)
            || history[0]?.occurredAt
            || null,
        completedAt: complete
            ? (
                normalizeTimestamp(state?.completedAt)
                || history.find(
                    entry => entry.sectionId === 'boundaries'
                )?.occurredAt
                || null
            )
            : null,
        history
    };
}

function normalizeCapabilities(gameState) {
    const source = getValue(
        gameState,
        'story.projectBeacon.shipCapabilities',
        {}
    );
    const passengerCapacity = Math.max(
        0,
        Math.min(1, Number(source?.passengerCapacity) || 0)
    );
    const lifeSupport = [
        'not_assessed',
        'prototype_required',
        'ready'
    ].includes(source?.creatureLifeSupport)
        ? source.creatureLifeSupport
        : 'not_assessed';

    return {
        stealthDescent: source?.stealthDescent === 'repaired'
            ? 'repaired'
            : 'damaged',
        secureReturnVector: source?.secureReturnVector === 'sealed'
            ? 'sealed'
            : 'unavailable',
        manualLanding: source?.manualLanding === 'available'
            ? 'available'
            : 'unavailable',
        blackBoxProof: source?.blackBoxProof === 'recovered'
            ? 'recovered'
            : 'missing',
        passengerCapacity,
        creatureLifeSupport: lifeSupport,
        longRangeUplink: source?.longRangeUplink === 'held_exposure_risk'
            ? 'held_exposure_risk'
            : 'offline'
    };
}

function getSystemRows(gameState, capabilities) {
    const collected = new Set(
        getList(gameState, 'hubWorld.shipParts.collected')
    );
    const recoveredCount = (projectBeacon.shipSystems || []).filter(
        system => collected.has(system.id)
    ).length;
    const totalSystems = (projectBeacon.shipSystems || []).length;

    return [
        {
            id: 'recovery',
            label: 'CORE RECOVERY',
            status: `${recoveredCount}/${totalSystems}`,
            tone: recoveredCount === totalSystems ? 'ready' : 'pending',
            detail: recoveredCount === totalSystems
                ? 'Five living-world systems are aligned.'
                : 'Guardian systems still have to be recovered without damaging their habitats.'
        },
        {
            id: 'descent',
            label: 'CONCEALED DESCENT',
            status: capabilities.stealthDescent.toUpperCase(),
            tone: capabilities.stealthDescent === 'repaired'
                ? 'ready'
                : 'danger',
            detail: capabilities.stealthDescent === 'repaired'
                ? 'The ship can descend without broadcasting its signature.'
                : 'The hull signature is visible. A secret Earth landing is not safe.'
        },
        {
            id: 'navigation',
            label: 'RETURN VECTOR',
            status: capabilities.secureReturnVector.toUpperCase(),
            tone: capabilities.secureReturnVector === 'sealed'
                ? 'protected'
                : 'pending',
            detail: capabilities.secureReturnVector === 'sealed'
                ? 'The route exists only inside the navigation core. It has not been transmitted.'
                : 'No survivable return route is available.'
        },
        {
            id: 'proof',
            label: 'BLACK-BOX PROOF',
            status: capabilities.blackBoxProof.toUpperCase(),
            tone: capabilities.blackBoxProof === 'recovered'
                ? 'ready'
                : 'pending',
            detail: capabilities.blackBoxProof === 'recovered'
                ? 'Can prove the astronaut survived without revealing the Fend.'
                : 'Earth cannot yet verify the crash or survival.'
        },
        {
            id: 'passenger',
            label: 'PASSENGER SUPPORT',
            status: capabilities.passengerCapacity > 0
                ? capabilities.creatureLifeSupport
                    .replace(/_/g, ' ')
                    .toUpperCase()
                : 'NO CAPACITY',
            tone: capabilities.creatureLifeSupport === 'ready'
                ? 'ready'
                : 'pending',
            detail: capabilities.passengerCapacity > 0
                ? 'One physical place exists. A place is not an invitation or consent.'
                : 'Wanderer-77 cannot safely support another life.'
        },
        {
            id: 'uplink',
            label: 'LONG-RANGE UPLINK',
            status: capabilities.longRangeUplink === 'held_exposure_risk'
                ? 'HELD'
                : 'OFFLINE',
            tone: capabilities.longRangeUplink === 'held_exposure_risk'
                ? 'danger'
                : 'pending',
            detail: capabilities.longRangeUplink === 'held_exposure_risk'
                ? 'Activation could expose the Fend. No signal has been sent.'
                : 'Mission Control cannot be contacted.'
        }
    ];
}

function getEvidenceRows(gameState, capabilities, current) {
    const hatched = getValue(gameState, 'creature.hatched', false) === true;
    const highPowerCount = getList(
        gameState,
        'creature.agencyHistory'
    ).filter(entry => entry?.type === 'high_power_rescue').length;
    const currentVerified =
        current.careActions > 0 ||
        current.restoredCount > 0 ||
        current.observedSignals > 0;

    return [
        {
            id: 'survival',
            label: 'MISSION SURVIVAL',
            status: capabilities.blackBoxProof === 'recovered'
                ? 'VERIFIED'
                : 'INCOMPLETE',
            tone: capabilities.blackBoxProof === 'recovered'
                ? 'ready'
                : 'pending',
            detail: 'The astronaut may report survival and the crash without releasing coordinates.'
        },
        {
            id: 'current',
            label: 'THE CURRENT',
            status: currentVerified ? 'VERIFIED // PROTECTED' : 'UNCONFIRMED',
            tone: currentVerified ? 'protected' : 'pending',
            detail: currentVerified
                ? `${current.restoredCount}/${current.totalRegions} regions restored; ${current.careActions} care actions recorded.`
                : 'The scanner has not yet established an ecological network.'
        },
        {
            id: 'life',
            label: 'INTELLIGENT LIFE',
            status: hatched ? 'VERIFIED // PROTECTED' : 'UNCONFIRMED',
            tone: hatched ? 'protected' : 'pending',
            detail: hatched
                ? 'A companion is a person and witness, never evidence the astronaut owns.'
                : 'No living companion is recorded.'
        },
        {
            id: 'power',
            label: 'EXTREME POWER',
            status: highPowerCount > 0
                ? `WITNESSED ${highPowerCount}X // SENSITIVE`
                : 'NOT YET WITNESSED',
            tone: highPowerCount > 0 ? 'danger' : 'pending',
            detail: highPowerCount > 0
                ? 'On Earth, power at this scale could be detected across a city.'
                : 'No world-scale intervention is in the record.'
        }
    ];
}

function getBoundaryRows(gameState, capabilities, consent) {
    const contactAttempted = getValue(
        gameState,
        'story.projectBeacon.sensei.encryptedContact.contactAttempted',
        false
    ) === true;
    const travelStatus = (consent.record?.travelStatus || 'not_yet_asked')
        .replace(/_/g, ' ')
        .toUpperCase();
    const disclosureStatus = (consent.record?.disclosureStatus || 'withheld')
        .replace(/_/g, ' ')
        .toUpperCase();

    return [
        {
            id: 'coordinates',
            label: 'FEND COORDINATES',
            status: 'WITHHELD',
            tone: 'protected',
            detail: 'The return vector remains sealed inside Wanderer-77.'
        },
        {
            id: 'disclosure',
            label: 'COMPANION DISCLOSURE',
            status: consent.complete ? disclosureStatus : 'REVIEW REQUIRED',
            tone: consent.complete ? 'protected' : 'pending',
            detail: consent.complete
                ? 'The companion is not a sample, passenger manifest, or proof of discovery.'
                : 'Disclosure boundaries must be reviewed with the companion.'
        },
        {
            id: 'travel',
            label: 'TRAVEL DECISION',
            status: travelStatus,
            tone: ['willing', 'declined'].includes(
                consent.record?.travelStatus
            ) ? 'protected' : 'pending',
            detail: capabilities.passengerCapacity > 0
                ? 'A seat exists, but travel remains the companion\'s future choice.'
                : 'No passenger decision can be requested without safe support.'
        },
        {
            id: 'contact',
            label: 'EARTH CONTACT',
            status: contactAttempted ? 'ATTEMPT RECORDED' : 'NOT ATTEMPTED',
            tone: contactAttempted ? 'danger' : 'protected',
            detail: contactAttempted
                ? 'A contact attempt is present in the record.'
                : 'No message has been sent to Earth, NASA, Project Beacon, or the Sensei.'
        }
    ];
}

export function getShipEvidenceSnapshot(gameState) {
    const state = normalizeShipArchiveState(
        getValue(
            gameState,
            'story.projectBeacon.shipArchive',
            {}
        )
    );
    const fieldKitRecovered = getValue(
        gameState,
        'story.projectBeacon.fieldKit.recovered',
        false
    ) === true;
    const missionLogSeen = getValue(
        gameState,
        'story.projectBeacon.missionLogSeen',
        false
    ) === true;
    const levelsCompleted = Math.max(
        0,
        Number(getValue(gameState, 'stats.levelsCompleted', 0)) || 0
    );
    const recoveredShipSystems = getList(
        gameState,
        'hubWorld.shipParts.collected'
    ).length;
    const available =
        fieldKitRecovered &&
        missionLogSeen &&
        (levelsCompleted > 0 || recoveredShipSystems > 0);
    const complete =
        state.reviewedSectionIds.length === SHIP_ARCHIVE_SECTIONS.length;
    const capabilities = normalizeCapabilities(gameState);
    const current = getCurrentEcologySnapshot(gameState).summary;
    const consent = getCompanionConsentSnapshot(gameState);
    const sections = SHIP_ARCHIVE_SECTIONS.map(section => ({
        ...section,
        reviewed: state.reviewedSectionIds.includes(section.id),
        rows: section.id === 'systems'
            ? getSystemRows(gameState, capabilities)
            : section.id === 'evidence'
                ? getEvidenceRows(gameState, capabilities, current)
                : getBoundaryRows(
                    gameState,
                    capabilities,
                    consent
                )
    }));

    return {
        state,
        available,
        ready: available && !complete,
        complete,
        reviewedCount: state.reviewedSectionIds.length,
        totalSections: SHIP_ARCHIVE_SECTIONS.length,
        nextSection: sections.find(section => !section.reviewed) || null,
        sections,
        capabilities,
        current,
        consent,
        transmissionStatus: 'not_sent'
    };
}

export function formatShipEvidenceObjective(snapshot) {
    if (snapshot?.complete) {
        return 'Ship archive reviewed. No signal transmitted and travel remains undecided.';
    }
    if (snapshot?.ready) {
        return `Review Wanderer-77 ship and evidence board: ${snapshot.reviewedCount}/${snapshot.totalSections}.`;
    }
    return 'Recover the field kit and complete the first expedition.';
}

export function recordShipEvidenceSection(gameState, sectionId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const section = SECTION_BY_ID.get(sectionId);
    const snapshot = getShipEvidenceSnapshot(gameState);
    if (!section) {
        return {
            changed: false,
            reason: 'unknown_section',
            snapshot
        };
    }
    if (!snapshot.available) {
        return {
            changed: false,
            reason: 'requirements_missing',
            section,
            snapshot
        };
    }
    if (snapshot.state.reviewedSectionIds.includes(section.id)) {
        return {
            changed: false,
            reason: 'already_reviewed',
            section,
            snapshot
        };
    }
    if (snapshot.nextSection?.id !== section.id) {
        return {
            changed: false,
            reason: 'prior_section_required',
            section,
            snapshot
        };
    }

    const companionId = getActiveCompanionId(gameState);
    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `ship_archive:${companionId}:${section.id}`
    ) || `ship_archive:${companionId}:${section.id}`;
    if (
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            section,
            snapshot
        };
    }

    const nextState = normalizeShipArchiveState({
        ...snapshot.state,
        reviewedSectionIds: [
            ...snapshot.state.reviewedSectionIds,
            section.id
        ],
        firstReviewedAt:
            snapshot.state.firstReviewedAt || occurredAt,
        completedAt: section.id === 'boundaries'
            ? occurredAt
            : null,
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'section_reviewed',
                sectionId: section.id,
                companionId,
                occurredAt
            }
        ]
    });
    gameState.set(
        'story.projectBeacon.shipArchive',
        nextState
    );
    if (save) gameState.save?.();

    return {
        changed: true,
        reason: section.id === 'boundaries'
            ? 'archive_complete'
            : 'section_reviewed',
        section,
        snapshot: getShipEvidenceSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.ShipEvidence = {
        SHIP_ARCHIVE_SCHEMA_VERSION,
        SHIP_ARCHIVE_SECTIONS,
        createInitialShipArchiveState,
        normalizeShipArchiveState,
        getShipEvidenceSnapshot,
        formatShipEvidenceObjective,
        recordShipEvidenceSection
    };
}

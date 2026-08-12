export const FUSION_CONSENT_SCHEMA_VERSION = 1;
export const FUSION_CONSENT_MODE_LOCAL = 'same_save_owner';
export const FUSION_CONSENT_MODE_SHARED = 'cross_owner';
export const MAX_FUSION_CONSENT_RECORDS = 50;
const FUSION_ADULT_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export const SHARED_FUSION_BOUNDARY = Object.freeze({
    status: 'sealed',
    reason: 'protected_invitation_required',
    requires: Object.freeze([
        'keeper_a_grant',
        'keeper_b_grant',
        'companion_a_grant',
        'companion_b_grant',
        'server_invitation'
    ]),
    excludes: Object.freeze([
        'public_matchmaking',
        'open_trading',
        'player_search',
        'location_sharing'
    ])
});

function normalizeIdentifier(value, fallback = null, maxLength = 180) {
    if (typeof value !== 'string') return fallback;
    const normalized = value
        .trim()
        .replace(/[^A-Za-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    if (typeof value !== 'string') return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : null;
}

function normalizeParentIds(parentIds) {
    const ids = Array.isArray(parentIds)
        ? parentIds.map(id => normalizeIdentifier(id)).filter(Boolean)
        : [];
    return ids.length === 2 && new Set(ids).size === 2 ? ids : [];
}

function normalizeCompanionGrants(value, parentIds) {
    if (!Array.isArray(value)) return [];
    const grants = value.map(entry => ({
        creatureId: normalizeIdentifier(entry?.creatureId),
        grant: entry?.grant === 'lineage_synthesis'
            ? 'lineage_synthesis'
            : null,
        decision: entry?.decision === 'willing'
            ? 'willing'
            : null
    })).filter(entry => (
        entry.creatureId &&
        entry.grant &&
        entry.decision &&
        parentIds.includes(entry.creatureId)
    ));

    return parentIds.map(parentId => (
        grants.find(entry => entry.creatureId === parentId)
    )).filter(Boolean);
}

export function createInitialFusionConsentState() {
    return {
        schemaVersion: FUSION_CONSENT_SCHEMA_VERSION,
        records: [],
        sharedBoundary: { ...SHARED_FUSION_BOUNDARY }
    };
}

export function normalizeFusionConsentReceipt(value = {}) {
    const operationId = normalizeIdentifier(value.operationId);
    const parentIds = normalizeParentIds(value.parentIds);
    const companionGrants = normalizeCompanionGrants(
        value.companionGrants,
        parentIds
    );
    const valid = Boolean(
        operationId &&
        parentIds.length === 2 &&
        value.mode === FUSION_CONSENT_MODE_LOCAL &&
        value.scope === 'local_sanctuary' &&
        value.keeperGrant === 'confirmed' &&
        value.sharedInvitationId == null &&
        companionGrants.length === 2
    );
    if (!valid) return null;

    return {
        schemaVersion: FUSION_CONSENT_SCHEMA_VERSION,
        operationId,
        mode: FUSION_CONSENT_MODE_LOCAL,
        scope: 'local_sanctuary',
        parentIds,
        keeperGrant: 'confirmed',
        companionGrants,
        sharedInvitationId: null,
        recordedAt: normalizeTimestamp(value.recordedAt)
    };
}

export function normalizeFusionConsentState(value = {}) {
    const seen = new Set();
    const records = (Array.isArray(value.records) ? value.records : [])
        .map(normalizeFusionConsentReceipt)
        .filter(record => {
            if (!record || seen.has(record.operationId)) return false;
            seen.add(record.operationId);
            return true;
        })
        .slice(-MAX_FUSION_CONSENT_RECORDS);

    return {
        schemaVersion: FUSION_CONSENT_SCHEMA_VERSION,
        records,
        sharedBoundary: { ...SHARED_FUSION_BOUNDARY }
    };
}

export function getFusionCompanionReadiness(parent, now = Date.now()) {
    const creatureId = normalizeIdentifier(parent?.id);
    const stage = String(parent?.lifecycle?.stage || '').toLowerCase();
    const rawBirthDate = parent?.lifecycle?.birthDate ??
        parent?.hatchTime;
    const birthDate = typeof rawBirthDate === 'number'
        ? rawBirthDate
        : Date.parse(rawBirthDate);
    const legacyAdult = Boolean(
        !stage &&
        Number.isFinite(birthDate) &&
        birthDate <= now &&
        birthDate + FUSION_ADULT_AGE_MS <= now
    );
    const mood = String(parent?.mood?.current || 'steady').toLowerCase();
    const happiness = Number.isFinite(parent?.stats?.happiness)
        ? Number(parent.stats.happiness)
        : 100;
    const willing = Boolean(
        creatureId &&
        (['adult', 'elder'].includes(stage) || legacyAdult) &&
        !parent?.lifecycle?.hasDeparted &&
        !parent?.lifecycle?.departureDate &&
        !parent?.lifecycle?.isStuck &&
        !['sad', 'abandoned'].includes(mood) &&
        happiness >= 50
    );
    return {
        creatureId,
        name: String(parent?.name || 'Companion').slice(0, 20),
        willing,
        reason: willing
            ? 'approaches_willingly'
            : 'wellbeing_or_lifecycle_boundary'
    };
}

export function getFusionConsentReadiness(parents = [], now = Date.now()) {
    const normalizedParents = Array.isArray(parents)
        ? parents.slice(0, 2)
        : [];
    const parentStatuses = normalizedParents.map(
        parent => getFusionCompanionReadiness(parent, now)
    );

    return {
        ready: parentStatuses.length === 2 &&
            parentStatuses.every(parent => parent.willing),
        parents: parentStatuses,
        sharedBoundary: { ...SHARED_FUSION_BOUNDARY }
    };
}

export function createLocalFusionConsentReceipt({
    operationId,
    parents,
    recordedAt = new Date().toISOString()
} = {}) {
    const readiness = getFusionConsentReadiness(parents);
    const normalizedOperationId = normalizeIdentifier(operationId);
    if (!normalizedOperationId || !readiness.ready) {
        return null;
    }

    return normalizeFusionConsentReceipt({
        operationId: normalizedOperationId,
        mode: FUSION_CONSENT_MODE_LOCAL,
        scope: 'local_sanctuary',
        parentIds: readiness.parents.map(parent => parent.creatureId),
        keeperGrant: 'confirmed',
        companionGrants: readiness.parents.map(parent => ({
            creatureId: parent.creatureId,
            grant: 'lineage_synthesis',
            decision: 'willing'
        })),
        sharedInvitationId: null,
        recordedAt
    });
}

export function validateFusionConsentReceipt(
    receipt,
    operationId,
    parentIds
) {
    const normalized = normalizeFusionConsentReceipt(receipt);
    const expectedParents = normalizeParentIds(parentIds);
    return Boolean(
        normalized &&
        normalized.operationId === normalizeIdentifier(operationId) &&
        JSON.stringify(normalized.parentIds) ===
            JSON.stringify(expectedParents)
    );
}

export function recordLocalFusionConsent(gameState, options = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const receipt = createLocalFusionConsentReceipt(options);
    if (!receipt) return null;

    const state = normalizeFusionConsentState(
        gameState.get('breedingShrine.consent')
    );
    const existing = state.records.find(
        record => record.operationId === receipt.operationId
    );
    if (existing) return existing;

    const nextState = {
        ...state,
        records: [...state.records, receipt].slice(
            -MAX_FUSION_CONSENT_RECORDS
        )
    };
    gameState.set('breedingShrine.consent', nextState);
    gameState.emit?.('fusionConsentRecorded', {
        operationId: receipt.operationId,
        parentIds: [...receipt.parentIds],
        mode: receipt.mode
    });
    gameState.save?.();
    return receipt;
}

if (typeof window !== 'undefined') {
    window.FusionConsent = {
        FUSION_CONSENT_SCHEMA_VERSION,
        FUSION_CONSENT_MODE_LOCAL,
        FUSION_CONSENT_MODE_SHARED,
        SHARED_FUSION_BOUNDARY,
        createInitialFusionConsentState,
        normalizeFusionConsentReceipt,
        normalizeFusionConsentState,
        getFusionCompanionReadiness,
        getFusionConsentReadiness,
        createLocalFusionConsentReceipt,
        validateFusionConsentReceipt,
        recordLocalFusionConsent
    };
}

export const GUARDIAN_OUTCOMES_SCHEMA_VERSION = 1;

export const GUARDIAN_OUTCOME_TYPES = Object.freeze([
    'restored',
    'allied',
    'defeated',
    'withdrawn'
]);

export const GUARDIAN_OUTCOME_DEFINITIONS = Object.freeze([
    Object.freeze({
        guardianId: 'elder_treant',
        levelId: 'mythicalForest',
        name: 'Elder Treant',
        defaultOutcome: 'restored',
        standing: 'regional_ally',
        sanctuaryPresence: 'heart_projection',
        artwork: '/game/guardians/elder-treant.webp',
        accent: '#71E6B1',
        regionRole: 'Forest Rootwarden',
        outcomeLine: 'Restored to the forest. His roots can answer the Village Heart.'
    }),
    Object.freeze({
        guardianId: 'crystal_golem',
        levelId: 'crystalCaves',
        name: 'Crystal Guardian',
        defaultOutcome: 'restored',
        standing: 'regional_guardian',
        sanctuaryPresence: 'none',
        artwork: '/game/guardians/crystal-guardian.webp',
        accent: '#F4F4F4',
        regionRole: 'Cavern Resonance Keeper',
        outcomeLine: 'Remains in the Crystal Caves to protect the restored resonance.'
    }),
    Object.freeze({
        guardianId: 'nyxvoral',
        levelId: 'cosmicReef',
        name: "Nyx'voral",
        defaultOutcome: 'restored',
        standing: 'regional_guardian',
        sanctuaryPresence: 'none',
        artwork: '/game/guardians/nyxvoral.webp',
        accent: '#49E6D3',
        regionRole: 'Reef Passage Guardian',
        outcomeLine: 'Guards the reopened passages of the Cosmic Reef.'
    }),
    Object.freeze({
        guardianId: 'cosmic_titan',
        levelId: 'voidPeaks',
        name: 'Cosmic Titan',
        defaultOutcome: 'restored',
        standing: 'regional_guardian',
        sanctuaryPresence: 'none',
        artwork: '/game/guardians/cosmic-titan.webp',
        accent: '#DF5D5D',
        regionRole: 'Peak Warning Keeper',
        outcomeLine: 'Holds the restored warning network across the Void Peaks.'
    }),
    Object.freeze({
        guardianId: 'shadow_phoenix',
        levelId: 'auroraDepths',
        name: 'Aurora Phoenix',
        defaultOutcome: 'restored',
        standing: 'regional_guardian',
        sanctuaryPresence: 'none',
        artwork: '/game/guardians/shadow-phoenix.webp',
        accent: '#F2C14E',
        regionRole: 'Aurora Renewal Guardian',
        outcomeLine: 'Returns to the Aurora Depths as its renewal signal.'
    }),
    Object.freeze({
        guardianId: 'void_empress',
        levelId: 'finalVoid',
        name: 'Void Empress',
        defaultOutcome: 'restored',
        standing: 'regional_guardian',
        sanctuaryPresence: 'none',
        artwork: '/game/guardians/void-empress.webp',
        accent: '#8FE3CF',
        regionRole: 'Void Boundary Guardian',
        outcomeLine: 'Remains at the boundary where the living signal was restored.'
    })
]);

const OUTCOME_BY_LEVEL = new Map(
    GUARDIAN_OUTCOME_DEFINITIONS.map(definition => [definition.levelId, definition])
);
const OUTCOME_BY_GUARDIAN = new Map(
    GUARDIAN_OUTCOME_DEFINITIONS.map(definition => [definition.guardianId, definition])
);
const OUTCOME_TYPES = new Set(GUARDIAN_OUTCOME_TYPES);

function normalizeTimestamp(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim().slice(0, 40)
        : null;
}

function inferLegacyGuardianIds(gameState) {
    const storedIds = gameState?.get?.('world.guardianResidents.rescuedIds');
    const ids = new Set(Array.isArray(storedIds) ? storedIds : []);
    GUARDIAN_OUTCOME_DEFINITIONS.forEach(definition => {
        if (gameState?.get?.(`levels.${definition.levelId}.completed`) === true) {
            ids.add(definition.guardianId);
        }
    });
    return ids;
}

function normalizeRecord(value, definition) {
    if (!definition || !value || typeof value !== 'object') return null;
    const outcome = OUTCOME_TYPES.has(value.outcome)
        ? value.outcome
        : definition.defaultOutcome;
    return {
        guardianId: definition.guardianId,
        levelId: definition.levelId,
        outcome,
        standing: typeof value.standing === 'string' && value.standing
            ? value.standing.slice(0, 48)
            : definition.standing,
        sanctuaryPresence: typeof value.sanctuaryPresence === 'string'
            ? value.sanctuaryPresence.slice(0, 48)
            : definition.sanctuaryPresence,
        firstResolvedAt: normalizeTimestamp(
            value.firstResolvedAt || value.resolvedAt
        ),
        resolvedAt: normalizeTimestamp(value.resolvedAt)
    };
}

export function normalizeGuardianOutcomeState(value = {}, {
    legacyGuardianIds = []
} = {}) {
    const records = {};
    GUARDIAN_OUTCOME_DEFINITIONS.forEach(definition => {
        const stored = value?.records?.[definition.guardianId];
        const legacyResolved = legacyGuardianIds instanceof Set
            ? legacyGuardianIds.has(definition.guardianId)
            : legacyGuardianIds.includes?.(definition.guardianId);
        const record = normalizeRecord(
            stored || (legacyResolved ? {
                outcome: definition.defaultOutcome,
                standing: definition.standing,
                sanctuaryPresence: definition.sanctuaryPresence,
                firstResolvedAt: null,
                resolvedAt: null
            } : null),
            definition
        );
        if (record) records[definition.guardianId] = record;
    });
    return {
        schemaVersion: GUARDIAN_OUTCOMES_SCHEMA_VERSION,
        records,
        history: (Array.isArray(value?.history) ? value.history : [])
            .map(entry => {
                const definition = OUTCOME_BY_GUARDIAN.get(entry?.guardianId);
                if (!definition) return null;
                const record = normalizeRecord(entry, definition);
                return record ? { ...record, occurredAt: normalizeTimestamp(entry.occurredAt) } : null;
            })
            .filter(Boolean)
            .slice(-GUARDIAN_OUTCOME_DEFINITIONS.length * 2)
    };
}

export function getGuardianOutcomeSnapshot(gameState) {
    const state = normalizeGuardianOutcomeState(
        gameState?.get?.('world.guardianOutcomes') || {},
        { legacyGuardianIds: inferLegacyGuardianIds(gameState) }
    );
    const outcomes = GUARDIAN_OUTCOME_DEFINITIONS.map(definition => {
        const record = state.records[definition.guardianId] || null;
        return {
            ...definition,
            resolved: Boolean(record),
            outcome: record?.outcome || null,
            standing: record?.standing || 'unresolved',
            sanctuaryPresence: record?.sanctuaryPresence || 'none',
            firstResolvedAt: record?.firstResolvedAt || null,
            resolvedAt: record?.resolvedAt || null
        };
    });
    const resolved = outcomes.filter(outcome => outcome.resolved);
    return {
        state,
        outcomes,
        resolved,
        resolvedCount: resolved.length,
        totalGuardians: outcomes.length,
        regionalAllies: resolved.filter(outcome => (
            ['regional_ally', 'regional_guardian'].includes(outcome.standing)
        )),
        sanctuaryPresences: resolved.filter(outcome => (
            outcome.sanctuaryPresence !== 'none'
        ))
    };
}

export function recordGuardianOutcome(gameState, levelId, {
    outcome = null,
    standing = null,
    sanctuaryPresence = null,
    resolvedAt = new Date().toISOString(),
    save = true
} = {}) {
    const definition = OUTCOME_BY_LEVEL.get(levelId);
    if (!definition || !gameState?.get || !gameState?.set) return null;
    const snapshot = getGuardianOutcomeSnapshot(gameState);
    const previous = snapshot.state.records[definition.guardianId] || null;
    const nextRecord = normalizeRecord({
        outcome: OUTCOME_TYPES.has(outcome) ? outcome : definition.defaultOutcome,
        standing: standing || definition.standing,
        sanctuaryPresence: sanctuaryPresence || definition.sanctuaryPresence,
        firstResolvedAt: previous?.firstResolvedAt || resolvedAt,
        resolvedAt
    }, definition);
    const changed = !previous ||
        previous.outcome !== nextRecord.outcome ||
        previous.standing !== nextRecord.standing ||
        previous.sanctuaryPresence !== nextRecord.sanctuaryPresence;
    const state = normalizeGuardianOutcomeState({
        ...snapshot.state,
        records: {
            ...snapshot.state.records,
            [definition.guardianId]: nextRecord
        },
        history: changed
            ? [
                ...snapshot.state.history,
                { ...nextRecord, occurredAt: resolvedAt }
            ]
            : snapshot.state.history
    });
    gameState.set('world.guardianOutcomes', state);
    if (save) gameState.save?.();
    if (changed) {
        gameState.emit?.('guardianOutcomeChanged', {
            guardianId: definition.guardianId,
            levelId,
            outcome: nextRecord.outcome,
            standing: nextRecord.standing,
            sanctuaryPresence: nextRecord.sanctuaryPresence,
            resolvedAt
        });
    }
    return {
        changed,
        definition,
        record: nextRecord,
        snapshot: getGuardianOutcomeSnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.GuardianOutcomes = {
        GUARDIAN_OUTCOMES_SCHEMA_VERSION,
        GUARDIAN_OUTCOME_TYPES,
        GUARDIAN_OUTCOME_DEFINITIONS,
        normalizeGuardianOutcomeState,
        getGuardianOutcomeSnapshot,
        recordGuardianOutcome
    };
}

export default {
    GUARDIAN_OUTCOMES_SCHEMA_VERSION,
    GUARDIAN_OUTCOME_TYPES,
    GUARDIAN_OUTCOME_DEFINITIONS,
    normalizeGuardianOutcomeState,
    getGuardianOutcomeSnapshot,
    recordGuardianOutcome
};

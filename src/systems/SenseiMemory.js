import { getCurrentEcologySnapshot } from './CurrentEcology.js';

export const SENSEI_MEMORY_SCHEMA_VERSION = 1;
export const CENTERING_STANCE_DURATION_MS = 1250;

export const SENSEI_MEMORY_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'begin_with_your_footing',
        order: 1,
        title: 'THE DOJO FLOOR',
        setting: 'EARTH // BEFORE PROJECT BEACON',
        memory:
            'Before every difficult drill, Sensei made Wanderer-77 reset both feet before choosing a direction.',
        quote:
            '"When the world moves, begin with your footing."',
        relevance:
            'The suit can reseal one damaged integrity segment when the astronaut becomes still on solid ground.',
        unlockReason: 'Field kit recovered and the first mission record reviewed.',
        lessonId: 'centering_stance'
    }),
    Object.freeze({
        id: 'trust_begins_with_how_you_enter',
        order: 2,
        title: 'THE OPEN DOOR',
        setting: 'EARTH // TRAINING PARTNERS',
        memory:
            'Wanderer-77 once entered the dojo ready to prove a point. Sensei asked him to leave the answer outside and meet the room first.',
        quote:
            '"Trust begins with how you enter."',
        relevance:
            'The companion offered help before Project Beacon had language for intelligent life. Attention must come before assumption.',
        unlockReason: 'First expedition completed or companion rescue witnessed.',
        lessonId: null
    }),
    Object.freeze({
        id: 'power_is_knowing_what_not_to_take',
        order: 3,
        title: 'THE EMPTY HAND',
        setting: 'EARTH // FINAL PRE-LAUNCH PRACTICE',
        memory:
            'Sensei ended their last practice without a winning strike. The point was not what either fighter could seize, but what remained unharmed.',
        quote:
            '"Power is knowing what you could take, and choosing what you leave alive."',
        relevance:
            'The Current is not unused energy. Restraint can be an active, hopeful form of strength.',
        unlockReason: 'A Current node protected or redirected.',
        lessonId: null
    })
]);

const MEMORY_BY_ID = new Map(
    SENSEI_MEMORY_DEFINITIONS.map(memory => [memory.id, memory])
);
const MAX_HISTORY = 24;

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
            const operationId = normalizeIdentifier(entry?.operationId);
            const type = [
                'memory_recalled',
                'lesson_practiced'
            ].includes(entry?.type)
                ? entry.type
                : null;
            if (!operationId || !type || seen.has(operationId)) return null;
            const memoryId = MEMORY_BY_ID.has(entry?.memoryId)
                ? entry.memoryId
                : null;
            const lessonId = entry?.lessonId === 'centering_stance'
                ? 'centering_stance'
                : null;
            if (
                (type === 'memory_recalled' && !memoryId) ||
                (type === 'lesson_practiced' && !lessonId)
            ) {
                return null;
            }
            seen.add(operationId);
            return {
                operationId,
                type,
                memoryId,
                lessonId,
                levelId: normalizeIdentifier(entry?.levelId),
                companionId: normalizeIdentifier(entry?.companionId),
                occurredAt: normalizeTimestamp(entry?.occurredAt)
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY);
}

export function createInitialSenseiMemoryState() {
    return {
        schemaVersion: SENSEI_MEMORY_SCHEMA_VERSION,
        recalledMemoryIds: [],
        lesson: {
            id: 'centering_stance',
            status: 'locked',
            practiceCount: 0,
            firstPracticedAt: null,
            lastPracticedAt: null
        },
        history: []
    };
}

export function normalizeSenseiMemoryState(state = {}) {
    const history = normalizeHistory(state?.history);
    const recalled = new Set(
        Array.isArray(state?.recalledMemoryIds)
            ? state.recalledMemoryIds.filter(id => MEMORY_BY_ID.has(id))
            : []
    );
    history
        .filter(entry => entry.type === 'memory_recalled')
        .forEach(entry => recalled.add(entry.memoryId));
    const recalledMemoryIds = [];
    for (const memory of SENSEI_MEMORY_DEFINITIONS) {
        if (!recalled.has(memory.id)) break;
        recalledMemoryIds.push(memory.id);
    }
    const footingRecalled = recalled.has('begin_with_your_footing');
    const practiceHistory = history.filter(
        entry => entry.type === 'lesson_practiced'
    );
    const practiceCount = Math.max(
        practiceHistory.length,
        Math.min(999, Math.max(
            0,
            Math.floor(Number(state?.lesson?.practiceCount) || 0)
        ))
    );

    return {
        schemaVersion: SENSEI_MEMORY_SCHEMA_VERSION,
        recalledMemoryIds,
        lesson: {
            id: 'centering_stance',
            status: !footingRecalled
                ? 'locked'
                : practiceCount > 0
                    ? 'practiced'
                    : 'available',
            practiceCount,
            firstPracticedAt:
                normalizeTimestamp(state?.lesson?.firstPracticedAt)
                || practiceHistory[0]?.occurredAt
                || null,
            lastPracticedAt:
                normalizeTimestamp(state?.lesson?.lastPracticedAt)
                || practiceHistory[practiceHistory.length - 1]?.occurredAt
                || null
        },
        history
    };
}

function getUnlockedMemoryIds(gameState) {
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
    const agencyHistory = getValue(
        gameState,
        'creature.agencyHistory',
        []
    );
    const rescueWitnessed = Array.isArray(agencyHistory) &&
        agencyHistory.some(entry => [
            'autonomous_rescue',
            'high_power_rescue'
        ].includes(entry?.type));
    const ecology = getCurrentEcologySnapshot(gameState).summary;

    const unlocked = [];
    if (fieldKitRecovered && missionLogSeen) {
        unlocked.push('begin_with_your_footing');
    }
    if (levelsCompleted >= 1 || rescueWitnessed) {
        unlocked.push('trust_begins_with_how_you_enter');
    }
    if (ecology.careActions >= 1) {
        unlocked.push('power_is_knowing_what_not_to_take');
    }
    return unlocked;
}

export function getSenseiMemorySnapshot(gameState) {
    const state = normalizeSenseiMemoryState(
        getValue(
            gameState,
            'story.projectBeacon.sensei.memoryLedger',
            {}
        )
    );
    const unlockedIds = new Set(getUnlockedMemoryIds(gameState));
    const memories = SENSEI_MEMORY_DEFINITIONS.map(memory => ({
        ...memory,
        unlocked: unlockedIds.has(memory.id),
        recalled: state.recalledMemoryIds.includes(memory.id)
    }));
    const nextMemory = memories.find(
        memory => memory.unlocked && !memory.recalled
    ) || null;

    return {
        state,
        memories,
        nextMemory,
        ready: Boolean(nextMemory),
        complete:
            state.recalledMemoryIds.length === SENSEI_MEMORY_DEFINITIONS.length,
        recalledCount: state.recalledMemoryIds.length,
        totalMemories: SENSEI_MEMORY_DEFINITIONS.length,
        lesson: {
            ...state.lesson,
            unlocked: state.lesson.status !== 'locked',
            durationMs: CENTERING_STANCE_DURATION_MS,
            instruction:
                'After a non-lethal hit, release movement on solid ground to reseal one integrity heart. Once per expedition.'
        }
    };
}

export function formatSenseiMemoryObjective(snapshot) {
    if (snapshot?.ready) {
        return `Review ${snapshot.nextMemory.title} at Wanderer-77.`;
    }
    if (snapshot?.complete) {
        return 'All three pre-launch memories are held in the personal archive.';
    }
    return `Personal archive ${snapshot?.recalledCount || 0}/${snapshot?.totalMemories || 3}.`;
}

export function recordSenseiMemory(gameState, memoryId, {
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const memory = MEMORY_BY_ID.get(memoryId);
    const snapshot = getSenseiMemorySnapshot(gameState);
    if (!memory) {
        return { changed: false, reason: 'unknown_memory', snapshot };
    }
    const current = snapshot.memories.find(entry => entry.id === memoryId);
    if (!current?.unlocked) {
        return { changed: false, reason: 'requirements_missing', memory, snapshot };
    }
    if (current.recalled) {
        return { changed: false, reason: 'already_recalled', memory, snapshot };
    }
    if (snapshot.nextMemory?.id !== memoryId) {
        return {
            changed: false,
            reason: 'prior_memory_required',
            memory,
            snapshot
        };
    }
    const normalizedOperationId = normalizeIdentifier(
        operationId || `sensei:memory:${memoryId}`
    ) || `sensei:memory:${memoryId}`;
    if (
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return { changed: false, reason: 'duplicate_operation', memory, snapshot };
    }
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const state = normalizeSenseiMemoryState({
        ...snapshot.state,
        recalledMemoryIds: [
            ...snapshot.state.recalledMemoryIds,
            memoryId
        ],
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'memory_recalled',
                memoryId,
                lessonId: memory.lessonId,
                companionId: getActiveCompanionId(gameState),
                occurredAt: timestamp
            }
        ]
    });
    gameState.set(
        'story.projectBeacon.sensei.memoryLedger',
        state
    );
    if (save) gameState.save?.();
    gameState.emit?.('senseiMemoryChanged', {
        type: 'memory_recalled',
        memoryId,
        occurredAt: timestamp
    });

    return {
        changed: true,
        reason: memory.lessonId
            ? 'lesson_unlocked'
            : 'memory_recalled',
        memory,
        state,
        snapshot: getSenseiMemorySnapshot(gameState)
    };
}

export function recordCenteringStancePractice(gameState, {
    levelId,
    occurredAt = new Date().toISOString(),
    operationId = null,
    save = true
} = {}) {
    if (!gameState?.get || !gameState?.set) return null;
    const snapshot = getSenseiMemorySnapshot(gameState);
    if (!snapshot.lesson.unlocked) {
        return {
            changed: false,
            reason: 'lesson_locked',
            snapshot
        };
    }
    const normalizedLevelId = normalizeIdentifier(levelId, 'unknown');
    const normalizedOperationId = normalizeIdentifier(
        operationId ||
            `sensei:centering:${normalizedLevelId}:${Date.now()}`
    );
    if (
        !normalizedOperationId ||
        snapshot.state.history.some(
            entry => entry.operationId === normalizedOperationId
        )
    ) {
        return {
            changed: false,
            reason: 'duplicate_operation',
            snapshot
        };
    }
    const timestamp = normalizeTimestamp(occurredAt)
        || new Date().toISOString();
    const state = normalizeSenseiMemoryState({
        ...snapshot.state,
        lesson: {
            ...snapshot.state.lesson,
            practiceCount: snapshot.state.lesson.practiceCount + 1,
            firstPracticedAt:
                snapshot.state.lesson.firstPracticedAt || timestamp,
            lastPracticedAt: timestamp
        },
        history: [
            ...snapshot.state.history,
            {
                operationId: normalizedOperationId,
                type: 'lesson_practiced',
                lessonId: 'centering_stance',
                levelId: normalizedLevelId,
                companionId: getActiveCompanionId(gameState),
                occurredAt: timestamp
            }
        ]
    });
    gameState.set(
        'story.projectBeacon.sensei.memoryLedger',
        state
    );
    if (save) gameState.save?.();
    gameState.emit?.('senseiMemoryChanged', {
        type: 'lesson_practiced',
        lessonId: 'centering_stance',
        levelId: normalizedLevelId,
        occurredAt: timestamp
    });
    return {
        changed: true,
        reason: 'lesson_practiced',
        state,
        snapshot: getSenseiMemorySnapshot(gameState)
    };
}

if (typeof window !== 'undefined') {
    window.SenseiMemory = {
        SENSEI_MEMORY_SCHEMA_VERSION,
        CENTERING_STANCE_DURATION_MS,
        SENSEI_MEMORY_DEFINITIONS,
        createInitialSenseiMemoryState,
        normalizeSenseiMemoryState,
        getSenseiMemorySnapshot,
        formatSenseiMemoryObjective,
        recordSenseiMemory,
        recordCenteringStancePractice
    };
}

import { applyThoughtSuccess } from '../systems/ThoughtContextProgress.js';
import { copyDetachedJsonData as copy, freezeDetachedJsonData as freeze } from '../utils/DetachedJsonData.js';

// Calculation data only; no live context, setter, event, clock or save capability.
export function calculateCompletionThoughtDraft(source, levelId, now) {
    const refused = reason => Object.freeze({ status: 'unqualified', reason });
    try {
        if (source?.status !== 'captured' || !source.isCurrent()) return refused('thought_source_changed');
        const data = copy(source.data), { context, saved } = data;
        if (typeof levelId !== 'string' || !levelId || !Number.isSafeInteger(now) || now < 0 ||
            !['recentFailures', 'consecutiveFailures', 'totalAttempts', 'lastFailureTime', 'lastSuccessTime'].every(key =>
                Number.isSafeInteger(context[key]) && context[key] >= 0) || typeof context.playerStruggling !== 'boolean' ||
            (context.currentBiome !== null && typeof context.currentBiome !== 'string') ||
            (context.lastLevelId !== null && typeof context.lastLevelId !== 'string')) return refused('noncanonical_thought_input');
        applyThoughtSuccess(context, levelId, now);
        if (!source.isCurrent()) return refused('thought_source_changed');
        const change = { path: 'thoughtContext' };
        if (saved.present) change.oldValue = saved.value;
        change.newValue = context; change.timestamp = now;
        return freeze(copy({ status: 'calculated', context, writes: [{ path: 'thoughtContext', value: context }], notifications: [
            { kind: 'state', event: 'stateChanged', data: change }, { kind: 'state', event: 'changed:thoughtContext', data: context }
        ] }));
    } catch { return refused('thought_completion_unreadable'); }
}

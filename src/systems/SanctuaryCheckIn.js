const CHECK_IN_LINES = Object.freeze({
    curious: Object.freeze([
        '{name} has been comparing the Memory Garden pulse with a new light beyond the hull.',
        '{name} meets you beside a trail of carefully inspected Current motes.',
        '{name} has found a change in the clearing and waits for you to examine it together.'
    ]),
    playful: Object.freeze([
        '{name} has mapped a looping route around the landing struts and is waiting for another run.',
        '{name} has rearranged three harmless pattern stones into a pattern only they understand.',
        '{name} circles the garden once, then falls into step beside you.'
    ]),
    gentle: Object.freeze([
        '{name} waits beside the Memory Garden, keeping the smallest new growth out of the wind.',
        '{name} has stayed close to the quieter residents and meets you without leaving them behind.',
        '{name} answers your return with a calm pulse through the bond.'
    ]),
    wise: Object.freeze([
        '{name} has been listening at the edge of the Current and has something new to show you.',
        '{name} marks one change near the crash site, then waits for your reading.',
        '{name} has watched the Sanctuary complete another cycle and remembers what shifted.'
    ]),
    energetic: Object.freeze([
        '{name} has already crossed the clearing twice and is ready to move.',
        '{name} meets you at the ship ramp with a fresh route through the Sanctuary.',
        '{name} has spent the cycle testing the safe boundary and returns when you call.'
    ])
});

function cleanName(value) {
    if (typeof value !== 'string') return 'Your companion';
    const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 28);
    return cleaned || 'Your companion';
}

function getCycleLabel(hour) {
    const normalizedHour = Math.max(0, Math.min(23, Number(hour) || 0));
    if (normalizedHour < 12) return 'MORNING CYCLE';
    if (normalizedHour < 17) return 'MIDDAY CYCLE';
    return 'EVENING CYCLE';
}

function stableLineIndex(value, length) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % length;
}

export function getSanctuaryCheckInCopy({
    name,
    personalityCore = 'curious',
    hour = new Date().getHours()
} = {}) {
    const safeName = cleanName(name);
    const core = Object.prototype.hasOwnProperty.call(CHECK_IN_LINES, personalityCore)
        ? personalityCore
        : 'curious';
    const cycleLabel = getCycleLabel(hour);
    const lines = CHECK_IN_LINES[core];
    const line = lines[stableLineIndex(`${safeName}:${core}:${cycleLabel}`, lines.length)]
        .replace('{name}', safeName);

    return Object.freeze({
        title: 'SANCTUARY CHECK-IN',
        cycleLabel,
        statusLine: `${cycleLabel} // BOND LINK RESTORED`,
        line,
        personalityCore: core
    });
}

const RETURN_RESOURCE_LABELS = Object.freeze({
    food: 'FOOD',
    wood: 'WOOD',
    stone: 'STONE'
});

function getResourceGains(previousVillage, nextVillage) {
    return Object.entries(RETURN_RESOURCE_LABELS)
        .map(([id, label]) => ({
            id,
            label,
            amount: Math.max(
                0,
                Math.floor(Number(nextVillage?.resources?.[id]) || 0) -
                    Math.floor(Number(previousVillage?.resources?.[id]) || 0)
            )
        }))
        .filter(gain => gain.amount > 0);
}

function getCompletedBuildings(previousVillage, nextVillage) {
    const previousComplete = new Set(
        (previousVillage?.buildings || [])
            .filter(building => building?.status === 'complete')
            .map(building => building.id)
    );
    return (nextVillage?.buildings || []).filter(building => (
        building?.status === 'complete' && !previousComplete.has(building.id)
    ));
}

function getWorkerReturns(nextVillage, gains) {
    return gains.map(gain => {
        const building = (nextVillage?.buildings || []).find(candidate => (
            candidate?.status === 'complete' &&
            candidate?.creature &&
            candidate?.definition?.production?.resource === gain.id
        ));
        return {
            ...gain,
            creatureId: building?.creature?.id || null,
            name: cleanName(building?.creature?.name || 'Village residents'),
            plotId: building?.plotId || null,
            buildingId: building?.id || null,
            buildingLabel: building?.definition?.shortLabel || 'Village structure'
        };
    });
}

function cleanEvent(event) {
    if (!event) return null;
    const description = typeof event.result === 'string'
        ? event.result
        : typeof event.action === 'string'
            ? event.action
            : '';
    if (!description) return null;
    return {
        creatureName: cleanName(event.creatureName),
        description: description.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 120)
    };
}

/**
 * Turns offline simulation and Village reconciliation into one world-readable
 * return beat. Rendering belongs to the Sanctuary; this function only decides
 * what changed, who caused it, and what the player can do next.
 */
export function getSanctuaryReturnSummary({
    previousVillage,
    nextVillage,
    events = [],
    offlineMinutes = 0,
    companionName = 'Your companion'
} = {}) {
    const gains = getResourceGains(previousVillage, nextVillage);
    const completedBuildings = getCompletedBuildings(previousVillage, nextVillage);
    const workerReturns = getWorkerReturns(nextVillage, gains);
    const event = [...events].reverse().map(cleanEvent).find(Boolean) || null;
    const safeCompanionName = cleanName(companionName);
    const nextAction = nextVillage?.worldState?.nextAction || null;
    const changed = gains.length > 0 || completedBuildings.length > 0 || Boolean(event);
    if (!changed) return null;

    const completed = completedBuildings[0] || null;
    const namedWorkers = [...new Set(
        workerReturns
            .filter(worker => worker.creatureId)
            .map(worker => worker.name)
    )];
    const gainLine = gains
        .map(gain => `+${gain.amount} ${gain.label}`)
        .join('  ·  ');
    const actor = completed
        ? completed.creature?.name || 'The Village'
        : namedWorkers.length > 0
            ? namedWorkers.join(' + ')
            : event?.creatureName || safeCompanionName;
    const title = completed
        ? `${(completed.definition?.shortLabel || 'A NEW STRUCTURE').toUpperCase()} TOOK ROOT`
        : gains.length > 0
            ? `${actor.toUpperCase()} RETURNED`
            : `${actor.toUpperCase()} KEPT WATCH`;
    const detail = completed
        ? completed.definition?.completionCopy || 'The Sanctuary changed while you were away.'
        : gainLine || event?.description || 'The Sanctuary completed another cycle.';

    return Object.freeze({
        id: `sanctuary_return_${Math.max(0, Math.floor(Number(offlineMinutes) || 0))}`,
        offlineMinutes: Math.max(0, Number(offlineMinutes) || 0),
        actor,
        title,
        detail,
        gains,
        workerReturns,
        completedBuildings,
        event,
        nextAction: nextAction
            ? {
                type: nextAction.type || 'review',
                plotId: nextAction.plotId || null,
                label: nextAction.label || 'REVIEW THE VILLAGE',
                detail: nextAction.detail || 'Meet the residents at the Village Heart.'
            }
            : null
    });
}

export { CHECK_IN_LINES };

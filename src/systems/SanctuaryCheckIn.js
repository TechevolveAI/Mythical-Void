const CHECK_IN_LINES = Object.freeze({
    curious: Object.freeze([
        '{name} has been comparing the Signal Garden pulse with a new light beyond the hull.',
        '{name} meets you beside a trail of carefully inspected Current motes.',
        '{name} has found a change in the clearing and waits for you to examine it together.'
    ]),
    playful: Object.freeze([
        '{name} has mapped a looping route around the landing struts and is waiting for another run.',
        '{name} has rearranged three harmless signal stones into a pattern only they understand.',
        '{name} circles the garden once, then falls into step beside you.'
    ]),
    gentle: Object.freeze([
        '{name} waits beside the Signal Garden, keeping the smallest new growth out of the wind.',
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
        '{name} has spent the cycle testing the safe boundary and returns at your signal.'
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

export { CHECK_IN_LINES };

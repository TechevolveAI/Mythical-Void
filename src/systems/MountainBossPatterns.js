// Keep legacy attack identifiers for replay/test compatibility. The player sees
// three physical lessons, not four different names for the same burst.
export function nextMountainAttack(index, phase) {
    const sequence = phase >= 3
        ? ['gravityCrush', 'starRain', 'voidPunch', 'singularity']
        : ['gravityCrush', 'starRain', 'voidPunch'];
    return sequence[Math.max(0, Math.floor(index)) % sequence.length];
}

export function mountainAttackPlan(attack) {
    if (attack === 'starRain') return [{ at: 0, kind: 'groundWave' }];
    if (attack === 'voidPunch') return [
        { at: 0, kind: 'left' }, { at: 550, kind: 'right' }, { at: 1100, kind: 'left' }
    ];
    if (attack === 'singularity') return [
        { at: 0, kind: 'summit' }, { at: 260, kind: 'summit' }, { at: 1000, kind: 'groundWave' }
    ];
    return [0, 190, 380].map(at => ({ at, kind: 'summit' }));
}

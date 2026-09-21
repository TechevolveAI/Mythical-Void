// Shared geometry for the private renderer and collision checks. No decorative hitboxes.
export function getTrumptopusAttackPose(snapshot, { width, floorY }) {
    const { state, attack, progress } = snapshot;
    const homeX = width * 0.66;
    const targetX = Math.max(85, Math.min(width - 115, snapshot.targetX));
    let x = targetX, y = floorY - 175;
    let palmWidth = attack === 'closing_grasp' ? 110 : 70;
    let palmHeight = 42;
    if (state === 'ready' || state === 'phase_intro') { x = homeX; y = floorY - 205; }
    if (state === 'windup') y -= Math.sin(progress * Math.PI / 2) * 55;
    if (state === 'strike') y = floorY - 230 + 207 * progress * progress;
    if (state === 'contact' || state === 'exposed') y = floorY - 23;
    if (state === 'recoil') {
        y = floorY - 23 - Math.sin(progress * Math.PI / 2) * 207;
        x += (homeX - targetX) * progress;
    }
    if (attack === 'sweep' && !['ready', 'phase_intro'].includes(state)) {
        if (state === 'windup') { x = width - 78; y = floorY - 50 - Math.sin(progress * Math.PI) * 22; }
        if (state === 'strike') { x = width - 78 - (width - 156) * progress; y = floorY - 15; palmHeight = 26; }
        if (state === 'contact') { x = 78; y = floorY - 15; palmHeight = 26; }
        if (state === 'exposed') { x = 78; y = floorY - 23; }
        if (state === 'recoil') x = 78 + (homeX - 78) * progress;
    }
    if (state === 'banishment' || state === 'aftermath') { x = homeX; y = floorY - 245; }
    const target = { x, y: y - 31, width: palmWidth, height: 104 };
    const palm = { x, y, width: palmWidth, height: palmHeight };
    return {
        palm, target,
        hazards: snapshot.dangerous ? [palm] : [],
        alpha: state === 'banishment' ? 1 - progress : state === 'aftermath' ? 0 : 1
    };
}

export function overlapsTrumptopusHazard(body, hazards) {
    return hazards.some(({ x, y, width, height }) =>
        body.right > x - width / 2 && body.left < x + width / 2 &&
        body.bottom > y - height / 2 && body.top < y + height / 2);
}

const ease = value => value * value * (3 - 2 * value);
const mix = (from, to, amount) => from + (to - from) * amount;

// A connected motion guide for future authored layers, not finished character art.
function tentacle(palm, anchor, state, progress) {
    const tip = { x: palm.x, y: palm.y - 15 };
    const dx = tip.x - anchor.x, dy = tip.y - anchor.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normal = { x: -dy / length, y: dx / length };
    const curl = state === 'windup' ? ease(progress)
        : state === 'strike' ? 1 - ease(progress)
        : state === 'recoil' ? -0.25 * Math.sin(Math.PI * progress) : 0;
    const spine = Array.from({ length: 17 }, (_, index) => {
        const t = index / 16, u = 1 - t;
        const wave = state === 'strike' ? 12 * Math.sin(Math.PI * progress)
            * Math.exp(-(((t - (0.15 + 0.7 * progress)) / 0.16) ** 2)) : 0;
        const bend = (26 * curl + wave) * Math.sin(Math.PI * t);
        return {
            x: u ** 3 * anchor.x + 3 * u * u * t * (anchor.x - 42)
                + 3 * u * t * t * (tip.x + 42) + t ** 3 * tip.x + normal.x * bend,
            y: u ** 3 * anchor.y + 3 * u * u * t * anchor.y
                + 3 * u * t * t * (tip.y - 60) + t ** 3 * tip.y + normal.y * bend,
            width: mix(28, 22, t)
        };
    });
    const left = [], right = [];
    spine.forEach((point, index) => {
        const before = spine[Math.max(0, index - 1)], after = spine[Math.min(16, index + 1)];
        const distance = Math.max(1, Math.hypot(after.x - before.x, after.y - before.y));
        const x = -(after.y - before.y) / distance * point.width / 2;
        const y = (after.x - before.x) / distance * point.width / 2;
        left.push({ x: point.x + x, y: point.y + y });
        right.push({ x: point.x - x, y: point.y - y });
    });
    return { palm, anchor, tip, spine, outline: [...left, ...right.reverse()] };
}

// Shared geometry for the private renderer and collision checks. Only the palm damages.
export function getTrumptopusAttackPose(snapshot, { width, floorY }) {
    const { state, attack, progress } = snapshot;
    const homeX = width * 0.66;
    const targetX = Math.max(85, Math.min(width - 115, snapshot.targetX));
    const homeY = floorY - 205;
    let x = targetX, y = homeY;
    let palmWidth = attack === 'closing_grasp' ? 110 : 70;
    let palmHeight = 42;
    if (state === 'ready' || state === 'phase_intro') x = homeX;
    if (state === 'windup') {
        x = mix(homeX, targetX, ease(progress));
        y = mix(homeY, floorY - 230, ease(progress));
    }
    if (state === 'strike') y = floorY - 230 + 207 * progress * progress;
    if (state === 'contact' || state === 'exposed') y = floorY - 23;
    if (state === 'recoil') {
        y = mix(floorY - 23, homeY, ease(progress));
        x = mix(targetX, homeX, ease(progress));
    }
    if (attack === 'sweep' && !['ready', 'phase_intro'].includes(state)) {
        if (state === 'windup') {
            x = mix(homeX, width - 78, ease(progress));
            y = mix(homeY, floorY - 15, ease(progress));
            palmHeight = mix(42, 26, ease(progress));
        }
        if (state === 'strike') { x = width - 78 - (width - 156) * progress; y = floorY - 15; palmHeight = 26; }
        if (state === 'contact') { x = 78; y = floorY - 15; palmHeight = 26; }
        if (state === 'exposed') { x = 78; y = floorY - 15; palmHeight = 26; }
        if (state === 'recoil') {
            x = mix(78, homeX, ease(progress));
            y = mix(floorY - 15, homeY, ease(progress));
            palmHeight = mix(26, 42, ease(progress));
        }
    }
    if (state === 'banishment' || state === 'aftermath') { x = homeX; y = homeY; }
    const target = { x, y: y - 31, width: palmWidth, height: 104 };
    const palm = { x, y, width: palmWidth, height: palmHeight };
    const count = attack === 'closing_grasp' ? 2 : 1;
    const limbs = Array.from({ length: count }, (_, index) => tentacle({ ...palm,
        x: x + (count === 2 ? (index ? 28 : -28) : 0), width: count === 2 ? 54 : palmWidth
    }, { x: width - 28 - index * 72, y: floorY - 265 }, state, progress));
    return {
        palm, target, limbs,
        hazards: snapshot.dangerous ? [palm] : [],
        alpha: state === 'banishment' ? 1 - progress : state === 'aftermath' ? 0 : 1
    };
}

export function overlapsTrumptopusHazard(body, hazards) {
    return hazards.some(({ x, y, width, height }) =>
        body.right > x - width / 2 && body.left < x + width / 2 &&
        body.bottom > y - height / 2 && body.top < y + height / 2);
}

export const MOUNTAIN_BOSS_NAME = 'The Peak of the Mountain';

// One physical scale on every device: the climb and the painted body must agree.
export const MOUNTAIN_ASCENT = Object.freeze({
    startX: 4380, groundY: 800, stepRun: 16, stepRise: 16, stepCount: 25,
    summitX: 4780, summitY: 400, summitWidth: 420,
    faceX: 4660, faceY: 332, displayHeight: 650, originX: 0.49, originY: 0.28
});

export function mountainSteps() {
    const a = MOUNTAIN_ASCENT;
    return Array.from({ length: a.stepCount }, (_, index) => ({
        x: a.startX + index * a.stepRun,
        y: a.groundY - (index + 1) * a.stepRise,
        width: a.stepRun,
        height: (index + 1) * a.stepRise,
        id: `peak-mountain-step-${index + 1}`
    }));
}

// Applied only during collision with this staircase, never to general platforms.
export function mountainStepRise(body, step, recentlyGrounded) {
    if (!body || !step || !recentlyGrounded || body.velocity.y < -1) return 0;
    const rise = body.bottom - step.top;
    if (rise <= 0 || rise > MOUNTAIN_ASCENT.stepRise + 1) return 0;
    if (body.velocity.x <= 0 || body.right <= step.left || body.left >= step.right) return 0;
    return rise;
}

export function mountainEmitter(sprite, kind = 'summit') {
    const point = kind === 'left' ? { x: 0.13, y: 0.015 }
        : kind === 'right' ? { x: 0.885, y: 0.035 } : { x: 0.49, y: 0.10 };
    return {
        x: sprite.x + (point.x - MOUNTAIN_ASCENT.originX) * sprite.displayWidth,
        y: sprite.y + (point.y - MOUNTAIN_ASCENT.originY) * sprite.displayHeight
    };
}

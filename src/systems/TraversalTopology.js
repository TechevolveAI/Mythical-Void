const DEFAULT_PLAYER_HALF_WIDTH = 18;
const DEFAULT_PLAYER_HEIGHT = 58;
const MIN_SUPPORT_COVERAGE = 0.65;

function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSupport(support, index) {
    const body = support?.body || support;
    const width = Math.max(0, finite(body?.width, finite(support?.width)));
    const height = Math.max(0, finite(body?.height, finite(support?.height)));
    const centerX = finite(body?.center?.x, finite(support?.x));
    const centerY = finite(body?.center?.y, finite(support?.y));
    const left = finite(body?.left, centerX - width / 2);
    const right = finite(body?.right, centerX + width / 2);
    const top = finite(body?.top, centerY - height / 2);
    const bottom = finite(body?.bottom, centerY + height / 2);

    if (
        body?.enable === false ||
        support?.active === false ||
        right - left < 12 ||
        bottom - top < 4
    ) {
        return null;
    }

    const type = support?.platformType || 'solid';
    const traversalLinks = Array.isArray(support?.traversalLinks)
        ? support.traversalLinks.filter(link => typeof link === 'string' && link)
        : [];
    return {
        id: support?.traversalId || support?.name || `support-${index}`,
        index,
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        type,
        transient: type === 'collapsing' || support?.traversalTransient === true,
        traversalObstacle: type === 'wall' ||
            support?.traversalObstacle === true,
        traversalCeiling: support?.traversalCeiling === true,
        traversalOneWay: type === 'one-way' ||
            support?.traversalOneWay === true,
        traversalLinks
    };
}

function horizontalGap(from, to) {
    if (from.right < to.left) return to.left - from.right;
    if (to.right < from.left) return from.left - to.right;
    return 0;
}

function calculateJumpEnvelope({
    gravityY,
    jumpVelocity,
    playerSpeed,
    horizontalEfficiency = 0.82,
    verticalSafety = 0.95,
    edgeForgiveness = 28,
    playerAcceleration = 0.15
}) {
    const gravity = Math.max(1, Math.abs(finite(gravityY, 500)));
    const launchSpeed = Math.max(1, Math.abs(finite(jumpVelocity, -420)));
    const speed = Math.max(1, Math.abs(finite(playerSpeed, 180)));

    return {
        gravity,
        launchSpeed,
        playerSpeed: speed,
        playerAcceleration: Math.max(
            0.05,
            Math.min(1, finite(playerAcceleration, 0.15))
        ),
        horizontalEfficiency: Math.max(0.5, Math.min(1, horizontalEfficiency)),
        maxRise: (launchSpeed * launchSpeed / (2 * gravity)) * verticalSafety,
        edgeForgiveness: Math.max(0, edgeForgiveness)
    };
}

function calculateHorizontalReach(from, envelope, flightTime, playerHalfWidth) {
    const frameTime = 1 / 60;
    const runway = Math.max(
        0,
        finite(from?.width, finite(from?.right) - finite(from?.left)) -
            playerHalfWidth * 2
    );
    let velocity = 0;
    let runupDistance = 0;

    // Model a standing start across the available support before takeoff. This
    // is intentionally stricter than carrying momentum between every jump.
    for (let frame = 0; frame < 240 && runupDistance < runway; frame += 1) {
        velocity += (envelope.playerSpeed - velocity) *
            envelope.playerAcceleration;
        runupDistance += velocity * frameTime;
    }

    let airborneDistance = 0;
    const airborneFrames = Math.max(1, Math.ceil(flightTime / frameTime));
    for (let frame = 0; frame < airborneFrames; frame += 1) {
        velocity += (envelope.playerSpeed - velocity) *
            envelope.playerAcceleration;
        airborneDistance += velocity * frameTime;
    }

    return airborneDistance * envelope.horizontalEfficiency +
        envelope.edgeForgiveness;
}

function trajectoryIsClear(from, to, envelope, obstacles, {
    playerHalfWidth,
    playerHeight,
    flightTime,
    startX,
    endX,
    apexX = null
}) {
    if (!Array.isArray(obstacles) || obstacles.length === 0) return true;

    const startY = from.top - playerHeight / 2;
    const samples = Math.max(12, Math.ceil(flightTime * 60));
    const apexRatio = Math.min(
        0.9,
        Math.max(0.1, (envelope.launchSpeed / envelope.gravity) / flightTime)
    );
    let previousBottom = from.top;

    for (let sample = 1; sample < samples; sample += 1) {
        const ratio = sample / samples;
        const time = flightTime * ratio;
        const x = Number.isFinite(apexX)
            ? ratio <= apexRatio
                ? startX + (apexX - startX) * (ratio / apexRatio)
                : apexX + (endX - apexX) *
                    ((ratio - apexRatio) / (1 - apexRatio))
            : startX + (endX - startX) * ratio;
        const y = startY - envelope.launchSpeed * time +
            0.5 * envelope.gravity * time * time;
        const left = x - playerHalfWidth;
        const right = x + playerHalfWidth;
        const top = y - playerHeight / 2;
        const bottom = y + playerHeight / 2;

        for (const obstacle of obstacles) {
            if (obstacle === from || obstacle === to || obstacle.transient) continue;
            const oneWay = obstacle.type === 'one-way' ||
                obstacle.traversalOneWay === true;
            const blocksArc = oneWay ||
                obstacle.type === 'solid' ||
                obstacle.type === 'wall' ||
                obstacle.traversalObstacle === true ||
                obstacle.traversalCeiling === true;
            if (!blocksArc) continue;
            const horizontalOverlap = right > obstacle.left + 2 &&
                left < obstacle.right - 2;
            if (!horizontalOverlap) continue;

            if (oneWay) {
                const descending = bottom >= previousBottom;
                if (
                    descending &&
                    previousBottom <= obstacle.top + 2 &&
                    bottom > obstacle.top + 2
                ) {
                    return false;
                }
                continue;
            }

            if (bottom > obstacle.top + 2 && top < obstacle.bottom - 2) {
                return false;
            }
        }
        previousBottom = bottom;
    }
    return true;
}

function canTraverseSupport(from, to, envelope, {
    obstacles = [],
    playerHalfWidth = DEFAULT_PLAYER_HALF_WIDTH,
    playerHeight = DEFAULT_PLAYER_HEIGHT
} = {}) {
    if (from === to) return false;

    const verticalDelta = to.top - from.top;
    const rise = Math.max(0, -verticalDelta);
    if (rise > envelope.maxRise) return false;

    const discriminant = envelope.launchSpeed ** 2 +
        2 * envelope.gravity * verticalDelta;
    if (discriminant < 0) return false;

    const flightTime = (
        envelope.launchSpeed + Math.sqrt(discriminant)
    ) / envelope.gravity;
    const reach = calculateHorizontalReach(
        from,
        envelope,
        flightTime,
        playerHalfWidth
    );
    if (horizontalGap(from, to) > reach) return false;

    const insetRange = support => {
        const left = support.left + playerHalfWidth;
        const right = support.right - playerHalfWidth;
        const center = (support.left + support.right) / 2;
        if (left > right) return [center];
        return [...new Set([left, center, right])];
    };
    const launchPoints = insetRange(from);
    const landingPoints = insetRange(to);
    const detours = obstacles
        .filter(obstacle => (
            obstacle !== from &&
            obstacle !== to &&
            !obstacle.transient
        ))
        .flatMap(obstacle => [
            obstacle.left - playerHalfWidth - 4,
            obstacle.right + playerHalfWidth + 4
        ]);

    return launchPoints.some(startX => landingPoints.some(endX => {
        const directDistance = Math.abs(endX - startX);
        if (
            directDistance <= reach &&
            trajectoryIsClear(from, to, envelope, obstacles, {
                playerHalfWidth,
                playerHeight,
                flightTime,
                startX,
                endX
            })
        ) {
            return true;
        }

        return detours.some(apexX => (
            Math.abs(apexX - startX) + Math.abs(endX - apexX) <= reach &&
            trajectoryIsClear(from, to, envelope, obstacles, {
                playerHalfWidth,
                playerHeight,
                flightTime,
                startX,
                endX,
                apexX
            })
        ));
    }));
}

function findSpawnSupport(supports, spawn, playerHalfWidth) {
    const x = finite(spawn?.x);
    const y = finite(spawn?.y);
    const underPlayer = supports
        .filter(support => (
            support.right >= x - playerHalfWidth &&
            support.left <= x + playerHalfWidth &&
            support.top >= y - 30
        ))
        .sort((a, b) => a.top - b.top);

    if (underPlayer.length) return underPlayer[0];

    return supports
        .map(support => ({
            support,
            distance: horizontalGap(
                { left: x - playerHalfWidth, right: x + playerHalfWidth },
                support
            ) + Math.max(0, support.top - y) * 0.35
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.support || null;
}

function normalizeTarget(target, index) {
    const body = target?.zone?.body || target?.body || null;
    const x = finite(target?.x, finite(target?.zone?.x));
    const y = finite(target?.y, finite(target?.zone?.y));
    const width = Math.max(80, finite(body?.width, finite(target?.width, 160)));
    const height = Math.max(100, finite(body?.height, finite(target?.height, 210)));

    return {
        id: target?.id || `target-${index}`,
        label: typeof target?.label === 'string'
            ? target.label
            : target?.label?.text || target?.id || `Target ${index + 1}`,
        index,
        x,
        y,
        left: finite(body?.left, x - width / 2),
        right: finite(body?.right, x + width / 2),
        top: finite(body?.top, y - height / 2),
        bottom: finite(body?.bottom, y + height / 2),
        optional: target?.optional === true || target?.required === false
    };
}

function supportCanReachTarget(support, target, envelope, {
    playerHeight,
    playerHalfWidth
}) {
    const targetHorizontal = {
        left: target.left - playerHalfWidth,
        right: target.right + playerHalfWidth
    };
    const gap = horizontalGap(support, targetHorizontal);
    const activationTop = target.top - playerHeight;
    const activationBottom = target.bottom + playerHeight;

    if (
        gap === 0 &&
        support.top >= activationTop &&
        support.top <= activationBottom
    ) {
        return true;
    }

    const targetRise = Math.max(0, support.top - activationBottom);
    return gap <= Math.min(220, envelope.playerSpeed * 0.85) &&
        targetRise <= envelope.maxRise;
}

function buildTraversalAdjacency(supports, envelope, {
    playerHalfWidth,
    playerHeight
}) {
    const adjacency = supports.map(() => []);
    supports.forEach((from, fromIndex) => {
        supports.forEach((to, toIndex) => {
            if (canTraverseSupport(from, to, envelope, {
                obstacles: supports,
                playerHalfWidth,
                playerHeight
            })) {
                adjacency[fromIndex].push(toIndex);
            }
        });
    });
    const supportIndexById = new Map(
        supports.map((support, index) => [support.id, index])
    );
    supports.forEach((support, fromIndex) => {
        support.traversalLinks.forEach(targetId => {
            const targetIndex = supportIndexById.get(targetId);
            if (
                targetIndex != null &&
                targetIndex !== fromIndex &&
                !adjacency[fromIndex].includes(targetIndex)
            ) {
                adjacency[fromIndex].push(targetIndex);
            }
        });
    });
    return adjacency;
}

function reachableFrom(adjacency, frontier) {
    const reachable = new Set(frontier);
    const queue = [...frontier];
    while (queue.length) {
        const supportIndex = queue.shift();
        adjacency[supportIndex].forEach(nextIndex => {
            if (reachable.has(nextIndex)) return;
            reachable.add(nextIndex);
            queue.push(nextIndex);
        });
    }
    return reachable;
}

function shortestPath(adjacency, frontier, destinations) {
    const queue = [...frontier];
    const previous = new Map(queue.map(index => [index, null]));
    let destination = queue.find(index => destinations.has(index));

    while (destination == null && queue.length) {
        const current = queue.shift();
        for (const next of adjacency[current]) {
            if (previous.has(next)) continue;
            previous.set(next, current);
            if (destinations.has(next)) {
                destination = next;
                break;
            }
            queue.push(next);
        }
    }
    if (destination == null) return [];

    const path = [];
    for (let current = destination; current != null; current = previous.get(current)) {
        path.unshift(current);
    }
    return path;
}

function analyzeOrderedTargetFlow({
    supports,
    targets,
    adjacency,
    envelope,
    spawnSupportIndex,
    spawnX,
    playerHeight,
    playerHalfWidth
}) {
    let orderedFrontier = new Set([spawnSupportIndex]);
    let orderedRouteBroken = false;
    let previousTargetX = finite(spawnX);
    let requiredJumpCount = 0;
    let maxSegmentJumps = 0;
    let backtrackDistance = 0;

    const targetResults = targets.map(target => {
        const orderedReachable = reachableFrom(adjacency, orderedFrontier);
        const reachableSupports = supports.filter(support => (
            orderedReachable.has(support.index) &&
            supportCanReachTarget(support, target, envelope, {
                playerHeight,
                playerHalfWidth
            })
        ));
        const reachable = !orderedRouteBroken && reachableSupports.length > 0;
        const destinationIndices = new Set(
            reachableSupports.map(support => support.index)
        );
        const path = reachable
            ? shortestPath(adjacency, orderedFrontier, destinationIndices)
            : [];
        const jumpCount = Math.max(0, path.length - 1);
        if (!target.optional) {
            const expectedDirection = target.x >= previousTargetX ? 1 : -1;
            for (let index = 1; index < path.length; index += 1) {
                const from = supports[path[index - 1]];
                const to = supports[path[index]];
                const delta = (
                    (to.left + to.right) - (from.left + from.right)
                ) / 2;
                if (delta * expectedDirection < 0) {
                    backtrackDistance += Math.abs(delta);
                }
            }
        }

        if (reachable && !target.optional) {
            orderedFrontier = new Set(path.length ? [path.at(-1)] : []);
            requiredJumpCount += jumpCount;
            maxSegmentJumps = Math.max(maxSegmentJumps, jumpCount);
        } else if (!reachable && !target.optional) {
            orderedRouteBroken = true;
            orderedFrontier = new Set();
        }
        if (!target.optional) previousTargetX = target.x;

        return {
            id: target.id,
            label: target.label,
            optional: target.optional,
            reachable,
            supportIds: reachableSupports.slice(0, 5).map(support => support.id),
            jumpCount,
            pathSupportIds: path.map(index => supports[index].id)
        };
    });

    return {
        targetResults,
        requiredJumpCount,
        maxSegmentJumps,
        backtrackDistance: Math.round(backtrackDistance),
        passed: targetResults
            .filter(target => !target.optional)
            .every(target => target.reachable),
        optionalPassed: targetResults
            .filter(target => target.optional)
            .every(target => target.reachable)
    };
}

/**
 * Audits authored static support geometry against the level movement profile.
 * Safety margins ensure a frame-perfect maximum jump is reported as unsafe.
 */
function analyzeTraversalTopology({
    supports: rawSupports = [],
    targets: rawTargets = [],
    spawn,
    movement,
    playerHalfWidth = DEFAULT_PLAYER_HALF_WIDTH,
    playerHeight = DEFAULT_PLAYER_HEIGHT
} = {}) {
    const normalizedSupports = rawSupports
        .map(normalizeSupport)
        .filter(Boolean);
    const transientSupportIds = normalizedSupports
        .filter(support => support.transient)
        .map(support => support.id);
    const supports = normalizedSupports
        .filter(support => !support.transient)
        .map((support, index) => ({ ...support, index }));
    const targets = rawTargets.map(normalizeTarget);
    const envelope = calculateJumpEnvelope(movement || {});
    const spawnSupport = findSpawnSupport(supports, spawn, playerHalfWidth);

    if (!spawnSupport) {
        return {
            passed: false,
            reason: 'no-spawn-support',
            envelope,
            supportCount: supports.length,
            reachableSupportCount: 0,
            coverage: 0,
            unreachableTargets: targets.map(target => target.id),
            targets: []
        };
    }

    const adjacency = buildTraversalAdjacency(supports, envelope, {
        playerHalfWidth,
        playerHeight
    });
    const allReachable = reachableFrom(adjacency, [spawnSupport.index]);
    const routeFlow = analyzeOrderedTargetFlow({
        supports,
        targets,
        adjacency,
        envelope,
        spawnSupportIndex: spawnSupport.index,
        spawnX: spawn?.x,
        playerHeight,
        playerHalfWidth
    });
    const targetResults = routeFlow.targetResults;
    const unreachableTargets = targetResults
        .filter(target => !target.reachable)
        .map(target => target.id);
    const coverage = supports.length ? allReachable.size / supports.length : 0;

    const finalTarget = targets.at(-1);
    const finalSupportIndices = new Set(
        finalTarget
            ? supports.filter(support => supportCanReachTarget(
                support,
                finalTarget,
                envelope,
                { playerHeight, playerHalfWidth }
            )).map(support => support.index)
            : []
    );
    const reverseAdjacency = supports.map(() => []);
    adjacency.forEach((nextIndices, fromIndex) => {
        nextIndices.forEach(toIndex => reverseAdjacency[toIndex].push(fromIndex));
    });
    const canReachFinal = reachableFrom(reverseAdjacency, finalSupportIndices);
    const strandingSupportIds = finalTarget
        ? supports.filter(support => (
            allReachable.has(support.index) &&
            !canReachFinal.has(support.index)
        )).map(support => support.id)
        : [];
    const strandingSupportCount = strandingSupportIds.length;

    const comfortEnvelope = calculateJumpEnvelope({
        ...(movement || {}),
        jumpVelocity: finite(movement?.jumpVelocity, -420) * 0.9,
        playerSpeed: finite(movement?.playerSpeed, 180) * 0.9,
        horizontalEfficiency: 0.76,
        verticalSafety: 0.9,
        edgeForgiveness: 20
    });
    const comfortAdjacency = buildTraversalAdjacency(supports, comfortEnvelope, {
        playerHalfWidth,
        playerHeight
    });
    const comfortFlow = analyzeOrderedTargetFlow({
        supports,
        targets,
        adjacency: comfortAdjacency,
        envelope: comfortEnvelope,
        spawnSupportIndex: spawnSupport.index,
        spawnX: spawn?.x,
        playerHeight,
        playerHalfWidth
    });
    const uncomfortableTargetIds = comfortFlow.targetResults
        .filter(target => !target.optional && !target.reachable)
        .map(target => target.id);
    const uncomfortableOptionalTargetIds = comfortFlow.targetResults
        .filter(target => target.optional && !target.reachable)
        .map(target => target.id);

    return {
        passed: unreachableTargets.length === 0 &&
            coverage >= MIN_SUPPORT_COVERAGE &&
            strandingSupportCount === 0,
        reason: unreachableTargets.length
            ? 'unreachable-targets'
            : coverage < MIN_SUPPORT_COVERAGE
                ? 'isolated-supports'
                : strandingSupportCount
                    ? 'stranded-supports'
                : 'connected',
        envelope,
        spawnSupportId: spawnSupport.id,
        supportCount: supports.length,
        reachableSupportCount: allReachable.size,
        coverage,
        confidence: 'static-regression-guard',
        transientSupportIds,
        unreachableSupportIds: supports
            .filter(support => !allReachable.has(support.index))
            .map(support => support.id),
        unreachableTargets,
        targets: targetResults,
        flow: {
            requiredJumpCount: routeFlow.requiredJumpCount,
            maxSegmentJumps: routeFlow.maxSegmentJumps,
            backtrackDistance: routeFlow.backtrackDistance,
            strandingSupportIds,
            strandingSupportCount,
            comfortPassed: comfortFlow.passed,
            uncomfortableTargetIds,
            optionalComfortPassed: comfortFlow.optionalPassed,
            uncomfortableOptionalTargetIds
        }
    };
}

export {
    analyzeTraversalTopology,
    calculateJumpEnvelope,
    canTraverseSupport
};

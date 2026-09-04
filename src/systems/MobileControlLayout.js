const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseInset = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function getSafeAreaInsets(root = document.documentElement) {
    const style = getComputedStyle(root);
    const viewport = typeof window !== 'undefined'
        ? window.mobileViewportController?.getSnapshot?.()
        : null;
    return {
        top: Math.max(
            parseInset(style.getPropertyValue('--sat')),
            Number(viewport?.offsetTop) || 0
        ),
        right: Math.max(
            parseInset(style.getPropertyValue('--sar')),
            Number(viewport?.rightOcclusion) || 0
        ),
        bottom: Math.max(
            parseInset(style.getPropertyValue('--sab')),
            viewport?.keyboardOpen ? 0 : Number(viewport?.bottomOcclusion) || 0
        ),
        left: Math.max(
            parseInset(style.getPropertyValue('--sal')),
            Number(viewport?.offsetLeft) || 0
        )
    };
}

/**
 * Convert a screen-space touch into a stable joystick vector and thumb point.
 * Keeping this calculation pure prevents Phaser drag coordinates from
 * competing with absolute pointer coordinates on touch browsers.
 */
export function getJoystickVector({
    pointerX,
    pointerY,
    centerX,
    centerY,
    maxDistance,
    deadZone = 0.15
}) {
    const x = Number(pointerX);
    const y = Number(pointerY);
    const originX = Number(centerX);
    const originY = Number(centerY);
    const radius = Number(maxDistance);
    const normalizedDeadZone = Math.min(0.5, Math.max(0, Number(deadZone) || 0));

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(originX) ||
        !Number.isFinite(originY) ||
        !Number.isFinite(radius) ||
        radius <= 0
    ) {
        return { x: 0, y: 0, thumbX: originX || 0, thumbY: originY || 0 };
    }

    const offsetX = x - originX;
    const offsetY = y - originY;
    const distance = Math.hypot(offsetX, offsetY);
    if (distance === 0) {
        return { x: 0, y: 0, thumbX: originX, thumbY: originY };
    }

    const clampedDistance = Math.min(distance, radius);
    const unitX = offsetX / distance;
    const unitY = offsetY / distance;
    const deadZonePixels = radius * normalizedDeadZone;
    const effectiveRange = Math.max(1, radius - deadZonePixels);
    const magnitude = distance <= deadZonePixels
        ? 0
        : Math.min(1, (clampedDistance - deadZonePixels) / effectiveRange);

    return {
        x: unitX * magnitude,
        y: unitY * magnitude,
        thumbX: originX + unitX * clampedDistance,
        thumbY: originY + unitY * clampedDistance
    };
}

/**
 * Shared portrait-phone control geometry.
 *
 * All controls stay inside the dock. The camera offset establishes a stable
 * gameplay boundary while split control shelves leave a quiet window into the
 * world between movement and action controls.
 */
export function getMobileControlLayout({
    width,
    height,
    safeArea = { top: 0, right: 0, bottom: 0, left: 0 }
}) {
    const compact = width < 380;
    const edge = compact ? 8 : 10;
    const dockHeight = clamp(Math.round(width * 0.31), 112, 128);
    const dockTop = Math.max(0, height - safeArea.bottom - dockHeight);
    const rowGap = compact ? 8 : 10;
    const secondarySize = compact ? 42 : 46;
    const primarySize = compact ? 48 : 52;
    const maxSize = primarySize;
    const rightX = width - safeArea.right - edge - maxSize / 2;
    const leftX = rightX - maxSize - rowGap;
    const topY = dockTop + edge + maxSize / 2;
    const bottomY = height - safeArea.bottom - edge - maxSize / 2;
    const joystickRadius = compact ? 44 : 48;
    const joystickX = safeArea.left + edge + joystickRadius;
    const leftShelfRight = Math.round(Math.min(
        width * 0.47,
        joystickX + joystickRadius + (compact ? 30 : 34)
    ));
    const rightShelfLeft = Math.round(Math.max(
        width * 0.53,
        leftX - primarySize / 2 - (compact ? 10 : 12)
    ));

    return {
        compact,
        edge,
        dockHeight,
        dockTop,
        dockBottom: height - safeArea.bottom,
        safeArea,
        secondarySize,
        primarySize,
        rowGap,
        visualShelf: {
            style: 'split-current-shelf',
            top: dockTop + 4,
            leftRight: leftShelfRight,
            rightLeft: rightShelfLeft,
            centerGapWidth: Math.max(0, rightShelfLeft - leftShelfRight)
        },
        joystick: {
            x: joystickX,
            y: dockTop + dockHeight / 2,
            radius: joystickRadius,
            thumbRadius: compact ? 20 : 22,
            maxDistance: joystickRadius - 7,
            zoneWidth: Math.min(width * 0.46, 190),
            zoneHeight: dockHeight
        },
        actions: {
            leftX,
            rightX,
            topY,
            bottomY
        },
        menu: {
            x: safeArea.left + edge + 25,
            y: Math.max(34, safeArea.top + 25)
        }
    };
}

/**
 * Keep contextual gameplay guidance in the playable viewport, immediately
 * above the opaque mobile control dock and clear of device safe areas.
 */
export function getMobileInteractionPromptLayout({
    width,
    height,
    safeArea = { top: 0, right: 0, bottom: 0, left: 0 }
}) {
    const controls = getMobileControlLayout({ width, height, safeArea });
    const compact = width < 380;
    const horizontalInset = compact ? 10 : 12;
    const dockGap = compact ? 8 : 10;

    return {
        x: width / 2,
        y: Math.max(safeArea.top + 64, controls.dockTop - dockGap),
        originY: 1,
        maxWidth: Math.max(
            180,
            width - safeArea.left - safeArea.right - horizontalInset * 2
        ),
        fontSize: compact ? 13 : 14,
        dockTop: controls.dockTop
    };
}

/**
 * Keep campaign objectives out of the status cluster on narrow phones while
 * preserving the familiar top-right position on landscape and desktop.
 */
export function getCampaignObjectiveLayout({
    width,
    height,
    safeArea = { top: 0, right: 0, bottom: 0, left: 0 }
}) {
    const portraitPhone = width <= 480 && height >= width;
    const shortLandscape = width > height && height < 620;
    const compact = portraitPhone || shortLandscape || height < 620;
    const inset = width < 380 ? 10 : 12;

    if (portraitPhone) {
        const contentLeft = safeArea.left + inset;
        const contentRight = width - safeArea.right - inset;
        return {
            compact,
            mode: 'portrait',
            x: (contentLeft + contentRight) / 2,
            y: Math.max(82, safeArea.top + 76),
            originX: 0.5,
            originY: 0,
            align: 'center',
            maxWidth: Math.max(200, contentRight - contentLeft - 20),
            fontSize: width < 380 ? 11 : 12
        };
    }

    const right = safeArea.right + (compact ? 12 : 20);
    return {
        compact,
        mode: shortLandscape ? 'landscape' : 'desktop',
        x: width - right,
        y: shortLandscape ? Math.max(12, safeArea.top + 8) : 20,
        originX: 1,
        originY: 0,
        align: 'left',
        maxWidth: shortLandscape
            ? clamp(Math.round(width * 0.38), 220, 320)
            : clamp(Math.round(width * 0.3), 300, 350),
        fontSize: compact ? 12 : 15
    };
}

/**
 * Position measured campaign-entry blocks without assuming wrapped text has a
 * fixed height. Preferred whitespace contracts before content can collide.
 */
export function getCampaignEntryStackLayout({
    top,
    bottom,
    itemHeights = [],
    gaps = 8,
    topPadding = 18,
    bottomPadding = 18,
    minGap = 4
}) {
    const safeTop = Number.isFinite(Number(top)) ? Number(top) : 0;
    const safeBottom = Number.isFinite(Number(bottom))
        ? Math.max(safeTop, Number(bottom))
        : safeTop;
    const availableHeight = safeBottom - safeTop;
    const safeTopPadding = clamp(Number(topPadding) || 0, 0, availableHeight);
    const safeBottomPadding = clamp(
        Number(bottomPadding) || 0,
        0,
        Math.max(0, availableHeight - safeTopPadding)
    );
    const innerTop = safeTop + safeTopPadding;
    const innerHeight = Math.max(
        0,
        availableHeight - safeTopPadding - safeBottomPadding
    );
    const heights = itemHeights.map((height) => (
        Number.isFinite(Number(height)) ? Math.max(0, Number(height)) : 0
    ));
    const gapCount = Math.max(0, heights.length - 1);
    const gapValueAt = (index) => (
        Array.isArray(gaps) ? gaps[index] : gaps
    );
    const preferredGaps = Array.from({ length: gapCount }, (_, index) => {
        const value = Number(gapValueAt(index));
        return Number.isFinite(value) ? Math.max(0, value) : 8;
    });
    const minimumGap = Number.isFinite(Number(minGap))
        ? Math.max(0, Number(minGap))
        : 0;
    const minimumGaps = preferredGaps.map((gap) => Math.min(gap, minimumGap));
    const itemHeight = heights.reduce((total, height) => total + height, 0);
    const preferredGapHeight = preferredGaps.reduce((total, gap) => total + gap, 0);
    const minimumGapHeight = minimumGaps.reduce((total, gap) => total + gap, 0);
    const gapBudget = Math.max(0, innerHeight - itemHeight);

    let resolvedGaps = preferredGaps;
    if (minimumGapHeight > gapBudget && minimumGapHeight > 0) {
        const scale = gapBudget / minimumGapHeight;
        resolvedGaps = minimumGaps.map((gap) => gap * scale);
    } else if (preferredGapHeight > gapBudget && preferredGapHeight > minimumGapHeight) {
        const interpolation = clamp(
            (gapBudget - minimumGapHeight) / (preferredGapHeight - minimumGapHeight),
            0,
            1
        );
        resolvedGaps = preferredGaps.map((gap, index) => (
            minimumGaps[index] + (gap - minimumGaps[index]) * interpolation
        ));
    }

    const resolvedGapHeight = resolvedGaps.reduce((total, gap) => total + gap, 0);
    const usedHeight = itemHeight + resolvedGapHeight;
    const leadingSpace = Math.max(0, (innerHeight - usedHeight) / 2);
    const positions = [];
    let cursor = innerTop + leadingSpace;

    heights.forEach((height, index) => {
        positions.push(cursor);
        cursor += height + (resolvedGaps[index] || 0);
    });

    return {
        positions,
        gaps: resolvedGaps,
        usedHeight,
        innerTop,
        innerBottom: innerTop + innerHeight,
        overflow: Math.max(0, usedHeight - innerHeight)
    };
}

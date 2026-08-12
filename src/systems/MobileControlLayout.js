const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseInset = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function getSafeAreaInsets(root = document.documentElement) {
    const style = getComputedStyle(root);
    return {
        top: parseInset(style.getPropertyValue('--sat')),
        right: parseInset(style.getPropertyValue('--sar')),
        bottom: parseInset(style.getPropertyValue('--sab')),
        left: parseInset(style.getPropertyValue('--sal'))
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
 * All controls stay inside the dock. The world can continue rendering behind it,
 * but the opaque dock and camera offset establish a stable gameplay boundary.
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
        joystick: {
            x: safeArea.left + edge + joystickRadius,
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

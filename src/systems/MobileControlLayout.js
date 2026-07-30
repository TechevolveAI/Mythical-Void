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


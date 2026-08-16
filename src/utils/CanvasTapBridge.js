function containsPoint(bounds, x, y) {
    if (!bounds || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    return x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height;
}

/**
 * Adds a native canvas release fallback for critical Phaser touch targets.
 * iOS can occasionally miss a Game Object release after a DOM-to-canvas scene
 * handoff, while the native canvas event still arrives.
 */
export function createCanvasTapBridge({
    canvas,
    getGameSize,
    getBounds,
    onActivate,
    dedupeMs = 300,
    now = () => performance.now()
}) {
    let lastActivationAt = Number.NEGATIVE_INFINITY;
    let destroyed = false;

    const activateGamePoint = (x, y, event = null) => {
        if (destroyed || !containsPoint(getBounds?.(), x, y)) return false;

        const activatedAt = now();
        if (activatedAt - lastActivationAt < dedupeMs) return true;
        lastActivationAt = activatedAt;
        event?.preventDefault?.();
        onActivate?.();
        return true;
    };

    const activateClientPoint = (clientX, clientY, event) => {
        const rect = canvas?.getBoundingClientRect?.();
        const size = getGameSize?.();
        if (
            !rect ||
            rect.width <= 0 ||
            rect.height <= 0 ||
            !Number.isFinite(size?.width) ||
            !Number.isFinite(size?.height)
        ) {
            return false;
        }
        return activateGamePoint(
            (clientX - rect.left) * (size.width / rect.width),
            (clientY - rect.top) * (size.height / rect.height),
            event
        );
    };

    const pointerUpHandler = event => {
        activateClientPoint(event.clientX, event.clientY, event);
    };
    const touchEndHandler = event => {
        Array.from(event.changedTouches || []).some(touch => (
            activateClientPoint(touch.clientX, touch.clientY, event)
        ));
    };

    canvas?.addEventListener?.('pointerup', pointerUpHandler, {
        capture: true,
        passive: false
    });
    canvas?.addEventListener?.('touchend', touchEndHandler, {
        capture: true,
        passive: false
    });

    return {
        activateGamePoint,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            canvas?.removeEventListener?.('pointerup', pointerUpHandler, true);
            canvas?.removeEventListener?.('touchend', touchEndHandler, true);
        }
    };
}

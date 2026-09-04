const MOBILE_KEYBOARD_MINIMUM = 140;

function finiteDimension(value, fallback = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0
        ? Math.floor(numeric)
        : fallback;
}

class MobileViewportController {
    constructor({ windowRef = window, documentRef = document } = {}) {
        this.windowRef = windowRef;
        this.documentRef = documentRef;
        this.snapshot = null;
        this.listeners = [];
        this.attached = false;
        this.update = this.update.bind(this);
    }

    read() {
        const win = this.windowRef;
        const viewport = win.visualViewport;
        const layoutWidth = finiteDimension(
            win.innerWidth || this.documentRef?.documentElement?.clientWidth
        );
        const layoutHeight = finiteDimension(
            win.innerHeight || this.documentRef?.documentElement?.clientHeight
        );
        const visualWidth = finiteDimension(viewport?.width, layoutWidth);
        const visualHeight = finiteDimension(viewport?.height, layoutHeight);
        const offsetLeft = Math.max(0, Number(viewport?.offsetLeft) || 0);
        const offsetTop = Math.max(0, Number(viewport?.offsetTop) || 0);
        const rightOcclusion = Math.max(
            0,
            layoutWidth - visualWidth - offsetLeft
        );
        const bottomOcclusion = Math.max(
            0,
            layoutHeight - visualHeight - offsetTop
        );
        const coarsePointer = Boolean(win.matchMedia?.('(pointer: coarse)')?.matches);
        const touchCapable = Number(win.navigator?.maxTouchPoints) > 0 ||
            'ontouchstart' in win;
        const isMobile = coarsePointer || touchCapable ||
            /Android|iPhone|iPad|iPod|CriOS|FxiOS/i.test(
                win.navigator?.userAgent || ''
            );
        const keyboardOpen = isMobile &&
            bottomOcclusion >= MOBILE_KEYBOARD_MINIMUM &&
            visualHeight <= layoutHeight * 0.82;

        return Object.freeze({
            layoutWidth,
            layoutHeight,
            visualWidth,
            visualHeight,
            offsetLeft,
            offsetTop,
            rightOcclusion,
            bottomOcclusion,
            keyboardOpen,
            isMobile,
            orientation: layoutWidth > layoutHeight ? 'landscape' : 'portrait'
        });
    }

    applyCss(snapshot) {
        const root = this.documentRef?.documentElement;
        if (!root?.style) return;
        root.style.setProperty('--mvw', `${snapshot.visualWidth}px`);
        root.style.setProperty('--mvh', `${snapshot.visualHeight}px`);
        root.style.setProperty('--mvo-top', `${snapshot.offsetTop}px`);
        root.style.setProperty('--mvo-right', `${snapshot.rightOcclusion}px`);
        root.style.setProperty('--mvo-bottom', `${snapshot.bottomOcclusion}px`);
        root.style.setProperty('--mvo-left', `${snapshot.offsetLeft}px`);
        root.dataset.keyboardOpen = snapshot.keyboardOpen ? 'true' : 'false';
    }

    update() {
        this.snapshot = this.read();
        this.applyCss(this.snapshot);
        try {
            this.windowRef.dispatchEvent?.(new CustomEvent(
                'mythical:viewportchange',
                { detail: this.snapshot }
            ));
        } catch (error) {
            // Older test environments may not provide CustomEvent.
        }
        return this.snapshot;
    }

    getSnapshot() {
        return this.snapshot || this.update();
    }

    attach() {
        if (this.attached) return this.getSnapshot();
        this.attached = true;
        const targets = [
            [this.windowRef, 'resize'],
            [this.windowRef, 'orientationchange'],
            [this.windowRef, 'pageshow'],
            [this.windowRef.visualViewport, 'resize'],
            [this.windowRef.visualViewport, 'scroll']
        ];
        targets.forEach(([target, type]) => {
            if (!target?.addEventListener) return;
            target.addEventListener(type, this.update, { passive: true });
            this.listeners.push([target, type]);
        });
        return this.update();
    }

    destroy() {
        this.listeners.forEach(([target, type]) => {
            target.removeEventListener?.(type, this.update);
        });
        this.listeners = [];
        this.attached = false;
    }
}

if (typeof window !== 'undefined') {
    window.MobileViewportController = MobileViewportController;
    window.mobileViewportController = window.mobileViewportController ||
        new MobileViewportController();
    window.mobileViewportController.attach();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileViewportController;
}

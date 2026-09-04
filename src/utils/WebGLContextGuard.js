/**
 * Keeps transient mobile WebGL context loss from leaving the game on a blank canvas.
 * Browsers normally restore the context themselves; this guard makes that state visible
 * and reloads only when restoration has genuinely stalled.
 */
class WebGLContextGuard {
    constructor({ restoreTimeoutMs = 8000 } = {}) {
        this.restoreTimeoutMs = restoreTimeoutMs;
        this.canvas = null;
        this.reloadTimer = null;
        this.onLost = this.handleLost.bind(this);
        this.onRestored = this.handleRestored.bind(this);
    }

    attach(canvas) {
        if (!canvas || this.canvas === canvas) return;
        this.detach();
        this.canvas = canvas;
        canvas.addEventListener('webglcontextlost', this.onLost, false);
        canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    }

    detach() {
        if (this.canvas) {
            this.canvas.removeEventListener('webglcontextlost', this.onLost, false);
            this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false);
        }
        clearTimeout(this.reloadTimer);
        this.reloadTimer = null;
        this.canvas = null;
        this.removeNotice();
    }

    handleLost(event) {
        event.preventDefault();
        this.showNotice();
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => {
            if (typeof window !== 'undefined') window.location.reload();
        }, this.restoreTimeoutMs);
    }

    handleRestored() {
        clearTimeout(this.reloadTimer);
        this.reloadTimer = null;
        this.removeNotice();
    }

    showNotice() {
        if (typeof document === 'undefined' || document.getElementById('game-render-recovery')) return;
        const notice = document.createElement('div');
        notice.id = 'game-render-recovery';
        notice.className = 'game-render-recovery';
        notice.setAttribute('role', 'status');
        notice.textContent = 'Restoring the world...';
        document.body.appendChild(notice);
    }

    removeNotice() {
        if (typeof document === 'undefined') return;
        document.getElementById('game-render-recovery')?.remove();
    }
}

if (typeof window !== 'undefined') {
    window.WebGLContextGuard = WebGLContextGuard;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLContextGuard;
}

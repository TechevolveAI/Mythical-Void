const DEFAULT_TONE = 0x71E6B1;

const distanceBetween = (left, right) => Math.hypot(
    Number(left?.x || 0) - Number(right?.x || 0),
    Number(left?.y || 0) - Number(right?.y || 0)
);

/**
 * Owns Sanctuary interaction attention so overlapping landmarks cannot each
 * publish a prompt, icon, and pulse at the same time.
 */
export default class SanctuaryInteractionDirector {
    constructor(scene) {
        this.scene = scene;
        this.candidates = new Map();
        this.active = null;
        this.indicator = null;
        this.indicatorTween = null;
    }

    offer(candidate) {
        if (!candidate?.id || !candidate?.target) return null;
        this.candidates.set(candidate.id, {
            priority: 0,
            tone: DEFAULT_TONE,
            icon: '✋',
            ...candidate
        });
        return this.update({ force: true });
    }

    withdraw(id) {
        this.candidates.delete(id);
        return this.update({ force: this.active?.id === id });
    }

    resolve() {
        const player = this.scene?.player;
        if (!player || this.candidates.size === 0) return null;

        return [...this.candidates.values()]
            .filter(candidate => candidate.target?.active !== false)
            .map(candidate => {
                const presentation = typeof candidate.presentation === 'function'
                    ? candidate.presentation()
                    : null;
                return {
                    ...candidate,
                    ...(presentation || {}),
                    distance: distanceBetween(player, candidate.target)
                };
            })
            .sort((left, right) => {
                const distanceDelta = left.distance - right.distance;
                if (Math.abs(distanceDelta) > 26) return distanceDelta;
                return right.priority - left.priority;
            })[0] || null;
    }

    update({ force = false } = {}) {
        const next = this.resolve();
        const changed = next?.id !== this.active?.id ||
            next?.message !== this.active?.message ||
            next?.icon !== this.active?.icon ||
            next?.tone !== this.active?.tone;
        this.active = next;
        this.scene.sanctuaryPromptOwnerId = next?.id || null;

        if (!next) {
            this.clearIndicator();
            this.scene.mobileControls?.updateInteractIcon('✋');
            return null;
        }

        if (changed || force) {
            this.scene.showInteractionHint(next.message, {
                persistent: true,
                ownerId: next.id
            });
            this.scene.mobileControls?.updateInteractIcon(next.icon);
            this.renderIndicator(next);
        }
        return next;
    }

    activate() {
        const candidate = this.update();
        if (!candidate || typeof candidate.action !== 'function') return false;
        candidate.action();
        return true;
    }

    renderIndicator(candidate) {
        this.clearIndicator();
        if (this.scene.sanctuaryPresentationMode === 'story') return;

        const target = candidate.target;
        const width = Math.max(58, Math.min(144, Number(target.width || 88)));
        const height = Math.max(28, Math.min(72, Number(target.height || 46) * 0.42));
        const indicator = this.scene.add.graphics()
            .setPosition(target.x, target.y + Math.min(42, height * 0.45))
            .setDepth(Math.max(2, Number(target.depth || target.y) - 2));
        indicator.fillStyle(candidate.tone, 0.1);
        indicator.fillEllipse(0, 0, width, height);
        indicator.lineStyle(2, candidate.tone, 0.72);
        indicator.strokeEllipse(0, 0, width, height);
        this.indicator = indicator;
        this.indicatorTween = this.scene.tweens.add({
            targets: indicator,
            alpha: { from: 0.62, to: 1 },
            scaleX: { from: 0.98, to: 1.04 },
            scaleY: { from: 0.98, to: 1.04 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    clearIndicator() {
        this.indicatorTween?.stop?.();
        this.indicatorTween = null;
        this.indicator?.destroy?.();
        this.indicator = null;
    }

    destroy() {
        this.clearIndicator();
        this.candidates.clear();
        this.active = null;
        if (this.scene) this.scene.sanctuaryPromptOwnerId = null;
        this.scene = null;
    }
}

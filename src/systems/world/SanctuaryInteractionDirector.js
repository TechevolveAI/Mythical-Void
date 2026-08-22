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
        this.beacon = null;
        this.indicatorElements = [];
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
            next?.tone !== this.active?.tone ||
            next?.verb !== this.active?.verb ||
            next?.label !== this.active?.label ||
            next?.hintMode !== this.active?.hintMode;
        this.active = next;
        this.scene.sanctuaryPromptOwnerId = next?.id || null;

        if (!next) {
            this.clearIndicator();
            this.scene.mobileControls?.updateInteractIcon('✋');
            return null;
        }

        if (changed || force) {
            if (next.hintMode === 'world') {
                this.scene.hideInteractionHint?.();
            } else {
                this.scene.showInteractionHint(next.message, {
                    persistent: true,
                    ownerId: next.id
                });
            }
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
        const depth = Math.max(2, Number(target.depth || target.y));
        const indicator = this.scene.add.graphics()
            .setPosition(target.x, target.y + Math.min(42, height * 0.45))
            .setDepth(depth - 2)
            .setData('sanctuaryInteractionBeacon', true)
            .setData('interactionId', candidate.id)
            .setData('interactionState', 'approach')
            .setData('ariaLabel', candidate.ariaLabel || candidate.message);
        indicator.fillStyle(candidate.tone, 0.08);
        indicator.fillEllipse(0, 0, width, height);
        indicator.lineStyle(2, candidate.tone, 0.76);
        indicator.strokeEllipse(0, 0, width, height);
        indicator.lineStyle(1, 0xF4F4F4, 0.34);
        indicator.strokeEllipse(0, 0, width * 0.72, height * 0.62);

        const elements = [indicator];
        if (candidate.verb || candidate.label) {
            const beaconY = target.y - Math.max(
                70,
                Math.min(118, Number(target.height || 80) * 0.55 + 34)
            );
            const beacon = this.scene.add.graphics()
                .setPosition(target.x, beaconY)
                .setDepth(depth + 14)
                .setData('sanctuaryInteractionBeacon', true)
                .setData('interactionId', candidate.id)
                .setData('interactionVerb', candidate.verb || '')
                .setData('interactionLabel', candidate.label || '')
                .setData('touchTargetWidth', 164)
                .setData('touchTargetHeight', 52);
            beacon.fillStyle(0x071411, 0.9);
            beacon.fillCircle(-58, 0, 18);
            beacon.lineStyle(2, candidate.tone, 0.94);
            beacon.strokeCircle(-58, 0, 18);
            beacon.lineStyle(2, candidate.tone, 0.78);
            beacon.lineBetween(-31, 15, 67, 15);
            beacon.lineStyle(1, 0xF4F4F4, 0.4);
            beacon.lineBetween(-31, 18, 30, 18);

            const glyph = this.scene.add.text(
                target.x - 58,
                beaconY,
                candidate.icon || '✦',
                {
                    fontSize: '14px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: '#F4F4F4',
                    stroke: '#071411',
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setDepth(depth + 15);
            const verb = this.scene.add.text(
                target.x - 31,
                beaconY - 7,
                String(candidate.verb || 'INTERACT').toUpperCase(),
                {
                    fontSize: '11px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: '#F4F4F4',
                    stroke: '#071411',
                    strokeThickness: 4
                }
            ).setOrigin(0, 0.5).setDepth(depth + 15);
            const label = this.scene.add.text(
                target.x - 31,
                beaconY + 8,
                String(candidate.label || '').toUpperCase(),
                {
                    fontSize: '8px',
                    fontFamily: 'Arial, sans-serif',
                    fontStyle: 'bold',
                    color: '#8FE3CF',
                    stroke: '#071411',
                    strokeThickness: 3
                }
            ).setOrigin(0, 0.5).setDepth(depth + 15);
            const hitZone = this.scene.add.zone(target.x, beaconY, 164, 52)
                .setDepth(depth + 16)
                .setData('sanctuaryInteractionBeaconHitZone', true)
                .setData('interactionId', candidate.id)
                .setData('ariaLabel', candidate.ariaLabel || candidate.message)
                .setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', pointer => {
                pointer?.event?.stopPropagation?.();
                candidate.action?.();
            });
            this.beacon = beacon;
            elements.push(beacon, glyph, verb, label, hitZone);
        }
        this.indicator = indicator;
        this.indicatorElements = elements;
        this.indicatorTween = this.scene.tweens.add({
            targets: [indicator, this.beacon].filter(Boolean),
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
        this.indicatorElements.forEach(element => element?.destroy?.());
        this.indicatorElements = [];
        this.indicator = null;
        this.beacon = null;
    }

    destroy() {
        this.clearIndicator();
        this.candidates.clear();
        this.active = null;
        if (this.scene) this.scene.sanctuaryPromptOwnerId = null;
        this.scene = null;
    }
}

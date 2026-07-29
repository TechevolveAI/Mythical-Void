const WAYPOINTS = Object.freeze({
    beacon_field_kit: Object.freeze({
        label: 'FIELD KIT',
        targetKey: 'crashedShip',
        color: 0x6FE7DD
    }),
    beacon_living_signals: Object.freeze({
        label: 'LIVING SIGNAL',
        targetKey: 'nearestLivingSignal',
        color: 0x8FE3CF
    }),
    beacon_world_gate: Object.freeze({
        label: 'WORLD GATE',
        targetKey: 'hubPortal',
        color: 0xD8B65C
    })
});

export function resolveProjectBeaconWaypointTarget(scene, quest, player) {
    if (!scene || !quest || quest.type !== 'story' || quest.completed || quest.claimed) {
        return null;
    }

    const config = WAYPOINTS[quest.id];
    if (!config) {
        return null;
    }

    let target = null;
    if (config.targetKey === 'nearestLivingSignal') {
        const available = (scene.livingSignals || []).filter(
            signal => signal && signal.active !== false && !signal.observed
        );
        target = available.reduce((nearest, signal) => {
            if (!nearest || !player) return signal;
            const nearestDistance = Math.hypot(nearest.x - player.x, nearest.y - player.y);
            const candidateDistance = Math.hypot(
                signal.x - player.x,
                signal.y - player.y
            );
            return candidateDistance < nearestDistance ? signal : nearest;
        }, null);
    } else {
        target = scene[config.targetKey];
    }

    if (!target || target.active === false || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        return null;
    }

    return {
        missionId: quest.id,
        label: config.label,
        color: config.color,
        target
    };
}

export function getWaypointScreenPosition({
    targetX,
    targetY,
    cameraX = 0,
    cameraY = 0,
    zoom = 1,
    width,
    height,
    horizontalMargin = 58,
    topMargin = 105,
    bottomMargin = 90
}) {
    const screenX = (targetX - cameraX) * zoom;
    const screenY = (targetY - cameraY) * zoom;
    const clampedX = Math.max(horizontalMargin, Math.min(width - horizontalMargin, screenX));
    const clampedY = Math.max(topMargin, Math.min(height - bottomMargin, screenY));

    return {
        x: clampedX,
        y: clampedY,
        angle: Math.atan2(screenY - height / 2, screenX - width / 2),
        isVisible: (
            screenX >= horizontalMargin &&
            screenX <= width - horizontalMargin &&
            screenY >= topMargin &&
            screenY <= height - bottomMargin
        )
    };
}

export default class ProjectBeaconWaypoint {
    constructor(scene, {
        questProvider = () => window.QuestManager?.getQuestsByType?.('story')?.[0] || null
    } = {}) {
        this.scene = scene;
        this.questProvider = questProvider;
        this.currentTarget = null;
        this.hudContainer = null;
        this.worldContainer = null;
        this.unsubscribers = [];
        this.refreshElapsed = 0;
        this.worldPulse = null;
    }

    create() {
        const isNarrow = this.scene.scale.width < 600;

        this.hudContainer = this.scene.add.container(0, 0)
            .setScrollFactor(0)
            .setDepth(11800)
            .setVisible(false);

        this.arrow = this.scene.add.graphics();
        this.arrow.fillStyle(0x6FE7DD, 1);
        this.arrow.fillTriangle(0, -13, -9, 8, 9, 8);
        this.arrow.lineStyle(2, 0xFFFFFF, 0.75);
        this.arrow.strokeTriangle(0, -13, -9, 8, 9, 8);
        this.hudContainer.add(this.arrow);

        this.hudLabel = this.scene.add.text(0, 20, '', {
            fontSize: isNarrow ? '10px' : '12px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            backgroundColor: 'rgba(5, 12, 18, 0.88)',
            padding: { x: 7, y: 4 }
        }).setOrigin(0.5, 0);
        this.hudContainer.add(this.hudLabel);

        this.worldContainer = this.scene.add.container(0, 0).setVisible(false);
        this.worldRing = this.scene.add.graphics();
        this.worldRing.lineStyle(3, 0x6FE7DD, 0.9);
        this.worldRing.strokeCircle(0, 0, 24);
        this.worldRing.fillStyle(0x6FE7DD, 0.9);
        this.worldRing.fillTriangle(0, 13, -7, 2, 7, 2);
        this.worldContainer.add(this.worldRing);

        this.worldLabel = this.scene.add.text(0, -34, '', {
            fontSize: isNarrow ? '10px' : '11px',
            color: '#DFFFFC',
            fontStyle: 'bold',
            backgroundColor: 'rgba(5, 12, 18, 0.82)',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5, 1);
        this.worldContainer.add(this.worldLabel);

        this.worldPulse = this.scene.tweens.add({
            targets: this.worldRing,
            alpha: { from: 1, to: 0.35 },
            scale: { from: 0.9, to: 1.16 },
            duration: 850,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.setupQuestListeners();
        this.refreshTarget();
    }

    setupQuestListeners() {
        const manager = window.QuestManager;
        if (!manager?.on) return;

        ['questsGenerated', 'questProgressUpdated', 'questCompleted', 'questRewardClaimed']
            .forEach(event => {
                this.unsubscribers.push(manager.on(event, () => this.refreshTarget()));
            });
    }

    refreshTarget() {
        this.currentTarget = resolveProjectBeaconWaypointTarget(
            this.scene,
            this.questProvider(),
            this.scene.player
        );

        if (!this.currentTarget) {
            this.hudContainer?.setVisible(false);
            this.worldContainer?.setVisible(false);
            return;
        }

        const color = this.currentTarget.color;
        this.arrow.clear();
        this.arrow.fillStyle(color, 1);
        this.arrow.fillTriangle(0, -13, -9, 8, 9, 8);
        this.arrow.lineStyle(2, 0xFFFFFF, 0.75);
        this.arrow.strokeTriangle(0, -13, -9, 8, 9, 8);

        this.worldRing.clear();
        this.worldRing.lineStyle(3, color, 0.9);
        this.worldRing.strokeCircle(0, 0, 24);
        this.worldRing.fillStyle(color, 0.9);
        this.worldRing.fillTriangle(0, 13, -7, 2, 7, 2);
        this.worldLabel.setText(this.currentTarget.label);
    }

    update(delta = 16.67) {
        if (!this.hudContainer || !this.worldContainer) return;

        this.refreshElapsed += delta;
        if (this.refreshElapsed >= 350) {
            this.refreshElapsed = 0;
            this.refreshTarget();
        }

        const target = this.currentTarget?.target;
        const player = this.scene.player;
        const camera = this.scene.cameras?.main;
        if (!target || !player || !camera) {
            this.hudContainer.setVisible(false);
            this.worldContainer.setVisible(false);
            return;
        }

        const distance = Math.hypot(target.x - player.x, target.y - player.y);
        const isNarrow = this.scene.scale.width < 600;
        const screenPosition = getWaypointScreenPosition({
            targetX: target.x,
            targetY: target.y,
            cameraX: camera.worldView?.x ?? camera.scrollX ?? 0,
            cameraY: camera.worldView?.y ?? camera.scrollY ?? 0,
            zoom: camera.zoom || 1,
            width: camera.width,
            height: camera.height,
            horizontalMargin: isNarrow ? 52 : 58,
            topMargin: isNarrow ? 215 : 105,
            bottomMargin: isNarrow ? 145 : 90
        });

        this.worldContainer
            .setPosition(target.x, target.y - 48)
            .setDepth(this.scene.currentBiome === 'nebula' ? target.y + 20 : 1190)
            .setVisible(screenPosition.isVisible);

        this.hudContainer
            .setPosition(screenPosition.x, screenPosition.y)
            .setVisible(!screenPosition.isVisible);
        this.arrow.setRotation(screenPosition.angle + Math.PI / 2);
        this.hudLabel.setText(
            `${this.currentTarget.label}\n${Math.max(1, Math.round(distance / 10))}m`
        );
    }

    destroy() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe?.());
        this.unsubscribers = [];
        this.worldPulse?.stop?.();
        this.worldPulse = null;
        this.hudContainer?.destroy?.(true);
        this.worldContainer?.destroy?.(true);
        this.hudContainer = null;
        this.worldContainer = null;
        this.currentTarget = null;
    }
}

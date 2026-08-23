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

function getWaypointLabel(config, quest) {
    if (quest.id !== 'beacon_living_signals') {
        return config.label;
    }

    const total = Math.max(1, Number(quest.objective?.target) || 3);
    const progress = Math.max(
        0,
        Math.min(total, Number(quest.progress) || 0)
    );
    return `${config.label} ${progress}/${total}`;
}

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
        label: getWaypointLabel(config, quest),
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

function isUsableTarget(target) {
    return Boolean(
        target &&
        target.active !== false &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y)
    );
}

export function resolveSanctuaryCurrentTarget(scene, {
    gameState = window.GameState,
    campaignStep = null
} = {}) {
    if (scene?.currentBiome !== 'nebula') return null;

    const fieldKitRecovered = gameState?.get?.(
        'story.projectBeacon.fieldKit.recovered'
    ) === true;
    if (!fieldKitRecovered && isUsableTarget(scene.crashedShip)) {
        return {
            missionId: 'sanctuary_field_kit',
            label: 'RECOVER FIELD KIT',
            color: 0x90A4AE,
            target: scene.crashedShip,
            source: 'sanctuary'
        };
    }

    const village = scene.villageHeartLandmark?.snapshot;
    const nextVillageAction = village?.worldState?.nextAction;
    const villageNeedsGuidance = village?.unlock?.unlocked === true &&
        village?.state?.guidanceSeen !== true;
    const villageDecisionReady = nextVillageAction?.type === 'decision';
    if (
        (villageNeedsGuidance || villageDecisionReady) &&
        isUsableTarget(scene.villageHeartLandmark?.zone)
    ) {
        return {
            missionId: villageDecisionReady
                ? 'sanctuary_heart_choice'
                : 'sanctuary_village_arrival',
            label: villageDecisionReady
                ? 'HEART CHOICE READY'
                : 'BUILD A HOME TOGETHER',
            color: villageDecisionReady ? 0xF2C14E : 0x71E6B1,
            target: scene.villageHeartLandmark.zone,
            source: 'sanctuary'
        };
    }

    if (
        ['ready', 'resume'].includes(campaignStep?.status) &&
        isUsableTarget(scene.hubPortal)
    ) {
        return {
            missionId: `sanctuary_${campaignStep.status}_expedition`,
            label: campaignStep.status === 'resume'
                ? `RESUME · ${String(campaignStep.label || 'EXPEDITION').toUpperCase()}`
                : `NEXT · ${String(campaignStep.label || 'EXPEDITION').toUpperCase()}`,
            color: 0xBFA6FF,
            target: scene.hubPortal,
            source: 'sanctuary'
        };
    }

    return null;
}

export default class ProjectBeaconWaypoint {
    constructor(scene, {
        questProvider = () => window.QuestManager?.getQuestsByType?.('story')?.[0] || null,
        campaignStepProvider = () => null
    } = {}) {
        this.scene = scene;
        this.questProvider = questProvider;
        this.campaignStepProvider = campaignStepProvider;
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
        this.drawDirectionArrow(0x6FE7DD);
        this.hudContainer.add(this.arrow);

        this.hudRail = this.scene.add.graphics()
            .setData('waypointVisualLanguage', 'living_current_edge_ribbon_v2');
        this.hudContainer.addAt(this.hudRail, 0);

        this.hudLabel = this.scene.add.text(0, 19, '', {
            fontSize: isNarrow ? '11px' : '12px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#050C12',
            strokeThickness: 4,
            lineSpacing: 2
        }).setOrigin(0.5, 0)
            .setData('waypointCopyMode', 'single_destination');
        this.hudContainer.add(this.hudLabel);

        this.worldContainer = this.scene.add.container(0, 0).setVisible(false);
        this.worldRing = this.scene.add.graphics();
        this.drawWorldThreshold(0x6FE7DD);
        this.worldContainer.add(this.worldRing);

        this.worldLabel = this.scene.add.text(0, -29, '', {
            fontSize: isNarrow ? '11px' : '12px',
            color: '#DFFFFC',
            fontStyle: 'bold',
            stroke: '#050C12',
            strokeThickness: 4
        }).setOrigin(0.5, 1)
            .setData('waypointWorldThreshold', true);
        this.worldContainer.add(this.worldLabel);

        this.trailContainer = this.scene.add.container(0, 0)
            .setVisible(false)
            .setData('waypointVisualLanguage', 'player_current_trail_v1');
        this.trail = this.scene.add.graphics();
        this.trailContainer.add(this.trail);
        this.drawPlayerTrail(0x6FE7DD);

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

    drawDirectionArrow(color) {
        this.arrow.clear();
        this.arrow.lineStyle(3, color, 1);
        this.arrow.beginPath();
        this.arrow.moveTo(-8, 7);
        this.arrow.lineTo(0, -10);
        this.arrow.lineTo(8, 7);
        this.arrow.strokePath();
        this.arrow.lineStyle(1, 0xFFFFFF, 0.72);
        this.arrow.lineBetween(0, -8, 0, 4);
    }

    drawHudRail(color) {
        this.hudRail.clear();
        this.hudRail.lineStyle(2, color, 0.82);
        this.hudRail.lineBetween(-62, 12, -18, 12);
        this.hudRail.lineBetween(18, 12, 62, 12);
        this.hudRail.fillStyle(0x071411, 0.92);
        this.hudRail.fillCircle(-68, 12, 4);
        this.hudRail.fillCircle(68, 12, 4);
        this.hudRail.lineStyle(1, 0xF4F4F4, 0.5);
        this.hudRail.strokeCircle(-68, 12, 3);
        this.hudRail.strokeCircle(68, 12, 3);
    }

    drawWorldThreshold(color) {
        this.worldRing.clear();
        this.worldRing.lineStyle(3, color, 0.82);
        this.worldRing.strokeEllipse(0, 11, 62, 20);
        this.worldRing.lineStyle(1, 0xF4F4F4, 0.52);
        this.worldRing.strokeEllipse(0, 11, 42, 12);
        this.worldRing.fillStyle(color, 0.88);
        this.worldRing.fillTriangle(0, 2, -6, 12, 6, 12);
        [-18, 18].forEach(x => {
            this.worldRing.lineStyle(2, color, 0.62);
            this.worldRing.lineBetween(x, 9, x + (x < 0 ? -4 : 4), -3);
        });
        this.worldRing.setData('waypointThresholdMaterial', 'living_current_threshold_v1');
    }

    drawPlayerTrail(color) {
        this.trail.clear();
        [30, 50, 70].forEach((x, index) => {
            const alpha = 0.36 + (index * 0.2);
            this.trail.lineStyle(index === 2 ? 2 : 1, color, alpha);
            this.trail.beginPath();
            this.trail.moveTo(x - 5, -5);
            this.trail.lineTo(x + 3, 0);
            this.trail.lineTo(x - 5, 5);
            this.trail.strokePath();
            this.trail.fillStyle(index === 2 ? 0xF4F4F4 : color, alpha);
            this.trail.fillCircle(x - 8, 0, index === 2 ? 2 : 1.5);
        });
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
        const quest = this.questProvider();
        const activeStoryQuest = Boolean(
            quest?.type === 'story' && !quest.completed && !quest.claimed
        );
        const questTarget = resolveProjectBeaconWaypointTarget(
            this.scene,
            quest,
            this.scene.player
        );
        this.currentTarget = activeStoryQuest
            ? questTarget
            : questTarget || resolveSanctuaryCurrentTarget(this.scene, {
                campaignStep: this.campaignStepProvider()
            });

        if (!this.currentTarget) {
            this.hudContainer?.setVisible(false);
            this.worldContainer?.setVisible(false);
            this.trailContainer?.setVisible(false);
            return;
        }

        const color = this.currentTarget.color;
        this.drawDirectionArrow(color);
        this.drawHudRail(color);
        this.drawWorldThreshold(color);
        this.drawPlayerTrail(color);
        this.worldLabel.setText(this.currentTarget.label);
        this.hudContainer.setData('waypointSource', this.currentTarget.source || 'quest');
        this.worldContainer.setData('waypointSource', this.currentTarget.source || 'quest');
        this.trailContainer.setData('waypointSource', this.currentTarget.source || 'quest');
    }

    update(delta = 16.67) {
        if (!this.hudContainer || !this.worldContainer || !this.trailContainer) return;

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
            this.trailContainer.setVisible(false);
            return;
        }

        const sanctuaryMomentActive = this.scene.currentBiome === 'nebula' && Boolean(
            this.scene.sanctuaryFocusModeActive ||
            this.scene.villageArrivalRevealActive ||
            this.scene.villageCommandPanel?.domElement ||
            this.scene.storyModalElements?.length
        );
        const interactionTarget = this.scene.sanctuaryInteractionDirector?.active?.target;
        const interactionOwnsAttention = isUsableTarget(interactionTarget) &&
            Math.hypot(
                interactionTarget.x - player.x,
                interactionTarget.y - player.y
            ) <= 200;
        if (sanctuaryMomentActive || interactionOwnsAttention) {
            this.hudContainer.setVisible(false);
            this.worldContainer.setVisible(false);
            this.trailContainer.setVisible(false);
            return;
        }

        const distance = Math.hypot(target.x - player.x, target.y - player.y);
        const isNarrow = this.scene.scale.width < 600;
        const screenPosition = getWaypointScreenPosition({
            targetX: target.x,
            targetY: target.y,
            // scrollX/scrollY update immediately when the camera recentres. worldView
            // is rebuilt later in Phaser's render pass and can leave the ribbon on
            // screen for one stale frame after the player reaches a destination.
            cameraX: camera.scrollX ?? camera.worldView?.x ?? 0,
            cameraY: camera.scrollY ?? camera.worldView?.y ?? 0,
            zoom: camera.zoom || 1,
            width: camera.width,
            height: camera.height,
            horizontalMargin: isNarrow ? 96 : 82,
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
        this.trailContainer
            .setPosition(player.x, player.y + 18)
            .setRotation(Math.atan2(target.y - player.y, target.x - player.x))
            .setDepth(player.y - 2)
            .setVisible(distance > 120);
    }

    destroy() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe?.());
        this.unsubscribers = [];
        this.worldPulse?.stop?.();
        this.worldPulse = null;
        this.hudContainer?.destroy?.(true);
        this.worldContainer?.destroy?.(true);
        this.trailContainer?.destroy?.(true);
        this.hudContainer = null;
        this.worldContainer = null;
        this.trailContainer = null;
        this.currentTarget = null;
    }
}

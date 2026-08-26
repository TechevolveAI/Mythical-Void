const TEXTURE_WITHOUT_KIT = 'projectBeaconAstronaut';
const TEXTURE_WITH_KIT = 'projectBeaconAstronautWithKit';
const TEXTURE_WITH_CRYSTAL_EDGE = 'projectBeaconAstronautWithCrystalEdge';
const TEXTURE_WITH_AURORA_GUARD = 'projectBeaconAstronautWithAuroraGuard';
const TEXTURE_WITH_FULL_KATANA = 'projectBeaconAstronautWithFullKatana';

function normalizeKatanaUpgradeIds(upgradeIds) {
    if (!Array.isArray(upgradeIds)) {
        return [];
    }

    return Array.from(new Set(
        upgradeIds
            .map(upgrade => typeof upgrade === 'string' ? upgrade : upgrade?.id)
            .filter(id => ['crystal_edge', 'aurora_guard'].includes(id))
    ));
}

export function getExpeditionAstronautTextureKey(
    hasFieldKit,
    katanaUpgradeIds = []
) {
    if (!hasFieldKit) {
        return TEXTURE_WITHOUT_KIT;
    }

    const upgrades = normalizeKatanaUpgradeIds(katanaUpgradeIds);
    const hasCrystalEdge = upgrades.includes('crystal_edge');
    const hasAuroraGuard = upgrades.includes('aurora_guard');
    if (hasCrystalEdge && hasAuroraGuard) {
        return TEXTURE_WITH_FULL_KATANA;
    }
    if (hasCrystalEdge) {
        return TEXTURE_WITH_CRYSTAL_EDGE;
    }
    if (hasAuroraGuard) {
        return TEXTURE_WITH_AURORA_GUARD;
    }
    return TEXTURE_WITH_KIT;
}

export function getExpeditionFollowOffset(mode = 'topDown', facingRight = true) {
    if (mode === 'platformer') {
        return { x: facingRight ? -92 : 92, y: 2 };
    }

    return { x: facingRight ? -58 : 58, y: 24 };
}

export function findExpeditionTrailTarget(trail, followDistance) {
    if (!Array.isArray(trail) || trail.length === 0) {
        return null;
    }

    let distanceTravelled = 0;
    for (let index = 1; index < trail.length; index++) {
        const newer = trail[index - 1];
        const older = trail[index];
        distanceTravelled += Math.hypot(newer.x - older.x, newer.y - older.y);

        if (distanceTravelled >= followDistance) {
            return older;
        }
    }

    return trail[trail.length - 1];
}

function drawAstronautTexture(
    scene,
    textureKey,
    hasFieldKit,
    katanaUpgradeIds = []
) {
    if (scene.textures.exists(textureKey)) {
        return textureKey;
    }

    const graphics = scene.make.graphics({ add: false });

    // Backpack and life-support frame
    graphics.fillStyle(0x26343E, 1);
    graphics.fillRoundedRect(13, 31, 17, 35, 5);
    graphics.lineStyle(2, 0x526873, 1);
    graphics.strokeRoundedRect(13, 31, 17, 35, 5);

    // Legs and magnetic boots
    graphics.fillStyle(0xDCE3E6, 1);
    graphics.fillRoundedRect(25, 61, 10, 23, 4);
    graphics.fillRoundedRect(39, 61, 10, 23, 4);
    graphics.fillStyle(0x34434B, 1);
    graphics.fillRoundedRect(22, 79, 15, 8, 3);
    graphics.fillRoundedRect(37, 79, 15, 8, 3);

    // Arms
    graphics.fillStyle(0xBFCBD0, 1);
    graphics.fillRoundedRect(14, 38, 13, 31, 6);
    graphics.fillRoundedRect(47, 38, 13, 31, 6);
    graphics.fillStyle(0x26343E, 1);
    graphics.fillCircle(20, 67, 6);
    graphics.fillCircle(54, 67, 6);

    // Suit torso
    graphics.fillStyle(0xEDF2F3, 1);
    graphics.fillRoundedRect(22, 31, 30, 39, 7);
    graphics.lineStyle(2, 0x83959D, 1);
    graphics.strokeRoundedRect(22, 31, 30, 39, 7);
    graphics.fillStyle(0x293942, 1);
    graphics.fillRoundedRect(28, 43, 19, 13, 3);
    graphics.fillStyle(0x6FE7DD, 1);
    graphics.fillCircle(32, 48, 2);
    graphics.fillStyle(0xD8B65C, 1);
    graphics.fillCircle(45, 48, 3);
    graphics.fillStyle(0xC74B50, 1);
    graphics.fillRect(24, 58, 26, 3);

    // Helmet and reflective visor
    graphics.fillStyle(0xE9EFF1, 1);
    graphics.fillCircle(37, 24, 20);
    graphics.lineStyle(2, 0x7E919A, 1);
    graphics.strokeCircle(37, 24, 20);
    graphics.fillStyle(0x102C3A, 1);
    graphics.fillRoundedRect(23, 14, 28, 20, 8);
    graphics.fillStyle(0x4FBFC2, 0.75);
    graphics.fillRoundedRect(26, 16, 22, 15, 6);
    graphics.fillStyle(0xD8FFFF, 0.55);
    graphics.fillRoundedRect(28, 18, 11, 4, 2);

    // Beacon antenna and Earth-blue mission mark
    graphics.lineStyle(2, 0xA8B3BD, 1);
    graphics.lineBetween(51, 11, 57, 3);
    graphics.fillStyle(0x6FE7DD, 1);
    graphics.fillCircle(58, 3, 3);
    graphics.fillStyle(0x3978B8, 1);
    graphics.fillCircle(27, 37, 3);

    if (hasFieldKit) {
        const upgrades = normalizeKatanaUpgradeIds(katanaUpgradeIds);
        const hasCrystalEdge = upgrades.includes('crystal_edge');
        const hasAuroraGuard = upgrades.includes('aurora_guard');

        // Sheathed Earth-forged katana with creature-tech interfaces.
        graphics.lineStyle(6, 0x26343E, 1);
        graphics.lineBetween(51, 49, 64, 82);
        graphics.lineStyle(3, hasCrystalEdge ? 0x8FE3CF : 0xA8B3BD, 1);
        graphics.lineBetween(53, 50, 65, 80);
        graphics.lineStyle(4, 0xD8B65C, 1);
        graphics.lineBetween(48, 51, 58, 47);
        graphics.fillStyle(hasCrystalEdge ? 0x8FE3CF : 0x6FE7DD, 0.8);
        graphics.fillCircle(62, 73, 2);
        graphics.fillCircle(64, 78, 2);

        if (hasCrystalEdge) {
            graphics.lineStyle(2, 0x66C7D4, 0.7);
            graphics.lineBetween(56, 56, 66, 80);
        }
        if (hasAuroraGuard) {
            graphics.lineStyle(2, 0xD9B8FF, 0.9);
            graphics.strokeCircle(52, 49, 8);
            graphics.fillStyle(0xF2C14E, 1);
            graphics.fillCircle(52, 49, 3);
        }
    }

    graphics.generateTexture(textureKey, 74, 92);
    graphics.destroy();
    return textureKey;
}

export class ExpeditionAstronaut {
    constructor(scene, target, {
        mode = 'topDown',
        fieldKitRecovered = false,
        katanaUpgradeIds = [],
        followDistance = null
    } = {}) {
        this.scene = scene;
        this.target = target;
        this.mode = mode;
        this.fieldKitRecovered = fieldKitRecovered;
        this.katanaUpgradeIds = normalizeKatanaUpgradeIds(katanaUpgradeIds);
        this.followDistance = followDistance ?? (mode === 'platformer' ? 96 : 68);
        this.sprite = null;
        this.shadow = null;
        this.trail = [];
        this.elapsed = 0;
        this.lastTargetPosition = null;
        this.contextualFormation = null;
        this.isStriking = false;
        this.strikeTween = null;
        this.strikeEffects = [];

        this.create();
    }

    create() {
        if (!this.scene?.add || !this.target) {
            return;
        }

        const textureKey = this.getTextureKey();
        drawAstronautTexture(
            this.scene,
            textureKey,
            this.fieldKitRecovered,
            this.katanaUpgradeIds
        );
        const facingRight = !this.target.flipX;
        const offset = getExpeditionFollowOffset(this.mode, facingRight);
        const startX = this.target.x + offset.x;
        const startY = this.target.y + offset.y;

        this.shadow = this.scene.add.ellipse(startX, startY + 34, 34, 11, 0x020407, 0.38);
        this.shadow.setDepth(this.mode === 'platformer' ? 897 : startY - 1);

        this.sprite = this.scene.add.sprite(startX, startY, textureKey);
        this.sprite.setOrigin(0.5, 0.72);
        this.sprite.setDepth(this.mode === 'platformer' ? 898 : startY);
        this.sprite.setScale(this.mode === 'platformer' ? 0.78 : 0.82);
        this.sprite.setFlipX(!facingRight);

        this.resetTrail();
    }

    getTextureKey() {
        return getExpeditionAstronautTextureKey(
            this.fieldKitRecovered,
            this.katanaUpgradeIds
        );
    }

    setFieldKitRecovered(recovered) {
        const nextValue = Boolean(recovered);
        if (nextValue === this.fieldKitRecovered) {
            return;
        }

        this.fieldKitRecovered = nextValue;
        if (this.sprite) {
            const textureKey = this.getTextureKey();
            drawAstronautTexture(
                this.scene,
                textureKey,
                this.fieldKitRecovered,
                this.katanaUpgradeIds
            );
            this.sprite.setTexture(textureKey);
        }
    }

    setKatanaUpgradeIds(upgradeIds) {
        const normalized = normalizeKatanaUpgradeIds(upgradeIds);
        if (
            normalized.length === this.katanaUpgradeIds.length
            && normalized.every(id => this.katanaUpgradeIds.includes(id))
        ) {
            return;
        }

        this.katanaUpgradeIds = normalized;
        if (this.sprite) {
            const textureKey = this.getTextureKey();
            drawAstronautTexture(
                this.scene,
                textureKey,
                this.fieldKitRecovered,
                this.katanaUpgradeIds
            );
            this.sprite.setTexture(textureKey);
        }
    }

    resetTrail() {
        if (!this.target) return;

        const facingRight = !this.target.flipX;
        const offset = getExpeditionFollowOffset(this.mode, facingRight);
        this.trail = [{
            x: this.target.x + offset.x,
            y: this.target.y + offset.y
        }];
        this.lastTargetPosition = { x: this.target.x, y: this.target.y };
    }

    setContextualFormation(offset = null, context = null) {
        const hasOffset = Number.isFinite(offset?.x) && Number.isFinite(offset?.y);
        const next = hasOffset
            ? { x: Number(offset.x), y: Number(offset.y), context: context || 'contextual' }
            : null;
        const unchanged = this.contextualFormation?.context === next?.context &&
            this.contextualFormation?.x === next?.x &&
            this.contextualFormation?.y === next?.y;
        if (unchanged) return false;

        this.contextualFormation = next;
        if (!next) this.resetTrail();
        this.sprite?.setData?.('expeditionFormationContext', next?.context || 'trail');
        return true;
    }

    recordTargetPosition() {
        if (!this.target || !this.lastTargetPosition) {
            this.resetTrail();
            return false;
        }

        const moved = Math.hypot(
            this.target.x - this.lastTargetPosition.x,
            this.target.y - this.lastTargetPosition.y
        );

        if (moved > 420) {
            this.resetTrail();
            return true;
        }

        if (moved >= 3) {
            this.trail.unshift({ x: this.target.x, y: this.target.y });
            this.trail.length = Math.min(this.trail.length, 180);
            this.lastTargetPosition = { x: this.target.x, y: this.target.y };
        }

        return false;
    }

    performKatanaStrike({
        facingRight = true,
        targetX = null,
        targetY = null,
        slashColor = 0xE040FB,
        slashGlowColor = 0x7B68EE,
        reefAmplified = false
    } = {}) {
        if (
            !this.fieldKitRecovered ||
            !this.sprite?.active ||
            !this.target?.active ||
            !this.scene?.add?.graphics ||
            !this.scene?.tweens?.add ||
            this.isStriking
        ) {
            return false;
        }

        const direction = facingRight ? 1 : -1;
        const strikeX = Number.isFinite(targetX)
            ? targetX
            : this.target.x + direction * 50;
        const strikeY = Number.isFinite(targetY)
            ? targetY
            : this.target.y;
        const lungeDistance = reefAmplified ? 42 : 30;
        const arcRadius = reefAmplified ? 56 : 42;
        const effectDepth = this.mode === 'platformer' ? 901 : strikeY + 2;

        const energyTrail = this.scene.add.graphics();
        energyTrail.lineStyle(
            reefAmplified ? 7 : 5,
            slashGlowColor,
            reefAmplified ? 0.7 : 0.55
        );
        energyTrail.lineBetween(
            this.sprite.x + direction * 10,
            this.sprite.y + 8,
            strikeX - direction * 8,
            strikeY
        );
        energyTrail.setDepth(effectDepth);

        const slash = this.scene.add.graphics();
        slash.fillStyle(slashGlowColor, reefAmplified ? 0.45 : 0.3);
        slash.fillCircle(0, 0, reefAmplified ? 34 : 25);
        slash.lineStyle(reefAmplified ? 6 : 5, slashColor, 1);
        slash.beginPath();
        const startAngle = facingRight ? -Math.PI / 2 : Math.PI / 2;
        slash.arc(
            0,
            0,
            arcRadius,
            startAngle - 0.55,
            startAngle + 1.05,
            false
        );
        slash.strokePath();
        slash.setPosition(strikeX, strikeY);
        slash.setDepth(effectDepth + 1);

        this.isStriking = true;
        const strikeEffects = [energyTrail, slash];
        this.strikeEffects.push(...strikeEffects);
        this.sprite.setFlipX(!facingRight);
        this.sprite.setDepth(effectDepth + 2);

        this.scene.tweens.add({
            targets: strikeEffects,
            alpha: 0,
            scaleX: reefAmplified ? 1.8 : 1.45,
            scaleY: reefAmplified ? 1.8 : 1.45,
            duration: reefAmplified ? 300 : 210,
            ease: 'Power2',
            onComplete: () => {
                strikeEffects.forEach(effect => effect?.destroy?.());
                this.strikeEffects = this.strikeEffects.filter(
                    effect => !strikeEffects.includes(effect)
                );
            }
        });

        this.strikeTween = this.scene.tweens.add({
            targets: this.sprite,
            x: this.sprite.x + direction * lungeDistance,
            rotation: direction * 0.08,
            duration: 85,
            hold: reefAmplified ? 45 : 25,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.isStriking = false;
                this.strikeTween = null;
                this.sprite?.setRotation?.(0);
                this.resetTrail();
            }
        });

        return true;
    }

    update(delta = 16.67) {
        if (!this.sprite?.active || !this.target?.active) {
            return;
        }

        this.elapsed += delta;
        if (this.isStriking) {
            this.shadow?.setPosition(this.sprite.x, this.sprite.y + 34);
            this.shadow?.setAlpha(
                this.target.body?.blocked?.down ? 0.32 : 0.14
            );
            return;
        }

        const teleported = this.recordTargetPosition();
        const facingRight = !this.target.flipX;
        const stationaryOffset = getExpeditionFollowOffset(this.mode, facingRight);
        const trailTarget = findExpeditionTrailTarget(this.trail, this.followDistance);
        const desired = this.contextualFormation
            ? {
                x: this.target.x + this.contextualFormation.x,
                y: this.target.y + this.contextualFormation.y
            }
            : this.trail.length > 1
                ? trailTarget
                : {
                    x: this.target.x + stationaryOffset.x,
                    y: this.target.y + stationaryOffset.y
                };

        if (!desired) return;

        if (teleported) {
            this.sprite.setPosition(desired.x, desired.y);
        } else {
            const smoothing = 1 - Math.pow(0.002, Math.min(delta, 50) / 1000);
            this.sprite.x += (desired.x - this.sprite.x) * smoothing;
            this.sprite.y += (desired.y - this.sprite.y) * smoothing;
        }

        const velocity = this.target.body?.velocity;
        const isMoving = velocity
            ? Math.abs(velocity.x) > 8 || Math.abs(velocity.y) > 8
            : this.trail.length > 1;
        const bob = Math.sin(this.elapsed * (isMoving ? 0.014 : 0.004)) * (isMoving ? 2 : 0.6);

        this.sprite.setFlipX(!facingRight);
        this.sprite.setRotation(isMoving ? Math.sin(this.elapsed * 0.01) * 0.025 : 0);
        this.sprite.y += bob * 0.08;

        if (this.mode === 'platformer') {
            this.sprite.setDepth(898);
            this.shadow?.setPosition(this.sprite.x, this.sprite.y + 34);
            this.shadow?.setDepth(897);
            this.shadow?.setAlpha(this.target.body?.blocked?.down ? 0.38 : 0.16);
        } else {
            this.sprite.setDepth(this.sprite.y);
            this.shadow?.setPosition(this.sprite.x, this.sprite.y + 34);
            this.shadow?.setDepth(this.sprite.y - 1);
        }
    }

    destroy() {
        this.strikeTween?.stop?.();
        this.strikeEffects.forEach(effect => effect?.destroy?.());
        this.sprite?.destroy?.();
        this.shadow?.destroy?.();
        this.strikeTween = null;
        this.strikeEffects = [];
        this.isStriking = false;
        this.sprite = null;
        this.shadow = null;
        this.target = null;
        this.contextualFormation = null;
        this.trail = [];
    }
}

export default ExpeditionAstronaut;

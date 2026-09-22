import PlatformerLevelScene from '../scenes/PlatformerLevelScene.js';
import { TrumptopusEncounter } from '../systems/TrumptopusEncounter.js';

// Only imported by the local proof harness. Not registered in the game loader.
// The limb is a mechanics greybox, not the approved Trumptopus artwork.
export default class TrumptopusPrototypeLevel extends PlatformerLevelScene {
    constructor(key = 'TrumptopusPrototype') {
        super({ key, levelId: 'private_grip', biomeId: 'final_void' });
    }

    init(data = {}) {
        super.init({ forceMobileControls: this.scale.width < 600, katanaPreview: 'crystal' });
        this.configurePrototypeWorld(data);
        this.encounter = this.createEncounter(data);
        this.hitEvidence = [];
        this.damageEvidence = [];
        this.health = 4;
        this.invulnerableUntil = 0;
        this.pauseMenuActive = false;
    }

    preload() {}

    configurePrototypeWorld() {
        this.levelWidth = this.scale.width;
        this.floorY = Math.round(this.scale.height * 0.64);
        this.levelHeight = this.floorY + 50;
        this.spawnX = this.levelWidth * 0.5;
    }

    createPrototypeTerrain() {
        this.createPlatform(0, this.floorY, this.levelWidth, 80, 'solid');
    }

    createEncounter() {
        return new TrumptopusEncounter({ minX: 85, maxX: this.levelWidth - 115 });
    }

    create() {
        this.setupPlatformerPhysics();
        this.physics.world.resume();
        this.physics.world.setBounds(24, 0, this.levelWidth - 48, this.scale.height);
        this.cameras.main.setBackgroundColor('#15191c');
        this.prototypeUnderfloor = this.add.rectangle(this.levelWidth / 2, this.floorY + 95, this.levelWidth, 190, 0x242d30);
        this.platforms = this.physics.add.staticGroup();
        this.createPrototypeTerrain();
        this.enemies = this.physics.add.group();
        this.graphicsEngine = new window.GraphicsEngine(this);
        this.createPlayer();
        this.player.x = Math.round(this.spawnX);
        this.player.body.updateFromGameObject();
        this.createExpeditionAstronaut();
        this.astronautFollower.setContextualFormation({ x: -112, y: 0 }, 'private-grip');
        this.physics.add.collider(this.player, this.platforms);

        this.gate = this.add.rectangle(this.levelWidth - 40, this.floorY - 42, 36, 84, 0x939b9b)
            .setStrokeStyle(2, 0xdde3e0).setDepth(700);
        this.physics.add.existing(this.gate, true);
        this.physics.add.collider(this.player, this.gate);
        this.arm = this.add.graphics().setDepth(800);
        this.contactShadow = this.add.ellipse(0, this.floorY, 70, 10, 0x020304, 0.45).setDepth(690);
        this.bossBody = this.add.rectangle(0, 0, 70, 104, 0xffffff, 0).setDepth(799);
        // Authored animation owns this body. Dynamic Arcade postUpdate would
        // apply an extra translation after a manual pose update.
        this.physics.add.existing(this.bossBody, true);
        this.bossHealth = 2;
        this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(10001);
        this.bossName = this.add.text(this.scale.width / 2, 78, 'TRUMPTOPUS', {
            fontFamily: 'Arial', fontSize: '18px', color: '#f3f3ec'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        this.healthText = this.add.text(18, 125, '', { fontFamily: 'Arial', fontSize: '15px', color: '#e4d7b9' })
            .setScrollFactor(0).setDepth(10001);
        this.setupInput();
        this.showPlatformerMobileControls();
        this.clearInput = ({ preserveFall = false } = {}) => {
            this.input.keyboard?.resetKeys();
            this.releaseAllPlatformerActionButtons();
            this.resetJoystick();
            this.virtualJoystickX = 0;
            this.virtualJoystickY = 0;
            this.clearVirtualJumpInput();
            this.player?.body?.setVelocityX(0);
            if (!preserveFall) this.player?.body?.setVelocityY(0);
        };
        this.blurHandler = () => {
            this.clearInput();
            this.setPrototypePaused(true);
        };
        this.focusHandler = () => {
            if (this.pauseMenuActive || this.isPlayerDead) return;
            this.clearInput();
            this.setPrototypePaused(false);
        };
        this.game.events.on('blur', this.blurHandler);
        this.game.events.on('focus', this.focusHandler);
        this.events.once('shutdown', () => {
            this.encounter.dispose();
            this.game.events.off('blur', this.blurHandler);
            this.game.events.off('focus', this.focusHandler);
            this.clearInput();
            this.resumeFailureRecoveryClock();
            this.cleanupPlatformerInputHandlers();
            this.scale.off('resize', this.handlePlatformerMobileResize, this);
            this.clearMobileControlCoach();
            this.input.keyboard.off('keydown-ESC');
            for (const key of [this.attackKey, this.rangedKey, this.specialKey, this.currentEcologyInteractKey]) key?.off('down');
            this.destroyPlatformerMobileControls();
            this.astronautFollower?.destroy();
        });
        this.drawExchange();
        window.prototypeScene = this;
    }

    // Deliberately avoid campaign pause, death, checkpoint and completion flows.
    showPauseMenu() {
        if (this.isPlayerDead) return;
        this.pauseMenuActive = !this.pauseMenuActive;
        this.clearInput();
        this.setPrototypePaused(this.pauseMenuActive);
        window.dispatchEvent(new CustomEvent('prototype-pause', { detail: this.pauseMenuActive }));
    }

    setPrototypePaused(paused) {
        this.encounter.setPaused(paused);
        this.time.paused = paused;
        if (paused) {
            this.physics.world.pause();
            this.tweens.pauseAll();
        } else {
            this.physics.world.resume();
            this.tweens.resumeAll();
        }
    }

    resolveBossHit(amount, { source = 'attack' } = {}) {
        const state = this.encounter.state;
        const applied = this.encounter.hit(amount);
        this.hitEvidence.push({ state, source, amount, applied });
        this.bossHealth = this.encounter.health;
        return applied;
    }

    performAttack(options) {
        if (!this.encounter.paused) super.performAttack(options);
    }

    performRangedAttack() {
        if (!this.encounter.paused) super.performRangedAttack();
    }

    performSpecialAttack() {
        if (!this.encounter.paused) super.performSpecialAttack();
    }

    update(time, delta) {
        if (!this.player?.body || this.encounter.disposed || this.encounter.paused) return;
        const body = this.player.body;
        this.isGrounded = Boolean(body.blocked.down || body.touching.down) && body.velocity.y >= -1;
        if (this.isGrounded) this.lastGroundedTime = time;
        this.handleDuck();
        this.handleMovement();
        if (!this.isDucking) this.handleJump(time);
        this.updatePlayerFacing();
        this.encounter.update(delta, body.center.x);
        this.updatePrototypeFollower(delta);
        this.drawExchange();
        const overlaps = this.overlapsAttack(body);
        if (this.encounter.consumeContact(overlaps) && time >= this.invulnerableUntil) {
            this.health = Math.max(0, this.health - 1);
            this.invulnerableUntil = time + 1000;
            this.damageEvidence.push({ state: this.encounter.state, health: this.health,
                progress: this.encounter.snapshot().progress, bottom: body.bottom,
                velocityY: body.velocity.y, hand: { ...this.handPose } });
            this.player.setTint(0xf18b78);
            if (this.health === 0) {
                this.isPlayerDead = true;
                this.blurHandler();
                window.dispatchEvent(new CustomEvent('prototype-defeat'));
            }
        }
        if (time >= this.invulnerableUntil) this.player.clearTint();
        this.healthText.setText(`Health ${this.health} / 4`);
    }

    updatePrototypeFollower(delta) {
        // Keep the supporting astronaut on the safe flank of a committed grab;
        // a trailing actor must not visibly walk into an attack the player dodged.
        const grabbing = ['windup', 'strike', 'contact', 'exposed'].includes(this.encounter.state);
        const allyX = Math.max(36, Math.min(
            this.player.x - 112,
            grabbing ? this.encounter.targetX - 86 : this.player.x - 112
        ));
        this.astronautFollower.followDistance = Math.max(112, Math.abs(this.player.x - allyX));
        this.astronautFollower.setContextualFormation({ x: allyX - this.player.x, y: 0 }, 'private-grip');
        this.astronautFollower.update(delta);
    }

    overlapsAttack(body) {
        const { x, y } = this.handPose;
        return body.right > x - 35 && body.left < x + 35 && body.bottom > y - 21 && body.top < y + 21;
    }

    drawExchange() {
        const { state, progress, targetX, health } = this.encounter.snapshot();
        const homeX = this.levelWidth * 0.66;
        let x = targetX;
        let y = this.floorY - 175;
        if (state === 'ready') x = homeX;
        if (state === 'windup') y -= Math.sin(progress * Math.PI / 2) * 55;
        if (state === 'strike') y = this.floorY - 230 + 207 * progress * progress;
        if (state === 'contact' || state === 'exposed') y = this.floorY - 23;
        if (state === 'recoil') {
            y = this.floorY - 23 - Math.sin(progress * Math.PI / 2) * 207;
            x += (homeX - targetX) * progress;
        }
        if (state === 'released') { x = homeX; y = this.floorY - 245; }
        this.handPose = { x, y };
        this.bossBody.setPosition(x, y - 31);
        this.bossBody.body.updateFromGameObject();
        this.bossBody.body.enable = state !== 'released';
        this.contactShadow.setPosition(x, this.floorY + 2).setScale(state === 'contact' || state === 'exposed' ? 1 : 0.7);
        this.contactShadow.setVisible(state !== 'released');
        const elbowX = Math.min(this.levelWidth - 44, x + 82);
        const elbowY = Math.min(y - 64, this.floorY - 145);
        this.arm.clear();
        this.arm.lineStyle(28, 0x697876, 1);
        this.arm.beginPath();
        this.arm.moveTo(this.levelWidth - 28, this.floorY - 265);
        this.arm.lineTo(elbowX, elbowY);
        this.arm.lineTo(x, y - 15);
        this.arm.strokePath();
        this.arm.lineStyle(8, state === 'exposed' ? 0xeecb79 : 0xa3b2ac, 1);
        this.arm.lineBetween(elbowX, elbowY, x, y - 15);
        this.arm.fillStyle(state === 'exposed' ? 0xeecb79 : 0x94a5a0);
        this.arm.fillRoundedRect(x - 28, y - 85, 56, 85, 12);
        this.arm.fillRoundedRect(x - 35, y - 21, 70, 42, 6);
        this.arm.fillStyle(0x4c5b5c);
        for (let i = 0; i < 3; i++) this.arm.fillRect(x - 30 + i * 23, y + 10, 14, 11);
        this.bossBar.clear();
        this.bossBar.fillStyle(0x434b4f).fillRect(this.levelWidth / 2 - 86, 96, 172, 7);
        this.bossBar.fillStyle(0xe8bb66).fillRect(this.levelWidth / 2 - 86, 96, 172 * health / 2, 7);
        const opening = health === 0 ? (state === 'released' ? 1 : progress) : 0;
        this.gate.y = this.floorY - 42 + opening * 84;
        this.gate.body.updateFromGameObject();
        this.gate.body.enable = opening < 1;
    }

    getProofState() {
        const visible = this.playerContactGeometry;
        const creatureLeft = this.player.x + (this.player.flipX
            ? this.player.width / 2 - visible.right - 1
            : visible.left - this.player.width / 2);
        return {
            ...this.encounter.snapshot(), hits: this.hitEvidence, damage: this.damageEvidence,
            player: { x: this.player.x, y: this.player.y, left: this.player.body.left, right: this.player.body.right,
                bottom: this.player.body.bottom, velocityY: this.player.body.velocity.y,
                texture: this.player.texture.key, facingRight: this.player.facingRight },
            hand: { x: this.bossBody.x, y: this.bossBody.y },
            astronaut: { x: this.astronautFollower.sprite.x, y: this.astronautFollower.sprite.y, width: this.astronautFollower.sprite.displayWidth },
            creatureBounds: { left: creatureLeft, right: creatureLeft + visible.width },
            floorY: this.floorY, gateEnabled: this.gate.body.enable,
            controls: Object.fromEntries(Object.entries(this.mobileControlTargets || {})
                .map(([key, { x, y, radius }]) => [key, { x, y, radius }])),
            joystick: { x: this.joystickCenterX, y: this.joystickCenterY },
            astronautPresent: Boolean(this.astronautFollower), playerHealth: this.health
        };
    }
}

import TrumptopusPrototypeLevel from './TrumptopusPrototypeLevel.js';
import { TrumptopusFinale } from '../systems/TrumptopusFinale.js';
import { getTrumptopusAttackPose, overlapsTrumptopusHazard } from '../systems/TrumptopusAttackPose.js';

// Private mechanics preview; deliberately absent from production scene registration.
export default class TrumptopusFinalePreview extends TrumptopusPrototypeLevel {
    createEncounter(data) {
        this.phaseEvidence = [];
        this.lastPreviewPhase = null;
        this.causewaySettled = false;
        return new TrumptopusFinale({ minX: 85, maxX: this.levelWidth - 115,
            checkpoint: data.checkpoint, completed: data.completed === true });
    }

    create() {
        super.create();
        this.causeway = this.add.rectangle(32, this.floorY + 40, 56, 20, 0xa6b6b1)
            .setStrokeStyle(2, 0xe8eee6).setDepth(695);
        this.physics.add.existing(this.causeway, true);
        this.causeway.body.checkCollision.down = false;
        this.causeway.body.checkCollision.left = false;
        this.causeway.body.checkCollision.right = false;
        this.physics.add.collider(this.player, this.causeway);
        this.response = this.add.graphics().setDepth(710);
    }

    overlapsAttack(body) {
        return overlapsTrumptopusHazard(body, this.pose?.hazards || []);
    }

    update(time, delta) {
        super.update(time, delta);
        if (this.encounter.disposed || this.encounter.paused) return;
        const state = this.encounter.snapshot();
        for (const event of this.encounter.drainEvents()) this.phaseEvidence.push(event);
        if (state.phaseIndex !== this.lastPreviewPhase) {
            this.lastPreviewPhase = state.phaseIndex;
            this.clearInput();
            // The small proof arena has no consumables; phase boundaries offer
            // a known baseline without changing any inventory or player save.
            this.health = this.productionFinale ? this.maxHealth : 4;
        }
        if (this.causeway) {
            const lifting = state.phaseIndex === 1 && state.mode === 'phase_intro';
            const lift = state.phaseIndex > 1 ? 1 : state.phaseIndex === 1 ? (lifting ? state.progress : 1) : 0;
            const occupied = this.player.body.left < 60 && this.player.body.right > 4;
            if (!this.causewaySettled && !occupied) {
                this.causeway.y = this.floorY + 40 - lift * 106;
                this.causeway.body.updateFromGameObject();
                this.causewaySettled = lift === 1;
            }
            this.causeway.body.enable = this.causewaySettled;
        }
        this.response.clear();
        if (state.phaseIndex === 2 && state.mode === 'phase_intro') {
            // The visible wave starts at the real creature's contact, not at the boss.
            const start = this.player.body.center.x;
            const end = start + (this.levelWidth - 40 - start) * state.progress;
            this.response.lineStyle(6, 0xa8e4bc, Math.sin(Math.PI * state.progress));
            this.response.lineBetween(start, this.floorY + 4, end, this.floorY + 4);
        }
        if (state.completionReady) {
            this.clearInput({ preserveFall: true });
            this.hidePlatformerMobileControls();
        }
    }

    drawExchange() {
        const state = this.encounter.snapshot();
        this.pose = getTrumptopusAttackPose(state, { width: this.levelWidth, floorY: this.floorY });
        const { palm, target } = this.pose;
        const { x, y, width, height } = palm;
        this.handPose = palm;
        this.bossBody.setPosition(target.x, target.y).setSize(target.width, target.height);
        this.bossBody.body.updateFromGameObject();
        this.bossBody.body.enable = state.mode === 'combat';
        this.arm.clear().setAlpha(this.pose.alpha);
        for (const limb of this.pose.limbs) {
            const handX = limb.palm.x, handWidth = limb.palm.width;
            this.arm.fillStyle(0x697876, 1);
            this.arm.fillPoints(limb.outline, true);
            this.arm.fillStyle(state.vulnerable ? 0xeecb79 : 0x94a5a0);
            if (!(state.attack === 'sweep' && ['strike', 'contact'].includes(state.state))) {
                this.arm.fillRoundedRect(handX - handWidth * 0.4, y - 85, handWidth * 0.8, 85, 12);
            }
            this.arm.fillRoundedRect(handX - handWidth / 2, y - height / 2, handWidth, height, 6);
        }
        this.contactShadow.setPosition(x, this.floorY + 2).setDisplaySize(width, 10).setAlpha(this.pose.alpha * 0.45);
        this.bossBar.clear();
        const barX = this.levelWidth / 2 - 86;
        this.bossBar.fillStyle(0x434b4f).fillRect(barX, 96, 172, 7);
        this.bossBar.fillStyle(0xe8bb66).fillRect(barX, 96, 172 * state.health / state.maxHealth, 7);
        this.bossBar.lineStyle(2, 0x15191c);
        for (const fraction of [10 / 24, 18 / 24]) this.bossBar.lineBetween(barX + 172 * fraction, 96, barX + 172 * fraction, 103);
        const opening = state.mode === 'aftermath' ? 1 : state.mode === 'banishment' ? state.progress : 0;
        this.gate.y = this.floorY - 42 + opening * 84;
        this.gate.body.updateFromGameObject();
        this.gate.body.enable = opening < 1;
    }

    getProofState() {
        return { ...super.getProofState(), phaseEvidence: this.phaseEvidence,
            hazards: this.pose.hazards, checkpoint: this.encounter.checkpoint(),
            causeway: this.causeway ? { y: this.causeway.y, bodyTop: this.causeway.body.top, artTop: this.causeway.y - 10, enabled: this.causeway.body.enable } : null };
    }
}

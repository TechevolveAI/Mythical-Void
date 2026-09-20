import { getRepairerPracticeStrike } from '../systems/RepairerWorkshop.js';

// Isolated bench demonstration: the production astronaut strike and combat
// profile, but no GameState writes, inventory use, rewards or level transitions.
export default class RepairerPractice {
    constructor(scene, snapshot, onClose, Astronaut) {
        this.scene = scene;
        this.snapshot = snapshot;
        this.onClose = onClose;
        this.Astronaut = Astronaut;
        this.objects = [];
        this.health = 6;
        this.distance = 56;
        this.build();
        this.keyHandler = event => {
            if (event.repeat) return;
            if (event.code === 'KeyX' || event.code === 'Space') { event.preventDefault(); event.stopImmediatePropagation(); this.strike(); }
            if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.destroy(true); }
        };
        window.addEventListener('keydown', this.keyHandler, true);
        this.resizeHandler = () => this.destroy(true);
        scene.scale.on('resize', this.resizeHandler);
    }

    own(object, depth = 910) { this.objects.push(object); return object.setDepth(depth); }

    label(x, y, text, size = 18, color = '#e8f3ef', width = null) {
        return this.own(this.scene.add.text(x, y, text, {
            fontFamily: 'Arial', fontSize: `${size}px`, color, align: 'center',
            wordWrap: width ? { width } : undefined
        }).setOrigin(0.5));
    }

    button(x, y, width, label, action) {
        this.own(this.scene.add.rectangle(x, y, width, 48, 0x39635b).setStrokeStyle(1, 0x8fbeb0));
        this.label(x, y, label, 16);
        const zone = this.own(this.scene.add.zone(x, y, width, 48).setInteractive({ useHandCursor: true }), 912);
        zone.on('pointerdown', (_pointer, _x, _y, event) => { event.stopPropagation(); action(); });
        return zone;
    }

    build() {
        const { width, height } = this.scene.scale;
        const center = width / 2;
        this.own(this.scene.add.rectangle(center, height / 2, width, height, 0x142b2b), 890);
        this.blocker = this.own(this.scene.add.zone(center, height / 2, width, height)
            .setInteractive(), 891);
        this.blocker.on('pointerdown', (_p, _x, _y, event) => event.stopPropagation());
        this.label(center, 38, 'At the workbench', 24);
        this.label(center, 76, 'Practice only. Nothing in your bag is used.', 14, '#b4cdc5', width - 32);
        this.label(center, 110, this.snapshot.summary, 16, '#e6c282', width - 32);
        const floorY = height < 500 ? height * 0.45 : Math.min(height * 0.53, height - 210);
        const playerX = center - 55;
        const floor = this.own(this.scene.add.graphics(), 892);
        floor.fillStyle(0x385751).fillRoundedRect(center - Math.min(230, width / 2 - 16), floorY + 28,
            Math.min(460, width - 32), 28, 8);
        floor.lineStyle(2, 0x83a593).lineBetween(16, floorY + 28, width - 16, floorY + 28);
        this.anchor = this.own(this.scene.add.zone(playerX, floorY, 1, 1), 892);
        this.astronaut = new this.Astronaut(this.scene, this.anchor, {
            mode: 'platformer', fieldKitRecovered: true,
            katanaUpgradeIds: this.snapshot.combat.upgradeIds
        });
        this.astronaut.sprite.setPosition(playerX, floorY);
        this.astronaut.sprite.y += floorY + 28 - this.astronaut.getContactY();
        this.astronaut.shadow.setPosition(playerX, floorY + 28);
        this.target = this.own(this.scene.add.graphics(), 896);
        this.status = this.label(center, floorY + 65, 'Ready', 18, '#e6c282', width - 32);
        this.drawTarget();
        const controlsY = height - 104;
        this.strikeButton = this.button(center - 77, controlsY, 140, 'Strike', () => this.strike());
        this.rangeButton = this.button(center + 77, controlsY, 140, 'Move target', () => {
            if (this.astronaut.isStriking || this.timer) return;
            this.distance = this.distance === 56 ? 80 : 56;
            this.health = 6;
            this.drawTarget();
            this.status.setText(this.distance === 80 ? 'Far target' : 'Near target');
        });
        this.backButton = this.button(center, height - 38, Math.min(294, width - 32), 'Back to repairer', () => this.destroy(true));
    }

    drawTarget() {
        this.target.setPosition(this.anchor.x + this.distance, this.anchor.y);
        this.target.clear();
        this.target.lineStyle(7, 0x5d766d).lineBetween(0, 5, 0, 26);
        this.target.fillStyle(0x526968).fillRoundedRect(-15, -23, 30, 35, 7);
        this.target.fillStyle(0xaaa37d).fillRoundedRect(-12, -23, 24, 28, 6);
        this.target.lineStyle(2, 0xe3d7a8).lineBetween(-7, -16, 6, -13).lineBetween(-6, -8, 7, -5);
        this.target.fillStyle(0x102e2c).fillRect(-18, -35, 36, 4);
        this.target.fillStyle(0x9ed7bd).fillRect(-18, -35, 36 * this.health / 6, 4);
    }

    strike() {
        if (!this.astronaut || this.astronaut.isStriking || this.timer) return;
        const combat = this.snapshot.combat;
        const result = getRepairerPracticeStrike(combat, this.distance, this.health);
        const performed = this.astronaut.performKatanaStrike({
            targetX: this.anchor.x + Math.min(this.distance, combat.enemyMeleeRange),
            targetY: this.anchor.y - 5,
            slashColor: combat.slashColor, slashGlowColor: combat.slashGlowColor
        });
        if (!performed) return;
        this.health = result.health;
        this.lastStrike = result;
        this.drawTarget();
        this.status.setText(result.hit ? `${result.damage} damage${this.health === 0 ? ' - target cleared!' : ''}` : 'Out of reach. Move the target closer.');
        this.targetTween = this.scene.tweens.add({ targets: this.target, angle: result.hit ? 10 : 0,
            duration: 85, yoyo: true, onComplete: () => { this.targetTween = null; } });
        if (this.health === 0) {
            this.timer = this.scene.time.delayedCall(900, () => {
                this.timer = null;
                this.health = 6;
                this.drawTarget();
            });
        }
    }

    destroy(notify = false) {
        if (this.closed) return;
        this.closed = true;
        window.removeEventListener('keydown', this.keyHandler, true);
        this.scene.scale.off('resize', this.resizeHandler);
        this.timer?.remove(false);
        this.targetTween?.stop();
        this.astronaut?.destroy();
        this.astronaut = null;
        this.objects.forEach(object => object.destroy());
        this.objects = [];
        if (notify) this.onClose?.();
    }
}

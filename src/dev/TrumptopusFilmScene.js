import Phaser from 'phaser';
import TrumptopusCutoutRig from './TrumptopusCutoutRig.js';
import { sampleTrumptopusFilm } from './TrumptopusFilmTimeline.js';
import { paintVoidTear } from './TrumptopusVoidTearMaterial.js';
export { Phaser };

// Offline private film stage. No gameplay scene registration, saves or services.
export default class TrumptopusFilmScene extends Phaser.Scene {
    constructor() { super('TrumptopusFilm'); }

    preload() {
        this.load.image('film-boss-source', new URL('./assets/trumptopus/source-foreground.png', import.meta.url).href);
        this.load.image('film-world-source', new URL('./assets/trumptopus/source-landscape.png', import.meta.url).href);
    }

    create() {
        this.keys = [];
        const source = this.textures.get('film-world-source').getSourceImage();
        const makeTexture = (name, width, height, paint) => {
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            paint(canvas.getContext('2d'), canvas);
            const key = `authored-film-${name}`;
            this.textures.addCanvas(key, canvas); this.keys.push(key); return key;
        };
        // x >= 510 omits the baked-in figure entirely; the animated rig is the only boss.
        const background = makeTexture('background', 834, 850, ctx => ctx.drawImage(source, 510, 0, 834, 850, 0, 0, 834, 850));
        this.backdrop = this.add.image(640, 340, background).setDisplaySize(1450, 1050).setDepth(-10);
        this.shade = this.add.rectangle(640, 360, 1600, 1000, 0x040810, .27).setDepth(-9);
        const rock = makeTexture('stone', 760, 420, ctx => {
            ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(138, 27); ctx.lineTo(251, 39);
            ctx.lineTo(402, 10); ctx.lineTo(572, 25); ctx.lineTo(735, 0); ctx.lineTo(750, 32);
            ctx.lineTo(760, 155); ctx.lineTo(760, 420); ctx.lineTo(0, 420); ctx.lineTo(0, 42); ctx.closePath(); ctx.clip();
            // Lower-left foreground is entirely rock, outside the baked-in
            // character. Its deeper crop avoids repeating the gameplay lip.
            ctx.drawImage(source, 0, 800, 150, 208, 0, 0, 760, 420);
            const depth = ctx.createLinearGradient(0, 0, 0, 420);
            depth.addColorStop(0, 'rgba(155,173,192,.28)');
            depth.addColorStop(.15, 'rgba(9,12,19,.08)');
            depth.addColorStop(1, 'rgba(1,4,9,.38)');
            ctx.fillStyle = depth; ctx.fillRect(0, 0, 760, 420);
        });
        this.stones = [this.add.image(280, 460, rock), this.add.image(1000, 460, rock)];
        this.stones.forEach(stone => stone.setOrigin(.5,0).setDisplaySize(720, 330).setDepth(1));
        this.dais = this.add.image(675, 483, rock).setOrigin(.5,0).setDisplaySize(350, 130).setDepth(2);
        this.shadow = this.add.ellipse(675, 505, 220, 24, 0x020407, .75).setDepth(3);
        const tearKey = makeTexture('tear', 192, 320, (_, canvas) => paintVoidTear(canvas, source));
        this.tear = this.add.image(700, 315, tearKey).setDepth(4).setVisible(false);
        this.rig = new TrumptopusCutoutRig(this, this.textures.get('film-boss-source').getSourceImage(), {
            x: 675, floorY: 504, height: 432, prefix: 'authored-film-boss'
        });
        this.rig.root.setDepth(5);
        this.contacts = [0,1].map(()=>this.add.ellipse(0,0,72,12,0x010309,.45).setDepth(4));
        this.response = this.add.graphics().setDepth(7);
        this.events.once('shutdown', () => {
            this.rig.destroy(); this.keys.forEach(key => this.textures.remove(key));
        });
        this.paint('arrival', 0);
        window.filmScene = this;
    }

    paint(film, time) {
        const p = sampleTrumptopusFilm(film, time), rig = this.rig;
        this.pose = p;
        const palms = [
            { x: 426 - p.gap, y: 536, width: 65, height: 30 },
            { x: 882 + p.gap, y: 536, width: 65, height: 30 }
        ];
        rig.setAttackPose({ state: 'contact', progress: .3 + .7 * p.grasp, vulnerable: false }, {
            alpha: 1, limbs: palms.map(palm => ({ palm }))
        });
        // Each connected hand releases before the body is pulled away.
        for (const [index, side] of ['left', 'right'].entries()) {
            const release = index ? p.rightRelease : p.leftRelease;
            if (release === 0) continue;
            const joint = rig.joints.find(value => value.side === side);
            const wrist = [joint.wrist[0] + (640 - joint.wrist[0]) * release * .42,
                joint.wrist[1] - 200 * release];
            rig.sprites.get(`hand-${side}`).setPosition(...wrist).setRotation((index ? -1 : 1) * .12 * release);
            rig.paintForearm(side, joint.elbow, wrist, { startAngle: joint.upperAngle, articulation: 1,
                wave: 35 * release, travel: release, tipScale: rig.sprites.get(`hand-${side}`).scaleX });
        }
        const scale = rig.scale * (1 - .96 * p.pull);
        rig.root.setRotation(-.12 * p.pull).setScale(scale).setVisible(p.bossVisible);
        const angle = rig.root.rotation;
        rig.root.setPosition(675 + 25 * p.pull - (640 * Math.cos(angle) - 1908 * Math.sin(angle)) * scale,
            504 - 168 * p.pull - (640 * Math.sin(angle) + 1908 * Math.cos(angle)) * scale);
        this.shadow.setAlpha(.75 * (1 - p.pull)).setScale(1 - p.pull * .8);
        this.tear.setVisible(p.tear > .01).setDisplaySize(310 * Math.max(.01, p.tear), 470 * Math.max(.01, p.tear));
        this.stones[0].setX(280 - p.gap).setRotation(-.008 * p.grasp * (1 - p.recovery));
        this.stones[1].setX(1000 + p.gap).setRotation(.008 * p.grasp * (1 - p.recovery));
        this.response.clear();
        this.contacts.forEach((shadow,index)=>shadow.setPosition(palms[index].x,552)
            .setAlpha(.45*(1-(index?p.rightRelease:p.leftRelease))));
        this.stones.forEach(stone => stone.setTint(Phaser.Display.Color.GetColor(
            195 + Math.round(p.recovery * 45), 203 + Math.round(p.recovery * 40), 214 + Math.round(p.recovery * 20))));
        this.shade.setAlpha(.27 * (1 - p.recovery));
        if (p.recovery > 0 && p.recovery < 1) {
            const y = 675 - p.recovery * 220;
            this.response.lineStyle(5, 0xc3e5d0, .6 * Math.sin(p.recovery * Math.PI));
            this.response.beginPath(); this.response.moveTo(140, y + 25);
            this.response.lineTo(480, y); this.response.lineTo(790, y + 10); this.response.lineTo(1110, y - 28); this.response.strokePath();
        }
        this.cameras.main.setZoom(p.cameraZoom).setScroll(p.cameraX, p.cameraY);
        return { ...p, generated: false, sourceArtworkOnly: true, bossCount: p.bossVisible ? 1 : 0 };
    }
}

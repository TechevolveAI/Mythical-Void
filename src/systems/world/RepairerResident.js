import Phaser from 'phaser';

function shape(g, color, points, alpha = 1) {
    g.fillStyle(color, alpha);
    g.fillPoints(new Phaser.Curves.Spline(points).getPoints(32), true);
}

// Small, articulated world resident. The portrait is deliberately not used as a
// map texture: eyes, work arm and tool are separate, readable moving parts.
export default class RepairerResident {
    constructor(scene, x, y, scale = 1) {
        this.scene = scene;
        this.container = scene.add.container(x, y).setScale(scale);
        const body = scene.add.graphics();
        body.fillStyle(0x132d2a, 0.25).fillEllipse(0, 33, 55, 11);
        shape(body, 0x32263f, [-24, 27, -20, -16, 0, -30, 23, -14, 26, 28, 0, 33, -24, 27]);
        shape(body, 0x5a456c, [-18, 25, -18, -9, -5, -19, 0, 14, -6, 29, -18, 25]);
        body.lineStyle(2, 0xa795b4, 0.7).lineBetween(-18, -6, -16, 22);
        body.fillStyle(0x827268).fillRoundedRect(-14, 11, 27, 18, 3);
        body.lineStyle(2, 0x3c4243).lineBetween(-8, 16, -8, 27).lineBetween(3, 14, 3, 25);
        body.lineStyle(3, 0xc1ccd0).lineBetween(-5, 12, -3, 3);
        this.head = scene.add.container(0, -20);
        const hood = scene.add.graphics();
        shape(hood, 0x35253f, [-23, 12, -28, -15, -7, -35, 21, -27, 27, 0, 19, 17, -23, 12]);
        shape(hood, 0x806487, [-24, -16, -7, -33, 19, -25, 25, -6, 9, -17, -12, -13, -24, -16]);
        hood.fillStyle(0xb299b1).fillEllipse(0, -1, 35, 30);
        hood.fillStyle(0x967395).fillEllipse(0, 6, 31, 17);
        hood.lineStyle(2, 0xdac7d7).lineBetween(-15, -8, -8, -11).lineBetween(7, -11, 15, -7);
        hood.lineStyle(3, 0x806487).lineBetween(-18, 4, -24, 11).lineBetween(18, 4, 24, 9);
        hood.lineStyle(1.5, 0x544657).lineBetween(-4, 8, 3, 10).lineBetween(3, 10, 8, 7);
        this.eyes = scene.add.graphics();
        [-8, 8].forEach(eyeX => {
            this.eyes.fillStyle(0x163a41).fillEllipse(eyeX, -2, 10, 12);
            this.eyes.fillStyle(0x79d9d3).fillEllipse(eyeX + 1, -2, 5, 8);
            this.eyes.fillStyle(0xf2ffed).fillCircle(eyeX + 2, -4, 1.5);
        });
        this.head.add([hood, this.eyes]);
        this.arm = scene.add.container(-18, -2);
        const arm = scene.add.graphics();
        arm.lineStyle(10, 0x414f57).lineBetween(0, 0, 13, 11).lineBetween(13, 11, 32, 5);
        arm.lineStyle(6, 0xa4b5b5).lineBetween(1, -1, 13, 9).lineBetween(13, 9, 31, 4);
        arm.fillStyle(0xd6b56d).fillCircle(13, 10, 4);
        arm.lineStyle(2, 0xdbe3d9).lineBetween(31, 4, 38, 6).lineBetween(31, 4, 37, 0);
        arm.lineStyle(2, 0xe5c782).lineBetween(36, 4, 41, 17);
        this.arm.add(arm);
        const hand = scene.add.graphics();
        hand.lineStyle(7, 0x806487).lineBetween(22, 3, 24, 18);
        hand.fillStyle(0xb299b1).fillEllipse(22, 18, 13, 7);
        this.container.add([body, this.head, hand, this.arm]);
        this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        this.tick = time => {
            if (this.reducedMotion || !this.container?.active) return;
            const noticed = time < (this.noticeUntil || 0);
            this.arm.rotation = noticed ? -0.18 : Math.sin(time / 350) * 0.15;
            this.head.rotation = noticed ? -0.1 : Math.sin(time / 1700) * 0.04;
            this.eyes.scaleY = time % 4700 < 140 ? 0.14 : 1;
        };
        scene.events.on('update', this.tick);
        this.onShutdown = () => this.destroy();
        scene.events.once('shutdown', this.onShutdown);
    }

    notice() { this.noticeUntil = this.scene.time.now + 2200; }

    destroy() {
        if (!this.container) return;
        this.scene.events.off('update', this.tick);
        this.scene.events.off('shutdown', this.onShutdown);
        this.container.destroy();
        this.container = null;
    }
}

function bakeWorkshopBackdrop(scene) {
    if (scene.textures.exists('livingWorkshopBack')) return;
    const g = scene.add.graphics();
    // Bake only scenery, keeping the live resident and task lamp out of it.
    g.fillStyle(0x081e1d, 0.32).fillEllipse(160, 280, 285, 35);
    [52, 269].forEach((x, index) => {
        const lean = index ? -15 : 12;
        g.lineStyle(30, 0x253d3b).strokePoints(new Phaser.Curves.Spline([x - lean, 277, x, 192, x + lean, 113, x - 10, 69]).getPoints(25));
        g.lineStyle(18, 0x526660).strokePoints(new Phaser.Curves.Spline([x - lean - 4, 269, x - 4, 192, x + lean - 4, 116, x - 14, 69]).getPoints(25));
        g.lineStyle(3, 0x99a980, 0.7).lineBetween(x - 5, 199, x + lean - 5, 124);
    });
    shape(g, 0x243f42, [20, 110, 46, 63, 117, 32, 214, 43, 279, 80, 301, 117, 215, 106, 129, 124, 20, 110]);
    shape(g, 0x4c7d76, [19, 105, 64, 57, 128, 28, 172, 65, 120, 109, 19, 105]);
    shape(g, 0x649187, [127, 31, 211, 37, 288, 92, 300, 110, 216, 97, 171, 65, 127, 31]);
    g.lineStyle(2, 0xa8cbb0, 0.8).strokePoints(new Phaser.Curves.Spline([28, 101, 91, 74, 128, 36]).getPoints(20));
    g.lineStyle(2, 0xb8c98e, 0.7).strokePoints(new Phaser.Curves.Spline([148, 45, 208, 62, 288, 105]).getPoints(20));
    g.fillStyle(0x293d3f).fillRoundedRect(63, 157, 195, 15, 5);
    // Recognizable supplies tucked under the canopy, not floating map icons.
    [0, 1, 2].forEach(i => {
        g.fillStyle([0xdfd8b4, 0xc2cda3, 0xdfada6][i]).fillEllipse(76 + i * 17, 147 - i % 2 * 4, 14, 19);
        g.fillStyle(0xf3ead2, 0.6).fillEllipse(73 + i * 17, 142 - i % 2 * 4, 4, 6);
    });
    g.fillStyle(0x688e90).fillRoundedRect(206, 136, 19, 22, 3);
    g.fillStyle(0xc5d8c1).fillRect(211, 130, 9, 6);
    g.lineStyle(4, 0xb2bdbc).lineBetween(244, 136, 238, 157);
    g.fillStyle(0xd7af6b).fillCircle(244, 135, 6);
    g.generateTexture('livingWorkshopBack', 320, 310);
    g.destroy();
}

export function createLivingWorkshop(scene, shop) {
    bakeWorkshopBackdrop(scene);
    shop.setTexture('livingWorkshopBack').setDisplaySize(250, 242);
    const resident = new RepairerResident(scene, shop.x, shop.y + 20, 0.88);
    resident.container.setDepth(shop.y + 1);
    const counter = scene.add.graphics().setPosition(shop.x, shop.y).setDepth(shop.y + 2);
    shape(counter, 0x263c3c, [-89, 44, -59, 49, 69, 45, 90, 39, 81, 93, 28, 102, -70, 97, -89, 44]);
    shape(counter, 0x72887b, [-98, 35, -32, 30, 73, 29, 99, 39, 90, 51, -34, 55, -98, 46, -98, 35]);
    counter.lineStyle(2, 0xbbcba4, 0.8).lineBetween(-82, 37, 82, 34);
    counter.lineStyle(2, 0x527b73).lineBetween(-57, 62, -52, 90).lineBetween(60, 60, 55, 88);
    counter.lineStyle(4, 0xb4c2c1).lineBetween(7, 31, 51, 30);
    counter.lineStyle(5, 0x594860).lineBetween(-10, 32, 7, 31);
    counter.lineStyle(3, 0xd8b567).lineBetween(8, 25, 8, 36);
    // Fixed task lamp: its gentle movement comes from the working resident.
    counter.lineStyle(4, 0x929f92).lineBetween(68, 29, 77, -29).lineBetween(77, -29, 38, -39);
    counter.fillStyle(0xd9b472).fillEllipse(36, -36, 21, 14);
    counter.fillStyle(0xffe1a1).fillEllipse(36, -32, 15, 5);
    const sign = scene.add.text(shop.x - 14, shop.y + 77, 'SHOP', {
        fontFamily: 'Arial', fontStyle: 'bold', fontSize: '15px', color: '#e8e7c8',
        stroke: '#263c3c', strokeThickness: 2
    }).setOrigin(0.5).setDepth(shop.y + 3);
    shop.repairer = resident;
    const cleanup = () => {
        resident.destroy(); counter.destroy(); sign.destroy();
        shop.off('destroy', cleanup);
        scene.events.off('shutdown', cleanup);
    };
    shop.once('destroy', cleanup);
    scene.events.once('shutdown', cleanup);
    return resident;
}

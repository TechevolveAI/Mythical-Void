import Phaser from 'phaser';

function roundedShape(graphics, color, points, alpha = 1) {
    const outline = new Phaser.Curves.Spline(points).getPoints(64);
    graphics.fillStyle(color, alpha).fillPoints(outline, true);
    return outline;
}

/** A friendly, patched egg machine, built in the same material palette as the shop. */
export function createFusionPodArtwork(scene, group) {
    const glow = scene.add.graphics();
    const base = scene.add.graphics();
    const shell = scene.add.graphics();
    const lights = scene.add.graphics();

    base.fillStyle(0x102925, 0.3).fillEllipse(0, 51, 248, 52);
    // A low workshop plinth and two deliberately oversized, duck-like feet.
    base.fillStyle(0x263c3c).fillRoundedRect(-104, 28, 208, 24, 11);
    base.fillStyle(0x72887b).fillEllipse(0, 29, 212, 36);
    base.lineStyle(2, 0xbbcba4).strokeEllipse(0, 29, 212, 36);
    [-31, 31].forEach(x => {
        base.fillStyle(0x8c693e).fillEllipse(x, 48, 51, 24);
        base.fillStyle(0xe1b468).fillEllipse(x, 44, 49, 22);
        base.lineStyle(2, 0xb3834b, 0.9);
        base.lineBetween(x - 6, 47, x - 8, 52);
        base.lineBetween(x + 6, 47, x + 8, 52);
    });

    // Two small input chambers visibly join the big central pod.
    [-1, 1].forEach(side => {
        const x = side * 86;
        const tint = side < 0 ? 0x8ac9b0 : 0xc4a8db;
        const pipe = new Phaser.Curves.Spline([
            x, 17, side * 69, 28, side * 47, 28, side * 30, 17
        ]).getPoints(24);
        base.lineStyle(12, 0x314a49).strokePoints(pipe);
        base.lineStyle(7, 0xb8c9ab).strokePoints(pipe);
        base.lineStyle(3, tint).strokePoints(pipe);
        base.fillStyle(0x263c3c).fillRoundedRect(x - 19, -27, 38, 66, 16);
        base.fillStyle(0x496e68).fillRoundedRect(x - 15, -23, 30, 55, 13);
        base.lineStyle(2, 0xa8cbb0).strokeRoundedRect(x - 19, -27, 38, 66, 16);
        base.fillStyle(tint, 0.32).fillEllipse(x, 5, 27, 43);
        roundedShape(base, tint, [
            x, -14, x - 9, -2, x - 10, 13, x, 20,
            x + 10, 13, x + 9, -2, x, -14
        ]);
        base.fillStyle(0xfff4d7, 0.8).fillEllipse(x - 4, 0, 4, 10);
        base.fillStyle(0xd6b56d).fillRoundedRect(x - 21, 27, 42, 10, 4);
        base.fillStyle(0xd6b56d).fillEllipse(x, -24, 36, 10);
    });

    const outline = roundedShape(shell, 0xf2e7be, [
        0, -110, -30, -96, -53, -60, -63, -13, -55, 22,
        -31, 42, 0, 47, 31, 42, 55, 22, 63, -13,
        53, -60, 30, -96, 0, -110
    ]);
    roundedShape(shell, 0xd9c495, [
        -37, -83, -55, -44, -57, -4, -46, 27, -19, 40,
        -37, 32, -59, 13, -63, -19, -51, -62, -37, -83
    ]);
    // The lilac half and brass zigzag seam make the fused construction visible.
    roundedShape(shell, 0xbca8d5, [
        0, -110, 30, -96, 53, -60, 63, -13, 55, 22,
        31, 42, 0, 47, 6, 25, 0, 3, 7, -20,
        0, -42, 7, -65, 0, -88, 0, -110
    ]);
    roundedShape(shell, 0x897eaa, [
        44, -76, 58, -43, 63, -13, 55, 22, 31, 42,
        15, 45, 40, 25, 50, -9, 47, -45, 44, -76
    ], 0.65);
    shell.lineStyle(3, 0x5b655e).strokePoints(outline, true);
    shell.lineStyle(3, 0xd6b56d).strokePoints([
        { x: 0, y: -107 }, { x: 7, y: -85 }, { x: 0, y: -65 },
        { x: 7, y: -43 }, { x: 0, y: -23 }
    ]);
    [-90, -70].forEach(y => {
        shell.lineStyle(2, 0x775d43).lineBetween(-3, y, 10, y - 3);
    });
    shell.fillStyle(0xfff9dc, 0.8).fillEllipse(-31, -63, 12, 32);
    shell.fillStyle(0xf4e9f7, 0.5).fillEllipse(31, -80, 8, 15);

    // A small tuft, curious eyes and a beak give the machine a gentle character.
    shell.lineStyle(5, 0x72887b).lineBetween(2, -111, 8, -124);
    shell.fillStyle(0xd6b56d).fillEllipse(11, -124, 15, 10);
    [-19, 19].forEach((x, index) => {
        shell.fillStyle(0x59645e).fillEllipse(x, -49, 22, 26);
        shell.fillStyle(0xfff9e8).fillEllipse(x, -51, 19, 24);
        shell.fillStyle(index ? 0x655280 : 0x355e57).fillEllipse(x + 2, -48, 9, 13);
        shell.fillStyle(0xffffff).fillCircle(x + 4, -52, 3);
    });
    shell.fillStyle(0xe5bd74).fillTriangle(-10, -33, 10, -33, 0, -24);
    shell.lineStyle(2, 0xb3864c).lineBetween(-8, -33, 8, -33);
    shell.fillStyle(0xd99ca3, 0.6).fillEllipse(-34, -30, 13, 7);
    shell.fillStyle(0xd99ca3, 0.6).fillEllipse(34, -30, 13, 7);

    // A glazed hatch with a new egg, framed like the shop's brass work lamps.
    shell.fillStyle(0x415b57).fillRoundedRect(-39, -16, 78, 55, 24);
    shell.lineStyle(5, 0xd6b56d).strokeRoundedRect(-39, -16, 78, 55, 24);
    shell.fillStyle(0x94d3bc, 0.3).fillEllipse(0, 12, 65, 43);
    roundedShape(shell, 0xf4df9d, [
        0, -7, -11, 3, -15, 17, -8, 27, 8, 27,
        15, 17, 11, 3, 0, -7
    ]);
    shell.fillStyle(0xfff5cd).fillEllipse(-5, 6, 5, 12);
    shell.fillStyle(0x76b9a1).fillCircle(-5, 19, 3);
    shell.fillStyle(0xab8dc7).fillCircle(5, 14, 3);
    shell.lineStyle(3, 0xebfff3, 0.65).lineBetween(-26, 1, -20, -5);
    [-32, 32].forEach(x => {
        shell.fillStyle(0xf2d78b).fillCircle(x, 12, 3);
    });

    // Attached signboards keep labels readable against the detailed forest floor.
    base.fillStyle(0x263c3c).fillRoundedRect(-69, 60, 138, 27, 7);
    base.lineStyle(2, 0xd6b56d).strokeRoundedRect(-69, 60, 138, 27, 7);
    base.lineStyle(3, 0x72887b).lineBetween(-46, 49, -46, 60);
    base.lineBetween(46, 49, 46, 60);
    base.fillStyle(0x152b29, 0.92).fillRoundedRect(-113, 92, 226, 23, 8);

    group.add([glow, base, shell, lights]);
    return { glow, lights };
}

export function refreshFusionPodLights(lights, snapshot, color) {
    lights.clear();
    // These are machine lights, not player creatures or a fabricated fusion result.
    const ready = snapshot.tone === 'ready';
    [-86, 86].forEach(x => {
        lights.fillStyle(color, ready ? 0.9 : 0.6).fillCircle(x, -24, 4);
        lights.fillStyle(0xfff8d8, 0.8).fillCircle(x - 1, -25, 1.5);
    });
    lights.lineStyle(2, color, ready ? 0.8 : 0.35);
    lights.strokeEllipse(0, 12, 55, 37);
}

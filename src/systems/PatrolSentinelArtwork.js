export const PATROL_SENTINEL_FRAME = Object.freeze({
    width: 64,
    height: 70,
    bodyWidth: 44,
    bodyHeight: 52,
    bodyLeft: 10,
    bodyTop: 9,
    landingCap: Object.freeze({ x: 12, y: 9, width: 40, height: 14, radius: 6 }),
    feet: Object.freeze([
        Object.freeze({ x: 15, y: 53, width: 12, height: 8 }),
        Object.freeze({ x: 37, y: 53, width: 12, height: 8 })
    ])
});

// This sentinel's soft gold crown is a landing surface. Avoid a pointed crown
// that reads as a hazard; the shared combat cue carries the remaining hit count.
export function drawPatrolSentinelArtwork(graphics, {
    bodyColor = 0x274C5B,
    accentColor = 0x8FE3CF,
    eyeColor = 0xF2C94C
} = {}) {
    const frame = PATROL_SENTINEL_FRAME;
    const cap = frame.landingCap;

    graphics.fillStyle(0x101B26, 1);
    frame.feet.forEach(foot => graphics.fillEllipse(foot.x + foot.width / 2, foot.y + foot.height / 2, foot.width, foot.height));
    graphics.fillStyle(bodyColor, 1);
    graphics.fillEllipse(32, 38, 44, 40);
    graphics.fillStyle(0xFFFFFF, 0.08);
    graphics.fillEllipse(30, 33, 32, 26);
    graphics.fillStyle(0x101B26, 0.35);
    graphics.fillEllipse(32, 48, 32, 14);
    graphics.fillStyle(accentColor, 0.25);
    graphics.fillEllipse(32, 46, 28, 7);
    graphics.lineStyle(2, accentColor, 0.8);
    graphics.strokeEllipse(32, 38, 42, 38);

    graphics.fillStyle(bodyColor, 1);
    graphics.fillEllipse(32, 21, 44, 14);
    graphics.fillStyle(0xF2C94C, 1);
    graphics.fillRoundedRect(cap.x, cap.y, cap.width, cap.height, cap.radius);
    graphics.fillStyle(0xFFF1B7, 0.95);
    graphics.fillRoundedRect(19, 11, 26, 4, 2);
    graphics.fillStyle(0xA36E24, 0.8);
    graphics.fillRoundedRect(19, 20, 26, 3, 1);

    graphics.fillStyle(eyeColor, 1);
    graphics.fillEllipse(24, 34, 8, 10);
    graphics.fillEllipse(40, 34, 8, 10);
    graphics.fillStyle(0x101B26, 1);
    graphics.fillEllipse(25, 35, 3, 6);
    graphics.fillEllipse(39, 35, 3, 6);
    graphics.lineStyle(2, 0x101B26, 0.9);
    graphics.lineBetween(19, 28, 28, 30);
    graphics.lineBetween(36, 30, 45, 28);
    graphics.fillEllipse(32, 42, 8, 3);
    return frame;
}

// Paint only: collision, attacks and health continue to belong to the level.
export function drawMountainPressureBar(graphics, { x, y, width, height }, healthRatio) {
    const ratio = Number.isFinite(healthRatio) ? Math.max(0, Math.min(1, healthRatio)) : 0;
    const cut = 7;
    const outline = [
        { x: x + cut, y }, { x: x + width - cut, y },
        { x: x + width, y: y + height / 2 },
        { x: x + width - cut, y: y + height }, { x: x + cut, y: y + height },
        { x, y: y + height / 2 }
    ];
    graphics.clear();
    graphics.fillStyle(0x0A121B, 0.98);
    graphics.fillPoints(outline, true);
    const fillWidth = Math.max(0, (width - 16) * ratio);
    if (fillWidth > 0) {
        graphics.fillStyle(ratio <= 0.25 ? 0xBD864E : 0x317E8C, 1);
        graphics.fillRect(x + 8, y + 3, fillWidth, height - 6);
        graphics.fillStyle(ratio <= 0.25 ? 0xF5CA86 : 0xA1E2E7, 0.6);
        graphics.fillRect(x + 8, y + 3, fillWidth, 2);
        // Cleavage planes belong inside the mineral, not outside the readable bar.
        graphics.lineStyle(1, 0x102834, 0.45);
        for (let i = 1; i < 15; i++) {
            const dx = (width - 16) * i / 15;
            if (dx + 4 >= fillWidth) break;
            graphics.lineBetween(x + 8 + dx, y + height - 3, x + 12 + dx, y + 5);
        }
    }
    graphics.lineStyle(1, 0x88B8C9, 0.9);
    graphics.strokePoints(outline, true);
    graphics.lineStyle(2, 0xEEEAF6, 0.95);
    graphics.lineBetween(x + cut, y, x + width * 0.24, y);
    graphics.lineBetween(x + width * 0.76, y, x + width - cut, y);
}

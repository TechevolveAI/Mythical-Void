const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../systems/MountainBossPresentation.js'), 'utf8');
const draw = new Function(`${source.replace(/^export /gm, '')}; return drawMountainPressureBar;`)();
const bar = { x: 40, y: 118, width: 310, height: 18 };
function graphics() {
    return Object.fromEntries(['clear', 'fillStyle', 'fillPoints', 'fillRect', 'lineStyle', 'lineBetween', 'strokePoints']
        .map(key => [key, jest.fn()]));
}

test.each([1, 0.6, 0.1, 0, -1, 2, NaN, Infinity])('mineral bar stays inside phone bounds at ratio %s', ratio => {
    const g = graphics();
    draw(g, bar, ratio);
    expect(g.clear).toHaveBeenCalledTimes(1);
    for (const [points] of g.fillPoints.mock.calls.concat(g.strokePoints.mock.calls)) {
        for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(bar.x);
            expect(point.x).toBeLessThanOrEqual(bar.x + bar.width);
            expect(point.y).toBeGreaterThanOrEqual(bar.y);
            expect(point.y).toBeLessThanOrEqual(bar.y + bar.height);
        }
    }
    for (const [x, y, width, height] of g.fillRect.mock.calls) {
        expect(width).toBeGreaterThan(0);
        expect(x + width).toBeLessThanOrEqual(bar.x + bar.width);
        expect(y + height).toBeLessThanOrEqual(bar.y + bar.height);
    }
    const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    if (!clamped) expect(g.fillRect).not.toHaveBeenCalled();
    else expect(g.fillRect.mock.calls[0][2]).toBeCloseTo((bar.width - 16) * clamped);
});

test('health changes mineral colour, without adding animated scene objects or gameplay', () => {
    const g = graphics();
    draw(g, bar, 1);
    expect(g.fillStyle).toHaveBeenCalledWith(0x317E8C, 1);
    g.fillStyle.mockClear();
    draw(g, bar, 0.2);
    expect(g.fillStyle).toHaveBeenCalledWith(0xBD864E, 1);
    expect(source).not.toMatch(/(?:tweens|physics|Math\.random|setInterval)/);
});

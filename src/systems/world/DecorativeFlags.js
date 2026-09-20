// Decorative fabric only: no input, physics, rewards or saved state.
export const PALESTINIAN_FLAG_COLORS = Object.freeze({
    black: 0x171b1c, white: 0xf4f3e9, green: 0x009b48, red: 0xee2935
});

export function drawFlagFabric(graphics, width, height, phase = 0) {
    const wave = x => Math.sin(x / width * 7 - phase) * height * 0.09 * x / width;
    const bands = [PALESTINIAN_FLAG_COLORS.black, PALESTINIAN_FLAG_COLORS.white, PALESTINIAN_FLAG_COLORS.green];
    const strips = 8;
    bands.forEach((color, band) => {
        graphics.fillStyle(color, 1);
        for (let i = 0; i < strips; i++) {
            const left = width * i / strips;
            const right = width * (i + 1) / strips;
            const top = height * band / 3;
            const bottom = height * (band + 1) / 3;
            graphics.fillPoints([
                { x: left, y: top + wave(left) }, { x: right, y: top + wave(right) },
                { x: right, y: bottom + wave(right) }, { x: left, y: bottom + wave(left) }
            ], true);
        }
    });
    const tip = width * 0.45;
    const triangle = [];
    for (let i = 0; i <= strips; i++) {
        const x = tip * i / strips;
        triangle.push({ x, y: height * 0.5 * i / strips + wave(x) });
    }
    for (let i = strips - 1; i >= 0; i--) {
        const x = tip * i / strips;
        triangle.push({ x, y: height * (1 - 0.5 * i / strips) + wave(x) });
    }
    graphics.fillStyle(PALESTINIAN_FLAG_COLORS.red, 1).fillPoints(triangle, true);
    graphics.lineStyle(0.7, 0xc8d4cb, 0.45).lineBetween(0, 0, width, wave(width));
}

export function createDecorativeFlag(scene, {
    x, y, width = 32, height = width / 2, poleHeight = height + 22,
    depth = y, scrollFactor = 1, owner = null, placement = 'decoration'
}) {
    const graphic = scene.add.graphics().setPosition(x, y).setDepth(depth).setScrollFactor(scrollFactor);
    graphic.setData('decorativeFlag', 'palestinian');
    graphic.setData('flagPlacement', placement);
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    let lastDraw = -Infinity;
    const draw = phase => {
        graphic.clear();
        graphic.lineStyle(2, 0xb1bdb0).lineBetween(-1, -3, -1, poleHeight);
        drawFlagFabric(graphic, width, height, phase);
    };
    draw(0);
    const update = time => {
        if (!graphic.active || !graphic.visible || graphic.alpha === 0 || time - lastDraw < 100) return;
        lastDraw = time;
        draw(time / 600);
    };
    const destroy = () => { if (graphic.scene) graphic.destroy(); };
    const detach = () => {
        scene.events.off('update', update);
        scene.events.off('shutdown', destroy);
        owner?.off('destroy', destroy);
    };
    if (!reducedMotion) scene.events.on('update', update);
    scene.events.once('shutdown', destroy);
    owner?.once('destroy', destroy);
    graphic.once('destroy', detach);
    return graphic;
}

export function syncRescueWelcomeFlag(scene, garden, rescuedCount) {
    if (!garden?.zone) return;
    if (rescuedCount > 0 && !garden.welcomeFlag?.active) {
        garden.welcomeFlag = createDecorativeFlag(scene, {
            x: garden.zone.x + 116, y: garden.zone.y + 50,
            width: 34, poleHeight: 62, depth: garden.zone.y + 112,
            owner: garden.zone, placement: 'sanctuary-welcome'
        });
    } else if (rescuedCount <= 0 && garden.welcomeFlag) {
        garden.welcomeFlag.destroy();
        garden.welcomeFlag = null;
    }
}

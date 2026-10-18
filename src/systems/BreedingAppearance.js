const numberIn = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const colour = value => Number.isInteger(value) && value >= 0 && value <= 0xffffff;

// Read existing phenotype output only. Never rewrite the saved genome or family.
export function resolveBreedingAppearance(visual, stage) {
    if (!visual || typeof visual !== 'object' || Array.isArray(visual)) return null;
    const growth = stage === 'baby' ? 0 : ['juvenile', 'youngling'].includes(stage) ? 0.45 : 1;
    const proportionGrowth = stage === 'baby' ? 0.25 : growth;
    const shape = visual.bodyMods?.shape;
    const pattern = visual.bodyMods?.pattern;
    const tail = visual.bodyMods?.tail;
    const ears = visual.headMods?.ears;
    const mane = visual.headMods?.mane;
    const horns = visual.headMods?.horns;
    const result = {
        growth,
        scaleX: numberIn(shape?.scaleX, 0.5, 1.5) ? 1 + (shape.scaleX - 1) * proportionGrowth : 1,
        scaleY: numberIn(shape?.scaleY, 0.5, 1.5) ? 1 + (shape.scaleY - 1) * proportionGrowth : 1,
        eyeColor: colour(visual.eyeColor) ? visual.eyeColor : null,
        markings: ['solid', 'spots', 'stripes'].includes(pattern?.type) ? {
            pattern: pattern.type === 'solid' ? 'none' : pattern.type,
            intensity: pattern.type === 'solid' ? 0 : numberIn(pattern.intensity, 0, 1) ? pattern.intensity : 0.7
        } : null,
        tailLength: ['short', 'medium', 'flowing'].includes(tail?.type) && numberIn(tail.length, 0.1, 1.5) ? tail.length : null,
        ears: ['rounded', 'pointed'].includes(ears?.type) ? ears.type : null,
        maneLength: ['short', 'medium', 'flowing'].includes(mane?.type) && numberIn(mane.length, 0.1, 1.5) ? mane.length : null,
        horns: ['none', 'curved', 'spiral'].includes(horns?.type) && numberIn(horns.size, 0, 1.5)
            ? { type: horns.type, size: horns.size } : null
    };
    return result.eyeColor !== null || result.markings || result.tailLength !== null || result.ears ||
        result.maneLength !== null || result.horns || result.scaleX !== 1 || result.scaleY !== 1 ? result : null;
}

const nativeTails = new Set(['fish', 'serpentine', 'avian', 'quadruped']);

// Attached sensory fins/collar and a single tail sit behind the existing anatomy.
// Body families with authored tails keep those tails instead of gaining another.
export function drawBreedingAppendages(graphics, center, paint, config, appearance, bodyType) {
    if (!appearance || appearance.growth === 0) return;
    const growth = appearance.growth;
    const headRadius = 18 * (config.headSizeMultiplier || 1);
    const headY = center.y - 20;
    const bodyScale = config.scale || 1;
    const family = String(bodyType).replace(/^(elder_|transitional_)/, '');
    if (appearance.tailLength !== null && !nativeTails.has(family)) {
        const rootX = center.x + 12 * bodyScale * appearance.scaleX;
        const rootY = center.y + 20 * bodyScale * appearance.scaleY;
        const points = Array.from({ length: 7 }, (_, index) => {
            const t = index / 6;
            return { x: rootX + (14 + 28 * appearance.tailLength) * growth * t,
                y: rootY - growth * (6 * Math.sin(t * Math.PI) + 8 * t),
                width: (4 * (1 - t) + 0.5) * growth };
        });
        graphics.fillStyle(paint.tailShadow, 0.95);
        graphics.beginPath();
        points.forEach((point, index) => graphics[index === 0 ? 'moveTo' : 'lineTo'](point.x, point.y - point.width));
        [...points].reverse().forEach(point => graphics.lineTo(point.x, point.y + point.width));
        graphics.closePath(); graphics.fillPath();
        graphics.lineStyle(1.5 * growth, paint.tail, 0.9);
        graphics.beginPath();
        points.forEach((point, index) => graphics[index === 0 ? 'moveTo' : 'lineTo'](point.x, point.y));
        graphics.strokePath();
    }
    if (appearance.maneLength !== null) {
        const reach = (4 + 12 * appearance.maneLength) * growth;
        for (const angle of [0.08, 0.28, 0.5, 0.72, 0.92].map(value => value * Math.PI)) {
            graphics.fillStyle(paint.headShadow, 0.95);
            graphics.fillTriangle(
                center.x + Math.cos(angle - 0.2) * headRadius * 0.72, headY + Math.sin(angle - 0.2) * headRadius * 0.72,
                center.x + Math.cos(angle) * (headRadius + reach), headY + Math.sin(angle) * (headRadius + reach),
                center.x + Math.cos(angle + 0.2) * headRadius * 0.72, headY + Math.sin(angle + 0.2) * headRadius * 0.72);
            graphics.fillStyle(paint.accent, 0.65);
            graphics.fillCircle(center.x + Math.cos(angle) * (headRadius + reach * 0.55),
                headY + Math.sin(angle) * (headRadius + reach * 0.55), 1.3 * growth);
        }
    }
    if (appearance.ears) for (const side of [-1, 1]) {
        graphics.fillStyle(paint.headShadow, 0.98);
        if (appearance.ears === 'pointed') {
            graphics.fillTriangle(center.x + side * headRadius * 0.62, headY - headRadius * 0.45,
                center.x + side * headRadius * 1.1, headY - headRadius - 7 * growth,
                center.x + side * headRadius * 1.15, headY - headRadius * 0.15);
            graphics.fillStyle(paint.accent, 0.75);
            graphics.fillTriangle(center.x + side * headRadius * 0.8, headY - headRadius * 0.48,
                center.x + side * headRadius * 1.07, headY - headRadius - 3 * growth,
                center.x + side * headRadius, headY - headRadius * 0.32);
        } else {
            const x = center.x + side * headRadius * 0.85, y = headY - headRadius * 0.55;
            graphics.fillEllipse(x, y, 12 * growth, 16 * growth);
            graphics.fillStyle(paint.accent, 0.75);
            graphics.fillEllipse(x, y, 6 * growth, 10 * growth);
        }
    }
}

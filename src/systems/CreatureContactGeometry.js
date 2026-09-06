const DEFAULT_ALPHA_THRESHOLD = 72;
const DEFAULT_MIN_ROW_RATIO = 0.025;

function finiteDimension(value) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number > 0 ? number : 0;
}

export function findVisibleContactBounds({
    data,
    width,
    height,
    alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
    minRowRatio = DEFAULT_MIN_ROW_RATIO,
    minRowPixels = 4
} = {}) {
    const pixelWidth = finiteDimension(width);
    const pixelHeight = finiteDimension(height);
    if (!data || pixelWidth === 0 || pixelHeight === 0) return null;
    if (data.length < pixelWidth * pixelHeight * 4) return null;

    const requiredRowPixels = Math.max(
        1,
        Math.floor(Number(minRowPixels) || 1),
        Math.ceil(pixelWidth * Math.max(0, Number(minRowRatio) || 0))
    );
    const rowCounts = new Uint32Array(pixelHeight);

    for (let y = 0; y < pixelHeight; y++) {
        const rowStart = y * pixelWidth * 4;
        let count = 0;
        for (let x = 0; x < pixelWidth; x++) {
            if (data[rowStart + x * 4 + 3] >= alphaThreshold) count += 1;
        }
        rowCounts[y] = count;
    }

    let top = -1;
    let bottom = -1;
    for (let y = 0; y < pixelHeight; y++) {
        if (rowCounts[y] < requiredRowPixels) continue;
        if (top < 0) top = y;
        bottom = y;
    }
    if (top < 0 || bottom < top) return null;

    let left = pixelWidth;
    let right = -1;
    for (let y = top; y <= bottom; y++) {
        if (rowCounts[y] < requiredRowPixels) continue;
        const rowStart = y * pixelWidth * 4;
        for (let x = 0; x < pixelWidth; x++) {
            if (data[rowStart + x * 4 + 3] < alphaThreshold) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
        }
    }

    if (right < left) return null;
    return {
        left,
        right,
        top,
        bottom,
        width: right - left + 1,
        height: bottom - top + 1,
        contactY: bottom + 1,
        centerX: (left + right + 1) / 2,
        requiredRowPixels
    };
}

function getReadableCanvas(source, width, height) {
    if (typeof source?.getContext === 'function') return source;
    if (typeof document === 'undefined' || !document.createElement) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    return canvas;
}

export function resolveTextureContactGeometry(textureManager, textureKey, options = {}) {
    try {
        const texture = textureManager?.get?.(textureKey);
        const source = texture?.getSourceImage?.();
        const width = finiteDimension(source?.width || texture?.source?.[0]?.width);
        const height = finiteDimension(source?.height || texture?.source?.[0]?.height);
        if (!source || width === 0 || height === 0) return null;

        const canvas = getReadableCanvas(source, width, height);
        const context = canvas?.getContext?.('2d', { willReadFrequently: true });
        if (!context) return null;
        const imageData = context.getImageData(0, 0, width, height);
        return findVisibleContactBounds({
            data: imageData.data,
            width,
            height,
            ...options
        });
    } catch (error) {
        console.warn('[CreatureContactGeometry] Texture scan unavailable', error);
        return null;
    }
}

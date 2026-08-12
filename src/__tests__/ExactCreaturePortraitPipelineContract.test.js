const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Exact hatched creature portrait pipeline', () => {
    const hatching = read('scenes/HatchingScene.js');
    const service = read('systems/LivingPortraitService.js');
    const server = fs.readFileSync(
        path.join(
            __dirname,
            '..',
            '..',
            'netlify',
            'lib',
            'generate-ai-art-core.cjs'
        ),
        'utf8'
    );

    test('captures the actual hatched sprite together with its genes and DNA', () => {
        expect(hatching).toContain('genes: this.creatureGenetics');
        expect(hatching).toContain('dna: this.creatureDNA');
        expect(hatching).toContain('sprite: this.creature');
        expect(service).toContain(
            'referenceImage || this.captureReference(sprite)'
        );
        expect(service).toContain(
            "source === 'post_hatch' && !capturedReference"
        );
    });

    test('sends the exact pixel frame through the protected request', () => {
        expect(service).toContain('frame?.source?.image');
        expect(service).toContain("canvas.toDataURL('image/png')");
        expect(service).toContain('portraitSpec,');
        expect(service).toContain('referenceImage,');
        expect(server).toContain(
            'const referenceImage = parseReferenceImage(body.referenceImage)'
        );
    });

    test('uses the reference image in both supported model paths', () => {
        expect(server).toContain('input.input_images = [referenceImage]');
        expect(server).toContain("mimeType: 'image/png'");
        expect(server).toContain(
            'IMAGE 1 IS THE AUTHORITATIVE IDENTITY REFERENCE'
        );
        expect(server).toContain(
            'Do not merely upscale, smooth, repaint, or extrude the pixel sprite.'
        );
    });
});

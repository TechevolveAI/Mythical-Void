const { smokeRendererArgs } = require('../lib/smoke-renderer-policy.cjs');
const fs = require('fs');
const path = require('path');

test('local software and accelerated captures retain their existing rendering paths', () => {
    expect(smokeRendererArgs({}, 'darwin')).toEqual([
        '--mute-audio', '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
    ]);
    expect(smokeRendererArgs({ SMOKE_HARDWARE_ACCELERATED_CAPTURE: '1' }, 'darwin')).toEqual(['--mute-audio', '--headless=new']);
});

test('Linux virtual-display mode uses native OpenGL, without disabling WebGL or lowering resolution', () => {
    expect(smokeRendererArgs({ SMOKE_NATIVE_OPENGL: '1', DISPLAY: ':99' }, 'linux')).toEqual([
        '--mute-audio', '--use-gl=angle', '--use-angle=gl', '--ozone-platform=x11'
    ]);
    expect(() => smokeRendererArgs({ SMOKE_NATIVE_OPENGL: '1' }, 'linux')).toThrow('virtual display');
    expect(() => smokeRendererArgs({ SMOKE_NATIVE_OPENGL: '1', DISPLAY: ':99' }, 'darwin')).toThrow('virtual display');
});

test('all rendering paths remain muted and preserve completion timing and viewport gates', () => {
    const root = path.resolve(__dirname, '../..');
    const smoke = fs.readFileSync(path.join(root, 'scripts/smoke-secondary-journeys.js'), 'utf8');
    expect(smoke).toContain('const chromeArgs = applyBrowserAudioPolicy([');
    expect(smoke).toContain('...smokeRendererArgs(),');
    expect(smoke).toContain('!renderer.webgl || !renderer.name || /swiftshader/i.test(renderer.name)');
    const runner = fs.readFileSync(path.join(root, 'scripts/run-completion-flow.cjs'), 'utf8');
    expect(runner).toContain('}, trumptopus ? 300000 : 180000)');
    expect(runner).toContain("trumptopus ? 'scripts/smoke-trumptopus-release.cjs' : 'scripts/smoke-secondary-journeys.js'");
    const finale = fs.readFileSync(path.join(root, 'scripts/smoke-trumptopus-release.cjs'), 'utf8');
    expect(finale).toContain("require('./lib/smoke-renderer-policy.cjs')");
    expect(finale).toContain("args: smokeRendererArgs({ SMOKE_HARDWARE_ACCELERATED_CAPTURE: '1', ...process.env })");
    expect(finale).toContain('headless: !nativeOpenGL');
    expect(finale).toContain('renderer.webgl&&renderer.name&&!/swiftshader/i.test(renderer.name)');
    expect(finale).toContain("['phone', 390, 844], ['desktop', 1280, 720]");
    expect(runner).toContain("'forest-desktop', 'guardian-handoff', 'mythicalForest', 1280, 720");
    expect(runner).toContain("'forest-phone', 'guardian-handoff', 'mythicalForest', 390, 844");
});

// CI's virtual display permits Mesa OpenGL without requiring a physical GPU.
// Keep the default software path available for local reproducibility.
const { applyBrowserAudioPolicy } = require('./browser-audio-policy.cjs');
function smokeRendererArgs(env = process.env, platform = process.platform) {
    if (env.SMOKE_NATIVE_OPENGL === '1') {
        if (platform !== 'linux' || !env.DISPLAY) {
            throw new Error('Native OpenGL smoke requires a Linux virtual display');
        }
        return applyBrowserAudioPolicy(['--use-gl=angle', '--use-angle=gl', '--ozone-platform=x11'], env);
    }
    return applyBrowserAudioPolicy(env.SMOKE_HARDWARE_ACCELERATED_CAPTURE === '1'
        ? ['--headless=new']
        : ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env);
}

module.exports = { smokeRendererArgs };

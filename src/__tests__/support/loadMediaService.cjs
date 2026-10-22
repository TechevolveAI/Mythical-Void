const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

module.exports = function loadMediaService(name, fetch, window) {
    const file = path.join(__dirname, '../../systems', name + '.js');
    const root = path.resolve(__dirname, '../../..');
    const code = execFileSync(process.execPath, ['--require', './scripts/review/deny-baseline-network.cjs',
        '-e', 'process.stdout.write(require(process.argv[1]).transformSync(require("node:fs").readFileSync(0,"utf8"),{format:"cjs",target:"es2022",loader:"js"}).code)',
        require.resolve('esbuild')], { cwd: root, input: fs.readFileSync(file, 'utf8'), encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin:/usr/local/bin', TMPDIR: '/private/tmp', LANG: 'C', NODE_ENV: 'test', CI: '1' },
        timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
    const context = { module: { exports: {} }, window, fetch, console, Image: class {},
        Date, Math, Map, Set, Promise, Object, Array, Number, String, Boolean, Error,
        AbortController, setTimeout, clearTimeout,
        require: name => {
            if (name === './CreatureMediaPrivacy.js') return { getCreatureMediaEligibility: () => ({ eligible: true }) };
            if (name === '../config/companion-video-moments.json') return require('../../config/companion-video-moments.json');
            throw Error('SYNTHETIC_MEDIA_IMPORT_DENIED');
        } };
    context.exports = context.module.exports;
    vm.runInNewContext(code, context, { filename: file, timeout: 1000 });
    return context.module.exports;
};

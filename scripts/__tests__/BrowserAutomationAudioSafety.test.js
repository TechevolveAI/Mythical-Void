const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const {
    applyBrowserAudioPolicy,
    automationAudioEnabled
} = require('../lib/browser-audio-policy.cjs');

const rootDir = path.resolve(__dirname, '../..');

function javascriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return javascriptFiles(target);
        return /\.(?:c|m)?js$/.test(entry.name) ? [target] : [];
    });
}

describe('browser automation audio safety', () => {
    test.each(['run-completion-flow.cjs', 'smoke-expedition-debrief.cjs'])('%s cannot auto-open the host browser', file => {
        const source = fs.readFileSync(path.join(rootDir, 'scripts', file), 'utf8');
        const main = parse(source).program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'main');
        const launch = main.body.body.find(node => node.expression?.left?.name === 'preview');
        const spawn = jest.fn();
        vm.runInNewContext(source.slice(launch.start, launch.end), {
            spawn, path, root: rootDir, port: 19023,
            process: { execPath: '/node', env: { BROWSER: 'Google Chrome', PATH: '/bin' } }
        });
        expect(spawn).toHaveBeenCalledWith('/node', expect.arrayContaining(['preview']), expect.objectContaining({
            env: { BROWSER: 'none', PATH: '/bin' }
        }));
    });

    test('mutes automated browser audio unless it is explicitly authorized', () => {
        const args = ['--headless=new', 'about:blank'];

        expect(applyBrowserAudioPolicy(args, {})).toEqual([
            '--mute-audio',
            '--headless=new',
            'about:blank'
        ]);
        expect(applyBrowserAudioPolicy(args, {
            MYTHICAL_VOID_AUTOMATION_AUDIO: '1'
        })).toEqual(args);
        expect(automationAudioEnabled({ MYTHICAL_VOID_AUTOMATION_AUDIO: 'true' }))
            .toBe(false);
        expect(args).toEqual(['--headless=new', 'about:blank']);
    });

    test('every direct headless browser launcher applies the shared policy', () => {
        const launchers = javascriptFiles(path.join(rootDir, 'scripts'))
            .filter(file => fs.readFileSync(file, 'utf8').includes("'--headless"));

        expect(launchers.length).toBeGreaterThan(0);
        for (const launcher of launchers) {
            const source = fs.readFileSync(launcher, 'utf8');
            expect({
                launcher: path.relative(rootDir, launcher),
                protected: source.includes('applyBrowserAudioPolicy')
            }).toEqual({
                launcher: path.relative(rootDir, launcher),
                protected: true
            });
        }
    });
});

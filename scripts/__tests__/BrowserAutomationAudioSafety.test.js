const fs = require('fs');
const path = require('path');
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

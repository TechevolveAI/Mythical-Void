const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const originalIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const originalWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const guard = path.join(root, 'scripts/review/deny-baseline-network.cjs');
const { prepareReleaseFiles } = require('../inject-build-timestamp.js');

function fixture({ index = originalIndex, worker = originalWorker } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-release-binding-'));
    const scripts = path.join(directory, 'scripts');
    const dist = path.join(directory, 'dist');
    fs.mkdirSync(scripts);
    fs.mkdirSync(dist);
    for (const file of ['inject-build-timestamp.js', 'build-direct-play-entry.cjs']) {
        fs.copyFileSync(path.join(root, 'scripts', file), path.join(scripts, file));
    }
    if (index !== null) fs.writeFileSync(path.join(dist, 'index.html'), index);
    if (worker !== null) fs.writeFileSync(path.join(dist, 'sw.js'), worker);
    return { directory, dist, index, worker };
}

function run(target) {
    return spawnSync(process.execPath, ['--require', guard,
        path.join(target.directory, 'scripts/inject-build-timestamp.js')], {
        cwd: target.directory, encoding: 'utf8', timeout: 10000,
        env: { PATH: '/usr/bin:/bin', TMPDIR: os.tmpdir(), LANG: 'C', NODE_ENV: 'test' }
    });
}

function expectUnchanged(target) {
    for (const [file, before] of [['index.html', target.index], ['sw.js', target.worker]]) {
        const filename = path.join(target.dist, file);
        if (before === null) expect(fs.existsSync(filename)).toBe(false);
        else expect(fs.readFileSync(filename, 'utf8')).toBe(before);
    }
    expect(fs.existsSync(path.join(target.dist, 'play'))).toBe(false);
}

describe('release binding CLI', () => {
    afterEach(() => jest.restoreAllMocks());
    test('binds both entry pages and the real worker to one version without runtime fallback', () => {
        const target = fixture();
        const result = run(target);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        const index = fs.readFileSync(path.join(target.dist, 'index.html'), 'utf8');
        const play = fs.readFileSync(path.join(target.dist, 'play/index.html'), 'utf8');
        const worker = fs.readFileSync(path.join(target.dist, 'sw.js'), 'utf8');
        const version = index.match(/name="mythical-void-release" content="(\d+)"/)[1];
        expect(play).toContain(`name="mythical-void-release" content="${version}"`);
        expect(play).toContain('name="mythical-entry" content="direct-play"');
        expect(play).not.toContain('__BUILD_TIMESTAMP__');
        expect(index).not.toContain('__BUILD_TIMESTAMP__');
        expect(play.match(/<script[^>]+src="[^"]+"/g))
            .toEqual(index.match(/<script[^>]+src="[^"]+"/g));
        const fallback = jest.fn(() => { throw Error('Release fell back to runtime time'); });
        const cacheVersion = vm.runInNewContext(worker + '\nString(CACHE_VERSION)', {
            self: { location: { hostname: 'synthetic.example' }, addEventListener() {} },
            Date: { now: fallback }
        });
        expect(cacheVersion).toBe(version);
        expect(fallback).not.toHaveBeenCalled();
    });

    test.each([
        ['missing entry', null],
        ['missing document marker', originalIndex.replace('__BUILD_TIMESTAMP__', '123456')],
        ['duplicate document marker', originalIndex + '\n<!-- __BUILD_TIMESTAMP__ -->'],
        ['invalid direct-play metadata', originalIndex.replace('Opening the Void…', 'Synthetic loading')]
    ])('%s refuses packaging before changing the worker or entry', (_label, index) => {
        const target = fixture({ index });
        const result = run(target);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expectUnchanged(target);
    });

    test('a missing worker is a failure, not successful skipped packaging', () => {
        const target = fixture({ worker: null });
        expect(run(target).status).toBe(1);
        expectUnchanged(target);
    });

    test('a previously bound worker cannot silently disagree with a fresh document', () => {
        const target = fixture({ worker: originalWorker.replace('__BUILD_TIMESTAMP__', '123456') });
        expect(run(target).status).toBe(1);
        expectUnchanged(target);
    });

    test('re-running packaging refuses stale inputs without corrupting the previous output', () => {
        const target = fixture();
        expect(run(target).status).toBe(0);
        const files = ['index.html', 'sw.js', 'play/index.html'];
        const before = files.map(file => fs.readFileSync(path.join(target.dist, file), 'utf8'));
        expect(run(target).status).toBe(1);
        expect(files.map(file => fs.readFileSync(path.join(target.dist, file), 'utf8'))).toEqual(before);
    });

    test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '123456'])(
        'rejects invalid version %s before writing', version => {
            const target = fixture();
            expect(() => prepareReleaseFiles(target.dist, version)).toThrow('positive safe integer');
            expectUnchanged(target);
        }
    );

    test('write failures remain visible to the release caller', () => {
        const target = fixture();
        jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
            throw Error('SYNTHETIC_ARTIFACT_WRITE_FAILURE');
        });
        expect(() => prepareReleaseFiles(target.dist, 123456))
            .toThrow('SYNTHETIC_ARTIFACT_WRITE_FAILURE');
    });
});

#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..', '..');
const defaultPackageDir = path.join(root, 'dist-itch');
const defaultOutput = path.join(root, 'docs/company/growth/poki-candidate-measurement.json');
const initialTargetBytes = 5 * 1024 * 1024;
const totalTargetBytes = 8 * 1024 * 1024;
const openingMedia = [
    'marketing/mythical-void-mark-32.png',
    'game/project-beacon-crash-site.webp',
    'game/cinematics/fend-crash-site-loop.mp4'
];
const externalMarkers = [
    'api.nasa.gov',
    'apod.nasa.gov',
    'mars.nasa.gov',
    'api.open-notify.org',
    'netlify/functions'
];
const textExtensions = new Set(['.html', '.css', '.js']);

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    });
}

function rel(packageDir, file) {
    return path.relative(packageDir, file).split(path.sep).join('/');
}

function category(relativePath) {
    if (relativePath.startsWith('game/cinematics/')) return 'cinematics';
    if (relativePath.startsWith('audio/')) return 'audio';
    if (relativePath.startsWith('assets/')) return 'code_and_css';
    if (relativePath.startsWith('game/')) return 'other_game_art';
    if (relativePath.startsWith('marketing/')) return 'marketing';
    return 'root';
}

function normalizeVolatileManifestForCompression(file, buffer) {
    if (path.basename(file) !== 'itch-package-manifest.json') return buffer;

    try {
        const manifest = JSON.parse(buffer.toString('utf8'));
        manifest.sourceCommit = '<source-commit>';
        manifest.builtAt = '<build-time>';
        return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    } catch (_error) {
        return buffer;
    }
}

function sizes(file) {
    const buffer = fs.readFileSync(file);
    return {
        rawBytes: buffer.length,
        gzipEstimateBytes: zlib.gzipSync(
            normalizeVolatileManifestForCompression(file, buffer),
            { level: 9 }
        ).length
    };
}

function dependencySet(packageDir) {
    const indexPath = path.join(packageDir, 'index.html');
    const index = fs.readFileSync(indexPath, 'utf8');
    const moduleEntry = index.match(/<script type="module"[^>]+src="\.\/([^\"]+)"/)?.[1];
    if (!moduleEntry) throw new Error('Poki measurement could not find the module entry point.');
    const preloads = [...index.matchAll(/<link rel="modulepreload"[^>]+href="\.\/([^\"]+)"/g)].map(match => match[1]);
    const entry = fs.readFileSync(path.join(packageDir, moduleEntry), 'utf8');
    const dependencyLine = entry.split('\n')[0] || '';
    const entryDirectory = path.posix.dirname(moduleEntry);
    const mappedDependencies = [...dependencyLine.matchAll(/"\.\/([^\"]+)"/g)]
        .map(match => path.posix.normalize(path.posix.join(entryDirectory, match[1])));
    return [...new Set(['index.html', moduleEntry, ...preloads, ...mappedDependencies, ...openingMedia])];
}

function measurePokiCandidate(packageDir = defaultPackageDir) {
    const files = walk(packageDir);
    const relativeFiles = files.map(file => rel(packageDir, file));
    const firstLoadPaths = dependencySet(packageDir);
    const missing = firstLoadPaths.filter(relativePath => !fs.existsSync(path.join(packageDir, relativePath)));
    if (missing.length) throw new Error(`Poki opening resources are missing: ${missing.join(', ')}`);

    const categories = {};
    let packageRawBytes = 0;
    let packageGzipEstimateBytes = 0;
    for (const file of files) {
        const relativePath = rel(packageDir, file);
        const group = category(relativePath);
        const measured = sizes(file);
        categories[group] ||= { fileCount: 0, rawBytes: 0, gzipEstimateBytes: 0 };
        categories[group].fileCount += 1;
        categories[group].rawBytes += measured.rawBytes;
        categories[group].gzipEstimateBytes += measured.gzipEstimateBytes;
        packageRawBytes += measured.rawBytes;
        packageGzipEstimateBytes += measured.gzipEstimateBytes;
    }

    const openingResources = firstLoadPaths.map(relativePath => ({
        path: relativePath,
        ...sizes(path.join(packageDir, relativePath))
    }));
    const firstLoadRawBytes = openingResources.reduce((total, item) => total + item.rawBytes, 0);
    const firstLoadGzipEstimateBytes = openingResources.reduce((total, item) => total + item.gzipEstimateBytes, 0);

    const textFiles = files.filter(file => textExtensions.has(path.extname(file)));
    const textByFile = textFiles.map(file => ({ path: rel(packageDir, file), source: fs.readFileSync(file, 'utf8') }));
    const externalServiceMarkers = Object.fromEntries(externalMarkers.map(marker => [marker, {
        fileCount: textByFile.filter(item => item.source.includes(marker)).length,
        files: textByFile.filter(item => item.source.includes(marker)).map(item => item.path)
    }]));
    const combinedText = textByFile.map(item => item.source).join('\n');
    const digest = crypto.createHash('sha256');
    for (const relativePath of relativeFiles.filter(item => item !== 'itch-package-manifest.json').sort()) {
        digest.update(relativePath);
        digest.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(packageDir, relativePath))).digest());
    }

    return {
        schemaVersion: 1,
        target: 'poki-readiness-candidate-not-a-poki-build',
        measurementMethod: {
            package: 'Raw bytes plus a deterministic per-file gzip estimate; this is not a CDN timing test.',
            firstLoad: 'Module entry, module preloads, its mapped startup dependencies and the three opening resources observed in a private local browser run.',
            externalServices: 'Static markers in built HTML, CSS and application JavaScript; a marker is a compatibility risk, not proof that a request fired.'
        },
        package: {
            fileCount: files.length,
            rawBytes: packageRawBytes,
            gzipEstimateBytes: packageGzipEstimateBytes,
            advisoryTargetBytes: totalTargetBytes,
            advisoryTargetMet: packageGzipEstimateBytes <= totalTargetBytes,
            contentDigestSha256: digest.digest('hex')
        },
        firstLoad: {
            resourceCount: openingResources.length,
            rawBytes: firstLoadRawBytes,
            gzipEstimateBytes: firstLoadGzipEstimateBytes,
            advisoryTargetBytes: initialTargetBytes,
            advisoryTargetMet: firstLoadGzipEstimateBytes <= initialTargetBytes,
            resources: openingResources.sort((a, b) => b.rawBytes - a.rawBytes)
        },
        categories,
        externalServiceMarkers,
        pokiSdkMarkers: {
            PokiSDK: combinedText.includes('PokiSDK'),
            officialPhaserPlugin: combinedText.includes('@poki/phaser-3')
        },
        localStorageMarkerFileCount: textByFile.filter(item => item.source.includes('localStorage')).length
    };
}

function run() {
    const packageFlag = process.argv.indexOf('--package');
    const outputFlag = process.argv.indexOf('--output');
    const packageDir = packageFlag === -1 ? defaultPackageDir : path.resolve(process.argv[packageFlag + 1]);
    const output = outputFlag === -1 ? defaultOutput : path.resolve(process.argv[outputFlag + 1]);
    const measurement = measurePokiCandidate(packageDir);
    if (process.argv.includes('--write')) fs.writeFileSync(output, `${JSON.stringify(measurement, null, 2)}\n`);
    console.log(JSON.stringify(measurement, null, 2));
}

if (require.main === module) run();

module.exports = {
    measurePokiCandidate,
    normalizeVolatileManifestForCompression
};

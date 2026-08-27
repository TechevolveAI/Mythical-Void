#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { measurePokiCandidate } = require('./measure-poki-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const defaultPackageDir = path.join(root, 'dist-itch');
const defaultOutput = path.join(root, 'docs/company/growth/youtube-playables-candidate-measurement.json');
const MIB = 1024 * 1024;

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    });
}

function relative(packageDir, file) {
    return path.relative(packageDir, file).split(path.sep).join('/');
}

function measureYouTubePlayablesCandidate(packageDir = defaultPackageDir) {
    const base = measurePokiCandidate(packageDir);
    const files = walk(packageDir);
    const textFiles = files.filter(file => ['.html', '.css', '.js'].includes(path.extname(file)));
    const textByFile = textFiles.map(file => ({
        path: relative(packageDir, file),
        source: fs.readFileSync(file, 'utf8')
    }));
    const combinedText = textByFile.map(item => item.source).join('\n');
    const fileSizes = files.map(file => ({ path: relative(packageDir, file), rawBytes: fs.statSync(file).size }));
    const largestFile = fileSizes.sort((a, b) => b.rawBytes - a.rawBytes)[0];
    const filesAboveRecommendation = fileSizes.filter(item => item.rawBytes >= 512 * 1024);
    const markerFiles = marker => textByFile.filter(item => item.source.includes(marker)).map(item => item.path);

    return {
        schemaVersion: 1,
        target: 'youtube-playables-readiness-candidate-not-a-playables-build',
        sourcePackage: 'dist-itch structural proxy',
        measurementLimits: {
            initialMustBeBelowBytes: 30 * MIB,
            initialShouldBeBelowBytes: 15 * MIB,
            totalMustBeBelowBytes: 250 * MIB,
            individualMustBeBelowBytes: 30 * MIB,
            individualShouldBeBelowBytes: 512 * 1024,
            maximumFileCount: 8000
        },
        package: {
            fileCount: base.package.fileCount,
            rawBytes: base.package.rawBytes,
            gzipEstimateBytes: base.package.gzipEstimateBytes,
            totalHardLimitMet: base.package.rawBytes < 250 * MIB,
            fileCountLimitMet: base.package.fileCount <= 8000,
            largestFile,
            individualHardLimitMet: largestFile.rawBytes < 30 * MIB,
            filesAbove512KiBRecommendation: filesAboveRecommendation
        },
        firstLoad: {
            resourceCount: base.firstLoad.resourceCount,
            rawBytes: base.firstLoad.rawBytes,
            gzipEstimateBytes: base.firstLoad.gzipEstimateBytes,
            hardLimitMet: base.firstLoad.gzipEstimateBytes < 30 * MIB,
            recommendedLimitMet: base.firstLoad.gzipEstimateBytes < 15 * MIB,
            limitation: 'Deterministic local reconstruction, not a YouTube Developer Portal or five-second device test.'
        },
        externalServiceMarkers: base.externalServiceMarkers,
        platformIntegrationMarkers: {
            ytgameNamespace: combinedText.includes('ytgame'),
            inPlayablesEnvironment: combinedText.includes('IN_PLAYABLES_ENV'),
            firstFrameReady: combinedText.includes('ytgame.game.firstFrameReady'),
            gameReady: combinedText.includes('ytgame.game.gameReady'),
            cloudLoad: combinedText.includes('ytgame.game.loadData'),
            cloudSave: combinedText.includes('ytgame.game.saveData'),
            systemPause: combinedText.includes('ytgame.system.onPause'),
            systemResume: combinedText.includes('ytgame.system.onResume'),
            audioSetting: combinedText.includes('ytgame.system.isAudioEnabled')
        },
        incompatibleCurrentFeatureMarkers: {
            nativeShareFiles: markerFiles('navigator.share'),
            clipboardWriteFiles: markerFiles('clipboard.writeText'),
            localStorageFiles: markerFiles('localStorage')
        },
        interpretation: 'Size and Phaser format are promising. This is not a YouTube Playables build and does not prove audience, SDK, privacy, touch, resize, rights, visual or certification readiness.'
    };
}

function run() {
    const packageFlag = process.argv.indexOf('--package');
    const outputFlag = process.argv.indexOf('--output');
    const packageDir = packageFlag === -1 ? defaultPackageDir : path.resolve(process.argv[packageFlag + 1]);
    const output = outputFlag === -1 ? defaultOutput : path.resolve(process.argv[outputFlag + 1]);
    const measurement = measureYouTubePlayablesCandidate(packageDir);
    if (process.argv.includes('--write')) fs.writeFileSync(output, `${JSON.stringify(measurement, null, 2)}\n`);
    console.log(JSON.stringify(measurement, null, 2));
}

if (require.main === module) run();

module.exports = { measureYouTubePlayablesCandidate };

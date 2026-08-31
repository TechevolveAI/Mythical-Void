#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const packageDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'dist-itch');
const localRoots = ['assets', 'audio', 'game', 'marketing'];
const textExtensions = new Set(['.html', '.css', '.js']);
const allowedTopLevelEntries = new Set([
    'assets',
    'audio',
    'game',
    'index.html',
    'itch-package-manifest.json',
    'marketing'
]);

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    });
}

function rewriteLocalAssetPaths(source) {
    const roots = localRoots.join('|');
    return source.replace(
        new RegExp(`(["'\\x60(=,\\s])\\/(${roots})\\/`, 'g'),
        '$1./$2/'
    );
}

function countPackage(directory) {
    const files = walk(directory);
    return {
        fileCount: files.length,
        extractedBytes: files.reduce((total, file) => total + fs.statSync(file).size, 0)
    };
}

function sourceCommit() {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8'
    });
    return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function buildPackage(directory = packageDir) {
    if (!fs.existsSync(path.join(directory, 'index.html'))) {
        throw new Error(`itch package entry point is missing: ${directory}/index.html`);
    }

    let prunedEntryCount = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (allowedTopLevelEntries.has(entry.name)) continue;
        fs.rmSync(path.join(directory, entry.name), { recursive: true, force: true });
        prunedEntryCount += 1;
    }

    let rewrittenFileCount = 0;
    for (const file of walk(directory)) {
        if (!textExtensions.has(path.extname(file))) continue;
        const before = fs.readFileSync(file, 'utf8');
        const after = rewriteLocalAssetPaths(before);
        if (after !== before) {
            fs.writeFileSync(file, after);
            rewrittenFileCount += 1;
        }
    }

    const manifestPath = path.join(directory, 'itch-package-manifest.json');
    fs.rmSync(manifestPath, { force: true });
    const beforeManifest = countPackage(directory);
    const manifest = {
        schemaVersion: 1,
        target: 'itch.io-html5',
        state: 'technical_candidate_no_screenshot_page_ready_account_cover_and_rights_approval_pending',
        sourceCommit: sourceCommit(),
        builtAt: new Date().toISOString(),
        entryPoint: 'index.html',
        directPlay: true,
        package: {
            fileCount: beforeManifest.fileCount + 1,
            extractedBytesBeforeManifest: beforeManifest.extractedBytes,
            maximumFiles: 1000,
            maximumExtractedBytes: 500 * 1024 * 1024,
            rewrittenFileCount
        },
        experience: {
            localProgress: true,
            accountRequired: false,
            paymentRequired: false,
            websiteObservabilityDeliveryEnabled: false,
            optionalHostedAiPortraitsAndVideosPromised: false,
            liveNasaDataGuaranteed: false
        },
        releaseGates: {
            externalPublicationAuthorized: false,
            kevinAccountApprovalRequired: true,
            approvedAuthenticGameplayMoments: 0,
            recommendedAuthenticGameplayMoments: 4,
            requiredAuthenticGameplayMomentsForInitialPublication: 0,
            screenshotsAttached: 0,
            initialReleaseMayLaunchWithoutScreenshots: true,
            platformTermsAccepted: false
        }
    };
    fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`
    );

    const manifestSha256 = crypto.createHash('sha256')
        .update(fs.readFileSync(manifestPath))
        .digest('hex');
    return {
        packageDir: directory,
        ...countPackage(directory),
        rewrittenFileCount,
        prunedEntryCount,
        manifestSha256
    };
}

if (require.main === module) {
    console.log(JSON.stringify(buildPackage(), null, 2));
}

module.exports = { buildPackage, localRoots, rewriteLocalAssetPaths };

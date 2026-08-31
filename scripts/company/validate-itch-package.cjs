#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const packageDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'dist-itch');
const localRoots = ['assets', 'audio', 'game', 'marketing'];
const textExtensions = new Set(['.html', '.css', '.js']);

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    });
}

function inspectItchPackage(directory) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const indexPath = path.join(directory, 'index.html');
    const manifestPath = path.join(directory, 'itch-package-manifest.json');
    requireValue(fs.existsSync(indexPath), 'top-level index.html is missing');
    requireValue(fs.existsSync(manifestPath), 'itch package manifest is missing');
    if (!fs.existsSync(indexPath) || !fs.existsSync(manifestPath)) return { failures };

    const files = walk(directory);
    const extractedBytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
    const longestPath = files.reduce((longest, file) => {
        const relative = path.relative(directory, file).split(path.sep).join('/');
        return relative.length > longest.length ? relative : longest;
    }, '');
    const index = fs.readFileSync(indexPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const roots = localRoots.join('|');
    const forbiddenRootReference = new RegExp(`(["'\\x60(=,\\s])\\/(${roots})\\/`);

    requireValue(files.length <= 1000, `file limit exceeded: ${files.length}`);
    requireValue(extractedBytes <= 500 * 1024 * 1024, `extracted size limit exceeded: ${extractedBytes}`);
    requireValue(longestPath.length <= 240, `path is longer than 240 characters: ${longestPath}`);
    requireValue(index.includes('data-distribution-target="itch"'), 'direct-play itch marker is missing');
    requireValue(index.includes('content="noindex, nofollow"'), 'portal build must not compete with the official website in search');
    requireValue(!index.includes('googletagmanager.com'), 'Google website analytics must not run inside the portal package');
    requireValue(!index.includes('returning-player.js'), 'website returning-player doorway must not run inside the direct-play portal package');
    requireValue(manifest.target === 'itch.io-html5' && manifest.directPlay === true, 'manifest target or direct-play state is invalid');
    requireValue(manifest.releaseGates?.externalPublicationAuthorized === false, 'external publication must wait for Kevin');
    requireValue(manifest.releaseGates?.approvedAuthenticGameplayMoments === 0 && manifest.releaseGates?.recommendedAuthenticGameplayMoments === 4, 'visual evidence must reflect the current 0/4 recommendation');
    requireValue(manifest.releaseGates?.requiredAuthenticGameplayMomentsForInitialPublication === 0 && manifest.releaseGates?.screenshotsAttached === 0 && manifest.releaseGates?.initialReleaseMayLaunchWithoutScreenshots === true, 'the honest no-screenshot initial release path is missing');
    requireValue(manifest.experience?.accountRequired === false && manifest.experience?.paymentRequired === false, 'free no-account boundary drifted');
    requireValue(manifest.experience?.websiteObservabilityDeliveryEnabled === false, 'website-only observability delivery must be disabled inside the portal package');
    requireValue(manifest.experience?.optionalHostedAiPortraitsAndVideosPromised === false, 'third-party package must not promise hosted AI media');
    for (const forbidden of ['playable-now', 'studio', 'resources', 'updates', 'discovery.js', 'sitemap.xml']) {
        requireValue(!fs.existsSync(path.join(directory, forbidden)), `website-only content survived the portal package: ${forbidden}`);
    }

    for (const file of files) {
        if (!textExtensions.has(path.extname(file))) continue;
        const source = fs.readFileSync(file, 'utf8');
        requireValue(!forbiddenRootReference.test(source), `${path.relative(directory, file)} retains a root-only local asset path`);
    }

    const referencedAssets = new Set();
    const localReference = new RegExp(`\\.\\/(${roots})\\/([^"'\\x60)\\s]+)`, 'g');
    for (const file of files) {
        if (!textExtensions.has(path.extname(file))) continue;
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(localReference)) {
            const candidate = `${match[1]}/${match[2]}`.split(/[?#]/)[0];
            if (candidate.includes('${')) continue;
            referencedAssets.add(decodeURIComponent(candidate));
        }
    }
    for (const asset of referencedAssets) {
        requireValue(fs.existsSync(path.join(directory, asset)), `referenced local asset is missing: ${asset}`);
    }

    for (const match of index.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)) {
        requireValue(
            fs.existsSync(path.join(directory, decodeURIComponent(match[1]))),
            `index references a missing local file: ${match[1]}`
        );
    }

    return {
        valid: failures.length === 0,
        fileCount: files.length,
        extractedBytes,
        longestPathLength: longestPath.length,
        referencedAssetCount: referencedAssets.size,
        directPlay: manifest.directPlay,
        externalPublicationAuthorized: manifest.releaseGates?.externalPublicationAuthorized,
        visualEvidence: `${manifest.releaseGates?.approvedAuthenticGameplayMoments}/${manifest.releaseGates?.recommendedAuthenticGameplayMoments} recommended`,
        failures
    };
}

if (require.main === module) {
    const result = inspectItchPackage(packageDir);
    console.log(JSON.stringify(result, null, 2));
    if (result.failures?.length) process.exit(1);
}

module.exports = { inspectItchPackage };

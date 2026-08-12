#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultManifestPath = path.join(
    repositoryRoot,
    'docs/company/operations/release-manifests/SHOP_WINDOW_OVERHAUL_2026-08-11.json'
);
const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultManifestPath;
const failures = [];
const warnings = [];
const exactAllowedPaths = new Set([
    'index.html',
    'src/site/storefront.js',
    'src/site/storefront.css',
    'vercel.json',
    'netlify.toml',
    'public/robots.txt',
    'public/sitemap.xml',
    'public/llms.txt',
    'public/og.png',
    'src/site/analytics-consent.js'
]);

function load(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        console.error(`Release manifest could not be read: ${error.message}`);
        process.exit(1);
    }
}
function digest(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function exactSet(actual, expected, label) {
    if (actual.size !== expected.size || [...expected].some(item => !actual.has(item))) {
        failures.push(`${label} must contain exactly the approved shop-window files`);
    }
}

const manifest = load(manifestPath);

if (manifest.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (manifest.id !== 'RM-002') failures.push('manifest ID must be RM-002');
if (manifest.status !== 'proposed_unapproved') failures.push('status must remain proposed_unapproved');
if (manifest.deploymentAuthorized !== false) failures.push('deploymentAuthorized must remain false');
if (manifest.releaseReady !== false) failures.push('releaseReady must remain false until a separate approved release record exists');
if (manifest.workingTreeObservation?.dirty !== true) failures.push('dirty working tree must be explicit');
if (manifest.workingTreeObservation?.currentWholeTreeDeployPermitted !== false) failures.push('current whole-tree deploy must be prohibited');
if (manifest.workingTreeObservation?.collisionRisk !== 'critical') failures.push('collisionRisk must remain critical for the shared working tree');

if (!Array.isArray(manifest.files) || manifest.files.length !== exactAllowedPaths.size) {
    failures.push('files must contain the exact ten-item shop-window release scope');
}
const filePaths = new Set();
for (const file of manifest.files || []) {
    if (!exactAllowedPaths.has(file.path)) failures.push(`out-of-scope file ${file.path}`);
    if (filePaths.has(file.path)) failures.push(`duplicate file ${file.path}`);
    filePaths.add(file.path);
    const absolute = path.join(repositoryRoot, file.path || '');
    if (!fs.existsSync(absolute)) {
        failures.push(`missing release file ${file.path}`);
        continue;
    }
    if (digest(absolute) !== file.sha256) failures.push(`${file.path} SHA-256 changed from the reviewed manifest`);
    if (!/^[a-f0-9]{64}$/.test(file.isolatedResultSha256 || '')) failures.push(`${file.path} lacks an isolated-result SHA-256`);
    if (file.trackedAtBase === true && file.isolationRequired !== true) failures.push(`${file.path} must require isolation from the shared tree`);
    if (file.trackedAtBase === false && file.isolationRequired !== false) failures.push(`${file.path} has an unexpected isolation flag`);
    if (file.scope !== 'full_file') failures.push(`${file.path} scope must be full_file`);
}
exactSet(filePaths, exactAllowedPaths, 'release scope');

const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
if (manifest.baseCommit !== currentHead) failures.push(`baseCommit changed from ${manifest.baseCommit} to ${currentHead}`);
const dirtyText = execFileSync('git', ['status', '--porcelain=v1'], { cwd: repositoryRoot, encoding: 'utf8' });
const dirtyEntries = dirtyText.trim() ? dirtyText.trim().split('\n') : [];
if (dirtyEntries.length < 20) warnings.push('The working-tree collision count is materially lower than observed; refresh before approval.');

const boundary = manifest.ownershipBoundary || {};
if (boundary.publicWebsiteOwnedHere !== true) failures.push('publicWebsiteOwnedHere must be true');
if (boundary.playRoute !== '/play/' || boundary.playRouteChanged !== false) failures.push('Play Now must remain bound to /play/');
if (boundary.gameCodeIncluded !== false || boundary.gameArtworkChanged !== false) failures.push('game code and artwork must remain outside the release');
if (boundary.source !== 'docs/company/WEBSITE_OWNERSHIP_BOUNDARY.md') failures.push('ownership boundary source is invalid');

const storefront = fs.readFileSync(path.join(repositoryRoot, 'src/site/storefront.js'), 'utf8');
const main = fs.readFileSync(path.join(repositoryRoot, 'src/main.js'), 'utf8');
const playLinkCount = (storefront.match(/href="\/play\/"/g) || []).length;
const gameBoundaryPreserved = playLinkCount >= 2 &&
    !/href=["']https?:\/\/[^"']+\/(?:play|game)/.test(storefront) &&
    main.includes("path === '/play'") &&
    main.includes("import('./game.js')");
if (!gameBoundaryPreserved) failures.push('Play Now handoff to the existing game route is not preserved');

const socialImagePath = path.join(repositoryRoot, 'public/og.png');
let socialImageValid = false;
if (fs.existsSync(socialImagePath)) {
    const image = fs.readFileSync(socialImagePath);
    socialImageValid = image.length > 24 &&
        image.subarray(1, 4).toString('ascii') === 'PNG' &&
        image.readUInt32BE(16) === 1200 &&
        image.readUInt32BE(20) === 630;
}
if (!socialImageValid) failures.push('social sharing image must be a 1200 by 630 PNG');

if (!Array.isArray(manifest.explicitExclusions) || manifest.explicitExclusions.length < 6) failures.push('explicit exclusions are incomplete');
if (!Array.isArray(manifest.validationEvidence) || manifest.validationEvidence.length < 5) failures.push('validation evidence is incomplete');
if (!Array.isArray(manifest.postDeployChecks) || manifest.postDeployChecks.length < 10) failures.push('post-deploy checks are incomplete');
if (!Array.isArray(manifest.releaseGates) || manifest.releaseGates.length < 6) failures.push('release gates are incomplete');
if (manifest.rollback?.evidenceComplete !== false) failures.push('rollback evidence must remain explicitly incomplete');
if (manifest.rollback?.lastKnownGoodDeployId !== null || manifest.rollback?.lastKnownGoodArtifactDigest !== null) {
    failures.push('unverified rollback identifiers must remain null');
}

const artifactExpectedPath = 'docs/company/operations/release-manifests/artifacts/RM-002-shop-window.patch';
const artifactPath = path.join(repositoryRoot, manifest.artifact?.path || '');
let artifactDigestValid = false;
let baseApplicationValid = false;
let isolatedResultDigestsValid = false;
let unrelatedStorefrontHunksExcluded = false;
let temporaryVerificationError = null;
if (manifest.artifact?.path !== artifactExpectedPath) failures.push('artifact path must identify the RM-002 shop-window patch');
if (!fs.existsSync(artifactPath)) {
    failures.push('release artifact is missing');
} else {
    artifactDigestValid = digest(artifactPath) === manifest.artifact?.sha256;
    if (!artifactDigestValid) failures.push('release artifact SHA-256 changed from the reviewed manifest');
    const artifactText = fs.readFileSync(artifactPath, 'utf8');
    const patchedPaths = new Set([...artifactText.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map(match => match[2]));
    unrelatedStorefrontHunksExcluded = patchedPaths.size === exactAllowedPaths.size &&
        [...patchedPaths].every(filePath => exactAllowedPaths.has(filePath));
    if (!unrelatedStorefrontHunksExcluded) failures.push('release artifact contains files outside the shop-window scope');
}
if (manifest.artifact?.status !== 'generated_unapproved') failures.push('artifact status must remain generated_unapproved');
for (const field of ['workspaceApplied', 'staged', 'committed', 'deployed']) {
    if (manifest.artifact?.[field] !== false) failures.push(`artifact ${field} must remain false`);
}
if (manifest.artifact?.baseApplicationVerified !== true) failures.push('artifact base-application verification must be recorded');
if (manifest.artifact?.appliedFileCount !== exactAllowedPaths.size) failures.push('artifact applied-file count must be ten');

if (artifactDigestValid && /^[a-f0-9]{40}$/.test(manifest.baseCommit || '')) {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-rm002-'));
    const archivePath = path.join(temporaryDirectory, 'base.tar');
    const checkoutPath = path.join(temporaryDirectory, 'base');
    try {
        fs.mkdirSync(checkoutPath);
        execFileSync('git', ['archive', '--output', archivePath, manifest.baseCommit], { cwd: repositoryRoot, stdio: 'pipe' });
        execFileSync('tar', ['-xf', archivePath, '-C', checkoutPath], { stdio: 'pipe' });
        const check = spawnSync('git', ['apply', '--check', '--binary', '--whitespace=error-all', artifactPath], {
            cwd: checkoutPath,
            encoding: 'utf8'
        });
        if (check.status !== 0) {
            temporaryVerificationError = check.stderr.trim() || 'git apply --check failed';
            failures.push(`release artifact does not apply cleanly to baseCommit: ${temporaryVerificationError}`);
        } else {
            const apply = spawnSync('git', ['apply', '--binary', '--whitespace=error-all', artifactPath], {
                cwd: checkoutPath,
                encoding: 'utf8'
            });
            if (apply.status !== 0) {
                temporaryVerificationError = apply.stderr.trim() || 'git apply failed';
                failures.push(`release artifact could not be applied in temporary verification: ${temporaryVerificationError}`);
            } else {
                baseApplicationValid = true;
                isolatedResultDigestsValid = (manifest.files || []).every(file => {
                    const appliedPath = path.join(checkoutPath, file.path);
                    return fs.existsSync(appliedPath) && digest(appliedPath) === file.isolatedResultSha256;
                });
                if (!isolatedResultDigestsValid) failures.push('one or more isolated-result SHA-256 values do not match the applied artifact');
            }
        }
    } catch (error) {
        temporaryVerificationError = error.message;
        failures.push(`temporary base verification failed: ${error.message}`);
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

const isolatableFromCurrentWorkingTree = failures.length === 0 && artifactDigestValid &&
    baseApplicationValid && isolatedResultDigestsValid && unrelatedStorefrontHunksExcluded &&
    gameBoundaryPreserved && socialImageValid;

console.log(JSON.stringify({
    workflow: 'A-018',
    manifestId: manifest.id || null,
    manifestValid: failures.length === 0,
    implementationEvidenceReady: failures.length === 0,
    releaseReady: false,
    deploymentAuthorized: false,
    isolatableFromCurrentWorkingTree,
    isolatedArtifactReadyForReview: isolatableFromCurrentWorkingTree,
    artifactDigestValid,
    baseApplicationValid,
    isolatedResultDigestsValid,
    unrelatedStorefrontHunksExcluded,
    gameBoundaryPreserved,
    socialImageValid,
    playLinkCount,
    fileCount: (manifest.files || []).length,
    currentDirtyEntryCount: dirtyEntries.length,
    baseCommit: currentHead,
    failures,
    warnings,
    blockers: [
        'A named website release and rollback owner has not been recorded.',
        'The last known good live deploy and rollback target are unverified.',
        'The isolated preview has not yet been reviewed.',
        'Kevin has not approved this exact artifact or release window.',
        'No public deployment or post-release check has occurred.'
    ],
    temporaryVerificationError,
    nextAction: 'Name the release and rollback owner, record the last known good live version, review an isolated preview, and ask Kevin to approve this exact artifact before any live release.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;

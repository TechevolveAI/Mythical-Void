#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const SITE_ID = '93c139cb-bcec-4717-8e8d-d95b72a65d64';
const PRODUCTION_ALIAS = 'https://mythicalvoid.com';
const MAX_PUBLICATIONS_PER_24_HOURS = 2;
const PUBLICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOY_PATTERN = /^[0-9a-f]{24}$/i;

function parseArguments(argv) {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--promote') {
            values.promote = true;
            continue;
        }
        if (!['--source-commit', '--merge-commit', '--preview-deploy', '--main-deploy'].includes(argument) || !argv[index + 1]) {
            throw new Error('Usage: node scripts/company/netlify-preview-promotion.cjs --source-commit SHA --merge-commit SHA --preview-deploy ID --main-deploy ID [--promote]');
        }
        values[argument.slice(2)] = argv[index + 1];
        index += 1;
    }
    if (!SHA_PATTERN.test(values['source-commit'] || '') || !SHA_PATTERN.test(values['merge-commit'] || '')) {
        throw new Error('Source and merge commits must be exact 40-character Git commit IDs.');
    }
    if (!DEPLOY_PATTERN.test(values['preview-deploy'] || '') || !DEPLOY_PATTERN.test(values['main-deploy'] || '')) {
        throw new Error('Preview and main deploys must be exact 24-character Netlify deploy IDs.');
    }
    return {
        sourceCommit: values['source-commit'].toLowerCase(),
        mergeCommit: values['merge-commit'].toLowerCase(),
        previewDeployId: values['preview-deploy'].toLowerCase(),
        mainDeployId: values['main-deploy'].toLowerCase(),
        promote: values.promote === true
    };
}

function isPlayerFacingPath(file) {
    return file === 'index.html'
        || file === 'netlify.toml'
        || file === 'vercel.json'
        || file === 'package.json'
        || file === 'package-lock.json'
        || file.startsWith('src/')
        || file.startsWith('public/')
        || file.startsWith('netlify/');
}

function recentPublications(deploys, now = new Date()) {
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs) || !Array.isArray(deploys)) return [];
    return deploys.filter(deploy => {
        const publishedAt = Date.parse(deploy?.published_at || '');
        return Number.isFinite(publishedAt)
            && publishedAt <= nowMs
            && nowMs - publishedAt < PUBLICATION_WINDOW_MS;
    });
}

function evaluatePromotion(input) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const {
        sourceCommit,
        mergeCommit,
        sourceTree,
        mergeTree,
        sourceIsAncestor,
        changedFiles,
        previewDeploy,
        mainDeploy,
        site,
        siteDeploys,
        now
    } = input;
    const secretScan = previewDeploy?.deploy_validations_report?.secret_scan_result;
    const publicationWindow = recentPublications(siteDeploys, now || new Date());

    requireValue(sourceIsAncestor === true, 'The reviewed source commit is not an ancestor of the protected-main merge.');
    requireValue(sourceTree === mergeTree, 'Protected main does not have the exact reviewed source tree.');
    requireValue(Array.isArray(changedFiles) && changedFiles.some(isPlayerFacingPath), 'The merge contains no player-facing or hosting change that needs emergency publication.');
    requireValue(previewDeploy?.site_id === SITE_ID, 'The preview belongs to a different Netlify site.');
    requireValue(previewDeploy?.id === input.previewDeployId, 'The preview deploy ID does not match the requested deploy.');
    requireValue(previewDeploy?.state === 'ready', 'The preview deploy is not ready.');
    requireValue(previewDeploy?.context === 'deploy-preview', 'The candidate is not a pull-request deploy preview.');
    requireValue(previewDeploy?.commit_ref === sourceCommit, 'The preview was not built from the reviewed source commit.');
    requireValue(Number.isInteger(previewDeploy?.review_id) && previewDeploy.review_id > 0, 'The preview is not tied to a pull request.');
    requireValue(previewDeploy?.published_at == null, 'The preview has already been published and must not be promoted again.');
    requireValue(Array.isArray(secretScan?.secretsScanMatches) && secretScan.secretsScanMatches.length === 0, 'The preview secret scan is missing or contains a match.');
    requireValue(Array.isArray(secretScan?.enhancedSecretsScanMatches) && secretScan.enhancedSecretsScanMatches.length === 0, 'The enhanced preview secret scan is missing or contains a match.');
    requireValue(mainDeploy?.site_id === SITE_ID, 'The skipped main deploy belongs to a different Netlify site.');
    requireValue(mainDeploy?.id === input.mainDeployId, 'The main deploy ID does not match the requested deploy.');
    requireValue(mainDeploy?.context === 'production' && mainDeploy?.branch === 'main', 'The skipped deploy is not the protected-main production attempt.');
    requireValue(mainDeploy?.commit_ref === mergeCommit, 'The skipped production deploy is not for the protected-main merge.');
    requireValue(mainDeploy?.state === 'error' && mainDeploy?.skipped === true, 'The production attempt was not explicitly skipped.');
    requireValue(/skipped due to account credit usage exceeded/i.test(mainDeploy?.error_message || ''), 'The production attempt was not skipped solely because account credits were exhausted.');
    requireValue(Date.parse(mainDeploy?.created_at || '') >= Date.parse(previewDeploy?.created_at || ''), 'The skipped production attempt predates the reviewed preview.');
    requireValue(site?.id === SITE_ID, 'The current site status belongs to a different Netlify site.');
    requireValue(site?.disabled !== true, 'The Netlify site is disabled; a deploy promotion cannot restore public service.');
    requireValue(
        publicationWindow.length < MAX_PUBLICATIONS_PER_24_HOURS,
        `The 24-hour release budget is exhausted (${publicationWindow.length}/${MAX_PUBLICATIONS_PER_24_HOURS}); bundle changes and wait before another production promotion.`
    );

    return {
        ready: failures.length === 0,
        failures,
        sourceCommit,
        mergeCommit,
        previewDeployId: input.previewDeployId,
        mainDeployId: input.mainDeployId,
        pullRequest: previewDeploy?.review_id || null,
        changedFiles: changedFiles || [],
        publicationsInLast24Hours: publicationWindow.length,
        maximumPublicationsPer24Hours: MAX_PUBLICATIONS_PER_24_HOURS,
        productionAlias: PRODUCTION_ALIAS,
        externalActionTaken: false
    };
}

function runJson(command, args, cwd) {
    return JSON.parse(execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 20 * 1024 * 1024
    }));
}

function gitText(args, cwd) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function collectEvidence(options, cwd = process.cwd()) {
    let sourceIsAncestor = true;
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', options.sourceCommit, options.mergeCommit], { cwd, stdio: 'ignore' });
    } catch (_error) {
        sourceIsAncestor = false;
    }
    const deployData = deployId => JSON.stringify({ site_id: SITE_ID, deploy_id: deployId });
    return {
        ...options,
        sourceTree: gitText(['rev-parse', `${options.sourceCommit}^{tree}`], cwd),
        mergeTree: gitText(['rev-parse', `${options.mergeCommit}^{tree}`], cwd),
        sourceIsAncestor,
        changedFiles: gitText(['diff', '--name-only', '--no-renames', `${options.mergeCommit}^1`, options.mergeCommit, '--'], cwd).split(/\r?\n/).filter(Boolean),
        previewDeploy: runJson('netlify', ['api', 'getSiteDeploy', '--data', deployData(options.previewDeployId)], cwd),
        mainDeploy: runJson('netlify', ['api', 'getSiteDeploy', '--data', deployData(options.mainDeployId)], cwd),
        site: runJson('netlify', ['api', 'getSite', '--data', JSON.stringify({ site_id: SITE_ID })], cwd),
        siteDeploys: runJson('netlify', ['api', 'listSiteDeploys', '--data', JSON.stringify({ site_id: SITE_ID, per_page: 100 })], cwd),
        now: new Date()
    };
}

function run(argv = process.argv.slice(2), cwd = process.cwd()) {
    const options = parseArguments(argv);
    const evidence = collectEvidence(options, cwd);
    const assessment = evaluatePromotion(evidence);
    if (!assessment.ready) {
        console.error(JSON.stringify({ mode: 'refused', ...assessment }, null, 2));
        process.exitCode = 1;
        return;
    }
    if (!options.promote) {
        console.log(JSON.stringify({ mode: 'dry_run', ...assessment }, null, 2));
        return;
    }
    const restored = runJson('netlify', [
        'api',
        'restoreSiteDeploy',
        '--data',
        JSON.stringify({ site_id: SITE_ID, deploy_id: options.previewDeployId })
    ], cwd);
    if (restored?.id !== options.previewDeployId || restored?.state !== 'ready' || !restored?.published_at) {
        throw new Error('Netlify did not return a ready, published copy of the exact preview.');
    }
    console.log(JSON.stringify({
        mode: 'promoted',
        ready: true,
        sourceCommit: options.sourceCommit,
        mergeCommit: options.mergeCommit,
        previewDeployId: options.previewDeployId,
        skippedMainDeployId: options.mainDeployId,
        publishedAt: restored.published_at,
        productionAlias: PRODUCTION_ALIAS,
        externalActionTaken: true,
        liveVerificationRequired: true
    }, null, 2));
}

if (require.main === module) {
    try {
        run();
    } catch (error) {
        console.error(`Netlify preview promotion failed: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    MAX_PUBLICATIONS_PER_24_HOURS,
    PUBLICATION_WINDOW_MS,
    SITE_ID,
    evaluatePromotion,
    isPlayerFacingPath,
    parseArguments,
    recentPublications
};

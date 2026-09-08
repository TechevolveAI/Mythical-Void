#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArguments(argv) {
    const valueAfter = flag => {
        const index = argv.indexOf(flag);
        return index >= 0 ? argv[index + 1] || null : null;
    };
    return {
        repository: path.resolve(valueAfter('--repository') || process.cwd()),
        baseline: valueAfter('--baseline') || 'origin/main',
        candidate: valueAfter('--candidate') || 'HEAD',
        outputPath: valueAfter('--output') ? path.resolve(valueAfter('--output')) : null
    };
}

function git(repository, args) {
    return execFileSync('git', ['-C', repository, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
}

function repositoryIdentity(repository) {
    try {
        const remote = git(repository, ['remote', 'get-url', 'origin']);
        const match = remote.match(/(?:github\.com[/:])([^/]+\/[^/]+?)(?:\.git)?$/i);
        return match?.[1] || path.basename(repository);
    } catch {
        return path.basename(repository);
    }
}

function isPortalPath(file) {
    return /(?:^|\/)(?:poki|itch|youtube-playables|browser-platform)/i.test(file) ||
        /(?:poki|itch|youtube-playables|browser-platform).*(?:measurement|readiness|package)/i.test(file);
}

function isPlayerVisiblePath(file) {
    return /^(?:src\/(?:scenes|ui|site)\/|src\/main\.js$|src\/game\.js$|src\/config\/(?:kid-mode|project-beacon|creature-responses)\.json$|public\/(?:game\/|marketing\/|.*\.(?:html|css|png|jpe?g|webp|svg)$))/.test(file);
}

function classifyChangedFiles(files) {
    const changedFiles = [...new Set((files || []).filter(Boolean))].sort();
    const playerVisibleFiles = changedFiles.filter(isPlayerVisiblePath);
    const portalFiles = changedFiles.filter(isPortalPath);
    let action = 'no_change';
    if (playerVisibleFiles.length && portalFiles.length) {
        action = 'prepare_private_visual_review_and_remeasure_portal';
    } else if (playerVisibleFiles.length) {
        action = 'prepare_private_visual_review';
    } else if (portalFiles.length) {
        action = 'remeasure_portal';
    } else if (changedFiles.length) {
        action = 'record_private_change';
    }
    return { changedFiles, playerVisibleFiles, portalFiles, action };
}

function resolveWatchAction(classifiedAction, baselineIsAncestor, commitsMatch) {
    if (!commitsMatch && !baselineIsAncestor) return 'rebase_or_rebuild_before_review';
    return classifiedAction;
}

function collectWatchResult({ repository, baseline, candidate, checkedAt = new Date().toISOString() }) {
    const baselineCommit = git(repository, ['rev-parse', `${baseline}^{commit}`]);
    const candidateCommit = git(repository, ['rev-parse', `${candidate}^{commit}`]);
    const mergeBase = git(repository, ['merge-base', baselineCommit, candidateCommit]);
    const baselineIsAncestor = mergeBase === baselineCommit;
    const range = baselineIsAncestor
        ? `${baselineCommit}..${candidateCommit}`
        : `${mergeBase}..${candidateCommit}`;
    const changed = baselineCommit === candidateCommit
        ? []
        : git(repository, ['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
    const classification = classifyChangedFiles(changed);
    const action = resolveWatchAction(
        classification.action,
        baselineIsAncestor,
        baselineCommit === candidateCommit
    );

    return {
        schemaVersion: 1,
        checkedAt,
        repository: repositoryIdentity(repository),
        baselineRef: baseline,
        baselineCommit,
        candidateRef: candidate,
        candidateCommit,
        mergeBase,
        baselineIsAncestor,
        ...classification,
        action,
        nextStep: {
            no_change: 'No new game-development change needs company review.',
            record_private_change: 'Record the private change. Do not publish it.',
            remeasure_portal: 'Remeasure the affected private portal package. Do not submit it.',
            prepare_private_visual_review: 'Review supplied exact-build evidence, or capture privately if none exists. A person must approve visual quality.',
            prepare_private_visual_review_and_remeasure_portal: 'Review exact-build visuals privately and remeasure the affected portal package. Do not publish or submit either.',
            rebase_or_rebuild_before_review: 'This candidate does not contain current production. Rebase or rebuild it on current main before visual review. Do not merge, deploy, or publish it.'
        }[action],
        boundaries: {
            privateReviewOnly: true,
            passingTestsAreVisualApproval: false,
            generatedArtworkIsGameplayApproval: false,
            publicationAuthorized: false,
            deploymentAuthorized: false,
            portalSubmissionAuthorized: false
        }
    };
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    let report;
    try {
        report = collectWatchResult(options);
    } catch (error) {
        console.error(`Game-development watch failed: ${error.stderr || error.message}`);
        process.exit(1);
    }
    const rendered = `${JSON.stringify(report, null, 2)}\n`;
    if (options.outputPath) {
        fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
        fs.writeFileSync(options.outputPath, rendered);
    }
    process.stdout.write(rendered);
}

module.exports = {
    classifyChangedFiles,
    collectWatchResult,
    isPlayerVisiblePath,
    isPortalPath,
    parseArguments,
    repositoryIdentity,
    resolveWatchAction
};

if (require.main === module) main();

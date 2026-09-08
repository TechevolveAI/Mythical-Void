#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const cachedCommit = String(process.env.CACHED_COMMIT_REF || '').trim();
const currentCommit = String(process.env.COMMIT_REF || '').trim();
const commitPattern = /^[0-9a-f]{40}$/i;

const exactPrivateRecords = new Set([
    'docs/company/FOUNDER_CONTROL_PAGE.md',
    'docs/company/NOW_NEXT_LATER.md'
]);

const privateRecordPrefixes = [
    'docs/company/operations/',
    'docs/company/research/',
    'docs/company/reviews/'
];

function requiresPublicBuild(path) {
    if (exactPrivateRecords.has(path)) return false;
    if (privateRecordPrefixes.some(prefix => path.startsWith(prefix))) return false;
    return true;
}

function continueBuild(reason) {
    process.stdout.write(`Netlify build continues: ${reason}\n`);
    process.exitCode = 1;
}

if (!commitPattern.test(cachedCommit) || !commitPattern.test(currentCommit)) {
    continueBuild('a trusted previous/current commit pair was not available.');
} else if (cachedCommit === currentCommit) {
    continueBuild('there is no distinct prior build to compare safely.');
} else {
    try {
        const output = execFileSync(
            'git',
            ['diff', '--name-only', '--no-renames', cachedCommit, currentCommit, '--'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        const changedFiles = output
            .split(/\r?\n/)
            .map(value => value.trim())
            .filter(Boolean);

        if (changedFiles.length === 0) {
            continueBuild('the comparison returned no files, so the safe default is a full build.');
        } else {
            const publicBuildFiles = changedFiles.filter(requiresPublicBuild);
            if (publicBuildFiles.length > 0) {
                continueBuild(`public or build-affecting files changed (${publicBuildFiles.join(', ')}).`);
            } else {
                process.stdout.write(
                    `Netlify build skipped: ${changedFiles.length} private studio-record file(s) changed and no public/build file changed.\n`
                );
                process.exitCode = 0;
            }
        }
    } catch (error) {
        continueBuild(`the change comparison failed (${error?.message || 'unknown error'}).`);
    }
}

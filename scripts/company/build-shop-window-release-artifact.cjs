#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const baseCommit = '1d5c14736ded3480c36f92167353f23a78c4bbef';
const trackedPaths = [
    'index.html',
    'src/site/storefront.js',
    'src/site/storefront.css',
    'vercel.json',
    'netlify.toml'
];
const newPaths = [
    'public/robots.txt',
    'public/sitemap.xml',
    'public/llms.txt',
    'public/og.png',
    'src/site/analytics-consent.js'
];
const outputPath = path.join(
    repositoryRoot,
    'docs/company/operations/release-manifests/artifacts/RM-002-shop-window.patch'
);

function runGit(args, expectedStatuses) {
    const result = spawnSync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
    });
    if (!expectedStatuses.includes(result.status)) {
        throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
    }
    return result.stdout;
}

const sections = [];
for (const filePath of trackedPaths) {
    const diff = runGit(['diff', '--binary', baseCommit, '--', filePath], [0]);
    if (!diff.trim()) throw new Error(`No release change found for ${filePath}`);
    sections.push(diff.trimEnd());
}
for (const filePath of newPaths) {
    if (!fs.existsSync(path.join(repositoryRoot, filePath))) {
        throw new Error(`Missing release file ${filePath}`);
    }
    const diff = runGit(['diff', '--no-index', '--binary', '--', '/dev/null', filePath], [1]);
    if (!diff.trim()) throw new Error(`No new-file patch produced for ${filePath}`);
    sections.push(diff.trimEnd());
}

fs.writeFileSync(outputPath, `${sections.join('\n\n')}\n\n`);
console.log(JSON.stringify({
    artifactPath: path.relative(repositoryRoot, outputPath),
    baseCommit,
    fileCount: trackedPaths.length + newPaths.length,
    files: [...trackedPaths, ...newPaths],
    bytes: fs.statSync(outputPath).size
}, null, 2));

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const distRoot = path.join(root, 'dist');

function walk(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function sourceFiles(directory) {
    return walk(directory).filter(file => {
        const relative = path.relative(root, file);
        return /\.(?:c?js|mjs|html)$/.test(file)
            && !relative.includes('__tests__')
            && !/\.(?:test|spec)\./.test(relative);
    });
}

function matches(source, expression) {
    return [...source.matchAll(expression)].map(match => match[0]);
}

if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error('Distribution readiness cannot be checked: run npm run build first.');
    process.exit(1);
}

const files = walk(distRoot);
const fileDetails = files.map(file => ({
    file: path.relative(root, file),
    bytes: fs.statSync(file).size
}));
const totalBytes = fileDetails.reduce((sum, item) => sum + item.bytes, 0);
const largest = [...fileDetails].sort((a, b) => b.bytes - a.bytes)[0];
const index = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
const rootAbsoluteReferences = [...new Set(matches(index, /(?:src|href)="\/[^"]+/g))];
const applicationSource = sourceFiles(path.join(root, 'src'))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
const hostedFunctionReferences = matches(applicationSource, /\/\.netlify\/functions\//g).length;
const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const remoteEmbeddingDenied = /X-Frame-Options\s*=\s*"DENY"/.test(netlify);

const mib = bytes => Number((bytes / 1024 / 1024).toFixed(2));
const portable = rootAbsoluteReferences.length === 0 && hostedFunctionReferences === 0;

const report = {
    checkedAt: new Date().toISOString(),
    build: {
        totalBytes,
        totalMiB: mib(totalBytes),
        fileCount: fileDetails.length,
        largestFile: { ...largest, mib: mib(largest.bytes) },
        rootAbsoluteReferenceCount: rootAbsoluteReferences.length,
        rootAbsoluteReferences,
        hostedFunctionReferenceCount: hostedFunctionReferences,
        remoteEmbeddingDenied
    },
    platforms: {
        itch: {
            sizeCeiling: totalBytes <= 500 * 1024 * 1024 ? 'pass' : 'fail',
            fileCountCeiling: fileDetails.length <= 1000 ? 'pass' : 'fail',
            singleFileCeiling: largest.bytes <= 200 * 1024 * 1024 ? 'pass' : 'fail',
            portablePathsAndServices: portable ? 'pass' : 'fail',
            remoteWebsiteEmbed: remoteEmbeddingDenied ? 'blocked_by_design' : 'needs_security_review',
            decision: portable ? 'ready_for_platform_frame_testing' : 'separate_portable_build_required'
        },
        crazygames: {
            totalSizeCeiling: totalBytes <= 250 * 1024 * 1024 ? 'pass' : 'fail',
            fileCountCeiling: fileDetails.length <= 1500 ? 'pass' : 'fail',
            initialDownloadCeiling: 'not_measured',
            portablePathsAndServices: portable ? 'pass' : 'fail',
            audienceAndPegiReview: 'required',
            decision: 'not_submission_ready'
        },
        poki: {
            recommendedTotalSize: totalBytes <= 8 * 1024 * 1024 ? 'pass' : 'fail',
            recommendedInitialDownload: 'not_measured',
            portablePathsAndServices: portable ? 'pass' : 'fail',
            decision: 'major_size_reduction_required'
        }
    },
    notes: [
        'Overall build size is not the same as initial download size.',
        'Published platform limits can change and must be checked again before submission.',
        'X-Frame-Options DENY is a valid production-site protection; do not remove it merely to make the owned site embeddable.',
        'A separate portable release should be tested in the target platform frame.'
    ]
};

console.log(JSON.stringify(report, null, 2));

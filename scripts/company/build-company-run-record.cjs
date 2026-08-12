#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const detectorPath = path.join(repositoryRoot, 'scripts', 'company', 'detect-company-control-plane-changes.cjs');

function parseArguments(values) {
    const result = { inputPath: null, outputDirectory: null };
    for (let index = 0; index < values.length; index += 1) {
        const argument = values[index];
        if (!['--input', '--output-dir'].includes(argument)) throw new Error(`Unknown argument ${argument}`);
        const value = values[index + 1];
        if (!value) throw new Error(`${argument} requires a path`);
        if (argument === '--input') result.inputPath = path.resolve(value);
        else result.outputDirectory = path.resolve(value);
        index += 1;
    }
    return result;
}

function loadJson(file, label) {
    try {
        return { raw: fs.readFileSync(file, 'utf8'), value: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (error) {
        throw new Error(`${label} could not be read: ${error.message}`);
    }
}

function containsProhibitedKey(value, trail = []) {
    const prohibited = new Set([
        'rawMessage', 'messageBody', 'email', 'phone', 'name', 'accountId',
        'userId', 'ipAddress', 'token', 'password', 'secret', 'transcript',
        'customerContent', 'supportContent', 'prompt', 'artifactContent'
    ]);
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const found = containsProhibitedKey(value[index], [...trail, String(index)]);
            if (found) return found;
        }
        return null;
    }
    for (const [key, child] of Object.entries(value)) {
        if (prohibited.has(key)) return [...trail, key].join('.');
        const found = containsProhibitedKey(child, [...trail, key]);
        if (found) return found;
    }
    return null;
}

let options;
try {
    options = parseArguments(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

let sourceRaw;
let source;
try {
    if (options.inputPath) {
        const loaded = loadJson(options.inputPath, 'A-015 input');
        sourceRaw = loaded.raw;
        source = loaded.value;
    } else {
        const result = spawnSync(process.execPath, [detectorPath], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            timeout: 90_000,
            maxBuffer: 5 * 1024 * 1024
        });
        if (![0, 2].includes(result.status)) throw new Error(`A-015 failed with exit ${result.status}: ${result.stderr.trim()}`);
        sourceRaw = result.stdout;
        source = JSON.parse(result.stdout);
    }
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const failures = [];
if (source.workflow !== 'A-015') failures.push('Input workflow must be A-015');
if (source.comparisonValid !== true) failures.push('A-015 comparison must be valid');
if (source.externalActionAuthorized !== false) failures.push('A-015 must report no external action authorization');
for (const field of ['baselineCapturedAt', 'currentCapturedAt']) {
    if (typeof source[field] !== 'string' || Number.isNaN(Date.parse(source[field]))) failures.push(`${field} is invalid`);
}
if (!Number.isInteger(source.changeCount) || source.changeCount < 0) failures.push('changeCount must be a non-negative integer');
if (!source.severityCounts || typeof source.severityCounts !== 'object' || Array.isArray(source.severityCounts)) failures.push('severityCounts must be an object');
if (typeof source.alertRequired !== 'boolean') failures.push('alertRequired must be boolean');
if (typeof source.humanReviewRecommended !== 'boolean') failures.push('humanReviewRecommended must be boolean');
const prohibitedPath = containsProhibitedKey(source);
if (prohibitedPath) failures.push(`Input contains prohibited payload field ${prohibitedPath}`);

const digest = crypto.createHash('sha256').update(sourceRaw).digest('hex');
const timestamp = new Date(source.currentCapturedAt);
const compactTimestamp = timestamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const recordId = `RUN-${compactTimestamp}-${digest.slice(0, 12)}`;
const record = {
    schemaVersion: 1,
    recordId,
    createdAt: new Date().toISOString(),
    workflowId: 'A-015',
    workflowVersion: 1,
    mode: 'read_only_change_comparison',
    baselineCapturedAt: source.baselineCapturedAt,
    currentCapturedAt: source.currentCapturedAt,
    result: {
        comparisonValid: source.comparisonValid,
        changeCount: source.changeCount,
        severityCounts: source.severityCounts,
        alertRequired: source.alertRequired,
        humanReviewRecommended: source.humanReviewRecommended
    },
    sourceDigestSha256: digest,
    externalActionAuthorized: false,
    sensitivePayloadIncluded: false,
    retentionClass: 'company_control_metadata',
    writerMode: options.outputDirectory ? 'exclusive_create_local_pilot' : 'dry_run'
};

let outputPath = null;
if (options.outputDirectory && failures.length === 0) {
    const filesystemRoot = path.parse(options.outputDirectory).root;
    if (options.outputDirectory === filesystemRoot || options.outputDirectory === repositoryRoot) {
        failures.push('output directory may not be a filesystem or repository root');
    } else if (!fs.existsSync(options.outputDirectory) || !fs.statSync(options.outputDirectory).isDirectory()) {
        failures.push('output directory must already exist');
    } else {
        outputPath = path.join(options.outputDirectory, `${recordId}.json`);
        try {
            fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        } catch (error) {
            failures.push(`exclusive run-record creation failed: ${error.message}`);
            outputPath = null;
        }
    }
}

console.log(JSON.stringify({
    workflow: 'A-016',
    mode: options.outputDirectory ? 'exclusive local pilot write' : 'dry-run record build',
    recordValid: failures.length === 0,
    recordWritten: outputPath !== null,
    outputPath,
    externalActionAuthorized: false,
    failures,
    record
}, null, 2));

if (failures.length) process.exitCode = 1;

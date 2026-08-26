#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-web-distribution-launch-map.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/growth/WEB_DISTRIBUTION_LAUNCH_MAP.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-web-launch-map-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    return spawnSync(process.execPath, [validator, '--map', target], { encoding: 'utf8' });
}

function pokiChange(changes) {
    return {
        ...source,
        primaryFork: source.primaryFork.map(route => route.id === 'poki_first_reach_bet'
            ? { ...route, knownTerms: { ...route.knownTerms, ...changes } }
            : route)
    };
}

try {
    assert.strictEqual(execute('baseline', source).status, 0);
    assert.notStrictEqual(execute('hide-exclusivity', pokiChange({ preferredDealIsWebExclusive: false })).status, 0);
    assert.notStrictEqual(execute('hide-term', pokiChange({ indicativeExclusiveTermYears: null })).status, 0);
    assert.notStrictEqual(execute('authorize-publishing', { ...source, authority: { ...source.authority, itchPublicationAuthorized: true } }).status, 0);
    assert.notStrictEqual(execute('skip-kevin', { ...source, recommendation: { ...source.recommendation, afterVisualGate: 'Publish automatically.' } }).status, 0);
    assert.notStrictEqual(execute('fake-visuals', { ...source, currentTruth: { ...source.currentTruth, approvedAuthenticVisualMoments: 4 } }).status, 0);
    assert.notStrictEqual(execute('hide-poki-assessment', { ...source, technicalAssessment: undefined }).status, 0);
    assert.notStrictEqual(execute('pretend-poki-ready', { ...source, technicalAssessment: { ...source.technicalAssessment, decision: 'go', submissionReady: true } }).status, 0);
    assert.notStrictEqual(execute('hide-total-gap', { ...source, technicalAssessment: { ...source.technicalAssessment, totalTargetMet: true } }).status, 0);
    console.log('Web distribution launch-map checks passed (9 scenarios).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

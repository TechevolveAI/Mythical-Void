#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-science-week-water-concept.cjs');
const sourceConcept = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.json'), 'utf8'));
const sourceSummary = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-science-week-water-'));

function run(name, concept = sourceConcept, summary = sourceSummary) {
    const conceptFile = path.join(temp, `${name}-concept.json`);
    const summaryFile = path.join(temp, `${name}-summary.md`);
    fs.writeFileSync(conceptFile, `${JSON.stringify(concept, null, 2)}\n`);
    fs.writeFileSync(summaryFile, summary);
    return spawnSync(process.execPath, [validator, conceptFile, summaryFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid Science Week water concept was rejected.');

    const submitted = structuredClone(sourceConcept);
    submitted.opportunity.mythicalEventSubmitted = true;
    if (run('submitted', submitted).status === 0) throw new Error('An invented event submission was accepted.');

    const logo = structuredClone(sourceConcept);
    logo.authority.logoUseAuthorized = true;
    if (run('logo', logo).status === 0) throw new Error('Unauthorized Science Week logo use was accepted.');

    const childCollection = structuredClone(sourceConcept);
    childCollection.authority.childWorkCollectionAuthorized = true;
    if (run('child-collection', childCollection).status === 0) throw new Error('Child-work collection was accepted.');

    const certainty = structuredClone(sourceConcept);
    certainty.realScience[1].statement = 'Europa definitely has life in a salty ocean.';
    if (run('certainty', certainty).status === 0) throw new Error('An unsupported Europa certainty was accepted.');

    console.log('Science Week water concept tests passed: valid concept plus 4 event, safety and science mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

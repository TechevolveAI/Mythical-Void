#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-adult-stem-outreach.cjs');
const sourcePipeline = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_DISCOVERY_PIPELINE_2026-08-14.json'), 'utf8'));
const sourceWave = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_OUTREACH_WAVE.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-adult-stem-outreach-'));

function run(name, pipeline = sourcePipeline, wave = sourceWave) {
    const pipelineFile = path.join(temp, `${name}-pipeline.json`);
    const waveFile = path.join(temp, `${name}-wave.json`);
    fs.writeFileSync(pipelineFile, `${JSON.stringify(pipeline, null, 2)}\n`);
    fs.writeFileSync(waveFile, `${JSON.stringify(wave, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, pipelineFile, waveFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid adult STEM outreach was rejected.');

    const sent = structuredClone(sourceWave);
    sent.messages[0].sentAt = '2026-08-14T00:00:00Z';
    if (run('sent', sourcePipeline, sent).status === 0) throw new Error('An unapproved sent message was accepted.');

    const childCollection = structuredClone(sourceWave);
    childCollection.authority.childWorkCollectionAuthorized = true;
    if (run('child-collection', sourcePipeline, childCollection).status === 0) throw new Error('Child-work collection was accepted.');

    const attachment = structuredClone(sourceWave);
    attachment.senderGate.attachmentsAllowedOnFirstContact = true;
    if (run('attachment', sourcePipeline, attachment).status === 0) throw new Error('A first-contact attachment was accepted.');

    const endorsement = structuredClone(sourceWave);
    endorsement.messages[1].body = 'ESERO endorses Mythical Void.';
    if (run('endorsement', sourcePipeline, endorsement).status === 0) throw new Error('An endorsement claim was accepted.');

    console.log('Adult STEM outreach tests passed: valid records plus 4 safety and authority mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

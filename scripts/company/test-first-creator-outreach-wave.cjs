#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const wavePath = path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json');
const pipelinePath = path.join(root, 'docs/company/content/channel-launch/CREATOR_OUTREACH_PIPELINE.json');
const validatorPath = path.join(root, 'scripts/company/validate-first-creator-outreach-wave.cjs');
const wave = JSON.parse(fs.readFileSync(wavePath, 'utf8'));
const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-outreach-wave-'));
const candidateWavePath = path.join(tempDir, 'wave.json');
const candidatePipelinePath = path.join(tempDir, 'pipeline.json');

const runValidator = (candidateWave, candidatePipeline = pipeline) => {
    fs.writeFileSync(candidateWavePath, `${JSON.stringify(candidateWave, null, 2)}\n`);
    fs.writeFileSync(candidatePipelinePath, `${JSON.stringify(candidatePipeline, null, 2)}\n`);
    return spawnSync(process.execPath, [validatorPath, candidateWavePath, candidatePipelinePath], { cwd: root, encoding: 'utf8' });
};

try {
    const valid = runValidator(wave);
    if (valid.status !== 0) throw new Error(`Valid outreach wave rejected: ${valid.stderr}`);

    const authorizedSend = structuredClone(wave);
    authorizedSend.authority.sendingAuthorized = true;
    if (runValidator(authorizedSend).status === 0) throw new Error('Unauthorized sending state was accepted.');

    const inventedSender = structuredClone(wave);
    inventedSender.senderGate.officialStudioSenderAvailable = true;
    if (runValidator(inventedSender).status === 0) throw new Error('Invented studio sender was accepted.');

    const missingApproval = structuredClone(wave);
    missingApproval.messages[0].missingPrerequisites = ['Create an account'];
    if (runValidator(missingApproval).status === 0) throw new Error('A message without Kevin approval was accepted.');

    const unsafeCompanionClaim = structuredClone(wave);
    unsafeCompanionClaim.messages[0].body += '\nMeet your AI companion.';
    if (runValidator(unsafeCompanionClaim).status === 0) throw new Error('AI companion wording was accepted.');

    const uniquenessClaim = structuredClone(wave);
    uniquenessClaim.messages[1].body += '\nNo two creatures are alike.';
    if (runValidator(uniquenessClaim).status === 0) throw new Error('Absolute uniqueness wording was accepted.');

    const nasaEndorsement = structuredClone(wave);
    nasaEndorsement.messages[2].body += '\nNASA partnership included.';
    if (runValidator(nasaEndorsement).status === 0) throw new Error('NASA partnership wording was accepted.');

    const bulkWave = structuredClone(wave);
    bulkWave.waveStrategy.maximumFirstWaveMessages = 20;
    if (runValidator(bulkWave).status === 0) throw new Error('Bulk first-wave outreach was accepted.');

    const unknownCandidate = structuredClone(wave);
    unknownCandidate.messages[0].candidateRef = 'RC-999';
    unknownCandidate.waveStrategy.firstWaveOrder[0] = 'RC-999';
    if (runValidator(unknownCandidate).status === 0) throw new Error('An unknown candidate was accepted.');

    console.log('First creator outreach tests passed: valid wave plus 8 unsafe mutations checked.');
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}

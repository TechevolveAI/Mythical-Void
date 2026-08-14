const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const campaignPath = path.join(root, 'docs/company/content/campaigns/playable-now-launch.json');
const validatorPath = path.join(root, 'scripts/company/validate-playable-now-launch.cjs');
const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-launch-test-'));
const candidatePath = path.join(tempDir, 'campaign.json');

const runValidator = (candidate) => {
    fs.writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    return spawnSync(process.execPath, [validatorPath, candidatePath], { cwd: root, encoding: 'utf8' });
};

try {
    const valid = runValidator(campaign);
    if (valid.status !== 0) throw new Error(`Valid campaign rejected: ${valid.stderr}`);

    const publishes = structuredClone(campaign);
    publishes.authority.publishingAuthorized = true;
    if (runValidator(publishes).status === 0) throw new Error('Unsafe publishing authority was accepted.');

    const companionCopy = structuredClone(campaign);
    companionCopy.content[0].copy = companionCopy.content[0].copy.replace('creatures', 'companions');
    if (runValidator(companionCopy).status === 0) throw new Error('Companion language was accepted.');

    const absoluteClaim = structuredClone(campaign);
    absoluteClaim.content[0].copy += '\nNo two creatures are alike.';
    if (runValidator(absoluteClaim).status === 0) throw new Error('Absolute uniqueness claim was accepted.');

    const unknownClaim = structuredClone(campaign);
    unknownClaim.content[0].claimIds.push('CL-999');
    if (runValidator(unknownClaim).status === 0) throw new Error('Unknown claim was accepted.');

    const wrongLink = structuredClone(campaign);
    wrongLink.content[0].copy = wrongLink.content[0].copy.replace(campaign.canonicalUrl, 'https://example.com/');
    if (runValidator(wrongLink).status === 0) throw new Error('Unapproved destination was accepted.');

    console.log('Playable Now launch tests passed: valid pack plus 5 unsafe mutations checked.');
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}

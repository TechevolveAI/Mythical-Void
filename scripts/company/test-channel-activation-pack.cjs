const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const activationPath = path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json');
const outreachPath = path.join(root, 'docs/company/content/channel-launch/CREATOR_OUTREACH_PIPELINE.json');
const validatorPath = path.join(root, 'scripts/company/validate-channel-activation-pack.cjs');
const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
const outreach = JSON.parse(fs.readFileSync(outreachPath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-channel-activation-'));
const candidateActivationPath = path.join(tempDir, 'activation.json');
const candidateOutreachPath = path.join(tempDir, 'outreach.json');

const runValidator = (candidateActivation, candidateOutreach) => {
    fs.writeFileSync(candidateActivationPath, `${JSON.stringify(candidateActivation, null, 2)}\n`);
    fs.writeFileSync(candidateOutreachPath, `${JSON.stringify(candidateOutreach, null, 2)}\n`);
    return spawnSync(process.execPath, [validatorPath, candidateActivationPath, candidateOutreachPath], { cwd: root, encoding: 'utf8' });
};

try {
    const valid = runValidator(activation, outreach);
    if (valid.status !== 0) throw new Error(`Valid channel pack rejected: ${valid.stderr}`);

    const publishing = structuredClone(activation);
    publishing.authority.publishingAuthorized = true;
    if (runValidator(publishing, outreach).status === 0) throw new Error('Publishing authority was accepted.');

    const unsafeComments = structuredClone(activation);
    unsafeComments.channels.find((channel) => channel.channelRef === 'CH-002').commentSetting.beforeNamedAdultCoverage = 'on';
    if (runValidator(unsafeComments, outreach).status === 0) throw new Error('Uncovered YouTube comments were accepted.');

    const fixedAudience = structuredClone(activation);
    fixedAudience.channels.find((channel) => channel.channelRef === 'CH-002').audienceSetting.recommendedChoice = 'Not made for kids';
    if (runValidator(fixedAudience, outreach).status === 0) throw new Error('A fixed audience assumption was accepted.');

    const companionCopy = structuredClone(activation);
    companionCopy.channels.find((channel) => channel.channelRef === 'CH-004').firstPosts[0].copy += '\nMeet your AI companion.';
    if (runValidator(companionCopy, outreach).status === 0) throw new Error('Companion wording was accepted.');

    const bulkOutreach = structuredClone(outreach);
    bulkOutreach.authority.bulkOutreachAuthorized = true;
    if (runValidator(activation, bulkOutreach).status === 0) throw new Error('Bulk outreach was accepted.');

    const childContact = structuredClone(outreach);
    childContact.rules.noPrivateContactWithChildren = false;
    if (runValidator(activation, childContact).status === 0) throw new Error('Private child contact was accepted.');

    const inflatedScore = structuredClone(outreach);
    inflatedScore.researchCandidates[0].totalScore += 1;
    if (runValidator(activation, inflatedScore).status === 0) throw new Error('An inflated candidate score was accepted.');

    const unapprovedRecipient = structuredClone(outreach);
    unapprovedRecipient.recipients.push({ name: 'Invented recipient' });
    if (runValidator(activation, unapprovedRecipient).status === 0) throw new Error('An unapproved recipient was accepted.');

    console.log('Channel activation tests passed: valid pack plus 7 unsafe mutations checked.');
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}

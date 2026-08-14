#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-science-week-review-invitation.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_INVITATION.json'), 'utf8'));
const sourceReadable = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_INVITATION.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-science-week-invitation-'));

function run(name, invitation = source, readable = sourceReadable) {
    const invitationFile = path.join(temp, `${name}.json`);
    const readableFile = path.join(temp, `${name}.md`);
    fs.writeFileSync(invitationFile, `${JSON.stringify(invitation, null, 2)}\n`);
    fs.writeFileSync(readableFile, readable);
    return spawnSync(process.execPath, [validator, invitationFile, readableFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid adult review invitation was rejected.');

    const sent = structuredClone(source);
    sent.invitation.sentAt = '2026-08-14T00:00:00Z';
    if (run('sent', sent).status === 0) throw new Error('An unapproved sent invitation was accepted.');

    const attachment = structuredClone(source);
    attachment.invitation.attachmentOnFirstContact = true;
    if (run('attachment', attachment).status === 0) throw new Error('A first-contact attachment was accepted.');

    const childTest = structuredClone(source);
    childTest.authority.childTestingAuthorized = true;
    if (run('child-test', childTest).status === 0) throw new Error('Child testing was accepted.');

    const partnership = structuredClone(source);
    partnership.authority.partnershipClaimAuthorized = true;
    if (run('partnership', partnership).status === 0) throw new Error('A partnership claim was accepted.');

    const weakBody = structuredClone(source);
    weakBody.invitation.body = 'Please promote our activity.';
    if (run('weak-body', weakBody).status === 0) throw new Error('A misleading promotion request was accepted.');

    console.log('Science Week review invitation tests passed: valid draft plus 5 sending, attachment, child-safety, partnership and wording mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const invitationPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_INVITATION.json');
const readablePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_EDUCATOR_REVIEW_INVITATION.md');
const invitation = JSON.parse(fs.readFileSync(invitationPath, 'utf8'));
const readable = fs.readFileSync(readablePath, 'utf8');
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(invitation.schemaVersion === 1, 'Review invitation schemaVersion must be 1.');
requireValue(invitation.state === 'one_adult_only_draft_ready_waiting_for_kevin', 'Review invitation must remain one unsent adult-only draft.');
requireValue(invitation.candidate?.candidateRef === 'RC-011' && invitation.candidate?.recipient === 'MTU Blackrock Castle Observatory education team', 'Invitation must retain its verified first adult education route.');
requireValue(invitation.candidate?.routeSource === 'https://www.bco.ie/plan-your-visit/' && invitation.candidate?.routeType === 'public professional email', 'Invitation must retain the sourced professional route.');
requireValue(invitation.candidate?.approvedByKevin === false && invitation.candidate?.contactedAt === null, 'Candidate must remain unapproved and uncontacted.');
requireValue(invitation.invitation?.attachmentOnFirstContact === false, 'First contact must not include an attachment.');
requireValue(invitation.invitation?.approved === false && invitation.invitation?.sentAt === null && invitation.invitation?.replyReceivedAt === null, 'Invitation must remain unapproved, unsent and unanswered.');
requireValue(invitation.approvalChecklist?.length === 6, 'Invitation must retain its six send checks.');
requireValue(Object.keys(invitation.responseRules || {}).length === 5, 'Invitation must retain all five response rules.');

const body = invitation.invitation?.body || '';
for (const phrase of [
    'adult member of your education team',
    'not promotion, endorsement or a partnership',
    'do not collect children’s work or personal information',
    'only send the PDF after you confirm',
    'If it is not a fit, no reply is needed'
]) {
    requireValue(body.includes(phrase), `Invitation body must retain: ${phrase}`);
}
requireValue(!/attachment|attached/i.test(body), 'First invitation body must not claim that a file is attached.');

for (const field of ['recipientApproved', 'sendingAuthorized', 'attachmentAuthorized', 'followUpAuthorized', 'childTestingAuthorized', 'childDataCollectionAuthorized', 'endorsementClaimAuthorized', 'partnershipClaimAuthorized', 'spendAuthorized', 'externalActionAuthorized']) {
    requireValue(invitation.authority?.[field] === false, `${field} must remain false.`);
}
requireValue(/Nothing has been sent/i.test(readable), 'Human-readable draft must clearly say nothing has been sent.');
requireValue(/Do not attach the PDF to the first message/i.test(readable), 'Human-readable draft must retain the no-attachment gate.');
requireValue(!/\bcompanions?\b/i.test(`${body}\n${readable}`), 'Review invitation must use creature or organism language.');

if (errors.length) {
    console.error(`Science Week review invitation validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Science Week review invitation valid: one adult professional draft, no attachment, sending, child contact, endorsement, partnership or spend authorized.');

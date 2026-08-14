#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pipelinePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_DISCOVERY_PIPELINE_2026-08-14.json');
const wavePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_OUTREACH_WAVE.json');
const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
const wave = JSON.parse(fs.readFileSync(wavePath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(pipeline.schemaVersion === 1 && wave.schemaVersion === 1, 'STEM outreach records must use schemaVersion 1.');
requireValue(pipeline.state === 'research_verified_two_drafts_prepared_no_contact', 'The discovery pipeline must remain researched with no contact.');
requireValue(wave.state === 'two_drafts_ready_waiting_for_sender_and_kevin_approval', 'The outreach wave must remain waiting for sender and Kevin approval.');

for (const authority of [pipeline.authority, wave.authority]) {
    requireValue(authority?.outreachAuthorized === false, 'Outreach must remain unauthorized.');
    requireValue(authority?.sendingAuthorized === false, 'Sending must remain unauthorized.');
    requireValue(authority?.bulkOutreachAuthorized === false, 'Bulk outreach must remain unauthorized.');
    requireValue(authority?.childWorkCollectionAuthorized === false, 'Child-work collection must remain unauthorized.');
    requireValue(authority?.externalActionAuthorized === false, 'External action must remain unauthorized.');
}

const expectedCandidates = new Set(['RC-011', 'RC-012', 'RC-013', 'RC-014']);
requireValue(pipeline.candidates?.length === 4, 'The adult STEM shortlist must retain four researched candidates.');
for (const candidate of pipeline.candidates || []) {
    requireValue(expectedCandidates.has(candidate.id), `${candidate.id} is not in the reviewed shortlist.`);
    requireValue(candidate.sourceCheckedAt === '2026-08-14', `${candidate.id} must retain the dated source check.`);
    requireValue(candidate.outreachApproved === false && candidate.contactedAt === null, `${candidate.id} must remain unapproved and uncontacted.`);
    const score = Object.values(candidate.scores || {}).reduce((sum, value) => sum + value, 0);
    requireValue(score === candidate.totalScore, `${candidate.id} score does not add up.`);
    requireValue(score >= pipeline.qualification.minimumScore && score <= pipeline.qualification.maximumScore, `${candidate.id} falls outside the qualification range.`);
    requireValue(/^https:\/\//.test(candidate.source || ''), `${candidate.id} must cite an official web source.`);
}

const messages = wave.messages || [];
requireValue(messages.length === 2, 'The first adult STEM wave must contain exactly two personal drafts.');
requireValue(messages.map(message => message.candidateRef).join(',') === 'RC-011,RC-012', 'The first adult STEM wave must retain BCO first and ESERO second.');
requireValue(messages.every(message => message.approved === false && message.sentAt === null && message.followUpDueAt === null), 'Every adult STEM message must remain unapproved and unsent.');
requireValue(messages[0]?.route === 'info@bco.ie', 'The BCO message must use the public professional route from its official site.');
requireValue(messages[1]?.route === 'eseroireland@researchireland.ie', 'The ESERO message must use the public professional route from its official site.');
requireValue(wave.senderGate?.officialStudioSenderAvailable === false, 'The official studio sender must remain recorded as unavailable.');
requireValue(wave.senderGate?.attachmentsAllowedOnFirstContact === false, 'First contact must remain attachment-free.');
requireValue(/Do not send both together/i.test(wave.sendRule || ''), 'The one-at-a-time send rule must remain explicit.');
requireValue((wave.approvalChecklist || []).length === 5, 'The outreach wave must retain all five approval checks.');

const messageText = messages.map(message => `${message.subject}\n${message.body}`).join('\n');
requireValue(messages.every(message => /not endorsed/i.test(message.body || '')), 'Every message must state the no-endorsement boundary.');
requireValue(messages.every(message => /do not collect work or personal information from children/i.test(message.body || '')), 'Every message must state the child-data boundary.');
requireValue(!/\bcompanions?\b/i.test(messageText), 'Adult STEM outreach must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b/i.test(messageText), 'Adult STEM outreach must not promise absolute uniqueness.');
requireValue(!/endorsed by (?:NASA|ESA|ESERO|Research Ireland|BCO)/i.test(messageText.replace(/not endorsed by/gi, '')), 'Adult STEM outreach must not imply endorsement.');

if (errors.length) {
    console.error(`Adult STEM outreach validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Adult STEM outreach valid: ${pipeline.candidates.length} researched adult routes, ${messages.length} personal drafts, nothing approved or sent.`);

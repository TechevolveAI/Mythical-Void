#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const wavePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json');
const pipelinePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/CREATOR_OUTREACH_PIPELINE.json');
const wave = JSON.parse(fs.readFileSync(wavePath, 'utf8'));
const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(wave.schemaVersion === 1, 'Outreach wave schemaVersion must be 1.');
requireValue(wave.asOf === pipeline.asOf, 'Outreach wave and candidate research must have the same current date.');
requireValue(wave.state === 'drafts_ready_waiting_for_named_sender_and_kevin_approval', 'Outreach wave must remain an unapproved draft.');
requireValue(wave.canonicalUrl === 'https://mythicalvoid.com/', 'Outreach wave must use the canonical play URL.');
requireValue(wave.pressUrl === 'https://mythicalvoid.com/press/', 'Outreach wave must use the canonical press URL.');

for (const field of ['recipientApproved', 'outreachAuthorized', 'sendingAuthorized', 'directMessagingAuthorized', 'bulkOutreachAuthorized', 'paidPlacementAuthorized', 'externalActionAuthorized']) {
    requireValue(wave.authority?.[field] === false, `Outreach authority.${field} must remain false.`);
}

requireValue(wave.senderGate?.officialStudioSenderAvailable === false, 'An official sender must not be invented.');
requireValue(Array.isArray(wave.senderGate?.doNot) && wave.senderGate.doNot.length >= 4, 'Sender gate needs explicit safety boundaries.');
requireValue(wave.waveStrategy?.maximumFirstWaveMessages === 3, 'The first outreach wave must remain limited to three messages.');
requireValue(wave.waveStrategy?.sendIndividually === true, 'First-wave messages must be sent individually.');
requireValue(wave.waveStrategy?.minimumDaysBeforeSingleFollowUp >= 7, 'A follow-up must wait at least seven days.');
requireValue(wave.waveStrategy?.maximumFollowUps === 1 && wave.waveStrategy?.stopAfterNoResponse === true, 'Only one follow-up may be prepared before stopping.');

const candidates = new Map((pipeline.researchCandidates || []).map((candidate) => [candidate.id, candidate]));
const messages = wave.messages || [];
requireValue(messages.length === 3, 'The first outreach wave must contain exactly three messages.');
requireValue(new Set(messages.map((message) => message.candidateRef)).size === messages.length, 'Each first-wave message must have a different candidate.');
requireValue(JSON.stringify(messages.map((message) => message.candidateRef)) === JSON.stringify(wave.waveStrategy?.firstWaveOrder), 'Message order must match the declared first-wave order.');

const unsafeClaims = [
    /\bAI companions?\b/i,
    /\bno two (?:creatures )?(?:are )?alike\b/i,
    /\bevery creature is unique\b/i,
    /\bNASA (?:partner|partnership|endorsed|endorsement)\b/i,
    /\bfinished game\b/i
];

for (const message of messages) {
    const candidate = candidates.get(message.candidateRef);
    requireValue(Boolean(candidate), `${message.id} references an unknown research candidate.`);
    requireValue(candidate?.totalScore >= pipeline.qualification?.minimumScore, `${message.id} candidate is below the qualification threshold.`);
    requireValue(/^OW-\d{3}$/.test(message.id || ''), `Invalid outreach message id: ${message.id || '(missing)'}.`);
    requireValue(/^https:\/\//.test(message.routeSource || ''), `${message.id} needs a public HTTPS route source.`);
    requireValue(message.routeSource === candidate?.source, `${message.id} route source must match the candidate's verified source.`);
    requireValue(/public professional/i.test(message.routeType || ''), `${message.id} must use a public professional route.`);
    requireValue(Boolean(message.subject?.trim()) && Boolean(message.body?.trim()), `${message.id} needs a subject and body.`);
    requireValue(message.body?.includes(wave.canonicalUrl), `${message.id} must include the canonical play URL.`);
    requireValue(message.body?.includes(wave.pressUrl), `${message.id} must include the canonical press URL.`);
    requireValue(Boolean(message.tailoredEvidence?.trim()), `${message.id} needs a precise tailoring reason.`);
    requireValue(Array.isArray(message.missingPrerequisites) && message.missingPrerequisites.some((item) => /Kevin approves/i.test(item)), `${message.id} must require Kevin's approval.`);
    requireValue(message.approved === false && message.sentAt === null, `${message.id} must remain unapproved and unsent.`);
    for (const unsafeClaim of unsafeClaims) {
        requireValue(!unsafeClaim.test(`${message.subject}\n${message.body}`), `${message.id} contains an unsafe or unsupported claim: ${unsafeClaim}.`);
    }
    requireValue(!/\bguaranteed coverage\b/i.test(message.body || ''), `${message.id} must not promise coverage.`);
    requireValue(!/\b(attached|attachment)\b/i.test(message.body || ''), `${message.id} must not claim a first-contact attachment.`);
}

const allPublicCopy = JSON.stringify({ messages, nextWave: wave.nextWave, claimBoundaries: wave.claimBoundaries });
requireValue(!/\bAI companions?\b/i.test(allPublicCopy), 'Outreach materials must use creature language.');
requireValue(Array.isArray(wave.nextWave) && wave.nextWave.length >= 5, 'The next wave must keep credible later opportunities visible.');
requireValue(wave.nextWave?.some((item) => item.state === 'future_opportunity_watch'), 'The plan must distinguish future opportunities from immediate outreach.');
requireValue(Array.isArray(wave.claimBoundaries) && wave.claimBoundaries.length >= 6, 'The wave needs explicit claim boundaries.');

if (errors.length) {
    console.error(`First creator outreach wave validation failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`First creator outreach wave valid: ${messages.length} tailored drafts, ${wave.nextWave.length} later opportunities, all external actions gated.`);

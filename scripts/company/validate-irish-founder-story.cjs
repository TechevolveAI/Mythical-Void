#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const releasePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/IRISH_FOUNDER_STORY_RELEASE.json');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const articlePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, release.article?.file || '');
const article = fs.readFileSync(articlePath, 'utf8');
const claims = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/claims.json'), 'utf8')).claims || [];
const claimMap = new Map(claims.map(claim => [claim.id, claim]));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(release.schemaVersion === 1, 'Founder story release schemaVersion must be 1.');
requireValue(release.state === 'article_and_pitch_prepared_waiting_for_kevin_and_first_wave_learning', 'Founder story must remain prepared and waiting for Kevin.');
requireValue(release.target?.candidateRef === 'RC-007' && release.target?.name === 'Irish Tech News', 'Founder story must retain its reviewed Irish Tech News target.');
requireValue(release.target?.routeSource === 'https://irishtechnews.ie/the-team/' && release.target?.verifiedAt === '2026-08-14', 'Founder story must retain its dated official contribution source.');

for (const field of ['recipientApproved', 'outreachAuthorized', 'sendingAuthorized', 'publicationAuthorized', 'paidPlacementAuthorized', 'interviewAuthorized', 'childParticipationAuthorized', 'externalActionAuthorized']) {
    requireValue(release.authority?.[field] === false, `${field} must remain false.`);
}
requireValue(release.pitch?.approved === false && release.pitch?.sentAt === null && release.pitch?.followUpDueAt === null, 'Founder story pitch must remain unapproved and unsent.');
requireValue(release.pitch?.attachmentAllowed === false, 'First founder-story contact must remain attachment-free.');
requireValue((release.approvalChecklist || []).length === 6, 'Founder story must retain six approval checks.');
requireValue(/stop and ask Kevin/i.test(release.financialBoundary || ''), 'Paid or rights-bearing offers must stop for Kevin.');
requireValue(/Do not publish the child's name, image, voice, school, location, routine, private accounts, direct quotes or identifying details/i.test(release.privacyBoundary || ''), 'The child privacy boundary must remain complete.');

requireValue(release.verifiedStatements?.length === 6, 'Founder story must retain six verified statements.');
for (const item of release.verifiedStatements || []) {
    const claim = claimMap.get(item.claimRef);
    requireValue(Boolean(claim), `Founder story references unknown claim ${item.claimRef}.`);
    requireValue(['usable', 'qualified'].includes(claim?.status), `Founder story uses unavailable claim ${item.claimRef}.`);
}

const wordCount = article.trim().split(/\s+/).length;
requireValue(wordCount >= 750 && wordCount <= 1200, 'Founder story article must remain a focused 750-1200 words.');
requireValue(article.includes(release.article?.title || '__missing__'), 'Founder story title must match the release record.');
requireValue(article.includes('By Kevin Murphy, founder of Mythical Void'), 'Founder story must retain its named adult byline.');
requireValue(/nine-year-old son/i.test(article), 'Founder story must retain the truthful age-bounded origin.');
requireValue(/six damaged realms/i.test(article), 'Founder story must retain the six-realm game description.');
requireValue(/NASA does not endorse/i.test(article), 'Founder story must retain the NASA non-endorsement statement.');
requireValue(/will not share his name, school, routine, private accounts or identifying details/i.test(article), 'Founder story must state the child privacy boundary in public language.');

const publicText = `${release.pitch?.subject || ''}\n${release.pitch?.body || ''}\n${article}`;
requireValue(!/\bcompanions?\b/i.test(publicText), 'Founder story must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b/i.test(publicText), 'Founder story must not promise absolute uniqueness.');
requireValue(!/\bfully autonomous studio\b/i.test(publicText), 'Founder story must not describe a fully autonomous studio.');
requireValue(!/\bNASA (?:partner|partnership|approved|endorsed)\b/i.test(publicText), 'Founder story must not imply NASA approval or partnership.');

if (errors.length) {
    console.error(`Irish founder story validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Irish founder story valid: ${wordCount} words, 6 verified statements, pitch unsent, Kevin and child-privacy gates intact.`);

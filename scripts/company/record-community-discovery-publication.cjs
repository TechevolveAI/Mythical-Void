#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    RUN_PATH,
    loadFromRoot,
    validateCommunityRun
} = require('./validate-community-discovery-run.cjs');
const {
    APPROVAL_MAX_AGE_MS,
    CHECK_MAX_AGE_MS,
    DUPLICATE_URL,
    RULES_URL,
    preparedPostSha256,
    unexpectedEvidenceFields
} = require('./preflight-community-discovery.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MAX_RECEIPT_TO_POST_MS = 30 * 60 * 1000;

function validPostUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' &&
            ['reddit.com', 'www.reddit.com'].includes(url.hostname) &&
            /^\/r\/WebGames\/comments\/[A-Za-z0-9]+(?:\/[^/?#]+)?\/?$/.test(url.pathname) &&
            url.search === '' &&
            url.hash === '';
    } catch {
        return false;
    }
}

function publicationFailures({ run, receipt, postUrl, publishedAt, now }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const receiptTime = Date.parse(receipt?.checkedAt || '');
    const publicationTime = Date.parse(publishedAt || '');
    const nowTime = now.getTime();
    const expectedHash = preparedPostSha256(run.preparedPost);
    const actionEvidence = receipt?.actionEvidence;
    const approvalTime = Date.parse(actionEvidence?.exactPostApprovedAt || '');
    const rulesTime = Date.parse(actionEvidence?.rules?.checkedAt || '');
    const duplicateTime = Date.parse(actionEvidence?.duplicate?.checkedAt || '');
    const publicProbeTime = Date.parse(receipt?.publicProbes?.checkedAt || '');
    const freshAtReceipt = (time, maximumAge) => Number.isFinite(time) && Number.isFinite(receiptTime) && time <= receiptTime && receiptTime - time <= maximumAge;

    requireValue(run.publication?.posted === false, 'this community run is already recorded as posted');
    requireValue(validPostUrl(postUrl), 'use the clean public r/WebGames post URL');
    requireValue(Number.isFinite(publicationTime), 'published-at must be a valid ISO date and time');
    requireValue(Number.isFinite(receiptTime), 'the action-time receipt has no valid check time');
    requireValue(receipt?.receiptVersion === 1 && receipt?.workflow === run.id && receipt?.community === run.community, 'the receipt belongs to a different workflow');
    requireValue(receipt?.actionReady === true && receipt?.postingPerformed === false, 'the receipt did not pass every action-time gate');
    requireValue(Array.isArray(receipt?.failures) && receipt.failures.length === 0, 'the receipt contains failed checks');
    requireValue(Array.isArray(receipt?.missingHumanActions) && receipt.missingHumanActions.length === 0, 'the receipt still needs human action');
    requireValue(receipt?.expectedPostHash === expectedHash && preparedPostSha256(receipt?.preparedPost || {}) === expectedHash, 'the receipt is not tied to the exact prepared post');
    requireValue(receipt?.actionEvidence?.preparedPostSha256 === receipt?.expectedPostHash, 'the human approval is not tied to the exact prepared post');
    requireValue(unexpectedEvidenceFields(actionEvidence).length === 0 && actionEvidence?.schemaVersion === 1, 'the action evidence shape is invalid');
    requireValue(receipt?.actionEvidence?.existingAdultAccountConfirmed === true, 'an existing adult account was not confirmed');
    requireValue(receipt?.actionEvidence?.approvedBy === 'Kevin' && receipt?.actionEvidence?.adultReplyOwner === 'Kevin' && receipt?.actionEvidence?.replyCoverageConfirmed === true, 'Kevin approval and reply cover are incomplete');
    requireValue(freshAtReceipt(approvalTime, APPROVAL_MAX_AGE_MS), 'the exact post approval was not fresh at the action-time check');
    requireValue(actionEvidence?.rules?.sourceUrl === RULES_URL && actionEvidence?.rules?.allPreparedRulesStillPresent === true && freshAtReceipt(rulesTime, CHECK_MAX_AGE_MS), 'the current rules check is missing, changed or stale');
    requireValue(actionEvidence?.duplicate?.sourceUrl === DUPLICATE_URL && actionEvidence?.duplicate?.mythicalVoidPostObserved === false && freshAtReceipt(duplicateTime, CHECK_MAX_AGE_MS), 'the duplicate check is missing, positive or stale');
    requireValue(receipt?.publicChecksPassed === true && receipt?.publicProbes?.liveGameOk === true && receipt?.publicProbes?.previewMetadataOk === true && receipt?.publicProbes?.previewImageOk === true && receipt?.publicProbes?.liveGameStatus === 200 && receipt?.publicProbes?.previewImageStatus === 200 && Number.isFinite(publicProbeTime), 'the live game or public preview did not pass');
    requireValue(receipt?.openingJourneyPassed === true && receipt?.openingJourney?.passed === true, 'the fresh opening journey did not pass');
    requireValue(Number.isFinite(publicationTime) && publicationTime <= nowTime, 'published-at cannot be in the future');
    requireValue(Number.isFinite(receiptTime) && Number.isFinite(publicationTime) && publicationTime >= receiptTime, 'publication must happen after the action-time check');
    requireValue(Number.isFinite(receiptTime) && Number.isFinite(publicationTime) && publicationTime - receiptTime <= MAX_RECEIPT_TO_POST_MS, 'the action-time receipt is too old');
    return failures;
}

function buildPublishedRun({ run, plan, receipt, postUrl, publishedAt, now }) {
    const failures = publicationFailures({ run, receipt, postUrl, publishedAt, now });
    if (failures.length) return { failures, updatedRun: null };

    const updatedRun = JSON.parse(JSON.stringify(run));
    const publishedTime = Date.parse(publishedAt);
    updatedRun.state = 'seven_day_read_in_progress';
    Object.assign(updatedRun.approval, {
        existingAdultAccountConfirmed: true,
        exactPostApprovedAtActionTime: true,
        exactPostApprovedAt: receipt.actionEvidence.exactPostApprovedAt,
        approvedBy: 'Kevin',
        adultReplyOwner: 'Kevin',
        replyCoverageConfirmed: true
    });
    Object.assign(updatedRun.preflight, {
        rulesRecheckedAt: receipt.actionEvidence.rules.checkedAt,
        duplicateRecheckedAt: receipt.actionEvidence.duplicate.checkedAt,
        duplicateObserved: false,
        liveGameCheckedAt: receipt.publicProbes.checkedAt,
        liveGameHttpStatus: receipt.publicProbes.liveGameStatus,
        openingJourneyPassedAt: receipt.checkedAt,
        automaticLinkPreviewCheckedAt: receipt.publicProbes.checkedAt,
        automaticLinkPreviewHttpStatus: receipt.publicProbes.previewImageStatus,
        automaticLinkPreviewMatchesExpected: true
    });
    updatedRun.publication = {
        posted: true,
        postUrl,
        publishedAt: new Date(publishedTime).toISOString()
    };
    updatedRun.observations.day2.dueAt = new Date(publishedTime + 2 * 86400000).toISOString();
    updatedRun.observations.day7.dueAt = new Date(publishedTime + 7 * 86400000).toISOString();
    updatedRun.nextRequiredAction = 'Kevin answers replies himself. At the two-day and seven-day dates, record only public totals and anonymous aggregate website evidence; do not cross-post during this read.';

    failures.push(...validateCommunityRun({ run: updatedRun, plan }));
    return { failures, updatedRun: failures.length ? null : updatedRun };
}

function valueAfter(values, flag) {
    const index = values.indexOf(flag);
    return index === -1 ? null : values[index + 1] || null;
}

function main() {
    const values = process.argv.slice(2);
    const receiptPathValue = valueAfter(values, '--receipt');
    const postUrl = valueAfter(values, '--post-url');
    const publishedAt = valueAfter(values, '--published-at');
    const nowValue = valueAfter(values, '--at');
    const now = nowValue ? new Date(nowValue) : new Date();
    if (!values.includes('--confirm-posted')) throw new Error('use --confirm-posted only after the real public post is visible');
    if (!receiptPathValue) throw new Error('--receipt needs the private passing preflight receipt');
    if (!postUrl) throw new Error('--post-url needs the real public r/WebGames post URL');
    if (!publishedAt) throw new Error('--published-at needs the real publication date and time');
    if (!Number.isFinite(now.getTime())) throw new Error('--at needs a valid ISO date and time');

    const receipt = JSON.parse(fs.readFileSync(path.resolve(receiptPathValue), 'utf8'));
    const { run, plan } = loadFromRoot(ROOT);
    const outcome = buildPublishedRun({ run, plan, receipt, postUrl, publishedAt, now });
    if (outcome.failures.length) {
        console.error('The forum post was not recorded:\n');
        outcome.failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }

    const destination = path.join(ROOT, RUN_PATH);
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(outcome.updatedRun, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, destination);
    console.log(JSON.stringify({
        recorded: true,
        externalActionPerformedByThisCommand: false,
        postUrl: outcome.updatedRun.publication.postUrl,
        publishedAt: outcome.updatedRun.publication.publishedAt,
        day2DueAt: outcome.updatedRun.observations.day2.dueAt,
        day7DueAt: outcome.updatedRun.observations.day7.dueAt,
        next: outcome.updatedRun.nextRequiredAction
    }, null, 2));
}

if (require.main === module) {
    try { main(); } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { MAX_RECEIPT_TO_POST_MS, buildPublishedRun, publicationFailures, validPostUrl };

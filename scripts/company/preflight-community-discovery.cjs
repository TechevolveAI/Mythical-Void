#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
    loadFromRoot,
    validateCommunityRun
} = require('./validate-community-discovery-run.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LIVE_ORIGIN = 'https://mythicalvoid.com';
const EXPECTED_GAME_URL = `${LIVE_ORIGIN}/play/`;
const RULES_URL = 'https://www.reddit.com/r/WebGames/about/rules';
const DUPLICATE_URL = 'https://www.reddit.com/r/WebGames/search/?q=%22Mythical%20Void%22&restrict_sr=1&sort=new';
const EXPECTED_PREVIEW = `${LIVE_ORIGIN}/marketing/mythical-void-brand-link-card-v1.png`;
const APPROVAL_MAX_AGE_MS = 30 * 60 * 1000;
const CHECK_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const ACTION_EVIDENCE_SHAPE = {
    schemaVersion: null,
    preparedPostSha256: null,
    existingAdultAccountConfirmed: null,
    exactPostApprovedAt: null,
    approvedBy: null,
    adultReplyOwner: null,
    replyCoverageConfirmed: null,
    rules: {
        checkedAt: null,
        sourceUrl: null,
        allPreparedRulesStillPresent: null
    },
    duplicate: {
        checkedAt: null,
        sourceUrl: null,
        mythicalVoidPostObserved: null
    }
};

function preparedPostSha256(post) {
    return crypto.createHash('sha256').update(JSON.stringify({
        format: post.format,
        title: post.title,
        url: post.url,
        firstComment: post.firstComment
    })).digest('hex');
}

function parseMeta(html, attribute, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
    return html.match(expression)?.[1] || null;
}

function parseLink(html, rel) {
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`<link\\s+[^>]*rel=["']${escaped}["'][^>]*href=["']([^"']+)["'][^>]*>`, 'i');
    return html.match(expression)?.[1] || null;
}

function evaluateDirectPlayDocument(status, html) {
    const previewUrl = parseMeta(html, 'property', 'og:image');
    const previewAlt = parseMeta(html, 'property', 'og:image:alt');
    const openGraphUrl = parseMeta(html, 'property', 'og:url');
    const canonicalUrl = parseLink(html, 'canonical');
    const entryIdentity = parseMeta(html, 'name', 'mythical-entry');
    const liveGameOk = status === 200 &&
        html.includes("path === '/play'") &&
        /<script\s+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/.test(html) &&
        /<title>[^<]*Mythical Void[^<]*<\/title>/i.test(html);
    const previewMetadataOk = status === 200 &&
        entryIdentity === 'direct-play' &&
        canonicalUrl === EXPECTED_GAME_URL &&
        openGraphUrl === EXPECTED_GAME_URL &&
        previewUrl === EXPECTED_PREVIEW &&
        /brand art.+not gameplay/i.test(previewAlt || '');

    return {
        liveGameOk,
        previewMetadataOk,
        previewUrl,
        previewAlt,
        openGraphUrl,
        canonicalUrl,
        entryIdentity
    };
}

function freshnessFailure(value, nowMs, maximumAgeMs, label) {
    const checkedAt = Date.parse(value || '');
    if (!Number.isFinite(checkedAt)) return `${label} is missing or invalid`;
    if (checkedAt > nowMs) return `${label} is in the future`;
    if (nowMs - checkedAt > maximumAgeMs) return `${label} is stale`;
    return null;
}

function unexpectedEvidenceFields(value, shape = ACTION_EVIDENCE_SHAPE, prefix = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : ['actionEvidence'];
    const unexpected = [];
    for (const key of Object.keys(value)) {
        const field = prefix ? `${prefix}.${key}` : key;
        if (!Object.prototype.hasOwnProperty.call(shape, key)) {
            unexpected.push(field);
        } else if (shape[key] && typeof shape[key] === 'object') {
            unexpected.push(...unexpectedEvidenceFields(value[key], shape[key], field));
        }
    }
    return unexpected;
}

function evaluatePreflight({ run, plan, actionEvidence, probes, openingJourneyPassed, now }) {
    const failures = validateCommunityRun({ run, plan });
    const missingHumanActions = [];
    const nowMs = now.getTime();
    const expectedPostHash = preparedPostSha256(run.preparedPost || {});

    if (run.publication?.posted !== false) failures.push('the first community run is already published');
    if (run.preparedPost?.url !== EXPECTED_GAME_URL) failures.push('the prepared post lost the clean game link');
    if (!probes.liveGameOk) failures.push('the live game doorway failed');
    if (!probes.previewMetadataOk) failures.push('the automatic preview metadata failed');
    if (!probes.previewImageOk) failures.push('the automatic preview image failed');

    if (!actionEvidence) {
        missingHumanActions.push(
            'confirm an existing adult Reddit account',
            'approve the exact prepared post',
            'confirm Kevin can answer replies',
            'read the current r/WebGames rules in a normal browser',
            'check r/WebGames for an existing Mythical Void post'
        );
    } else {
        const unexpectedFields = unexpectedEvidenceFields(actionEvidence);
        if (unexpectedFields.length) failures.push(`action-time evidence has unexpected fields: ${unexpectedFields.join(', ')}`);
        if (actionEvidence.schemaVersion !== 1) failures.push('action-time evidence schema is invalid');
        if (actionEvidence.preparedPostSha256 !== expectedPostHash) failures.push('approval is not tied to the exact prepared post');
        if (actionEvidence.existingAdultAccountConfirmed !== true) missingHumanActions.push('confirm an existing adult Reddit account');
        if (actionEvidence.approvedBy !== 'Kevin') missingHumanActions.push('Kevin must approve the exact prepared post');
        if (actionEvidence.adultReplyOwner !== 'Kevin' || actionEvidence.replyCoverageConfirmed !== true) missingHumanActions.push('confirm Kevin can answer replies');

        const approvalFreshness = freshnessFailure(
            actionEvidence.exactPostApprovedAt,
            nowMs,
            APPROVAL_MAX_AGE_MS,
            'exact post approval'
        );
        if (approvalFreshness) failures.push(approvalFreshness);

        if (actionEvidence.rules?.sourceUrl !== RULES_URL) failures.push('rules evidence uses the wrong source');
        if (actionEvidence.rules?.allPreparedRulesStillPresent !== true) failures.push('current rules were not confirmed');
        const rulesFreshness = freshnessFailure(
            actionEvidence.rules?.checkedAt,
            nowMs,
            CHECK_MAX_AGE_MS,
            'rules check'
        );
        if (rulesFreshness) failures.push(rulesFreshness);

        if (actionEvidence.duplicate?.sourceUrl !== DUPLICATE_URL) failures.push('duplicate evidence uses the wrong source');
        if (actionEvidence.duplicate?.mythicalVoidPostObserved !== false) failures.push('duplicate check did not confirm a clear first post');
        const duplicateFreshness = freshnessFailure(
            actionEvidence.duplicate?.checkedAt,
            nowMs,
            CHECK_MAX_AGE_MS,
            'duplicate check'
        );
        if (duplicateFreshness) failures.push(duplicateFreshness);

        if (openingJourneyPassed !== true) failures.push('fresh opening journey did not pass');
    }

    return {
        safePlanValid: validateCommunityRun({ run, plan }).length === 0,
        publicChecksPassed: probes.liveGameOk && probes.previewMetadataOk && probes.previewImageOk,
        openingJourneyPassed: actionEvidence ? openingJourneyPassed === true : null,
        expectedPostHash,
        actionReady: Boolean(actionEvidence) && failures.length === 0 && missingHumanActions.length === 0,
        postingPerformed: false,
        failures,
        missingHumanActions
    };
}

async function probePublicState(fetchImpl = fetch) {
    const playResponse = await fetchImpl(EXPECTED_GAME_URL, {
        method: 'GET',
        redirect: 'follow',
        headers: { Accept: 'text/html' }
    });
    const playHtml = await playResponse.text();
    const directPlay = evaluateDirectPlayDocument(playResponse.status, playHtml);

    const previewResponse = await fetchImpl(EXPECTED_PREVIEW, {
        method: 'GET',
        redirect: 'follow',
        headers: { Accept: 'image/png' }
    });
    const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
    const previewImageOk = previewResponse.status === 200 &&
        /^image\/png(?:;|$)/i.test(previewResponse.headers.get('content-type') || '') &&
        previewBytes.length > 10_000;

    let redditRulesPubliclyReachable = false;
    let redditRulesProbeStatus = null;
    try {
        const rulesResponse = await fetchImpl(`${RULES_URL}.json`, {
            method: 'GET',
            redirect: 'manual',
            headers: { 'User-Agent': 'MythicalVoidStudio/1.0 community-preflight' }
        });
        redditRulesProbeStatus = rulesResponse.status;
        redditRulesPubliclyReachable = rulesResponse.status === 200 &&
            /^application\/json/i.test(rulesResponse.headers.get('content-type') || '');
    } catch {
        redditRulesProbeStatus = null;
    }

    return {
        checkedAt: new Date().toISOString(),
        liveGameStatus: playResponse.status,
        liveGameOk: directPlay.liveGameOk,
        previewMetadataStatus: playResponse.status,
        previewMetadataOk: directPlay.previewMetadataOk,
        previewUrl: directPlay.previewUrl,
        previewAlt: directPlay.previewAlt,
        openGraphUrl: directPlay.openGraphUrl,
        canonicalUrl: directPlay.canonicalUrl,
        entryIdentity: directPlay.entryIdentity,
        previewImageStatus: previewResponse.status,
        previewImageBytes: previewBytes.length,
        previewImageOk,
        redditRulesPubliclyReachable,
        redditRulesProbeStatus,
        redditRulesNote: redditRulesPubliclyReachable
            ? 'The public machine-readable rules endpoint responded; an adult must still read the rules at action time.'
            : 'Reddit did not expose the machine-readable rules to this runner; an adult browser check remains required.'
    };
}

function runOpeningJourney() {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'smoke-secondary-journeys.js')], {
            cwd: ROOT,
            env: {
                ...process.env,
                MYTHICAL_VOID_SMOKE_URL: LIVE_ORIGIN,
                SMOKE_MODE: 'first-sanctuary',
                SMOKE_CASE: 'all',
                SMOKE_VIEWPORT_WIDTH: '390',
                SMOKE_VIEWPORT_HEIGHT: '844'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk.toString(); });
        child.stderr.on('data', chunk => { output += chunk.toString(); });
        child.once('error', error => resolve({ passed: false, detail: error.message }));
        child.once('exit', code => resolve({
            passed: code === 0 && output.includes('[smoke-result] first-sanctuary:all:pass'),
            detail: code === 0 ? 'fresh phone opening journey completed' : `opening journey exited ${code}`
        }));
    });
}

function parseArguments(values) {
    const actionIndex = values.indexOf('--action-time');
    const atIndex = values.indexOf('--at');
    const receiptIndex = values.indexOf('--write-receipt');
    const actionPath = actionIndex === -1 ? null : path.resolve(values[actionIndex + 1] || '');
    const receiptPath = receiptIndex === -1 ? null : path.resolve(values[receiptIndex + 1] || '');
    const now = atIndex === -1 ? new Date() : new Date(values[atIndex + 1]);
    if (actionIndex !== -1 && !values[actionIndex + 1]) throw new Error('--action-time needs a private evidence file');
    if (receiptIndex !== -1 && !values[receiptIndex + 1]) throw new Error('--write-receipt needs a private output file');
    if (receiptPath && !actionPath) throw new Error('--write-receipt is only available with --action-time');
    if (receiptPath) {
        const relative = path.relative(ROOT, receiptPath);
        if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
            throw new Error('the action-time receipt must stay outside the repository');
        }
    }
    if (!Number.isFinite(now.getTime())) throw new Error('--at needs a valid ISO date and time');
    return { actionPath, receiptPath, now };
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const { run, plan } = loadFromRoot(ROOT);
    const actionEvidence = options.actionPath
        ? JSON.parse(fs.readFileSync(options.actionPath, 'utf8'))
        : null;
    const probes = await probePublicState();
    const opening = actionEvidence
        ? await runOpeningJourney()
        : { passed: null, detail: 'held until action-time evidence is supplied' };
    const result = evaluatePreflight({
        run,
        plan,
        actionEvidence,
        probes,
        openingJourneyPassed: opening.passed,
        now: options.now
    });

    const output = {
        receiptVersion: 1,
        workflow: 'WEBGAMES-FIRST-RUN-001',
        checkedAt: options.now.toISOString(),
        community: run.community,
        preparedPost: run.preparedPost,
        actionEvidence: actionEvidence ? JSON.parse(JSON.stringify(actionEvidence)) : null,
        publicProbes: probes,
        openingJourney: opening,
        ...result,
        receiptWritten: options.receiptPath && result.actionReady ? options.receiptPath : null,
        next: result.actionReady
            ? 'Every preflight gate passes. A person may publish the exact prepared post from the confirmed adult account; this command did not post it.'
            : 'Keep publication held and complete only the listed human actions or failed checks.'
    };

    if (options.receiptPath && result.actionReady) {
        fs.writeFileSync(options.receiptPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    console.log(JSON.stringify(output, null, 2));

    if (result.failures.length || (options.receiptPath && !result.actionReady)) process.exitCode = 1;
    else process.exitCode = 0;
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.stack || error.message);
        process.exit(1);
    });
}

module.exports = {
    APPROVAL_MAX_AGE_MS,
    CHECK_MAX_AGE_MS,
    DUPLICATE_URL,
    EXPECTED_GAME_URL,
    EXPECTED_PREVIEW,
    RULES_URL,
    evaluateDirectPlayDocument,
    evaluatePreflight,
    freshnessFailure,
    parseArguments,
    parseLink,
    parseMeta,
    preparedPostSha256,
    probePublicState,
    unexpectedEvidenceFields
};

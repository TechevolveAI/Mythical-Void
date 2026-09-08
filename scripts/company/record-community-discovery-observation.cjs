#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    RUN_PATH,
    loadFromRoot,
    validateCommunityRun
} = require('./validate-community-discovery-run.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const PERIODS = ['day2', 'day7'];
const METRIC_FLAGS = {
    platformViews: '--platform-views',
    publicCommentCount: '--public-comments',
    consentedSocialOrCreatorArrivals: '--social-or-creator-arrivals',
    anonymousAdultForumFeedbackCount: '--adult-forum-feedback'
};

function valueAfter(values, flag) {
    const index = values.indexOf(flag);
    return index === -1 ? null : values[index + 1] ?? null;
}

function parseMetric(value, label) {
    if (value === 'unavailable') return null;
    if (!/^\d+$/.test(value || '')) throw new Error(`${label} must be a non-negative whole number or unavailable`);
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error(`${label} is outside the safe whole-number range`);
    return number;
}

function observationFailures({ run, period, postUrl, observedAt, metrics, now }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const observation = run.observations?.[period];
    const observedTime = Date.parse(observedAt || '');
    const dueTime = Date.parse(observation?.dueAt || '');
    const nowTime = now.getTime();

    requireValue(PERIODS.includes(period), 'period must be day2 or day7');
    requireValue(run.publication?.posted === true, 'the community post has not been recorded as published');
    requireValue(postUrl === run.publication?.postUrl, 'use the exact public post URL already recorded for this run');
    requireValue(Boolean(observation), 'the requested observation period is missing');
    requireValue(observation?.checkedAt === null, `${period || 'observation'} has already been recorded`);
    requireValue(Number.isFinite(dueTime), `${period || 'observation'} has no valid due time`);
    requireValue(Number.isFinite(observedTime), 'observed-at must be a valid ISO date and time');
    requireValue(Number.isFinite(observedTime) && Number.isFinite(dueTime) && observedTime >= dueTime, `${period || 'observation'} cannot be recorded before it is due`);
    requireValue(Number.isFinite(observedTime) && observedTime <= nowTime, 'observed-at cannot be in the future');
    if (period === 'day7') requireValue(Boolean(run.observations?.day2?.checkedAt), 'record the two-day observation before the seven-day observation');

    const metricKeys = Object.keys(metrics || {});
    requireValue(metricKeys.length === Object.keys(METRIC_FLAGS).length && Object.keys(METRIC_FLAGS).every(key => metricKeys.includes(key)), 'every aggregate metric must be supplied once');
    for (const [key, value] of Object.entries(metrics || {})) {
        requireValue(Object.hasOwn(METRIC_FLAGS, key), `unexpected metric ${key}`);
        requireValue(value === null || (Number.isSafeInteger(value) && value >= 0), `${key} must be a non-negative whole number or unavailable`);
    }
    return failures;
}

function buildObservedRun({ run, plan, period, postUrl, observedAt, metrics, now }) {
    const failures = observationFailures({ run, period, postUrl, observedAt, metrics, now });
    if (failures.length) return { failures, updatedRun: null };

    const updatedRun = JSON.parse(JSON.stringify(run));
    const observation = updatedRun.observations[period];
    observation.checkedAt = new Date(Date.parse(observedAt)).toISOString();
    observation.unavailable = [];
    for (const key of Object.keys(METRIC_FLAGS)) {
        observation[key] = metrics[key];
        if (metrics[key] === null) observation.unavailable.push(key);
    }

    if (period === 'day2') {
        updatedRun.state = 'seven_day_read_in_progress';
        updatedRun.nextRequiredAction = 'Kevin answers replies himself. Wait for the seven-day date, then record the final public and anonymous aggregate evidence before choosing another community route.';
    } else {
        updatedRun.state = 'seven_day_read_complete_waiting_for_kevin_next_route_decision';
        updatedRun.nextRequiredAction = 'Review the two-day and seven-day evidence without calling views or visits players. Kevin may then stop, improve the opening or separately approve the held Phaser Showcase route.';
    }

    failures.push(...validateCommunityRun({ run: updatedRun, plan }));
    return { failures, updatedRun: failures.length ? null : updatedRun };
}

function parseArguments(values) {
    const allowedFlags = new Set([
        '--confirm-observed', '--period', '--post-url', '--observed-at',
        ...Object.values(METRIC_FLAGS)
    ]);
    const seen = new Set();
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (!allowedFlags.has(value)) throw new Error(`unexpected option: ${value}`);
        if (seen.has(value)) throw new Error(`duplicate option: ${value}`);
        seen.add(value);
        if (value !== '--confirm-observed') {
            if (values[index + 1] === undefined || values[index + 1].startsWith('--')) throw new Error(`${value} needs a value`);
            index += 1;
        }
    }
    if (!values.includes('--confirm-observed')) throw new Error('use --confirm-observed only after an adult has read the public totals and approved aggregate sources');
    const period = valueAfter(values, '--period');
    const postUrl = valueAfter(values, '--post-url');
    const observedAt = valueAfter(values, '--observed-at');
    if (!PERIODS.includes(period)) throw new Error('--period must be day2 or day7');
    if (!postUrl) throw new Error('--post-url needs the exact recorded public post URL');
    if (!observedAt) throw new Error('--observed-at needs the real observation date and time');
    const metrics = {};
    for (const [key, flag] of Object.entries(METRIC_FLAGS)) metrics[key] = parseMetric(valueAfter(values, flag), flag);
    return { period, postUrl, observedAt, metrics };
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const { run, plan } = loadFromRoot(ROOT);
    const outcome = buildObservedRun({ ...options, run, plan, now: new Date() });
    if (outcome.failures.length) {
        console.error('The community observation was not recorded:\n');
        outcome.failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }

    const destination = path.join(ROOT, RUN_PATH);
    const temporary = `${destination}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(outcome.updatedRun, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, destination);
    console.log(JSON.stringify({
        recorded: true,
        period: options.period,
        checkedAt: outcome.updatedRun.observations[options.period].checkedAt,
        unavailable: outcome.updatedRun.observations[options.period].unavailable,
        externalActionPerformedByThisCommand: false,
        next: outcome.updatedRun.nextRequiredAction
    }, null, 2));
}

if (require.main === module) {
    try { main(); } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = {
    METRIC_FLAGS,
    PERIODS,
    buildObservedRun,
    observationFailures,
    parseArguments,
    parseMetric
};

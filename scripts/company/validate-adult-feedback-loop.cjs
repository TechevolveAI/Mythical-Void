#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const page = read('public/feedback/index.html');
const client = read('public/adult-feedback.js');
const core = read('netlify/lib/adult-feedback-core.cjs');
const wrapper = read('netlify/functions/adult-feedback.mjs');
const migration = read('supabase/migrations/20260827000100_create_adult_feedback_pulses.sql');
const storefront = read('src/site/storefront.js');
const legal = JSON.parse(read('src/config/legal.json'));
const netlify = read('netlify.toml');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(page.includes('FOR ADULTS · ABOUT ONE MINUTE'), 'adult-only page heading is missing');
requireValue(page.includes('I confirm that I am 18 or older.'), 'adult confirmation is missing');
requireValue(page.includes('no written-answer boxes') && page.includes('We do not ask for a name, email address, creature name or contact details.'), 'plain-language data boundary is missing');
requireValue(!/<textarea|type="(?:email|text|file|date)"|contenteditable/i.test(page), 'page contains a free-text, upload, email or age field');
for (const field of ['audienceRole', 'journey', 'overall', 'bestPart', 'nextImprovement', 'recommendation']) {
    requireValue(page.includes(`name="${field}"`), `form field is missing: ${field}`);
}
requireValue(client.includes("fetch('/api/adult-feedback'"), 'feedback endpoint is not connected');
requireValue(client.includes("result?.accepted !== true"), 'feedback client does not verify server acceptance');
requireValue(!/localStorage|sessionStorage|document\.cookie|dataLayer|gtag\(/.test(client), 'feedback client stores or tracks the respondent');
requireValue(core.includes(".from('adult_feedback_pulses').insert(row)"), 'fixed feedback storage write is missing');
requireValue(core.includes('value.adultConfirmed !== true'), 'server does not enforce adult confirmation');
requireValue(core.includes('keys.length !== EXPECTED_KEYS.size'), 'server does not reject extra fields');
requireValue(wrapper.includes('windowLimit: 3') && wrapper.includes('windowSize: 3600'), 'server rate limit is missing');
requireValue(migration.includes('force row level security') && migration.includes('revoke all on table public.adult_feedback_pulses from anon, authenticated'), 'database browser access is not closed');
requireValue(migration.includes("interval '180 days'"), 'feedback retention limit is missing');
for (const blocked of ['name, email', 'user ID', 'session ID', 'IP address', 'creature name', 'free text', 'exact age', 'device detail', 'location']) {
    requireValue(migration.includes(blocked), `database privacy comment is missing: ${blocked}`);
}
requireValue(storefront.includes('href="/feedback/"'), 'homepage does not open adult feedback');
requireValue(!storefront.includes('Our feedback channel is being prepared now'), 'homepage still says feedback is unavailable');
requireValue(netlify.includes('from = "/feedback"') && netlify.includes('from = "/feedback/"'), 'feedback redirects are missing');

const privacyText = JSON.stringify(legal.privacyPolicy);
requireValue(legal.privacyPolicy?.lastUpdated === '2026-08-27', 'privacy policy date is stale');
requireValue(/adult feedback pulse/i.test(privacyText), 'privacy policy does not describe adult feedback');
requireValue(/fixed-choice/i.test(privacyText) && /180 days/i.test(privacyText), 'privacy policy is missing feedback fields or retention');
requireValue(/does not ask for a name, email address, free-text answer, exact age or child details/i.test(privacyText), 'privacy policy does not state the feedback exclusion boundary');

if (failures.length) {
    console.error('Adult feedback loop is not safe or complete:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    route: 'https://mythicalvoid.com/feedback/',
    audience: 'adults_only',
    freeTextCollected: false,
    directIdentifiersCollected: false,
    retentionDays: 180,
    externalMessagingEnabled: false
}, null, 2));

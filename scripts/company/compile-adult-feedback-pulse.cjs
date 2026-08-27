#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const SUPABASE_PROJECT_URL = 'https://mkcmdbzcihjgidjuypqe.supabase.co';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECORDS = 5000;
const ALLOWED_KEYS = new Set([
    'received_at',
    'audience_role',
    'journey',
    'overall',
    'best_part',
    'next_improvement',
    'recommendation',
    'release_id'
]);
const CHOICES = Object.freeze({
    audience_role: ['adult_player', 'parent_guardian', 'educator', 'other_adult'],
    journey: ['not_started', 'started', 'hatched', 'explored', 'restored'],
    overall: ['loved_it', 'promising', 'confusing', 'could_not_start'],
    best_part: ['creature', 'world_story', 'exploration_action', 'building_choices', 'nasa_stem', 'not_sure'],
    next_improvement: ['creature_visibility', 'instructions', 'controls', 'phone_layout', 'performance', 'story_clarity', 'more_content', 'nothing_yet'],
    recommendation: ['yes', 'maybe', 'no']
});
const LABELS = Object.freeze({
    audience_role: {
        adult_player: 'Adult player', parent_guardian: 'Parent or guardian', educator: 'Educator', other_adult: 'Other adult'
    },
    journey: {
        not_started: 'Did not start', started: 'Started', hatched: 'Reached the hatch', explored: 'Explored a realm', restored: 'Restored a guardian'
    },
    overall: {
        loved_it: 'Loved it', promising: 'Promising', confusing: 'Confusing', could_not_start: 'Could not start'
    },
    best_part: {
        creature: 'The creature', world_story: 'The worlds and story', exploration_action: 'Exploration and action', building_choices: 'Building and choices', nasa_stem: 'NASA and STEM', not_sure: 'Not sure yet'
    },
    next_improvement: {
        creature_visibility: 'Make the creature easier to see', instructions: 'Make the next step clearer', controls: 'Improve the controls', phone_layout: 'Improve the phone layout', performance: 'Improve loading or performance', story_clarity: 'Make the story clearer', more_content: 'Add more to discover', nothing_yet: 'Nothing obvious yet'
    },
    recommendation: { yes: 'Yes', maybe: 'Maybe', no: 'No' }
});
const SENSITIVE_KEY = /(?:^|_)(?:id|name|email|phone|address|age|birth|ip|user|session|device|location|message|comment|story|text|creature_name)(?:_|$)/i;

function fail(message) {
    throw new Error(message);
}

function isoDate(value, label) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
        fail(`${label} must be YYYY-MM-DD`);
    }
    return text;
}

function addDays(date, amount) {
    return new Date(Date.parse(`${date}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

function defaultPeriod(now = new Date()) {
    const to = now.toISOString().slice(0, 10);
    return { from: addDays(to, -6), to };
}

function validatePeriod(input = {}) {
    const defaults = defaultPeriod(input.now);
    const from = isoDate(input.from || defaults.from, 'from');
    const to = isoDate(input.to || defaults.to, 'to');
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
    if (days < 1 || days > 7) fail('feedback pulse must cover between one and seven days');
    return { from, to, days };
}

function readVisualGate() {
    const gatePath = path.join(repositoryRoot, 'docs', 'company', 'content', 'visual-launch-moments.json');
    if (!fs.existsSync(gatePath)) return { approved: 0, required: 4, ready: false };
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    const moments = Array.isArray(gate.requiredMoments) ? gate.requiredMoments : (Array.isArray(gate.moments) ? gate.moments : []);
    const approved = moments.filter(moment => moment.currentState === 'approved' || moment.status === 'approved' || moment.approved === true).length;
    const required = Number(gate.approvalRule?.requiredApprovedMoments || moments.length || 4);
    return { approved, required, ready: approved >= required };
}

function validateRecord(record, index) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`record ${index + 1} is not an object`);
    const keys = Object.keys(record);
    const unexpected = keys.filter(key => !ALLOWED_KEYS.has(key));
    const sensitive = unexpected.filter(key => SENSITIVE_KEY.test(key));
    if (sensitive.length) fail(`record ${index + 1} contains fields this brief must never receive: ${sensitive.join(', ')}`);
    if (unexpected.length) fail(`record ${index + 1} contains unsupported fields: ${unexpected.join(', ')}`);
    if (keys.length !== ALLOWED_KEYS.size) fail(`record ${index + 1} does not contain the exact fixed-choice fields`);

    const receivedAt = new Date(record.received_at);
    if (Number.isNaN(receivedAt.getTime())) fail(`record ${index + 1} has an invalid received_at value`);
    for (const [field, choices] of Object.entries(CHOICES)) {
        if (!choices.includes(record[field])) fail(`record ${index + 1} has an invalid ${field} choice`);
    }
    if (typeof record.release_id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(record.release_id)) {
        fail(`record ${index + 1} has an invalid release_id`);
    }
    return { ...record, receivedAt };
}

function blankCounts(field) {
    return Object.fromEntries(CHOICES[field].map(choice => [choice, 0]));
}

function percent(value, total) {
    return total ? Math.round((value / total) * 1000) / 10 : null;
}

function evidenceStrength(total) {
    if (total === 0) return 'none';
    if (total < 5) return 'very_early';
    if (total < 15) return 'directional';
    if (total < 30) return 'useful_signal';
    return 'stronger_direction_not_a_population_claim';
}

function chooseDecision(summary) {
    const total = summary.totalResponses;
    if (!total) {
        return {
            action: 'Do not change the game from absent evidence. Run the approved First Five check before widening invitations.',
            reason: 'No adult feedback responses exist in this period.',
            expandInvitations: false
        };
    }

    const friction = summary.counts.overall.confusing + summary.counts.overall.could_not_start;
    const earlyStop = summary.counts.journey.not_started + summary.counts.journey.started;
    const improvementEntries = Object.entries(summary.counts.next_improvement)
        .filter(([choice]) => choice !== 'nothing_yet')
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const [leadingImprovement, leadingCount] = improvementEntries[0] || ['nothing_yet', 0];
    const positive = summary.counts.overall.loved_it + summary.counts.overall.promising;
    const recommendable = summary.counts.recommendation.yes + summary.counts.recommendation.maybe;

    let action = 'Keep the current promise stable and collect more adult responses before making a broad product or marketing change.';
    let reason = 'The response count or pattern is not yet strong enough for a single confident change.';

    if (friction >= 2 && friction / total >= 0.4) {
        action = 'Pause wider invitations and repair the first-play experience before sending more people to the game.';
        reason = `${friction} of ${total} responses describe the experience as confusing or unable to start.`;
    } else if (earlyStop >= 3 && earlyStop / total >= 0.5) {
        action = 'Improve the route from Start to the first hatch before increasing awareness work.';
        reason = `${earlyStop} of ${total} responses did not get beyond starting the game.`;
    } else if (leadingCount >= 2 && leadingCount / total >= 0.35) {
        action = `Investigate one focused improvement: ${LABELS.next_improvement[leadingImprovement].toLowerCase()}.`;
        reason = `${leadingCount} of ${total} responses selected the same next improvement.`;
    } else if (total >= 8 && positive / total >= 0.6 && recommendable / total >= 0.6) {
        action = 'The response pattern supports the next invitation batch, provided the First Five and visual gates are also open.';
        reason = 'Most responses are positive and at least maybe willing to recommend, with enough responses for a directional signal.';
    }

    if (!summary.visualGate.ready) {
        return {
            action: `${action} Keep external visual promotion closed until all four real gameplay moments pass human review.`,
            reason,
            expandInvitations: false
        };
    }
    return { action, reason, expandInvitations: /supports the next invitation batch/.test(action) };
}

function compileAdultFeedbackPulse(records, options = {}) {
    if (!Array.isArray(records)) fail('feedback input must be a JSON array or an object with a records array');
    if (records.length > MAX_RECORDS) fail(`feedback input exceeds the ${MAX_RECORDS}-record safety limit`);
    const period = validatePeriod(options);
    const start = Date.parse(`${period.from}T00:00:00Z`);
    const endExclusive = Date.parse(`${addDays(period.to, 1)}T00:00:00Z`);
    const accepted = [];
    let outsidePeriod = 0;

    records.map(validateRecord).forEach(record => {
        if (record.receivedAt.getTime() < start || record.receivedAt.getTime() >= endExclusive) outsidePeriod += 1;
        else accepted.push(record);
    });

    const counts = Object.fromEntries(Object.keys(CHOICES).map(field => [field, blankCounts(field)]));
    const releases = {};
    accepted.forEach(record => {
        Object.keys(CHOICES).forEach(field => { counts[field][record[field]] += 1; });
        releases[record.release_id] = (releases[record.release_id] || 0) + 1;
    });

    const totalResponses = accepted.length;
    const summary = {
        schemaVersion: 1,
        reportingLanguage: 'anonymous_fixed_choice_responses_not_unique_people',
        period,
        totalResponses,
        evidenceStrength: evidenceStrength(totalResponses),
        recordsOutsidePeriod: outsidePeriod,
        counts,
        percentages: Object.fromEntries(Object.entries(counts).map(([field, values]) => [
            field,
            Object.fromEntries(Object.entries(values).map(([choice, count]) => [choice, percent(count, totalResponses)]))
        ])),
        releases,
        visualGate: options.visualGate || readVisualGate(),
        privacy: {
            individualRowsPrinted: false,
            namesOrEmailsAccepted: false,
            freeTextAccepted: false,
            childDetailsAccepted: false,
            maximumRetentionDays: 180
        }
    };
    summary.decision = chooseDecision(summary);
    return summary;
}

function formatPercent(value) {
    return value === null ? '—' : `${value.toFixed(1)}%`;
}

function labelCell(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderDistribution(lines, pulse, field, heading) {
    lines.push(`### ${heading}`, '', '| Choice | Responses | Share of responses |', '| --- | ---: | ---: |');
    CHOICES[field].forEach(choice => {
        lines.push(`| ${labelCell(LABELS[field][choice])} | ${pulse.counts[field][choice]} | ${formatPercent(pulse.percentages[field][choice])} |`);
    });
    lines.push('');
}

function renderMarkdown(pulse) {
    const lines = [
        `# Adult Feedback Pulse — ${pulse.period.to}`,
        '',
        `**Period:** ${pulse.period.from} to ${pulse.period.to}  `,
        '**Counting language:** anonymous fixed-choice responses, not unique people',
        '',
        '## The answer first',
        '',
        pulse.decision.action,
        '',
        `**Why:** ${pulse.decision.reason}`,
        '',
        '## Evidence strength',
        '',
        `- Responses in this period: **${pulse.totalResponses}**`,
        `- Evidence label: **${pulse.evidenceStrength}**`,
        `- Outside-period records ignored: **${pulse.recordsOutsidePeriod}**`,
        `- Authentic visual gate: **${pulse.visualGate.approved}/${pulse.visualGate.required} approved**`,
        ''
    ];
    renderDistribution(lines, pulse, 'journey', 'How far responses say they reached');
    renderDistribution(lines, pulse, 'overall', 'Overall feeling');
    renderDistribution(lines, pulse, 'best_part', 'Strongest part');
    renderDistribution(lines, pulse, 'next_improvement', 'What needs attention next');
    renderDistribution(lines, pulse, 'recommendation', 'Would they recommend it?');
    lines.push(
        '## Boundaries',
        '',
        '- This report never prints an individual feedback row.',
        '- It accepts no name, email address, written answer, child detail, device, location, user ID or session ID.',
        '- A response is not proof of a unique person, and this is not a population survey.',
        '- It cannot publish, message anyone, spend money or widen invitations.',
        '- Fixed-choice feedback is kept for no more than 180 days.',
        ''
    );
    return lines.join('\n');
}

function parseArguments(argv) {
    const result = { live: false, supabaseCli: false, input: null, output: null, jsonOutput: null, from: null, to: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--live') result.live = true;
        else if (argument === '--supabase-cli') result.supabaseCli = true;
        else if (argument === '--output') result.output = argv[++index];
        else if (argument === '--json-output') result.jsonOutput = argv[++index];
        else if (argument === '--from') result.from = argv[++index];
        else if (argument === '--to') result.to = argv[++index];
        else if (!result.input) result.input = argument;
        else fail(`unexpected argument: ${argument}`);
    }
    if (result.live === Boolean(result.input)) fail('choose exactly one source: --live or a local JSON file');
    if (result.supabaseCli && !result.live) fail('--supabase-cli may be used only with --live');
    return result;
}

function readSupabaseCliSecret() {
    try {
        const output = execFileSync('npx', [
            'supabase', 'projects', 'api-keys', '--project-ref', 'mkcmdbzcihjgidjuypqe', '--output', 'json'
        ], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024
        });
        const keys = JSON.parse(output);
        const valueOf = key => key?.api_key || key?.key || key?.value || '';
        const legacyServiceRole = keys.find(key => (key?.name || key?.type) === 'service_role');
        const modernSecret = keys.find(key => valueOf(key).startsWith('sb_secret_'));
        return valueOf(legacyServiceRole) || valueOf(modernSecret);
    } catch (error) {
        return '';
    }
}

async function readLive(period, useSupabaseCli = false) {
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || (useSupabaseCli ? readSupabaseCliSecret() : '');
    if (!serviceKey) fail('live feedback read requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
    const client = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_PROJECT_URL, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const endExclusive = `${addDays(period.to, 1)}T00:00:00Z`;
    const { data, error } = await client
        .from('adult_feedback_pulses')
        .select('received_at,audience_role,journey,overall,best_part,next_improvement,recommendation,release_id')
        .gte('received_at', `${period.from}T00:00:00Z`)
        .lt('received_at', endExclusive)
        .limit(MAX_RECORDS);
    if (error) fail(`live feedback read failed: ${error.code || 'storage_error'}`);
    return data || [];
}

function readLocal(file) {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.records;
}

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const period = validatePeriod(options);
        const records = options.live ? await readLive(period, options.supabaseCli) : readLocal(options.input);
        const pulse = compileAdultFeedbackPulse(records, period);
        const markdown = renderMarkdown(pulse);
        if (options.output) fs.writeFileSync(path.resolve(options.output), `${markdown}\n`);
        else process.stdout.write(`${markdown}\n`);
        if (options.jsonOutput) fs.writeFileSync(path.resolve(options.jsonOutput), `${JSON.stringify(pulse, null, 2)}\n`);
    } catch (error) {
        console.error(`Adult feedback pulse failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) main();

module.exports = {
    CHOICES,
    compileAdultFeedbackPulse,
    parseArguments,
    renderMarkdown,
    validatePeriod
};

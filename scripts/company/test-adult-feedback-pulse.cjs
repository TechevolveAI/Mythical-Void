#!/usr/bin/env node

const assert = require('assert');
const { compileAdultFeedbackPulse, renderMarkdown, validatePeriod } = require('./compile-adult-feedback-pulse.cjs');

function record(overrides = {}) {
    return {
        received_at: '2026-08-27T10:00:00Z',
        audience_role: 'adult_player',
        journey: 'hatched',
        overall: 'promising',
        best_part: 'creature',
        next_improvement: 'nothing_yet',
        recommendation: 'yes',
        release_id: 'release_1',
        ...overrides
    };
}

const period = { from: '2026-08-21', to: '2026-08-27', visualGate: { approved: 4, required: 4, ready: true } };
const positive = compileAdultFeedbackPulse(Array.from({ length: 7 }, (_, index) => record({
    received_at: `2026-08-${String(21 + index).padStart(2, '0')}T10:00:00Z`
})).concat(record()), period);
assert.strictEqual(positive.totalResponses, 8);
assert.strictEqual(positive.counts.overall.promising, 8);
assert.strictEqual(positive.percentages.recommendation.yes, 100);
assert.strictEqual(positive.decision.expandInvitations, true);
assert.match(renderMarkdown(positive), /supports the next invitation batch/i);
assert.doesNotMatch(renderMarkdown(positive), /2026-08-2\dT10:00/);

const friction = compileAdultFeedbackPulse([
    record({ overall: 'confusing', journey: 'started', next_improvement: 'instructions' }),
    record({ overall: 'could_not_start', journey: 'not_started', next_improvement: 'instructions' }),
    record({ overall: 'promising', journey: 'started', next_improvement: 'instructions' }),
    record({ overall: 'promising', journey: 'hatched', next_improvement: 'nothing_yet' })
], { ...period, visualGate: { approved: 0, required: 4, ready: false } });
assert.strictEqual(friction.evidenceStrength, 'very_early');
assert.match(friction.decision.action, /Pause wider invitations/);
assert.match(friction.decision.action, /visual promotion closed/);
assert.strictEqual(friction.decision.expandInvitations, false);

const empty = compileAdultFeedbackPulse([], period);
assert.strictEqual(empty.evidenceStrength, 'none');
assert.match(empty.decision.action, /First Five/);

assert.throws(() => compileAdultFeedbackPulse([record({ email: 'adult@example.com' })], period), /must never receive: email/);
assert.throws(() => compileAdultFeedbackPulse([record({ comment: 'My child said...' })], period), /must never receive: comment/);
assert.throws(() => compileAdultFeedbackPulse([record({ overall: 'amazing' })], period), /invalid overall/);
assert.throws(() => validatePeriod({ from: '2026-08-01', to: '2026-08-09' }), /between one and seven days/);

console.log('Adult feedback pulse safeguards passed (7 scenarios).');

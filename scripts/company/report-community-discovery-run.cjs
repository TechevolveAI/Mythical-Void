#!/usr/bin/env node

const path = require('path');
const { loadFromRoot, validateCommunityRun } = require('./validate-community-discovery-run.cjs');

function statusForRun(run, now = new Date()) {
    if (!run.publication.posted) {
        return {
            state: 'waiting_for_kevin',
            next: run.nextRequiredAction,
            observationsDue: []
        };
    }

    const observationsDue = [];
    for (const label of ['day2', 'day7']) {
        const observation = run.observations[label];
        if (observation.checkedAt === null && Date.parse(observation.dueAt) <= now.getTime()) observationsDue.push(label);
    }
    return {
        state: observationsDue.length ? 'observation_due' : 'seven_day_read_in_progress',
        postUrl: run.publication.postUrl,
        publishedAt: run.publication.publishedAt,
        observationsDue,
        next: observationsDue.length ? `Record public aggregate ${observationsDue.join(' and ')} evidence only.` : 'Wait for the next dated observation. Do not cross-post.'
    };
}

function main() {
    const root = path.resolve(__dirname, '..', '..');
    const inputs = loadFromRoot(root);
    const failures = validateCommunityRun(inputs);
    if (failures.length) {
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    const atIndex = process.argv.indexOf('--at');
    const now = atIndex === -1 ? new Date() : new Date(process.argv[atIndex + 1]);
    if (!Number.isFinite(now.getTime())) {
        console.error('Use --at with a valid ISO date and time.');
        process.exit(1);
    }
    console.log(JSON.stringify(statusForRun(inputs.run, now), null, 2));
}

if (require.main === module) main();
module.exports = { statusForRun };

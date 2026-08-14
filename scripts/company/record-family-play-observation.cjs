#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { allowedContexts, allowedJourneys, allowedThemes, isDate, nonEmpty, scanText, validateRegister } = require('./family-play-observation-lib.cjs');

const root = path.resolve(__dirname, '../..');
const registerPath = path.join(root, 'docs/company/customer/family-play-observations.json');
const args = process.argv.slice(2);
const options = {};
let apply = false;

for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--apply') {
        apply = true;
        continue;
    }
    if (!args[index].startsWith('--')) throw new Error(`Unexpected argument: ${args[index]}`);
    const key = args[index].slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    if (Object.prototype.hasOwnProperty.call(options, key)) throw new Error(`Repeated option --${key}`);
    options[key] = value.trim();
    index += 1;
}

const allowedOptions = new Set(['context', 'journey', 'build-ref', 'observed-on', 'worked', 'confusing', 'next-check', 'themes', 'confirmed-by']);
for (const key of Object.keys(options)) if (!allowedOptions.has(key)) throw new Error(`Unsupported option --${key}`);

const failures = [];
const observedOn = options['observed-on'] || new Date().toISOString().slice(0, 10);
const themes = (options.themes || '').split(',').map(value => value.trim()).filter(Boolean);
if (!allowedContexts.has(options.context)) failures.push(`--context must be one of: ${[...allowedContexts].join(', ')}`);
if (!allowedJourneys.has(options.journey)) failures.push(`--journey must be one of: ${[...allowedJourneys].join(', ')}`);
if (!isDate(observedOn)) failures.push('--observed-on must be YYYY-MM-DD');
if (!nonEmpty(options['build-ref'], 120)) failures.push('--build-ref must be 3–120 characters');
for (const [flag, key] of [['--worked', 'worked'], ['--confusing', 'confusing'], ['--next-check', 'next-check']]) if (!nonEmpty(options[key])) failures.push(`${flag} must be 3–320 characters`);
if (themes.length === 0 || new Set(themes).size !== themes.length || !themes.every(theme => allowedThemes.has(theme))) failures.push(`--themes must contain unique approved values: ${[...allowedThemes].join(', ')}`);
if (options['confirmed-by'] !== 'Kevin Murphy') failures.push('--confirmed-by must be exactly "Kevin Murphy"');
const narrative = [options['build-ref'], options.worked, options.confusing, options['next-check']].join(' ');
for (const hit of scanText(narrative)) failures.push(`Entry appears to contain ${hit}; remove identifying or quoted detail`);
if (failures.length) {
    console.error(`Family play observation rejected (${failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

const register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
const registerFailures = validateRegister(register);
if (registerFailures.length) throw new Error(`Existing register is invalid: ${registerFailures.join('; ')}`);
const nextNumber = Math.max(0, ...register.observations.map(item => Number(item.id.slice(3)))) + 1;
const observation = {
    id: `PO-${String(nextNumber).padStart(3, '0')}`,
    recordedAt: new Date().toISOString(),
    observedOn,
    context: options.context,
    journey: options.journey,
    buildRef: options['build-ref'],
    worked: options.worked,
    confusing: options.confusing,
    nextCheck: options['next-check'],
    themes,
    recordedBy: 'Kevin Murphy',
    containsPersonalData: false,
    containsDirectQuote: false,
    customerEvidence: false,
    publicationAuthorized: false
};
const updated = {
    ...register,
    asOf: observation.recordedAt.slice(0, 10),
    state: 'internal_observations_recorded',
    observations: [...register.observations, observation]
};
const updatedFailures = validateRegister(updated);
if (updatedFailures.length) throw new Error(`Proposed register is invalid: ${updatedFailures.join('; ')}`);

if (apply) fs.writeFileSync(registerPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(JSON.stringify({
    mode: apply ? 'applied' : 'dry_run',
    registerChanged: apply,
    observation,
    boundary: 'Internal product observation only; not customer evidence and not authorized for publication or contact.'
}, null, 2));

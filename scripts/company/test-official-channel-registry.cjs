#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const recorder = path.join(__dirname, 'record-official-channel.cjs');
const validator = path.join(__dirname, 'validate-official-channel-registry.cjs');
const registrySource = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/OFFICIAL_CHANNEL_REGISTRY.json'), 'utf8'));
const activationSource = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-channel-registry-'));

function write(name, value) {
    const file = path.join(temp, name);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return file;
}

function record(name, extraArgs) {
    const registry = write(`${name}-registry.json`, registrySource);
    const activation = write(`${name}-activation.json`, activationSource);
    return {
        result: spawnSync(process.execPath, [recorder, '--registry', registry, '--activation', activation, '--skip-dashboard', ...extraArgs], { cwd: root, encoding: 'utf8' }),
        registry,
        activation
    };
}

try {
    const currentRegistry = write('current-registry.json', registrySource);
    const currentActivation = write('current-activation.json', activationSource);
    if (spawnSync(process.execPath, [validator, currentRegistry, currentActivation], { cwd: root }).status !== 0) throw new Error('Current registry was rejected.');

    const youtube = record('youtube', ['--platform', 'youtube', '--url', 'https://youtube.com/@MythicalVoid', '--confirmed-by', 'Kevin Murphy', '--confirmed-at', '2026-08-14T19:30:00Z', '--apply']);
    if (youtube.result.status !== 0) throw new Error(`Valid YouTube recording failed: ${youtube.result.stderr}`);
    if (spawnSync(process.execPath, [validator, youtube.registry, youtube.activation], { cwd: root }).status !== 0) throw new Error('Recorded YouTube state was rejected.');

    const dryRun = record('dry-run', ['--platform', 'linkedin', '--url', 'https://www.linkedin.com/company/mythical-void', '--confirmed-by', 'Kevin Murphy', '--confirmed-at', '2026-08-14T19:30:00Z']);
    if (dryRun.result.status !== 0 || JSON.parse(fs.readFileSync(dryRun.registry, 'utf8')).channels[1].officialUrl !== null) throw new Error('Dry run changed the registry.');

    const fakeDomain = record('fake-domain', ['--platform', 'youtube', '--url', 'https://youtube.example/@MythicalVoid', '--confirmed-by', 'Kevin Murphy', '--apply']);
    if (fakeDomain.result.status === 0) throw new Error('Fake YouTube domain was accepted.');

    const personalLinkedIn = record('personal-linkedin', ['--platform', 'linkedin', '--url', 'https://www.linkedin.com/in/kevin', '--confirmed-by', 'Kevin Murphy', '--apply']);
    if (personalLinkedIn.result.status === 0) throw new Error('Personal LinkedIn profile was accepted as the company Page.');

    const wrongConfirmer = record('wrong-confirmer', ['--platform', 'linkedin', '--url', 'https://www.linkedin.com/company/mythical-void', '--confirmed-by', 'Studio Agent', '--apply']);
    if (wrongConfirmer.result.status === 0) throw new Error('Non-Kevin confirmation was accepted.');

    const unsafe = structuredClone(registrySource);
    unsafe.channels[0].firstPublicationAuthorized = true;
    const unsafeRegistry = write('unsafe-registry.json', unsafe);
    if (spawnSync(process.execPath, [validator, unsafeRegistry, currentActivation], { cwd: root }).status === 0) throw new Error('Premature publication authority was accepted.');

    console.log('Official channel registry tests passed: current state, valid recording, dry run, and 4 URL, confirmation and authority failures checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

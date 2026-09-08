#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-discovery-doorway-registry.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-discovery-doorways-'));

function run(name, mutate) {
    const value = JSON.parse(JSON.stringify(source));
    mutate(value);
    const target = path.join(temp, `${name}.json`);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, '--registry', target], { encoding: 'utf8' });
}

try {
    assert.strictEqual(run('valid', () => {}).status, 0);
    const failures = [
        ['publish-authority', value => { value.authority.externalPublishingAuthorized = true; }],
        ['fake-engagement-authority', value => { value.authority.fakeEngagementAuthorized = true; }],
        ['tracking-link', value => { value.ownedSupport.directPlayUrl += '?utm_source=forum'; }],
        ['second-immediate-route', value => { value.routes[1].state = 'ready_waiting_for_kevin_action_time_approval'; }],
        ['skip-webgames', value => { value.routes[0].state = 'held'; }],
        ['playmygame-ready', value => { value.routes.find(route => route.id === 'playmygame').state = 'ready_waiting_for_kevin_action_time_approval'; }],
        ['indiegaming-ready', value => { value.routes.find(route => route.id === 'indiegaming-reddit').state = 'ready_waiting_for_kevin_action_time_approval'; }],
        ['missing-source', value => { value.routes.find(route => route.id === 'indiedb').sources = []; }],
        ['missing-indiedb-packet', value => { value.routes.find(route => route.id === 'indiedb').preparedArtifact = null; }],
        ['private-browsergames-ready', value => { value.screenedNotQueued.find(route => route.id === 'browsergames-reddit').state = 'ready'; }],
        ['slowden-frame-allowed', value => { value.screenedNotQueued.find(route => route.id === 'slowden').currentOwnedGameAllowsThirdPartyFraming = true; }],
        ['slowden-not-immediate', value => { value.screenedNotQueued.find(route => route.id === 'slowden').submissionPublishesImmediately = false; }],
        ['playmategames-email-hidden', value => { value.screenedNotQueued.find(route => route.id === 'playmategames').submissionCollectsAdultEmail = false; }],
        ['missing-screened-source', value => { value.screenedNotQueued.find(route => route.id === 'playmategames').sources = []; }],
        ['stale-source', value => { value.routes.find(route => route.id === 'game-jolt').sources[0].observedOn = '2026-08-01'; }],
        ['cross-posts', value => { value.executionRules.noCopiedCrossPosts = false; }],
        ['automated-replies', value => { value.executionRules.noAutomatedReplies = false; }],
        ['invented-visual-truth', value => { value.executionRules.generatedArtMayBeCalledGameplay = true; }]
    ];
    for (const [name, mutate] of failures) {
        assert.notStrictEqual(run(name, mutate).status, 0, `${name} mutation was accepted`);
    }
    console.log(`Discovery doorway safeguards passed (${failures.length} failure cases across ${source.routes.length} checked routes).`);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

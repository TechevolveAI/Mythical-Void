#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildFieldGuideData, buildFieldGuideHtml } = require('./build-creature-field-guide.cjs');

const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'src/data/creature-field-guide.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/source-profiles.json'), 'utf8'));
const clone = value => structuredClone(value);

const data = buildFieldGuideData(source, profiles);
const html = buildFieldGuideHtml(data);
assert.strictEqual(data.realms.length, 6);
assert.strictEqual(data.realms.flatMap(realm => realm.sightings).length, 12);
assert.strictEqual((html.match(/data-field-realm/g) || []).length, 6);
assert.strictEqual((html.match(/class="field-sighting"/g) || []).length, 12);
assert.ok(html.includes('not claim these twelve creatures or events are already playable quests'));
assert.ok(!/\bcompanions?\b/i.test(html));

const unknownCreature = clone(source);
unknownCreature.realms[0].sightings[0].creatureId = 'MV-9999';
assert.throws(() => buildFieldGuideData(unknownCreature, profiles), /Unknown renderer profile MV-9999/);

const alteredProfile = clone(profiles);
alteredProfile.profiles.find(profile => profile.id === 'MV-0846').personality = 'energetic';
const alteredData = buildFieldGuideData(source, alteredProfile);
assert.strictEqual(alteredData.realms[0].sightings[0].profile.personality, 'energetic', 'Public facts must always be rebuilt from the renderer source.');

console.log('Creature field-guide safeguards passed: exact source binding, 6/12 structure, canon label and language boundary.');

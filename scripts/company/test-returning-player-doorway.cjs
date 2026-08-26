#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'public/returning-player.js'), 'utf8');
let cases = 0;

function makeStorage(keys, blocked = false) {
    return {
        get length() {
            if (blocked) throw new Error('storage blocked');
            return keys.length;
        },
        key(index) {
            if (blocked) throw new Error('storage blocked');
            return keys[index] ?? null;
        },
        getItem() { throw new Error('save values must never be read'); },
        setItem() { throw new Error('storage must never be written'); }
    };
}

function makeRoot() {
    const note = { hidden: true };
    const headerLabel = { textContent: 'Play now' };
    const bodyLabel = { textContent: 'Play Mythical Void' };
    const headerLink = {
        querySelector: () => headerLabel,
        closest: selector => selector === 'header' ? {} : null,
        setAttribute(name, value) { this[name] = value; }
    };
    const bodyLink = {
        querySelector: () => bodyLabel,
        closest: () => null,
        setAttribute(name, value) { this[name] = value; }
    };
    return {
        dataset: {},
        note,
        headerLabel,
        bodyLabel,
        headerLink,
        bodyLink,
        querySelectorAll(selector) {
            if (selector === '[data-returning-player-note]') return [note];
            if (selector === '[data-play-link]') return [headerLink, bodyLink];
            return [];
        }
    };
}

function load(keys, blocked = false) {
    const document = makeRoot();
    document.readyState = 'complete';
    document.documentElement = document;
    const window = { document, localStorage: makeStorage(keys, blocked) };
    vm.runInNewContext(source, { window }, { filename: 'returning-player.js' });
    return { window, document };
}

cases += 1;
const newPlayer = load(['unrelated-key']);
assert.strictEqual(newPlayer.window.MythicalReturningPlayer.hasLocalAdventure(), false);
assert.strictEqual(newPlayer.document.note.hidden, true);
assert.strictEqual(newPlayer.document.bodyLabel.textContent, 'Play Mythical Void');

cases += 1;
const returning = load(['unrelated-key', 'mythical-creature-save']);
assert.strictEqual(returning.window.MythicalReturningPlayer.hasLocalAdventure(), true);
assert.strictEqual(returning.document.note.hidden, false);
assert.strictEqual(returning.document.headerLabel.textContent, 'Continue');
assert.strictEqual(returning.document.bodyLabel.textContent, 'Continue your adventure');
assert.strictEqual(returning.document.bodyLink['aria-label'], 'Continue your saved Mythical Void adventure');

cases += 1;
const blocked = load([], true);
assert.strictEqual(blocked.window.MythicalReturningPlayer.hasLocalAdventure(), false);
assert.strictEqual(blocked.document.note.hidden, true);

cases += 1;
assert(!source.includes('getItem('));
assert(!source.includes('setItem('));
assert(!source.includes('fetch('));
assert(!source.includes('gtag('));

cases += 1;
assert.strictEqual(returning.window.MythicalReturningPlayer.apply(returning.document), true);
assert.strictEqual(returning.document.bodyLabel.textContent, 'Continue your adventure');

assert.strictEqual(cases, 5);
console.log('Returning-player doorway checks passed (5 scenarios).');

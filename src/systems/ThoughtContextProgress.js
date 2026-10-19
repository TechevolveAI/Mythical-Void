import { copyDetachedJsonData as copy, freezeDetachedJsonData as freeze } from '../utils/DetachedJsonData.js';

const loaded = new WeakMap();
export const THOUGHT_CONTEXT_METHOD_NAMES = Object.freeze(['initialize', 'loadContextFromGameState', 'saveContext',
    'recordFailure', 'recordSuccess', 'setBiome', 'captureCompletionContextSource', 'captureCompletionContextPublication']);
const bytes = value => JSON.stringify(copy(value));

export function applyThoughtSuccess(context, levelId, now) {
    context.lastSuccessTime = now;
    context.consecutiveFailures = 0;
    context.playerStruggling = false;
    context.lastLevelId = levelId;
    context.recentFailures = Math.max(0, context.recentFailures - 2);
}

export function applyThoughtFailure(context, levelId, now) {
    context.recentFailures++;
    context.lastFailureTime = now;
    context.totalAttempts++;
    if (levelId === context.lastLevelId) context.consecutiveFailures++;
    else { context.consecutiveFailures = 1; context.lastLevelId = levelId; }
    context.playerStruggling = context.consecutiveFailures >= 3;
}

function contextData(context) {
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw Error('THOUGHT_CONTEXT_NOT_DATA');
    return copy(context);
}

function canonical(root) {
    const field = Object.getOwnPropertyDescriptor(root, 'thoughtContext');
    if (!field) return { present: false, value: null };
    if (!field.enumerable || !Object.hasOwn(field, 'value') ||
        (field.value !== null && (!field.value || typeof field.value !== 'object' || Array.isArray(field.value)))) throw Error('THOUGHT_CONTEXT_UNKNOWN_SAVE');
    return { present: true, value: field.value };
}

function contextSlot(manager, value) {
    const field = Object.getOwnPropertyDescriptor(manager, 'context');
    return field?.value === value && field.writable && field.enumerable && field.configurable;
}

function identity(facts, requireRoot = true) {
    const { manager, state, root, admission, blueprint } = facts;
    return window.GameState === state && window.ThoughtBubbleSystem === manager &&
        (!requireRoot || state.state === root) && state.saveAdmission === admission &&
        admission?.epoch === facts.epoch && admission?.status === facts.status && manager.isInitialized === facts.initialized &&
        Object.getPrototypeOf(manager) === blueprint.prototype && THOUGHT_CONTEXT_METHOD_NAMES.every(name =>
            manager[name] === blueprint.methods[name] && blueprint.prototype[name] === blueprint.methods[name]) &&
        ['get', 'set', 'getSaveAdmission', 'captureSaveAdmissionOwner'].every(name => state[name] === facts.api[name]);
}

function factsFor(manager, blueprint) {
    const state = window.GameState, root = state?.state, admission = state?.saveAdmission;
    if (!root || typeof root !== 'object' || Array.isArray(root)) throw Error('THOUGHT_SOURCE_NOT_READY');
    const facts = { manager, state, root, admission, epoch: admission?.epoch, status: admission?.status,
        initialized: manager.isInitialized, blueprint, api: Object.fromEntries(
            ['get', 'set', 'getSaveAdmission', 'captureSaveAdmissionOwner'].map(name => [name, state[name]])) };
    if (!identity(facts)) throw Error('THOUGHT_SOURCE_CHANGED');
    return facts;
}

function receiptFor(facts, context, saved) {
    return { facts, context, contextBytes: bytes(contextData(context)), saved, savedBytes: bytes(saved) };
}

function sameSaved(root, saved, fingerprint) {
    const value = canonical(root);
    return value.present === saved.present && value.value === saved.value && bytes(value) === fingerprint;
}

function currentReceipt(manager, receipt) {
    return loaded.get(manager) === receipt && identity(receipt.facts) && contextSlot(manager, receipt.context) &&
        bytes(contextData(manager.context)) === receipt.contextBytes && sameSaved(receipt.facts.root, receipt.saved, receipt.savedBytes);
}

// Passive runtime provenance: unsupported data never changes the live methods.
export function beginThoughtContextLoad(manager, blueprint) {
    try {
        const facts = factsFor(manager, blueprint), before = contextData(manager.context), saved = canonical(facts.root);
        return { facts, previous: manager.context, saved, savedBytes: bytes(saved), expected: bytes(saved.value ? { ...before, ...copy(saved.value) } : before) };
    } catch { return null; }
}

export function finishThoughtContextLoad(token) {
    try {
        if (!token) return;
        const { facts, saved } = token, manager = facts.manager;
        if (!identity(facts) || !contextSlot(manager, manager.context) ||
            (saved.value ? manager.context === token.previous : manager.context !== token.previous) ||
            bytes(contextData(manager.context)) !== token.expected || !sameSaved(facts.root, saved, token.savedBytes)) return;
        loaded.set(manager, receiptFor(facts, manager.context, saved));
    } catch { /* Provenance must not alter the existing live result. */ }
}

export function beginThoughtContextTransition(manager, operation, value, now) {
    try {
        const receipt = loaded.get(manager);
        if (!receipt || !currentReceipt(manager, receipt)) return null;
        const expected = contextData(manager.context), persist = operation !== 'biome';
        if (operation === 'success') applyThoughtSuccess(expected, value, now);
        else if (operation === 'failure') applyThoughtFailure(expected, value, now);
        else if (operation === 'biome') expected.currentBiome = value;
        else if (operation !== 'save') return null;
        const aliases = receipt.saved.present && receipt.saved.value === receipt.context;
        const saved = persist || aliases ? { present: true, value: receipt.context } : receipt.saved;
        const expectedSaved = persist || aliases ? { present: true, value: expected } : receipt.saved;
        return { receipt, expected: bytes(expected), saved, savedBytes: bytes(expectedSaved) };
    } catch { return null; }
}

export function finishThoughtContextTransition(token) {
    try {
        if (!token) return;
        const { receipt } = token, { facts, context } = receipt, manager = facts.manager;
        if (loaded.get(manager) !== receipt || !identity(facts) || !contextSlot(manager, context) ||
            bytes(contextData(context)) !== token.expected || !sameSaved(facts.root, token.saved, token.savedBytes)) return;
        loaded.set(manager, receiptFor(facts, context, token.saved));
    } catch { /* A retired or unsupported live transition is not new source proof. */ }
}

export function captureThoughtCompletionSource(manager, state, reader = null) {
    const refused = reason => Object.freeze({ status: 'unqualified', reason });
    try {
        const receipt = loaded.get(manager);
        if (!receipt || receipt.facts.state !== state || !currentReceipt(manager, receipt) || !manager.isInitialized ||
            state.getSaveAdmission().status !== 'ready') return refused('thought_source_not_ready');
        const owner = reader || state.captureSaveAdmissionOwner(), check = owner?.isCurrent;
        const owns = () => typeof check === 'function' && owner.isCurrent === check && check.call(owner);
        const isCurrent = () => {
            try { return owns() && currentReceipt(manager, receipt) && owns(); } catch { return false; }
        };
        if (!isCurrent()) return refused('thought_source_changed');
        return Object.freeze({ status: 'captured', data: freeze(copy({ context: receipt.context, saved: receipt.saved })), isCurrent,
            scope: reader ? 'provided-owner-and-loaded-thought-context' : 'memory-owner-and-loaded-thought-context' });
    } catch { return refused('thought_source_unreadable'); }
}

// Fixed prepared cache/receipt slots only. The caller owns verified adoption.
export function captureThoughtCompletionPublication(manager, state) {
    const before = loaded.get(manager);
    if (!before || before.facts.state !== state || !currentReceipt(manager, before) || !manager.isInitialized) throw Error('THOUGHT_PUBLICATION_UNAVAILABLE');
    let phase = 'captured', after, cursor = 0;
    const isCurrent = () => {
        try {
            return identity(before.facts, false) && (cursor === 0
                ? state.state === before.facts.root || (after && state.state === after.facts.root)
                : state.state === after.facts.root) &&
                (cursor > 0 || sameSaved(before.facts.root, before.saved, before.savedBytes)) &&
                contextSlot(manager, cursor > 0 ? after.context : before.context) &&
                bytes(contextData(manager.context)) === (cursor > 0 ? after.contextBytes : before.contextBytes) &&
                loaded.get(manager) === (cursor > 1 ? after : before) &&
                (!after || sameSaved(after.facts.root, after.saved, after.savedBytes));
        } catch { return false; }
    };
    return { isCurrent, isPublished: () => phase === 'published' && isCurrent(),
        prepare: (staged, context) => {
            if (phase !== 'captured' || !isCurrent() || !staged || staged === before.facts.root ||
                Object.isFrozen(staged) || Object.isFrozen(staged.thoughtContext) || bytes(contextData(staged.thoughtContext)) !== bytes(contextData(context))) {
                throw Error('THOUGHT_PUBLICATION_NOT_PREPARED');
            }
            const saved = canonical(staged);
            if (!saved.present || saved.value !== staged.thoughtContext) throw Error('THOUGHT_PUBLICATION_NOT_PREPARED');
            after = receiptFor({ ...before.facts, root: staged }, staged.thoughtContext, saved);
            if (!isCurrent()) throw Error('THOUGHT_PUBLICATION_RETIRED');
            phase = 'prepared';
        },
        publish: () => {
            if (phase !== 'prepared' || !isCurrent() || state.state !== after.facts.root) throw Error('THOUGHT_PUBLICATION_RETIRED');
            phase = 'publishing';
            manager.context = after.context; cursor = 1;
            if (!isCurrent()) throw Error('THOUGHT_PUBLICATION_RETIRED');
            loaded.set(manager, after); cursor = 2;
            if (!isCurrent()) throw Error('THOUGHT_PUBLICATION_RETIRED');
            phase = 'published';
        }
    };
}

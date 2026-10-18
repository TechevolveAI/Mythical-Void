import { copyDetachedJsonData as copy, freezeDetachedJsonData as freeze } from '../utils/DetachedJsonData.js';

const sources = new WeakMap();
const calculations = new WeakMap();
const levels = new Set(['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths', 'finalVoid']);
const refused = reason => Object.freeze({ status: 'unqualified', reason });

function canonicalSavedProgress(saved) {
    if (saved === undefined) return true;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return false;
    return Object.values(saved).every(entry => entry && typeof entry === 'object' && !Array.isArray(entry) &&
        Object.keys(entry).every(key => ['progress', 'claimed'].includes(key)) &&
        Object.values(entry).every(value => value && typeof value === 'object' && !Array.isArray(value)));
}

// Read-only source/calculation prerequisite. No publication or save capability.
export function captureCompletionAchievementSource(manager, state, suppliedReader = null) {
    try {
        const selected = () => window.GameState === state && window.AchievementSystem === manager;
        if (!manager || !state?.captureSaveAdmissionOwner || !selected()) return refused('achievement_source_unavailable');
        const prototype = Object.getPrototypeOf(manager);
        const names = ['recordEvent', 'recordLevelCompletedEvent', 'recordGuardianRestoredEvent', 'prepareLevelCompletionEventDraft',
            'prepareGuardianCompletionEventDraft', 'continueCompletionGuardianEventDraft', 'continueCompletionLevelEventDraft', 'continueCompletionEventDraft', 'prepareProgressEventDraft',
            'checkAchievements', 'saveProgress', 'hasHatchProgressSource', 'hasCompletionCalculationCatalogue', 'captureHatchProgressPublication', 'captureProgressTopology'];
        const methods = names.map(name => manager[name]);
        if (names.some((name, index) => typeof methods[index] !== 'function' || methods[index] !== prototype[name])) return refused('achievement_adapter_changed');
        const get = state.get, admission = state.getSaveAdmission, captureOwner = state.captureSaveAdmissionOwner;
        const reader = suppliedReader || state.captureSaveAdmissionOwner(), current = reader?.isCurrent;
        const owns = () => typeof current === 'function' && reader.isCurrent === current && current.call(reader);
        if (!canonicalSavedProgress(copy(state.get('achievements') === undefined ? {} : state.get('achievements')))) {
            return refused('achievement_saved_shape_unqualified');
        }
        if (!owns() || state.getSaveAdmission().status !== 'ready' || !manager.hasHatchProgressSource(state) ||
            !manager.hasCompletionCalculationCatalogue()) return refused('achievement_source_not_ready');
        const events = manager.events, emit = events?.emit, queue = manager.notificationQueue;
        if ((events !== null && typeof emit !== 'function') || !Array.isArray(manager.pendingClaims) || !Array.isArray(queue)) return refused('achievement_cache_unavailable');
        const progress = () => Object.fromEntries(Object.entries(manager.definitions).map(([id, definition]) => {
            const fields = Object.getOwnPropertyDescriptors(definition), value = {};
            for (const key of ['progress', 'claimed']) {
                const field = fields[key];
                if (!field?.enumerable || !Object.hasOwn(field, 'value') || !field.value ||
                    typeof field.value !== 'object' || Array.isArray(field.value)) throw Error('ACHIEVEMENT_PROGRESS_NOT_CANONICAL');
                value[key] = field.value;
            }
            return [id, value];
        }));
        const data = () => ({ progress: progress(), pending: manager.pendingClaims, notifications: manager.notificationQueue });
        const bytes = JSON.stringify(copy(data())), achievements = JSON.stringify(copy(state.get('achievements') || {}));
        const publicationSource = manager.captureHatchProgressPublication();
        const topology = manager.captureProgressTopology();
        const isCurrent = () => {
            try {
                return selected() && owns() && Object.getPrototypeOf(manager) === prototype &&
                    names.every((name, index) => manager[name] === methods[index] && prototype[name] === methods[index]) &&
                    state.get === get && state.getSaveAdmission === admission && state.captureSaveAdmissionOwner === captureOwner &&
                    state.getSaveAdmission().status === 'ready' && manager.events === events && events?.emit === emit &&
                    manager.notificationQueue === queue && manager.hasHatchProgressSource(state) && manager.hasCompletionCalculationCatalogue() &&
                    publicationSource.isCurrent() && topology.isCurrent() && JSON.stringify(copy(data())) === bytes && owns() && selected();
            } catch { return false; }
        };
        if (!isCurrent()) return refused('achievement_source_changed');
        const source = Object.freeze({ status: 'captured', isCurrent,
            scope: suppliedReader ? 'provided-owner-and-loaded-achievements' : 'memory-owner-and-loaded-achievements' });
        sources.set(source, { manager, prepare: manager.prepareLevelCompletionEventDraft,
            prepareGuardian: manager.prepareGuardianCompletionEventDraft, continueGuardian: manager.continueCompletionGuardianEventDraft,
            continueLevel: manager.continueCompletionLevelEventDraft, achievements, topology });
        return source;
    } catch { return refused('achievement_source_unreadable'); }
}

export function calculateCompletionAchievementDraft(source, snapshot, data, now) {
    try {
        const owner = sources.get(source);
        if (!owner || !source.isCurrent()) return refused('achievement_source_changed');
        if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || !Number.isSafeInteger(now) || now < 0) {
            return refused('invalid_completion_achievement_input');
        }
        const input = copy(snapshot), event = copy(data);
        if (!event || Array.isArray(event) || !levels.has(event.levelId) || typeof event.noDamage !== 'boolean' ||
            !Number.isFinite(event.time) || event.time < 0 || !Number.isFinite(event.speedrunThreshold) || event.speedrunThreshold < 0) {
            return refused('invalid_completion_achievement_input');
        }
        if (JSON.stringify(input.achievements || {}) !== owner.achievements) return refused('achievement_input_changed');
        if (!source.isCurrent()) return refused('achievement_source_changed');
        const prepared = owner.prepare.call(owner.manager, input, event, now, owner.topology);
        if (!source.isCurrent()) return refused('achievement_source_changed');
        const result = freeze(copy({ status: 'calculated', ...prepared }));
        calculations.set(result, { source, owner, prepared, kind: 'level' });
        return result;
    } catch { return refused('achievement_completion_unreadable'); }
}

export function continueCompletionGuardianDraft(source, previous, state, now) {
    try {
        const calculation = calculations.get(previous), owner = sources.get(source);
        if (!calculation || calculation.kind !== 'level' || calculation.source !== source || calculation.owner !== owner || !source.isCurrent()) {
            return refused('achievement_guardian_source_changed');
        }
        const prepared = owner.continueGuardian.call(owner.manager, calculation.prepared, copy(state), now);
        if (!source.isCurrent()) return refused('achievement_guardian_source_changed');
        return freeze(copy({ status: 'calculated', ...prepared }));
    } catch { return refused('achievement_guardian_unreadable'); }
}

export function calculateCompletionGuardianPrefix(source, snapshot, now) {
    try {
        const owner = sources.get(source);
        if (!owner || !source.isCurrent() || !Number.isSafeInteger(now) || now < 0) return refused('achievement_guardian_source_changed');
        const input = copy(snapshot);
        if (JSON.stringify(input.achievements || {}) !== owner.achievements) return refused('achievement_input_changed');
        const prepared = owner.prepareGuardian.call(owner.manager, input, now, owner.topology);
        if (!source.isCurrent()) return refused('achievement_guardian_source_changed');
        const result = freeze(copy({ status: 'calculated', ...prepared }));
        calculations.set(result, { source, owner, prepared, kind: 'guardian' });
        return result;
    } catch { return refused('achievement_guardian_unreadable'); }
}

export function continueCompletionLevelDraft(source, previous, state, data, now) {
    try {
        const calculation = calculations.get(previous), owner = sources.get(source);
        if (!calculation || calculation.kind !== 'guardian' || calculation.source !== source || calculation.owner !== owner || !source.isCurrent()) {
            return refused('achievement_level_source_changed');
        }
        const prepared = owner.continueLevel.call(owner.manager, calculation.prepared, copy(state), copy(data), now);
        if (!source.isCurrent()) return refused('achievement_level_source_changed');
        return freeze(copy({ status: 'calculated', ...prepared }));
    } catch { return refused('achievement_level_unreadable'); }
}

import { copyDetachedJsonData as copy } from '../utils/DetachedJsonData.js';

const object = value => value !== null && typeof value === 'object';
const fieldNames = ['value', 'get', 'set', 'enumerable', 'writable', 'configurable'];
const sameField = (left, right, ignoreValue = false) => Boolean(left) && Boolean(right) &&
    fieldNames.every(key => ignoreValue && key === 'value' || Object.is(left[key], right[key]));

// Pins the entire prepared graph, including reference relationships and ordinary
// mutability. Only the writer can bracket its four known accounting assignments.
// This is not a scene/service/source owner or authority to write a save.
export function captureCompletionPacketGuard(prepared, { inventory = null, achievements = null } = {}) {
    if (prepared?.status !== 'calculated') throw Error('COMPLETION_PACKET_UNAVAILABLE');
    copy(prepared);
    const root = prepared.state, player = root?.player, session = root?.session;
    if (!object(player) || !object(session) || !Number.isFinite(player.playTime) || player.playTime < 0 ||
        !Number.isSafeInteger(session.sessionStart) || session.sessionStart < 0 ||
        !Number.isFinite(root.savedAt)) throw Error('COMPLETION_ACCOUNTING_UNAVAILABLE');

    const external = new Set();
    const catalogue = node => {
        if (!object(node) || external.has(node)) return;
        external.add(node);
        for (const field of Object.values(Object.getOwnPropertyDescriptors(node))) {
            if (!Object.hasOwn(field, 'value')) throw Error('COMPLETION_CATALOGUE_UNAVAILABLE');
            catalogue(field.value);
        }
    };
    for (const packet of prepared.notifications) {
        if (packet.kind === 'inventory' && packet.event === 'shipPartCollected') {
            const part = inventory?.SHIP_PART_DEFINITIONS?.[packet.data.partId];
            if (!part || packet.data.partInfo !== part) throw Error('COMPLETION_CATALOGUE_UNAVAILABLE');
            catalogue(part);
        } else if (packet.kind === 'achievement' && packet.event === 'achievement:unlocked') {
            const tier = achievements?.tiers?.[packet.data.tier];
            const reward = achievements?.definitions?.[packet.data.id]?.tiers?.[packet.data.tier]?.rewards;
            if (!tier || !reward || packet.data.tierInfo !== tier || packet.data.rewards !== reward) throw Error('COMPLETION_CATALOGUE_UNAVAILABLE');
            catalogue(tier); catalogue(reward);
        }
    }
    const rejectCatalogue = (node, seen = new Set()) => {
        if (!object(node) || seen.has(node)) return;
        if (external.has(node)) throw Error('COMPLETION_CACHE_CATALOGUE_ALIAS');
        seen.add(node); Object.values(node).forEach(value => rejectCatalogue(value, seen));
    };
    for (const node of [root, prepared.result, prepared.projections, prepared.effects, prepared.legacySaveRequests]) rejectCatalogue(node);

    const nodes = [], seen = new Set();
    const accounting = new Map([[player, new Set(['playTime', 'lastPlayed'])], [session, new Set(['sessionStart'])], [root, new Set(['savedAt'])]]);
    const visit = node => {
        if (!object(node) || seen.has(node)) return;
        seen.add(node);
        const fields = Object.getOwnPropertyDescriptors(node), keys = Reflect.ownKeys(node);
        const extensible = Object.isExtensible(node), array = Array.isArray(node);
        if (!external.has(node) && (!extensible || keys.some(key => {
            const field = fields[key];
            return !Object.hasOwn(field, 'value') || !field.writable || (array && key === 'length' ? field.enumerable : !field.configurable || !field.enumerable);
        }))) throw Error('COMPLETION_PACKET_NOT_MUTABLE');
        nodes.push({ node, fields, keys, extensible, prototype: Object.getPrototypeOf(node) });
        keys.forEach(key => visit(fields[key].value));
    };
    visit(prepared);
    for (const [node, keys] of accounting) for (const key of keys) {
        const field = Object.getOwnPropertyDescriptor(node, key);
        if (!field || !Object.hasOwn(field, 'value') || object(field.value)) throw Error('COMPLETION_ACCOUNTING_UNAVAILABLE');
    }
    const matches = (ignoreAccounting = false) => nodes.every(({ node, fields, keys, extensible, prototype }) => {
        const current = Object.getOwnPropertyDescriptors(node), next = Reflect.ownKeys(node);
        return Object.getPrototypeOf(node) === prototype && Object.isExtensible(node) === extensible &&
            next.length === keys.length && keys.every((key, index) => key === next[index] &&
                sameField(fields[key], current[key], ignoreAccounting && accounting.get(node)?.has(key)));
    });
    let phase = 'prepared';
    const isCurrent = () => {
        try { return (phase === 'prepared' || phase === 'sealed') && matches(); }
        catch { return false; }
    };
    const retire = () => { phase = 'retired'; return false; };
    const sealAccounting = record => {
        try {
            if (!['prepared', 'sealed'].includes(phase) || !matches(true)) throw Error('COMPLETION_PACKET_CHANGED');
            phase = 'sealing';
            const playerRecord = nodes.find(record => record.node === player);
            const sessionRecord = nodes.find(record => record.node === session);
            const rootRecord = nodes.find(record => record.node === root);
            const before = { playTime: playerRecord.fields.playTime.value, lastPlayed: playerRecord.fields.lastPlayed.value,
                sessionStart: sessionRecord.fields.sessionStart.value, savedAt: rootRecord.fields.savedAt.value };
            const actual = { playTime: player.playTime, lastPlayed: player.lastPlayed, sessionStart: session.sessionStart, savedAt: root.savedAt };
            if (!record || Object.keys(before).some(key => !Object.is(record.before?.[key], before[key]) ||
                !Object.is(record.after?.[key], actual[key]))) throw Error('COMPLETION_ACCOUNTING_CHANGED');
            const now = actual.lastPlayed;
            const expectedTime = playerRecord.fields.playTime.value + Math.max(0, now - (sessionRecord.fields.sessionStart.value || now));
            if (!Number.isSafeInteger(now) || now < 0 || session.sessionStart !== now || root.savedAt !== now ||
                !Number.isFinite(expectedTime) || player.playTime !== expectedTime) throw Error('COMPLETION_ACCOUNTING_CHANGED');
            // Do not refresh any business data or topology after preparation.
            for (const record of nodes) for (const key of accounting.get(record.node) || []) {
                record.fields[key] = Object.getOwnPropertyDescriptor(record.node, key);
            }
            phase = 'sealed';
            if (!isCurrent()) throw Error('COMPLETION_PACKET_CHANGED');
        } catch (error) { retire(); throw error; }
    };
    if (!isCurrent()) throw Error('COMPLETION_PACKET_CHANGED');
    return Object.freeze({ root, isCurrent, sealAccounting });
}

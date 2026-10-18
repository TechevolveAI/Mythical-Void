import { copyDetachedJsonData as copy } from '../utils/DetachedJsonData.js';

const object = value => value !== null && typeof value === 'object';
const overlap = (a, b) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
const pathValue = (state, path) => {
    const keys = path.split('.');
    if (keys.some(key => !key || ['__proto__', 'prototype', 'constructor'].includes(key))) throw Error('UNSUPPORTED_COMPLETION_EVENT_PATH');
    return keys.reduce((value, key) => value?.[key], state);
};

// Bind only a proved semantic target. Equality validates its unchanged content;
// it never discovers a source/alias or substitutes an equal replacement owner.
function bind(snapshot, target, links) {
    if (JSON.stringify(copy(snapshot)) !== JSON.stringify(copy(target))) throw Error('COMPLETION_EVENT_TARGET_CHANGED');
    const walk = (value, destination) => {
        if (!object(value)) return;
        if (links.has(value)) {
            if (links.get(value) !== destination) throw Error('AMBIGUOUS_COMPLETION_EVENT_ALIAS');
            return;
        }
        links.set(value, destination);
        for (const key of Object.keys(value)) walk(value[key], destination[key]);
    };
    walk(snapshot, target);
}

// Ordinary mutable data/cache/event projections, not a writer, source proof or
// permission to publish. Superseded state writes remain emission-time snapshots.
export function prepareCompletionPublicationDraft(plan, { inventory = null, achievements = null } = {}) {
    if (plan?.status !== 'calculated') throw Error('COMPLETION_PUBLICATION_DATA_UNAVAILABLE');
    const prepared = copy(plan), notifications = prepared.notifications;
    const writes = notifications.flatMap((packet, index) => packet.kind === 'state' && packet.event === 'stateChanged'
        ? [{ index, path: packet.data.path }] : []);
    const lastAssignment = write => !writes.some(later => later.index > write.index && overlap(write.path, later.path));
    const bound = [], packetProjections = new Map();
    for (let index = 0; index < notifications.length; index++) {
        const packet = notifications[index], links = new Map();
        if (packet.kind === 'state' && packet.event === 'stateChanged') {
            const write = writes.find(item => item.index === index);
            if (object(packet.data.newValue) && lastAssignment(write)) {
                bind(packet.data.newValue, pathValue(prepared.state, write.path), links);
            }
        } else if (packet.kind === 'state' && packet.event.startsWith('changed:')) {
            const write = writes.find(item => item.index === index - 1 && packet.event === `changed:${item.path}`);
            if (!write) throw Error('UNPAIRED_COMPLETION_STATE_EVENT');
            if (object(packet.data) && lastAssignment(write)) bind(packet.data, pathValue(prepared.state, write.path), links);
        } else if (packet.kind === 'inventory') {
            if (!inventory) throw Error('COMPLETION_INVENTORY_SINK_UNAVAILABLE');
            if (packet.event === 'itemAdded') {
                // The shared stack helper selects the first matching ID; a new
                // stack has the same unique ID in this one-reward operation.
                const item = prepared.projections.inventoryItems.find(value => value.id === packet.data.item.id);
                if (!item) throw Error('COMPLETION_ITEM_PROJECTION_UNAVAILABLE');
                bind(packet.data.item, item, links);
            } else if (packet.event === 'shipPartCollected') {
                bind(packet.data.partInfo, inventory.SHIP_PART_DEFINITIONS[packet.data.partId], links);
            }
        } else if (packet.kind === 'achievement' && packet.event === 'achievement:unlocked') {
            if (!achievements) throw Error('COMPLETION_ACHIEVEMENT_SINK_UNAVAILABLE');
            bind(packet.data.tierInfo, achievements.tiers[packet.data.tier], links);
            bind(packet.data.rewards, achievements.definitions[packet.data.id].tiers[packet.data.tier].rewards, links);
        } else if (packet.kind === 'state' && packet.event === 'projectBeaconKatanaUpgradeInstalled') {
            const upgrades = prepared.state.story.projectBeacon.fieldKit.katana.installedUpgrades;
            const upgrade = upgrades.find(value => value.id === packet.data.upgrade.id);
            if (!upgrade) throw Error('COMPLETION_UPGRADE_PROJECTION_UNAVAILABLE');
            bind(packet.data.upgrade, upgrade, links);
        }
        if (packetProjections.has(packet)) throw Error('DUPLICATED_COMPLETION_NOTIFICATION');
        const projected = copy(packet, links);
        bound.push(projected); packetProjections.set(packet, projected);
    }
    prepared.notifications = bound;
    for (const entry of prepared.timeline) {
        if (entry.type !== 'notification') continue;
        if (!packetProjections.has(entry.packet)) throw Error('UNPAIRED_COMPLETION_TIMELINE_PACKET');
        entry.packet = packetProjections.get(entry.packet);
    }
    return prepared;
}

// Stable IDs are shared with expedition saves. Heights belong to this route,
// never to saved coordinates from an older version of the mountain.
export const PEAK_WORLD_HEIGHT = 2100;
export const PEAK_ROUTE = Object.freeze([
    [0, 2050, 300, 'solid', 'peak-ground-arrival'],
    [300, 1930, 300, 'solid', 'peak-opening-step'],
    [600, 1820, 260, 'solid', 'peak-opening-rise'],
    [860, 1720, 220, 'solid', 'peak-foothill-turn'],
    [980, 1720, 580, 'solid', 'peak-ground-lower-relay'],
    [1080, 1600, 480, 'solid', 'peak-lower-relay-overlook'],
    [1560, 1490, 420, 'solid', 'peak-lower-ascent'],
    [1880, 1490, 900, 'solid', 'peak-floor-lower'],
    [1980, 1380, 300, 'solid', 'peak-ridge-approach'],
    [2280, 1270, 360, 'one-way', 'peak-warning-lower'],
    [2640, 1200, 140, 'solid', 'peak-ridge-turn'],
    [2780, 1120, 140, 'solid', 'peak-main-handoff'],
    [2920, 1120, 660, 'solid', 'peak-floor-summit'],
    [3180, 1010, 400, 'one-way', 'peak-warning-summit'],
    [3580, 900, 320, 'solid', 'peak-summit-relay'],
    [3900, 900, 1300, 'solid', 'peak-ground-titan-pass'],
    [4020, 800, 360, 'solid', 'peak-titan-approach'],
    [2490, 1115, 110, 'one-way', 'peak-relic-launch'],
    [2640, 990, 180, 'one-way', 'peak-relic-ridge-1'],
    [2910, 895, 190, 'one-way', 'peak-relic-ridge-2'],
    [3190, 800, 200, 'one-way', 'peak-relic-ridge-3'],
    [3440, 720, 180, 'one-way', 'peak-relic-ridge-4']
].map(([x, y, width, type, id]) => Object.freeze({ x, y, width, type, id })));

export const PEAK_RELAYS = Object.freeze([
    ['peaks_relay_1', 1280, 'peak-lower-relay-overlook', 'FOOTHILLS'],
    ['peaks_relay_2', 2380, 'peak-warning-lower', 'RIDGE'],
    ['peaks_relay_3', 3680, 'peak-summit-relay', 'SHOULDERS']
].map(([id, x, supportId, label]) => Object.freeze({
    id, x, y: PEAK_ROUTE.find(support => support.id === supportId).y - 45,
    label, activationSupportIds: [supportId]
})));

export const PEAK_FRAGMENTS = Object.freeze([
    [680, 1775], [1700, 1445], [2730, 945, 'peaks_relic_ridge'],
    [3000, 850, 'peaks_relic_ridge'], [3680, 855]
]);

export const PEAK_RETURN_CURRENTS = Object.freeze([
    { id: 'peak-return-lower', x: 2400, top: 1295, bottom: 1490, width: 120, destinationId: 'peak-warning-lower' },
    { id: 'peak-return-summit', x: 3260, top: 1035, bottom: 1120, width: 150, destinationId: 'peak-warning-summit' }
]);

export function peakCheckpointSupport(checkpointId) {
    return PEAK_RELAYS.find(relay => relay.id === checkpointId)?.activationSupportIds[0] || null;
}

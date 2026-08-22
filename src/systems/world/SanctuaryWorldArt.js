export const SANCTUARY_WORLD_ART = Object.freeze({
    currentBloomGrove: Object.freeze({
        key: 'sanctuary-current-bloom-grove',
        url: '/game/sanctuary/flora/current-bloom-grove.webp'
    }),
    listeningReeds: Object.freeze({
        key: 'sanctuary-listening-reeds',
        url: '/game/sanctuary/flora/listening-reeds.webp'
    })
});

export const SANCTUARY_FLORA_PLACEMENTS = Object.freeze([
    Object.freeze({
        artwork: 'currentBloomGrove',
        zone: 'crashSite',
        offsetX: 270,
        offsetY: 118,
        width: 178,
        flipX: false
    }),
    Object.freeze({
        artwork: 'listeningReeds',
        zone: 'livingArea',
        offsetX: -218,
        offsetY: -132,
        width: 190,
        flipX: true
    }),
    Object.freeze({
        artwork: 'currentBloomGrove',
        zone: 'shopArea',
        offsetX: -226,
        offsetY: 122,
        width: 154,
        flipX: true
    }),
    Object.freeze({
        artwork: 'listeningReeds',
        zone: 'gardenPlot',
        offsetX: 126,
        offsetY: 118,
        width: 168,
        flipX: false
    }),
    Object.freeze({
        artwork: 'currentBloomGrove',
        zone: 'hubGate',
        offsetX: -202,
        offsetY: 86,
        width: 148,
        flipX: false
    }),
    Object.freeze({
        artwork: 'listeningReeds',
        zone: 'trainingGrounds',
        offsetX: -188,
        offsetY: 132,
        width: 176,
        flipX: true
    })
]);

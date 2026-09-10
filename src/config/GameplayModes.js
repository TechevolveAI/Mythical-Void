export const GAMEPLAY_MODES = Object.freeze({
    SANCTUARY_COMMUNITY: Object.freeze({
        id: 'sanctuary-community',
        sceneFamily: 'sanctuary',
        primaryLoop: 'care-build-community',
        movement: 'two-axis-ground',
        camera: 'top-down-exploration',
        playerPromise: 'Build a safe home, care for creatures, and help residents.'
    }),
    REALM_PLATFORMER: Object.freeze({
        id: 'realm-platformer',
        sceneFamily: 'realm',
        primaryLoop: 'traverse-fight-discover',
        movement: 'horizontal-jump-with-authored-exceptions',
        camera: 'side-on-platforming',
        playerPromise: 'Cross a dangerous realm, overcome its Guardian, and bring help home.'
    })
});

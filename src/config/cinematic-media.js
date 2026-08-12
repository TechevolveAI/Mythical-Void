export const CINEMATIC_MEDIA = Object.freeze({
    projectBeaconHome: Object.freeze({
        url: '/game/cinematics/fend-crash-site-loop.mp4',
        poster: '/game/project-beacon-crash-site.webp'
    }),
    villageHeart: Object.freeze({
        url: '/game/cinematics/village-heart-loop.mp4',
        poster: '/game/village/village-heart-command.webp'
    }),
    mythicalForestArrival: Object.freeze({
        url: '/game/cinematics/mythical-forest-arrival-loop.mp4',
        poster: '/game/cinematics/mythical-forest-arrival.png'
    })
});

export const CINEMATIC_ASSET_DEFINITIONS = Object.freeze({
    projectBeaconHome: Object.freeze({
        output: 'public/game/cinematics/fend-crash-site-loop.mp4',
        referenceImage: 'public/game/project-beacon-crash-site.webp',
        prompt: [
            'Create one continuous eight-second establishing shot using the input image as the exact first-frame visual reference.',
            'A quiet camera glide over the wreck site of Wanderer-77 on the Fend: dark volcanic rock, shallow reflective water, a damaged white research lander, and a real astronomical night sky.',
            'Tiny warm navigation lights blink on the lander. Fine dust and a few drifting points of light move naturally in a light breeze. A pale distant planet is visible but subtle.',
            'Grounded premium science-fiction film, physically believable scale, calm and hopeful, restrained black, white, red, and green palette, stable camera motion.',
            'No people, no creatures, no text, no logos, no user interface, no fantasy castle, no random floating objects, no morphing, no cartoon rendering, no fast cuts.'
        ].join(' ')
    }),
    villageHeart: Object.freeze({
        output: 'public/game/cinematics/village-heart-loop.mp4',
        referenceImage: 'public/game/village/village-heart-command.webp',
        prompt: [
            'Create one continuous eight-second establishing shot using the input image as the exact first-frame visual reference.',
            'A compact shared field base beneath a living tree on the Fend. The camera makes a very slow, stable push toward the warm central shelter.',
            'Small practical lights pulse gently along safe footpaths. Leaves move in a soft wind, faint dust glints in the air, and the settlement feels cared for rather than magical or busy.',
            'Premium live-action science-fiction film, physically coherent materials and motion, warm and optimistic, restrained black, white, red, and green accents.',
            'No people, no creatures, no text, no logos, no user interface, no weapons, no impossible architecture, no morphing, no cartoon rendering, no fast cuts.'
        ].join(' ')
    }),
    mythicalForestArrival: Object.freeze({
        output: 'public/game/cinematics/mythical-forest-arrival-loop.mp4',
        referenceImage: 'public/game/cinematics/mythical-forest-arrival.png',
        prompt: [
            'Create one continuous eight-second establishing shot using the input image as the exact first-frame visual reference.',
            'A slow, stable camera glide along the marked expedition trail in the Mythical Forest on the Fend. The ground is wet rock and shallow water beneath tall ordinary trees, with a distant field beacon and a real star-filled night sky above the canopy.',
            'A few tiny Current lights travel through moss and exposed roots like a natural electrical phenomenon. Leaves shift in a gentle breeze, reflective water ripples, and fine sparkling particles drift only near the Current.',
            'Premium grounded science-fiction film, physically believable scale and materials, calm but intriguing, restrained black, deep green, white, and red safety-light palette.',
            'No people, no creatures, no tree faces, no giant mushrooms, no castles, no alien buildings, no fantasy magic ribbons, no text, no logos, no user interface, no morphing, no cartoon rendering, no fast cuts.'
        ].join(' ')
    })
});

export function shouldPlayCinematicMedia() {
    if (typeof window === 'undefined') return false;
    if (window.GameState?.get?.('settings.reducedMotion') === true) return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

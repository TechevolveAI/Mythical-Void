const CARE_PROFILES = Object.freeze({
    curious: Object.freeze({
        label: 'Investigator',
        preferredAction: 'play',
        secondaryAction: 'pet',
        observation: 'Responds most strongly to movement, variation, and anything that reveals a new pattern.'
    }),
    playful: Object.freeze({
        label: 'Improviser',
        preferredAction: 'play',
        secondaryAction: 'feed',
        observation: 'Builds trust through shared games, changed rules, and room to choose the next move.'
    }),
    gentle: Object.freeze({
        label: 'Steady presence',
        preferredAction: 'pet',
        secondaryAction: 'rest',
        observation: 'Prefers calm contact and unhurried company over noise or repeated activity.'
    }),
    wise: Object.freeze({
        label: 'Listener',
        preferredAction: 'rest',
        secondaryAction: 'pet',
        observation: 'Finds meaning in quiet cycles and notices changes that faster creatures miss.'
    }),
    energetic: Object.freeze({
        label: 'Pathfinder',
        preferredAction: 'play',
        secondaryAction: 'rest',
        observation: 'Settles through purposeful movement and likes to test the Sanctuary boundary.'
    })
});

const CARE_REACTIONS = Object.freeze({
    curious: Object.freeze({
        feed: 'This ration has no Current in it, yet I feel steadier. I want to understand why.',
        play: 'Change the pattern next time. I want to see what the Current does when we improvise.',
        rest: 'The quieter we become, the more of the planet I can hear.',
        pet: 'Your hand changes the feeling around me. Stay there while I trace it.'
    }),
    playful: Object.freeze({
        feed: 'Good. Now I have enough energy to choose the next route.',
        play: 'You followed my rule without knowing it. Next round, I make the route harder.',
        rest: 'I will be still for one cycle. That does not mean I have stopped planning.',
        pet: 'Careful. That is how you activate my highly advanced distraction strategy.'
    }),
    gentle: Object.freeze({
        feed: 'That is enough. Leave some near the garden in case another life reaches us.',
        play: 'Slower this time. I want the smaller creatures to remain near us.',
        rest: 'The Sanctuary feels balanced when neither of us is forcing the next step.',
        pet: 'You are calmer now. I can feel it too.'
    }),
    wise: Object.freeze({
        feed: 'Energy restored. We should spend it on the route that changes the least.',
        play: 'A game can reveal a habit faster than a test. I learned one of yours.',
        rest: 'There is a second rhythm beneath the wind. Give it time to become clear.',
        pet: 'Contact carries memory here. The Current will remember this moment differently.'
    }),
    energetic: Object.freeze({
        feed: 'I feel steady. I can reach the far boundary and return before the light changes.',
        play: 'Again. This time I take the outside line and you try to keep up.',
        rest: 'Stopping is useful when it gives the next movement a direction.',
        pet: 'I can stay still for this. Briefly.'
    })
});

const CARE_REPETITION_REACTIONS = Object.freeze({
    curious: 'We repeated that rhythm. Change one part next time so I can compare what happens.',
    playful: 'Same move twice? I am changing the rules before the next round.',
    gentle: 'That rhythm is enough for now. We can leave some quiet for the smaller creatures.',
    wise: 'Repetition changes what a rhythm means. Let this one settle before we add another.',
    energetic: 'Pattern logged. Give the next cycle a different direction.'
});

const CARE_RESONANCE_REACTIONS = Object.freeze({
    curious: 'You remembered what helps me think. I noticed.',
    playful: 'You remembered my rhythm. Good. Now I can make the next part less predictable.',
    gentle: 'You read my mood before choosing. That makes the Sanctuary feel steadier.',
    wise: 'You recognized the rhythm I return to. Trust begins in details like that.',
    energetic: 'You found what clears my path. I am ready for the boundary again.'
});

const CARE_STEADY_REACTIONS = Object.freeze({
    curious: 'I feel steady. We can spend the next cycle investigating the Sanctuary.',
    playful: 'I am fully charged. Save the next move for somewhere with more room.',
    gentle: 'I have enough. Let us check whether another life in the Sanctuary needs this more.',
    wise: 'The cycle is balanced. More is not always better.',
    energetic: 'I feel steady. The useful thing now is movement with a purpose.'
});

function normalizeCore(genetics) {
    const core = genetics?.personality?.core;
    return Object.prototype.hasOwnProperty.call(CARE_PROFILES, core) ? core : 'curious';
}

export function getCreatureCareProfile(genetics) {
    const personalityCore = normalizeCore(genetics);
    return Object.freeze({
        personalityCore,
        ...CARE_PROFILES[personalityCore]
    });
}

export function getCreatureCareReaction(actionType, genetics, context = {}) {
    const profile = getCreatureCareProfile(genetics);
    if (
        Number(context.energy) <= 30 &&
        actionType !== 'rest'
    ) {
        return 'I can answer, but my energy is low. A quiet recovery cycle should come next.';
    }
    if (Number(context.consecutiveActionCount) >= 2) {
        return CARE_REPETITION_REACTIONS[profile.personalityCore];
    }
    if (Number(context.happiness) >= 98) {
        return CARE_STEADY_REACTIONS[profile.personalityCore];
    }
    if (context.isPreferred && Number(context.actionCount) >= 2) {
        return CARE_RESONANCE_REACTIONS[profile.personalityCore];
    }
    return CARE_REACTIONS[profile.personalityCore]?.[actionType]
        || 'That changed how I feel. Give me a moment to understand it.';
}

export {
    CARE_PROFILES,
    CARE_REACTIONS,
    CARE_REPETITION_REACTIONS,
    CARE_RESONANCE_REACTIONS,
    CARE_STEADY_REACTIONS
};

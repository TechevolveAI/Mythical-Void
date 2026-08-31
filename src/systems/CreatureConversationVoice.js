const PERSONALITY_DIALOGUE = Object.freeze({
    curious: Object.freeze({
        greetings: Object.freeze({
            happy: Object.freeze(['{name} traces a new pattern in the air. "I found a trail our map does not explain."']),
            neutral: Object.freeze(['{name} studies the edge of the clearing. "Something changed while we were gone."']),
            sad: Object.freeze(['{name} stays near the ship. "My energy is low, but I am still listening."']),
            upset: Object.freeze(['{name} watches the dark beyond the hull. "I need facts before we move again."'])
        }),
        responses: Object.freeze({
            general: '"Three things changed. I only understand two of them."',
            play: '"Change the pattern halfway through. Predictable movement teaches us nothing."',
            feelings: '"Alert. Not afraid. The Current is carrying a warning I have not heard before."',
            adventure: '"The eastern route has new growth and one impossible reading. We should start there."',
            food: '"A ration will steady me. Then I want to examine what is growing beside the ramp."',
            affection: '"I trust that you ask before deciding for both of us."',
            story: '"The oldest trail begins under the Sanctuary. I have only found its first turn."'
        })
    }),
    playful: Object.freeze({
        greetings: Object.freeze({
            happy: Object.freeze(['{name} completes a tight loop around the landing strut. "Your turn. Same route, fewer steps."']),
            neutral: Object.freeze(['{name} waits beside three rearranged pattern stones. "One of these is a trap. Probably."']),
            sad: Object.freeze(['{name} nudges a pattern stone without following it. "I could use a better game than waiting."']),
            upset: Object.freeze(['{name} holds unusually still. "No jokes until we know what crossed the boundary."'])
        }),
        responses: Object.freeze({
            general: '"I improved the Sanctuary route. The astronaut will call it an unauthorized obstacle course."',
            play: '"Yes. I choose the rules, and I reserve the right to improve them while we move."',
            feelings: '"Restless. The safe paths are becoming too easy."',
            adventure: '"Take the route with the broken marker. It looks interesting and only slightly unwise."',
            food: '"Food first. Then I intend to outrun your field manual."',
            affection: '"You leave room for me to disagree. Keep doing that."',
            story: '"I once convinced a guardian that I was two creatures. It remains technically unresolved."'
        })
    }),
    gentle: Object.freeze({
        greetings: Object.freeze({
            happy: Object.freeze(['{name} waits beside new growth near the garden. "The smallest creatures stayed. Come and see."']),
            neutral: Object.freeze(['{name} approaches at an even pace. "The Sanctuary is calm, but one resident needs space."']),
            sad: Object.freeze(['{name} remains close to the quiet edge of camp. "I need a slower cycle today."']),
            upset: Object.freeze(['{name} places themself between the garden and the open route. "Something frightened the new growth."'])
        }),
        responses: Object.freeze({
            general: '"The clearing held together. I kept the smaller creatures away from the cold edge."',
            play: '"We can move, but let the game make room for the lives around us."',
            feelings: '"Steady, though the western roots are carrying strain."',
            adventure: '"I will go. Let us choose a route that does not turn every living thing into an obstacle."',
            food: '"Enough for me. Leave a little near the garden in case another traveler arrives."',
            affection: '"Your presence is familiar now. Familiar is not the same as owned."',
            story: '"Before the crash, this ground carried many quiet lives. Some are beginning to return."'
        })
    }),
    wise: Object.freeze({
        greetings: Object.freeze({
            happy: Object.freeze(['{name} looks up from the Current marks. "The pattern repeated. This time, I know why."']),
            neutral: Object.freeze(['{name} listens before speaking. "The quiet here is useful, not empty."']),
            sad: Object.freeze(['{name} rests beside the hull. "I have enough strength to listen, not enough to rush."']),
            upset: Object.freeze(['{name} faces the relay. "A false call is using a familiar rhythm."'])
        }),
        responses: Object.freeze({
            general: '"The Sanctuary changed by one small measure. Small measures decide whether a place survives."',
            play: '"A game reveals habits faster than an interview. I am willing to learn another of yours."',
            feelings: '"Concerned, but clear. Those are different conditions."',
            adventure: '"We should take the slower route. It passes the evidence everyone else ignored."',
            food: '"Energy is useful only when we decide what deserves it."',
            affection: '"Trust is a pattern of choices. Ours is becoming visible."',
            story: '"The Current remembers every extraction. It also remembers every repair."'
        })
    }),
    energetic: Object.freeze({
        greetings: Object.freeze({
            happy: Object.freeze(['{name} returns from the Sanctuary boundary. "Clear route. Clear route. We can move now."']),
            neutral: Object.freeze(['{name} paces a measured line beside the ramp. "I checked the perimeter twice. The third pass is yours."']),
            sad: Object.freeze(['{name} stays near the warm hull. "My energy is lower today. I can still choose the route."']),
            upset: Object.freeze(['{name} fixes on the outer boundary. "Something fast crossed there. I want to know what."'])
        }),
        responses: Object.freeze({
            general: '"I checked every safe boundary and found one that is no longer safe."',
            play: '"Good. Outside line, full pace, no pretending you did not see the marker."',
            feelings: '"Ready to move. Staying still is making the world harder to read."',
            adventure: '"The longest route reaches two trails. We take that one."',
            food: '"Enough to stabilize me. Save the rest for after the far boundary."',
            affection: '"You keep pace without trying to steer every step. I notice."',
            story: '"I once crossed three Current streams before the light changed. The fourth crossed me back."'
        })
    })
});

function buildGreetings() {
    return Object.fromEntries(
        Object.entries(PERSONALITY_DIALOGUE).map(([core, voice]) => [core, voice.greetings])
    );
}

function buildResponses() {
    const categories = ['general', 'play', 'feelings', 'adventure', 'food', 'affection', 'story'];
    return Object.fromEntries(categories.map(category => [
        category,
        Object.fromEntries(Object.entries(PERSONALITY_DIALOGUE).map(([core, voice]) => [
            core,
            Object.freeze([voice.responses[category]])
        ]))
    ]));
}

export const CREATURE_CONVERSATION = Object.freeze({
    greetings: Object.freeze(buildGreetings()),
    playerOptions: Object.freeze({
        general: Object.freeze([
            'What changed while I was away?',
            'How are you feeling?',
            'Which route would you choose?',
            'Do you need food, movement, or quiet?'
        ]),
        followup: Object.freeze([
            'Show me what you noticed.',
            'Why does that clue matter?',
            'You choose the next step.',
            'Let us check the Sanctuary together.'
        ])
    }),
    creatureResponses: Object.freeze(buildResponses())
});

export { PERSONALITY_DIALOGUE };

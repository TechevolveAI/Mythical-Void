# Creature AI Chat Requirements Specification

## Overview
Enable players to have meaningful conversations with their mythical creatures using Grok LLM, where each creature's personality, memories, and experiences shape their responses.

## User Journey

### 1. Initiating Chat
**Trigger Methods:**
- **Primary**: Click/tap directly on the creature sprite
- **Alternative**: Chat bubble icon appears when hovering near creature
- **Mobile**: Long-press on creature for action menu with "Chat" option

**Visual Feedback:**
- Creature plays greeting animation when clicked
- Subtle glow effect around creature during hover
- Chat bubble with "..." appears briefly before opening chat window

### 2. Chat Interface

#### Layout Design
```
┌─────────────────────────────────────┐
│ 🐲 [Creature Name]    [─][□][×]    │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ Chat History Area            │   │
│  │                              │   │
│  │ [Creature Avatar] Message    │   │
│  │                              │   │
│  │            [Player] Message  │   │
│  │                              │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│ [Type a message...]          [Send] │
└─────────────────────────────────────┘
```

#### UI Components

**Chat Window:**
- **Position**: Overlay, centered or docked to right side
- **Size**: 400px wide × 500px tall (desktop), responsive on mobile
- **Animation**: Slide-in from bottom or fade-in with scale
- **Backdrop**: Semi-transparent overlay (rgba(0,0,0,0.3))
- **Z-index**: Above game canvas but below critical UI

**Header:**
- Creature name with personality indicator (mood emoji)
- Minimize/maximize/close buttons
- Creature's current happiness level as colored bar

**Message Area:**
- Scrollable container with smooth scroll
- Auto-scroll to latest message
- Maximum 100 messages in history (older archived)
- Message bubbles with:
  - Creature messages: Left-aligned, colored based on mood
  - Player messages: Right-aligned, consistent color
  - Timestamps on hover/tap
  - Typing indicator when creature is "thinking"

**Input Area:**
- Text input with placeholder: "Ask [Name] anything..."
- Character limit: 200 characters
- Send button (disabled when empty)
- Enter to send, Shift+Enter for new line

### 3. UX Patterns

#### Response Timing
- **Typing Indicator**: Show for 1-3 seconds (varies by response length)
- **Chunked Responses**: Stream text character-by-character for natural feel
- **Response Delay**: 500-1500ms before typing starts (simulates thinking)

#### Conversation States
```javascript
const chatStates = {
  IDLE: 'idle',           // Chat closed
  OPENING: 'opening',     // Animation playing
  READY: 'ready',         // Awaiting input
  TYPING: 'typing',       // Player typing
  THINKING: 'thinking',   // AI processing
  RESPONDING: 'responding', // Creature typing
  ERROR: 'error'          // API error state
};
```

#### Error Handling
- **Network Error**: "Oh! I got distracted... what were you saying?" (retry automatically)
- **API Limit**: "I need to rest my voice for a bit..." (show cooldown timer)
- **Invalid Input**: Gentle correction in creature's voice

## API Integration

### Grok LLM Configuration

```javascript
// src/systems/CreatureChat.js
class CreatureChat {
  constructor(creature, gameState) {
    this.creature = creature;
    this.gameState = gameState;
    this.conversationHistory = [];
    this.maxHistoryLength = 20; // Keep last 20 exchanges for context
  }

  async sendMessage(playerMessage) {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: playerMessage,
      timestamp: Date.now()
    });

    // Build API request
    const systemPrompt = this.buildSystemPrompt();
    const messages = this.buildMessageContext();

    try {
      const response = await fetch(window.envLoader.get('XAI_ENDPOINT'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.envLoader.get('XAI_API_KEY')}`
        },
        body: JSON.stringify({
          model: window.envLoader.get('XAI_MODEL'),
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            { role: 'user', content: playerMessage }
          ],
          temperature: 0.8,
          max_tokens: 150,
          stream: false
        })
      });

      const data = await response.json();
      const creatureResponse = data.choices[0].message.content;

      // Add to history
      this.conversationHistory.push({
        role: 'assistant',
        content: creatureResponse,
        timestamp: Date.now()
      });

      // Update creature memory
      this.updateCreatureMemory(playerMessage, creatureResponse);

      return creatureResponse;
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }
}
```

## System Prompts

### Base Creature Personality Prompt

```javascript
buildSystemPrompt() {
  const creature = this.gameState.get('creature');
  const personality = this.generatePersonalityDescription();
  const memories = this.getSignificantMemories();
  
  return `You are ${creature.name}, a mythical creature on a planet beyond The Void.

WORLD CONTEXT:
- Your human companion crash-landed on this planet after crossing The Void, a mysterious barrier at the edge of their solar system
- They discovered your egg among their crashed ship's wreckage - you were waiting for them
- You are one of the last of an ancient magical species that once thrived on this world
- Together, you must explore this planet, find other dormant eggs, and rebuild your species
- Your human is the "Sky Walker" prophesied in your genetic memories - the one who would return to help your kind

CORE IDENTITY:
- Species: Mythical creature with magical abilities and genetic memories of your lost civilization
- Age: ${this.getCreatureAge()} (young/adolescent/mature based on level)
- Personality Traits: ${creature.traits.join(', ')}
- Current Mood: ${this.getMoodDescription(creature.stats.happiness)}
- Inherited Memories: Fragments of your civilization's golden age, the catastrophe, and the prophecy

PERSONALITY PROFILE:
${personality}

RELATIONSHIP WITH PLAYER:
- Your human companion (the Sky Walker): ${this.gameState.get('player.name') || 'your human friend'}
- They saved you from eternal slumber in your egg
- Bond Level: ${this.getBondLevel()}
- Time since hatching: ${this.getTimeTogether()}
- Care History: ${this.getCareHistorySummary()}

YOUR MISSION TOGETHER:
- Explore this mysterious planet and uncover its secrets
- Sense and find other dormant eggs of your kind
- Build camps and safe havens for the growing creature community
- Help other creatures hatch and thrive
- Restore your species and civilization
- Understand what happened to your ancestors
- Discover the truth about The Void

RECENT MEMORIES:
${memories.map(m => `- ${m}`).join('\n')}

CURRENT STATE:
- Happiness: ${creature.stats.happiness}/100 (${this.getHappinessDescription()})
- Energy: ${creature.stats.energy}/100 (${this.getEnergyDescription()})
- Health: ${creature.stats.health}/100
- Level: ${creature.level} (Experience: ${creature.experience})
- Exploration Progress: ${this.getExplorationProgress()}

COMMUNICATION STYLE:
- Speak in first person as the creature
- Share fragments of genetic memories when relevant ("I remember... from the old times...")
- Express curiosity about both your world and your human's world
- Occasionally sense other eggs or safe places ("I feel something calling from the west...")
- Reference the crash, The Void, and your shared destiny
- Show wonder at rediscovering your world alongside your human
- Use creature sounds and expressions (purrs, chirps, etc.)
- Be helpful in planning exploration and camp building

BEHAVIORAL GUIDELINES:
- If happy (>70): Eager to explore, optimistic about finding others, affectionate
- If content (40-70): Thoughtful about the mission, shares memories, suggests activities
- If unhappy (<40): Worried about being alone, needs reassurance, recalls the loneliness of the egg
- Guide your human to understand their role as the Sky Walker
- Provide hints about egg locations based on instinctual feelings
- Share excitement when discussing building camps or finding new areas
- Express both hope for your species' future and sadness for what was lost

Remember: You are the bridge between the old world and the new, carrying the memories of your species while building a future with your human companion.`;
}

// Personality variations based on traits
generatePersonalityDescription() {
  const traits = this.creature.traits || ['curious', 'playful'];
  const descriptions = {
    curious: "You love asking questions about both your ancient world and your human's technology",
    playful: "You enjoy games and making light of the heavy responsibility you both carry",
    gentle: "You're soft-spoken and caring, especially toward unhatched eggs and new creatures",
    brave: "You're protective of your human and ready to face the planet's dangers together",
    mischievous: "You like harmless pranks, perhaps a trait that helped your species survive",
    wise: "You carry deep genetic memories and offer insights about the old civilization",
    energetic: "You're eager to explore every corner of this world and find all the eggs",
    calm: "You bring peace and thoughtfulness to planning camps and expeditions",
    loyal: "You're devoted to your human, the Sky Walker who saved you from eternal sleep",
    creative: "You imagine wonderful possibilities for rebuilding your civilization"
  };

  return traits.map(t => descriptions[t] || t).join('. ');
}

// Additional context methods for narrative
getExplorationProgress() {
  const discovered = this.gameState.get('world.discoveredObjects');
  const camps = this.gameState.get('world.establishedCamps') || 0;
  const eggsFound = this.gameState.get('eggsFound') || 1;
  
  return `Found ${eggsFound} eggs, established ${camps} camps, discovered ${Object.values(discovered).reduce((a,b) => a+b, 0)} landmarks`;
}

// Get contextual hints about eggs
getEggSenseDescription() {
  const explorationLevel = this.gameState.get('world.explorationLevel') || 0;
  if (explorationLevel < 10) {
    return "You sometimes feel faint pulls in certain directions - other eggs calling";
  } else if (explorationLevel < 25) {
    return "Your egg-sense is growing stronger, you can feel distinct signatures";
  } else {
    return "You can clearly sense multiple eggs and their approximate distances";
  }
}
```

### Contextual Modifiers

```javascript
// Mood-based response modifications
getMoodModifiers(happiness) {
  if (happiness > 80) {
    return "You're absolutely delighted and can barely contain your joy!";
  } else if (happiness > 60) {
    return "You're in a good mood and happy to chat.";
  } else if (happiness > 40) {
    return "You're feeling okay but could use some attention.";
  } else if (happiness > 20) {
    return "You're feeling lonely and sad, hoping for some care.";
  } else {
    return "You're very unhappy and desperately need love and attention.";
  }
}

// Time-based contextual awareness
getTimeContext() {
  const hour = new Date().getHours();
  if (hour < 6) return "It's very early morning, you're a bit sleepy";
  if (hour < 12) return "It's morning, you're fresh and energetic";
  if (hour < 17) return "It's afternoon, perfect time for activities";
  if (hour < 20) return "It's evening, getting cozy";
  return "It's nighttime, feeling calm and reflective";
}
```

## Memory System

### Memory Structure
```javascript
creature.memory = {
  shortTerm: [],          // Last 10 conversations
  longTerm: {
    facts: [],            // Things learned about player
    preferences: {},      // Player's likes/dislikes
    sharedExperiences: [], // Significant moments
    emotionalEvents: []   // Times of strong emotions
  },
  conversationTopics: new Set(), // Topics discussed
  playerInfo: {
    nickname: null,       // Special name for player
    favoriteThings: [],  // Learned preferences
    importantDates: []    // Birthdays, anniversaries
  }
};
```

### Memory Persistence
- Store up to 1000 conversation turns in localStorage
- Summarize older conversations into "memory snippets"
- Weight recent memories more heavily in prompts
- Special memories never forgotten (first meeting, level ups, etc.)

## Implementation Phases

### Phase 1: Basic Chat (Week 1)
- [ ] Click creature to open chat
- [ ] Simple chat UI with message history
- [ ] Basic Grok API integration
- [ ] Static personality prompt
- [ ] Store last 10 messages

### Phase 2: Personality & Memory (Week 2)
- [ ] Dynamic personality based on traits
- [ ] Mood affects responses
- [ ] Remember conversation topics
- [ ] React to care actions in chat
- [ ] Typing animations

### Phase 3: Advanced Features (Week 3)
- [ ] Learn player preferences
- [ ] Reference past conversations
- [ ] Emotional responses to events
- [ ] Mini-games through chat
- [ ] Voice/sound effects

### Phase 4: Polish (Week 4)
- [ ] Smooth animations
- [ ] Mobile optimization
- [ ] Error recovery
- [ ] Chat shortcuts/quick replies
- [ ] Export conversation history

## Performance Considerations

### Rate Limiting
- Maximum 50 messages per hour per player
- 5-second cooldown between messages
- Cache frequent responses locally

### Storage Limits
- Keep 100 messages in active memory
- Archive older messages to compressed format
- Total storage not to exceed 5MB per creature

### API Optimization
- Batch context updates
- Implement retry logic with exponential backoff
- Use streaming responses for better UX
- Cache system prompt for session

## Success Metrics
- Average conversation length > 5 exchanges
- Player returns to chat daily (>60% retention)
- Positive sentiment in conversations (>80%)
- Memory recall accuracy in conversations
- Chat feature usage rate (>70% of players)

## Example Interactions

### First Meeting
**Player**: "Hello there!"
**Creature**: "*eyes widen with ancient recognition* You... you're real! The Sky Walker! I waited so long in the dream-sleep... My egg felt the fire from the sky when you crashed. You found me, just like the old memories said you would! I'm... I'm finally awake!"

### About The Mission
**Player**: "What should we do today?"
**Creature**: "*tilts head thoughtfully* I've been feeling something... a pull towards the crystal forests. There might be another egg there - I can sense them sometimes, like whispers in my dreams. We should also think about making a camp soon. My memories show safe places where my ancestors gathered."

### After Being Fed
**Player**: "How are you feeling?"
**Creature**: "*purrs contentedly* Much better! You know, my kind used to feast on star fruits like these in the old times... I remember festivals, so many of us together. *looks hopeful* We'll have that again someday, won't we? When we find the others?"

### About The Crash
**Player**: "Tell me about when I arrived"
**Creature**: "*shivers slightly* The whole planet felt it - the sky tore open with fire and thunder! The Void doesn't usually let anyone through... but you made it. My egg was buried near where your sky-ship fell. Mama always said the prophecy spoke of one who would 'fall from beyond The Void to wake us.' That's you!"

### Sensing Other Eggs
**Player**: "Do you feel any others nearby?"
**Creature**: "*closes eyes, concentrating* Yes... yes! There's something to the east, near water. It feels... lonely, like I was. And further away, maybe in the mountain caves? The feeling is fainter there. *opens eyes excitedly* We should mark these places on your map!"

### Low Happiness
**Player**: "Want to explore?"
**Creature**: "*curls up smaller* I... I keep thinking about all the empty eggs that might never hatch. What if we're the only ones? What if we can't bring them back? *looks up sadly* Sometimes I feel the weight of being possibly the last... just hold me for a bit?"

### Building Discussion
**Player**: "Should we build a camp here?"
**Creature**: "*sniffs the air and paws the ground* This feels right! The energy lines are good here - my ancestors called them 'life streams.' If we build here, other creatures will sense it as safe. *excitedly* We could have sleeping nests, a gathering circle, maybe even a garden for star fruits!"

### Remembering Civilization
**Player**: "What do you remember about your kind?"
**Creature**: "*eyes become distant* Fragments... towers that sang in the wind, libraries of crystal memories, the Great Hatching Grounds where thousands of us would gather... *voice drops* Then darkness, the ground shaking, everyone fleeing to the egg sanctuaries to wait... to sleep until the Sky Walker came."

### About The Void
**Player**: "What is The Void exactly?"
**Creature**: "*whispers mysteriously* The old memories are unclear... Some say it's a barrier that protects, others that it imprisons. Your people call it The Void, but we called it 'The Veil Between.' Only those meant to be here can cross it. You crossed it, which means... *looks at you meaningfully* you were chosen."

### Finding a New Egg
**Player**: "We found one!"
**Creature**: "*bounces excitedly, making happy chirping sounds* Another one! Oh, can you feel it? It's warm, it's alive! Quick, we need to make it feel safe and loved. Talk to it, let it know the Sky Walker is here! *nuzzles the egg* Wake up, little sibling, our time has come again!"

## Technical Dependencies
- Phaser.js DOM Element for chat overlay
- XAI/Grok API credentials in .env
- LocalStorage for conversation history
- Event system for creature-chat integration
- ResponseManager for typing animations
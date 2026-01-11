# Creature Multi-Agent System Design

## Vision
Each creature operates as an autonomous AI agent that can interact with other creatures,
perform tasks, and develop relationships - even while the player is offline.

## Core Architecture

### 1. Creature Agent State
Each creature maintains its own agent state:

```javascript
{
  id: "creature_xxx",
  name: "Starglow",

  // Agent Core
  agent: {
    personality: "curious",      // curious, playful, gentle, wise, energetic
    mood: "happy",               // happy, content, bored, lonely, excited
    energy: 85,                  // 0-100, affects activity level
    socialNeed: 60,              // 0-100, how much they want interaction

    // Memory of other creatures
    relationships: {
      "creature_yyy": {
        familiarity: 75,         // 0-100, how well they know each other
        affection: 60,           // -100 to 100, how they feel
        lastInteraction: 1704825600000,
        interactionCount: 42,
        sharedActivities: ["played", "explored", "rested_together"]
      }
    },

    // Current activity
    currentActivity: {
      type: "exploring",         // idle, sleeping, playing, exploring, socializing, working
      startTime: 1704825600000,
      targetLocation: { x: 200, y: 150 },
      partner: "creature_yyy"    // If doing activity with another creature
    },

    // Task queue
    taskQueue: [
      { type: "gather", resource: "stardust", priority: 1 },
      { type: "visit", target: "creature_yyy", priority: 2 }
    ]
  }
}
```

### 2. Interaction Types

#### Social Interactions
| Interaction | Effect | Requirements |
|-------------|--------|--------------|
| **Play Together** | +happiness, +familiarity, -energy | Both have energy > 30 |
| **Rest Together** | +energy, +affection | Both tired (energy < 40) |
| **Share Food** | +affection, trust building | One has food item |
| **Teach Skill** | Younger learns from Elder | Elder stage + skill |
| **Comfort** | Reduces sadness | One sad, other gentle/wise |
| **Compete** | +excitement, determines hierarchy | Both playful/energetic |

#### Solo Activities
- **Explore** - Discover items, increase experience
- **Forage** - Gather resources (stardust, cosmic crystals)
- **Practice** - Improve skills
- **Rest** - Recover energy
- **Play Solo** - Maintain happiness when alone

#### Group Activities
- **Form Party** - Creatures can form groups for activities
- **Guard Nest** - Protect younger creatures
- **Build** - Construct items/decorations together

### 3. Offline Simulation System

When player returns after being away:

```javascript
class OfflineSimulator {

  simulate(creatures, offlineMinutes) {
    const events = [];
    const timeSlots = Math.floor(offlineMinutes / 15); // 15-min chunks

    for (let slot = 0; slot < timeSlots; slot++) {
      // Each creature decides action
      creatures.forEach(creature => {
        const action = this.decideAction(creature, creatures, slot);
        const result = this.executeAction(creature, action, creatures);

        if (result.notable) {
          events.push({
            time: slot * 15,
            creature: creature.id,
            action: action.type,
            result: result.summary
          });
        }

        // Update creature state
        this.updateCreatureState(creature, result);
      });

      // Check for interactions between creatures
      this.resolveInteractions(creatures, events, slot);
    }

    return events;
  }

  decideAction(creature, allCreatures, timeSlot) {
    const personality = creature.agent.personality;
    const mood = creature.agent.mood;
    const energy = creature.agent.energy;
    const socialNeed = creature.agent.socialNeed;

    // Decision tree based on needs
    if (energy < 20) return { type: 'sleep' };
    if (socialNeed > 80 && this.hasAvailableCompanion(creature, allCreatures)) {
      return { type: 'socialize', target: this.findBestCompanion(creature, allCreatures) };
    }

    // Personality-driven decisions
    switch (personality) {
      case 'curious':
        return Math.random() > 0.3 ? { type: 'explore' } : { type: 'play' };
      case 'playful':
        return { type: 'play', preferGroup: true };
      case 'gentle':
        return socialNeed > 50 ? { type: 'comfort_others' } : { type: 'rest' };
      case 'wise':
        return { type: 'teach', target: this.findYoungest(allCreatures) };
      case 'energetic':
        return { type: 'explore', intensity: 'high' };
      default:
        return { type: 'idle' };
    }
  }
}
```

### 4. Welcome Back Summary

When player returns, show engaging summary:

```
╔════════════════════════════════════════╗
║     Welcome Back! While you were       ║
║     away, your creatures were busy!    ║
╠════════════════════════════════════════╣
║                                        ║
║  ⭐ Starglow explored the Nebula       ║
║     and found 3 Cosmic Crystals!       ║
║                                        ║
║  💕 Moonglow & Starglow played         ║
║     together for 2 hours               ║
║     (friendship +15!)                  ║
║                                        ║
║  🎓 Elder Voidwing taught Starglow     ║
║     the "Cosmic Dash" ability!         ║
║                                        ║
║  😴 Novaheart took a long nap          ║
║     and fully recovered energy         ║
║                                        ║
╚════════════════════════════════════════╝
         [See Details]  [Continue]
```

### 5. Real-Time Creature Interactions (When Online)

When viewing GameScene with multiple creatures:

```javascript
class CreatureInteractionManager {

  update(delta) {
    const activeCreatures = this.getVisibleCreatures();

    activeCreatures.forEach(creature => {
      // Check if creature wants to interact
      if (this.shouldSeekInteraction(creature)) {
        const partner = this.findNearbyCreature(creature, activeCreatures);
        if (partner) {
          this.initiateInteraction(creature, partner);
        }
      }

      // Update ongoing interactions
      if (creature.currentInteraction) {
        this.updateInteraction(creature, delta);
      }

      // Autonomous movement
      this.updateAutonomousMovement(creature, delta);
    });
  }

  initiateInteraction(creature1, creature2) {
    // Determine interaction type based on personalities
    const type = this.determineInteractionType(creature1, creature2);

    // Visual: Creatures move toward each other
    this.moveTowardsEachOther(creature1, creature2);

    // Start interaction animation
    this.playInteractionAnimation(type, creature1, creature2);

    // Show floating text
    this.showInteractionText(type); // "Playing together! 🎮"
  }

  playInteractionAnimation(type, c1, c2) {
    switch (type) {
      case 'play':
        // Both creatures bounce excitedly
        this.bounceAnimation(c1);
        this.bounceAnimation(c2);
        // Show sparkles between them
        this.showSparkles(c1, c2);
        break;

      case 'rest_together':
        // Both creatures settle down
        this.sleepAnimation(c1);
        this.sleepAnimation(c2);
        // Show z's
        this.showSleepBubbles(c1, c2);
        break;

      case 'teach':
        // Elder glows, younger watches attentively
        this.teachAnimation(c1, c2);
        break;
    }
  }
}
```

### 6. Task System

Creatures can be assigned tasks or choose their own:

```javascript
const CREATURE_TASKS = {
  gather: {
    name: "Gather Resources",
    description: "Collect stardust and crystals",
    duration: 30, // minutes
    energyCost: 20,
    rewards: ["stardust", "cosmic_crystal"],
    personalityBonus: { curious: 1.5, energetic: 1.3 }
  },

  guard: {
    name: "Guard the Nest",
    description: "Protect younger creatures",
    duration: 60,
    energyCost: 15,
    effect: "Baby creatures gain 20% more happiness",
    personalityBonus: { wise: 1.5, gentle: 1.3 }
  },

  explore: {
    name: "Explore New Areas",
    description: "Discover new locations and items",
    duration: 45,
    energyCost: 30,
    rewards: ["rare_items", "experience", "unlock_areas"],
    personalityBonus: { curious: 2.0, energetic: 1.5 }
  },

  bond: {
    name: "Bond with Partner",
    description: "Spend quality time with another creature",
    duration: 20,
    energyCost: 10,
    effect: "Relationship +25 with target",
    requires: "partner_selection",
    personalityBonus: { playful: 1.5, gentle: 1.3 }
  }
};
```

### 7. Relationship Development

Creatures form unique relationships over time:

```
Familiarity Levels:
0-20:   Strangers      - Basic awareness
21-40:  Acquaintances  - Remember each other
41-60:  Friends        - Seek each other out
61-80:  Close Friends  - Special interactions unlocked
81-100: Best Friends   - Unique bond effects

Affection Types:
- Friendship: Mutual enjoyment, play together
- Mentorship: Elder teaches younger
- Rivalry: Compete, push each other
- Protective: One guards/cares for other
- Siblings: Offspring from same parents
```

### 8. Implementation Phases

#### Phase 1: Foundation (Current Sprint)
- [ ] Add agent state to creature data structure
- [ ] Implement basic offline time calculation
- [ ] Create simple activity selection logic
- [ ] "Welcome back" summary screen

#### Phase 2: Social Interactions
- [ ] Relationship tracking between creatures
- [ ] Interaction animations (play, rest, teach)
- [ ] Floating interaction indicators
- [ ] Social need mechanics

#### Phase 3: Tasks & Activities
- [ ] Task assignment UI
- [ ] Task completion rewards
- [ ] Personality-based task bonuses
- [ ] Group task support

#### Phase 4: Advanced AI
- [ ] Complex decision trees
- [ ] Memory of past interactions
- [ ] Preference learning
- [ ] Emergent group behaviors

### 9. Data Structure Updates

```javascript
// GameState additions
{
  creatures: {
    collection: [...],

    // New: Global interaction state
    interactions: {
      lastSimulationTime: timestamp,
      pendingEvents: [],
      globalRelationships: {
        // Tracks all creature-to-creature relationships
        "creature_a_creature_b": { familiarity: 50, affection: 30 }
      }
    }
  }
}
```

### 10. Visual Indicators

When creatures interact in real-time:
- **Heart bubbles** - When showing affection
- **Music notes** - When playing together
- **Zzz bubbles** - When resting together
- **Star burst** - When teaching/learning
- **Exclamation** - When excited to see friend
- **Connection line** - Subtle glow between bonded creatures

---

## Benefits

1. **Emotional Investment** - Players care more when creatures have relationships
2. **Offline Engagement** - Game feels alive even when not playing
3. **Emergent Storytelling** - Unique stories develop between creatures
4. **Breeding Motivation** - Create offspring to expand the family
5. **Long-term Retention** - Players return to see what happened
6. **Differentiation** - Unique feature among creature games

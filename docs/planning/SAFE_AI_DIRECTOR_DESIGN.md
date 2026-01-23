# Safe AI Director System Design

## 1. CODEBASE ANALYSIS

### 1.1 Current Personality System

**File:** [PersonalitySystem.js](../../src/systems/PersonalitySystem.js)

**Architecture:** Uses a 4-axis personality model with continuous values (-100 to +100):

| Axis | Range | Labels |
|------|-------|--------|
| **Temperament** | -100 to +100 | Calm ↔ Excitable |
| **Energy** | -100 to +100 | Relaxed ↔ Energetic |
| **Curiosity** | -100 to +100 | Cautious ↔ Curious |
| **Attachment** | -100 to +100 | Independent ↔ Affectionate |

**Behavior Influence:**
- Values map to discrete labels (e.g., -100 to -33 = "low", -33 to 33 = "medium", 33 to 100 = "high")
- Care preferences scale based on personality (0.6x to 1.3x multiplier)
- Personality shifts over time based on player interactions

**Core Personality Types (from genetics):**
- `curious` - Loves exploration, discovery activities
- `playful` - Energetic, enjoys play interactions
- `gentle` - Calm, appreciates rest and affection
- `wise` - Thoughtful, values rest and teaching
- `energetic` - High activity, exploration-focused

**Quirks System:** Creatures can have unique behavioral quirks:
- `head_tilter`, `star_gazer`, `bounce_dancer`, `soft_hummer`, `constellation_reader`

---

### 1.2 Creature State Tracking (GameState.js)

**File:** [GameState.js](../../src/systems/GameState.js)

**Tracked Data:**

```
creature:
├── name                  # Creature name
├── hatched               # Boolean
├── named                 # Boolean
├── genes                 # Full genetic profile
├── dna                   # Encoded DNA string
├── personality           # Personality state object
├── personalityState      # Current personality values
├── textureName           # Visual texture reference
├── stats:
│   ├── happiness         # 0-100
│   ├── energy            # 0-100
│   └── health            # 0-100
├── level                 # Current level
├── experience            # XP accumulated
├── lifecycle:
│   ├── birthDate         # Timestamp
│   ├── stage             # baby/juvenile/adult/elder
│   ├── isStuck           # Evolution blocked
│   └── warnings          # Departure warnings shown
├── mood:
│   ├── current           # happy/neutral/sad/abandoned
│   └── lastUpdate        # Timestamp
├── care:
│   ├── dailyCare         # Daily action counts
│   ├── careStreak        # Consecutive days
│   └── lastCareTime      # Timestamp
└── agent:                # Agent state (if initialized)
    ├── personality       # Agent personality type
    ├── mood              # Agent mood
    ├── energy            # Agent energy
    ├── socialNeed        # Social interaction need
    ├── relationships     # Relations with other creatures
    ├── currentActivity   # What creature is doing
    ├── taskQueue         # Pending tasks
    └── memories          # Short-term memories
```

**Event System Pattern:**
- `GameState.on(event, callback)` - Listen to events
- `GameState.emit(event, data)` - Emit events
- `GameState.set(path, value)` - Triggers `changed:path` event

**Key Events:**
- `careActionPerformed` - Player performed care action
- `changed:creature.stats.happiness` - Stat changed
- `memory/entry_added` - Memory logged
- `ai/controller_initialized` - AI system ready

---

### 1.3 Safety Infrastructure

**SafetyManager.js** provides:
- **Kid Profiles:** Age-appropriate content flags, restrictions
- **Guardian PIN:** 4-digit parental control PIN
- **Audit Logging:** Tracks sensitive operations
- **Session Safety:** Monitors for inappropriate interactions

**KidMode.js** provides:
- **Space-themed UI:** Child-friendly visual language
- **Contextual Guidance:** Next-best-action suggestions based on creature state
- **Emotion-based Actions:** Maps creature emotions to care suggestions
- **Genetics-based Personalization:** Actions tailored to creature personality

**CreatureAIController.js** (KEY SAFETY LAYER):
```javascript
// Allowed topics whitelist
ALLOWED_TOPICS = {
    FEELINGS: ['happy', 'sleepy', 'nervous', 'curious', ...],
    GAME_ELEMENTS: ['flowers', 'coins', 'wisps', 'enemies', ...],
    CARE_ACTIONS: ['feed', 'play', 'rest', 'pet', ...],
    ACTIVITIES: ['explore', 'adventure', 'rest', ...]
};

// Disallowed patterns (regex blocklist)
DISALLOWED_PATTERNS = {
    ADULT_TOPICS: /\b(sex|romantic|...|politics|religion)\b/i,
    PERSONAL_INFO: /\b(password|address|phone|...)\b/i,
    EXTERNAL_REFS: /\b(youtube|tiktok|...)\b/i,
    NEGATIVE: /\b(hate|stupid|...|threat)\b/i,
    BRANDS: /\b(nike|disney|...)\b/i,
    PRETENDING: /\b(i am a real|i'm human|...)\b/i
};
```

**Safety Filter Chain:**
1. Input sanitization (whitelist emotions, triggers)
2. Context sanitization (limit events, filter types)
3. LLM system prompt with strict rules
4. Output safety filter (regex blocklist)
5. Length limits, URL/email removal
6. Violation logging

---

### 1.4 Offline/Time Systems

**CreatureLifecycle.js** handles:
- **Days Alive Calculation:** `getDaysAlive(birthDate)`
- **Stage Progression:** baby (0-3 days) → juvenile (3-7) → adult (7-30) → elder (30+)
- **Abandonment Detection:** Triggers after configurable days offline
- **Happiness Decay:** Drops per day of absence
- **Evolution Blocking:** Low happiness/bad mood blocks evolution

**CreatureAgent.js** handles offline simulation:
```javascript
simulateOfflineActivities(offlineMinutes) {
    // Simulates in 15-minute slots
    // Max 96 slots (24 hours simulated)
    // Generates events: discoveries, bonding, rest
    // Updates creature stats based on personality-weighted decisions
}
```

**Offline Activity Types:**
- `idle`, `sleeping`, `playing`, `exploring`, `socializing`, `resting`, `foraging`

**Notable Events Generated:**
- "Found Cosmic Crystal!" (exploring)
- "Bonded with [creature]" (socializing)
- "Had a great time playing!" (playing)

---

### 1.5 Event System Patterns

**Central Event Bus:** `window.GameState` serves as event hub

**Pattern Examples:**
```javascript
// Listening
window.GameState.on('careActionPerformed', (data) => {
    // React to care action
});

// Emitting
window.GameState.emit('memory/entry_added', { entry });

// State change events (auto-generated)
window.GameState.set('creature.stats.happiness', 85);
// Auto-emits: 'changed:creature.stats.happiness'
```

**Existing Event Categories:**
- `care/*` - Care system events
- `memory/*` - Memory system events
- `ai/*` - AI controller events
- `ui/*` - UI/KidMode events
- `longTermMemory/*` - Long-term memory events

---

## 2. ARCHITECTURE DESIGN

### 2.1 Safe AI Director - Core Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      SAFE AI DIRECTOR                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   PERCEPTION    │───▶│    DECISION     │───▶│   EXECUTION  │ │
│  │     LAYER       │    │     ENGINE      │    │    LAYER     │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│         │                       │                      │         │
│         ▼                       ▼                      ▼         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ CreatureState   │    │ BehaviorLibrary │    │ ActionQueue  │ │
│  │ PlayerContext   │    │ (Pre-defined)   │    │ EventEmitter │ │
│  │ EnvironmentData │    │ WeightedScoring │    │ StateUpdater │ │
│  │ TimeContext     │    │ SafetyValidator │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                      SAFETY BOUNDARY                             │
│  • AI outputs ONLY behavior IDs (never raw text)                │
│  • All behaviors pre-defined and approved                       │
│  • Fallback to deterministic if AI fails                        │
│  • Graceful degradation at every level                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Behavior Decision Engine

**Input Sources (Perception Layer):**
```javascript
const context = {
    creature: {
        personality: 'curious',           // From genetics
        mood: 'happy',                    // Current mood
        stats: { happiness: 85, energy: 60, health: 100 },
        stage: 'juvenile',                // Lifecycle stage
        carePreferences: { play: 1.3, feed: 0.9 },
        quirks: ['head_tilter', 'star_gazer']
    },
    player: {
        lastActive: 1705900000000,        // Timestamp
        careStreak: 5,                    // Days
        preferredActions: ['play', 'pet'],// Historical
        sessionDuration: 300              // Seconds
    },
    environment: {
        biome: 'crystal_gardens',         // Current biome
        timeOfDay: 'evening',             // Real-world
        weather: 'clear',                 // If applicable
        nearbyObjects: ['flower', 'crystal']
    },
    game: {
        questsAvailable: ['explore_gardens', 'find_crystal'],
        recentEvents: ['coin_collected', 'enemy_defeated'],
        progressionState: { level: 5, unlockedBiomes: 3 }
    }
};
```

**Behavior Library (Pre-defined Safe Behaviors):**
```javascript
const BEHAVIOR_LIBRARY = {
    // Movement behaviors
    IDLE_BOUNCE: { id: 'idle_bounce', category: 'idle', energy: 0 },
    IDLE_LOOK_AROUND: { id: 'idle_look_around', category: 'idle', energy: 0 },
    WANDER_NEARBY: { id: 'wander_nearby', category: 'movement', energy: 5 },
    APPROACH_PLAYER: { id: 'approach_player', category: 'social', energy: 3 },
    APPROACH_OBJECT: { id: 'approach_object', category: 'curiosity', energy: 5 },

    // Emotional behaviors
    HAPPY_DANCE: { id: 'happy_dance', category: 'emotion', energy: 10, requires: { mood: ['happy', 'ecstatic'] } },
    SLEEPY_YAWN: { id: 'sleepy_yawn', category: 'emotion', energy: 0, requires: { stats: { energy: '<30' } } },
    EXCITED_JUMP: { id: 'excited_jump', category: 'emotion', energy: 8, requires: { mood: ['ecstatic'] } },

    // Interactive behaviors
    REQUEST_ATTENTION: { id: 'request_attention', category: 'social', energy: 5 },
    SHOW_DISCOVERY: { id: 'show_discovery', category: 'curiosity', energy: 3 },
    PLAY_WITH_OBJECT: { id: 'play_with_object', category: 'play', energy: 15 },

    // Personality-specific behaviors
    TILT_HEAD_CURIOUS: { id: 'tilt_head', category: 'quirk', personality: 'curious' },
    STARGAZE: { id: 'stargaze', category: 'quirk', quirk: 'star_gazer', timeOfDay: ['evening', 'night'] },

    // Care response behaviors
    REACT_TO_FEED: { id: 'react_feed', category: 'care_response', trigger: 'feed' },
    REACT_TO_PLAY: { id: 'react_play', category: 'care_response', trigger: 'play' },
    REACT_TO_PET: { id: 'react_pet', category: 'care_response', trigger: 'pet' },
};
```

**Decision Algorithm (Weighted Scoring):**
```javascript
function selectBehavior(context, behaviors) {
    const candidates = behaviors.filter(b => meetsRequirements(b, context));

    const scored = candidates.map(behavior => {
        let score = behavior.baseWeight || 1.0;

        // Personality alignment bonus
        score *= getPersonalityBonus(behavior, context.creature.personality);

        // Mood alignment bonus
        score *= getMoodBonus(behavior, context.creature.mood);

        // Time-of-day bonus
        score *= getTimeBonus(behavior, context.environment.timeOfDay);

        // Recent action penalty (avoid repetition)
        score *= getRepetitionPenalty(behavior, context.recentBehaviors);

        // Energy cost consideration
        score *= getEnergyCostFactor(behavior, context.creature.stats.energy);

        // Random variance (±10%)
        score *= 0.9 + Math.random() * 0.2;

        return { behavior, score };
    });

    // Weighted random selection from top candidates
    return weightedRandomSelect(scored.sort((a, b) => b.score - a.score).slice(0, 5));
}
```

---

### 2.3 Memory & Relationship System

**Memory Types:**

| Type | Duration | Purpose | Storage |
|------|----------|---------|---------|
| **Immediate** | Session | Current interaction context | RAM only |
| **Short-term** | 24 hours | Recent events, behaviors | CreatureMemory |
| **Long-term** | Permanent | Key milestones, relationships | LongTermMemory |
| **Episodic** | Permanent | Story-worthy moments | Timeline diary |

**Memorable Events (Auto-logged):**
```javascript
const MEMORABLE_EVENTS = {
    // Milestones
    'first_feed': { importance: 'high', message: 'First time being fed!' },
    'first_play': { importance: 'high', message: 'First playtime together!' },
    'evolution': { importance: 'critical', message: 'Evolved to {stage}!' },
    'birthday': { importance: 'high', message: 'Birthday celebration!' },

    // Discoveries
    'rare_item_found': { importance: 'medium', message: 'Found a rare {item}!' },
    'new_biome_visited': { importance: 'medium', message: 'Explored {biome} for the first time!' },
    'secret_discovered': { importance: 'high', message: 'Discovered a secret!' },

    // Social
    'made_friend': { importance: 'high', message: 'Made a new friend: {creature}' },
    'best_friend_milestone': { importance: 'critical', message: 'Became best friends with {creature}!' },

    // Emotional
    'very_happy_day': { importance: 'low', message: 'Had a wonderful day!' },
    'recovered_from_sadness': { importance: 'medium', message: 'Feeling better after being sad' },
};
```

**Relationship Evolution:**
```javascript
const RELATIONSHIP_LEVELS = {
    STRANGERS: { min: 0, max: 20, description: 'Just met' },
    ACQUAINTANCE: { min: 21, max: 40, description: 'Getting to know each other' },
    FRIEND: { min: 41, max: 60, description: 'Good friends' },
    CLOSE_FRIEND: { min: 61, max: 80, description: 'Close companions' },
    BEST_FRIEND: { min: 81, max: 100, description: 'Inseparable bond' }
};

// Trust changes based on interactions
const TRUST_MODIFIERS = {
    positive_care: +3,          // Feed, play, pet
    consistent_care: +5,        // Daily care streak
    return_after_absence: -10,  // Per day offline (recoverable)
    recovery_care: +8,          // Care after absence (bonus)
    quest_completion: +5,       // Completed together
    negative_event: -5          // Creature got hurt, etc.
};
```

---

### 2.4 Offline Life Simulation

**Simulation Rules:**
```javascript
const OFFLINE_SIMULATION = {
    maxSimulatedHours: 24,        // Cap at 24 hours
    timeSlotMinutes: 15,          // Granularity
    activityDistribution: {
        sleeping: 0.35,           // ~8 hours of day
        exploring: 0.20,          // ~5 hours
        playing: 0.15,            // ~3.5 hours
        socializing: 0.10,        // ~2.5 hours (if companions)
        resting: 0.10,            // ~2.5 hours
        idle: 0.10                // ~2.5 hours
    },

    // Evidence generation
    evidenceTypes: {
        MOVED_OBJECTS: { chance: 0.3, activities: ['exploring', 'playing'] },
        DISCOVERED_ITEMS: { chance: 0.1, activities: ['exploring'] },
        MADE_SOMETHING: { chance: 0.05, activities: ['playing', 'idle'] },
        LEFT_FOOTPRINTS: { chance: 0.4, activities: ['exploring'] },
        SLEPT_SOMEWHERE: { chance: 0.6, activities: ['sleeping'] }
    }
};
```

**Evidence Examples (Pre-defined):**
```javascript
const EVIDENCE_LIBRARY = {
    // Things creature "collected"
    collections: [
        { id: 'shiny_pebbles', description: 'A small pile of shiny pebbles', personality: 'curious' },
        { id: 'flower_arrangement', description: 'A pretty arrangement of flowers', personality: 'gentle' },
        { id: 'stick_collection', description: 'Some interesting sticks', personality: 'playful' }
    ],

    // Places creature "explored"
    explorations: [
        { id: 'footprints_garden', description: 'Tiny footprints around the garden', area: 'garden' },
        { id: 'nest_impression', description: 'A cozy spot where someone napped', area: 'any' }
    ],

    // Things creature "made"
    creations: [
        { id: 'tiny_sculpture', description: 'A tiny sculpture made of stardust', rare: true },
        { id: 'leaf_nest', description: 'A comfy nest of soft leaves' }
    ]
};
```

**Return Story Generation:**
```javascript
function generateReturnStory(offlineEvents, creatureState) {
    // Select 2-3 highlights from offline events
    const highlights = selectNotableEvents(offlineEvents, 3);

    // Build narrative from pre-defined templates
    const templates = {
        long_absence: "While you were away for {days} days, {creature} {activities}.",
        short_absence: "{creature} had a {mood} time! They {activities}.",
        discovery: "{creature} found something interesting: {item}!",
        social: "{creature} spent time with {friends}."
    };

    // Return structured story data (NOT raw AI text)
    return {
        summary: templates[getTemplate(highlights)],
        events: highlights.map(e => ({
            icon: e.icon,
            text: EVIDENCE_LIBRARY[e.type].description,
            timestamp: e.time
        })),
        moodResult: creatureState.mood,
        statsChanges: calculateOfflineChanges(offlineEvents)
    };
}
```

---

### 2.5 Dynamic Game Master

**Quest Selection Logic:**
```javascript
const QUEST_WEIGHTS = {
    // Base weights by quest type
    exploration: 1.0,
    collection: 0.8,
    social: 0.7,
    care: 0.6,
    combat: 0.5,

    // Modifiers
    modifiers: {
        personality_match: 1.5,      // Quest matches creature personality
        low_completion_rate: 1.3,    // Player hasn't done this type
        streak_bonus: 1.2,           // Player on a streak
        time_appropriate: 1.2,       // Evening = rest quests
        difficulty_appropriate: 1.4  // Matches player skill
    }
};

function selectQuest(context, availableQuests) {
    return availableQuests
        .map(quest => ({
            quest,
            score: calculateQuestScore(quest, context, QUEST_WEIGHTS)
        }))
        .sort((a, b) => b.score - a.score)[0].quest;
}
```

**Difficulty Adjustment (Invisible):**
```javascript
const DIFFICULTY_FACTORS = {
    // Decrease difficulty when:
    consecutive_deaths: { threshold: 3, adjustment: -0.1 },
    low_completion: { threshold: 0.3, adjustment: -0.15 },
    low_engagement: { threshold: 300, adjustment: -0.1 }, // Seconds per session

    // Increase difficulty when:
    high_completion: { threshold: 0.9, adjustment: +0.1 },
    no_damage_taken: { threshold: 5, adjustment: +0.1 }, // Levels
    speed_completion: { threshold: 0.5, adjustment: +0.1 } // Under expected time
};

function adjustDifficulty(baseDifficulty, playerMetrics) {
    let modifier = 0;

    // Apply all relevant factors
    Object.entries(DIFFICULTY_FACTORS).forEach(([factor, config]) => {
        if (meetsThreshold(playerMetrics[factor], config.threshold)) {
            modifier += config.adjustment;
        }
    });

    // Clamp to reasonable range
    return Math.max(0.5, Math.min(1.5, baseDifficulty + modifier));
}
```

**Reward Placement:**
```javascript
const REWARD_PLACEMENT = {
    // Pity system for rare items
    pityCounter: {
        maxMisses: 50,
        guaranteeAt: 45,
        softPityAt: 30
    },

    // Strategic placement rules
    rules: [
        { condition: 'low_health', reward: 'health_pickup', chance: 0.3 },
        { condition: 'before_boss', reward: 'buff_item', chance: 0.5 },
        { condition: 'after_failure', reward: 'easy_collectible', chance: 0.6 },
        { condition: 'exploration_reward', reward: 'discovery', chance: 0.2 }
    ]
};
```

---

## 3. IMPLEMENTATION PLAN

### Phase A: No AI (Pure Algorithmic) - 2-3 Weeks Equivalent Work

**Goal:** Make creatures feel alive without any AI/ML

**Changes:**

1. **Enhanced Behavior State Machine** (`src/systems/CreatureBehaviorEngine.js`)
   - Weighted random behavior selection
   - Personality-based probability adjustments
   - Time-of-day behavior variations
   - Cooldowns and repetition prevention

2. **Daily Routine System** (`src/systems/DailyRoutineManager.js`)
   - Define hourly activity schedules per personality
   - Real-world time integration
   - Smooth transitions between activities
   - Visual/audio cues for each routine phase

3. **Reaction System Enhancement** (`src/systems/ReactionLibrary.js`)
   - Pre-defined reactions for all triggers
   - Personality-variant reactions
   - Animation + sound + particle combinations
   - Contextual reaction selection

4. **Offline Evidence System** (`src/systems/OfflineEvidenceManager.js`)
   - Pre-defined evidence objects
   - Personality-weighted selection
   - Placement in game world
   - Discovery mechanics

**Files to Modify:**
- `src/systems/CreatureAgent.js` - Extend with behavior engine
- `src/systems/CareSystem.js` - Add reaction triggers
- `src/scenes/GameScene.js` - Daily routine integration
- `src/systems/FXLibrary.js` - New visual effects for behaviors

**New Files:**
- `src/systems/CreatureBehaviorEngine.js`
- `src/systems/DailyRoutineManager.js`
- `src/systems/ReactionLibrary.js`
- `src/systems/OfflineEvidenceManager.js`
- `src/config/daily-routines.json`
- `src/config/behavior-library.json`
- `src/config/reaction-library.json`

---

### Phase B: Local AI Processing - 1-2 Weeks Equivalent Work

**Goal:** Simple ML/decision trees running in browser

**Changes:**

1. **Weighted Decision Tree** (`src/systems/AIDecisionTree.js`)
   - Configurable decision nodes
   - Context-aware path selection
   - Fallback to Phase A if tree fails

2. **Simple Behavior Prediction** (`src/systems/BehaviorPredictor.js`)
   - Track player preferences
   - Predict next likely care action
   - Suggest optimal timing for interactions

3. **Mood Prediction Model** (`src/systems/MoodPredictor.js`)
   - Simple regression on stat trends
   - Early warning for mood drops
   - Proactive happiness maintenance suggestions

**Files to Modify:**
- `src/systems/CreatureBehaviorEngine.js` - Integrate decision tree
- `src/systems/CareSystem.js` - Prediction integration
- `src/systems/KidMode.js` - Enhanced suggestions

**New Files:**
- `src/systems/AIDecisionTree.js`
- `src/systems/BehaviorPredictor.js`
- `src/systems/MoodPredictor.js`
- `src/config/decision-tree.json`

---

### Phase C: Cloud AI APIs - 1-2 Weeks Equivalent Work

**Goal:** Enhanced intelligence with strict safety

**CRITICAL SAFETY CONSTRAINTS:**
- AI generates ONLY behavior IDs, never text
- All text shown to players is pre-written
- Cloud AI used for decision-making only
- Local fallback always available

**Changes:**

1. **AI Director Service** (`src/systems/AIDirectorService.js`)
   - Anthropic Claude API integration
   - Structured output (JSON schema)
   - Rate limiting and caching
   - Complete fallback to Phase B

2. **Prompt Engineering** (`src/config/ai-prompts.json`)
   - System prompts for behavior selection
   - Context formatting templates
   - Output schema definitions

3. **AI Safety Layer** (`src/systems/AISafetyValidator.js`)
   - Validate AI outputs against behavior library
   - Reject unknown behavior IDs
   - Log anomalies for review
   - Auto-fallback on validation failure

**Example API Request:**
```javascript
// Request to Claude API
const response = await claude.createMessage({
    model: 'claude-haiku',
    max_tokens: 100,
    system: BEHAVIOR_SELECTION_PROMPT,
    messages: [{
        role: 'user',
        content: JSON.stringify({
            creature_state: context.creature,
            environment: context.environment,
            available_behaviors: BEHAVIOR_LIBRARY,
            recent_behaviors: context.recent
        })
    }]
});

// Response (structured JSON only)
{
    "selected_behavior": "IDLE_LOOK_AROUND",
    "confidence": 0.85,
    "reasoning_code": "PERSONALITY_MATCH",
    "fallback_behavior": "IDLE_BOUNCE"
}

// Validate before execution
if (!BEHAVIOR_LIBRARY[response.selected_behavior]) {
    return executeLocalFallback(context);
}
```

**Files to Modify:**
- `src/systems/CreatureBehaviorEngine.js` - AI integration
- `src/systems/CreatureAI.js` - Extend for director role

**New Files:**
- `src/systems/AIDirectorService.js`
- `src/systems/AISafetyValidator.js`
- `src/config/ai-prompts.json`
- `src/config/ai-output-schema.json`

---

## 4. FEATURE SPECIFICATIONS

### Feature 1: Creature Daily Routines

**Schedule Structure:**
```javascript
const DAILY_SCHEDULE = {
    curious: {
        '06:00-08:00': { activity: 'waking', weight: 0.9 },
        '08:00-10:00': { activity: 'exploring', weight: 0.7 },
        '10:00-12:00': { activity: 'playing', weight: 0.6 },
        '12:00-14:00': { activity: 'resting', weight: 0.8 },
        '14:00-16:00': { activity: 'exploring', weight: 0.8 },
        '16:00-18:00': { activity: 'socializing', weight: 0.5 },
        '18:00-20:00': { activity: 'playing', weight: 0.7 },
        '20:00-22:00': { activity: 'winding_down', weight: 0.85 },
        '22:00-06:00': { activity: 'sleeping', weight: 0.95 }
    }
    // Similar for playful, gentle, wise, energetic
};
```

**Activity Behaviors:**
```javascript
const ACTIVITY_BEHAVIORS = {
    waking: {
        behaviors: ['STRETCH', 'YAWN', 'SLOW_BLINK', 'GENTLE_SHAKE'],
        transitions: { to: ['exploring', 'playing'], duration: 300 },
        audio: 'morning_sounds',
        particles: 'sparkle_wake'
    },
    exploring: {
        behaviors: ['WANDER', 'SNIFF_GROUND', 'LOOK_AROUND', 'APPROACH_OBJECT'],
        movement: { range: 200, speed: 0.6 },
        audio: 'curious_hums',
        particles: 'footstep_sparkles'
    },
    // ... etc
};
```

**Implementation in GameScene:**
```javascript
// In GameScene.update()
updateCreatureRoutine(time) {
    const hour = new Date().getHours();
    const personality = this.creature.personality;
    const schedule = DAILY_SCHEDULE[personality];

    const currentSlot = findTimeSlot(hour, schedule);
    const activity = ACTIVITY_BEHAVIORS[currentSlot.activity];

    // Only change if different activity or cooldown expired
    if (this.currentActivity !== currentSlot.activity ||
        time - this.lastActivityChange > ACTIVITY_CHANGE_COOLDOWN) {

        this.transitionToActivity(activity);
    }

    // Execute current activity behavior
    this.executeActivityBehavior(activity, time);
}
```

---

### Feature 2: Reaction Behaviors

**Reaction Library:**
```javascript
const REACTION_LIBRARY = {
    PLAYER_RETURN: {
        happy: {
            animation: 'excited_bounce',
            particles: 'heart_burst',
            sound: 'happy_chirp',
            duration: 2000,
            variants: ['run_to_player', 'happy_dance', 'excited_spin']
        },
        sad: {
            animation: 'slow_approach',
            particles: 'tear_sparkle',
            sound: 'soft_whimper',
            duration: 3000,
            variants: ['cautious_approach', 'hide_peek']
        }
    },

    COIN_NEARBY: {
        curious: {
            animation: 'head_tilt_look',
            particles: 'question_mark',
            sound: 'curious_chirp',
            followUp: 'APPROACH_OBJECT'
        },
        playful: {
            animation: 'excited_point',
            particles: 'sparkle_burst',
            sound: 'excited_bark',
            followUp: 'BOUNCE_TO_OBJECT'
        }
    },

    BIOME_ENTER: {
        crystal_gardens: {
            animation: 'amazed_look',
            particles: 'wonder_sparkles',
            sound: 'awe_sound',
            duration: 3000
        }
    },

    QUEST_COMPLETE: {
        any: {
            animation: 'victory_dance',
            particles: 'confetti_burst',
            sound: 'celebration',
            duration: 4000,
            floatingText: '✨ Great job! ✨'
        }
    },

    DAMAGE_TAKEN: {
        any: {
            animation: 'flinch_shake',
            particles: 'pain_stars',
            sound: 'ow_sound',
            duration: 500,
            followUp: 'scared_hide'
        }
    }
};
```

**Trigger System:**
```javascript
class ReactionTriggerSystem {
    constructor(scene) {
        this.scene = scene;
        this.reactionQueue = [];
        this.currentReaction = null;

        // Register event listeners
        window.GameState.on('player_returned', () => this.queueReaction('PLAYER_RETURN'));
        window.GameState.on('coin_spawned', (coin) => this.queueReaction('COIN_NEARBY', coin));
        window.GameState.on('biome_entered', (biome) => this.queueReaction('BIOME_ENTER', biome));
        window.GameState.on('quest_completed', () => this.queueReaction('QUEST_COMPLETE'));
        window.GameState.on('damage_taken', () => this.queueReaction('DAMAGE_TAKEN'));
    }

    queueReaction(type, context = {}) {
        const creature = this.scene.creature;
        const reaction = this.selectReaction(type, creature, context);

        if (reaction) {
            // Priority queue - some reactions interrupt others
            if (reaction.priority === 'high') {
                this.reactionQueue.unshift(reaction);
            } else {
                this.reactionQueue.push(reaction);
            }
        }
    }

    selectReaction(type, creature, context) {
        const reactionSet = REACTION_LIBRARY[type];
        if (!reactionSet) return null;

        // Check for personality-specific reaction
        const personality = creature.personality;
        if (reactionSet[personality]) {
            return { ...reactionSet[personality], type };
        }

        // Check for mood-specific reaction
        const mood = creature.mood;
        if (reactionSet[mood]) {
            return { ...reactionSet[mood], type };
        }

        // Fall back to 'any' reaction
        if (reactionSet.any) {
            return { ...reactionSet.any, type };
        }

        return null;
    }
}
```

---

### Feature 3: Environmental Storytelling

**Evidence Generation:**
```javascript
function generateOfflineEvidence(offlineEvents, creatureState, gameWorld) {
    const evidence = [];

    offlineEvents.forEach(event => {
        const evidenceType = EVIDENCE_MAPPING[event.action];
        if (!evidenceType || Math.random() > evidenceType.chance) return;

        const item = selectEvidenceItem(evidenceType, creatureState);
        const position = selectEvidencePosition(item, gameWorld);

        evidence.push({
            id: generateId(),
            type: item.id,
            displayName: item.displayName,
            description: item.description,
            position: position,
            discoverable: true,
            linkedEvent: event.id,
            createdAt: event.time
        });
    });

    return evidence;
}

const EVIDENCE_ITEMS = {
    exploration: [
        {
            id: 'pebble_collection',
            displayName: 'Shiny Pebbles',
            description: 'A small pile of pebbles your creature collected',
            visual: 'pebble_pile_sprite',
            interactText: '{creature} found these while exploring!'
        },
        {
            id: 'footprint_trail',
            displayName: 'Tiny Footprints',
            description: 'A trail of small footprints',
            visual: 'footprint_decal',
            interactText: '{creature} was here!'
        }
    ],
    sleeping: [
        {
            id: 'sleep_spot',
            displayName: 'Cozy Nest',
            description: 'A spot where someone took a nap',
            visual: 'leaf_nest_sprite',
            interactText: '{creature} made this comfy spot!'
        }
    ],
    playing: [
        {
            id: 'moved_toy',
            displayName: 'Moved Object',
            description: 'Something was played with here',
            visual: 'scattered_items',
            interactText: '{creature} had fun with this!'
        }
    ]
};
```

**Discovery System:**
```javascript
class EvidenceDiscoverySystem {
    constructor(scene) {
        this.scene = scene;
        this.placedEvidence = [];
    }

    placeEvidence(evidenceList) {
        evidenceList.forEach(evidence => {
            const sprite = this.createEvidenceSprite(evidence);

            // Add discovery interaction
            sprite.setInteractive();
            sprite.on('pointerdown', () => this.discoverEvidence(evidence, sprite));

            // Add visual hint (subtle glow)
            this.addDiscoveryHint(sprite);

            this.placedEvidence.push({ evidence, sprite });
        });
    }

    discoverEvidence(evidence, sprite) {
        // Play discovery animation
        this.scene.tweens.add({
            targets: sprite,
            scale: { from: 1, to: 1.3 },
            alpha: { from: 1, to: 0 },
            duration: 500,
            onComplete: () => sprite.destroy()
        });

        // Show discovery message
        const message = evidence.interactText.replace('{creature}', this.scene.creature.name);
        this.scene.showFloatingText(message, sprite.x, sprite.y - 50, '#FFD700');

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playCoinCollect();
        }

        // Log to memory
        if (window.CreatureMemory?.isTrackingEnabled()) {
            window.CreatureMemory.logEntry({
                type: 'discovery',
                summary: `Discovered evidence: ${evidence.displayName}`,
                tags: ['offline', 'discovery']
            });
        }

        // Mark as discovered
        evidence.discovered = true;
    }
}
```

---

### Feature 4: Adaptive Difficulty

**Metrics Tracking:**
```javascript
const PLAYER_METRICS = {
    // Combat metrics
    deaths_last_10_attempts: 0,
    average_completion_time: 0,
    damage_taken_ratio: 0,

    // Engagement metrics
    average_session_duration: 0,
    care_action_frequency: 0,
    exploration_coverage: 0,

    // Skill indicators
    combo_accuracy: 0,
    dodge_success_rate: 0,
    resource_management: 0
};

function updatePlayerMetrics(event) {
    switch (event.type) {
        case 'death':
            PLAYER_METRICS.deaths_last_10_attempts++;
            // Rolling window
            if (PLAYER_METRICS.deaths_last_10_attempts > 10) {
                // Reduce oldest
            }
            break;
        case 'level_complete':
            PLAYER_METRICS.average_completion_time =
                rollingAverage(PLAYER_METRICS.average_completion_time, event.time);
            break;
        // ... etc
    }
}
```

**Invisible Adjustments:**
```javascript
function applyDifficultyAdjustments(levelConfig, playerMetrics) {
    const adjusted = { ...levelConfig };

    // If struggling (3+ deaths recently)
    if (playerMetrics.deaths_last_10_attempts >= 3) {
        adjusted.enemyHealth *= 0.9;
        adjusted.enemyDamage *= 0.85;
        adjusted.healthPickupFrequency *= 1.3;
        adjusted.checkpointFrequency *= 1.2;
    }

    // If too easy (no deaths, fast completion)
    if (playerMetrics.deaths_last_10_attempts === 0 &&
        playerMetrics.average_completion_time < levelConfig.expectedTime * 0.7) {
        adjusted.enemyHealth *= 1.1;
        adjusted.enemyDamage *= 1.05;
        adjusted.healthPickupFrequency *= 0.9;
    }

    // Never make adjustments too extreme
    Object.keys(adjusted).forEach(key => {
        if (typeof adjusted[key] === 'number') {
            adjusted[key] = clamp(adjusted[key],
                levelConfig[key] * 0.6,  // Min 60% of base
                levelConfig[key] * 1.4   // Max 140% of base
            );
        }
    });

    return adjusted;
}
```

---

## 5. SAFETY AUDIT

### Comprehensive Safety Checklist

| # | Question | Answer | Mitigation |
|---|----------|--------|------------|
| 1 | Can this feature EVER produce inappropriate content? | **No** - All displayed content is pre-written | Content library reviewed and approved |
| 2 | Can players manipulate this feature? | **Limited** - Input sanitization on all player data | Whitelist validation, no raw input used |
| 3 | What happens if the AI fails/errors? | **Graceful fallback** - Deterministic behavior | 3-tier fallback: Cloud AI → Local AI → Algorithmic |
| 4 | Is there always a safe fallback? | **Yes** - Every AI decision has deterministic alternative | Fallback tested independently |
| 5 | Does this respect the existing SafetyManager? | **Yes** - Integrated with SafetyManager checks | Kid profile flags honored |
| 6 | Is this appropriate for the youngest players? | **Yes** - All content is pre-approved for ages 8+ | KidMode integration for extra safeguards |

### Risk Assessment Matrix

| Feature | Risk Level | Risk Description | Mitigation |
|---------|------------|------------------|------------|
| Behavior Selection | Low | Wrong behavior chosen | Pre-defined safe behaviors only |
| Memory System | Low | Sensitive data stored | Opt-in only, privacy controls |
| Offline Simulation | Very Low | Inappropriate events | All events from approved library |
| Difficulty Adjustment | Very Low | Too hard/easy | Clamped to safe range |
| Quest Selection | Very Low | Inappropriate quest | Quest library pre-approved |
| Return Stories | Low | Confusing narrative | Template-based, no AI text |

### Never-Do Rules

1. **NEVER** let AI generate text shown directly to children
2. **NEVER** store personal information in memory systems
3. **NEVER** use player input as part of AI prompts without sanitization
4. **NEVER** allow creature to reference real-world events, people, or brands
5. **NEVER** implement features that could create "dark patterns" or addiction
6. **NEVER** allow difficulty to become impossible or frustrating
7. **NEVER** punish players for taking breaks (abandonment should be reversible)
8. **NEVER** create urgency or FOMO mechanics

---

## 6. RECOMMENDED FIRST STEPS

### Immediate Actions (Phase A - Week 1)

1. **Create Behavior Library Config**
```javascript
// src/config/behavior-library.json
{
    "behaviors": {
        "IDLE_BOUNCE": {
            "id": "idle_bounce",
            "category": "idle",
            "animation": "bounce",
            "duration": { "min": 2000, "max": 4000 },
            "energy": 0,
            "canInterrupt": true,
            "weight": 1.0
        },
        // ... 30+ more behaviors
    }
}
```

2. **Create Daily Routines Config**
```javascript
// src/config/daily-routines.json
{
    "schedules": {
        "curious": { /* hourly activities */ },
        "playful": { /* hourly activities */ },
        "gentle": { /* hourly activities */ },
        "wise": { /* hourly activities */ },
        "energetic": { /* hourly activities */ }
    },
    "transitionDuration": 500,
    "randomVariance": 0.2
}
```

3. **Implement CreatureBehaviorEngine**
```javascript
// src/systems/CreatureBehaviorEngine.js
class CreatureBehaviorEngine {
    constructor() {
        this.behaviorLibrary = null;
        this.currentBehavior = null;
        this.behaviorQueue = [];
        this.recentBehaviors = [];
    }

    initialize() {
        this.behaviorLibrary = require('../config/behavior-library.json');
        // Set up event listeners
        window.GameState.on('care_action', (action) => this.reactToCare(action));
    }

    selectBehavior(context) {
        const candidates = this.getValidBehaviors(context);
        const scored = this.scoreBehaviors(candidates, context);
        return this.weightedRandomSelect(scored);
    }

    executeBehavior(behavior, creature, scene) {
        // Play animation
        // Trigger particles
        // Play sound
        // Update state
    }
}
```

4. **Integrate with GameScene**
```javascript
// In GameScene.create()
this.behaviorEngine = new CreatureBehaviorEngine();
this.behaviorEngine.initialize();

// In GameScene.update()
if (!this.creature.isInteracting) {
    this.behaviorEngine.updateBehavior(this.creature, this, time);
}
```

### Testing Checklist for First Implementation

- [ ] Creature shows idle behaviors when not interacting
- [ ] Behaviors change based on time of day
- [ ] Personality affects behavior selection
- [ ] Behaviors don't repeat too frequently
- [ ] All animations play correctly
- [ ] No behaviors cause errors or crashes
- [ ] Fallback works when behavior library missing
- [ ] Kids in testing find creature "feels alive"

---

## Appendix A: Existing System Integration Points

| System | Integration Method | Events to Listen | Events to Emit |
|--------|-------------------|------------------|----------------|
| GameState | Direct access | `changed:creature.*` | N/A |
| CareSystem | Event listener | `careActionPerformed` | N/A |
| CreatureLifecycle | Direct access | N/A | `behavior_changed` |
| CreatureMemory | Log notable events | N/A | `memory/entry_added` |
| FXLibrary | Visual effects | N/A | N/A |
| AudioManager | Sound effects | N/A | N/A |
| KidMode | Enhanced suggestions | N/A | `behavior_suggestion` |

## Appendix B: Content Library Requirements

| Content Type | Minimum Count | Review Required |
|--------------|---------------|-----------------|
| Idle Behaviors | 10 | Yes |
| Movement Behaviors | 8 | Yes |
| Emotional Behaviors | 15 (per mood) | Yes |
| Care Reactions | 5 (per care type) | Yes |
| Discovery Reactions | 10 | Yes |
| Offline Evidence Items | 20 | Yes |
| Return Story Templates | 15 | Yes |
| Quest Templates | 30 | Yes |

---

*Document Version: 1.0*
*Last Updated: January 2025*
*Author: Claude (AI Assistant)*

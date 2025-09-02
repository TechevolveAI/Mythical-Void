# Product Requirements Document (PRD)
## Mythical Void - Phases 1-3
### Version 1.0 | Date: August 2025

---

## Executive Summary

Mythical Void is an AI-powered creature companion game where players, as crash-landed space explorers, discover and nurture the last eggs of an ancient magical species. The game's unique differentiator is meaningful AI conversations with creatures that directly impact gameplay progression through the "LifeCurrent" system - a magical energy network that reveals secrets based on trust and communication.

Phases 1-3 (9 weeks) will establish the core gameplay loop: AI chat integration, exploration mechanics, and retention systems, targeting 40% D7 retention and laying the foundation for future monetization.

---

## Problem Statement

Current virtual pet games lack:
1. **Meaningful AI Integration**: Existing games use chat as a gimmick rather than core gameplay
2. **Narrative Depth**: Pet games typically lack compelling storylines that drive engagement
3. **Purpose-Driven Progression**: Players need clear goals beyond simple caretaking
4. **Emotional Investment**: Generic pets don't create lasting bonds with players

---

## Solution Overview

A narrative-driven creature game where:
- **AI Chat is Gameplay**: Conversations unlock abilities, reveal locations, and progress the story
- **Rich Lore**: Players uncover a mystery about an ancient civilization through creature memories
- **Clear Mission**: Find eggs, build camps, restore a species from extinction
- **Personal Connection**: Each creature develops a unique personality based on interactions

---

# PHASE 1: MVP - Core AI Chat Experience
## Weeks 1-3 | Sprint: FOUNDATION

### 1.1 Narrative & Onboarding

#### User Story
*As a new player, I want to understand why I'm on this planet and what my mission is, so I feel motivated to explore and care for creatures.*

#### Functional Requirements

**FR1.1.1 - Crash Landing Sequence**
- **Description**: Animated intro showing ship malfunction and crash
- **Acceptance Criteria**:
  - [ ] 30-second skippable cutscene
  - [ ] Ship crashes near first egg
  - [ ] Visual establishing shot of alien planet
  - [ ] Player emerges from wreckage
  - [ ] Auto-saves after completion

**FR1.1.2 - Player Naming**
- **Description**: Name input for the "Sky Walker" character
- **Acceptance Criteria**:
  - [ ] Text input field (3-20 characters)
  - [ ] Profanity filter
  - [ ] Name used in creature dialogue
  - [ ] Stored in GameState
  - [ ] Default to "Explorer" if skipped

**FR1.1.3 - First Egg Discovery**
- **Description**: Guided discovery of first creature egg
- **Acceptance Criteria**:
  - [ ] Glowing effect on egg
  - [ ] Tutorial prompt to interact
  - [ ] Egg responds to player proximity
  - [ ] Hatching triggered by player action
  - [ ] Establishes "prophecy" narrative

### 1.2 Creature Chat System

#### User Story
*As a player, I want to chat with my creature to learn about the world and build a relationship, so I feel connected to my companion.*

#### Functional Requirements

**FR1.2.1 - Chat Interface**
- **Description**: Overlay UI for creature conversations
- **Acceptance Criteria**:
  - [ ] Opens on creature click/tap
  - [ ] 400x500px desktop, responsive mobile
  - [ ] Message history (20 messages)
  - [ ] Smooth open/close animations
  - [ ] Semi-transparent backdrop
  - [ ] Minimize/maximize buttons

**FR1.2.2 - Message Components**
- **Description**: Individual message display elements
- **Acceptance Criteria**:
  - [ ] Player messages (right-aligned, blue)
  - [ ] Creature messages (left-aligned, mood-colored)
  - [ ] Creature avatar (40x40px)
  - [ ] Timestamps on hover
  - [ ] Auto-scroll to newest
  - [ ] 200 character input limit

**FR1.2.3 - Typing Indicators**
- **Description**: Visual feedback during AI response generation
- **Acceptance Criteria**:
  - [ ] "..." animation while thinking
  - [ ] 1-3 second variable delay
  - [ ] Character-by-character text streaming
  - [ ] Smooth text appearance
  - [ ] Sound effect option

### 1.3 Grok LLM Integration

#### User Story
*As a player, I want my creature to respond intelligently and remember our conversations, so interactions feel meaningful.*

#### Functional Requirements

**FR1.3.1 - API Connection**
- **Description**: Secure connection to Grok/XAI service
- **Acceptance Criteria**:
  - [ ] Uses environment variables for API keys
  - [ ] HTTPS encrypted requests
  - [ ] 5-second timeout
  - [ ] Automatic retry (3 attempts)
  - [ ] Error message fallbacks

**FR1.3.2 - System Prompt Engineering**
- **Description**: Context-aware prompts for creature personality
- **Acceptance Criteria**:
  - [ ] Includes Sky Walker narrative
  - [ ] Personality based on traits
  - [ ] Mood affects tone
  - [ ] References game state
  - [ ] 1000 token limit

**FR1.3.3 - Conversation Memory**
- **Description**: Persistent storage of chat history
- **Acceptance Criteria**:
  - [ ] Last 100 messages stored
  - [ ] LocalStorage persistence
  - [ ] Context window of 20 messages
  - [ ] Conversation summaries
  - [ ] 5MB storage limit

### 1.4 LifeCurrent Introduction

#### User Story
*As a player, I want to understand the LifeCurrent system, so I know how to find eggs and build camps effectively.*

#### Functional Requirements

**FR1.4.1 - Visual Hints**
- **Description**: Particle effects showing LifeCurrent flows
- **Acceptance Criteria**:
  - [ ] Subtle shimmer effects
  - [ ] Stronger near Wellsprings
  - [ ] Color indicates strength
  - [ ] Performance optimized (<5% CPU)
  - [ ] Toggle in settings

**FR1.4.2 - Tutorial Wellspring**
- **Description**: First discoverable Wellspring location
- **Acceptance Criteria**:
  - [ ] Within 200 units of start
  - [ ] Creature guides player
  - [ ] Visual landmark
  - [ ] Healing properties
  - [ ] Explains LifeCurrent concept

---

# PHASE 2: Core Gameplay Loop
## Weeks 4-6 | Sprint: EXPLORATION

### 2.1 LifeCurrent Attunement System

#### User Story
*As a player, I want chatting with my creature to improve our abilities, so conversation has gameplay value.*

#### Functional Requirements

**FR2.1.1 - Attunement Progression**
- **Description**: 0-100 scale increased through meaningful chat
- **Acceptance Criteria**:
  - [ ] +1 point per meaningful exchange
  - [ ] Visual progress bar
  - [ ] Milestone notifications
  - [ ] Affects egg detection range
  - [ ] Persists between sessions

**FR2.1.2 - Ability Unlocks**
- **Description**: Progressive ability system tied to attunement
- **Acceptance Criteria**:
  - [ ] Level 10: See LifeCurrent flows
  - [ ] Level 20: Vague egg directions
  - [ ] Level 30: Access location memories
  - [ ] Level 40: Precise egg markers
  - [ ] Level 50: Wellspring fast travel

**FR2.1.3 - Visual Feedback**
- **Description**: World changes based on attunement level
- **Acceptance Criteria**:
  - [ ] LifeCurrent becomes visible
  - [ ] Egg indicators appear
  - [ ] Wellsprings glow brighter
  - [ ] UI shows current level
  - [ ] Achievement popups

### 2.2 Exploration & Discovery

#### User Story
*As a player, I want to explore diverse environments and find hidden eggs, so I feel rewarded for exploration.*

#### Functional Requirements

**FR2.2.1 - Biome Implementation**
- **Description**: Three distinct explorable areas
- **Acceptance Criteria**:
  - [ ] Crystal Forest biome
  - [ ] Ancient Ruins biome
  - [ ] Floating Islands biome
  - [ ] Unique visual themes
  - [ ] Different egg types per biome

**FR2.2.2 - Egg Discovery System**
- **Description**: 10 findable eggs across world
- **Acceptance Criteria**:
  - [ ] Hidden in logical locations
  - [ ] Creature provides hints
  - [ ] Discovery animation
  - [ ] Each has unique traits
  - [ ] Progress tracking UI

**FR2.2.3 - Resource Gathering**
- **Description**: Collectible materials for crafting
- **Acceptance Criteria**:
  - [ ] Star Crystals (rare)
  - [ ] Life Essence (common)
  - [ ] Memory Fragments (uncommon)
  - [ ] Visual collection effects
  - [ ] Inventory system (50 slots)

### 2.3 Trust & Relationship System

#### User Story
*As a player, I want my relationship with creatures to deepen over time, so I feel emotionally invested.*

#### Functional Requirements

**FR2.3.1 - Trust Levels**
- **Description**: 0-100 relationship scale
- **Acceptance Criteria**:
  - [ ] +2 trust per chat session
  - [ ] +5 for completing requests
  - [ ] Visual heart meter
  - [ ] Affects information quality
  - [ ] Unlocks special dialogues

**FR2.3.2 - Chat-Triggered Quests**
- **Description**: Dynamic quests from conversations
- **Acceptance Criteria**:
  - [ ] 3 quest types (find, build, care)
  - [ ] Generated based on topics
  - [ ] 24-hour time limits
  - [ ] Rewards (XP, trust, items)
  - [ ] Quest log UI

**FR2.3.3 - Knowledge Banking**
- **Description**: Information learned through chat
- **Acceptance Criteria**:
  - [ ] Categorized discoveries
  - [ ] Lore entries unlock
  - [ ] Hints become map markers
  - [ ] Journal UI interface
  - [ ] Search functionality

### 2.4 Void Corruption System

#### User Story
*As a player, I want urgency in finding eggs, so I feel motivated to explore actively rather than passively.*

#### Functional Requirements

**FR2.4.1 - Corruption Spread**
- **Description**: Progressive world threat system
- **Acceptance Criteria**:
  - [ ] 1 zone corrupts per week
  - [ ] Visual corruption effects
  - [ ] Timer countdown UI
  - [ ] Warning notifications
  - [ ] Corruption map overlay

**FR2.4.2 - Egg Loss Mechanic**
- **Description**: Consequences for not rescuing eggs
- **Acceptance Criteria**:
  - [ ] Eggs in corrupted zones fade
  - [ ] 3-day warning period
  - [ ] Creature shows distress
  - [ ] Lost eggs become shadows
  - [ ] Can be purified later

**FR2.4.3 - Basic Defense**
- **Description**: Simple structures to slow corruption
- **Acceptance Criteria**:
  - [ ] Light Beacon buildable
  - [ ] Costs 10 Star Crystals
  - [ ] Slows corruption by 50%
  - [ ] Visual protection radius
  - [ ] Maximum 3 active

---

# PHASE 3: Engagement & Retention
## Weeks 7-9 | Sprint: RETENTION

### 3.1 Camp Building System

#### User Story
*As a player, I want to build camps for my creatures, so I can create safe havens and see my progress.*

#### Functional Requirements

**FR3.1.1 - Camp Placement**
- **Description**: Strategic camp positioning system
- **Acceptance Criteria**:
  - [ ] Place at LifeCurrent nodes
  - [ ] Visual placement preview
  - [ ] Collision detection
  - [ ] 3 camps maximum
  - [ ] Naming system

**FR3.1.2 - Basic Structures**
- **Description**: Initial building types
- **Acceptance Criteria**:
  - [ ] Shelter (creature rest)
  - [ ] Storage (100 items)
  - [ ] Garden (food production)
  - [ ] Wellspring Tap (healing)
  - [ ] Crafting station

**FR3.1.3 - Camp Benefits**
- **Description**: Gameplay advantages from camps
- **Acceptance Criteria**:
  - [ ] +15% creature happiness
  - [ ] +20% resource generation
  - [ ] Fast travel points
  - [ ] Egg incubation boost
  - [ ] Auto-gathering radius

### 3.2 Collection & Progression

#### User Story
*As a player, I want to collect different creature variants, so I feel motivated to explore thoroughly.*

#### Functional Requirements

**FR3.2.1 - Creature Codex**
- **Description**: Collection tracking interface
- **Acceptance Criteria**:
  - [ ] Grid view of discoveries
  - [ ] 50 variants total
  - [ ] Silhouettes for undiscovered
  - [ ] Stats and traits display
  - [ ] Completion percentage

**FR3.2.2 - Rarity System**
- **Description**: Creature variant classification
- **Acceptance Criteria**:
  - [ ] Common (60% chance)
  - [ ] Uncommon (25% chance)
  - [ ] Rare (12% chance)
  - [ ] Epic (3% chance)
  - [ ] Visual rarity indicators

**FR3.2.3 - Achievement System**
- **Description**: Player accomplishment tracking
- **Acceptance Criteria**:
  - [ ] 30 achievements total
  - [ ] Categories (exploration, care, building)
  - [ ] Progress bars
  - [ ] Reward unlocks
  - [ ] Steam/mobile integration ready

### 3.3 Daily Engagement

#### User Story
*As a player, I want reasons to return daily, so the game becomes part of my routine.*

#### Functional Requirements

**FR3.3.1 - Daily Login Bonuses**
- **Description**: Escalating daily rewards
- **Acceptance Criteria**:
  - [ ] 7-day cycle
  - [ ] Increasing rewards
  - [ ] Streak tracking
  - [ ] Missed day recovery
  - [ ] Special weekly reward

**FR3.3.2 - Daily Quests**
- **Description**: Rotating daily objectives
- **Acceptance Criteria**:
  - [ ] 3 quests per day
  - [ ] Varied objectives
  - [ ] Creature-themed
  - [ ] XP and item rewards
  - [ ] 24-hour reset timer

**FR3.3.3 - Creature Daily Interactions**
- **Description**: Time-based creature events
- **Acceptance Criteria**:
  - [ ] Morning greeting
  - [ ] Afternoon discovery
  - [ ] Evening story
  - [ ] Unique per creature
  - [ ] Push notifications

### 3.4 Challenge Systems

#### User Story
*As a player, I want varied challenges beyond exploration, so gameplay stays fresh and engaging.*

#### Functional Requirements

**FR3.4.1 - LifeCurrent Puzzles**
- **Description**: Flow redirection minigames
- **Acceptance Criteria**:
  - [ ] 10 puzzle locations
  - [ ] Increasing difficulty
  - [ ] Visual flow mechanics
  - [ ] Unlock secret areas
  - [ ] Skip after 3 attempts

**FR3.4.2 - Shadow Encounters**
- **Description**: Corrupted creature purification
- **Acceptance Criteria**:
  - [ ] Non-violent mechanics
  - [ ] Memory matching gameplay
  - [ ] Timed challenges
  - [ ] Rescue corrupted eggs
  - [ ] Unique rewards

**FR3.4.3 - Environmental Events**
- **Description**: Dynamic world challenges
- **Acceptance Criteria**:
  - [ ] Weather system
  - [ ] LifeCurrent surges
  - [ ] Meteor showers
  - [ ] Affect gameplay
  - [ ] Creature warnings

---

## Non-Functional Requirements

### Performance
- **Load Time**: < 3 seconds initial load
- **Frame Rate**: 60 FPS on modern devices
- **Memory Usage**: < 500MB RAM
- **Battery Life**: < 10% drain per hour mobile
- **Network**: Offline mode with sync

### Reliability
- **Uptime**: 99.9% availability
- **Save System**: Auto-save every 60 seconds
- **Crash Rate**: < 0.1% of sessions
- **Data Loss**: Zero tolerance
- **Recovery**: Automatic crash recovery

### Usability
- **Onboarding**: 80% completion rate
- **Tutorial**: Skippable but comprehensive
- **Accessibility**: Screen reader support
- **Languages**: English (more planned)
- **Age Rating**: E for Everyone

### Security
- **API Keys**: Environment variables only
- **User Data**: Local storage encrypted
- **Chat Filter**: Profanity blocking
- **COPPA**: Compliant for under-13
- **GDPR**: Privacy controls included

---

## Success Metrics

### Phase 1 (Weeks 1-3)
- **D1 Retention**: > 60%
- **Chat Engagement**: 5+ messages per session
- **Session Length**: > 10 minutes
- **Completion Rate**: 70% finish intro
- **Crash Rate**: < 0.5%

### Phase 2 (Weeks 4-6)
- **D7 Retention**: > 40%
- **Eggs Found**: Average 5 per player
- **Attunement Level**: Average > 30
- **Trust Level**: Average > 40
- **Exploration**: 60% of map discovered

### Phase 3 (Weeks 7-9)
- **D30 Retention**: > 30%
- **DAU**: > 1,000 players
- **Sessions/Day**: > 2 average
- **Camp Building**: 80% build at least one
- **Collection**: 20% completion average

---

## Dependencies

### Technical Dependencies
- Phaser.js 3.70.0
- Grok/XAI API access
- LocalStorage (5MB minimum)
- WebGL support
- Internet connection (API calls)

### External Dependencies
- API rate limits (1000/day)
- Asset creation timeline
- QA testing resources
- App store requirements
- Marketing materials

---

## Risk Analysis

### High Risk
- **API Costs**: Implement caching, rate limiting
- **Creature Personality**: Extensive prompt testing needed
- **Retention Drop**: A/B test onboarding variations

### Medium Risk
- **Performance Issues**: Progressive optimization required
- **Save Corruption**: Multiple backup systems
- **Content Volume**: Prioritize quality over quantity

### Low Risk
- **Technology Stack**: Proven and stable
- **Scope Creep**: Phases clearly defined
- **Competition**: Unique AI differentiator

---

## Timeline & Milestones

### Phase 1: Foundation (Weeks 1-3)
**Week 1**: Narrative, Chat UI
**Week 2**: API Integration, System Prompts
**Week 3**: Testing, Polish, Alpha Release

### Phase 2: Exploration (Weeks 4-6)
**Week 4**: Attunement System, Biomes
**Week 5**: Trust System, Egg Discovery
**Week 6**: Void Corruption, Testing

### Phase 3: Retention (Weeks 7-9)
**Week 7**: Camp Building, Collection
**Week 8**: Daily Systems, Achievements
**Week 9**: Challenges, Beta Release

---

## Approval & Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Technical Lead | | | |
| Design Lead | | | |
| QA Lead | | | |

---

## Appendices

### A. User Personas
1. **Casual Carla**: Plays 15 min/day, loves creatures
2. **Explorer Eric**: Completionist, finds everything
3. **Social Sarah**: Shares experiences, wants multiplayer
4. **Builder Bob**: Focuses on camps and optimization

### B. Competitive Analysis
- **Tamagotchi**: Simple care, no narrative
- **Pokémon**: Collection focus, no AI chat
- **Nintendogs**: Realistic pets, limited gameplay
- **AI Dungeon**: Chat focus, no visual gameplay

### C. Technical Architecture
- Frontend: Phaser.js + HTML5
- AI: Grok API via HTTPS
- Storage: LocalStorage + Future cloud
- Analytics: Mixpanel (Phase 4)
- Deployment: Netlify → App Stores

---

*End of PRD - Phases 1-3*